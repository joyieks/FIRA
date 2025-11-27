import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';

const CNotifications = ({ onUnreadCountChange, setActiveTab, setReportIdToFocus }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Get current user ID
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        }
      } catch (error) {
        console.error('Error getting user:', error);
      }
    };
    getUser();
  }, []);

  // Load notifications from Supabase
  const loadNotifications = async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('📱 Loading citizen notifications for user:', currentUserId);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('user_type', 'citizen')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      // Transform Supabase notifications to match component format
      const formattedNotifications = (data || []).map(notif => ({
        id: notif.id,
        type: notif.type === 'fire_alert' ? 'emergency' : notif.type,
        title: notif.title,
        message: notif.message,
        time: formatTimeAgo(notif.created_at),
        read: notif.is_read || false,
        priority: notif.priority || 'normal',
        related_report_id: notif.related_report_id,
        created_at: notif.created_at,
        is_read: notif.is_read || false // Keep both for compatibility
      }));

      console.log(`✅ Loaded ${formattedNotifications.length} notifications`);
      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp to "time ago" format
  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown time';
    
    const date = new Date(dateString);
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Load notifications when user ID is available
  useEffect(() => {
    if (currentUserId) {
      loadNotifications();
    }
  }, [currentUserId]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!currentUserId) return;

    console.log('📡 Setting up real-time subscription for citizen notifications');

    const channel = supabase
      .channel(`citizen-notifications:${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUserId}&user_type=eq.citizen`
      }, (payload) => {
        console.log('📱 New notification received:', payload.new);
        // Reload notifications to get the latest
        loadNotifications();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUserId}&user_type=eq.citizen`
      }, (payload) => {
        console.log('📱 Notification updated:', payload.new);
        // Update the notification in the list
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === payload.new.id
              ? { ...notif, read: payload.new.is_read || false }
              : notif
          )
        );
      })
      .subscribe((status) => {
        console.log('📡 Citizen notification subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId]);

  const markAsRead = async (id) => {
    // Optimistically update UI
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );

    // Update in Supabase
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) {
        console.error('Error marking notification as read:', error);
        // Revert optimistic update on error
        loadNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      loadNotifications();
    }
  };

  const getNotificationIcon = (type, title) => {
    // Special handling for citizen's own report notifications
    if (title && title.includes('Acknowledged')) {
      return { name: 'check-circle', color: '#10b981', bg: '#d1fae5' };
    }
    if (title && title.includes('Resolved')) {
      return { name: 'check-circle', color: '#10b981', bg: '#d1fae5' };
    }
    if (title && title.includes('Alarm Level')) {
      return { name: 'warning', color: '#f59e0b', bg: '#fef3c7' };
    }
    
    switch (type) {
      case 'user_action':
        return { name: 'check-circle', color: '#10b981', bg: '#d1fae5' };
      case 'emergency':
      case 'fire_alert':
        return { name: 'local-fire-department', color: '#ef4444', bg: '#fef2f2' };
      case 'system':
        return { name: 'system-update', color: '#3b82f6', bg: '#eff6ff' };
      case 'info':
        return { name: 'info', color: '#10b981', bg: '#f0fdf4' };
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

  const unreadCount = notifications.filter(n => !n.read).length;

  // Call the callback whenever unread count changes
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Filter Tabs */}
      <View className="bg-white border-b border-gray-200 pt-12">
        <View className="flex-row px-4 py-2">
          <TouchableOpacity className="bg-fire px-4 py-2 rounded-lg mr-2">
            <Text className="text-white font-medium">All</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg">
            <Text className="text-gray-700 font-medium">System</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Loading notifications...</Text>
        </View>
      ) : (
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
            const icon = getNotificationIcon(notification.type, notification.title);
            const priorityColor = getPriorityColor(notification.priority);
            const isNearbyIncident = notification.type === 'emergency' || notification.type === 'fire_alert';
            const isOwnReport = notification.title && (
              notification.title.includes('Acknowledged') ||
              notification.title.includes('Resolved') ||
              notification.title.includes('Alarm Level')
            );
            
            return (
              <TouchableOpacity
                key={notification.id}
                className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
                  notification.read ? 'opacity-75' : ''
                }`}
                style={{ 
                  borderLeftColor: priorityColor,
                  borderLeftWidth: 4,
                }}
                onPress={() => {
                  markAsRead(notification.id);
                  
                  // If notification has a related report ID, navigate to map and focus on it
                  if (notification.related_report_id && setActiveTab && setReportIdToFocus) {
                    setReportIdToFocus(notification.related_report_id);
                    setActiveTab(2); // Switch to Map tab (index 2)
                  }
                }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-start">
                  {/* Icon with special styling for nearby incidents and own reports */}
                  <View 
                    className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${
                      (isNearbyIncident || isOwnReport) && !notification.read ? 'ring-2' : ''
                    }`}
                    style={{ 
                      backgroundColor: icon.bg,
                      borderWidth: isOwnReport && !notification.read ? 2 : 0,
                      borderColor: isOwnReport ? icon.color : 'transparent',
                      shadowColor: isOwnReport ? icon.color : 'transparent',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isOwnReport ? 0.3 : 0,
                      shadowRadius: 4,
                      elevation: isOwnReport ? 4 : 0,
                    }}
                  >
                    <MaterialIcons name={icon.name} size={24} color={icon.color} />
                  </View>

                  {/* Content */}
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-1">
                        <Text className="font-bold text-gray-800 text-base" numberOfLines={2}>
                          {notification.title}
                        </Text>
                        {isNearbyIncident && (
                          <View className="flex-row items-center mt-1">
                            <MaterialIcons name="location-on" size={14} color="#ef4444" />
                            <Text className="text-red-600 text-xs font-semibold ml-1">
                              Nearby Incident
                            </Text>
                          </View>
                        )}
                        {isOwnReport && (
                          <View className="flex-row items-center mt-1">
                            {notification.title.includes('Acknowledged') && (
                              <>
                                <MaterialIcons name="check-circle" size={14} color="#10b981" />
                                <Text className="text-green-600 text-xs font-semibold ml-1">
                                  Your Report
                                </Text>
                              </>
                            )}
                            {notification.title.includes('Resolved') && (
                              <>
                                <MaterialIcons name="check-circle" size={14} color="#10b981" />
                                <Text className="text-green-600 text-xs font-semibold ml-1">
                                  Resolved
                                </Text>
                              </>
                            )}
                            {notification.title.includes('Alarm Level') && (
                              <>
                                <MaterialIcons name="warning" size={14} color="#f59e0b" />
                                <Text className="text-amber-600 text-xs font-semibold ml-1">
                                  Status Update
                                </Text>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                      {!notification.read && (
                        <View className="w-2 h-2 bg-fire rounded-full ml-2" />
                      )}
                    </View>
                    
                    <Text className="text-gray-600 text-sm mb-2 leading-5">
                      {notification.message}
                    </Text>
                    
                    <View className="flex-row items-center justify-between">
                      <Text className="text-gray-400 text-xs">
                        {notification.time}
                      </Text>
                      <View className="flex-row items-center">
                        {(notification.priority === 'high' || notification.priority === 'urgent') && (
                          <View className={`px-2 py-1 rounded mr-2 ${
                            notification.priority === 'urgent' 
                              ? 'bg-red-200' 
                              : 'bg-red-100'
                          }`}>
                            <Text className={`text-xs font-medium ${
                              notification.priority === 'urgent'
                                ? 'text-red-800'
                                : 'text-red-600'
                            }`}>
                              {notification.priority === 'urgent' ? 'URGENT' : 'HIGH'}
                            </Text>
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
      )}

      {/* Empty State */}
      {notifications.length === 0 && (
        <View className="flex-1 items-center justify-center px-8">
          <MaterialIcons name="notifications-off" size={64} color="#9ca3af" />
          <Text className="text-xl font-bold text-gray-600 mt-4 mb-2">
            No Notifications
          </Text>
          <Text className="text-gray-500 text-center">
            You're all caught up! We'll notify you when there are important updates.
          </Text>
        </View>
      )}
    </View>
  );
};

export default CNotifications;

export const options = {
  headerShown: false,
};
