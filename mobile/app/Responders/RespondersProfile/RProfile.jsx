import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import RSettings from './RSettings';

const RProfile = () => {
  const router = useRouter();
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const profile = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Safety St, Firetown, FT 12345',
    barangay: 'Guadalupe',
    birthdate: '1995-08-15',
    gender: 'Male',
    contactNumber: '09123456789',
    position: 'Officer',
  };

  // Calculate age from birthdate
  const getAge = (birthdate) => {
    const birth = new Date(birthdate);
    if (!isNaN(birth.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age.toString();
    }
    return '';
  };

  if (showSettings) {
    return (
      <View className="flex-1 bg-gray-100">
        {/* Back Button */}
        <View className="flex-row items-center pt-12 px-4 pb-2 bg-gray-100">
          <TouchableOpacity onPress={() => setShowSettings(false)} className="p-2 rounded-full bg-white shadow">
            <MaterialIcons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800 ml-4">Settings</Text>
        </View>
        <RSettings />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView className="flex-1 pb-45" contentContainerStyle={{ flexGrow: 1 }}>
        {/* Profile Header */}
        <View className="bg-white py-8 items-center border-b border-gray-200 relative" pointerEvents="box-none">
          <View className="w-24 h-24 rounded-full mb-4 items-center justify-center bg-fire mt-16">
            <Text className="text-4xl font-bold text-white">
              {profile.name.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-gray-800 mb-1">{profile.name}</Text>
          <Text className="text-base text-gray-500 mb-1">{profile.position}</Text>
        </View>
        {/* Edit and Settings Buttons - moved outside header for stacking */}
        <View className="absolute right-6 top-6 z-50 flex-row" style={{ pointerEvents: 'auto', alignSelf: 'flex-end' }}>
          <TouchableOpacity className="p-2 rounded-full bg-gray-100 active:bg-gray-200" onPress={() => router.push('/Responders/RespondersProfile/REdit_Profile')}>
            <MaterialIcons name="edit" size={24} color="#ff512f" />
          </TouchableOpacity>
          <TouchableOpacity className="p-2 rounded-full bg-gray-100 active:bg-gray-200 ml-2" onPress={() => setShowSettings(true)}>
            <MaterialIcons name="settings" size={24} color="#ff512f" />
          </TouchableOpacity>
        </View>

        {/* Contact Information Section */}
        <View className="bg-white m-4 rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">Contact Information</Text>
          <ProfileField icon="email" label="Email" value={profile.email} />
          <ProfileField icon="phone" label="Phone" value={profile.phone} />
          <ProfileField icon="home" label="Address" value={profile.address} multiline />
          <ProfileField icon="location-on" label="Barangay" value={profile.barangay} />
          <ProfileField icon="event" label="Birthdate" value={profile.birthdate} />
          <ProfileField icon="calendar-today" label="Age" value={getAge(profile.birthdate)} />
          <ProfileField icon="person" label="Gender" value={profile.gender} />
          <ProfileField icon="phone-android" label="Contact Number" value={profile.contactNumber} />
        </View>

        {/* Action Buttons */}
        <View className="mx-4 mt-0 space-y-6 mb-8">
        <TouchableOpacity className="flex-row items-center justify-center bg-white border border-fire rounded-xl py-3 mb-3" onPress={() => router.push('/Responders/RespondersProfile/RUpdate_Password')}>
          <MaterialIcons name="lock" size={20} color="#ff512f" />
          <Text className="ml-2 text-base font-semibold text-fire">Update Password</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center justify-center bg-white border border-red-500 rounded-xl py-3 mb-3" onPress={() => setShowDeactivate(true)}>
          <MaterialIcons name="warning" size={20} color="#ef4444" />
          <Text className="ml-2 text-base font-semibold text-red-500">Deactivate Account</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center justify-center bg-fire rounded-xl py-3 mb-3" onPress={() => {}}>
          <MaterialIcons name="logout" size={24} color="#fff" />
          <Text className="ml-2 text-lg font-semibold text-white">Log Out</Text>
        </TouchableOpacity>
        </View>
        {/* Extra space at the bottom for safe area */}
        <View style={{ height: 50 }} />
        {/* Deactivate Modal */}
        {showDeactivate && (
          <View className="absolute top-0 left-0 right-0 bottom-0 flex-1 justify-center items-center bg-black/40 z-50">
            <View className="bg-white rounded-2xl p-8 w-80 items-center">
              <MaterialIcons name="warning" size={48} color="#ef4444" />
              <Text className="text-lg font-bold mt-4 mb-2 text-center">Are you sure you want to deactivate your account?</Text>
              <View className="flex-row justify-center gap-x-4 mt-2 w-full">
                <TouchableOpacity className="bg-gray-200 px-8 py-2 rounded-xl" onPress={() => setShowDeactivate(false)}>
                  <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity className="bg-red-500 px-8 py-2 rounded-xl" onPress={() => setShowDeactivate(false)}>
                  <Text className="text-white font-semibold text-center">Deactivate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const ProfileField = ({ icon, label, value, multiline }) => (
  <View className="flex-row items-start mb-5">
    <MaterialIcons name={icon} size={22} color="#ff512f" style={{ marginTop: 2 }} />
    <View className="flex-1 ml-4">
      <Text className="text-xs text-gray-600 mb-1">{label}</Text>
      <Text className="text-base text-gray-900" numberOfLines={multiline ? 2 : 1}>{value}</Text>
    </View>
  </View>
);

export default RProfile;

export const options = {
  headerShown: false,
};
