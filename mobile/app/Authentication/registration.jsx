import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';

const registration = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
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
    if (!formData.username) newErrors.username = 'Username is required';
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

  const handleRegister = () => {
    if (validate()) {
      Alert.alert(
        'Registration Successful',
        'Your account has been created!',
        [
          { text: 'OK', onPress: () => router.push('/Authentication/login') }
        ]
      );
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
      {/* Back Button */}
      <TouchableOpacity style={{ position: 'absolute', top: 40, left: 0, zIndex: 10 }} onPress={() => router.back()}>
        <AntDesign name="arrowleft" size={32} color="#dc2626" />
      </TouchableOpacity>
      {/* Header */}
      <View className="items-center py-8 mt-8">
        <Image 
          source={require('../../assets/images/getstart2.png')}
          className="w-20 h-20 mb-4"
        />
        <Text className="text-2xl font-bold text-fire">
          Create Account
        </Text>
      </View>

      {/* Registration Form */}
      <View className="mb-4">
        <Text className="text-gray-700 mb-1">First Name</Text>
        <TextInput
          className={`border ${errors.firstName ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
          placeholder="John"
          value={formData.firstName}
          onChangeText={(text) => handleChange('firstName', text)}
        />
        {errors.firstName && <Text className="text-fire text-sm mt-1">{errors.firstName}</Text>}
      </View>

      <View className="mb-4">
        <Text className="text-gray-700 mb-1">Last Name</Text>
        <TextInput
          className={`border ${errors.lastName ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
          placeholder="Doe"
          value={formData.lastName}
          onChangeText={(text) => handleChange('lastName', text)}
        />
        {errors.lastName && <Text className="text-fire text-sm mt-1">{errors.lastName}</Text>}
      </View>

      <View className="mb-4">
        <Text className="text-gray-700 mb-1">Username</Text>
        <TextInput
          className={`border ${errors.username ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
          placeholder="Enter your username"
          value={formData.username}
          onChangeText={(text) => handleChange('username', text)}
        />
        {errors.username && <Text className="text-fire text-sm mt-1">{errors.username}</Text>}
      </View>

      <View className="mb-4">
        <Text className="text-gray-700 mb-1">Phone Number</Text>
        <TextInput
          className={`border ${errors.phoneNumber ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
          placeholder="09XXXXXXXXX"
          value={formData.phoneNumber}
          onChangeText={(text) => handleChange('phoneNumber', text)}
          keyboardType="phone-pad"
        />
        {errors.phoneNumber && <Text className="text-fire text-sm mt-1">{errors.phoneNumber}</Text>}
      </View>

      <View className="mb-4">
        <Text className="text-gray-700 mb-1">Password</Text>
        <TextInput
          className={`border ${errors.password ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
          placeholder="At least 6 characters"
          secureTextEntry
          value={formData.password}
          onChangeText={(text) => handleChange('password', text)}
        />
        {errors.password && <Text className="text-fire text-sm mt-1">{errors.password}</Text>}
      </View>

      <View className="mb-6">
        <Text className="text-gray-700 mb-1">Confirm Password</Text>
        <TextInput
          className={`border ${errors.confirmPassword ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
          placeholder="Confirm your password"
          secureTextEntry
          value={formData.confirmPassword}
          onChangeText={(text) => handleChange('confirmPassword', text)}
        />
        {errors.confirmPassword && <Text className="text-fire text-sm mt-1">{errors.confirmPassword}</Text>}
      </View>

      <View className="mb-8 flex-row items-start">
        <TouchableOpacity
          className={`w-5 h-5 border ${errors.agreeTerms ? 'border-fire' : 'border-gray-400'} rounded mr-2 mt-1 items-center justify-center`}
          onPress={() => handleChange('agreeTerms', !formData.agreeTerms)}
        >
          {formData.agreeTerms && <View className="w-3 h-3 bg-fire rounded" />}
        </TouchableOpacity>
        <Text className="flex-1 text-gray-600">
          By signing up, you agree to our{' '}
          <Text className="text-fire" onPress={() => router.push('/Policy/TermsAndConditions')}>Terms and Conditions</Text> and{' '}
          <Text className="text-fire" onPress={() => router.push('/Policy/PrivacyAndPolicy')}>Privacy Policy</Text>
        </Text>
      </View>

      {/* Register Button */}
      <TouchableOpacity
        className="py-4 rounded-xl items-center mb-4 bg-fire"
        onPress={handleRegister}
      >
        <Text className="text-white font-bold text-lg">
          Register
        </Text>
      </TouchableOpacity>

      {/* Back to Login */}
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