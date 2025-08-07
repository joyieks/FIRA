import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SSidebarMenu from '../../Stations/SSidebarMenu/SSidebarMenu';
import SStatus from '../../Stations/StationsMenu/StationsStatus/SStatus';
import SNotifications from '../../Stations/StationsMenu/StationsNotifications/SNotifications';
import SMap from '../../Stations/StationsMenu/StationsMap/SMap';
import SFiraChat from '../../Stations/StationsMenu/StationsChat/SFiraChat';
import SUserManagement from '../../Stations/StationsMenu/StationsUserManagement/SUserManagement';
import SProfile from '../../Stations/StationsProfile/SProfile';
import SSettings from '../../Stations/StationsMenu/StationsSettings/SSettings';

const TABS = [
  { component: <SStatus /> },
  { component: <SMap /> },
  { component: <SNotifications /> },
  { component: <SFiraChat /> },
  { component: <SUserManagement /> },
  { component: <SProfile /> },
  { component: <SSettings /> },
];

export default function StationScreen() {
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
    return titles[tabIndex] || 'Stations';
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
      
      <SSidebarMenu 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={sidebarOpen} 
        onToggle={toggleSidebar} 
      />
    </View>
  );
}
