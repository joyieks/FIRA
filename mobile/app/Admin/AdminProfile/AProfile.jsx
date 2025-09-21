import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../config/AuthContext';
import ASettings from './ASettings';

const AProfile = () => {
  const router = useRouter();
  const { logout, userData } = useAuth(); // Get userData from auth context
  const [showSettings, setShowSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Use real admin user data from authentication context
  const [profile, setProfile] = useState({
    name: userData?.displayName || `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Admin',
    email: userData?.email || '',
    phone: userData?.phone || '',
    address: userData?.address || '',
    contactNumber: userData?.contactNumber || userData?.phone || '',
    position: userData?.role || 'System Administrator',
    profileImage: userData?.profileImage || null,
  });

  const [editedProfile, setEditedProfile] = useState({...profile});

  // Update profile when userData changes (real-time sync)
  useEffect(() => {
    if (userData) {
      const updatedProfile = {
        name: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Admin',
        email: userData.email || '',
        phone: userData.phone || '',
        address: userData.address || '',
        contactNumber: userData.contactNumber || userData.phone || '',
        position: userData.role || 'System Administrator',
        profileImage: userData.profileImage || profile.profileImage,
      };
      
      setProfile(updatedProfile);
      setEditedProfile(updatedProfile);
    }
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

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use the proper logout function from AuthContext
              await logout();
              // Navigate to login screen after clearing auth state
              router.replace('/Authentication/login');
            } catch (error) {
              console.error('Logout error:', error);
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
        <ASettings />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}>
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
          {/* Editable Fields */}
          <EditableProfileField 
            icon="phone" 
            label="Phone" 
            value={isEditing ? editedProfile.phone : profile.phone}
            isEditing={isEditing}
            onChangeText={(text) => updateField('phone', text)}
          />
          <EditableProfileField 
            icon="home" 
            label="Address" 
            value={isEditing ? editedProfile.address : profile.address}
            isEditing={isEditing}
            onChangeText={(text) => updateField('address', text)}
            multiline
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
        <View className="mx-4 mt-0 space-y-6 mb-16">
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
        <View style={{ height: 80 }} />
      </ScrollView>
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

export default AProfile;

export const options = {
  headerShown: false,
}; 