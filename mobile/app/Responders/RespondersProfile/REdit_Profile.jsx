import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Modal, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../config/AuthContext';
import { supabase } from '../../config/supabase';
import { uploadProfilePicture, getProfilePictureUrl } from '../../services/profilePictureService';

const REdit_Profile = () => {
  const router = useRouter();
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    barangay: '',
    birthdate: '',
    gender: '',
    contactNumber: '',
    photo: null,
    photoUrl: null,
    position: '',
  });
  const [tempProfile, setTempProfile] = useState({ ...profile });
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userData?.id && !userData?.uid) {
        console.log('No user ID available');
        setLoading(false);
        return;
      }

      try {
        const userId = userData.id || userData.uid;
        console.log('Fetching responder profile for edit:', userId);

        // Fetch responder data
        let { data: responderData, error } = await supabase
          .from('responders')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!responderData && !error) {
          const result = await supabase
            .from('responders')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          responderData = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Error fetching profile:', error);
          Alert.alert('Error', 'Failed to load profile data');
          setLoading(false);
          return;
        }

        if (responderData) {
          // Get profile picture URL from Supabase Storage
          const profilePicUrl = await getProfilePictureUrl(userId, 'responder');

          setProfile({
            firstName: responderData.first_name || '',
            lastName: responderData.last_name || '',
            email: responderData.email || '',
            phone: responderData.phone || '',
            address: responderData.address || '',
            barangay: responderData.barangay || '',
            birthdate: responderData.birthdate || '',
            gender: responderData.gender || '',
            contactNumber: responderData.contact_number || responderData.phone || '',
            photo: null,
            photoUrl: profilePicUrl,
            position: responderData.user_position || '',
          });
          setTempProfile({
            firstName: responderData.first_name || '',
            lastName: responderData.last_name || '',
            email: responderData.email || '',
            phone: responderData.phone || '',
            address: responderData.address || '',
            barangay: responderData.barangay || '',
            birthdate: responderData.birthdate || '',
            gender: responderData.gender || '',
            contactNumber: responderData.contact_number || responderData.phone || '',
            photo: null,
            photoUrl: profilePicUrl,
            position: responderData.user_position || '',
          });
        }
      } catch (error) {
        console.error('Error in fetchProfile:', error);
        Alert.alert('Error', 'An error occurred while loading profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userData]);

  const handleChange = (field, value) => setTempProfile({ ...tempProfile, [field]: value });

  const handleChangePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photos to change your profile picture');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.cancelled && result.assets && result.assets.length > 0) {
      const selected = result.assets[0];
      if (selected.uri) {
        setTempProfile({ ...tempProfile, photo: { uri: selected.uri }, photoUrl: null });
      }
    }
  };

  const handleSave = () => setShowConfirm(true);
  
  const confirmSave = async () => {
    setShowConfirm(false);
    setSaving(true);

    try {
      const userId = userData?.id || userData?.uid;
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Upload profile picture if a new one was selected
      let profilePictureUrl = tempProfile.photoUrl;
      if (tempProfile.photo?.uri) {
        console.log('Uploading new profile picture...');
        const uploadResult = await uploadProfilePicture(tempProfile.photo.uri, userId, 'responder');
        if (uploadResult.success) {
          profilePictureUrl = uploadResult.url;
          console.log('Profile picture uploaded:', profilePictureUrl);
        } else {
          console.error('Failed to upload profile picture:', uploadResult.error);
          Alert.alert('Warning', 'Profile picture upload failed, but other changes will be saved.');
        }
      }

      // Update responder data in Supabase
      // Only include fields that exist in the database schema
      const updateData = {
        first_name: tempProfile.firstName,
        last_name: tempProfile.lastName,
        email: tempProfile.email,
        phone: tempProfile.phone || tempProfile.contactNumber, // Use phone or contactNumber
        address: tempProfile.address,
        birthdate: tempProfile.birthdate,
        gender: tempProfile.gender,
        user_position: tempProfile.position,
        profile_picture_url: profilePictureUrl, // Store the URL in the database
        updated_at: new Date().toISOString(),
      };
      
      // Only add barangay if the column exists (optional field)
      // If you want to use barangay, add it to the database first with:
      // ALTER TABLE responders ADD COLUMN IF NOT EXISTS barangay TEXT;
      // if (tempProfile.barangay) {
      //   updateData.barangay = tempProfile.barangay;
      // }

      // Try updating by id first
      let { error: updateError } = await supabase
        .from('responders')
        .update(updateData)
        .eq('id', userId);

      // If not found, try by user_id
      if (updateError) {
        const result = await supabase
          .from('responders')
          .update(updateData)
          .eq('user_id', userId);
        updateError = result.error;
      }

      if (updateError) {
        throw updateError;
      }

      // Update local state with new photo URL
      setProfile({ ...tempProfile, photoUrl: profilePictureUrl, photo: null });
      setTempProfile({ ...tempProfile, photoUrl: profilePictureUrl, photo: null });
      setSaving(false);
    setShowSuccess(true);
      
      console.log('✅ Profile updated successfully with photo URL:', profilePictureUrl);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaving(false);
      Alert.alert('Error', `Failed to save profile: ${error.message}`);
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-gray-100">
      {/* Back Button and Title */}
      <View className="flex-row items-center pt-12 px-4 pb-2 bg-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full bg-white shadow">
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800 ml-4">Edit Profile</Text>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* Profile Avatar */}
        <View className="items-center mt-10 mb-2">
          <View className="relative">
            {tempProfile.photo?.uri ? (
              <Image source={{ uri: tempProfile.photo.uri }} className="w-28 h-28 rounded-full border-4 border-fire shadow-md" />
            ) : tempProfile.photoUrl ? (
              <Image source={{ uri: tempProfile.photoUrl }} className="w-28 h-28 rounded-full border-4 border-fire shadow-md" />
            ) : (
              <View className="w-28 h-28 rounded-full border-4 border-fire shadow-md bg-gray-200 items-center justify-center">
                <MaterialIcons name="person" size={48} color="#9ca3af" />
              </View>
            )}
            <TouchableOpacity className="absolute bottom-1 right-1 bg-fire p-2 rounded-full" onPress={handleChangePhoto}>
              <MaterialIcons name="photo-camera" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Card Form */}
        <View className="bg-white mx-4 mt-10 mb-8 rounded-2xl p-6 shadow space-y-6">
          <Field label="First Name" value={tempProfile.firstName} onChangeText={v => handleChange('firstName', v)} />
          <Field label="Last Name" value={tempProfile.lastName} onChangeText={v => handleChange('lastName', v)} />
          <Field label="Position" value={tempProfile.position} onChangeText={v => handleChange('position', v)} />
          <Field label="Email" value={tempProfile.email} onChangeText={v => handleChange('email', v)} keyboardType="email-address" />
          <Field label="Phone" value={tempProfile.phone} onChangeText={v => handleChange('phone', v)} keyboardType="phone-pad" />
          <Field label="Address" value={tempProfile.address} onChangeText={v => handleChange('address', v)} multiline />
          <Field label="Barangay" value={tempProfile.barangay} onChangeText={v => handleChange('barangay', v)} />
          <Field label="Birthdate" value={tempProfile.birthdate} onChangeText={v => handleChange('birthdate', v)} />
          <Field label="Gender" value={tempProfile.gender} onChangeText={v => handleChange('gender', v)} />
          <Field label="Contact Number" value={tempProfile.contactNumber} onChangeText={v => handleChange('contactNumber', v)} keyboardType="phone-pad" />
        </View>
      </ScrollView>
      {/* Sticky Save Button */}
      <View className="bg-white p-4 border-t border-gray-200">
        <TouchableOpacity 
          className="bg-fire rounded-xl py-3 items-center shadow active:scale-95" 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
          <Text className="text-white font-bold text-lg">Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/40">
          <View className="bg-white rounded-2xl p-8 w-80 items-center">
            <Text className="text-lg font-bold mb-4">Are you sure to save these changes?</Text>
            <View className="w-full mt-2">
              <TouchableOpacity className="bg-gray-200 px-6 py-2 rounded-xl mb-3 w-full items-center" onPress={() => setShowConfirm(false)}>
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-fire px-6 py-2 rounded-xl w-full items-center" onPress={confirmSave}>
                <Text className="text-white font-semibold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/40">
          <View className="bg-white rounded-2xl p-8 w-80 items-center">
            <MaterialIcons name="check-circle" size={48} color="#ff512f" />
            <Text className="text-lg font-bold mt-4 mb-2">Profile updated successfully!</Text>
            <TouchableOpacity className="bg-fire px-8 py-2 rounded-xl mt-4" onPress={() => setShowSuccess(false)}>
              <Text className="text-white font-semibold">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const Field = ({ label, value, onChangeText, keyboardType, multiline }) => (
  <View className="mb-2">
    <Text className="text-sm text-gray-600 mb-1 ml-1">{label}</Text>
    <TextInput
      className="border border-gray-200 rounded-lg px-4 py-2 text-base bg-gray-50 focus:border-fire mb-2"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      multiline={multiline}
      placeholder={label}
      placeholderTextColor="#bbb"
    />
  </View>
);

export default REdit_Profile;