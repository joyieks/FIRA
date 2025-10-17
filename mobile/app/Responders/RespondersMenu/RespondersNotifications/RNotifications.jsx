import { View, Text, ScrollView, TouchableOpacity, RefreshControl, AppState } from 'react-native';
import React, { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';

export default function RNotifications({ onUnreadCountChange }) {

 
  const [loading, setLoading] = useState(true);
  const [currentResponderId, setCurrentResponderId] = useState(null);
  const appState = useRef(AppState.currentState);

  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'emergency',
      title: 'Emergency Call - Fire Incident',
      message: 'Fire reported at 123 Main Street. All available units respond immediately. Code 3 response required.',
      time: '3 minutes ago',
      read: false,
      priority: 'high'
    },
    {
      id: 2,
      type: 'dispatch',
      title: 'Dispatch Assignment',
      message: 'You have been assigned to Station 1, Truck 2. Report to duty within 15 minutes.',
      time: '10 minutes ago',
      read: false,
      priority: 'high'
    },
    {
      id: 3,
      type: 'equipment',
      title: 'Equipment Check Required',
      message: 'SCBA inspection due. Complete equipment check before next shift.',
      time: '1 hour ago',
      read: false,
      priority: 'medium'
    },
    {
      id: 4,
      type: 'training',
      title: 'Training Session',
      message: 'Mandatory safety training scheduled for tomorrow at 9:00 AM. All responders must attend.',
      time: '2 hours ago',
      read: true,
      priority: 'medium'
    },
    {
      id: 5,
      type: 'team',
      title: 'Team Update',
      message: 'New team member John Smith assigned to your shift. Welcome briefing at 7:00 AM.',
      time: '4 hours ago',
      read: true,
      priority: 'low'
    },
    {
      id: 6,
      type: 'alert',
      title: 'Weather Alert',
      message: 'High winds expected today. Exercise caution during emergency responses.',
      time: '1 day ago',
      read: true,
      priority: 'medium'
    }
  ]);

  // NOTE: Sound/alarm management is handled by RAlertsWorker component
  // which is mounted at the app level for consistent playback across all screens

  // Get current responder user ID from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        console.log('📱 Responder: Raw userData from AsyncStorage:', userDataStr);
        
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          console.log('📱 Responder: Parsed userData:', userData);
          
          const resolvedId = userData?.id || userData?.uid;
          console.log('📱 Responder: Resolved ID:', resolvedId);
          setCurrentResponderId(resolvedId);
        }
      } catch (err) {
        console.error('📱 Responder: Error loading user data:', err);
      }
    };
    loadUserData();
  }, []);

  // Load notifications on mount and setup polling
  useEffect(() => {
    if (currentResponderId) {
      console.log('📱 Responder ID available, loading notifications');
      loadNotifications();
      
      // Poll notifications every 2 seconds
      const notificationInterval = setInterval(() => {
        loadNotifications();
      }, 2000);
      
      return () => {
        clearInterval(notificationInterval);
      };
    }
  }, [currentResponderId]);

  const loadNotifications = async () => {
    if (!currentResponderId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('responder_notifications')
        .select('*')
        .eq('responder_id', currentResponderId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('📱 Responder: Error fetching notifications:', error);
        return;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('📱 Responder: Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription for notification updates
  useEffect(() => {
    if (!currentResponderId) return;

    console.log('📱 Responder: Setting up real-time subscription');

    const channel = supabase
      .channel(`responder-notifications:${currentResponderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'responder_notifications',
        filter: `responder_id=eq.${currentResponderId}`
      }, (payload) => {
        console.log('📱 Responder: Real-time notification received:', payload.new);
        
        setNotifications(prev => {
          const exists = prev.some(n => n.id === payload.new.id);
          if (!exists) {
            return [payload.new, ...prev];
          }
          return prev;
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'responder_notifications',
        filter: `responder_id=eq.${currentResponderId}`
      }, (payload) => {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === payload.new.id ? payload.new : notification
          )
        );
      })
      .subscribe((status) => {
        console.log('📱 Responder: Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentResponderId]);

  // Handle app state changes (reload notifications when app comes to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 Responder: App has come to foreground, reloading notifications...');
        if (currentResponderId) {
          loadNotifications();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentResponderId]);

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('responder_notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) {
        console.error('📱 Responder: Error marking notification as read:', error);
        return;
      }

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id 
            ? { ...notification, is_read: true }
            : notification
        )
      );
      
      // RAlertsWorker will handle stopping the alarm via real-time subscription
    } catch (err) {
      console.error('📱 Responder: Error marking notification as read:', err);
    }
  };

  const getNotificationIcon = (priority) => {
    // For responder notifications, we use priority to determine icon
    switch (priority) {
      case 'high':
        return { name: 'emergency', color: '#ef4444', bg: '#fef2f2' };
      case 'medium':
        return { name: 'warning', color: '#f59e0b', bg: '#fffbeb' };
      case 'low':
        return { name: 'info', color: '#3b82f6', bg: '#eff6ff' };
      default:
        return { name: 'notifications', color: '#6b7280', bg: '#f9fafb' };
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return '#ef4444';
      case 'medium':
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

  // Pull to refresh handler
  const onRefresh = () => {
    setRefreshing(true);
    // Simulate refresh - in real app, fetch from Supabase
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-16 pb-4 px-4 border-b border-gray-200">
        <View className="flex-row items-center justify-center">
          <Text className="text-fire font-bold text-lg">Notification</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="bg-white border-b border-gray-200">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-2">
          <TouchableOpacity className="bg-fire px-4 py-2 rounded-lg mr-2">
            <Text className="text-white font-medium">All</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Dispatch</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Equipment</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg">
            <Text className="text-gray-700 font-medium">Training</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Notifications List */}
      <ScrollView 
        className="flex-1 px-4 pt-4"
        refreshControl={

          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#ff512f']}
            tintColor="#ff512f"
          />
        }
      >
        {notifications.map((notification) => {
          const icon = getNotificationIcon(notification.priority);
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
                      {notification.priority === 'high' && (
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
            Stay alert! We&apos;ll notify you when emergency calls come in.
          </Text>
        </View>
      )}
    </View>
  );
}
