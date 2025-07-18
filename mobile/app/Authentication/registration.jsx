import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';

const registration = () => {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Registration, 2: Verification
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    barangay: '',
    birthdate: '',
    age: '',
    gender: '',
    contactNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
    verificationCode: ''
  });
  const [errors, setErrors] = useState({});

  const validateStep1 = () => {
    const newErrors = {};
    
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    
    if (!formData.email) {
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
    
    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the terms';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    if (!formData.verificationCode || formData.verificationCode.length !== 6) {
      setErrors({...errors, verificationCode: 'Please enter a 6-digit code'});
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      // In a real app, you would send verification code to email here
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      // Verify code and complete registration
      handleCompleteRegistration();
    }
  };

  const handleCompleteRegistration = () => {
    // In a real app, you would verify the code with your backend
    Alert.alert(
      'Email Verified',
      'Your email has been successfully verified!',
      [
        { text: 'OK', onPress: () => router.push('/Authentication/login') }
      ]
    );
  };

  const handleChange = (name, value) => {
    let updatedForm = { ...formData, [name]: value };
    if (name === 'birthdate') {
      // Expecting YYYY-MM-DD
      const birth = new Date(value);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        updatedForm.age = age.toString();
      } else {
        updatedForm.age = '';
      }
    }
    setFormData(updatedForm);
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
          {step === 1 ? 'Create Account' : 'Verify Email'}
        </Text>
      </View>

      {step === 1 ? (
        <>
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
            <Text className="text-gray-700 mb-1">Barangay</Text>
            <TextInput
              className={`border ${errors.barangay ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
              placeholder="Enter your Barangay"
              value={formData.barangay}
              onChangeText={(text) => handleChange('barangay', text)}
            />
            {errors.barangay && <Text className="text-fire text-sm mt-1">{errors.barangay}</Text>}
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Birthdate</Text>
            <TextInput
              className={`border ${errors.birthdate ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
              placeholder="YYYY-MM-DD"
              value={formData.birthdate}
              onChangeText={(text) => handleChange('birthdate', text)}
              keyboardType="numeric"
            />
            {errors.birthdate && <Text className="text-fire text-sm mt-1">{errors.birthdate}</Text>}
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Age</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 bg-gray-100 text-gray-700"
              value={formData.age}
              editable={false}
              placeholder="Auto-calculated"
            />
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Gender</Text>
            <TextInput
              className={`border ${errors.gender ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
              placeholder="Enter your Gender"
              value={formData.gender}
              onChangeText={(text) => handleChange('gender', text)}
            />
            {errors.gender && <Text className="text-fire text-sm mt-1">{errors.gender}</Text>}
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Contact Number</Text>
            <TextInput
              className={`border ${errors.contactNumber ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
              placeholder="09XXXXXXXXX"
              value={formData.contactNumber}
              onChangeText={(text) => handleChange('contactNumber', text)}
              keyboardType="phone-pad"
            />
            {errors.contactNumber && <Text className="text-fire text-sm mt-1">{errors.contactNumber}</Text>}
          </View>

          <View className="mb-4">
            <Text className="text-gray-700 mb-1">Email</Text>
            <TextInput
              className={`border ${errors.email ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(text) => handleChange('email', text)}
            />
            {errors.email && <Text className="text-fire text-sm mt-1">{errors.email}</Text>}
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
        </>
      ) : (
        <>
          {/* Verification Step */}
          <View className="mb-6">
            <Text className="text-gray-600 text-center mb-4">
              We've sent a 6-digit verification code to{' '}
              <Text className="font-semibold">{formData.email}</Text>
            </Text>
            
            <Text className="text-gray-700 mb-2">Verification Code</Text>
            <TextInput
              className={`border ${errors.verificationCode ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
              placeholder="Enter 6-digit code"
              keyboardType="number-pad"
              maxLength={6}
              value={formData.verificationCode}
              onChangeText={(text) => handleChange('verificationCode', text)}
            />
            {errors.verificationCode && <Text className="text-fire text-sm mt-1">{errors.verificationCode}</Text>}
          </View>

          <TouchableOpacity className="mb-4">
            <Text className="text-fire text-center">
              Didn't receive code? <Text className="font-semibold">Resend</Text>
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Next/Verify Button */}
      <TouchableOpacity
        className={`py-4 rounded-xl items-center mb-4 ${step === 1 ? 'bg-fire' : 'bg-green-600'}`}
        onPress={handleNext}
      >
        <Text className="text-white font-bold text-lg">
          {step === 1 ? 'Continue' : 'Verify Email'}
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