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
  const ActiveComponent = TAB_COMPONENTS[activeTab];
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActiveComponent />
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