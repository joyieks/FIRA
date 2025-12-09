import React, { useState, useRef } from 'react';
import { View } from 'react-native';
import RNavbarMenu from '../../Responders/RNavBarMenu/RNavbarMenu';
import RStatus from '../../Responders/RespondersMenu/RespondersStatus/RStatus';
import RNotifications from '../../Responders/RespondersMenu/RespondersNotifications/RNotifications';
import RMap from '../../Responders/RespondersMenu/RespondersMap/RMap';
import RFiraChat from '../../Responders/RespondersMenu/RespondersChat/RFiraChat';
import RProfile from '../../Responders/RespondersProfile/RProfile';
import RAlertsWorker from '../../Responders/RespondersMenu/RespondersNotifications/RAlertsWorker';

export default function RespondersScreen() {
  const [activeTab, setActiveTab] = useState(2); // Default to Status
  const [selectedContact, setSelectedContact] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [routingInfo, setRoutingInfo] = useState(null);

  const handleNavigateToMap = (fireInfo) => {
    // Normalize payload to the shape RMap expects
    const normalized =
      fireInfo && typeof fireInfo === 'object'
        ? fireInfo
        : { fireReportId: fireInfo };

    console.log('🗺️ Navigating to map with fire info:', normalized);
    setRoutingInfo(normalized);
    setActiveTab(1); // Switch to Map tab (index 1)
  };

  const TABS = [
    { component: <RNotifications onUnreadCountChange={setUnreadCount} onNavigateToMap={handleNavigateToMap} /> },
    { component: <RMap routingInfo={routingInfo} /> },
    { component: <RStatus onNavigateToMap={handleNavigateToMap} /> },
    { component: <RFiraChat onContactSelect={setSelectedContact} /> },
    { component: <RProfile /> },
  ];

  return (
    <View className="flex-1 bg-gray-100">
      {/* Global alerts worker mounts regardless of active tab */}
      <RAlertsWorker />
      {/* Removed items-center and justify-center */}
      <View className="flex-1" style={{ paddingBottom: 60 }}>
        {TABS[activeTab].component}
      </View>
      <RNavbarMenu activeTab={activeTab} setActiveTab={setActiveTab} unreadCount={unreadCount} />
    </View>
  );
}
