import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SSettings = () => {
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [locationEnabled, setLocationEnabled] = React.useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = React.useState(false);

  const SettingItem = ({ icon, title, subtitle, onPress, showSwitch = false, switchValue = false, onSwitchChange = null }) => (
    <TouchableOpacity 
      className="flex-row items-center justify-between py-4 px-4 border-b border-gray-100"
      onPress={onPress}
      disabled={showSwitch}
    >
      <View className="flex-row items-center flex-1">
        <MaterialIcons name={icon} size={24} color="#ff512f" />
        <View className="ml-4 flex-1">
          <Text className="text-base font-medium text-gray-800">{title}</Text>
          {subtitle && <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text>}
        </View>
      </View>
      {showSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#d1d5db', true: '#ff512f' }}
          thumbColor={switchValue ? '#ffffff' : '#ffffff'}
        />
      ) : (
        <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white rounded-lg mx-4 mt-4">
        <SettingItem
          icon="notifications"
          title="Push Notifications"
          subtitle="Receive alerts for emergencies"
          showSwitch={true}
          switchValue={notificationsEnabled}
          onSwitchChange={setNotificationsEnabled}
        />
        <SettingItem
          icon="location-on"
          title="Location Services"
          subtitle="Allow access to your location"
          showSwitch={true}
          switchValue={locationEnabled}
          onSwitchChange={setLocationEnabled}
        />
        <SettingItem
          icon="dark-mode"
          title="Dark Mode"
          subtitle="Switch to dark theme"
          showSwitch={true}
          switchValue={darkModeEnabled}
          onSwitchChange={setDarkModeEnabled}
        />
      </View>

      <View className="bg-white rounded-lg mx-4 mt-4">
        <SettingItem
          icon="security"
          title="Privacy & Security"
          subtitle="Manage your privacy settings"
        />
        <SettingItem
          icon="help"
          title="Help & Support"
          subtitle="Get help and contact support"
        />
        <SettingItem
          icon="info"
          title="About"
          subtitle="App version and information"
        />
      </View>

      <View className="bg-white rounded-lg mx-4 mt-4 mb-8">
        <SettingItem
          icon="delete"
          title="Clear Cache"
          subtitle="Free up storage space"
        />
        <SettingItem
          icon="refresh"
          title="Reset Settings"
          subtitle="Restore default settings"
        />
      </View>
    </ScrollView>
  );
};

export default SSettings; 