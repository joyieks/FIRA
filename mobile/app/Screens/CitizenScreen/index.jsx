import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CStatus from '../../Citizens/CitizenMenu/CitizenStatus/CStatus';
import CNotifications from '../../Citizens/CitizenMenu/CitizenNotifications/CNotifications';
import CMap from '../../Citizens/CitizenMenu/CitizenMap/CMap';
import CSettings from '../../Citizens/CitizenMenu/CitizenSettings/CSettings';
import CProfile from '../../Citizens/CitizenMenu/CitizenProfile/CProfile';
import CNavbarMenu from '../../Citizens/CNavBarMenu/CNavbarMenu';

const TAB_COMPONENTS = [
  CNotifications,
  CMap,
  CStatus,
  CSettings,
  CProfile,
];

const TAB_NAMES = [
  'Notifications',
  'Map',
  'Status',
  'Settings',
  'Profile',
];

const CitizenScreen = () => {
  const [activeTab, setActiveTab] = useState(2); // Default to Status
  const [unreadCount, setUnreadCount] = useState(0);
  const insets = useSafeAreaInsets();
  
  const renderActiveComponent = () => {
    switch (activeTab) {
      case 0: // Notifications
        return <CNotifications onUnreadCountChange={setUnreadCount} />;
      case 1: // Map
        return <CMap />;
      case 2: // Status
        return <CStatus />;
      case 3: // Settings
        return <CSettings />;
      case 4: // Profile
        return <CProfile />;
      default:
        return <CStatus />;
    }
  };
  
  return (
    <View 
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        paddingBottom: 80 + insets.bottom, // Add space for navbar
      }}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {renderActiveComponent()}
      </View>
      <CNavbarMenu activeTab={activeTab} setActiveTab={setActiveTab} unreadCount={unreadCount} />
    </View>
  );
};

export default CitizenScreen;

export const options = {
  headerShown: false,
  title: "",
};