import React, { useEffect, useRef, useState } from 'react';
import { Vibration, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { supabase } from '../../../config/supabase';

// Headless background worker for responder alerts (no UI)
export default function RAlertsWorker() {
  const sirenRef = useRef(null);
  const sirenReadyRef = useRef(false);
  const [responderId, setResponderId] = useState(null);
  const isAlertingRef = useRef(false);
  const shouldBePlayingRef = useRef(false); // Track if alarm should be playing
  const processedNotificationIdsRef = useRef(new Set());
  const appState = useRef(AppState.currentState);
  const soundWatchdogRef = useRef(null);

  const SIREN_MODULE = require('../../../../assets/sounds/fire_alarm_sound.mp3');

  // Setup audio and preload siren
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        console.log('🔊 RAlertsWorker: Setting up audio mode...');
        
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
        
        console.log('🔊 RAlertsWorker: Audio mode configured successfully');
        console.log('🔊 RAlertsWorker: Creating sound instance...');
        
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
          console.log('🔊 RAlertsWorker: Sound instance created and ready');
        }
      } catch (e) {
        console.error('🔊 RAlertsWorker: Error setting up audio:', e);
      }
    })();
    return () => {
      isMounted = false;
      if (sirenRef.current) {
        console.log('🔊 RAlertsWorker: Cleaning up sound on unmount');
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
            console.log('⚠️ RAlertsWorker WATCHDOG: Sound stopped unexpectedly! Restarting...');
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
            
            console.log('⚠️ RAlertsWorker WATCHDOG: Sound restarted');
          }
        } catch (error) {
          console.error('⚠️ RAlertsWorker WATCHDOG: Error:', error);
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
      console.log('🔊 RAlertsWorker: playAlert called');
      
      // Ensure we have a sound instance
      if (!sirenRef.current || !sirenReadyRef.current) {
        console.log('🔊 RAlertsWorker: No sound instance, creating new one...');
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
          console.log('🔊 RAlertsWorker: New sound instance created');
        } catch (createError) {
          console.error('🔊 RAlertsWorker: Failed to create sound:', createError);
          return;
        }
      }
      
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        console.log('🔊 RAlertsWorker: Current sound status:', {
          isLoaded: status.isLoaded,
          isPlaying: status.isPlaying,
          isLooping: status.isLooping,
          volume: status.volume
        });
        
        // Stop if already playing to restart
        if (status.isPlaying) {
          console.log('🔊 RAlertsWorker: Stopping current playback to restart');
          await sirenRef.current.stopAsync();
        }
        
        // Reset to beginning
        await sirenRef.current.setPositionAsync(0);
        
        // Ensure looping is enabled
        await sirenRef.current.setIsLoopingAsync(true);
        
        // Set maximum volume
        await sirenRef.current.setVolumeAsync(1.0);
        
        // Play the sound
        console.log('🔊 RAlertsWorker: Starting playback...');
        await sirenRef.current.playAsync();
        
        // Give audio system a moment to start
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify it's playing
        const playingStatus = await sirenRef.current.getStatusAsync();
        console.log('🔊 RAlertsWorker: After play attempt:', {
          isPlaying: playingStatus.isPlaying,
          isLooping: playingStatus.isLooping,
          positionMillis: playingStatus.positionMillis,
          durationMillis: playingStatus.durationMillis
        });
        
        if (!playingStatus.isPlaying) {
          console.error('🔊 RAlertsWorker: Sound failed to play! Retrying...');
          // Retry with fresh start
          await sirenRef.current.setPositionAsync(0);
          await sirenRef.current.playAsync();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const retryStatus = await sirenRef.current.getStatusAsync();
          console.log('🔊 RAlertsWorker: After retry:', {
            isPlaying: retryStatus.isPlaying
          });
        }
        
        // Start vibration
        Vibration.vibrate([0, 1000, 500, 1000], true);
        console.log('🔊 RAlertsWorker: Vibration started');
        
        // Mark that sound should be playing (for watchdog)
        shouldBePlayingRef.current = true;
        console.log('🔊 RAlertsWorker: shouldBePlayingRef set to TRUE');
      }
    } catch (error) {
      console.error('🔊 RAlertsWorker: Error in playAlert:', error);
    }
  };

  const stopAlert = async () => {
    try {
      console.log('🔇 RAlertsWorker: stopAlert called');
      
      // Mark that sound should NOT be playing (stops watchdog from restarting it)
      shouldBePlayingRef.current = false;
      console.log('🔇 RAlertsWorker: shouldBePlayingRef set to FALSE');
      
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        console.log('🔇 RAlertsWorker: Current status:', {
          isPlaying: status.isPlaying,
          isLooping: status.isLooping
        });
        
        if (status.isPlaying) {
          await sirenRef.current.stopAsync();
          console.log('🔇 RAlertsWorker: Sound stopped');
        } else {
          console.log('🔇 RAlertsWorker: Sound was not playing');
        }
      } else {
        console.log('🔇 RAlertsWorker: No sound instance to stop');
      }
      
      Vibration.cancel();
      console.log('🔇 RAlertsWorker: Vibration cancelled');
    } catch (error) {
      console.error('🔇 RAlertsWorker: Error stopping alert:', error);
    }
  };

  // Resolve responder ID
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('userData');
        if (raw) {
          const user = JSON.parse(raw);
          const id = user?.id || user?.uid || null;
          console.log('🔊 RAlertsWorker: Responder ID resolved:', id);
          setResponderId(id);
        }
      } catch (e) {
        console.error('🔊 RAlertsWorker: Error loading responder ID:', e);
      }
    })();
  }, []);

  // Load responder notifications and trigger alert on unread fire alerts
  const loadNotifications = async () => {
    if (!responderId) return;
    try {
      const { data, error } = await supabase
        .from('responder_notifications')
        .select('*')
        .eq('responder_id', responderId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('🔊 RAlertsWorker: Error loading notifications:', error);
        return;
      }

      const list = data || [];
      
      // Check if there are any unread high priority notifications
      const hasUnreadAlert = list.some(n => n.priority === 'high' && !n.is_read);
      
      // If NO unread alerts, stop the alarm
      if (!hasUnreadAlert && shouldBePlayingRef.current) {
        console.log('🔇 No unread alerts found, stopping alarm...');
        await stopAlert();
        return;
      }
      
      // Check for NEW high priority alerts
      const newAlerts = list.filter(n => n.priority === 'high' && !n.is_read && !processedNotificationIdsRef.current.has(n.id));
      if (newAlerts.length > 0 && !isAlertingRef.current) {
        console.log('🔊 New fire alerts found for responder, playing alarm...');
        newAlerts.forEach(n => processedNotificationIdsRef.current.add(n.id));
        await playAlert();
        isAlertingRef.current = true;
        setTimeout(() => { isAlertingRef.current = false; }, 2000);
      } else if (hasUnreadAlert && !shouldBePlayingRef.current && !isAlertingRef.current) {
        // Ensure alarm is playing when unread exists on first load/login
        console.log('🔊 Unread fire alerts exist, ensuring alarm is playing...');
        await playAlert();
      }
    } catch (error) {
      console.error('🔊 RAlertsWorker: Error in loadNotifications:', error);
    }
  };

  // Start polling + realtime when responderId ready
  useEffect(() => {
    if (!responderId) return;
    
    console.log('🔊 RAlertsWorker: Starting notification monitoring for responder:', responderId);
    
    // Initial check
    loadNotifications();

    // Poll notifications every 2 seconds
    const notifInterval = setInterval(loadNotifications, 2000);

    const channel = supabase
      .channel(`responder-alerts:${responderId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'responder_notifications',
        filter: `responder_id=eq.${responderId}`
      }, (payload) => {
        console.log('🔥 Real-time: New responder notification inserted:', payload.new);
        if (payload.new?.priority === 'high') {
          console.log('🔊 High priority alert received, playing alarm...');
          playAlert();
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'responder_notifications',
        filter: `responder_id=eq.${responderId}`
      }, (payload) => {
        if (payload.new?.is_read && payload.new?.priority === 'high') {
          console.log('✅ Real-time: Alert marked as read, checking all notifications...');
          // Check all notifications to see if ANY alerts remain unread
          loadNotifications();
        }
      })
      .subscribe((status) => {
        console.log('🔊 RAlertsWorker: Subscription status:', status);
      });

    const appSub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        console.log('🔊 RAlertsWorker: App resumed, reloading notifications...');
        loadNotifications();
      }
      appState.current = next;
    });

    return () => {
      clearInterval(notifInterval);
      try { channel.unsubscribe(); } catch (_) {}
      appSub.remove();
    };
  }, [responderId]);

  return null;
}

