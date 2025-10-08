import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SSidebarMenu from '../../Stations/SSidebarMenu/SSidebarMenu';
import SStatus from '../../Stations/StationsMenu/StationsStatus/SStatus';
import SNotifications from '../../Stations/StationsMenu/StationsNotifications/SNotifications';
import SMap from '../../Stations/StationsMenu/StationsMap/SMap';
import SFiraChat from '../../Stations/StationsMenu/StationsChat/SFiraChat';
import SUserManagement from '../../Stations/StationsMenu/StationsUserManagement/SUserManagement';
import SProfile from '../../Stations/StationsProfile/SProfile';
import SSettings from '../../Stations/StationsMenu/StationsSettings/SSettings';
import SAlertsWorker from '../../Stations/StationsMenu/StationsNotifications/SAlertsWorker';

export default function StationScreen() {
  const [activeTab, setActiveTab] = useState(0); // Default to Overview
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();

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
    <View 
      style={{
        flex: 1,
        backgroundColor: '#f3f4f6',
        paddingBottom: 90 + insets.bottom, // Add space for navbar
      }}
    >
      {/* Global alerts worker mounts regardless of active tab */}
      <SAlertsWorker />
      {/* Main Content */}
      <View style={{ flex: 1 }}>
        {TABS[activeTab].component}
      </View>
      
      {/* Floating Burger Icon with Title */}
      <View 
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        {/* Only show burger menu when not in chat OR when no contact is selected */}
        {(activeTab !== 3 || !selectedContact) && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              left: 16,
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#ff512f',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={toggleSidebar}
            activeOpacity={0.8}
          >
            <MaterialIcons name="menu" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
        
        {/* Show regular title for other tabs */}
        {activeTab !== 3 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937' }}>
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
