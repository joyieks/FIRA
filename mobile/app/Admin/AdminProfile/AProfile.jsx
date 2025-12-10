import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../config/AuthContext';
import { supabase } from '../../config/supabase';
import { getProfilePictureUrl } from '../../services/profilePictureService';

const AProfile = () => {
  const router = useRouter();
  const { logout, userData } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch admin profile data from Supabase whenever screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [userData?.id, userData?.uid, userData?.email])
  );

  const fetchProfile = async () => {
    if (!userData?.id && !userData?.uid) {
      console.log('No user ID available');
      setLoading(false);
      return;
    }

    try {
      const userId = userData.id || userData.uid;
      console.log('Fetching admin profile:', userId);

      let { data: adminData, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        Alert.alert('Error', 'Failed to load profile data');
        setLoading(false);
        return;
      }

      if (adminData) {
        // Get profile picture URL
        let picUrl = adminData.profile_picture_url;
        if (!picUrl) {
          picUrl = await getProfilePictureUrl(userId, 'admin');
        }
        setProfilePictureUrl(picUrl);

        setProfile({
          name: adminData.display_name || adminData.email?.split('@')[0] || 'Admin User',
          email: adminData.email || 'N/A',
          phone: adminData.phone || 'N/A',
          status: adminData.status || 'Active',
          isOnline: adminData.is_online || false,
        });
      } else {
        console.log('No admin data found');
        Alert.alert('Error', 'Profile not found');
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      Alert.alert('Error', 'An error occurred while loading profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
      router.replace('/Authentication/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };


  if (loading) {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center">
        <ActivityIndicator size="large" color="#ff512f" />
        <Text className="text-gray-600 mt-4">Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center">
        <MaterialIcons name="error-outline" size={64} color="#ef4444" />
        <Text className="text-gray-600 mt-4">Failed to load profile</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView className="flex-1 pb-45" contentContainerStyle={{ flexGrow: 1 }}>
        {/* Profile Header */}
        <View className="bg-white py-8 items-center border-b border-gray-200 relative" pointerEvents="box-none">
          {profilePictureUrl ? (
            <Image 
              source={{ uri: profilePictureUrl }} 
              className="w-24 h-24 rounded-full mb-4 mt-28 border-4 border-fire"
              style={{ width: 96, height: 96, borderRadius: 48 }}
            />
          ) : (
            <View className="w-24 h-24 rounded-full mb-4 items-center justify-center bg-fire mt-28">
              <Text className="text-4xl font-bold text-white">
                {profile.name.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
          )}
          <Text className="text-2xl font-bold text-gray-800 mb-1">{profile.name}</Text>
          <Text className="text-base text-gray-500 mb-1">Administrator</Text>
        </View>
        {/* Edit Button - moved outside header for stacking */}
        <View className="absolute right-6 top-16 z-50" style={{ pointerEvents: 'auto', alignSelf: 'flex-end' }}>
          <TouchableOpacity 
            className="p-2 rounded-full bg-gray-100 active:bg-gray-200" 
            onPress={() => router.push('/Admin/AdminProfile/AEdit_Profile')}
          >
            <MaterialIcons name="edit" size={24} color="#ff512f" />
          </TouchableOpacity>
        </View>

        {/* Contact Information Section */}
        <View className="bg-white m-4 rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">Admin Information</Text>
          <ProfileField icon="email" label="Email" value={profile.email} />
          <ProfileField icon="phone" label="Phone" value={profile.phone} />
          <ProfileField icon="check-circle" label="Status" value={profile.status} />
          <ProfileField icon="wifi" label="Online Status" value={profile.isOnline ? 'Online' : 'Offline'} />
        </View>

        {/* Action Buttons */}
        <View className="mx-4 mt-0 space-y-6 mb-8">
        <TouchableOpacity className="flex-row items-center justify-center bg-white border border-fire rounded-xl py-3 mb-3" onPress={() => {}}>
          <MaterialIcons name="lock" size={20} color="#ff512f" />
          <Text className="ml-2 text-base font-semibold text-fire">Update Password</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center justify-center bg-fire rounded-xl py-3 mb-3" onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#fff" />
          <Text className="ml-2 text-lg font-semibold text-white">Log Out</Text>
        </TouchableOpacity>
        </View>
        {/* Extra space at the bottom for safe area */}
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* Custom Logout Modal */}
      {showLogoutModal && (
        <View className="absolute top-0 left-0 right-0 bottom-0 flex-1 justify-center items-center bg-black/50 z-50">
          <View className="bg-white rounded-3xl p-8 w-80 items-center shadow-2xl">
            {/* Logout Icon */}
            <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
              <MaterialIcons name="logout" size={32} color="#ef4444" />
            </View>
            
            {/* Title */}
            <Text className="text-xl font-bold text-gray-800 mb-2 text-center">Logout</Text>
            
            {/* Message */}
            <Text className="text-gray-600 text-center mb-6 leading-5">
              Are you sure you want to logout? You'll need to sign in again to access your account.
            </Text>
            
            {/* Buttons */}
            <View className="flex-row w-full">
              <TouchableOpacity 
                className="flex-1 bg-gray-200 py-4 rounded-xl mr-4" 
                onPress={() => setShowLogoutModal(false)}
              >
                <Text className="text-gray-700 font-semibold text-center text-base">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 bg-red-500 py-4 rounded-xl ml-4" 
                onPress={confirmLogout}
              >
                <Text className="text-white font-semibold text-center text-base">Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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

export default AProfile;

export const options = {
  headerShown: false,
}; 