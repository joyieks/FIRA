import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const ASettings = () => {
  const settingsOptions = [
    { icon: 'notifications', title: 'Notifications', subtitle: 'Manage notification preferences' },
    { icon: 'security', title: 'Privacy & Security', subtitle: 'Manage your privacy settings' },
    { icon: 'language', title: 'Language', subtitle: 'English' },
    { icon: 'brightness-6', title: 'Appearance', subtitle: 'Dark mode' },
    { icon: 'admin-panel-settings', title: 'Admin Settings', subtitle: 'Manage admin privileges' },
    { icon: 'help', title: 'Help & Support', subtitle: 'Get help and contact support' },
    { icon: 'info', title: 'About', subtitle: 'Version 1.0.0' },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 pt-32">
        
        {settingsOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            className="bg-white rounded-lg p-4 mb-3 flex-row items-center shadow-sm"
            activeOpacity={0.7}
          >
            <View className="w-10 h-10 rounded-full bg-[#ff512f]/10 items-center justify-center mr-4">
              <MaterialIcons name={option.icon} size={20} color="#ff512f" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-semibold text-base">{option.title}</Text>
              <Text className="text-gray-500 text-sm">{option.subtitle}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

export default ASettings; 