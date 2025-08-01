import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { signInWithEmailAndPassword, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { WebBrowser, Crypto, googleSignInConfig } from '../config/googleSignIn';

const login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const router = useRouter();

  const validateEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

  const handleLogin = async () => {
    let isValid = true;

    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email');
      isValid = false;
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      isValid = false;
    } else {
      setPasswordError('');
    }

    if (!isValid) return;

    try {
      // Sign in via Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if this user exists in 'mobileUsers' Firestore
      const q = query(collection(db, 'mobileUsers'), where('email', '==', email));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        Alert.alert('Login Successful', `Welcome, ${userData.firstName || 'User'}!`);
        router.replace('/Screens/CitizenScreen');
      } else {
        Alert.alert('Login Error', 'No user record found in mobileUsers collection.');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Failed', error.message);
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

          // Check if user exists in Firestore
          const q = query(collection(db, 'mobileUsers'), where('email', '==', user.email));
          const snapshot = await getDocs(q);

          if (snapshot.empty) {
            // User doesn't exist, create new account
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

            await setDoc(doc(db, 'mobileUsers', user.uid), userData);
            Alert.alert('Registration Successful! 🎉', `Welcome, ${userData.firstName}! Your Google account has been registered.`);
          } else {
            // User exists, just sign in
            const userData = snapshot.docs[0].data();
            Alert.alert('Login Successful! 🎉', `Welcome back, ${userData.firstName || 'User'}!`);
          }

          router.replace('/Screens/CitizenScreen');
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-8 justify-center">
        <TouchableOpacity style={{ position: 'absolute', top: 40, left: 20, zIndex: 10 }} onPress={() => router.back()}>
          <AntDesign name="arrowleft" size={32} color="#dc2626" />
        </TouchableOpacity>

        <View className="items-center mb-12">
          <Image source={require('../../assets/images/firemen.png')} className="w-24 h-24 mb-4" />
          <Text className="text-3xl font-bold text-fire">Project FIRA</Text>
        </View>

        <View className="mb-6">
          <Text className="text-lg font-medium text-gray-700 mb-2">Email</Text>
          <TextInput
            className={`border ${emailError ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3 mb-1`}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError('');
            }}
          />
          {emailError ? <Text className="text-fire text-sm">{emailError}</Text> : null}
        </View>

        <View className="mb-8">
          <Text className="text-lg font-medium text-gray-700 mb-2">Password</Text>
          <View className="relative">
            <TextInput
              className={`border ${passwordError ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3 mb-1`}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError('');
              }}
            />
            <TouchableOpacity
              className="absolute right-3 top-3"
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text className="text-fire font-medium">
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>
          {passwordError ? <Text className="text-fire text-sm">{passwordError}</Text> : null}
        </View>

        <TouchableOpacity className="bg-fire py-4 rounded-xl items-center mb-4" onPress={handleLogin}>
          <Text className="text-white font-bold text-lg">Login</Text>
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
            Sign in with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity className="items-center mb-6">
          <Text className="text-fire font-medium">Forgot Password?</Text>
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-gray-600">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/Authentication/registration')}>
            <Text className="text-fire font-medium">Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default login;

export const options = {
  headerShown: false,
};
