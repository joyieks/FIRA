import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Alert, TextInput, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../config/AuthContext';
import { supabase } from '../../config/supabase';
import RSettings from './RSettings';

const RProfile = () => {
  const router = useRouter();
  const { logout, userData } = useAuth(); // Get userData from auth context
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Use real user data from authentication context with foreign key data
  const [profile, setProfile] = useState({
    name: userData?.displayName || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Responder',
    email: userData?.email || '',
    address: userData?.address || '', // Foreign Key: station_users.address -> responders.address
    birthdate: userData?.birthdate || '',
    gender: userData?.gender || '',
    stationContactNumber: userData?.stationContactNumber || userData?.station_contact_number || '', // Foreign Key: station_users.phone -> responders.station_contact_number
    contactNumber: userData?.phoneNumber || userData?.phone || '', // Responder's personal contact number
    position: userData?.position || userData?.userType || 'Responder',
    profileImage: userData?.profileImage || null,
  });

  const [editedProfile, setEditedProfile] = useState({...profile});

  // Update profile when userData changes (real-time sync with foreign key data)
  useEffect(() => {
    const fetchStationDataAndUpdateProfile = async () => {
      if (userData) {
        let stationPhone = '';
        let stationAddress = '';
        
        // If the responder has station_id, fetch the station data to get phone and address
        if (userData.stationId) {
          try {
            const { data: stationData, error } = await supabase
              .from('station_users')
              .select('phone, address, station_name')
              .eq('id', userData.stationId)
              .single();
              
            if (stationData && !error) {
              stationPhone = stationData.phone || '';
              stationAddress = stationData.address || '';
            }
          } catch (error) {
            // Silently handle station data fetch error
          }
        }
        
        const updatedProfile = {
          name: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Responder',
          email: userData.email || '',
          address: stationAddress, // Foreign Key: station_users.address -> responders.address
          birthdate: userData.birthdate || '',
          gender: userData.gender || '',
          stationContactNumber: stationPhone, // Foreign Key: station_users.phone -> responders.station_contact_number
          contactNumber: userData.phoneNumber || userData.phone || '', // Responder's personal contact
          position: userData.position || userData.userType || 'Responder',
          profileImage: userData.profileImage || profile.profileImage,
        };
        
        setProfile(updatedProfile);
        setEditedProfile(updatedProfile);
      }
    };

    fetchStationDataAndUpdateProfile();
  }, [userData]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImageUri = result.assets[0].uri;
        setProfile(prev => ({
          ...prev,
          profileImage: newImageUri
        }));
        setEditedProfile(prev => ({
          ...prev,
          profileImage: newImageUri
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Save changes
      setProfile({...editedProfile});
      Alert.alert('Success', 'Profile updated successfully!');
    } else {
      // Enter edit mode
      setEditedProfile({...profile});
    }
    setIsEditing(!isEditing);
  };

  const handleCancel = () => {
    setEditedProfile({...profile});
    setIsEditing(false);
  };

  const updateField = (field, value) => {
    setEditedProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      updateField('birthdate', formattedDate);
    }
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
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

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              // Navigate to login screen
              router.replace('/Authentication/login');
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
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
          <TouchableOpacity onPress={pickImage} className="relative">
            {profile.profileImage ? (
              <Image 
                source={{ uri: profile.profileImage }} 
                className="w-24 h-24 rounded-full mt-16"
                style={{ resizeMode: 'cover' }}
              />
            ) : (
              <View className="w-24 h-24 rounded-full mb-4 items-center justify-center bg-fire mt-16">
                <Text className="text-4xl font-bold text-white">
                  {profile.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
            )}
            {/* Camera icon overlay */}
            <View className="absolute bottom-0 right-0 bg-fire rounded-full p-2 border-2 border-white">
              <MaterialIcons name="camera-alt" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-800 mb-1 mt-4">{profile.name}</Text>
          <Text className="text-base text-gray-500 mb-1">{profile.position}</Text>
        </View>
        {/* Edit and Settings Buttons - moved outside header for stacking */}
        <View className="absolute right-6 top-6 z-50 flex-row" style={{ pointerEvents: 'auto', alignSelf: 'flex-end' }}>
          {isEditing && (
            <TouchableOpacity className="p-2 rounded-full bg-red-100 active:bg-red-200 mr-2" onPress={handleCancel}>
              <MaterialIcons name="close" size={24} color="#dc2626" />
            </TouchableOpacity>
          )}
          <TouchableOpacity className="p-2 rounded-full bg-gray-100 active:bg-gray-200" onPress={handleEditToggle}>
            <MaterialIcons name={isEditing ? "check" : "edit"} size={24} color="#ff512f" />
          </TouchableOpacity>
          <TouchableOpacity className="p-2 rounded-full bg-gray-100 active:bg-gray-200 ml-2" onPress={() => setShowSettings(true)}>
            <MaterialIcons name="settings" size={24} color="#ff512f" />
          </TouchableOpacity>
        </View>

        {/* Contact Information Section */}
        <View className="bg-white m-4 rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">Contact Information</Text>
          {/* Email - Non-editable */}
          <ProfileField icon="email" label="Email" value={profile.email} />
          {/* Station Phone - Foreign Key: station_users.phone -> responders.station_contact_number */}
          <EditableProfileField 
            icon="phone" 
            label="Station Phone" 
            value={isEditing ? editedProfile.stationContactNumber : profile.stationContactNumber}
            isEditing={isEditing}
            onChangeText={(text) => updateField('stationContactNumber', text)}
          />
          {/* Address - Foreign Key: station_users.address -> responders.address */}
          <EditableProfileField 
            icon="home" 
            label="Address" 
            value={isEditing ? editedProfile.address : profile.address}
            isEditing={isEditing}
            onChangeText={(text) => updateField('address', text)}
            multiline
          />
          {/* Birthdate with Date Picker */}
          <TouchableOpacity onPress={isEditing ? openDatePicker : undefined}>
            <View className="flex-row items-start mb-5">
              <MaterialIcons name="event" size={22} color="#ff512f" style={{ marginTop: 2 }} />
              <View className="flex-1 ml-4">
                <Text className="text-xs text-gray-600 mb-1">Birthdate</Text>
                <Text className="text-base text-gray-900">
                  {isEditing ? editedProfile.birthdate : profile.birthdate}
                </Text>
                {isEditing && (
                  <View className="border-b border-gray-300 pb-1 mt-1" />
                )}
              </View>
              {isEditing && (
                <MaterialIcons name="edit" size={20} color="#ff512f" style={{ marginTop: 2 }} />
              )}
            </View>
          </TouchableOpacity>
          <ProfileField icon="calendar-today" label="Age" value={getAge(profile.birthdate)} />
          <EditableProfileField 
            icon="person" 
            label="Gender" 
            value={isEditing ? editedProfile.gender : profile.gender}
            isEditing={isEditing}
            onChangeText={(text) => updateField('gender', text)}
          />
          <EditableProfileField 
            icon="phone-android" 
            label="Contact Number" 
            value={isEditing ? editedProfile.contactNumber : profile.contactNumber}
            isEditing={isEditing}
            onChangeText={(text) => updateField('contactNumber', text)}
          />
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

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={editedProfile.birthdate ? new Date(editedProfile.birthdate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
          minimumDate={new Date(1920, 0, 1)}
        />
      )}
    </View>
  );
};

const EditableProfileField = ({ icon, label, value, isEditing, onChangeText, multiline }) => (
  <View className="flex-row items-start mb-5">
    <MaterialIcons name={icon} size={22} color="#ff512f" style={{ marginTop: 2 }} />
    <View className="flex-1 ml-4">
      <Text className="text-xs text-gray-600 mb-1">{label}</Text>
      {isEditing ? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          className="text-base text-gray-900 border-b border-gray-300 pb-1"
          style={{ 
            minHeight: multiline ? 40 : 20,
            textAlignVertical: multiline ? 'top' : 'center'
          }}
        />
      ) : (
        <Text className="text-base text-gray-900" numberOfLines={multiline ? 2 : 1}>{value}</Text>
      )}
    </View>
  </View>
);

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
