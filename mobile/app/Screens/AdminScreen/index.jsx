import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ASidebarMenu from '../../Admin/ASidebarMenu/ASidebarMenu';
import AOverview from '../../Admin/AdminMenu/AdminOverview/AOverview';
import ANotifications from '../../Admin/AdminMenu/AdminNotifications/ANotifications';
import AMap from '../../Admin/AdminMenu/AdminMap/AMap';
import AFiraChat from '../../Admin/AdminMenu/AdminChat/AFiraChat';
import AUserManagement from '../../Admin/AdminMenu/AdminUserManagement/AUserManagement';
import AProfile from '../../Admin/AdminProfile/AProfile';
import ASettings from '../../Admin/AdminMenu/AdminSettings/ASettings';

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState(0); // Default to Overview
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();

  const TABS = [
    { component: <AOverview /> },
    { component: <AMap /> },
    { component: <ANotifications onUnreadCountChange={setUnreadCount} /> },
    { component: <AFiraChat onContactSelect={setSelectedContact} /> },
    { component: <AUserManagement /> },
    { component: <AProfile /> },
    { component: <ASettings /> },
  ];

  const openSidebar = () => {
    // Force immediate open and avoid race with previous close
    setSidebarOpen(true);
  };
  const closeSidebar = () => setSidebarOpen(false);

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
      {/* Main Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 1 ? (
          <AMap isSidebarOpen={sidebarOpen} />
        ) : (
          TABS[activeTab].component
        )}
      </View>
      
      {/* Floating Burger Icon (no section headers as requested) */}
      <View 
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          zIndex: 10000,
          elevation: 20,
        }}
        pointerEvents="auto"
      >
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
              zIndex: 11000,
            }}
            onPress={openSidebar}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            pointerEvents="auto"
          >
            <MaterialIcons name="menu" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
      
      <ASidebarMenu 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={sidebarOpen} 
        onToggle={closeSidebar} 
        // Ensure the drawer only opens from explicit button, not gestures
      />
    </View>
  );
}
