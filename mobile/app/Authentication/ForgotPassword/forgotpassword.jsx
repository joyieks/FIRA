import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';

const ForgotPasswordScreen = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: New Password, 4: Success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [generatedCode, setGeneratedCode] = useState('');
  
  const router = useRouter();

  const validateEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

  const displayToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  const handleSendCode = async () => {
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setEmailError('');
    setError('');

    try {
      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);

      // Check if user exists in any of the user tables
      let userData = null;
      let userTable = null;

      // Check admin_users table
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('id, email, first_name, last_name')
        .eq('email', email)
        .single();

      if (adminData) {
        userData = adminData;
        userTable = 'admin_users';
      }

      // Check station_users table
      if (!userData) {
        const { data: stationData } = await supabase
          .from('station_users')
          .select('id, email, station_name')
          .eq('email', email)
          .single();

        if (stationData) {
          userData = { ...stationData, first_name: stationData.station_name };
          userTable = 'station_users';
        }
      }

      // Check citizen_users table
      if (!userData) {
        const { data: citizenData } = await supabase
          .from('citizen_users')
          .select('id, email, first_name, last_name')
          .eq('email', email)
          .single();

        if (citizenData) {
          userData = citizenData;
          userTable = 'citizen_users';
        }
      }

      // Check responders table
      if (!userData) {
        const { data: responderData } = await supabase
          .from('responders')
          .select('id, email, first_name, last_name')
          .eq('email', email)
          .single();

        if (responderData) {
          userData = responderData;
          userTable = 'responders';
        }
      }

      if (!userData) {
        setError('No account found with this email address.');
        setIsLoading(false);
        return;
      }

      console.log(`✅ User found in ${userTable} table`);

      // Store the verification code in the database
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: codeError } = await supabase
        .from('password_reset_codes')
        .upsert({
          email: email,
          code: code,
          user_table: userTable,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        });

      if (codeError) {
        console.error('Error storing verification code:', codeError);
        setError('Failed to send verification code. Please try again.');
        setIsLoading(false);
        return;
      }

      // Send email using EmailJS (using fetch API for React Native)
      const serviceId = 'service_5k3e6xe';
      const templateId = 'template_x9i685u';
      const publicKey = 'N_WM9SM_s6cRQPVgT';
      const privateKey = 'EUqRUy4vpBAf6rEiPXndd';

      const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString();

      const templateParams = {
        to_name: userData.first_name || 'User',
        passcode: code,
        time: expirationTime,
        user_email: email
      };

      console.log('📤 Sending password reset email...');

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: templateParams,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('EmailJS Error:', errorText);
        throw new Error('Failed to send email');
      }

      console.log('✅ Password reset email sent successfully');

      setIsLoading(false);
      setStep(2);
      displayToast('Verification code sent to your email!', 'success');
    } catch (error) {
      console.error('Error sending verification code:', error);
      setError('Failed to send verification code. Please try again.');
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setIsLoading(true);
    setError('');
    const enteredCode = code.join('');

    try {
      // Verify the code from the database
      const { data: codeData, error: codeError } = await supabase
        .from('password_reset_codes')
        .select('*')
        .eq('email', email)
        .eq('code', enteredCode)
        .single();

      if (codeError || !codeData) {
        setError('Invalid verification code. Please try again.');
        setIsLoading(false);
        return;
      }

      // Check if code has expired
      const expiresAt = new Date(codeData.expires_at);
      const now = new Date();

      if (now > expiresAt) {
        setError('Verification code has expired. Please request a new one.');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setStep(3);
    } catch (error) {
      console.error('Error verifying code:', error);
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match!");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters!");
      return;
    }

    setIsLoading(true);

    try {
      // Get the verification code data
      const { data: codeData, error: codeError } = await supabase
        .from('password_reset_codes')
        .select('user_table, code')
        .eq('email', email)
        .single();

      if (codeError || !codeData) {
        setError('Verification session expired. Please start over.');
        setIsLoading(false);
        return;
      }

      const userTable = codeData.user_table;

      // Try to call the Edge Function to reset password
      try {
        const { data: resetData, error: resetError } = await supabase.functions.invoke('reset-password', {
          body: {
            email: email,
            newPassword: newPassword,
            verificationCode: codeData.code,
            userTable: userTable
          }
        });

        if (resetError) {
          console.error('Error calling reset function:', resetError);
          console.log('⚠️ Edge Function error. Please contact support or ensure the reset-password function is deployed.');
          throw new Error('Edge Function not available');
        }

        console.log('✅ Password reset via Edge Function:', resetData);

        // Delete the verification code
        await supabase
          .from('password_reset_codes')
          .delete()
          .eq('email', email);

        console.log(`✅ Password reset completed for ${email}`);

        setIsLoading(false);
        setStep(4);
        displayToast('Password updated successfully!', 'success');

        setTimeout(() => {
          router.replace('/Authentication/login');
        }, 2000);
      } catch (edgeFunctionError) {
        console.error('Edge Function not available:', edgeFunctionError);
        
        // Clean up the reset code
        await supabase
          .from('password_reset_codes')
          .delete()
          .eq('email', email);

        setIsLoading(false);
        setError('Password reset service is currently unavailable. Please contact support or try again later.');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setError('An error occurred during password reset. Please try again.');
      setIsLoading(false);
    }
  };

  const handleCodeChange = (value, index) => {
    if (isNaN(value)) return;

    const newCode = [...code];
    newCode[index] = value.substring(value.length - 1);
    setCode(newCode);
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Generate a new 6-digit code
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(newCode);

      // Get existing reset code data
      const { data: existingCode } = await supabase
        .from('password_reset_codes')
        .select('user_table')
        .eq('email', email)
        .single();

      let userTable = existingCode?.user_table;
      let firstName = 'User';

      // Get user's name
      if (userTable) {
        if (userTable === 'station_users') {
          const { data: stationData } = await supabase
            .from('station_users')
            .select('station_name')
            .eq('email', email)
            .single();
          firstName = stationData?.station_name || 'User';
        } else {
          const { data: userData } = await supabase
            .from(userTable)
            .select('first_name')
            .eq('email', email)
            .single();
          firstName = userData?.first_name || 'User';
        }
      }

      // Store the new verification code
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: codeError } = await supabase
        .from('password_reset_codes')
        .upsert({
          email: email,
          code: newCode,
          user_table: userTable,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        });

      if (codeError) {
        setError('Failed to resend verification code. Please try again.');
        setIsLoading(false);
        return;
      }

      // Send email
      const serviceId = 'service_5k3e6xe';
      const templateId = 'template_x9i685u';
      const publicKey = 'N_WM9SM_s6cRQPVgT';
      const privateKey = 'EUqRUy4vpBAf6rEiPXndd';

      const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString();

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            to_name: firstName,
            passcode: newCode,
            time: expirationTime,
            user_email: email
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('EmailJS Error:', errorText);
        throw new Error('Failed to send email');
      }

      setIsLoading(false);
      displayToast('A new verification code has been sent to your email.', 'success');
    } catch (error) {
      console.error('Error resending code:', error);
      setError('Failed to resend verification code. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1">
        <View className="flex-1 px-8 py-12">
          <TouchableOpacity 
            style={{ position: 'absolute', top: 40, left: 20, zIndex: 10 }} 
            onPress={() => step > 1 && step < 4 ? setStep(step - 1) : router.back()}
          >
            <AntDesign name="left" size={32} color="#dc2626" />
          </TouchableOpacity>

          {/* Header */}
          <View className="items-center mb-8 mt-12">
            <MaterialIcons name="lock-reset" size={80} color="#dc2626" />
            <Text className="text-3xl font-bold text-fire mt-4">
              {step === 1 && 'Reset Password'}
              {step === 2 && 'Verify Code'}
              {step === 3 && 'New Password'}
              {step === 4 && 'Success!'}
            </Text>
            <Text className="text-gray-600 text-center mt-2">
              {step === 1 && "Enter your email to receive a verification code"}
              {step === 2 && `We sent a code to ${email}`}
              {step === 3 && "Create your new password"}
              {step === 4 && "Your password has been reset successfully"}
            </Text>
          </View>

          {/* Progress Indicator */}
          {step < 4 && (
            <View className="flex-row justify-between mb-8">
              <View className={`h-1 flex-1 rounded ${step >= 1 ? 'bg-fire' : 'bg-gray-300'}`} />
              <View className="w-2" />
              <View className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-fire' : 'bg-gray-300'}`} />
              <View className="w-2" />
              <View className={`h-1 flex-1 rounded ${step >= 3 ? 'bg-fire' : 'bg-gray-300'}`} />
            </View>
          )}

          {/* Step 1: Email Input */}
          {step === 1 && (
            <View>
              <View className="mb-8">
                <Text className="text-lg font-medium text-gray-700 mb-2">Email Address</Text>
                <TextInput
                  className={`border ${emailError || error ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3 mb-1`}
                  placeholder="Enter your email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError('');
                    if (error) setError('');
                  }}
                />
                {(emailError || error) && <Text className="text-fire text-sm mt-1">{emailError || error}</Text>}
              </View>

              <TouchableOpacity 
                className={`py-4 rounded-xl items-center mb-4 ${isLoading ? 'bg-gray-400' : 'bg-fire'}`}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                <Text className="text-white font-bold text-lg">
                  {isLoading ? 'Sending...' : 'Send Verification Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                className="items-center mt-4"
                onPress={() => router.replace('/Authentication/login')}
              >
                <Text className="text-fire font-medium">Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Code Verification */}
          {step === 2 && (
            <View>
              <View className="mb-6">
                <Text className="text-center text-gray-600 mb-4">Enter the 6-digit code</Text>
                <View className="flex-row justify-between">
                  {code.map((digit, index) => (
                    <TextInput
                      key={index}
                      className="w-12 h-14 border-2 border-gray-300 rounded-lg text-center text-xl font-bold"
                      maxLength={1}
                      keyboardType="number-pad"
                      value={digit}
                      onChangeText={(value) => handleCodeChange(value, index)}
                    />
                  ))}
                </View>
                {error && <Text className="text-fire text-sm mt-2 text-center">{error}</Text>}
              </View>

              <TouchableOpacity 
                className={`py-4 rounded-xl items-center mb-4 ${isLoading || code.join('').length !== 6 ? 'bg-gray-400' : 'bg-fire'}`}
                onPress={handleVerifyCode}
                disabled={isLoading || code.join('').length !== 6}
              >
                <Text className="text-white font-bold text-lg">
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                className="items-center"
                onPress={handleResendCode}
                disabled={isLoading}
              >
                <Text className="text-fire font-medium">Resend Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <View>
              <View className="mb-6">
                <Text className="text-lg font-medium text-gray-700 mb-2">New Password</Text>
                <View className="relative">
                  <TextInput
                    className="border border-gray-300 rounded-lg px-4 py-3 pr-12"
                    placeholder="Enter new password"
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (error) setError('');
                    }}
                  />
                  <TouchableOpacity 
                    className="absolute right-4 top-3"
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <Text className="text-gray-500 text-sm mt-1">Must be at least 8 characters</Text>
              </View>

              <View className="mb-6">
                <Text className="text-lg font-medium text-gray-700 mb-2">Confirm Password</Text>
                <View className="relative">
                  <TextInput
                    className="border border-gray-300 rounded-lg px-4 py-3 pr-12"
                    placeholder="Confirm new password"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (error) setError('');
                    }}
                  />
                  <TouchableOpacity 
                    className="absolute right-4 top-3"
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <MaterialIcons name={showConfirmPassword ? "visibility" : "visibility-off"} size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                {error && <Text className="text-fire text-sm mt-2">{error}</Text>}
              </View>

              <TouchableOpacity 
                className={`py-4 rounded-xl items-center ${isLoading || !newPassword || !confirmPassword ? 'bg-gray-400' : 'bg-fire'}`}
                onPress={handleResetPassword}
                disabled={isLoading || !newPassword || !confirmPassword}
              >
                <Text className="text-white font-bold text-lg">
                  {isLoading ? 'Updating...' : 'Reset Password'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <View className="items-center">
              <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
                <MaterialIcons name="check-circle" size={60} color="#10B981" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 mb-2">All Done!</Text>
              <Text className="text-gray-600 text-center mb-8">
                Your password has been reset successfully. You can now login with your new password.
              </Text>
              <TouchableOpacity 
                className="py-4 px-8 rounded-xl items-center bg-fire"
                onPress={() => router.replace('/Authentication/login')}
              >
                <Text className="text-white font-bold text-lg">Go to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Toast Notification */}
      {showToast && (
        <View className="absolute top-20 left-4 right-4 z-50">
          <View className={`rounded-xl p-4 flex-row items-center shadow-xl ${
            toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            <MaterialIcons 
              name={toastType === 'success' ? 'check-circle' : 'error'} 
              size={28} 
              color="#ffffff" 
            />
            <Text className="text-white font-bold ml-3 flex-1 text-base">
              {toastMessage}
            </Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default ForgotPasswordScreen;export const options = {
  headerShown: false,
};


