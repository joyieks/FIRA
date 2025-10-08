import React, { useEffect, useRef, useState } from 'react';
import { Vibration, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
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
    if (!stationId) return;
    try {
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
      
      // Check if there are any unread assignment notifications (new fire reports assigned/forwarded)
      const hasUnreadAssignment = list.some(n => n.type === 'assignment' && !n.is_read);
      
      // If NO unread assignments, stop the alarm
      if (!hasUnreadAssignment && shouldBePlayingRef.current) {
        console.log('🔇 No unread assignments found, stopping alarm...');
        await stopAlert();
        return;
      }
      
      // Check for NEW assignment notifications
      const newAssignments = list.filter(n => n.type === 'assignment' && !n.is_read && !processedNotificationIdsRef.current.has(n.id));
      if (newAssignments.length > 0 && !isAlertingRef.current) {
        console.log('🔊 New assignment notifications found for station, playing alarm...');
        newAssignments.forEach(n => processedNotificationIdsRef.current.add(n.id));
        await playAlert();
        isAlertingRef.current = true;
        setTimeout(() => { isAlertingRef.current = false; }, 2000);
      } else if (hasUnreadAssignment && !shouldBePlayingRef.current && !isAlertingRef.current) {
        // Ensure alarm is playing when unread exists on first load/login
        console.log('🔊 Unread assignment notifications exist, ensuring alarm is playing...');
        await playAlert();
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
        console.log('🔥 Real-time: New station notification inserted:', payload.new);
        if (payload.new?.user_type === 'station' && payload.new?.type === 'assignment') {
          console.log('🔊 Assignment notification received, playing alarm...');
          playAlert();
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${stationId}`
      }, (payload) => {
        if (payload.new?.user_type === 'station' && payload.new?.is_read && payload.new?.type === 'assignment') {
          console.log('✅ Real-time: Assignment notification marked as read, checking all notifications...');
          // Check all notifications to see if ANY assignments remain unread
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

