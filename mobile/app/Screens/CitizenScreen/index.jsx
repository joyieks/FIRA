import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CStatus from '../../Citizens/CitizenMenu/CitizenStatus/CStatus';
import CNotifications from '../../Citizens/CitizenMenu/CitizenNotifications/CNotifications';
import CMap from '../../Citizens/CitizenMenu/CitizenMap/CMap';
import CSettings from '../../Citizens/CitizenMenu/CitizenSettings/CSettings';
import CProfile from '../../Citizens/CitizenMenu/CitizenProfile/CProfile';
import CNavbarMenu from '../../Citizens/CNavBarMenu/CNavbarMenu';
import CitizenBanChecker from '../../components/CitizenBanChecker';

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
  const [reportIdToFocus, setReportIdToFocus] = useState(null);
  const insets = useSafeAreaInsets();
  
  const renderActiveComponent = () => {
    switch (activeTab) {
      case 0: // Notifications
        return <CNotifications onUnreadCountChange={setUnreadCount} setActiveTab={setActiveTab} setReportIdToFocus={setReportIdToFocus} />;
      case 1: // Map
        return <CMap reportIdToFocus={reportIdToFocus} setReportIdToFocus={setReportIdToFocus} />;
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
      }}
    >
      {/* Ban checker - monitors if citizen gets banned while logged in */}
      <CitizenBanChecker />
      
      <View style={{ flex: 1, paddingBottom: 60 }}>
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