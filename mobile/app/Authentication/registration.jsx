import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { supabase } from '../config/supabase';

const RegistrationComponent = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    agreeTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [userInputCode, setUserInputCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // EmailJS configuration
  const serviceId = 'service_5k3e6xe';
  const templateId = 'template_x9i685u';  // Your Password Reset template
  const publicKey = 'N_WM9SM_s6cRQPVgT';
  const privateKey = 'EUqRUy4vpBAf6rEiPXndd';

  useEffect(() => {
    // Countdown timer for resend button
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const sendVerificationCode = async (email, firstName) => {
    try {
      console.log('🚀 Starting verification code send...');
      console.log('📧 Email:', email);
      console.log('👤 First Name:', firstName);
      
      // Generate 6-digit verification code
      const code = Math.random().toString().slice(2, 8);
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString();

      const templateParams = {
        to_name: firstName,
        passcode: code,
        time: expirationTime,
        user_email: email
      };

      console.log('📋 Template Params:', templateParams);
      console.log('📤 Sending email via EmailJS...');

      // Use EmailJS REST API with private key
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,  // Add private key for strict mode
          template_params: templateParams,
        }),
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ EmailJS Error Response:', errorText);
        throw new Error('Failed to send verification code. Please try again.');
      }

      // Check if response is successful
      const responseData = await response.text();
      console.log('✅ EmailJS Response:', responseData);

      // Store the code for verification
      setVerificationCode(code);
      console.log('💾 Verification code stored:', code);
      
      // Start resend countdown (60 seconds)
      setResendCountdown(60);
      
      return code;
      
    } catch (error) {
      console.error('❌ EmailJS Error Details:', error);
      throw new Error(`Failed to send verification code: ${error.message}`);
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^09\d{9}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number (09XXXXXXXXX)';
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    try {
      setIsLoading(true);
      
      // Send verification code first
      await sendVerificationCode(formData.email, formData.firstName);
      
      // Show verification UI
      setShowVerification(true);
      
    } catch (error) {
      console.error('Error sending verification code:', error);
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (userInputCode !== verificationCode) {
      Alert.alert('Invalid Code', 'Please enter the correct verification code.');
      return;
    }
  
    try {
      setIsLoading(true);
      
      // Create Supabase Auth account
      console.log('🔄 Creating Supabase Auth account...');
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.toLowerCase(),
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phoneNumber,
            user_type: 'citizen'
          },
          emailRedirectTo: null
        }
      });
  
      if (authError) {
        console.error('❌ Supabase Auth error:', authError);
        throw new Error(`Failed to create auth account: ${authError.message}`);
      }
  
      console.log('✅ Supabase Auth account created:', authData.user.id);
  
      // Confirm the user's email through our custom database function
      const { error: confirmError } = await supabase.rpc('confirm_user_email', {
        user_id: authData.user.id
      });
  
      if (confirmError) {
        console.error('⚠️ Could not confirm email:', confirmError);
      } else {
        console.log('✅ Email confirmed successfully');
      }
  
      // Create user data for citizen_users table
      const userData = {
        id: authData.user.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email.toLowerCase(),
        phone: formData.phoneNumber,
        display_name: `${formData.firstName} ${formData.lastName}`,
        status: 'active',
        reports: 0,
        created_at: new Date().toISOString(),
        is_verified: true,
      };
  
      // Insert into Supabase citizen_users table
      const { data, error } = await supabase
        .from('citizen_users')
        .insert([userData])
        .select();
  
      if (error) {
        console.error('❌ Supabase insert error:', error);
        throw new Error(`Failed to create user profile: ${error.message}`);
      }
  
      console.log('✅ User profile created in Supabase:', data[0]);
      
      // Hide verification screen immediately
      setShowVerification(false);
      
      // Show success message and redirect to login instead of trying to maintain session
      Alert.alert(
        'Account Created Successfully!',
        'Your account has been created and verified. Please log in to continue.',
        [{ 
          text: 'Login Now', 
          onPress: () => {
            // Clear form data
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              password: '',
              confirmPassword: '',
              phoneNumber: '',
              agreeTerms: false,
            });
            setUserInputCode('');
            setVerificationCode('');
            
            // Navigate to login
            router.replace('/Authentication/login');
          }
        }]
      );
      
    } catch (error) {
      console.error('Account creation error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResendCode = async () => {
    if (resendCountdown > 0) return;

    try {
      setIsLoading(true);
      await sendVerificationCode(formData.email, formData.firstName);
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error) {
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Show verification UI
  if (showVerification) {
    return (
      <View className="flex-1 bg-white px-6">
        <TouchableOpacity 
          style={{ position: 'absolute', top: 40, left: 0, zIndex: 10 }} 
          onPress={() => setShowVerification(false)}
        >
          <AntDesign name="arrowleft" size={32} color="#dc2626" />
        </TouchableOpacity>

        <View className="flex-1 justify-center items-center">
          <View className="w-20 h-20 bg-red-600 rounded-full justify-center items-center mb-6">
            <Text className="text-white text-2xl font-bold">F</Text>
          </View>
          
          <Text className="text-2xl font-bold text-gray-800 mb-2">Verify Your Email</Text>
          <Text className="text-gray-600 text-center mb-8">
            We've sent a verification code to {formData.email}
          </Text>

          <View className="w-full max-w-xs">
            <Text className="text-gray-700 mb-2">Enter Verification Code</Text>
            <TextInput
              className="border-2 border-gray-300 rounded-lg px-4 py-3 text-center text-xl font-bold tracking-widest"
              placeholder="000000"
              value={userInputCode}
              onChangeText={setUserInputCode}
              keyboardType="numeric"
              maxLength={6}
              autoFocus
            />
          </View>

          <TouchableOpacity
            className={`w-full max-w-xs mt-6 py-3 rounded-lg ${userInputCode.length === 6 ? 'bg-red-600' : 'bg-gray-400'}`}
            onPress={handleVerifyCode}
            disabled={userInputCode.length !== 6 || isLoading}
          >
            <Text className="text-white text-center font-semibold">
              {isLoading ? 'Verifying...' : 'Verify & Create Account'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-4"
            onPress={handleResendCode}
            disabled={isLoading || resendCountdown > 0}
          >
            <Text className={`font-medium ${resendCountdown > 0 ? 'text-gray-400' : 'text-red-600'}`}>
              {isLoading ? 'Sending...' : resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white px-6">
      <TouchableOpacity style={{ position: 'absolute', top: 40, left: 0, zIndex: 10 }} onPress={() => router.back()}>
        <AntDesign name="arrowleft" size={32} color="#dc2626" />
      </TouchableOpacity>

      <View className="items-center py-8 mt-8">
        <Image source={require('../../assets/images/getstart2.png')} className="w-20 h-20 mb-4" />
        <Text className="text-2xl font-bold text-fire">Create Account</Text>
      </View>

      {['firstName', 'lastName', 'password', 'confirmPassword', 'email', 'phoneNumber'].map((field, idx) => (
        <View className="mb-4" key={idx}>
          <Text className="text-gray-700 mb-1">
            {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </Text>
          <TextInput
            className={`border ${errors[field] ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
            placeholder={
              field === 'email'
                ? 'Enter your email address'
                : field === 'phoneNumber'
                ? '09XXXXXXXXX'
                : field === 'password' || field === 'confirmPassword'
                ? 'At least 6 characters'
                : ''
            }
            value={formData[field]}
            onChangeText={(text) => handleChange(field, text)}
            secureTextEntry={field === 'password' || field === 'confirmPassword'}
            keyboardType={
              field === 'phoneNumber' ? 'phone-pad' : field === 'email' ? 'email-address' : 'default'
            }
            autoCapitalize="none"
          />
          {errors[field] && <Text className="text-fire text-sm mt-1">{errors[field]}</Text>}
        </View>
      ))}

      <View className="mb-8 flex-row items-start">
        <TouchableOpacity
          className={`w-5 h-5 border ${errors.agreeTerms ? 'border-fire' : 'border-gray-400'} rounded mr-2 mt-1 items-center justify-center`}
          onPress={() => handleChange('agreeTerms', !formData.agreeTerms)}
        >
          {formData.agreeTerms && <View className="w-3 h-3 bg-fire rounded" />}
        </TouchableOpacity>
        <Text className="flex-1 text-gray-600">
          By signing up, you agree to our{' '}
          <Text className="text-fire" onPress={() => router.push('/Policy/TermsAndConditions')}>
            Terms and Conditions
          </Text>{' '}
          and{' '}
          <Text className="text-fire" onPress={() => router.push('/Policy/PrivacyAndPolicy')}>
            Privacy Policy
          </Text>
        </Text>
      </View>

      {errors.agreeTerms && <Text className="text-fire text-sm mb-4">{errors.agreeTerms}</Text>}

      <TouchableOpacity
        className={`w-full py-4 rounded-xl items-center mb-6 ${isLoading ? 'bg-gray-400' : 'bg-fire'}`}
        onPress={handleRegister}
        disabled={isLoading}
      >
        <Text className="text-white font-bold text-lg">
          {isLoading ? 'Sending Code...' : 'Register'}
        </Text>
      </TouchableOpacity>


      <View className="flex-row justify-center">
        <Text className="text-gray-600">Already have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/Authentication/login')}>
          <Text className="text-fire font-medium">Sign In</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// Remove AuthGuard wrapper to prevent session interference during registration
const registration = () => {
  return <RegistrationComponent />;
};

export default registration;

export const options = {
  headerShown: false,
};