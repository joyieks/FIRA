import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  Image,
  ActivityIndicator,
  Animated,
  Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../config/AuthContext';
import { supabase } from '../../config/supabase';
import { uploadProfilePicture } from '../../services/profilePictureService';

const AEdit_Profile = () => {
  const router = useRouter();
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [tempProfile, setTempProfile] = useState({
    display_name: '',
    email: '',
    phone: '',
    profile_picture_url: null,
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  // Reset animations when modal closes
  useEffect(() => {
    if (!showSuccessModal) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [showSuccessModal]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const userId = userData?.id || userData?.uid;
      if (!userId) {
        Alert.alert('Error', 'User ID not found');
        setLoading(false);
        return;
      }

      console.log('Fetching admin profile for user:', userId);

      const { data: adminData, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching admin profile:', error);
        Alert.alert('Error', 'Failed to load profile data');
        setLoading(false);
        return;
      }

      if (adminData) {
        console.log('Admin data fetched:', adminData);
        setProfile(adminData);
        setTempProfile({
          display_name: adminData.display_name || '',
          email: adminData.email || '',
          phone: adminData.phone || '',
          profile_picture_url: adminData.profile_picture_url || null,
        });
      } else {
        Alert.alert('Error', 'Profile not found');
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      Alert.alert('Error', 'An error occurred while loading profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload a profile picture.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        console.log('Image selected:', result.assets[0].uri);
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const userId = userData?.id || userData?.uid;

      if (!userId) {
        Alert.alert('Error', 'User ID not found');
        return;
      }

      console.log('💾 Saving admin profile...');

      // Upload profile picture if selected
      let profilePictureUrl = tempProfile.profile_picture_url;
      if (selectedImage) {
        console.log('📤 Uploading profile picture...');
        const uploadResult = await uploadProfilePicture(selectedImage, userId, 'admin');
        
        if (uploadResult.success) {
          profilePictureUrl = uploadResult.url;
          console.log('✅ Profile picture uploaded:', profilePictureUrl);
        } else {
          console.error('❌ Failed to upload profile picture:', uploadResult.error);
          Alert.alert('Warning', 'Failed to upload profile picture. Other changes will still be saved.');
        }
      }

      // Update profile in database (only fields that exist in admin_users table)
      const { error } = await supabase
        .from('admin_users')
        .update({
          display_name: tempProfile.display_name,
          email: tempProfile.email,
          phone: tempProfile.phone,
          profile_picture_url: profilePictureUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('Error', `Failed to save profile: ${error.message}`);
        return;
      }

      console.log('✅ Profile updated successfully');

      // Update local state
      setProfile({
        ...profile,
        ...tempProfile,
        profile_picture_url: profilePictureUrl,
      });
      setTempProfile({
        ...tempProfile,
        profile_picture_url: profilePictureUrl,
      });

      // Show success modal with animation
      setShowSuccessModal(true);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'An error occurred while saving profile');
    } finally {
      setSaving(false);
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

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="bg-white pt-16 pb-6 px-6 border-b border-gray-200">
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={() => router.back()} className="p-2">
              <MaterialIcons name="arrow-back" size={24} color="#ff512f" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-gray-800">Edit Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Profile Picture */}
          <View className="items-center mb-4">
            <TouchableOpacity onPress={handleImagePick} className="relative">
              {selectedImage || tempProfile.profile_picture_url ? (
                <Image
                  source={{ uri: selectedImage || tempProfile.profile_picture_url }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                  className="border-4 border-fire"
                />
              ) : (
                <View className="w-24 h-24 rounded-full items-center justify-center bg-fire">
                  <Text className="text-4xl font-bold text-white">
                    {tempProfile.display_name?.[0]?.toUpperCase() || tempProfile.email?.[0]?.toUpperCase() || 'A'}
                  </Text>
                </View>
              )}
              <View className="absolute bottom-0 right-0 bg-fire rounded-full p-2 border-2 border-white">
                <MaterialIcons name="camera-alt" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text className="text-gray-600 text-sm mt-2">Tap to change photo</Text>
          </View>
        </View>

        {/* Form Fields */}
        <View className="p-6">
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            <Text className="text-lg font-bold text-gray-800 mb-4">Admin Information</Text>

            <InputField
              icon="badge"
              label="Display Name"
              value={tempProfile.display_name}
              onChangeText={(text) => setTempProfile({ ...tempProfile, display_name: text })}
              placeholder="Enter display name"
            />

            <InputField
              icon="email"
              label="Email"
              value={tempProfile.email}
              onChangeText={(text) => setTempProfile({ ...tempProfile, email: text })}
              placeholder="Enter email"
              keyboardType="email-address"
            />

            <InputField
              icon="phone"
              label="Phone"
              value={tempProfile.phone}
              onChangeText={(text) => setTempProfile({ ...tempProfile, phone: text })}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              isLast
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            className={`bg-fire rounded-xl py-4 mt-6 ${saving ? 'opacity-50' : ''}`}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center font-bold text-lg">Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-gray-200 rounded-xl py-4 mt-3"
            onPress={() => router.back()}
          >
            <Text className="text-gray-700 text-center font-semibold text-lg">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            }}
            className="bg-white rounded-3xl p-8 w-full max-w-sm items-center shadow-2xl"
          >
            {/* Success Icon Circle */}
            <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-6">
              <MaterialIcons name="check-circle" size={48} color="#10b981" />
            </View>

            {/* Title */}
            <Text className="text-2xl font-bold text-gray-800 mb-3 text-center">
              Success!
            </Text>

            {/* Message */}
            <Text className="text-gray-600 text-center mb-8 leading-6 text-base">
              Profile updated successfully!
            </Text>

            {/* OK Button */}
            <TouchableOpacity
              className="bg-[#ff512f] rounded-xl py-4 px-12 w-full"
              onPress={() => {
                setShowSuccessModal(false);
                Animated.parallel([
                  Animated.timing(scaleAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                ]).start(() => {
                  router.back();
                });
              }}
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-bold text-lg">
                OK
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const InputField = ({ icon, label, value, onChangeText, placeholder, keyboardType, isLast }) => (
  <View className={`${!isLast ? 'mb-4' : ''}`}>
    <View className="flex-row items-center mb-2">
      <MaterialIcons name={icon} size={20} color="#ff512f" />
      <Text className="text-sm font-semibold text-gray-700 ml-2">{label}</Text>
    </View>
    <TextInput
      className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      keyboardType={keyboardType || 'default'}
    />
  </View>
);

export default AEdit_Profile;

export const options = {
  headerShown: false,
};

