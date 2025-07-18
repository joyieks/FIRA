import React from 'react';
import { View, TouchableOpacity, Animated, Dimensions, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const TABS = [
  { id: 'FireStatus', icon: 'whatshot', label: 'Status' },
  { id: 'Notifications', icon: 'notifications', label: 'Notifications' },
  { id: 'Map', icon: 'map', label: 'Map' },
  { id: 'Chat', icon: 'chat', label: 'Chat' },
  { id: 'Profile', icon: 'person', label: 'Profile' },
];

const FIRE_COLOR = '#ff512f';
const INACTIVE_COLOR = '#fff';
const BAR_COLOR = '#222';
const { width } = Dimensions.get('window');
const TAB_WIDTH = width / TABS.length;
const CIRCLE_SIZE = 56;

const RNavbarMenu = ({ activeTab, setActiveTab }) => {
  const animValue = React.useRef(new Animated.Value(activeTab)).current;

  React.useEffect(() => {
    Animated.spring(animValue, {
      toValue: activeTab,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [activeTab]);

  const handlePress = (idx) => {
    setActiveTab(idx);
  };

  const translateX = animValue.interpolate({
    inputRange: [0, TABS.length - 1],
    outputRange: [TAB_WIDTH / 2 - CIRCLE_SIZE / 2, width - TAB_WIDTH / 2 - CIRCLE_SIZE / 2],
  });

  const scale = animValue.interpolate({
    inputRange: [0, TABS.length - 1],
    outputRange: [1, 1],
    extrapolate: 'clamp',
  });

  return (
    <View className="absolute left-0 right-0 bottom-0 h-[70px] items-center z-10 bg-black">
      <View className="w-full h-[60px] rounded-t-2xl bg-[#222] overflow-visible justify-center">
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
            transform: [{ translateX }, { scale }],
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
              outputRange: [0, 8, 0],
              extrapolate: 'clamp',
            });
            return (
              <TouchableOpacity
                key={tab.id}
                className="flex-1 items-center justify-center h-[60px]"
                activeOpacity={0.8}
                onPress={() => handlePress(idx)}
              >
                {activeTab !== idx && (
                  <MaterialIcons name={tab.icon} size={28} color={INACTIVE_COLOR} />
                )}
                <Animated.Text
                  className={`text-[11px] mt-0.5 ${isActive ? 'text-[#ff512f] font-bold' : 'text-white'}`}
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

export default RNavbarMenu;

export const options = {
  headerShown: false,
};