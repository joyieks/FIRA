import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../config/AuthContext';
import { supabase } from '../../../config/supabase';
import { getProfilePictureUrl } from '../../../services/profilePictureService';

const CProfile = () => {
  const router = useRouter();
  const { logout, userData } = useAuth();
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch citizen profile data from Supabase whenever screen comes into focus
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
      console.log('Fetching citizen profile:', userId);

      let { data: citizenData, error } = await supabase
        .from('citizen_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        Alert.alert('Error', 'Failed to load profile data');
        setLoading(false);
        return;
      }

      if (citizenData) {
        // Get profile picture URL
        let picUrl = citizenData.profile_picture_url;
        if (!picUrl) {
          picUrl = await getProfilePictureUrl(userId, 'citizen');
        }
        setProfilePictureUrl(picUrl);

        setProfile({
          firstName: citizenData.first_name || 'N/A',
          lastName: citizenData.last_name || 'N/A',
          email: citizenData.email || 'N/A',
          phone: citizenData.phone || citizenData.phone_number || 'N/A',
          address: citizenData.address || 'N/A', // May be N/A if column doesn't exist
          barangay: citizenData.barangay || 'N/A', // May be N/A if column doesn't exist
          birthdate: citizenData.birthdate || 'N/A', // May be N/A if column doesn't exist
          gender: citizenData.gender || 'N/A', // May be N/A if column doesn't exist
          contactNumber: citizenData.phone_number || citizenData.phone || 'N/A',
        });
      } else {
        console.log('No citizen data found');
        Alert.alert('Error', 'Profile not found');
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      Alert.alert('Error', 'An error occurred while loading profile');
    } finally {
      setLoading(false);
    }
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
    <ScrollView className="flex-1 bg-gray-100 pb-6 pt-12">
      {/* Profile Header */}
      <View className="bg-white py-8 items-center border-b border-gray-200 relative">
        {/* Edit Button */}
        <View className="absolute right-6 top-6 z-10">
          <TouchableOpacity className="p-2 rounded-full bg-gray-100 active:bg-gray-200" onPress={() => router.push('/Citizens/CitizenMenu/CitizenProfile/CEdit_Profile')}>
            <MaterialIcons name="edit" size={24} color="#ff512f" />
          </TouchableOpacity>
        </View>
        {profilePictureUrl ? (
          <Image 
            source={{ uri: profilePictureUrl }} 
            className="w-24 h-24 rounded-full mb-4 mt-12 border-4 border-fire"
            style={{ width: 96, height: 96, borderRadius: 48 }}
          />
        ) : (
          <View className="w-24 h-24 rounded-full mb-4 items-center justify-center bg-fire mt-12">
            <Text className="text-4xl font-bold text-white">
              {profile.firstName[0]}{profile.lastName[0]}
            </Text>
          </View>
        )}
        <Text className="text-2xl font-bold text-gray-800 mb-1">{profile.firstName} {profile.lastName}</Text>
      </View>

      {/* Contact Information Section */}
      <View className="bg-white m-4 rounded-2xl p-6 shadow-sm">
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
      <View className="mx-4 mt-0 space-y-6">
        <TouchableOpacity className="flex-row items-center justify-center bg-white border border-fire rounded-xl py-3 mb-3" onPress={() => router.push('/Citizens/CitizenMenu/CitizenProfile/CUpdate_Password')}>
          <MaterialIcons name="lock" size={20} color="#ff512f" />
          <Text className="ml-2 text-base font-semibold text-fire">Update Password</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center justify-center bg-white border border-red-500 rounded-xl py-3 mb-3" onPress={() => setShowDeactivate(true)}>
          <MaterialIcons name="warning" size={20} color="#ef4444" />
          <Text className="ml-2 text-base font-semibold text-red-500">Deactivate Account</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center justify-center bg-fire rounded-xl py-3" onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text className="ml-2 text-base font-semibold text-white">Log Out</Text>
        </TouchableOpacity>
        <View className="mb-32" />
      </View>
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
    </ScrollView>
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

export default CProfile;

export const options = {
  headerShown: false,
};
