import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import SSidebarMenu from '../../Stations/SSidebarMenu/SSidebarMenu';
import SStatus from '../../Stations/StationsMenu/StationsStatus/SStatus';
import SNotifications from '../../Stations/StationsMenu/StationsNotifications/SNotifications';
import SMap from '../../Stations/StationsMenu/StationsMap/SMap';
import SFiraChat from '../../Stations/StationsMenu/StationsChat/SFiraChat';
import SUserManagement from '../../Stations/StationsMenu/StationsUserManagement/SUserManagement';
import SProfile from '../../Stations/StationsProfile/SProfile';
import SSettings from '../../Stations/StationsMenu/StationsSettings/SSettings';

export default function StationScreen() {
  const [activeTab, setActiveTab] = useState(0); // Default to Overview
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const TABS = [
    { component: <SStatus /> },
    { component: <SMap /> },
    { component: <SNotifications onUnreadCountChange={setUnreadCount} /> },
    { component: <SFiraChat onContactSelect={setSelectedContact} /> },
    { component: <SUserManagement /> },
    { component: <SProfile /> },
    { component: <SSettings /> },
  ];

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

  const getContactIcon = (type) => {
    switch (type) {
      case 'station':
        return 'business';
      case 'responder':
        return 'shield-checkmark';
      case 'system':
        return 'warning';
      default:
        return 'person';
    }
  };

  const getContactColor = (type) => {
    switch (type) {
      case 'station':
        return 'bg-purple-500';
      case 'responder':
        return 'bg-green-500';
      case 'system':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-1">
        {TABS[activeTab].component}
      </View>
      
      {/* Floating Burger Icon with Title */}
      <View className="absolute top-12 left-0 right-0 flex-row items-center">
        {/* Only show burger menu when not in chat OR when no contact is selected */}
        {(activeTab !== 3 || !selectedContact) && (
          <TouchableOpacity
            className="absolute left-4 w-12 h-12 rounded-full bg-[#ff512f] items-center justify-center"
            onPress={toggleSidebar}
            activeOpacity={0.8}
          >
            <MaterialIcons name="menu" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
        
        {/* Show regular title for other tabs */}
        {activeTab !== 3 && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-xl font-bold text-gray-800">
              {getTabTitle(activeTab)}
            </Text>
          </View>
        )}
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
