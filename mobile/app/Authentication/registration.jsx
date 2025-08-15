import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { WebBrowser, Crypto, googleSignInConfig } from '../config/googleSignIn';

const registration = () => {
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
      };

      await setDoc(doc(db, 'citizenUsers', user.uid), userData);

      Alert.alert(
        'Registration Successful',
        'Your account has been created!',
        [{ text: 'OK', onPress: () => router.push('/Authentication/login') }]
      );
    } catch (error) {
      console.error('Firebase registration error:', error);
      Alert.alert('Registration Error', error.message);
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

          // Create user data for Firestore
          const userData = {
            uid: user.uid,
            firstName: user.displayName?.split(' ')[0] || 'Google',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || 'User',
            email: user.email,
            phoneNumber: user.phoneNumber || '',
            userType: 'citizen',
            createdAt: new Date().toISOString(),
            googleSignIn: true,
          };

          // Save to Firestore
          await setDoc(doc(db, 'citizenUsers', user.uid), userData);

          Alert.alert(
            'Registration Successful! 🎉',
            `Welcome, ${userData.firstName}! Your Google account has been registered.`,
            [{ text: 'Continue', onPress: () => router.replace('/Screens/CitizenScreen') }]
          );
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

      <TouchableOpacity className="py-4 rounded-xl items-center mb-4 bg-fire" onPress={handleRegister}>
        <Text className="text-white font-bold text-lg">Register</Text>
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

export default registration;

export const options = {
  headerShown: false,
};
