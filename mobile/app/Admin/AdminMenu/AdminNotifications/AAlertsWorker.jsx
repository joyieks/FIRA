import React, { useEffect, useRef, useState } from 'react';
import { Vibration, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../../config/supabase';

// Headless background worker for admin alerts (no UI)
export default function AAlertsWorker() {
  const sirenRef = useRef(null);
  const sirenReadyRef = useRef(false);
  const [adminId, setAdminId] = useState(null);
  const isAlertingRef = useRef(false);
  const shouldBePlayingRef = useRef(false); // Track if alarm should be playing
  const processedNotificationIdsRef = useRef(new Set());
  const processedReportIdsRef = useRef(new Set());
  const isInitializedRef = useRef(false);
  const appState = useRef(AppState.currentState);
  const soundWatchdogRef = useRef(null);
  const previousUnreadCountRef = useRef(0); // Track previous unread count for smart alarm control
  const vibrationIntervalRef = useRef(null); // Track vibration interval for status changes

  const SIREN_MODULE = require('../../../../assets/sounds/fire_alarm_sound.mp3');

  // Setup audio and preload siren
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        console.log('🔊 AAlertsWorker: Setting up audio mode...');
        
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
        
        console.log('🔊 AAlertsWorker: Audio mode configured successfully');
        console.log('🔊 AAlertsWorker: Creating sound instance...');
        
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
          console.log('🔊 AAlertsWorker: Sound instance created and ready');
        }
      } catch (e) {
        console.error('🔊 AAlertsWorker: Error setting up audio:', e);
      }
    })();
    return () => {
      isMounted = false;
      if (sirenRef.current) {
        console.log('🔊 AAlertsWorker: Cleaning up sound on unmount');
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
            console.log('⚠️ AAlertsWorker WATCHDOG: Sound stopped unexpectedly! Restarting...');
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
            
            console.log('⚠️ AAlertsWorker WATCHDOG: Sound restarted');
          }
        } catch (error) {
          console.error('⚠️ AAlertsWorker WATCHDOG: Error:', error);
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
      console.log('🔊 AAlertsWorker: playAlert called');
      
      // Ensure we have a sound instance
      if (!sirenRef.current || !sirenReadyRef.current) {
        console.log('🔊 AAlertsWorker: No sound instance, creating new one...');
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
          console.log('🔊 AAlertsWorker: New sound instance created');
        } catch (createError) {
          console.error('🔊 AAlertsWorker: Failed to create sound:', createError);
          return;
        }
      }
      
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        console.log('🔊 AAlertsWorker: Current sound status:', {
          isLoaded: status.isLoaded,
          isPlaying: status.isPlaying,
          isLooping: status.isLooping,
          volume: status.volume
        });
        
        // Stop if already playing to restart
        if (status.isPlaying) {
          console.log('🔊 AAlertsWorker: Stopping current playback to restart');
          await sirenRef.current.stopAsync();
        }
        
        // Reset to beginning
        await sirenRef.current.setPositionAsync(0);
        
        // Ensure looping is enabled
        await sirenRef.current.setIsLoopingAsync(true);
        
        // Set maximum volume
        await sirenRef.current.setVolumeAsync(1.0);
        
        // Play the sound
        console.log('🔊 AAlertsWorker: Starting playback...');
        await sirenRef.current.playAsync();
        
        // Give audio system a moment to start
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify it's playing
        const playingStatus = await sirenRef.current.getStatusAsync();
        console.log('🔊 AAlertsWorker: After play attempt:', {
          isPlaying: playingStatus.isPlaying,
          isLooping: playingStatus.isLooping,
          positionMillis: playingStatus.positionMillis,
          durationMillis: playingStatus.durationMillis
        });
        
        if (!playingStatus.isPlaying) {
          console.error('🔊 AAlertsWorker: Sound failed to play! Retrying...');
          // Retry with fresh start
          await sirenRef.current.setPositionAsync(0);
          await sirenRef.current.playAsync();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const retryStatus = await sirenRef.current.getStatusAsync();
          console.log('🔊 AAlertsWorker: After retry:', {
            isPlaying: retryStatus.isPlaying
          });
        }
        
        // Start vibration
        Vibration.vibrate([0, 1000, 500, 1000], true);
        console.log('🔊 AAlertsWorker: Vibration started');
        
        // Mark that sound should be playing (for watchdog)
        shouldBePlayingRef.current = true;
        console.log('🔊 AAlertsWorker: shouldBePlayingRef set to TRUE');
      }
    } catch (error) {
      console.error('🔊 AAlertsWorker: Error in playAlert:', error);
    }
  };

  const stopAlert = async () => {
    try {
      console.log('🔇 AAlertsWorker: stopAlert called');
      
      // Mark that sound should NOT be playing (stops watchdog from restarting it)
      shouldBePlayingRef.current = false;
      console.log('🔇 AAlertsWorker: shouldBePlayingRef set to FALSE');
      
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        console.log('🔇 AAlertsWorker: Current status:', {
          isPlaying: status.isPlaying,
          isLooping: status.isLooping
        });
        
        if (status.isPlaying) {
          await sirenRef.current.stopAsync();
          console.log('🔇 AAlertsWorker: Sound stopped');
        } else {
          console.log('🔇 AAlertsWorker: Sound was not playing');
        }
      } else {
        console.log('🔇 AAlertsWorker: No sound instance to stop');
      }
      
      Vibration.cancel();
      console.log('🔇 AAlertsWorker: Vibration cancelled');
      
      // Stop continuous vibration for status changes
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
        console.log('🔇 AAlertsWorker: Continuous vibration stopped');
      }
    } catch (error) {
      console.error('🔇 AAlertsWorker: Error stopping alert:', error);
    }
  };

  // Start continuous vibration for status changes
  const startContinuousVibration = () => {
    console.log('📳 AAlertsWorker: Starting continuous vibration for status change...');
    
    // Stop any existing vibration first
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
    }
    Vibration.cancel();
    
    // Vibrate immediately
    Vibration.vibrate(1000); // 1 second vibration
    
    // Then repeat every 2 seconds
    vibrationIntervalRef.current = setInterval(() => {
      Vibration.vibrate(1000); // 1 second vibration
    }, 2000); // Every 2 seconds
    
    console.log('📳 AAlertsWorker: Continuous vibration started');
  };

  // Stop continuous vibration
  const stopContinuousVibration = () => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
      Vibration.cancel();
      console.log('📳 AAlertsWorker: Continuous vibration stopped');
    }
  };

  // Resolve admin ID
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('userData');
        if (raw) {
          const user = JSON.parse(raw);
          setAdminId(user?.id || user?.uid || null);
        }
      } catch (_) {}
    })();
  }, []);

  // Check for new fire reports from API
  const checkForNewFireReports = async () => {
    if (!adminId) return;
    try {
      const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        
        const activeReports = data.filter(report => {
          const hasCoords = report.latitude && report.longitude && !isNaN(report.latitude) && !isNaN(report.longitude);
          const statusText = (report.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          return hasCoords && !isCancelled && !isFireOut;
        });
        
        if (isInitializedRef.current) {
          const newReports = activeReports.filter(report => 
            !processedReportIdsRef.current.has(report.id)
          );
          
          if (newReports.length > 0 && !isAlertingRef.current) {
            console.log('🔥 NEW FIRE REPORTS DETECTED (Worker):', newReports.length);
            await playAlert();
            
            isAlertingRef.current = true;
            setTimeout(() => {
              isAlertingRef.current = false;
            }, 2000);
            
            // Mark as processed
            newReports.forEach(report => {
              processedReportIdsRef.current.add(report.id);
            });
          }
        } else {
          isInitializedRef.current = true;
          activeReports.forEach(report => {
            processedReportIdsRef.current.add(report.id);
          });
        }
      }
    } catch (error) {
      console.error('Error checking fire reports (Worker):', error);
    }
  };

  // Load notifications and trigger alert on unread fire alerts
  const loadNotifications = async () => {
    if (!adminId) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', adminId)
        .eq('user_type', 'admin')
        .order('created_at', { ascending: false });
      if (error) return;

      const list = data || [];
      
      // Count unread fire alerts (ONLY from new fire reports, NOT status changes)
      const unreadFireCount = list.filter(n => 
        n.type === 'fire_alert' && 
        !n.is_read && 
        (!n.title || !n.title.includes('Status Changed')) // Exclude status change notifications
      ).length;
      
      const previousCount = previousUnreadCountRef.current;
      previousUnreadCountRef.current = unreadFireCount;
      
      console.log(`🔔 AAlertsWorker: Unread fire alerts changed from ${previousCount} to ${unreadFireCount}`);
      
      // Check for NEW fire alerts (not yet processed) - EXCLUDE status changes
      const newFireAlerts = list.filter(n => 
        n.type === 'fire_alert' && 
        !n.is_read && 
        !processedNotificationIdsRef.current.has(n.id) &&
        (!n.title || !n.title.includes('Status Changed')) // Exclude status change notifications
      );
      
      if (newFireAlerts.length > 0 && !isAlertingRef.current) {
        console.log('🔊 AAlertsWorker: New fire alerts found (not status changes), playing alarm...');
        newFireAlerts.forEach(n => {
          console.log(`  - Processing notification: ${n.title}`);
          processedNotificationIdsRef.current.add(n.id);
        });
        await playAlert();
        isAlertingRef.current = true;
        setTimeout(() => { isAlertingRef.current = false; }, 2000);
      } else if (unreadFireCount > 0 && !shouldBePlayingRef.current && !isAlertingRef.current) {
        // Ensure alarm is playing when unread exists on first load/login (ONLY for non-status-change alerts)
        console.log('🔊 AAlertsWorker: Unread fire alerts exist (not status changes), ensuring alarm is playing...');
        await playAlert();
      } else if (unreadFireCount === 0 && previousCount > 0) {
        // ONLY stop alarm when count transitions from >0 to 0 (all fire alerts marked as read)
        console.log('🔇 AAlertsWorker: All fire alerts marked as read, stopping alarm...');
        await stopAlert();
      }
    } catch (_) {}
  };

  // Start polling + realtime when adminId ready
  useEffect(() => {
    if (!adminId) return;
    
    // Initial checks
    loadNotifications();
    checkForNewFireReports();

    // Poll notifications every 2 seconds
    const notifInterval = setInterval(loadNotifications, 2000);
    
    // Poll fire reports every 1 second (fast polling for new reports)
    const fireReportInterval = setInterval(checkForNewFireReports, 1000);

    const channel = supabase
      .channel(`alerts-worker:admin:${adminId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
        if (payload.new?.user_id === adminId && payload.new?.user_type === 'admin') {
          // Only play alarm for NEW fire reports, NOT for status changes
          if (payload.new?.type === 'fire_alert' && (!payload.new?.title || !payload.new?.title.includes('Status Changed'))) {
            console.log('🔥 Real-time: New fire alert inserted (not a status change), playing alarm');
            playAlert();
          } else if (payload.new?.title && payload.new?.title.includes('Status Changed')) {
            console.log('📋 Real-time: Status change notification - starting continuous vibration and sending push notification...');
            
            // Start continuous vibration that won't stop until notification is clicked
            startContinuousVibration();
            
            // Send push notification immediately for status changes
            try {
              const { status } = await Notifications.getPermissionsAsync();
              if (status === 'granted') {
                const notificationContent = {
                  title: payload.new.title || '📋 Status Changed',
                  body: payload.new.message || 'Fire report status updated',
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.MAX,
                  data: {
                    type: payload.new.type,
                    reportId: payload.new.related_report_id,
                    notificationId: payload.new.id,
                  },
                  badge: 1,
                  vibrate: [0, 250, 250, 250],
                };

                // Add Android channel
                if (Platform.OS === 'android') {
                  notificationContent.channelId = 'fire-alerts';
                }

                await Notifications.scheduleNotificationAsync({
                  content: notificationContent,
                  trigger: null, // Immediate
                });
                
                console.log('✅ Push notification sent for status change');
              }
            } catch (error) {
              console.error('❌ Error sending push notification for status change:', error);
            }
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new?.user_id === adminId && payload.new?.user_type === 'admin') {
          if (payload.new?.is_read && payload.new?.type === 'fire_alert') {
            console.log('✅ Real-time: Fire alert marked as read, checking all notifications...');
            
            // If it's a status change notification being marked as read, stop continuous vibration
            if (payload.new?.title && payload.new?.title.includes('Status Changed')) {
              console.log('📳 Stopping continuous vibration - status change notification marked as read');
              stopContinuousVibration();
            }
            
            // Check all notifications to see if ANY fire alerts remain unread
            loadNotifications();
          }
        }
      })
      .subscribe();

    const appSub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        loadNotifications();
        checkForNewFireReports();
      }
      appState.current = next;
    });

    return () => {
      clearInterval(notifInterval);
      clearInterval(fireReportInterval);
      try { channel.unsubscribe(); } catch (_) {}
      appSub.remove();
    };
  }, [adminId]);

  return null;
}


