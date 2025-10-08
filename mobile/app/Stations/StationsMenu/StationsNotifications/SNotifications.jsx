import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, AppState } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';

export default function SNotifications({ onUnreadCountChange }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentStationId, setCurrentStationId] = useState(null);
  const appState = useRef(AppState.currentState);

  // NOTE: Sound/alarm management is handled by SAlertsWorker component
  // which is mounted at the app level for consistent playback across all screens

  // Get current station user ID from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        console.log('📱 Station: Raw userData from AsyncStorage:', userDataStr);
        
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          console.log('📱 Station: Parsed userData:', userData);
          
          const resolvedId = userData?.id || userData?.uid;
          console.log('📱 Station: Resolved ID:', resolvedId);
          setCurrentStationId(resolvedId);
        }
      } catch (err) {
        console.error('📱 Station: Error loading user data:', err);
      }
    };
    loadUserData();
  }, []);

  // Load notifications on mount and setup polling
  useEffect(() => {
    if (currentStationId) {
      console.log('📱 Station ID available, loading notifications');
      loadNotifications();
      
      // Poll notifications every 2 seconds
      const notificationInterval = setInterval(() => {
        loadNotifications();
      }, 2000);
      
      return () => {
        clearInterval(notificationInterval);
      };
    }
  }, [currentStationId]);

  const loadNotifications = async () => {
    if (!currentStationId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentStationId)
        .eq('user_type', 'station')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('📱 Station: Error fetching notifications:', error);
        return;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('📱 Station: Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription for notification updates
  useEffect(() => {
    if (!currentStationId) return;

    console.log('📱 Station: Setting up real-time subscription');

    const channel = supabase
      .channel(`station-notifications:${currentStationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentStationId}`
      }, (payload) => {
        console.log('📱 Station: Real-time notification received:', payload.new);
        
        if (payload.new?.user_type === 'station') {
          setNotifications(prev => {
            const exists = prev.some(n => n.id === payload.new.id);
            if (!exists) {
              return [payload.new, ...prev];
            }
            return prev;
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentStationId}`
      }, (payload) => {
        if (payload.new?.user_type === 'station') {
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === payload.new.id ? payload.new : notification
            )
          );
        }
      })
      .subscribe((status) => {
        console.log('📱 Station: Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentStationId]);

  // Handle app state changes (reload notifications when app comes to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 Station: App has come to foreground, reloading notifications...');
        if (currentStationId) {
          loadNotifications();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentStationId]);

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) {
        console.error('📱 Station: Error marking notification as read:', error);
        return;
      }

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id 
            ? { ...notification, is_read: true }
            : notification
        )
      );
      
      // SAlertsWorker will handle stopping the alarm via real-time subscription
    } catch (err) {
      console.error('📱 Station: Error marking notification as read:', err);
    }
  };

  const getNotificationIcon = (type) => {
    // For station notifications, type='assignment' means fire report assigned/forwarded
    switch (type) {
      case 'assignment':
        return { name: 'emergency', color: '#ef4444', bg: '#fef2f2' };
      case 'equipment':
        return { name: 'local-fire-department', color: '#dc2626', bg: '#fef2f2' };
      case 'personnel':
        return { name: 'people', color: '#8b5cf6', bg: '#f3f4f6' };
      case 'inventory':
        return { name: 'inventory', color: '#3b82f6', bg: '#eff6ff' };
      case 'training':
        return { name: 'school', color: '#10b981', bg: '#f0fdf4' };
      case 'system':
        return { name: 'info', color: '#6b7280', bg: '#f9fafb' };
      default:
        return { name: 'notifications', color: '#6b7280', bg: '#f9fafb' };
    }
  };

  const getPriorityColor = (type) => {
    // Assignment notifications are high priority
    if (type === 'assignment') return '#ef4444';
    return '#6b7280';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown time';

    let date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Unknown time';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min${diffInMinutes > 1 ? 's' : ''} ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Call the callback whenever unread count changes
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Filter Tabs */}
      <View 
        style={{
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          paddingTop: insets.top + 60, // Lowered from pt-20 (80px) to 60px + safe area
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-2">
          <TouchableOpacity className="bg-fire px-4 py-2 rounded-lg mr-2">
            <Text className="text-white font-medium">All</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Equipment</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Personnel</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg">
            <Text className="text-gray-700 font-medium">Operations</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Notifications List */}
      <ScrollView 
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadNotifications} />
        }
      >
        {notifications.map((notification) => {
          const icon = getNotificationIcon(notification.type);
          const priorityColor = getPriorityColor(notification.type);
          
          return (
            <TouchableOpacity
              key={notification.id}
              className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
                notification.is_read ? 'opacity-75' : ''
              }`}
              style={{ borderLeftColor: priorityColor }}
              onPress={() => markAsRead(notification.id)}
            >
              <View className="flex-row items-start">
                {/* Icon */}
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: icon.bg }}
                >
                  <MaterialIcons name={icon.name} size={24} color={icon.color} />
                </View>

                {/* Content */}
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="font-bold text-gray-800 text-base">
                      {notification.title}
                    </Text>
                    {!notification.is_read && (
                      <View className="w-2 h-2 bg-fire rounded-full" />
                    )}
                  </View>
                  
                  <Text className="text-gray-600 text-sm mb-2 leading-5">
                    {notification.message}
                  </Text>
                  
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-400 text-xs">
                      {formatDate(notification.created_at)}
                    </Text>
                    <View className="flex-row items-center">
                      {!notification.is_read && (
                        <TouchableOpacity
                          onPress={() => markAsRead(notification.id)}
                          className="mr-2"
                        >
                          <MaterialIcons name="check-circle" size={20} color="#10b981" />
                        </TouchableOpacity>
                      )}
                      {notification.type === 'assignment' && (
                        <View className="bg-red-100 px-2 py-1 rounded mr-2">
                          <Text className="text-red-600 text-xs font-medium">URGENT</Text>
                        </View>
                      )}
                      <MaterialIcons 
                        name="chevron-right" 
                        size={16} 
                        color="#9ca3af" 
                      />
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Empty State */}
      {notifications.length === 0 && (
        <View className="flex-1 items-center justify-center px-8">
          <MaterialIcons name="notifications-off" size={64} color="#9ca3af" />
          <Text className="text-xl font-bold text-gray-600 mt-4 mb-2">
            No Notifications
          </Text>
          <Text className="text-gray-500 text-center">
            Station operations are running smoothly. We'll alert you when action is needed.
          </Text>
        </View>
      )}
    </View>
  );
} 