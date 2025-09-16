import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../config/AuthContext';

const SProfile = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData } = useAuth();
  const [showDeactivate, setShowDeactivate] = useState(false);
  
  // Use real user data from AuthContext with fallbacks (only database fields)
  const profile = {
    name: userData?.displayName || userData?.firstName || userData?.station_name || 'Station User',
    email: userData?.email || 'station@gmail.com',
    phone: userData?.phoneNumber || 'No phone number',
    address: userData?.address || 'No address provided',
    position: userData?.position || 'Station Officer',
    status: userData?.status || 'Active',
    isOnline: userData?.isOnline || false,
  };



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
        {/* Edit Button - moved outside header for stacking */}
        <View className="absolute right-6 top-6 z-50 flex-row" style={{ pointerEvents: 'auto', alignSelf: 'flex-end' }}>
          <TouchableOpacity className="p-2 rounded-full bg-gray-100 active:bg-gray-200" onPress={() => {}}>
            <MaterialIcons name="edit" size={24} color="#ff512f" />
          </TouchableOpacity>
        </View>

        {/* Contact Information Section */}
        <View className="bg-white m-4 rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">Station Information</Text>
          <ProfileField icon="email" label="Email" value={profile.email} />
          <ProfileField icon="phone" label="Phone" value={profile.phone} />
          <ProfileField icon="home" label="Address" value={profile.address} multiline />
          <ProfileField icon="work" label="Position" value={profile.position} />
          <ProfileField icon="check-circle" label="Status" value={profile.status} />
          <ProfileField icon="wifi" label="Online Status" value={profile.isOnline ? 'Online' : 'Offline'} />
        </View>

        {/* Action Buttons */}
        <View className="mx-4 mt-0 space-y-6 mb-8">
        <TouchableOpacity className="flex-row items-center justify-center bg-white border border-fire rounded-xl py-3 mb-3" onPress={() => {}}>
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
        {/* Extra space at the bottom for navbar and safe area */}
        <View style={{ height: 160 + insets.bottom }} />
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

export default SProfile;

export const options = {
  headerShown: false,
}; 