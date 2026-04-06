import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';
import { registerForPushNotificationsAsync, sendPushNotification, setBadgeCount } from '../../../services/pushNotificationService';

const CNotifications = ({ onUnreadCountChange, setActiveTab, setReportIdToFocus }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [submittedReport, setSubmittedReport] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'myReports', 'nearby'

  // Get current user ID from AsyncStorage (custom auth system)
  useEffect(() => {
    const getUser = async () => {
      try {
        console.log('🔐 Getting current user from AsyncStorage...');
        
        // Get user data from AsyncStorage
        const userDataString = await AsyncStorage.getItem('userData');
        const userType = await AsyncStorage.getItem('userType');
        
        if (!userDataString || userType !== 'citizen') {
          console.warn('⚠️ No citizen user data found in AsyncStorage');
          console.log('UserType:', userType);
          setLoading(false);
          return;
        }
        
        const userData = JSON.parse(userDataString);
        console.log('👤 User data from storage:', userData);
        
        // Get user ID - could be in different fields
        const userId = userData.id || userData.uid || userData.user_id;
        
        if (userId) {
          console.log('✅ Current user ID:', userId);
          console.log('📧 User email:', userData.email);
          setCurrentUserId(userId);
          
          // Register for push notifications
          await registerForPushNotificationsAsync();
        } else {
          console.warn('⚠️ No user ID found in userData:', userData);
          setLoading(false);
        }
      } catch (error) {
        console.error('💥 Exception getting user:', error);
        setLoading(false);
      }
    };
    getUser();
  }, []);

  // Load notifications from Supabase
  const loadNotifications = async () => {
    if (!currentUserId) {
      console.log('⚠️ No current user ID, skipping notification load');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('📱 Loading citizen notifications for user:', currentUserId);
      console.log('🔍 Query parameters - user_id:', currentUserId, 'user_type: citizen');

      // First, check if ANY notifications exist in the table
      const { data: allNotifs, error: countError } = await supabase
        .from('notifications')
        .select('id, user_id, user_type')
        .limit(5);
      
      console.log('📊 Sample notifications in table:', allNotifs?.length || 0);
      if (allNotifs && allNotifs.length > 0) {
        console.log('🔍 Sample from table:', JSON.stringify(allNotifs, null, 2));
      }

      // Query for citizen notifications (nearby incidents, status changes, etc.)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('user_type', 'citizen')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching notifications:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        setNotifications([]);
        return;
      }

      console.log('📊 Raw notifications data:', data);
      console.log(`📊 Found ${data?.length || 0} notifications for citizen user ${currentUserId}`);
      
      if (data && data.length > 0) {
        console.log('🔍 First notification:', JSON.stringify(data[0], null, 2));
        console.log('🔍 Notification types:', data.map(n => n.type).join(', '));
      } else {
        console.warn('⚠️ No notifications found for this user');
        console.warn('⚠️ Make sure:');
        console.warn('   1. Notifications exist in the database');
        console.warn('   2. user_id matches:', currentUserId);
        console.warn('   3. user_type is "citizen"');
      }

      // Transform Supabase notifications to match component format
      const formattedNotifications = (data || []).map(notif => {
        // Determine display type - keep original types for proper icon display
        // fire_alert -> shows as emergency (nearby fires)
        // user_action -> shows status changes (acknowledgment, fire out, etc.)
        let displayType = notif.type;
        if (notif.type === 'fire_alert' || notif.type === 'emergency') {
          displayType = 'emergency';
        }
        // user_action type is already correct for status change notifications

        return {
          id: notif.id,
          type: displayType,
          title: notif.title,
          message: notif.message,
          time: formatTimeAgo(notif.created_at),
          read: notif.is_read || false,
          priority: notif.priority || 'normal',
          related_report_id: notif.related_report_id,
          created_at: notif.created_at,
          is_read: notif.is_read || false // Keep both for compatibility
        };
      });

      console.log(`✅ Formatted ${formattedNotifications.length} notifications`);
      if (formattedNotifications.length > 0) {
        console.log('📋 First formatted notification:', JSON.stringify(formattedNotifications[0], null, 2));
      }
      
      setNotifications(formattedNotifications);
      
      // Update badge count
      const unreadCount = formattedNotifications.filter(n => !n.read).length;
      await setBadgeCount(unreadCount);
    } catch (error) {
      console.error('💥 Exception loading notifications:', error);
      setNotifications([]);
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

  // Load user's most recent submitted report
  const loadSubmittedReport = async () => {
    if (!currentUserId) return;

    try {
      const response = await fetch('https://new-fira-backend.onrender.com/get_reports', {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const allReports = await response.json();
        // Find user's most recent submitted report (not cancelled)
        const userReports = allReports
          .filter(report => {
            const reporterId = report.reporterId || report.user_id;
            return reporterId === currentUserId;
          })
          .filter(report => {
            const statusText = (report.status || report.progress || '').toString().toLowerCase();
            return !statusText.includes('cancelled') && !statusText.includes('canceled');
          })
          .sort((a, b) => {
            const dateA = new Date(a.created_at || a.timestamp || 0);
            const dateB = new Date(b.created_at || b.timestamp || 0);
            return dateB - dateA; // Most recent first
          });

        if (userReports.length > 0) {
          const mostRecent = userReports[0];
          // Only show if report has confidence data and was created recently (within last 24 hours)
          const reportDate = new Date(mostRecent.created_at || mostRecent.timestamp);
          const hoursSinceCreation = (new Date().getTime() - reportDate.getTime()) / (1000 * 60 * 60);
          
          if (mostRecent.confidence && hoursSinceCreation < 24) {
            setSubmittedReport(mostRecent);
          } else {
            setSubmittedReport(null);
          }
        } else {
          setSubmittedReport(null);
        }
      }
    } catch (error) {
      console.error('Error loading submitted report:', error);
      setSubmittedReport(null);
    }
  };

  // Load notifications when user ID is available
  useEffect(() => {
    if (currentUserId) {
      loadNotifications();
      loadSubmittedReport();
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
      }, async (payload) => {
        console.log('📱 New notification received:', payload.new);
        const newNotification = payload.new;
        
        // Send push notification (skip for nearby incidents as they're handled by the service)
        // Nearby incidents are handled directly in citizenNotificationService.js
        if (newNotification.type !== 'fire_alert' || !newNotification.title?.includes('Nearby')) {
          await sendPushNotification(
            newNotification.title || 'New Notification',
            newNotification.message || 'You have a new notification',
            {
              type: newNotification.type,
              notificationId: newNotification.id,
              reportId: newNotification.related_report_id,
              priority: newNotification.priority,
            }
          );
        } else {
          console.log('ℹ️ Skipping push notification for nearby incident (already sent by service)');
        }
        
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

  // Filter notifications based on active filter
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') {
      return notifications;
    } else if (activeFilter === 'myReports') {
      // Filter for notifications about user's own reports
      return notifications.filter(notif => {
        const title = notif.title || '';
        return (
          notif.type === 'user_action' ||
          title.includes('Acknowledged') ||
          title.includes('Resolved') ||
          title.includes('Alarm Level') ||
          title.includes('Status Changed') ||
          title.includes('invalidated')
        );
      });
    } else if (activeFilter === 'nearby') {
      // Filter for nearby fire incidents
      return notifications.filter(notif => {
        return (
          notif.type === 'emergency' ||
          notif.type === 'fire_alert' ||
          (notif.title && notif.title.includes('Nearby'))
        );
      });
    }
    return notifications;
  }, [notifications, activeFilter]);

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
          <TouchableOpacity 
            onPress={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-lg mr-2 ${
              activeFilter === 'all' ? 'bg-fire' : 'bg-gray-200'
            }`}
          >
            <Text className={`font-medium ${
              activeFilter === 'all' ? 'text-white' : 'text-gray-700'
            }`}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveFilter('myReports')}
            className={`px-4 py-2 rounded-lg mr-2 ${
              activeFilter === 'myReports' ? 'bg-fire' : 'bg-gray-200'
            }`}
          >
            <Text className={`font-medium ${
              activeFilter === 'myReports' ? 'text-white' : 'text-gray-700'
            }`}>
              My Reports
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveFilter('nearby')}
            className={`px-4 py-2 rounded-lg ${
              activeFilter === 'nearby' ? 'bg-fire' : 'bg-gray-200'
            }`}
          >
            <Text className={`font-medium ${
              activeFilter === 'nearby' ? 'text-white' : 'text-gray-700'
            }`}>
              Nearby
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Loading notifications...</Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <MaterialIcons name="notifications-off" size={64} color="#9ca3af" />
          <Text className="text-xl font-bold text-gray-600 mt-4 mb-2">
            {activeFilter === 'all' ? 'No Notifications' : 
             activeFilter === 'myReports' ? 'No Report Updates' :
             'No Nearby Incidents'}
          </Text>
          <Text className="text-gray-500 text-center">
            {activeFilter === 'all' ? "You're all caught up! We'll notify you when there are important updates." :
             activeFilter === 'myReports' ? "You don't have any updates about your reports yet." :
             "There are no nearby fire incidents at the moment."}
          </Text>
        </View>
      ) : (
        <ScrollView 
          className="flex-1 px-4 pt-4"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadNotifications();
                await loadSubmittedReport();
                setRefreshing(false);
              }}
              colors={['#ff512f']}
              tintColor="#ff512f"
            />
          }
        >
          {/* Special "Report Submitted" Notification Card */}
          {submittedReport && (
            <TouchableOpacity
              className="rounded-2xl mb-4"
              style={{
                shadowColor: '#ff512f',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
                borderWidth: 2,
                borderColor: '#ff6b35',
                overflow: 'hidden',
              }}
              onPress={() => {
                // Redirect to Map and focus on the report
                if (setActiveTab && setReportIdToFocus && submittedReport.id) {
                  setReportIdToFocus(submittedReport.id);
                  setActiveTab(1); // Switch to Map tab (index 1 in CitizenScreen)
                }
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#ff6b35', '#ff512f', '#dc2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  padding: 20,
                  borderRadius: 16,
                }}
              >
                <View className="flex-row items-start">
                  <View 
                    className="rounded-full items-center justify-center mr-4"
                    style={{
                      width: 56,
                      height: 56,
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 5,
                    }}
                  >
                    <MaterialIcons name="check-circle" size={32} color="#ffffff" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-start mb-2 flex-wrap">
                      <Text className="text-white text-lg font-bold mr-2 flex-1" style={{ flexShrink: 1 }}>
                        Your report has been submitted!
                      </Text>
                      <View 
                        className="px-2 py-1 rounded-full"
                        style={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.25)',
                          marginTop: 2,
                        }}
                      >
                        <Text className="text-white text-xs font-bold">NEW</Text>
                      </View>
                    </View>
                    <Text 
                      className="text-sm leading-5 mb-3"
                      style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                    >
                      AI has analyzed your report to have {submittedReport.confidence || 'N/A'}% fire confidence
                    </Text>
                    <View className="flex-row items-center">
                      <MaterialIcons name="place" size={16} color="rgba(255, 255, 255, 0.9)" />
                      <Text 
                        className="text-xs ml-1 flex-1" 
                        numberOfLines={1}
                        style={{ color: 'rgba(255, 255, 255, 0.8)' }}
                      >
                        {submittedReport.resolved_address || submittedReport.address || 'Location selected'}
                      </Text>
                      <MaterialIcons name="arrow-forward" size={18} color="rgba(255, 255, 255, 0.9)" />
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {filteredNotifications.map((notification) => {
            const icon = getNotificationIcon(notification.type, notification.title);
            const priorityColor = getPriorityColor(notification.priority);
            const isNearbyIncident = notification.type === 'emergency' || notification.type === 'fire_alert';
            const isOwnReport = notification.title && (
              notification.title.includes('Acknowledged') ||
              notification.title.includes('Resolved') ||
              notification.title.includes('Alarm Level')
            );
            
            // Special styling for acknowledgment notifications
            const isAcknowledged = notification.title && notification.title.includes('Acknowledged');
            
            return (
              <TouchableOpacity
                key={notification.id}
                className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
                  notification.read ? 'opacity-75' : ''
                } ${isAcknowledged && !notification.read ? 'shadow-lg' : ''}`}
                style={{ 
                  borderLeftColor: priorityColor,
                  borderLeftWidth: 4,
                  backgroundColor: isAcknowledged && !notification.read ? '#ecfdf5' : '#ffffff',
                  borderWidth: isAcknowledged && !notification.read ? 2 : 0,
                  borderColor: isAcknowledged && !notification.read ? '#10b981' : 'transparent',
                }}
                onPress={() => {
                  markAsRead(notification.id);
                  
                  // If notification has a related report ID, navigate to MAP tab and focus on it
                  // Map tab index is 1 in CitizenScreen (Notifications, Map, Status, Chat, Profile)
                  if (notification.related_report_id && setActiveTab && setReportIdToFocus) {
                    setReportIdToFocus(notification.related_report_id);
                    setActiveTab(1); // Jump to Map
                  }
                }}
                activeOpacity={0.7}
              >
                {/* Special banner for acknowledgment notifications */}
                {isAcknowledged && !notification.read && (
                  <View className="absolute top-0 right-0 bg-green-500 px-3 py-1 rounded-bl-lg rounded-tr-xl">
                    <Text className="text-white text-xs font-bold">✨ NEW</Text>
                  </View>
                )}
                
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
                        <Text 
                          className={`font-bold text-base ${
                            isAcknowledged && !notification.read ? 'text-green-800' : 'text-gray-800'
                          }`} 
                          numberOfLines={2}
                        >
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
                                <Text className="text-green-600 text-xs font-bold ml-1">
                                  🎉 Your Report Acknowledged!
                                </Text>
                              </>
                            )}
                            {notification.title.includes('Resolved') && (
                              <>
                                <MaterialIcons name="check-circle" size={14} color="#10b981" />
                                <Text className="text-green-600 text-xs font-semibold ml-1">
                                  ✅ Resolved
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
                    
                    <Text 
                      className={`text-sm mb-2 leading-5 ${
                        isAcknowledged && !notification.read ? 'text-green-700' : 'text-gray-600'
                      }`}
                    >
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
    </View>
  );
};

export default CNotifications;

export const options = {
  headerShown: false,
};
