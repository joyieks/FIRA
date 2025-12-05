import React, { useEffect, useRef, useState } from 'react';
import { Vibration, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../../config/supabase';

// Headless background worker for station alerts (no UI)
export default function SAlertsWorker() {
  const sirenRef = useRef(null);
  const sirenReadyRef = useRef(false);
  const [stationId, setStationId] = useState(null);
  const isAlertingRef = useRef(false);
  const shouldBePlayingRef = useRef(false); // Track if alarm should be playing
  const processedNotificationIdsRef = useRef(new Set());
  const appState = useRef(AppState.currentState);
  const soundWatchdogRef = useRef(null);

  const SIREN_MODULE = require('../../../../assets/sounds/fire_alarm_sound.mp3');

  // Configure notification handler on mount
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Set notification handler to show notifications even when app is in foreground
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        // Request notification permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.warn('⚠️ Push notification permissions not granted');
          return;
        }
        
        console.log('✅ Push notification permissions granted');

        // Set up notification channel for Android - use 'default' channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'default',
            enableVibrate: true,
          });
          console.log('✅ Android notification channel created');
        }
      } catch (error) {
        console.error('❌ Error setting up notifications:', error);
      }
    };

    setupNotifications();

    // Add notification response listener (when user taps notification)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📲 Notification tapped:', response);
      const data = response.notification.request.content.data;
      if (data?.reportId) {
        console.log('📍 User tapped notification for report:', data.reportId);
        // The notification tab will handle navigation when opened
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Send push notification
  const sendPushNotification = async (title, body, data = {}) => {
    try {
      console.log('📲 Sending push notification:', { title, body });
      
      // Check notification permissions first
      const { status } = await Notifications.getPermissionsAsync();
      console.log('📱 Current notification permission status:', status);
      
      if (status !== 'granted') {
        console.warn('⚠️ Notification permission not granted');
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: data,
          badge: 1,
        },
        trigger: null, // Immediate notification
      });
      
      console.log('✅ Push notification scheduled successfully, ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      console.error('❌ Error message:', error.message);
      return null;
    }
  };

  // Setup audio and preload siren
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        console.log('🔊 SAlertsWorker: Setting up audio mode...');
        
        // Configure audio mode with maximum priority for alarm sounds
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
          interruptionModeIOS: 1, // DO_NOT_MIX
          interruptionModeAndroid: 1 // DO_NOT_MIX
        });
        
        console.log('🔊 SAlertsWorker: Audio mode configured successfully');
        console.log('🔊 SAlertsWorker: Creating sound instance...');
        
        const { sound } = await Audio.Sound.createAsync(
          SIREN_MODULE,
          { 
            shouldPlay: false, 
            volume: 1.0, 
            isLooping: true,
            isMuted: false,
            rate: 1.0,
            shouldCorrectPitch: true
          }
        );
        
        if (isMounted) {
          sirenRef.current = sound;
          sirenReadyRef.current = true;
          console.log('🔊 SAlertsWorker: Sound instance created and ready');
        }
      } catch (e) {
        console.error('🔊 SAlertsWorker: Error setting up audio:', e);
      }
    })();
    return () => {
      isMounted = false;
      if (sirenRef.current) {
        console.log('🔊 SAlertsWorker: Cleaning up sound on unmount');
        sirenRef.current.unloadAsync().catch(()=>{});
        sirenRef.current = null;
      }
    };
  }, []);

  // Sound watchdog - monitors playback and restarts if it stops unexpectedly
  useEffect(() => {
    const watchdog = setInterval(async () => {
      if (shouldBePlayingRef.current && sirenRef.current) {
        try {
          const status = await sirenRef.current.getStatusAsync();
          
          if (!status.isPlaying && status.isLoaded) {
            console.log('⚠️ SAlertsWorker WATCHDOG: Sound stopped unexpectedly! Restarting...');
            console.log('⚠️ Watchdog status:', {
              isLoaded: status.isLoaded,
              isPlaying: status.isPlaying,
              isLooping: status.isLooping,
              positionMillis: status.positionMillis,
              durationMillis: status.durationMillis
            });
            
            // Restart the sound
            await sirenRef.current.setPositionAsync(0);
            await sirenRef.current.setIsLoopingAsync(true);
            await sirenRef.current.setVolumeAsync(1.0);
            await sirenRef.current.playAsync();
            
            console.log('⚠️ SAlertsWorker WATCHDOG: Sound restarted');
          }
        } catch (error) {
          console.error('⚠️ SAlertsWorker WATCHDOG: Error:', error);
        }
      }
    }, 1000); // Check every second
    
    soundWatchdogRef.current = watchdog;
    
    return () => {
      if (soundWatchdogRef.current) {
        clearInterval(soundWatchdogRef.current);
      }
    };
  }, []);

  const playAlert = async () => {
    try {
      console.log('🔊 SAlertsWorker: playAlert called');
      
      // Ensure we have a sound instance
      if (!sirenRef.current || !sirenReadyRef.current) {
        console.log('🔊 SAlertsWorker: No sound instance, creating new one...');
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
            allowsRecordingIOS: false,
            interruptionModeIOS: 1, // DO_NOT_MIX
            interruptionModeAndroid: 1 // DO_NOT_MIX
          });
          
          const { sound } = await Audio.Sound.createAsync(
            SIREN_MODULE,
            { 
              shouldPlay: false, 
              volume: 1.0, 
              isLooping: true,
              isMuted: false,
              rate: 1.0
            }
          );
          sirenRef.current = sound;
          sirenReadyRef.current = true;
          console.log('🔊 SAlertsWorker: New sound instance created');
        } catch (createError) {
          console.error('🔊 SAlertsWorker: Failed to create sound:', createError);
          return;
        }
      }
      
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        console.log('🔊 SAlertsWorker: Current sound status:', {
          isLoaded: status.isLoaded,
          isPlaying: status.isPlaying,
          isLooping: status.isLooping,
          volume: status.volume
        });
        
        // Stop if already playing to restart
        if (status.isPlaying) {
          console.log('🔊 SAlertsWorker: Stopping current playback to restart');
          await sirenRef.current.stopAsync();
        }
        
        // Reset to beginning
        await sirenRef.current.setPositionAsync(0);
        
        // Ensure looping is enabled
        await sirenRef.current.setIsLoopingAsync(true);
        
        // Set maximum volume
        await sirenRef.current.setVolumeAsync(1.0);
        
        // Play the sound
        console.log('🔊 SAlertsWorker: Starting playback...');
        await sirenRef.current.playAsync();
        
        // Give audio system a moment to start
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify it's playing
        const playingStatus = await sirenRef.current.getStatusAsync();
        console.log('🔊 SAlertsWorker: After play attempt:', {
          isPlaying: playingStatus.isPlaying,
          isLooping: playingStatus.isLooping,
          positionMillis: playingStatus.positionMillis,
          durationMillis: playingStatus.durationMillis
        });
        
        if (!playingStatus.isPlaying) {
          console.error('🔊 SAlertsWorker: Sound failed to play! Retrying...');
          // Retry with fresh start
          await sirenRef.current.setPositionAsync(0);
          await sirenRef.current.playAsync();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const retryStatus = await sirenRef.current.getStatusAsync();
          console.log('🔊 SAlertsWorker: After retry:', {
            isPlaying: retryStatus.isPlaying
          });
        }
        
        // Start vibration
        Vibration.vibrate([0, 1000, 500, 1000], true);
        console.log('🔊 SAlertsWorker: Vibration started');
        
        // Mark that sound should be playing (for watchdog)
        shouldBePlayingRef.current = true;
        console.log('🔊 SAlertsWorker: shouldBePlayingRef set to TRUE');
      }
    } catch (error) {
      console.error('🔊 SAlertsWorker: Error in playAlert:', error);
    }
  };

  const stopAlert = async () => {
    try {
      console.log('🔇 SAlertsWorker: stopAlert called');
      
      // Mark that sound should NOT be playing (stops watchdog from restarting it)
      shouldBePlayingRef.current = false;
      console.log('🔇 SAlertsWorker: shouldBePlayingRef set to FALSE');
      
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        console.log('🔇 SAlertsWorker: Current status:', {
          isPlaying: status.isPlaying,
          isLooping: status.isLooping
        });
        
        if (status.isPlaying) {
          await sirenRef.current.stopAsync();
          console.log('🔇 SAlertsWorker: Sound stopped');
        } else {
          console.log('🔇 SAlertsWorker: Sound was not playing');
        }
      } else {
        console.log('🔇 SAlertsWorker: No sound instance to stop');
      }
      
      Vibration.cancel();
      console.log('🔇 SAlertsWorker: Vibration cancelled');
    } catch (error) {
      console.error('🔇 SAlertsWorker: Error stopping alert:', error);
    }
  };

  // Resolve station ID
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('userData');
        if (raw) {
          const user = JSON.parse(raw);
          const id = user?.id || user?.uid || null;
          console.log('🔊 SAlertsWorker: Station ID resolved:', id);
          setStationId(id);
        }
      } catch (e) {
        console.error('🔊 SAlertsWorker: Error loading station ID:', e);
      }
    })();
  }, []);

  // Load station notifications and trigger alert on unread assignment notifications
  const loadNotifications = async () => {
    if (!stationId) {
      console.log('⚠️ SAlertsWorker: No stationId, skipping notification load');
      return;
    }
    try {
      console.log('🔍 SAlertsWorker: Loading notifications for station:', stationId);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', stationId)
        .eq('user_type', 'station')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('🔊 SAlertsWorker: Error loading notifications:', error);
        return;
      }

      const list = data || [];
      console.log(`📊 SAlertsWorker: Loaded ${list.length} total notifications`);
      
      // Log notification types
      const notifTypes = list.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {});
      console.log('📋 Notification types:', notifTypes);
      
      // Check if there are any unread assignment or fire alert notifications
      const hasUnreadUrgent = list.some(n => 
        (n.type === 'assignment' || n.type === 'fire_alert') && !n.is_read
      );
      
      console.log('🔔 Has unread urgent notifications:', hasUnreadUrgent);
      
      // Check for NEW urgent notifications (not yet processed)
      const newUrgentNotifications = list.filter(n => 
        (n.type === 'assignment' || n.type === 'fire_alert') && 
        !n.is_read && 
        !processedNotificationIdsRef.current.has(n.id)
      );
      
      console.log(`🆕 Found ${newUrgentNotifications.length} new urgent notifications`);
      
      if (newUrgentNotifications.length > 0) {
        console.log('📋 New urgent notifications:', newUrgentNotifications.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          created_at: n.created_at
        })));
      }
      
      if (newUrgentNotifications.length > 0 && !isAlertingRef.current) {
        console.log(`🔔 New urgent notifications found for station (${newUrgentNotifications.length})`);
        
        // Check if any are assignments (which need alarm sound)
        const newAssignments = newUrgentNotifications.filter(n => n.type === 'assignment');
        const alarmLevelChanges = newUrgentNotifications.filter(n => n.type === 'fire_alert');
        
        // Send push notifications for all urgent notifications
        newUrgentNotifications.forEach(n => {
          processedNotificationIdsRef.current.add(n.id);
          console.log(`📲 Sending push notification for: ${n.title} (type: ${n.type})`);
          sendPushNotification(
            n.title || 'Station Alert',
            n.message || 'You have a new urgent notification',
            { reportId: n.related_report_id, notificationType: n.type }
          );
        });
        
        // Only play alarm sound for NEW ASSIGNMENTS, not for alarm level changes
        if (newAssignments.length > 0) {
          console.log(`🔊 Found ${newAssignments.length} new assignment(s), playing alarm...`);
          await playAlert();
          isAlertingRef.current = true;
          setTimeout(() => { isAlertingRef.current = false; }, 2000);
        } else {
          console.log(`ℹ️ Only alarm level changes (${alarmLevelChanges.length}), no alarm sound needed`);
        }
      } else if (hasUnreadUrgent && !shouldBePlayingRef.current && !isAlertingRef.current) {
        // Ensure alarm is playing when unread exists on first load/login
        console.log('🔊 Unread urgent notifications exist, ensuring alarm is playing...');
        await playAlert();
      } else if (!hasUnreadUrgent && shouldBePlayingRef.current) {
        // ONLY stop the alarm when ALL urgent notifications have been marked as read
        console.log('🔇 No unread urgent notifications found (all marked as read), stopping alarm...');
        await stopAlert();
      } else {
        console.log('ℹ️ No action needed - either no new notifications or alarm already handled');
      }
    } catch (error) {
      console.error('🔊 SAlertsWorker: Error in loadNotifications:', error);
    }
  };

  // Start polling + realtime when stationId ready
  useEffect(() => {
    if (!stationId) return;
    
    console.log('🔊 SAlertsWorker: Starting notification monitoring for station:', stationId);
    
    // Initial check
    loadNotifications();

    // Poll notifications every 2 seconds
    const notifInterval = setInterval(loadNotifications, 2000);

    const channel = supabase
      .channel(`station-alerts:${stationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${stationId}`
      }, (payload) => {
        console.log('🔥 Real-time: New station notification inserted!');
        console.log('📋 Notification details:', {
          id: payload.new?.id,
          type: payload.new?.type,
          user_type: payload.new?.user_type,
          title: payload.new?.title,
          is_read: payload.new?.is_read
        });
        
        if (payload.new?.user_type === 'station' && 
            (payload.new?.type === 'assignment' || payload.new?.type === 'fire_alert')) {
          console.log('✅ This is an urgent notification! Sending push notification...');
          console.log('📲 About to send push notification with:', {
            title: payload.new.title || 'Station Alert',
            message: payload.new.message || 'You have a new urgent notification',
            type: payload.new.type
          });
          
          // Send push notification (await it to see the result)
          sendPushNotification(
            payload.new.title || 'Station Alert',
            payload.new.message || 'You have a new urgent notification',
            { reportId: payload.new.related_report_id, notificationType: payload.new.type }
          ).then(notifId => {
            if (notifId) {
              console.log('🎉 Push notification sent successfully, ID:', notifId);
            } else {
              console.log('❌ Push notification failed to send');
            }
          }).catch(err => {
            console.error('❌ Push notification error:', err);
          });
          
          // Only play alarm sound for NEW ASSIGNMENTS, not for alarm level changes
          if (payload.new?.type === 'assignment') {
            console.log('🔊 New assignment detected, playing alarm...');
            playAlert();
          } else {
            console.log('ℹ️ Alarm level change - push notification only, no alarm sound');
          }
        } else {
          console.log('ℹ️ Not an urgent notification, skipping alarm');
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${stationId}`
      }, (payload) => {
        if (payload.new?.user_type === 'station' && 
            payload.new?.is_read && 
            (payload.new?.type === 'assignment' || payload.new?.type === 'alarm_level_change')) {
          console.log('✅ Real-time: Urgent notification marked as read, checking all notifications...');
          // Check all notifications to see if ANY urgent ones remain unread
          loadNotifications();
        }
      })
      .subscribe((status) => {
        console.log('🔊 SAlertsWorker: Subscription status:', status);
      });

    const appSub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        console.log('🔊 SAlertsWorker: App resumed, reloading notifications...');
        loadNotifications();
      }
      appState.current = next;
    });

    return () => {
      clearInterval(notifInterval);
      try { channel.unsubscribe(); } catch (_) {}
      appSub.remove();
    };
  }, [stationId]);

  return null;
}

