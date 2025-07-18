import React, { useState } from 'react';
import { View } from 'react-native';
import CStatus from '../../Citizens/CitizenMenu/CitizenStatus/CStatus';
import CNotifications from '../../Citizens/CitizenMenu/CitizenNotifications/CNotifications';
import CMap from '../../Citizens/CitizenMenu/CitizenMap/CMap';
import CSettings from '../../Citizens/CitizenMenu/CitizenSettings/CSettings';
import CProfile from '../../Citizens/CitizenMenu/CitizenProfile/CProfile';
import CNavbarMenu from '../../Citizens/CNavBarMenu/CNavbarMenu';

const TAB_COMPONENTS = [
  CStatus,
  CNotifications,
  CMap,
  CSettings,
  CProfile,
];


const CitizenScreen = () => {
  const [activeTab, setActiveTab] = useState(2); // Default to Map
  const ActiveComponent = TAB_COMPONENTS[activeTab];
  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 pb-20">
        <ActiveComponent />
      </View>
      <CNavbarMenu activeTab={activeTab} setActiveTab={setActiveTab} />
    </View>
  );
};

export default CitizenScreen;

export const options = {
  headerShown: false,
  title: "",
};