import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';

const login = () => {
  // Prefill with test credentials
  const [email, setEmail] = useState('citizen@gmail.com');
  const [password, setPassword] = useState('citizen');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const router = useRouter();

  const validateEmail = (text) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(text);
  };

  const handleLogin = () => {
    let isValid = true;

    // Validate email
    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email');
      isValid = false;
    } else {
      setEmailError('');
    }

    // Validate password
    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      isValid = false;
    } else {
      setPasswordError('');
    }

    if (isValid) {
      // Check for test credentials
      if (email === 'citizen@gmail.com' && password === 'citizen') {
        router.replace('/Screens/CitizenScreen');
      } else if (email === 'responders@gmail.com' && password === 'responders') {
        // Use the correct route for responders screen
        router.replace('/Screens/RespondersScreen');
      } else if (email === 'admin@gmail.com' && password === 'admin') {
        // Use the correct route for admin screen
        router.replace('/Screens/AdminScreen');
      } else if (email === 'station@gmail.com' && password === 'station') {
        // Use the correct route for station screen
        router.replace('/Screens/StationScreen');
      } else {
        setPasswordError('Invalid credentials.\nCitizen: citizen@gmail.com / citizen\nResponder: responders@gmail.com / responders\nAdmin: admin@gmail.com / admin\nStation: station@gmail.com / station');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      {/* <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled"> */}
        <View className="flex-1 px-8 justify-center">
          {/* Back Button */}
          <TouchableOpacity style={{ position: 'absolute', top: 40, left: 20, zIndex: 10 }} onPress={() => router.back()}>
            <AntDesign name="arrowleft" size={32} color="#dc2626" />
          </TouchableOpacity>
          {/* Logo */}
          <View className="items-center mb-12">
            <Image
              source={require('../../assets/images/firemen.png')}
              className="w-24 h-24 mb-4"
            />
            <Text className="text-3xl font-bold text-fire">Project FIRA</Text>
          </View>

          {/* Login Form */}
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

          {/* Login Button */}
          <TouchableOpacity
            className="bg-fire py-4 rounded-xl items-center mb-4"
            onPress={handleLogin}
          >
            <Text className="text-white font-bold text-lg">Login</Text>
          </TouchableOpacity>

          {/* Forgot Password */}
          <TouchableOpacity className="items-center mb-6">
            <Text className="text-fire font-medium">Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View className="flex-row justify-center">
            <Text className="text-gray-600">Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/Authentication/registration')}>
              <Text className="text-fire font-medium">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      {/* </ScrollView> */}
    </KeyboardAvoidingView>
  );
};

export default login;

export const options = {
  headerShown: false,
};