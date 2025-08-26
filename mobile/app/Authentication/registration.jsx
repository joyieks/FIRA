import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { WebBrowser, Crypto, googleSignInConfig } from '../config/googleSignIn';
import AuthGuard from '../components/AuthGuard';

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
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [userInputCode, setUserInputCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // EmailJS configuration
  const serviceId = 'service_717ciwa';
  const templateId = 'template_iefgxnk';
  const publicKey = 'hDU2Ar_g1pr7Cpg-S';
  const privateKey = 'toeoBDUw3w6FPgdo7-Rjr';  // Add private key for strict mode

  useEffect(() => {
    // Log EmailJS configuration
    console.log('🔧 EmailJS Configuration Loaded');
    console.log('🔑 Service ID:', serviceId);
    console.log('📝 Template ID:', templateId);
    console.log('🔐 Public Key:', publicKey);
  }, []);

  // Simple test function to check EmailJS connection
  const testBasicEmailJS = async () => {
    try {
      console.log('🧪 Testing basic EmailJS connection...');
      
      const testParams = {
        to_name: 'Test User',
        passcode: '123456',
        time: '12:00 PM',
        user_email: 'test@example.com'  // This matches the template
      };

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,  // Changed from 'private_key' to 'accessToken'
          template_params: testParams,
        }),
      });

      const responseText = await response.text();
      console.log('🧪 Test response status:', response.status);
      console.log('🧪 Test response text:', responseText);

      if (response.ok) {
        Alert.alert('Test Success', 'EmailJS connection is working!');
      } else {
        Alert.alert('Test Failed', `Status: ${response.status}\nResponse: ${responseText.substring(0, 100)}`);
      }
    } catch (error) {
      Alert.alert('Test Error', error.message);
    }
  };

  const sendVerificationCode = async (email, firstName) => {
    try {
      console.log('🚀 Starting verification code send...');
      console.log('📧 Email:', email);
      console.log('👤 First Name:', firstName);
      console.log('🔑 Service ID:', serviceId);
      console.log('📝 Template ID:', templateId);
      console.log('🔐 Public Key:', publicKey);
      
      // Generate 6-digit verification code
      const code = Math.random().toString().slice(2, 8);
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString();

      const templateParams = {
        to_name: firstName,
        passcode: code,
        time: expirationTime,
        user_email: email        // This is what the template expects for "To Email"
      };

      console.log('📋 Template Params:', templateParams);
      console.log('📤 Sending email via EmailJS REST API...');

      // Use EmailJS REST API instead of browser library
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,  // Changed from 'private_key' to 'accessToken'
          template_params: templateParams,
        }),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);

      // Get response text first to see what we're actually receiving
      const responseText = await response.text();
      console.log('📡 Raw response:', responseText);

      if (!response.ok) {
        // Try to parse as JSON, but handle non-JSON responses gracefully
        let errorMessage = `HTTP ${response.status}: Failed to send email`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = `HTTP ${response.status}: ${errorData.message || 'Failed to send email'}`;
        } catch (parseError) {
          // If response is not JSON, use the raw text
          errorMessage = `HTTP ${response.status}: ${responseText.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }

      // Try to parse response as JSON
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('✅ EmailJS REST API result:', result);
      } catch (parseError) {
        console.log('⚠️ Response is not JSON, but email might have been sent');
        result = { status: 'success', message: 'Email sent (non-JSON response)' };
      }
      
      // Store the code for verification
      setVerificationCode(code);
      console.log('💾 Verification code stored:', code);
      
      return code;
    } catch (error) {
      console.error('❌ EmailJS REST API Error Details:', error);
      console.error('❌ Error Message:', error.message);
      throw new Error(`Failed to send verification code: ${error.message}`);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone number is required';
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the terms';
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
      
      // Check if this is a Google user or regular registration
      const isGoogleUser = formData.password === ''; // Google users don't have password
      
      if (isGoogleUser) {
        // For Google users, account is already created, just update verification status
        const userData = {
          uid: auth.currentUser?.uid,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          userType: 'citizen',
          createdAt: new Date().toISOString(),
          isVerified: true,
          googleSignIn: true,
        };

        await setDoc(doc(db, 'citizenUsers', userData.uid), userData);

        Alert.alert(
          'Account Verified Successfully! 🎉',
          `Welcome, ${userData.firstName}! Your Google account has been verified.`,
          [{ 
            text: 'Continue', 
            onPress: () => router.replace('/Screens/CitizenScreen') 
          }]
        );
      } else {
        // For regular users, create the account after verification
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        const userData = {
          uid: user.uid,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          userType: 'citizen',
          createdAt: new Date().toISOString(),
          isVerified: true,
        };

        await setDoc(doc(db, 'citizenUsers', user.uid), userData);

        Alert.alert(
          'Account Created Successfully! 🎉',
          'Your account has been verified and created. You can now login.',
          [{ 
            text: 'Login Now', 
            onPress: () => router.push('/Authentication/login') 
          }]
        );
      }
      
    } catch (error) {
      console.error('Account creation error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
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
          // Create Firebase credential from Google ID token
          const credential = GoogleAuthProvider.credential(idToken);
          
          // Sign in to Firebase with Google credential
          const userCredential = await signInWithCredential(auth, credential);
          const user = userCredential.user;

          // Store Google user data temporarily for verification
          const tempUserData = {
            uid: user.uid,
            firstName: user.displayName?.split(' ')[0] || 'Google',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || 'User',
            email: user.email,
            phoneNumber: user.phoneNumber || '',
            userType: 'citizen',
            createdAt: new Date().toISOString(),
            googleSignIn: true,
          };

          // Send verification code
          try {
            await sendVerificationCode(user.email, tempUserData.firstName);
            
            // Store temporary data and show verification UI
            setFormData({
              ...formData,
              firstName: tempUserData.firstName,
              lastName: tempUserData.lastName,
              email: tempUserData.email,
              phoneNumber: tempUserData.phoneNumber,
              password: '', // Google users don't need password
              confirmPassword: '',
              agreeTerms: true,
            });
            
            // Show verification UI
            setShowVerification(true);
            
          } catch (emailError) {
            // If email fails, still allow registration but show warning
            Alert.alert(
              'Google Sign-In Successful! ⚠️',
              'Account verified with Google but verification email failed. You can verify later.',
              [{ text: 'Continue', onPress: () => router.replace('/Screens/CitizenScreen') }]
            );
          }
        } else {
          Alert.alert('Google Sign-In Failed', 'No ID token received from Google.');
        }
      } else if (result.type === 'cancel') {
        Alert.alert('Sign In Cancelled', 'You cancelled the Google Sign-In process.');
      } else {
        Alert.alert('Google Sign-In Failed', 'An error occurred during sign-in.');
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      Alert.alert('Google Sign-In Failed', error.message);
    }
  };

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
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
            disabled={isLoading}
          >
            <Text className="text-red-600 font-medium">
              {isLoading ? 'Sending...' : 'Resend Code'}
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

      <TouchableOpacity 
        className={`py-4 rounded-xl items-center mb-4 ${isLoading ? 'bg-gray-400' : 'bg-fire'}`} 
        onPress={handleRegister}
        disabled={isLoading}
      >
        <Text className="text-white font-bold text-lg">
          {isLoading ? 'Sending Code...' : 'Register'}
        </Text>
      </TouchableOpacity>

      {/* Test EmailJS Connection Button */}
      <TouchableOpacity 
        className="py-2 rounded-lg items-center mb-4 bg-blue-500" 
        onPress={testBasicEmailJS}
      >
        <Text className="text-white font-medium">🧪 Test EmailJS Connection</Text>
      </TouchableOpacity>

      <View className="flex-row items-center mb-4">
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
          Register with Google
        </Text>
      </TouchableOpacity>

      <View className="flex-row justify-center py-4">
        <Text className="text-gray-600">Already have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/Authentication/login')}>
          <Text className="text-fire font-medium">Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const registration = () => {
  return (
    <AuthGuard>
      <RegistrationComponent />
    </AuthGuard>
  );
};

export default registration;

export const options = {
  headerShown: false,
};