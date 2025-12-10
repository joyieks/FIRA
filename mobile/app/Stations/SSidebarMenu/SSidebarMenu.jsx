import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Image, Animated, Dimensions, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../config/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import { getProfilePictureUrl } from '../../services/profilePictureService';

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

const SSidebarMenu = ({ activeTab, setActiveTab, isOpen, onToggle }) => {
  const router = useRouter();
  const { logout, userData } = useAuth();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(isOpen ? 0 : -width * 0.8)).current;
  const overlayOpacity = React.useRef(new Animated.Value(isOpen ? 0.3 : 0)).current;
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const [stationName, setStationName] = useState('');

  // Fetch profile picture when sidebar opens or userData changes
  useEffect(() => {
    if (isOpen && userData?.id) {
      fetchProfilePicture();
    }
  }, [isOpen, userData?.id]);

  const fetchProfilePicture = async () => {
    try {
      const userId = userData?.id || userData?.uid;
      if (!userId) return;

      // Fetch station data from Supabase
      const { data: stationData, error } = await supabase
        .from('station_users')
        .select('profile_picture_url, station_name')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile picture:', error);
        return;
      }

      if (stationData) {
        // Get profile picture URL
        let picUrl = stationData.profile_picture_url;
        if (!picUrl) {
          picUrl = await getProfilePictureUrl(userId, 'station');
        }
        setProfilePictureUrl(picUrl);
        setStationName(stationData.station_name || '');
      }
    } catch (error) {
      console.error('Error in fetchProfilePicture:', error);
    }
  };

  React.useEffect(() => {
    setIsAnimating(true);
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
      setIsAnimating(false);
    });
  }, [isOpen]);

  const handleMenuPress = (index) => {
    setActiveTab(index);
    onToggle(); // Close sidebar after selection
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      onToggle(); // Close sidebar
      await logout(); // Clear authentication data
      router.replace('/Authentication/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  return (
    <>
      {/* Overlay - only show when sidebar is open */}
      {isOpen && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
          }}
          activeOpacity={1}
          onPress={onToggle}
        />
      )}

      {/* Sidebar */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: width * 0.8,
          height: height + insets.top + insets.bottom,
          backgroundColor: '#1a1a1a',
          transform: [{ translateX: slideAnim }],
          zIndex: 1001,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 2, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          paddingTop: insets.top,
        }}
      >
        {/* Profile Section */}
        <View className="bg-[#ff512f] pt-12 pb-6 px-6">
          <View className="items-center">
            {profilePictureUrl ? (
              <Image 
                source={{ uri: profilePictureUrl }} 
                style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: 40,
                  borderWidth: 3,
                  borderColor: '#ffffff',
                  marginBottom: 12 
                }}
              />
            ) : (
              <View className="w-20 h-20 rounded-full bg-white items-center justify-center mb-3">
                <MaterialIcons name="person" size={40} color="#ff512f" />
              </View>
            )}
            <Text className="text-white text-lg font-bold mb-1">
              {stationName || userData?.displayName || userData?.firstName || userData?.station_name || 'Station User'}
            </Text>
            <Text className="text-white/80 text-sm">
              {userData?.email || 'station@fira.com'}
            </Text>
          </View>
        </View>

        {/* Navigation Menu */}
        <ScrollView 
          className="flex-1 px-6 pt-8"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          {MENU_ITEMS.map((item, index) => {
            const isActive = activeTab === index;
            return (
              <TouchableOpacity
                key={item.id}
                className={`flex-row items-center py-5 px-5 rounded-xl mb-3 ${
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
                  size={26}
                  color={isActive ? '#ff512f' : '#ffffff'}
                  style={{ marginRight: 18 }}
                />
                <Text
                  className={`text-lg font-medium ${
                    isActive ? 'text-[#ff512f]' : 'text-white'
                  }`}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Close Button */}
        <TouchableOpacity
          className="absolute top-12 right-4 w-8 h-8 rounded-full bg-white/20 items-center justify-center"
          onPress={onToggle}
        >
          <MaterialIcons name="close" size={20} color="#ffffff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Custom Logout Modal */}
      {showLogoutModal && (
        <View className="absolute top-0 left-0 right-0 bottom-0 flex-1 justify-center items-center bg-black/50" style={{ zIndex: 3000 }}>
          <View className="bg-white rounded-3xl p-8 w-80 items-center shadow-2xl">
            {/* Logout Icon */}
            <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
              <MaterialIcons name="logout" size={32} color="#ef4444" />
            </View>
            
            {/* Title */}
            <Text className="text-xl font-bold text-gray-800 mb-2 text-center">Logout</Text>
            
            {/* Message */}
            <Text className="text-gray-600 text-center mb-6 leading-5">
              Are you sure you want to logout? You'll need to sign in again to access your account.
            </Text>
            
            {/* Buttons */}
            <View className="flex-row w-full">
              <TouchableOpacity 
                className="flex-1 bg-gray-200 py-4 rounded-xl mr-4" 
                onPress={() => setShowLogoutModal(false)}
              >
                <Text className="text-gray-700 font-semibold text-center text-base">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className="flex-1 bg-red-500 py-4 rounded-xl ml-4" 
                onPress={confirmLogout}
              >
                <Text className="text-white font-semibold text-center text-base">Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
};

export default SSidebarMenu; 