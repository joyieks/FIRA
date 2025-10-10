import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SHeader = ({ onMenuPress, currentTab }) => {
  const getTabTitle = (tabIndex) => {
    const titles = ['Overview', 'Map', 'Notifications', 'Fira Chat', 'User Management', 'Profile', 'Settings'];
    return titles[tabIndex] || 'Stations';
  };

  return (
    <View className="bg-[#ff512f] pt-12 pb-4 px-4 flex-row items-center justify-between">
      <TouchableOpacity
        onPress={onMenuPress}
        className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
        activeOpacity={0.7}
      >
        <MaterialIcons name="menu" size={24} color="#ffffff" />
      </TouchableOpacity>
      
      <Text className="text-white text-lg font-bold">
        {getTabTitle(currentTab)}
      </Text>
      
      <View className="w-10 h-10" />
    </View>
  );
};

export default SHeader; 