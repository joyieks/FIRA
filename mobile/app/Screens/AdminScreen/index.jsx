import React, { useState } from 'react';
import { View } from 'react-native';
import ANavbarMenu from '../../Admin/ANavBarMenu/ANavbarMenu';
import AStatus from '../../Admin/AdminMenu/AdminStatus/AStatus';
import ANotifications from '../../Admin/AdminMenu/AdminNotifications/ANotifications';
import AMap from '../../Admin/AdminMenu/AdminMap/AMap';
import AFiraChat from '../../Admin/AdminMenu/AdminChat/AFiraChat';
import AProfile from '../../Admin/AdminProfile/AProfile';

const TABS = [
  { component: <ANotifications /> },
  { component: <AMap /> },
  { component: <AStatus /> },
  { component: <AFiraChat /> },
  { component: <AProfile /> },
];

export default function AdminScreen() {
  const [activeTab, setActiveTab] = useState(2); // Default to Status

  return (
    <View className="flex-1 bg-gray-100">
      {/* Removed items-center and justify-center */}
      <View className="flex-1">
        {TABS[activeTab].component}
      </View>
      <ANavbarMenu activeTab={activeTab} setActiveTab={setActiveTab} />
    </View>
  );
}
