import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase'; // Adjust if needed

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

  const handleRegister = async () => {
    if (!validate()) return;

    try {
      const fakeEmail = `${formData.username}@firaregistration.com`;
      await createUserWithEmailAndPassword(auth, fakeEmail, formData.password);

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

      {/* Form Fields */}
      {['firstName', 'lastName', 'username', 'phoneNumber', 'password', 'confirmPassword'].map((field, idx) => (
        <View className="mb-4" key={idx}>
          <Text className="text-gray-700 mb-1">{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Text>
          <TextInput
            className={`border ${errors[field] ? 'border-fire' : 'border-gray-300'} rounded-lg px-4 py-3`}
            placeholder={
              field === 'phoneNumber'
                ? '09XXXXXXXXX'
                : field === 'password' || field === 'confirmPassword'
                ? 'At least 6 characters'
                : ''
            }
            value={formData[field]}
            onChangeText={(text) => handleChange(field, text)}
            secureTextEntry={field === 'password' || field === 'confirmPassword'}
            keyboardType={field === 'phoneNumber' ? 'phone-pad' : 'default'}
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
          <Text className="text-fire" onPress={() => router.push('/Policy/TermsAndConditions')}>Terms and Conditions</Text> and{' '}
          <Text className="text-fire" onPress={() => router.push('/Policy/PrivacyAndPolicy')}>Privacy Policy</Text>
        </Text>
      </View>

      {/* Google button - not functional yet */}
      <TouchableOpacity
        style={{
          paddingVertical: 16,
          borderRadius: 16,
          alignItems: 'center',
          marginBottom: 16,
          flexDirection: 'row',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#d1d5db',
          backgroundColor: '#fff'
        }}
        onPress={() => {}}
      >
        <AntDesign name="google" size={24} color="#dc2626" style={{ marginRight: 8 }} />
        <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 18 }}>
          Register with Google
        </Text>
      </TouchableOpacity>

      <TouchableOpacity className="py-4 rounded-xl items-center mb-4 bg-fire" onPress={handleRegister}>
        <Text className="text-white font-bold text-lg">Register</Text>
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
