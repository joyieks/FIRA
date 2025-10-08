import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, AppState } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';

export default function ANotifications({ onUnreadCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAdminId, setCurrentAdminId] = useState(null);
  const appState = useRef(AppState.currentState);

  // NOTE: Sound/alarm management is now handled by AAlertsWorker component
  // which is mounted at the app level for consistent playback across all screens

  // Get current admin user ID from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        console.log('📱 Raw userData from AsyncStorage:', userDataStr);
        
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          console.log('📱 Parsed userData:', userData);
          
          const resolvedId = userData?.id || userData?.uid;
          console.log('📱 Resolved admin ID:', resolvedId);
          setCurrentAdminId(resolvedId);
        }
      } catch (err) {
        console.error('📱 Error loading user data:', err);
      }
    };
    loadUserData();
  }, []);

  // Load notifications on mount and setup polling
  useEffect(() => {
    if (currentAdminId) {
      console.log('📱 Admin ID available, loading notifications');
      loadNotifications();
      
      // Poll notifications every 2 seconds
      const notificationInterval = setInterval(() => {
        loadNotifications();
      }, 2000);
      
      return () => {
        clearInterval(notificationInterval);
      };
    }
  }, [currentAdminId]);

  const loadNotifications = async () => {
    if (!currentAdminId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentAdminId)
        .eq('user_type', 'admin')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('📱 Error fetching notifications:', error);
        return;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('📱 Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription for notification updates
  useEffect(() => {
    if (!currentAdminId) return;

    console.log('📱 Setting up real-time subscription');

    const channel = supabase
      .channel(`mobile-notifications:admin:${currentAdminId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        console.log('📱 Real-time notification received:', payload.new);
        
        if (payload.new?.user_id === currentAdminId && payload.new?.user_type === 'admin') {
          console.log('📱 This notification is for current admin');
          
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
        table: 'notifications'
      }, (payload) => {
        if (payload.new?.user_id === currentAdminId && payload.new?.user_type === 'admin') {
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === payload.new.id ? payload.new : notification
            )
          );
        }
      })
      .subscribe((status) => {
        console.log('📱 Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentAdminId]);

  // Handle app state changes (reload notifications when app comes to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App has come to foreground, reloading notifications...');
        if (currentAdminId) {
          loadNotifications();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentAdminId]);

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) {
        console.error('📱 Error marking notification as read:', error);
        return;
      }

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id 
            ? { ...notification, is_read: true }
            : notification
        )
      );
      
      // AAlertsWorker will handle stopping the alarm via real-time subscription
    } catch (err) {
      console.error('📱 Error marking notification as read:', err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'fire_alert':
      case 'emergency':
        return { name: 'emergency', color: '#ef4444', bg: '#fef2f2' };
      case 'system':
      case 'info':
        return { name: 'build', color: '#3b82f6', bg: '#eff6ff' };
      case 'user_action':
      case 'new_registration':
        return { name: 'people', color: '#8b5cf6', bg: '#f3f4f6' };
      case 'assignment':
        return { name: 'assignment', color: '#10b981', bg: '#f0fdf4' };
      default:
        return { name: 'notifications', color: '#6b7280', bg: '#f9fafb' };
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return '#dc2626';
      case 'high':
        return '#ef4444';
      case 'normal':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown time';

    let date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      const match = String(dateString).match(/(\w+) (\d+), (\d{4}) (\d+):(\d+) (am|pm)/i);
      if (match) {
        const months = {January:0,February:1,March:2,April:3,May:4,June:5,July:6,August:7,September:8,October:9,November:10,December:11};
        const [, mName, d, y, h, min, ap] = match;
        const month = months[mName];
        let hour = parseInt(h, 10);
        if (ap.toLowerCase() === 'pm' && hour !== 12) hour += 12;
        if (ap.toLowerCase() === 'am' && hour === 12) hour = 0;
        date = new Date(parseInt(y,10), month ?? 0, parseInt(d,10), hour, parseInt(min,10));
      }
    }

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

  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 pt-20">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-2">
          <TouchableOpacity className="bg-fire px-4 py-2 rounded-lg mr-2">
            <Text className="text-white font-medium">All ({notifications.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Unread ({unreadCount})</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadNotifications} />
        }
      >
        {notifications.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8 py-16">
            <MaterialIcons name="notifications-off" size={64} color="#9ca3af" />
            <Text className="text-xl font-bold text-gray-600 mt-4 mb-2">
              No Notifications
            </Text>
            <Text className="text-gray-500 text-center">
              All systems are running smoothly. We'll alert you when action is needed.
            </Text>
          </View>
        ) : (
          notifications.map((notification) => {
            const icon = getNotificationIcon(notification.type);
            const priorityColor = getPriorityColor(notification.priority);
            
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
                  <View 
                    className="w-12 h-12 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: icon.bg }}
                  >
                    <MaterialIcons name={icon.name} size={24} color={icon.color} />
                  </View>

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
                        {notification.priority === 'urgent' && (
                          <View className="bg-red-600 px-2 py-1 rounded mr-2">
                            <Text className="text-white text-xs font-medium">URGENT</Text>
                          </View>
                        )}
                        {notification.priority === 'high' && (
                          <View className="bg-red-100 px-2 py-1 rounded mr-2">
                            <Text className="text-red-600 text-xs font-medium">HIGH</Text>
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
          })
        )}
      </ScrollView>
    </View>
  );
}