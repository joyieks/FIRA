import { View, Text, ScrollView, TouchableOpacity, RefreshControl, AppState, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';
import * as Location from 'expo-location';
import { scheduleLocalNotification } from '../../../services/pushNotificationService';

export default function RNotifications({ onUnreadCountChange, onNavigateToMap }) {

 
  const [loading, setLoading] = useState(true);
  const [currentResponderId, setCurrentResponderId] = useState(null);
  const appState = useRef(AppState.currentState);

  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const notifiedNearbyIdsRef = useRef(new Set());

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
          
          // Try multiple ID fields to match responder_id in database
          let resolvedId = userData?.id || userData?.uid || userData?.responder_id;
          console.log('📱 Responder: Initial resolved ID:', resolvedId);
          console.log('📱 Responder: All available userData fields:', Object.keys(userData));
          
          // If we have an ID, verify it exists in responders table
          if (resolvedId) {
            try {
              const { data: responderData, error: responderError } = await supabase
                .from('responders')
                .select('id, first_name, last_name, email')
                .eq('id', resolvedId)
                .single();
              
              if (responderError || !responderData) {
                console.log('⚠️ Responder ID not found in responders table, trying to find by email...');
                // Try to find by email if ID doesn't match
                if (userData?.email) {
                  const { data: responderByEmail } = await supabase
                    .from('responders')
                    .select('id, first_name, last_name, email')
                    .eq('email', userData.email)
                    .single();
                  
                  if (responderByEmail) {
                    resolvedId = responderByEmail.id;
                    console.log('✅ Found responder by email, using ID:', resolvedId);
                  }
                }
              } else {
                console.log('✅ Responder ID verified in database:', responderData);
              }
            } catch (verifyError) {
              console.error('❌ Error verifying responder ID:', verifyError);
            }
          }
          
          if (resolvedId) {
            setCurrentResponderId(resolvedId);
            console.log('✅ Responder ID set:', resolvedId);
          } else {
            console.error('❌ No responder ID found in userData');
            // Try to get from Supabase Auth as fallback
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user?.id) {
                console.log('📱 Using Supabase Auth user ID:', user.id);
                // Try to find responder by user_id
                const { data: responderByUserId } = await supabase
                  .from('responders')
                  .select('id')
                  .eq('user_id', user.id)
                  .single();
                
                if (responderByUserId) {
                  setCurrentResponderId(responderByUserId.id);
                  console.log('✅ Found responder by user_id, using ID:', responderByUserId.id);
                } else {
                  setCurrentResponderId(user.id);
                }
              }
            } catch (authError) {
              console.error('❌ Error getting Supabase Auth user:', authError);
            }
          }
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
      startNearbyWatcher();
      
      // Poll notifications every 2 seconds
      const notificationInterval = setInterval(() => {
        loadNotifications();
      }, 2000);
      
      return () => {
        clearInterval(notificationInterval);
        stopNearbyWatcher();
      };
    }
  }, [currentResponderId, userLocation]);

  const loadNotifications = async () => {
    if (!currentResponderId) {
      console.log('⚠️ No responder ID available, cannot load notifications');
      return;
    }
    
    try {
      setLoading(true);
      console.log('📱 Loading notifications for responder_id:', currentResponderId);
      console.log('📱 Responder ID type:', typeof currentResponderId);
      
      // First, let's verify the responder exists
      const { data: responderCheck, error: responderCheckError } = await supabase
        .from('responders')
        .select('id, first_name, last_name, email')
        .eq('id', currentResponderId)
        .single();
      
      if (responderCheckError || !responderCheck) {
        console.error('❌ Responder not found with ID:', currentResponderId);
        console.error('❌ Error:', responderCheckError);
        // Try to find all responders to see what IDs exist
        const { data: allResponders } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email')
          .limit(5);
        console.log('📋 Sample responder IDs in database:', allResponders?.map(r => r.id));
      } else {
        console.log('✅ Responder verified:', responderCheck);
      }
      
      // Now query notifications
      const { data, error } = await supabase
        .from('responder_notifications')
        .select('*')
        .eq('responder_id', currentResponderId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('📱 Responder: Error fetching notifications:', error);
        console.error('📱 Responder: Error details:', JSON.stringify(error, null, 2));
        // Try querying all notifications to see if any exist
        const { data: allNotifs } = await supabase
          .from('responder_notifications')
          .select('id, responder_id, title, created_at')
          .limit(10)
          .order('created_at', { ascending: false });
        console.log('📋 Sample notifications in database (any responder):', allNotifs);
        return;
      }

      console.log(`✅ Loaded ${data?.length || 0} notifications for responder ${currentResponderId}`);
      if (data && data.length > 0) {
        console.log('📱 Sample notification:', {
          id: data[0].id,
          title: data[0].title,
          responder_id: data[0].responder_id,
          responder_id_type: typeof data[0].responder_id,
          current_responder_id: currentResponderId,
          current_responder_id_type: typeof currentResponderId,
          ids_match: String(data[0].responder_id) === String(currentResponderId),
          created_at: data[0].created_at
        });
      } else {
        console.log('⚠️ No notifications found. Checking if any notifications exist in database...');
        const { data: anyNotifs } = await supabase
          .from('responder_notifications')
          .select('id, responder_id, title, created_at')
          .limit(5)
          .order('created_at', { ascending: false });
        console.log('📋 Any notifications in database:', anyNotifs);
        if (anyNotifs && anyNotifs.length > 0) {
          console.log('⚠️ Notifications exist but responder_id mismatch!');
          console.log('⚠️ Looking for:', currentResponderId, typeof currentResponderId);
          console.log('⚠️ Found responder_ids:', anyNotifs.map(n => ({ id: n.responder_id, type: typeof n.responder_id })));
        }
      }
      
      setNotifications(data || []);
    } catch (err) {
      console.error('📱 Responder: Error loading notifications:', err);
      console.error('📱 Responder: Error stack:', err.stack);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPress = async (notification) => {
    await markAsRead(notification.id);
    if (onNavigateToMap && notification.fire_report_id) {
      onNavigateToMap({
        fireReportId: notification.fire_report_id,
        focusOnly: true
      });
    }
  };

  // Nearby reports polling
  const nearbyIntervalRef = useRef(null);

  const stopNearbyWatcher = () => {
    if (nearbyIntervalRef.current) {
      clearInterval(nearbyIntervalRef.current);
      nearbyIntervalRef.current = null;
    }
  };

  const startNearbyWatcher = () => {
    stopNearbyWatcher();
    // Require both responder and location
    if (!currentResponderId || !userLocation) return;
    fetchNearbyReports(); // initial
    nearbyIntervalRef.current = setInterval(fetchNearbyReports, 30000); // every 30s
  };

  // Get location once
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('⚠️ Location permission not granted for nearby notifications');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, maximumAge: 10000 });
        setUserLocation(loc);
      } catch (err) {
        console.error('❌ Error getting location for nearby notifications:', err);
      }
    })();
  }, []);

  // Fetch nearby reports and create notifications
  const fetchNearbyReports = async () => {
    if (!userLocation || !currentResponderId) return;
    try {
      const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
      if (!response.ok) return;
      const allReports = await response.json();

      const isNoFireNoSmoke = (report) => {
        const pred = (report?.prediction || '').toLowerCase();
        const smoke = (report?.smoke_detection || report?.smokeDetection || '').toLowerCase();
        return pred.includes('no fire') && smoke.includes('no smoke');
      };

      const toKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const nearby = (allReports || []).filter(report => {
        if (isNoFireNoSmoke(report)) return false;
        const latNum = parseFloat(report.latitude);
        const lngNum = parseFloat(report.longitude);
        if (isNaN(latNum) || isNaN(lngNum)) return false;
        const distKm = toKm(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          latNum,
          lngNum
        );
        return distKm <= 10; // within 10km
      });

      for (const report of nearby) {
        const key = String(report.id);
        if (notifiedNearbyIdsRef.current.has(key)) continue;

        // Insert responder notification
        const readableId = `FR-${key.substring(0, 8).toUpperCase()}`;
        const title = `📍 Nearby Fire Report (${readableId})`;
        const message = `${report.address || report.geotag_location || 'Unknown location'} is within 10km. Tap to view on map.`;

        const { error } = await supabase
          .from('responder_notifications')
          .insert({
            responder_id: currentResponderId,
            fire_report_id: key,
            title,
            message,
            priority: 'high',
            status: 'nearby',
            is_read: false
          });
        if (error) {
          console.error('❌ Error inserting nearby notification:', error);
          continue;
        }

        // Push notification
        try {
          await scheduleLocalNotification(
            title,
            message,
            {
              type: 'nearby_report',
              notificationId: `nearby-${key}`,
              fireReportId: key,
              priority: 'high'
            }
          );
        } catch (pushErr) {
          console.error('❌ Error scheduling nearby push notification:', pushErr);
        }

        notifiedNearbyIdsRef.current.add(key);
      }
    } catch (err) {
      console.error('❌ Error fetching nearby reports for notifications:', err);
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
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadNotifications();
    } catch (error) {
      console.error('📱 Responder: Error refreshing notifications:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Debug: Show current responder ID and notification count
  useEffect(() => {
    if (currentResponderId) {
      console.log('📊 DEBUG: Current responder ID:', currentResponderId);
      console.log('📊 DEBUG: Notification count:', notifications.length);
      console.log('📊 DEBUG: Unread count:', unreadCount);
    }
  }, [currentResponderId, notifications.length, unreadCount]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-16 pb-4 px-4 border-b border-gray-200">
        <View className="flex-row items-center justify-center">
          <Text className="text-fire font-bold text-lg">Notification</Text>
          {currentResponderId && (
            <Text className="text-xs text-gray-500 ml-2">
              ({notifications.length} notifications)
            </Text>
          )}
        </View>
        {/* Debug Info - Remove in production */}
        {__DEV__ && currentResponderId && (
          <Text className="text-xs text-gray-400 text-center mt-1">
            Responder ID: {currentResponderId.substring(0, 8)}...
          </Text>
        )}
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
              onPress={() => handleNotificationPress(notification)}
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
                  
                  {/* Fire Report ID Badge (if available) */}
                  {notification.fire_report_id && (
                    <View className="bg-orange-100 px-2 py-1 rounded mb-2 self-start">
                      <Text className="text-orange-700 text-xs font-bold">
                        🔥 Report ID: {notification.fire_report_id.substring(0, 8).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  
                  <Text className="text-gray-600 text-sm mb-2 leading-5">
                    {notification.message}
                  </Text>
                  
                  {/* Assignment Status Badge */}
                  {notification.status && (
                    <View className={`px-2 py-1 rounded mb-2 self-start ${
                      notification.status === 'pending' ? 'bg-yellow-100' :
                      notification.status === 'accepted' ? 'bg-green-100' :
                      notification.status === 'declined' ? 'bg-red-100' :
                      'bg-gray-100'
                    }`}>
                      <Text className={`text-xs font-medium ${
                        notification.status === 'pending' ? 'text-yellow-700' :
                        notification.status === 'accepted' ? 'text-green-700' :
                        notification.status === 'declined' ? 'text-red-700' :
                        'text-gray-700'
                      }`}>
                        Status: {notification.status.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-400 text-xs">
                      {formatDate(notification.created_at)}
                    </Text>
                    <View className="flex-row items-center">
                      {!notification.is_read && (
                        <TouchableOpacity
                          onPress={() => handleNotificationPress(notification)}
                          className="mr-2"
                        >
                          <MaterialIcons name="check-circle" size={20} color="#10b981" />
                        </TouchableOpacity>
                      )}
                      {notification.priority === 'urgent' && (
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
      {notifications.length === 0 && !loading && (
        <View className="flex-1 items-center justify-center px-8">
          <MaterialIcons name="notifications-off" size={64} color="#9ca3af" />
          <Text className="text-xl font-bold text-gray-600 mt-4 mb-2">
            No Notifications
          </Text>
          <Text className="text-gray-500 text-center mb-4">
            Stay alert! We&apos;ll notify you when emergency calls come in.
          </Text>
        </View>
      )}

      {/* Loading State */}
      {loading && notifications.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ff512f" />
          <Text className="text-gray-500 mt-4">Loading notifications...</Text>
        </View>
      )}
    </View>
  );
}
