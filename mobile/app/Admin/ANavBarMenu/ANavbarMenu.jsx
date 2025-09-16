import React from 'react';
import { View, TouchableOpacity, Animated, Dimensions, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { id: 'Notifications', icon: 'notifications', label: 'Notifications' },
  { id: 'Map', icon: 'map', label: 'Map' },
  { id: 'FireStatus', icon: 'whatshot', label: 'Status' },
  { id: 'Chat', icon: 'chat', label: 'Chat' },
  { id: 'Profile', icon: 'person', label: 'Profile' },
];

const FIRE_COLOR = '#ff512f';
const INACTIVE_COLOR = '#fff';
const BAR_COLOR = '#222';
const { width } = Dimensions.get('window');
const TAB_WIDTH = width / TABS.length;
const CIRCLE_SIZE = 56;

const ANavbarMenu = ({ activeTab, setActiveTab, unreadCount = 0 }) => {
  const animValue = React.useRef(new Animated.Value(activeTab)).current;
  const insets = useSafeAreaInsets();

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
    <View className="absolute left-0 right-0 bottom-0 h-[85px] items-center z-10 bg-transparent">
      {/* Simple Background */}
      <View className="absolute inset-0 bg-gradient-to-t from-black/95 to-transparent" />
      
      <View 
        className="w-full rounded-t-3xl overflow-visible justify-center"
        style={{ 
          height: 80 + insets.bottom,
          paddingBottom: insets.bottom 
        }}
      >
        {/* Clean navbar background */}
        <View 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 24,
            backgroundColor: '#000000',
          }}
        />
        
        {/* Tab Buttons */}
        <View className="flex-row w-full h-[80px] items-center justify-between px-4 z-2">
          {TABS.map((tab, idx) => {
            const isActive = activeTab === idx;
            return (
              <TouchableOpacity
                key={tab.id}
                className="flex-1 items-center justify-center h-[80px] px-2"
                activeOpacity={0.7}
                onPress={() => handlePress(idx)}
              >
                <View className="relative items-center justify-center">
                  {/* Clean Tab Design */}
                  {isActive ? (
                    <Animated.View
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: FIRE_COLOR,
                        alignItems: 'center',
                        justifyContent: 'center',
                        elevation: 15,
                        shadowColor: FIRE_COLOR,
                        shadowOpacity: 0.6,
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
                    </Animated.View>
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
                  
                  {/* Simple notification badge */}
                  {tab.id === 'Notifications' && unreadCount > 0 && !isActive && (
                    <View 
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        backgroundColor: '#ff4444',
                        borderRadius: 10,
                        width: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text className="text-white font-bold text-xs">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Clean Label */}
                <Text
                  className={`text-[10px] mt-2 font-medium ${
                    isActive ? 'text-white font-bold' : 'text-gray-400'
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default ANavbarMenu;

export const options = {
  headerShown: false,
}; 