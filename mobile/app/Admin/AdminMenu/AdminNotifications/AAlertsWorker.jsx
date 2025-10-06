import React, { useEffect, useRef, useState } from 'react';
import { Vibration, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { supabase } from '../../../config/supabase';

// Headless background worker for admin alerts (no UI)
export default function AAlertsWorker() {
  const sirenRef = useRef(null);
  const sirenReadyRef = useRef(false);
  const [adminId, setAdminId] = useState(null);
  const isAlertingRef = useRef(false);
  const processedNotificationIdsRef = useRef(new Set());
  const appState = useRef(AppState.currentState);

  const SIREN_MODULE = require('../../../../assets/sounds/fire_alarm_sound.mp3');

  // Setup audio and preload siren
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false
        });
        const { sound } = await Audio.Sound.createAsync(
          SIREN_MODULE,
          { shouldPlay: false, volume: 1.0, isLooping: true }
        );
        if (isMounted) {
          sirenRef.current = sound;
          sirenReadyRef.current = true;
        }
        // Prime audio on first user interaction without stopping if already playing
        const prime = async () => {
          try {
            if (!sirenRef.current) return;
            const st = await sirenRef.current.getStatusAsync();
            if (st.isPlaying) return; // don't interrupt
            await sirenRef.current.playAsync();
            await sirenRef.current.pauseAsync();
            await sirenRef.current.setPositionAsync(0);
          } catch (_) {}
          document.removeEventListener('click', prime);
          document.removeEventListener('touchstart', prime);
        };
        // RN webview not used, but Expo web may; safe to add for web builds
        try {
          document.addEventListener('click', prime);
          document.addEventListener('touchstart', prime);
        } catch (_) {}
      } catch (e) {
        // ignore
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
      if (!sirenRef.current || !sirenReadyRef.current) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            SIREN_MODULE,
            { shouldPlay: false, volume: 1.0, isLooping: true }
          );
          sirenRef.current = sound;
          sirenReadyRef.current = true;
        } catch (_) {}
      }
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        if (status.isPlaying) await sirenRef.current.stopAsync();
        await sirenRef.current.setIsLoopingAsync(true);
        await sirenRef.current.setVolumeAsync(1.0);
        await sirenRef.current.playAsync();
        Vibration.vibrate([0, 1000, 500, 1000], true);
      }
    } catch (_) {}
  };

  const stopAlert = async () => {
    try {
      if (sirenRef.current) {
        const status = await sirenRef.current.getStatusAsync();
        if (status.isPlaying) await sirenRef.current.stopAsync();
      }
      Vibration.cancel();
    } catch (_) {}
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
      const newFireAlerts = list.filter(n => n.type === 'fire_alert' && !n.is_read && !processedNotificationIdsRef.current.has(n.id));
      if (newFireAlerts.length > 0 && !isAlertingRef.current) {
        newFireAlerts.forEach(n => processedNotificationIdsRef.current.add(n.id));
        await playAlert();
        isAlertingRef.current = true;
        setTimeout(() => { isAlertingRef.current = false; }, 2000);
      }

      // Do not auto-stop; only stop on explicit mark-as-read/update events.
      // Ensure alarm is active when unread exists on first load/login.
      const hasUnreadFire = list.some(n => n.type === 'fire_alert' && !n.is_read);
      if (hasUnreadFire && !isAlertingRef.current) {
        await playAlert();
      }
    } catch (_) {}
  };

  // Start polling + realtime when adminId ready
  useEffect(() => {
    if (!adminId) return;
    loadNotifications();

    const notifInterval = setInterval(loadNotifications, 2000);

    const channel = supabase
      .channel(`alerts-worker:admin:${adminId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new?.user_id === adminId && payload.new?.user_type === 'admin') {
          if (payload.new?.type === 'fire_alert') {
            playAlert();
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new?.user_id === adminId && payload.new?.user_type === 'admin') {
          if (payload.new?.is_read && payload.new?.type === 'fire_alert') stopAlert();
        }
      })
      .subscribe();

    const appSub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') loadNotifications();
      appState.current = next;
    });

    return () => {
      clearInterval(notifInterval);
      try { channel.unsubscribe(); } catch (_) {}
      appSub.remove();
    };
  }, [adminId]);

  return null;
}


