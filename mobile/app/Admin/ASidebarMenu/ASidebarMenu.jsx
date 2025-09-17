import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Image, Animated, Dimensions, Alert, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const slideAnim = React.useRef(new Animated.Value(isOpen ? 0 : -width * 0.8)).current;
  const overlayOpacity = React.useRef(new Animated.Value(isOpen ? 0.5 : 0)).current;
  const [overlayInteractive, setOverlayInteractive] = React.useState(false);

  React.useEffect(() => {
    setOverlayInteractive(false); // disable taps during transition
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -width * 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: isOpen ? 0.3 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // enable only after animation completes and drawer is open
      setOverlayInteractive(!!isOpen);
    });
  }, [isOpen, slideAnim, overlayOpacity]);

  // Force-close helper to avoid any race conditions
  const handleCloseNow = (afterClose) => {
    setOverlayInteractive(false);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -width * 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onToggle && onToggle();
      if (typeof afterClose === 'function') {
        requestAnimationFrame(() => afterClose());
      }
    });
  };

  const handleMenuPress = (index) => {
    handleCloseNow(() => setActiveTab(index));
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
          zIndex: 2000,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
        pointerEvents="auto"
        // Prevent iOS edge swipe (like iPhone 6s+) from opening when drawer is closed
        onStartShouldSetResponder={() => true}
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
        <Pressable
          style={{
            position: 'absolute',
            top: (insets?.top || 0) + 12,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100,
          }}
          onPress={handleCloseNow}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onStartShouldSetResponder={() => true}
        >
          <MaterialIcons name="close" size={20} color="#ffffff" />
        </Pressable>
      </Animated.View>

      {/* Overlay - only show when sidebar is open (rendered AFTER drawer) */}
      {isOpen && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 1500,
          }}
          activeOpacity={1}
          onPress={handleCloseNow}
          pointerEvents={overlayInteractive ? 'auto' : 'none'}
          onStartShouldSetResponder={() => true}
        />
      )}
    </>
  );
};

export default ASidebarMenu; 