import React, { useState } from 'react';
import { View, Text, Switch } from 'react-native';

const settingsOptions = [
  { key: 'locationEnabled', title: 'Location Services', subtitle: 'Allow access to your GPS location' },
  { key: 'notificationsEnabled', title: 'Push Notifications', subtitle: 'Receive app notifications' },
  { key: 'darkMode', title: 'Dark Mode', subtitle: 'Switch between light/dark theme' },
  { key: 'wifiOnlyDownloads', title: 'Wi-Fi Only Downloads', subtitle: 'Save mobile data usage' },
  { key: 'emergencyAlerts', title: 'Emergency Alerts', subtitle: 'Critical safety notifications' },
];

const FIRE_COLOR = '#ff512f';
const GRAY_COLOR = '#d1d5db'; // Tailwind gray-300

const RSettings = () => {
  const [settings, setSettings] = useState({
    locationEnabled: true,
    notificationsEnabled: false,
    darkMode: false,
    wifiOnlyDownloads: true,
    emergencyAlerts: true,
  });

  const toggleSetting = (setting) => {
    setSettings({ ...settings, [setting]: !settings[setting] });
  };

  return (
    <View className="flex-1 bg-gray-100 px-4 py-6">
      <Text className="text-2xl font-bold text-gray-800 mb-6 text-center">App Settings</Text>
      <View className="space-y-4">
        {settingsOptions.map((item) => (
          <View key={item.key} className="bg-white rounded-xl p-4 shadow flex-row items-center">
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-800">{item.title}</Text>
              <Text className="text-xs text-gray-500 mt-1">{item.subtitle}</Text>
            </View>
            <Switch
              trackColor={{ false: GRAY_COLOR, true: GRAY_COLOR }}
              thumbColor={settings[item.key] ? FIRE_COLOR : GRAY_COLOR}
              onValueChange={() => toggleSetting(item.key)}
              value={settings[item.key]}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

export default RSettings;

export const options = {
  headerShown: false,
};