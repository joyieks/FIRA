import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function CUpdate_Password() {
  const router = useRouter();
  const [fields, setFields] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (field, value) => setFields({ ...fields, [field]: value });

  return (
    <View className="flex-1 bg-gray-100">
      {/* Back Button and Title */}
      <View className="flex-row items-center pt-12 px-4 pb-2 bg-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full bg-white shadow">
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800 ml-4">Update Password</Text>
      </View>
      <View className="mx-6 bg-white rounded-2xl p-6 space-y-4 mt-10">
        <TextInput className="border-b border-gray-200 py-2 mb-4" placeholder="Current Password" secureTextEntry value={fields.current} onChangeText={v => handleChange('current', v)} />
        <TextInput className="border-b border-gray-200 py-2 mb-4" placeholder="New Password" secureTextEntry value={fields.new} onChangeText={v => handleChange('new', v)} />
        <TextInput className="border-b border-gray-200 py-2 mb-4" placeholder="Confirm New Password" secureTextEntry value={fields.confirm} onChangeText={v => handleChange('confirm', v)} />
      </View>
      <View className="mx-6 mt-8">
        <TouchableOpacity className="bg-fire rounded-xl py-3 items-center" onPress={() => setShowConfirm(true)}>
          <Text className="text-white font-bold text-lg">Update Password</Text>
        </TouchableOpacity>
      </View>
      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/40">
          <View className="bg-white rounded-2xl p-8 w-80 items-center">
            <Text className="text-lg font-bold mb-4">Are you sure to update password?</Text>
            <View className="flex-row justify-between px-2 mt-2 w-full">
              <TouchableOpacity className="flex-1 bg-gray-200 px-6 py-2 rounded-xl mr-2" onPress={() => setShowConfirm(false)}>
                <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-fire px-6 py-2 rounded-xl ml-2" onPress={() => { setShowConfirm(false); setShowSuccess(true); }}>
                <Text className="text-white font-semibold text-center">Update</Text>
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
            <Text className="text-lg font-bold mt-4 mb-2 text-center">Password updated successfully!</Text>
            <TouchableOpacity className="bg-fire px-8 py-2 rounded-xl mt-4" onPress={() => { setShowSuccess(false); router.back(); }}>
              <Text className="text-white font-semibold">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
