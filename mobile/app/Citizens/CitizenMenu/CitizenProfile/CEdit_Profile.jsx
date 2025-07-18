import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

const CEdit_Profile = () => {
  const router = useRouter();
  const [profile, setProfile] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Safety St, Firetown, FT 12345',
    barangay: 'Guadalupe',
    birthdate: '1995-08-15',
    gender: 'Male',
    contactNumber: '09123456789',
    photo: require('../../../../assets/images/joco.jpg'),
  });
  const [tempProfile, setTempProfile] = useState({ ...profile });
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (field, value) => setTempProfile({ ...tempProfile, [field]: value });

  const handleChangePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      alert('Please allow access to your photos to change your profile picture');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.cancelled && result.assets && result.assets.length > 0) {
      const selected = result.assets[0];
      if (selected.uri) {
        setTempProfile({ ...tempProfile, photo: { uri: selected.uri } });
      }
    }
  };

  const handleSave = () => setShowConfirm(true);
  const confirmSave = () => {
    setProfile(tempProfile);
    setShowConfirm(false);
    setShowSuccess(true);
  };

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
            <Image source={tempProfile.photo} className="w-28 h-28 rounded-full border-4 border-fire shadow-md" />
            <TouchableOpacity className="absolute bottom-1 right-1 bg-fire p-2 rounded-full" onPress={handleChangePhoto}>
              <MaterialIcons name="photo-camera" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Card Form */}
        <View className="bg-white mx-4 mt-10 mb-8 rounded-2xl p-6 shadow space-y-6">
          <Field label="Full Name" value={tempProfile.name} onChangeText={v => handleChange('name', v)} />
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
        <TouchableOpacity className="bg-fire rounded-xl py-3 items-center shadow active:scale-95" onPress={handleSave}>
          <Text className="text-white font-bold text-lg">Save Changes</Text>
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

export default CEdit_Profile;