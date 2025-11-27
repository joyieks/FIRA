import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import CStatus from '../CitizenStatus/CStatus';
import CNotifications from '../CitizenNotifications/CNotifications';
import CebuMap from './CMap';
import CSettings from '../CitizenSettings/CSettings';
import CProfile from '../CitizenProfile/CProfile';
import CNavbarMenu from '../../CNavBarMenu/CNavbarMenu';

const TAB_COMPONENTS = [
  CStatus,
  CNotifications,
  CebuMap,
  CSettings,
  CProfile,
];

const CitizenMainScreen = () => {
  const [activeTab, setActiveTab] = useState(2); // Default to Map
  const [reportIdToFocus, setReportIdToFocus] = useState(null); // Report ID to focus on map
  
  // Pass props to components based on active tab
  const getComponentProps = () => {
    switch (activeTab) {
      case 1: // CNotifications
        return {
          setActiveTab,
          setReportIdToFocus
        };
      case 2: // CebuMap
        return {
          reportIdToFocus,
          setReportIdToFocus
        };
      default:
        return {};
    }
  };

  const ActiveComponent = TAB_COMPONENTS[activeTab];
  const componentProps = getComponentProps();
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActiveComponent {...componentProps} />
      </View>
      <CNavbarMenu activeTab={activeTab} setActiveTab={setActiveTab} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    paddingBottom: 80, // Space for navbar
  },
});

export default CitizenMainScreen; 