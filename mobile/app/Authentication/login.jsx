import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
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
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const router = useRouter();
  const { login: authLogin, loginAdmin, loginCitizen, loginStation, loginResponder, isLoading, resetLoading } = useAuth();

  // Clear toast on component mount/unmount and reset loading if stuck
  useEffect(() => {
    // If we're on the login screen and still loading, reset the loading state
    if (isLoading) {
      console.log('🔄 Login component: Resetting stuck loading state');
      const resetTimer = setTimeout(() => {
        resetLoading();
      }, 1000);
      
      return () => {
        clearTimeout(resetTimer);
        setShowToast(false);
        setToastMessage('');
      };
    }
    
    return () => {
      setShowToast(false);
      setToastMessage('');
    };
  }, [isLoading, resetLoading]);

  const validateEmail = (text) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);

  const displayToast = (message, type = 'success') => {
    // Clear any existing toast first
    setShowToast(false);
    setToastMessage('');
    
    // Small delay to ensure state is cleared before showing new toast
    setTimeout(() => {
      setToastMessage(message);
      setToastType(type);
      setShowToast(true);
      
      // Auto-hide the toast
      setTimeout(() => {
        setShowToast(false);
        setToastMessage('');
      }, 4000); // Show for 4 seconds
    }, 100);
  };

  const handleLogin = async () => {
    let isValid = true;

    // Clear any existing toast first
    setShowToast(false);
    setToastMessage('');

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
      // Check for hardcoded station credentials (stations don't use Supabase Auth)
      if (email === 'stations@gmail.com' && password === 'stations') {
        const result = await authLogin(email, password);
        displayToast('Welcome to Project FIRA! 🚒', 'success');
        return;
      }

      // Try Supabase Auth first for all users
      console.log('🔐 Attempting Supabase Auth...');
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password
      });

      if (authError) {
        console.log('❌ Supabase Auth failed:', authError.message);
        throw authError;
      }

      const user = authData.user;
      console.log('✅ Supabase Auth successful for user:', user.id);

      // Check if this authenticated user exists in our custom tables
      console.log('✅ Supabase Auth successful, checking user tables...');

      // Check if this user exists in 'station_users' table first (by user_id)
      const { data: stationData, error: stationError } = await supabase
        .from('station_users')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (stationData) {
        console.log('✅ Authenticated user found in station_users table:', stationData);

        const userData = {
          id: stationData.id, // Add id field
          uid: stationData.id,
          station_name: stationData.station_name,
          firstName: stationData.station_name,
          lastName: '',
          email: stationData.email,
          phoneNumber: stationData.phone,
          userType: 'station',
          displayName: stationData.station_name,
          status: stationData.status,
          address: stationData.address,
          position: stationData.position,
          isOnline: stationData.is_online,
          createdAt: stationData.created_at
        };

        setShowToast(false); setToastMessage('');
        await loginStation(userData);
        displayToast(`Welcome to Project FIRA, ${userData.displayName}! 🚒`, 'success');
        return;
      }

      // Check if this user exists in 'responders' table (by user_id)
      const { data: responderData, error: responderError } = await supabase
        .from('responders')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (responderData) {
        console.log('✅ Authenticated user found in responders table:', responderData);

        const userData = {
          id: responderData.id,
          uid: responderData.id,
          firstName: responderData.first_name,
          lastName: responderData.last_name,
          email: responderData.email,
          phoneNumber: responderData.phone,
          userType: 'responder',
          displayName: `${responderData.first_name} ${responderData.last_name}`.trim(),
          status: responderData.status || 'active',
          stationId: responderData.station_id,
          position: responderData.user_position,
          isOnline: responderData.is_online || false,
          createdAt: responderData.created_at,
        };

        setShowToast(false); setToastMessage('');
        await loginResponder(userData);
        displayToast(`Welcome to Project FIRA, ${userData.displayName}! 🚑`, 'success');
        return;
      }

      // Check if this user exists in 'admin_users' table
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', user.email)
        .single();

      if (adminData) {
        console.log('✅ User found in admin_users table:', adminData);
        
        // Convert Supabase data format to match your app's expected format
        const userData = {
          uid: adminData.id,
          firstName: adminData.first_name,
          lastName: adminData.last_name,
          email: adminData.email,
          userType: 'admin',
          displayName: `${adminData.first_name} ${adminData.last_name}`.trim(),
          role: adminData.role,
          status: adminData.status,
          createdAt: adminData.created_at,
          updatedAt: adminData.updated_at
        };

        // Clear any existing toast before login
        setShowToast(false);
        setToastMessage('');
        
        await loginAdmin(userData);
        
        // Show success toast after successful login
        displayToast(`Welcome to Project FIRA, ${userData.displayName}! 🔥`, 'success');
        return;
      }

      // Check if this user exists in 'citizen_users' table FIRST (to avoid misrouting to station)
      const { data: citizenData, error: citizenError } = await supabase
        .from('citizen_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (citizenData) {
        console.log('✅ User found in citizen_users table:', citizenData);
        
        // Check if citizen is disabled/banned
        if (citizenData.is_disabled === true) {
          console.log('🚫 Citizen account is disabled');
          // Store ban info for modal display
          setBanReason(citizenData.disable_reason || 'No reason provided');
          setShowBanModal(true);
          setIsLoading(false);
          return;
        }
        
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
          createdAt: citizenData.created_at
        };
        setShowToast(false); setToastMessage('');
        await loginCitizen(userData);
        displayToast(`Welcome to Project FIRA, ${userData.firstName || 'User'}! 👋`, 'success');
        return;
      }

      // If no records found in any table after successful auth
      {
        console.log('❌ Authenticated user not found in any authorized table');
        displayToast('User not found in authorized tables. Please contact administrator.', 'error');
      }
    } catch (error) {
      // Only log to console in development, don't use console.error to avoid error overlay
      if (__DEV__) {
        console.log('🔍 Login attempt failed:', error.message);
      }
      
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


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-8 justify-center">
        <TouchableOpacity 
          style={{ 
            position: 'absolute', 
            top: 50, 
            left: 20, 
            zIndex: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: 20,
            padding: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3
          }} 
          onPress={() => router.replace('/get-started/getstarted')}
        >
          <MaterialIcons name="arrow-back" size={24} color="#dc2626" />
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
          
          {/* Forgot Password Link - positioned below password field, right-aligned */}
          <TouchableOpacity 
            className="self-end mt-2"
            onPress={() => router.push('/Authentication/ForgotPassword/forgotpassword')}
          >
            <Text className="text-fire font-medium text-sm">Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity className="bg-fire py-4 rounded-xl items-center mb-4" onPress={handleLogin}>
          <Text className="text-white font-bold text-lg">Login</Text>
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-gray-600">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/Authentication/registration')}>
            <Text className="text-fire font-medium">Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast Notification */}
      {showToast && toastMessage ? (
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
      ) : null}

      {/* Ban/Disabled Modal */}
      {showBanModal && (
        <View 
          className="absolute inset-0 z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View 
            className="bg-white mx-6 max-w-md w-full"
            style={{
              borderRadius: 28,
              padding: 32,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.3,
              shadowRadius: 30,
              elevation: 20,
            }}
          >
            {/* Animated Icon Container */}
            <View className="items-center mb-6">
              <View 
                className="rounded-full items-center justify-center mb-5"
                style={{
                  width: 100,
                  height: 100,
                  backgroundColor: '#fee2e2',
                  borderWidth: 4,
                  borderColor: '#fecaca',
                  shadowColor: '#dc2626',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 12,
                }}
              >
                <MaterialIcons name="block" size={56} color="#dc2626" />
              </View>
              
              {/* Title with gradient effect */}
              <Text 
                className="text-center mb-2"
                style={{
                  fontSize: 28,
                  fontWeight: 'bold',
                  color: '#1f2937',
                  letterSpacing: 0.5,
                }}
              >
                Account Disabled
              </Text>
              
              {/* Subtitle with Command Center branding */}
              <View className="items-center">
                <Text 
                  className="text-center"
                  style={{
                    fontSize: 16,
                    color: '#6b7280',
                    marginBottom: 4,
                  }}
                >
                  You have been banned by the
                </Text>
                <Text 
                  className="text-center"
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: '#dc2626',
                    letterSpacing: 0.3,
                  }}
                >
                  Command Center Admin
                </Text>
              </View>
            </View>

            {/* Ban Reason - Enhanced styling */}
            {banReason && (
              <View 
                className="mb-6"
                style={{
                  backgroundColor: '#fef2f2',
                  borderLeftWidth: 5,
                  borderLeftColor: '#dc2626',
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: '#fecaca',
                  shadowColor: '#dc2626',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center mb-3">
                  <MaterialIcons name="info" size={20} color="#dc2626" />
                  <Text 
                    className="ml-2"
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: '#991b1b',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Reason for Ban
                  </Text>
                </View>
                <Text 
                  style={{
                    fontSize: 16,
                    color: '#1f2937',
                    lineHeight: 24,
                    fontWeight: '500',
                  }}
                >
                  {banReason}
                </Text>
              </View>
            )}

            {/* Message - Enhanced styling */}
            <View 
              className="mb-6"
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: 16,
                padding: 18,
                borderWidth: 1,
                borderColor: '#e5e7eb',
              }}
            >
              <View className="flex-row items-start mb-2">
                <MaterialIcons name="warning" size={20} color="#f59e0b" style={{ marginTop: 2 }} />
                <Text 
                  className="ml-2 flex-1"
                  style={{
                    fontSize: 14,
                    color: '#374151',
                    lineHeight: 20,
                    fontWeight: '500',
                  }}
                >
                  Your account has been disabled and you cannot access the application. If you believe this is an error, please contact the Command Center Administrator.
                </Text>
              </View>
            </View>

            {/* Continue Button - Enhanced with gradient effect */}
            <TouchableOpacity
              className="rounded-xl py-4 items-center"
              onPress={() => {
                setShowBanModal(false);
                setBanReason('');
                setEmail('');
                setPassword('');
              }}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#dc2626',
                shadowColor: '#dc2626',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 12,
                borderWidth: 1,
                borderColor: '#b91c1c',
              }}
            >
              <Text 
                style={{
                  color: '#ffffff',
                  fontSize: 18,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                }}
              >
                Continue
              </Text>
            </TouchableOpacity>
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