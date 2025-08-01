import React, { useState } from 'react';
import { View } from 'react-native';
import SNavbarMenu from '../../Stations/SNavBarMenu/SNavbarMenu';
import SStatus from '../../Stations/StationsMenu/StationsStatus/SStatus';
import SNotifications from '../../Stations/StationsMenu/StationsNotifications/SNotifications';
import SMap from '../../Stations/StationsMenu/StationsMap/SMap';
import SFiraChat from '../../Stations/StationsMenu/StationsChat/SFiraChat';
import SProfile from '../../Stations/StationsProfile/SProfile';

const TABS = [
  { component: <SNotifications /> },
  { component: <SMap /> },
  { component: <SStatus /> },
  { component: <SFiraChat /> },
  { component: <SProfile /> },
];

export default function StationScreen() {
  const [activeTab, setActiveTab] = useState(2); // Default to Status

  return (
    <View className="flex-1 bg-gray-100">
      {/* Removed items-center and justify-center */}
      <View className="flex-1">
        {TABS[activeTab].component}
      </View>
      <SNavbarMenu activeTab={activeTab} setActiveTab={setActiveTab} />
    </View>
  );
}
