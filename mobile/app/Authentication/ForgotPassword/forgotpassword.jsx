import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  
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

  const handleSendResetEmail = async () => {
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setEmailError('');

    try {
      // Use Firebase's built-in password reset email
      await sendPasswordResetEmail(auth, email);
      
      displayToast('Password reset email sent! Check your inbox.', 'success');
      
      // Show success message and redirect back to login
      setTimeout(() => {
        router.replace('/Authentication/login');
      }, 3000);
      
    } catch (error) {
      console.error('Error sending password reset email:', error);
      
      // Handle specific Firebase Auth errors
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many requests. Please try again later.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      
      displayToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 px-8 justify-center">
        <TouchableOpacity 
          style={{ position: 'absolute', top: 40, left: 20, zIndex: 10 }} 
          onPress={() => router.back()}
        >
          <AntDesign name="arrowleft" size={32} color="#dc2626" />
        </TouchableOpacity>

        <View className="items-center mb-12">
          <MaterialIcons name="lock-reset" size={80} color="#dc2626" />
          <Text className="text-3xl font-bold text-fire mt-4">Forgot Password</Text>
          <Text className="text-gray-600 text-center mt-2">
            Enter your email address and we'll send you a password reset link.
          </Text>
        </View>

        <View className="mb-8">
          <Text className="text-lg font-medium text-gray-700 mb-2">Email Address</Text>
          <TextInput
            className={`border ${emailError ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3 mb-1`}
            placeholder="Enter your email address"
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

        <TouchableOpacity 
          className={`py-4 rounded-xl items-center mb-4 ${isLoading ? 'bg-gray-400' : 'bg-fire'}`}
          onPress={handleSendResetEmail}
          disabled={isLoading}
        >
          <Text className="text-white font-bold text-lg">
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </Text>
        </TouchableOpacity>

        <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <View className="flex-row items-start">
            <MaterialIcons name="info" size={20} color="#3B82F6" style={{ marginTop: 2, marginRight: 8 }} />
            <View className="flex-1">
              <Text className="text-blue-800 font-medium mb-1">How it works:</Text>
              <Text className="text-blue-700 text-sm leading-5">
                1. Enter your email address above{'\n'}
                2. Check your email for a reset link{'\n'}
                3. Click the link to set a new password{'\n'}
                4. Return to the app and login
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          className="items-center"
          onPress={() => router.replace('/Authentication/login')}
        >
          <Text className="text-fire font-medium">Back to Login</Text>
        </TouchableOpacity>
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

export default ForgotPasswordScreen;

export const options = {
  headerShown: false,
};
