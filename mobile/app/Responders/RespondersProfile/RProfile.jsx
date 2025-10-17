import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../config/AuthContext';
import { supabase } from '../../config/supabase';

const RProfile = () => {
  const router = useRouter();
  const { logout, userData } = useAuth();
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch responder profile data from Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userData?.id && !userData?.uid) {
        console.log('No user ID available, userData:', userData);
        setLoading(false);
        return;
      }

      try {
        const userId = userData.id || userData.uid;
        console.log('Fetching responder profile for user:', { userId, userData });
        
        // First try to fetch by id (without join to avoid relationship errors)
        let { data: responderData, error } = await supabase
          .from('responders')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        // If not found by id, try by user_id
        if (!responderData && !error) {
          console.log('Trying to fetch by user_id field...');
          const result = await supabase
            .from('responders')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          
          responderData = result.data;
          error = result.error;
        }

        // If still not found, try by email
        if (!responderData && !error && userData?.email) {
          console.log('Trying to fetch by email:', userData.email);
          const result = await supabase
            .from('responders')
            .select('*')
            .eq('email', userData.email)
            .maybeSingle();
          
          responderData = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Error fetching responder profile:', error);
          Alert.alert('Error', `Failed to load profile data: ${error.message}`);
          setLoading(false);
          return;
        }

        if (responderData) {
          console.log('Responder data fetched successfully:', responderData);
          
          // Fetch station data separately if station_id exists
          let stationName = 'N/A';
          let stationPhone = 'N/A';
          
          if (responderData.station_id) {
            try {
              const { data: stationData, error: stationError } = await supabase
                .from('station_users')
                .select('station_name, phone')
                .eq('id', responderData.station_id)
                .maybeSingle();
              
              if (stationData && !stationError) {
                stationName = stationData.station_name || 'N/A';
                stationPhone = stationData.phone || 'N/A';
              }
            } catch (stationErr) {
              console.log('Could not fetch station data:', stationErr);
            }
          }
          
          setProfile({
            firstName: responderData.first_name || 'N/A',
            lastName: responderData.last_name || 'N/A',
            email: responderData.email || 'N/A',
            phone: responderData.phone || 'N/A',
            address: responderData.address || 'N/A',
            stationName: stationName,
            stationContactNumber: responderData.station_contact_number || stationPhone,
            userPosition: responderData.user_position || 'N/A',
            birthdate: responderData.birthdate || 'N/A',
            age: responderData.age || 'N/A',
            gender: responderData.gender || 'N/A',
          });
        } else {
          console.log('No responder data found for user');
          Alert.alert('Error', 'Responder profile not found. Please contact administrator.');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error in fetchProfile:', error);
        Alert.alert('Error', 'An error occurred while loading profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userData?.id, userData?.uid, userData?.email]);

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

  // Show loading state
  if (loading) {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center">
        <ActivityIndicator size="large" color="#ff512f" />
        <Text className="text-gray-600 mt-4">Loading profile...</Text>
      </View>
    );
  }

  // Show error state if no profile data
  if (!profile) {
    return (
      <View className="flex-1 bg-gray-100 justify-center items-center">
        <MaterialIcons name="error-outline" size={64} color="#ef4444" />
        <Text className="text-gray-600 mt-4">Failed to load profile</Text>
        <TouchableOpacity 
          className="mt-4 bg-fire px-6 py-3 rounded-lg"
          onPress={() => router.replace('/Authentication/login')}
        >
          <Text className="text-white font-semibold">Back to Login</Text>
          </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView className="flex-1 pb-45" contentContainerStyle={{ flexGrow: 1 }}>
        {/* Profile Header */}
        <View className="bg-white py-8 items-center border-b border-gray-200 relative" pointerEvents="box-none">
          <View className="w-24 h-24 rounded-full mb-4 items-center justify-center bg-fire mt-20">
            <Text className="text-4xl font-bold text-white">
              {profile.firstName[0]}{profile.lastName[0]}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-gray-800 mb-1">{profile.firstName} {profile.lastName}</Text>
          <Text className="text-base text-gray-500 mb-1">{profile.userPosition}</Text>
        </View>
        {/* Edit Button - moved outside header for stacking */}
        <View className="absolute right-6 top-6 z-50" style={{ pointerEvents: 'auto', alignSelf: 'flex-end' }}>
          <TouchableOpacity className="p-2 rounded-full bg-gray-100 active:bg-gray-200" onPress={() => router.push('/Responders/RespondersProfile/REdit_Profile')}>
            <MaterialIcons name="edit" size={24} color="#ff512f" />
          </TouchableOpacity>
        </View>

        {/* Personal Information Section */}
        <View className="bg-white m-4 rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">Personal Information</Text>
          <ProfileField icon="person" label="First Name" value={profile.firstName} />
          <ProfileField icon="person-outline" label="Last Name" value={profile.lastName} />
          <ProfileField icon="email" label="Email" value={profile.email} />
          <ProfileField icon="phone" label="Phone" value={profile.phone} />
          <ProfileField icon="home" label="Address" value={profile.address} multiline />
          <ProfileField icon="cake" label="Birthdate" value={profile.birthdate} />
          <ProfileField icon="calendar-today" label="Age" value={typeof profile.age === 'number' ? profile.age.toString() : profile.age} />
          <ProfileField icon="wc" label="Gender" value={profile.gender} />
        </View>

        {/* Station Information Section */}
        <View className="bg-white m-4 mt-0 rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">Station Information</Text>
          <ProfileField icon="local-fire-department" label="Station Name" value={profile.stationName} />
          <ProfileField icon="phone-in-talk" label="Station Contact Number" value={profile.stationContactNumber} />
          <ProfileField icon="work" label="User Position" value={profile.userPosition} />
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
        <TouchableOpacity className="flex-row items-center justify-center bg-fire rounded-xl py-3 mb-3" onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#fff" />
          <Text className="ml-2 text-lg font-semibold text-white">Log Out</Text>
        </TouchableOpacity>
        </View>
        {/* Extra space at the bottom for safe area */}
        <View style={{ height: 120 }} />
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
