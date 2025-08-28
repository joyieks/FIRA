import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { WebBrowser, Crypto, googleSignInConfig } from '../config/googleSignIn';

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
  const serviceId = 'service_717ciwa';
  const templateId = 'template_iefgxnk';
  const publicKey = 'hDU2Ar_g1pr7Cpg-S';
  const privateKey = 'toeoBDUw3w6FPgdo7-Rjr';

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
      console.log('📤 Sending email via EmailJS REST API...');

      // Use EmailJS REST API
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

      console.log('📡 Response status:', response.status);

      const responseText = await response.text();
      console.log('📡 Raw response:', responseText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: Failed to send email`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = `HTTP ${response.status}: ${errorData.message || 'Failed to send email'}`;
        } catch (parseError) {
          errorMessage = `HTTP ${response.status}: ${responseText.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }

      // Store the code for verification
      setVerificationCode(code);
      console.log('💾 Verification code stored:', code);
      
      // Start resend countdown (60 seconds)
      setResendCountdown(60);
      
      return code;
    } catch (error) {
      console.error('❌ EmailJS REST API Error Details:', error);
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

  const handleGoogleSignIn = async () => {
    try {
      // Generate a random nonce for security
      const nonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(),
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      // Create Google OAuth URL
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${googleSignInConfig.clientId}&` +
        `redirect_uri=${encodeURIComponent(googleSignInConfig.redirectUri)}&` +
        `response_type=id_token&` +
        `scope=${encodeURIComponent(googleSignInConfig.scopes.join(' '))}&` +
        `nonce=${nonce}`;

      // Open browser for Google authentication
      const result = await WebBrowser.openAuthSessionAsync(authUrl, googleSignInConfig.redirectUri);

      if (result.type === 'success') {
        // Parse the URL to get the id_token
        const url = result.url;
        const urlParams = new URLSearchParams(url.split('#')[1]);
        const idToken = urlParams.get('id_token');
        
        if (idToken) {
          // Sign in to Supabase with Google ID token
          const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
          });

          if (authError) {
            console.error('❌ Supabase Google sign-in error:', authError);
            throw new Error(`Google sign-in failed: ${authError.message}`);
          }

          const user = authData.user;
          console.log('✅ Google sign-in successful:', user.id);

          // Check if user exists in citizen_users table
          const { data: citizenData, error: citizenError } = await supabase
            .from('citizen_users')
            .select('*')
            .eq('email', user.email)
            .single();

          if (citizenError && citizenError.code !== 'PGRST116') {
            console.error('❌ Error checking citizen_users:', citizenError);
            throw new Error('Error checking user data');
          }

          if (citizenData) {
            // User exists, redirect to login to use normal flow
            Alert.alert(
              'Welcome Back!',
              'You are already registered. Please use the regular login.',
              [{ 
                text: 'Go to Login', 
                onPress: () => router.replace('/Authentication/login') 
              }]
            );
          } else {
            // User doesn't exist, create new account and redirect to login
            const newUserData = {
              id: user.id,
              first_name: user.user_metadata?.full_name?.split(' ')[0] || 'Google',
              last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 'User',
              email: user.email,
              phone: user.phone || '',
              display_name: user.user_metadata?.full_name || 'Google User',
              status: 'active',
              reports: 0,
              is_verified: true,
              google_sign_in: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const { data: insertData, error: insertError } = await supabase
              .from('citizen_users')
              .insert([newUserData])
              .select()
              .single();

            if (insertError) {
              console.error('❌ Error creating user:', insertError);
              throw new Error('Failed to create user account');
            }

            Alert.alert(
              'Account Created Successfully!',
              `Welcome to Project FIRA, ${newUserData.first_name}! Please log in to continue.`,
              [{ 
                text: 'Login Now', 
                onPress: () => router.replace('/Authentication/login')
              }]
            );
          }
        } else {
          Alert.alert('Error', 'No ID token received from Google.');
        }
      } else if (result.type === 'cancel') {
        Alert.alert('Cancelled', 'You cancelled the Google Sign-In process.');
      } else {
        Alert.alert('Error', 'An error occurred during sign-in.');
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      Alert.alert('Error', error.message);
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

      <View className="flex-row items-center mb-6">
        <View className="flex-1 h-px bg-gray-300" />
        <Text className="mx-4 text-gray-500 text-sm">or</Text>
        <View className="flex-1 h-px bg-gray-300" />
      </View>

      <TouchableOpacity
        style={{
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: 'center',
          marginBottom: 16,
          flexDirection: 'row',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#e5e7eb',
          backgroundColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3.84,
          elevation: 5,
        }}
        onPress={handleGoogleSignIn}
      >
        <View style={{ width: 24, height: 24, marginRight: 12, justifyContent: 'center', alignItems: 'center' }}>
          <AntDesign name="google" size={20} color="#dc2626" />
        </View>
        <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 16, letterSpacing: 0.5 }}>
          Sign up with Google
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