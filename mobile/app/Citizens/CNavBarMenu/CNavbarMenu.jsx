import React from 'react';
import { View, TouchableOpacity, Animated, Dimensions, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { id: 'Notifications', icon: 'notifications', label: 'Notifications' },
  { id: 'Map', icon: 'map', label: 'Map' },
  { id: 'FireStatus', icon: 'whatshot', label: 'Status' },
  { id: 'Settings', icon: 'settings', label: 'Settings' },
  { id: 'Profile', icon: 'person', label: 'Profile' },
];

const FIRE_COLOR = '#ff512f';
const { width } = Dimensions.get('window');

const CNavbarMenu = ({ activeTab, setActiveTab, unreadCount = 0 }) => {
  const insets = useSafeAreaInsets();

  const handlePress = (idx) => {
    setActiveTab(idx);
  };


  return (
    <View 
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 80 + insets.bottom,
        zIndex: 10,
      }}
    >
      {/* Solid Background */}
      <View 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#000000',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
      />
      
      {/* Tab Buttons */}
      <View 
        style={{
          flexDirection: 'row',
          width: '100%',
          height: 80,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingBottom: insets.bottom,
        }}
      >
        {TABS.map((tab, idx) => {
          const isActive = activeTab === idx;
          return (
            <TouchableOpacity
              key={tab.id}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                height: 80,
                paddingHorizontal: 8,
              }}
              activeOpacity={0.7}
              onPress={() => handlePress(idx)}
            >
              {/* Tab Icon */}
              {isActive ? (
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: FIRE_COLOR,
                    alignItems: 'center',
                    justifyContent: 'center',
                    elevation: 15,
                    shadowColor: FIRE_COLOR,
                    shadowOpacity: 0.8,
                    shadowRadius: 15,
                    shadowOffset: { width: 0, height: 8 },
                    transform: [{ translateY: -15 }],
                  }}
                >
                  <MaterialIcons 
                    name={tab.icon} 
                    size={30} 
                    color="#ffffff" 
                  />
                </View>
              ) : (
                <View 
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons 
                    name={tab.icon} 
                    size={26} 
                    color="#666666" 
                  />
                </View>
              )}
              
              {/* Notification Badge */}
              {tab.id === 'Notifications' && unreadCount > 0 && !isActive && (
                <View 
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    backgroundColor: '#ff4444',
                    borderRadius: 10,
                    width: 20,
                    height: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
              
              {/* Tab Label */}
              <Text
                style={{
                  fontSize: 10,
                  marginTop: 8,
                  fontWeight: isActive ? 'bold' : '500',
                  color: isActive ? '#ffffff' : '#999999',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default CNavbarMenu;

export const options = {
  headerShown: false,
};