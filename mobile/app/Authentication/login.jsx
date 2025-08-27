import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { WebBrowser, Crypto, googleSignInConfig } from '../config/googleSignIn';
import { useAuth } from '../config/AuthContext';
import AuthGuard from '../components/AuthGuard';

const LoginComponent = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // 'success' or 'error'
  const router = useRouter();
  const { login: authLogin, loginCitizen } = useAuth();

  const validateEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

  const displayToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 4000); // Show for 4 seconds for welcome messages
  };

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
      // First check if it's a hardcoded user (admin, station, responder)
      if (email === 'admin@gmail.com' && password === 'admin') {
        const result = await authLogin(email, password);
        displayToast('Welcome to Project FIRA! 🔥', 'success');
        return;
      }
      
      if (email === 'stations@gmail.com' && password === 'stations') {
        const result = await authLogin(email, password);
        displayToast('Welcome to Project FIRA! 🚒', 'success');
        return;
      }
      
      if (email === 'responder@gmail.com' && password === 'responder') {
        const result = await authLogin(email, password);
        displayToast('Welcome to Project FIRA! 🚑', 'success');
        return;
      }

      // For all other emails, try Supabase Auth (citizens)
      console.log('🔍 Trying Supabase Auth for citizen login:', email);
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password
      });

      if (authError) {
        console.error('❌ Supabase Auth error:', authError);
        throw authError;
      }

      const user = authData.user;
      console.log('✅ Supabase Auth successful, checking citizen_users table...');

      // Check if this user exists in 'citizen_users' table
      const { data: citizenData, error: citizenError } = await supabase
        .from('citizen_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (citizenError && citizenError.code !== 'PGRST116') {
        console.error('❌ Error checking citizen_users:', citizenError);
        throw new Error('Error checking user data');
      }

      if (citizenData) {
        console.log('✅ User found in citizen_users table:', citizenData);
        
        // Convert Supabase data format to match your app's expected format
        const userData = {
          uid: citizenData.id,
          firstName: citizenData.first_name,
          lastName: citizenData.last_name,
          email: citizenData.email,
          phoneNumber: citizenData.phone || citizenData.phone_number,
          userType: 'citizen',
          displayName: citizenData.display_name,
          status: citizenData.status,
          reports: citizenData.reports,
          isVerified: citizenData.is_verified,
          googleSignIn: citizenData.google_sign_in,
          createdAt: citizenData.created_at
        };

        displayToast(`Welcome to Project FIRA, ${userData.firstName || 'User'}! 👋`, 'success');
        
        // Store citizen authentication
        await loginCitizen(userData);
        
        // Let AuthGuard handle the navigation - no manual navigation needed
        // This prevents the glitching/refreshing effect
      } else {
        console.log('❌ User not found in citizen_users table');
        displayToast('No user record found. Please register first.', 'error');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      
      // Handle specific Supabase Auth errors
      let errorMessage = 'Login failed. Please check your credentials.';
      
      switch (error.message) {
        case 'Invalid login credentials':
          errorMessage = 'Invalid email or password. Please try again.';
          break;
        case 'Email not confirmed':
          errorMessage = 'Please confirm your email address before logging in.';
          break;
        case 'Too many requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      
      displayToast(errorMessage, 'error');
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
            // User exists, just sign in
            const userData = {
              uid: citizenData.id,
              firstName: citizenData.first_name,
              lastName: citizenData.last_name,
              email: citizenData.email,
              phoneNumber: citizenData.phone || citizenData.phone_number,
              userType: 'citizen',
              displayName: citizenData.display_name,
              status: citizenData.status,
              reports: citizenData.reports,
              isVerified: citizenData.is_verified,
              googleSignIn: citizenData.google_sign_in,
              createdAt: citizenData.created_at
            };

            displayToast(`Welcome back to Project FIRA, ${userData.firstName || 'User'}! 👋`, 'success');
            await loginCitizen(userData);
          } else {
            // User doesn't exist, create new account
            const newUserData = {
              id: user.id,
              first_name: user.user_metadata?.full_name?.split(' ')[0] || 'Google',
              last_name: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || 'User',
              email: user.email,
              phone: user.phone || '',
              phone_number: user.phone || '',
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

            const userData = {
              uid: insertData.id,
              firstName: insertData.first_name,
              lastName: insertData.last_name,
              email: insertData.email,
              phoneNumber: insertData.phone || insertData.phone_number,
              userType: 'citizen',
              displayName: insertData.display_name,
              status: insertData.status,
              reports: insertData.reports,
              isVerified: insertData.is_verified,
              googleSignIn: insertData.google_sign_in,
              createdAt: insertData.created_at
            };

            displayToast(`Welcome to Project FIRA, ${userData.firstName}! Your Google account has been registered. 🎉`, 'success');
            await loginCitizen(userData);
          }
        } else {
          displayToast('No ID token received from Google.', 'error');
        }
      } else if (result.type === 'cancel') {
        displayToast('You cancelled the Google Sign-In process.', 'error');
      } else {
        displayToast('An error occurred during sign-in.', 'error');
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      displayToast(error.message, 'error');
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
          <Image 
            source={require('../../assets/images/firemen.png')} 
            className="w-32 h-32 mb-4"
            resizeMode="contain"
            style={{ width: 128, height: 128 }}
          />
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

        <TouchableOpacity 
          className="items-center mb-6"
          onPress={() => router.push('/Authentication/ForgotPassword/forgotpassword')}
        >
          <Text className="text-fire font-medium">Forgot Password?</Text>
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-gray-600">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/Authentication/registration')}>
            <Text className="text-fire font-medium">Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast Notification */}
      {showToast && (
        <View className="absolute top-20 left-4 right-4 z-50">
          <View className={`rounded-xl p-4 flex-row items-center shadow-xl ${
            toastType === 'success' ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-red-500'
          }`}>
            <MaterialIcons 
              name={toastType === 'success' ? 'celebration' : 'error'} 
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

const login = () => {
  return (
    <AuthGuard>
      <LoginComponent />
    </AuthGuard>
  );
};

export default login;

export const options = {
  headerShown: false,
};
