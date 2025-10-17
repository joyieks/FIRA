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
const INACTIVE_COLOR = '#fff';
const BAR_COLOR = '#222';
const { width: screenWidth } = Dimensions.get('window');
const CIRCLE_SIZE = 56;

const CNavbarMenu = ({ activeTab, setActiveTab, unreadCount = 0 }) => {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = React.useState(screenWidth);
  const tabWidth = barWidth / TABS.length;
  const getX = (idx) => idx * tabWidth + (tabWidth - CIRCLE_SIZE) / 2;
  const animValue = React.useRef(new Animated.Value(getX(activeTab))).current;

  React.useEffect(() => {
    Animated.spring(animValue, {
      toValue: getX(activeTab),
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [activeTab, barWidth]);

  const handlePress = (idx) => {
    setActiveTab(idx);
  };

  const translateX = animValue;

  const scale = 1;

  return (
    <View 
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 60 + insets.bottom,
        alignItems: 'center',
        zIndex: 10,
        backgroundColor: 'black',
      }}
    >
      <View className="w-full h-[50px] rounded-t-2xl bg-[#222] overflow-visible justify-center" onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {/* Floating Icon */}
        <Animated.View
          style={{
            position: 'absolute',
            top: -28,
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: CIRCLE_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: FIRE_COLOR,
            elevation: 8,
            shadowColor: FIRE_COLOR,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            zIndex: 2,
            transform: [{ translateX: animValue }],
          }}
        >
          <MaterialIcons name={TABS[activeTab].icon} size={32} color="#fff" style={{ zIndex: 2 }} />
        </Animated.View>
        {/* Tab Buttons */}
        <View className="flex-row w-full h-[60px] items-center justify-between px-0 z-2">
          {TABS.map((tab, idx) => {
            const isActive = activeTab === idx;
            const labelTranslateY = animValue.interpolate({
              inputRange: [idx - 1, idx, idx + 1],
              outputRange: [0, 40, 0],
              extrapolate: 'clamp',
            });
            return (
              <TouchableOpacity
                key={tab.id}
                className="flex-1 items-center justify-center h-[60px]"
                activeOpacity={0.8}
                onPress={() => handlePress(idx)}
              >
                <View className={`relative ${activeTab !== idx ? 'mt-1' : ''}`}>
                  {activeTab !== idx && (
                    <MaterialIcons name={tab.icon} size={28} color={INACTIVE_COLOR} />
                  )}
                  {/* Unread count badge for notifications */}
                  {tab.id === 'Notifications' && unreadCount > 0 && activeTab !== idx && (
                    <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                      <Text className="text-white font-bold text-xs">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Animated.Text
                  className={`text-[11px] ${isActive ? 'text-[#ff512f] font-bold mt-6' : 'text-white mt-0'}`}
                  style={{ transform: [{ translateY: labelTranslateY }] }}
                >
                  {tab.label}
                </Animated.Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default CNavbarMenu;

export const options = {
  headerShown: false,
};