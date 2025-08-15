import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Image, Animated, Dimensions, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../config/AuthContext';

const { width, height } = Dimensions.get('window');

const MENU_ITEMS = [
  { id: 'Overview', icon: 'dashboard', label: 'Overview' },
  { id: 'Map', icon: 'map', label: 'Map' },
  { id: 'Notifications', icon: 'notifications', label: 'Notifications' },
  { id: 'FiraChat', icon: 'chat', label: 'Fira Chat' },
  { id: 'UserManagement', icon: 'people', label: 'User Management' },
  { id: 'Profile', icon: 'person', label: 'Profile' },
  { id: 'Settings', icon: 'settings', label: 'Settings' },
  { id: 'Logout', icon: 'logout', label: 'Logout' },
];

const ASidebarMenu = ({ activeTab, setActiveTab, isOpen, onToggle }) => {
  const router = useRouter();
  const { logout } = useAuth();
  const slideAnim = React.useRef(new Animated.Value(isOpen ? 0 : -width * 0.8)).current;
  const overlayOpacity = React.useRef(new Animated.Value(isOpen ? 0.5 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -width * 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: isOpen ? 0.5 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen]);

  const handleMenuPress = (index) => {
    setActiveTab(index);
    onToggle(); // Close sidebar after selection
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            onToggle(); // Close sidebar
            await logout(); // Clear authentication data
            router.replace('/Authentication/login');
          },
        },
      ]
    );
  };

  return (
    <>
      {/* Overlay - only show when sidebar is open */}
      {isOpen && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            opacity: overlayOpacity,
            zIndex: 1000,
          }}
          onTouchEnd={onToggle}
        />
      )}

      {/* Sidebar */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: width * 0.8,
          height: height,
          backgroundColor: '#1a1a1a',
          transform: [{ translateX: slideAnim }],
          zIndex: 1001,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
      >
        {/* Profile Section */}
        <View className="bg-[#ff512f] pt-12 pb-6 px-6">
          <View className="items-center">
            <View className="w-20 h-20 rounded-full bg-white items-center justify-center mb-3">
              <MaterialIcons name="admin-panel-settings" size={40} color="#ff512f" />
            </View>
            <Text className="text-white text-lg font-bold mb-1">Admin User</Text>
            <Text className="text-white/80 text-sm">admin@fira.com</Text>
          </View>
        </View>

        {/* Navigation Menu */}
        <View className="flex-1 px-4 pt-6">
          {MENU_ITEMS.map((item, index) => {
            const isActive = activeTab === index;
            return (
              <TouchableOpacity
                key={item.id}
                className={`flex-row items-center py-4 px-4 rounded-lg mb-2 ${
                  isActive ? 'bg-[#ff512f]/20' : ''
                }`}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.id === 'Logout') {
                    handleLogout();
                  } else {
                    handleMenuPress(index);
                  }
                }}
              >
                <MaterialIcons
                  name={item.icon}
                  size={24}
                  color={isActive ? '#ff512f' : '#ffffff'}
                  style={{ marginRight: 16 }}
                />
                <Text
                  className={`text-base font-medium ${
                    isActive ? 'text-[#ff512f]' : 'text-white'
                  }`}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Close Button */}
        <TouchableOpacity
          className="absolute top-12 right-4 w-8 h-8 rounded-full bg-white/20 items-center justify-center"
          onPress={onToggle}
        >
          <MaterialIcons name="close" size={20} color="#ffffff" />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

export default ASidebarMenu; 