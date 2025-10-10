import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Vibration, AppState } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';
import { Audio } from 'expo-av';

export default function ANotifications({ onUnreadCountChange }) {
  // Static module reference so Metro can bundle the asset reliably
  const SIREN_MODULE = require('../../../../assets/sounds/fire_alarm_sound.mp3');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAdminId, setCurrentAdminId] = useState(null);
  const sirenRef = useRef(null);
  const hasActiveAlertRef = useRef(false);
  const [lastFireReportCount, setLastFireReportCount] = useState(0);
  const isInitializedRef = useRef(false);
  const isAlertingRef = useRef(false);
  const processedReportIdsRef = useRef(new Set());
  const processedNotificationIdsRef = useRef(new Set());
  const appState = useRef(AppState.currentState);

  // Preload siren sound
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        console.log('📱 Setting up audio mode for iOS...');
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false
        });
        console.log('📱 Audio mode configured successfully');
        
        console.log('📱 Loading fire alarm sound...');
        const { sound } = await Audio.Sound.createAsync(
          SIREN_MODULE,
          { shouldPlay: false, volume: 1.0, isLooping: true }
        );
        
        if (isMounted) {
          sirenRef.current = sound;
          console.log('📱 Fire alarm sound loaded successfully');
        }
      } catch (e) {
        console.error('📱 Error loading fire alarm sound:', e);
      }
    })();
    return () => {
      isMounted = false;
      if (sirenRef.current) {
        sirenRef.current.unloadAsync().catch(()=>{});
        sirenRef.current = null;
      }
    };
  }, []);

  const playAlert = async () => {
    try {
      console.log('📱 🔊 Attempting to play fire alarm...');
      
      if (!sirenRef.current) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            SIREN_MODULE,
            { shouldPlay: false, volume: 1.0, isLooping: true }
          );
          sirenRef.current = sound;
          console.log('📱 🔊 Created sound instance in playAlert');
        } catch (createErr) {
          console.error('📱 ❌ Failed to create sound in playAlert:', createErr);
        }
      }
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        console.log('📱 Sound status:', status);
        
        if (status.isPlaying) {
          console.log('📱 Sound already playing, stopping first...');
          await sirenRef.current.stopAsync();
        }
        
        await sirenRef.current.setIsLoopingAsync(true);
        await sirenRef.current.setVolumeAsync(1.0);
        await sirenRef.current.playAsync();
        console.log('📱 🔊 Fire alarm playing!');
        
        // Vibrate with alert pattern
        const pattern = [0, 1000, 500, 1000, 500, 1000];
        Vibration.vibrate(pattern, true); // true = repeat
        console.log('📱 📳 Vibration started');
      } else {
        console.error('📱 Sound ref is null, attempting to create new sound...');
        // Fallback: try to create and play sound directly
        try {
          const { sound } = await Audio.Sound.createAsync(
            SIREN_MODULE,
            { shouldPlay: false, volume: 1.0, isLooping: true }
          );
          sirenRef.current = sound;
          await sound.playAsync();
          Vibration.vibrate([0, 1000, 500, 1000, 500, 1000], true);
          console.log('📱 🔊 Fallback sound created and playing');
        } catch (fallbackErr) {
          console.error('📱 ❌ Fallback sound creation failed:', fallbackErr);
        }
      }
    } catch (error) {
      console.error('📱 Error playing alert:', error);
    }
  };

  const stopAlert = async () => {
    try {
      console.log('📱 🔇 Stopping fire alarm...');
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        if (status.isPlaying) {
          await sirenRef.current.stopAsync();
          console.log('📱 🔇 Fire alarm stopped');
        }
      }
      Vibration.cancel();
      console.log('📱 Vibration cancelled');
    } catch (error) {
      console.error('📱 Error stopping alert:', error);
    }
  };

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

  // Check for new fire reports (same as web version)
  const checkForNewFireReports = async () => {
    try {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`📱 🔥 [${timestamp}] Checking Fire Detection API...`);
      
      if (!currentAdminId) {
        console.log('📱 No currentAdminId, skipping check');
        return;
      }
      
      const response = await fetch('https://fire-detection-api-production-f8a3.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        console.log('📱 🔥 API returned:', data.length, 'reports');
        
        const activeReports = data.filter(report => {
          const hasCoords = report.latitude && report.longitude && !isNaN(report.latitude) && !isNaN(report.longitude);
          const statusText = (report.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          return hasCoords && !isCancelled && !isFireOut;
        });
        
        console.log('📱 🔥 Active reports:', activeReports.length);
        
        if (isInitializedRef.current) {
          const newReports = activeReports.filter(report => 
            !processedReportIdsRef.current.has(report.id)
          );
          
          if (newReports.length > 0) {
            console.log('📱 🔥 NEW FIRE REPORTS DETECTED!', newReports.length);
            console.log('📱 🔥 New report IDs:', newReports.map(r => r.id));
            
            setLastFireReportCount(activeReports.length);
            
            if (!isAlertingRef.current) {
              console.log('📱 🔊 Playing alert for new fire reports...');
              await playAlert();
              
              isAlertingRef.current = true;
              setTimeout(() => {
                isAlertingRef.current = false;
                console.log('📱 Alert cooldown finished');
              }, 2000);
            }
            
            // Mark as processed
            newReports.forEach(report => {
              processedReportIdsRef.current.add(report.id);
            });
            
            // Reload notifications
            setTimeout(() => {
              loadNotifications();
            }, 500);
          }
        } else {
          console.log('📱 🔥 Initializing fire report tracking...');
          isInitializedRef.current = true;
          setLastFireReportCount(activeReports.length);
          
          activeReports.forEach(report => {
            processedReportIdsRef.current.add(report.id);
          });
          console.log('📱 🔥 Initialized with', activeReports.length, 'reports');
        }
      }
    } catch (error) {
      console.error('📱 Error checking fire reports:', error);
    }
  };

  useEffect(() => {
    if (currentAdminId) {
      console.log('📱 Admin ID available, starting notification system');
      loadNotifications();
      
      // Initial fire report check
      checkForNewFireReports();
      
      // Fast polling for fire reports (1 second)
      const fireReportInterval = setInterval(() => {
        checkForNewFireReports();
      }, 1000);
      
      // Poll notifications every 2 seconds
      const notificationInterval = setInterval(() => {
        loadNotifications();
      }, 2000);
      
      console.log('📱 Polling intervals started');
      
      return () => {
        clearInterval(fireReportInterval);
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

      const list = data || [];
      
      // Check for new unread fire alerts
      const newFireAlerts = list.filter(notification => 
        notification.type === 'fire_alert' && 
        !notification.is_read &&
        !processedNotificationIdsRef.current.has(notification.id)
      );
      
      if (newFireAlerts.length > 0) {
        console.log('📱 🔥 Found new unread fire alerts:', newFireAlerts.length);
        
        newFireAlerts.forEach(notification => {
          processedNotificationIdsRef.current.add(notification.id);
        });
        
        if (!isAlertingRef.current) {
          console.log('📱 🔊 Playing alarm for new notification(s)');
          await playAlert();
          
          isAlertingRef.current = true;
          setTimeout(() => {
            isAlertingRef.current = false;
          }, 2000);
        }
      }
      
      setNotifications(list);
      
      // Do not auto-stop here; stop only on explicit mark-as-read or realtime update
    } catch (err) {
      console.error('📱 Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription (simplified, no filter)
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
          
          // Don't play sound here - it's already played by API polling
          if (payload?.new?.type === 'fire_alert') {
            console.log('📱 Fire alert received (sound played by API polling)');
          }
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
          
          // If fire alert marked as read, stop alarm
          if (payload.new?.is_read && payload.new?.type === 'fire_alert') {
            stopAlert();
          }
        }
      })
      .subscribe((status) => {
        console.log('📱 Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentAdminId]);

  // Handle app state changes (pause polling when app is in background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App has come to foreground, reloading...');
        if (currentAdminId) {
          loadNotifications();
          checkForNewFireReports();
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
      
      // Stop alarm when marking fire alert as read
      const notification = notifications.find(n => n.id === id);
      if (notification?.type === 'fire_alert') {
        await stopAlert();
      }
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