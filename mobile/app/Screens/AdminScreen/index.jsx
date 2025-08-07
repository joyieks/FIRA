import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ASidebarMenu from '../../Admin/ASidebarMenu/ASidebarMenu';
import AStatus from '../../Admin/AdminMenu/AdminStatus/AStatus';
import ANotifications from '../../Admin/AdminMenu/AdminNotifications/ANotifications';
import AMap from '../../Admin/AdminMenu/AdminMap/AMap';
import AFiraChat from '../../Admin/AdminMenu/AdminChat/AFiraChat';
import AUserManagement from '../../Admin/AdminMenu/AdminUserManagement/AUserManagement';
import AProfile from '../../Admin/AdminProfile/AProfile';
import ASettings from '../../Admin/AdminMenu/AdminSettings/ASettings';

const TABS = [
  { component: <AStatus /> },
  { component: <AMap /> },
  { component: <ANotifications /> },
  { component: <AFiraChat /> },
  { component: <AUserManagement /> },
  { component: <AProfile /> },
  { component: <ASettings /> },
];

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState(0); // Default to Overview
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const getTabTitle = (tabIndex) => {
    const titles = [
      'Overview',
      'Map', 
      'Notifications',
      'Fira Chat',
      'User Management',
      'Profile',
      'Settings'
    ];
    return titles[tabIndex] || 'Admin';
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-1">
        {TABS[activeTab].component}
      </View>
      
      {/* Floating Burger Icon with Title */}
      <View className="absolute top-12 left-0 right-0 flex-row items-center justify-center">
        <TouchableOpacity
          className="absolute left-4 w-12 h-12 rounded-full bg-[#ff512f] items-center justify-center shadow-lg"
          onPress={toggleSidebar}
          activeOpacity={0.8}
        >
          <MaterialIcons name="menu" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800">
          {getTabTitle(activeTab)}
        </Text>
      </View>
      
      <ASidebarMenu 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={sidebarOpen} 
        onToggle={toggleSidebar} 
      />
    </View>
  );
}
