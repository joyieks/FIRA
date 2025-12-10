import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Image, Animated, Dimensions, Alert, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../config/AuthContext';
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

const ASidebarMenu = ({ activeTab, setActiveTab, isOpen, onToggle }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout, userData } = useAuth();
  const slideAnim = React.useRef(new Animated.Value(isOpen ? 0 : -width * 0.8)).current;
  const overlayOpacity = React.useRef(new Animated.Value(isOpen ? 0.5 : 0)).current;
  const [overlayInteractive, setOverlayInteractive] = React.useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const [adminName, setAdminName] = useState('');

  // Fetch profile picture when sidebar opens or userData changes
  useEffect(() => {
    console.log('🔄 [Admin Sidebar] useEffect triggered - isOpen:', isOpen, 'userData:', userData);
    if (isOpen && (userData?.id || userData?.uid || userData?.email)) {
      console.log('✅ [Admin Sidebar] Calling fetchProfilePicture');
      fetchProfilePicture();
    } else {
      console.log('⚠️ [Admin Sidebar] Conditions not met for fetch');
    }
  }, [isOpen, userData]);

  const fetchProfilePicture = async () => {
    try {
      const userId = userData?.id || userData?.uid;
      const userEmail = userData?.email;
      console.log('🔍 [Admin Sidebar] Fetching profile for userId:', userId, 'email:', userEmail);
      
      if (!userId && !userEmail) {
        console.log('❌ [Admin Sidebar] No userId or email found');
        return;
      }

      // Fetch admin data from Supabase - try by ID first, then by email
      let query = supabase
        .from('admin_users')
        .select('id, profile_picture_url, display_name, email');
      
      if (userId) {
        query = query.eq('id', userId);
      } else if (userEmail) {
        query = query.eq('email', userEmail);
      }

      const { data: adminData, error } = await query.maybeSingle();

      if (error) {
        console.error('❌ [Admin Sidebar] Error fetching profile picture:', error);
        return;
      }

      console.log('📦 [Admin Sidebar] Admin data received:', adminData);

      if (adminData) {
        console.log('📦 [Admin Sidebar] Raw admin data:', JSON.stringify(adminData, null, 2));
        
        // Get profile picture URL
        let picUrl = adminData.profile_picture_url;
        console.log('🖼️ [Admin Sidebar] Profile picture from DB:', picUrl);
        
        if (!picUrl) {
          const adminId = adminData.id || userId;
          if (adminId) {
            picUrl = await getProfilePictureUrl(adminId, 'admin');
            console.log('🖼️ [Admin Sidebar] Profile picture from service:', picUrl);
          }
        }
        
        setProfilePictureUrl(picUrl);
        console.log('🎨 [Admin Sidebar] Set profilePictureUrl to:', picUrl);
        
        const name = adminData.display_name || adminData.email?.split('@')[0] || 'Admin User';
        console.log('👤 [Admin Sidebar] Display name calculated:', name);
        setAdminName(name);
        console.log('✅ [Admin Sidebar] State updated - name:', name, 'pic:', picUrl);
      } else {
        console.log('⚠️ [Admin Sidebar] No admin data found');
      }
    } catch (error) {
      console.error('❌ [Admin Sidebar] Error in fetchProfilePicture:', error);
    }
  };

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
                <MaterialIcons name="admin-panel-settings" size={40} color="#ff512f" />
              </View>
            )}
            <Text className="text-white text-lg font-bold mb-1" numberOfLines={1}>
              {adminName || userData?.displayName || userData?.email?.split('@')[0] || 'Admin User'}
            </Text>
            <Text className="text-white/80 text-sm" numberOfLines={1}>
              {userData?.email || 'admin@fira.com'}
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

export default ASidebarMenu; 