import React, { useState } from 'react';
import { View } from 'react-native';
import RNavbarMenu from '../../Responders/RNavBarMenu/RNavbarMenu';
import RStatus from '../../Responders/RespondersMenu/RespondersStatus/RStatus';
import RNotifications from '../../Responders/RespondersMenu/RespondersNotifications/RNotifications';
import RMap from '../../Responders/RespondersMenu/RespondersMap/RMap';
import RFiraChat from '../../Responders/RespondersMenu/RespondersChat/RFiraChat';
import RProfile from '../../Responders/RespondersProfile/RProfile';

const TABS = [
  { component: <RStatus /> },
  { component: <RNotifications /> },
  { component: <RMap /> },
  { component: <RFiraChat /> },
  { component: <RProfile /> },
];

export default function RespondersScreen() {
  const [activeTab, setActiveTab] = useState(2);

  return (
    <View className="flex-1 bg-gray-100">
      {/* Removed items-center and justify-center */}
      <View className="flex-1">
        {TABS[activeTab].component}
      </View>
      <RNavbarMenu activeTab={activeTab} setActiveTab={setActiveTab} />
    </View>
  );
}
