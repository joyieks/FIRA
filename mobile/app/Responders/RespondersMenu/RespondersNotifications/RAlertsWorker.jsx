import React, { useEffect, useRef, useState } from 'react';
import { Vibration, AppState, Modal, View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { supabase } from '../../../config/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { scheduleLocalNotification, registerForPushNotificationsAsync } from '../../../services/pushNotificationService';
import { BlurView } from 'expo-blur';
import { notifyRespondersOnStationAssignment } from '../../../services/responderNotificationService';

// Background worker for responder alerts WITH modal UI for accepting assignments
export default function RAlertsWorker() {
  const sirenRef = useRef(null);
  const sirenReadyRef = useRef(false);
  const [responderId, setResponderId] = useState(null);
  const [responderStationId, setResponderStationId] = useState(null);
  const isAlertingRef = useRef(false);
  const shouldBePlayingRef = useRef(false); // Track if alarm should be playing
  const processedNotificationIdsRef = useRef(new Set());
  const appState = useRef(AppState.currentState);
  const soundWatchdogRef = useRef(null);
  
  // Modal state for viewing assignments (after station accepts)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState(null);

  const SIREN_MODULE = require('../../../../assets/sounds/fire_alarm_sound.mp3');

  // Register for push notifications on mount
  useEffect(() => {
    (async () => {
      try {
        console.log('📱 RAlertsWorker: Registering for push notifications...');
        await registerForPushNotificationsAsync();
        console.log('✅ RAlertsWorker: Push notifications registered');
      } catch (error) {
        console.error('❌ RAlertsWorker: Error registering for push notifications:', error);
      }
    })();
  }, []);

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
      
      // Mark that sound should be playing FIRST to prevent watchdog interference
      shouldBePlayingRef.current = true;
      
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
          shouldBePlayingRef.current = false;
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
        
        // If already playing correctly, just ensure vibration is on
        if (status.isPlaying && status.isLooping) {
          console.log('🔊 RAlertsWorker: Sound already playing correctly');
          Vibration.vibrate([0, 1000, 500, 1000], true);
          return;
        }
        
        // Stop if playing to restart
        if (status.isPlaying) {
          console.log('🔊 RAlertsWorker: Stopping current playback to restart');
          await sirenRef.current.stopAsync();
          // Wait a bit after stopping to avoid race conditions
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Configure sound before playing
        await sirenRef.current.setIsLoopingAsync(true);
        await sirenRef.current.setVolumeAsync(1.0);
        await sirenRef.current.setPositionAsync(0);
        
        // Play the sound
        console.log('🔊 RAlertsWorker: Starting playback...');
        await sirenRef.current.playAsync();
        
        // Verify it's playing
        await new Promise(resolve => setTimeout(resolve, 100));
        const playingStatus = await sirenRef.current.getStatusAsync();
        console.log('🔊 RAlertsWorker: After play attempt:', {
          isPlaying: playingStatus.isPlaying,
          isLooping: playingStatus.isLooping
        });
        
        // Start vibration
        Vibration.vibrate([0, 1000, 500, 1000], true);
        console.log('🔊 RAlertsWorker: Vibration started');
      }
    } catch (error) {
      console.error('🔊 RAlertsWorker: Error in playAlert:', error);
      shouldBePlayingRef.current = false;
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

  // Resolve responder's station ID once we have responderId
  useEffect(() => {
    if (!responderId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('responders')
          .select('station_id')
          .eq('id', responderId)
          .single();

        if (!error && data?.station_id) {
          setResponderStationId(data.station_id);
          console.log('🔊 RAlertsWorker: Station ID resolved:', data.station_id);
        } else {
          setResponderStationId(null);
          if (error) console.error('🔊 RAlertsWorker: Error fetching station ID:', error);
        }
      } catch (e) {
        console.error('🔊 RAlertsWorker: Unexpected error fetching station ID:', e);
        setResponderStationId(null);
      }
    })();
  }, [responderId]);

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
      
      // Inform on PENDING assignments (no modal, no accept)
      const pendingAssignments = list.filter(n => 
        n.status === 'pending' && 
        !n.is_read &&
        (n.priority === 'high' || n.priority === 'urgent') &&
        !processedNotificationIdsRef.current.has(n.id)
      );
      
      if (pendingAssignments.length > 0) {
        const pending = pendingAssignments[0];
        console.log('📢 Pending assignment (station has not accepted yet):', pending.id);
        try {
          await scheduleLocalNotification(
            pending.title || '🚨 Fire Report Assigned to Station',
            pending.message || 'Your station has a pending fire assignment. Await station acceptance.',
            {
              type: 'fire_assignment_pending',
              notificationId: pending.id,
              fireReportId: pending.fire_report_id,
              priority: pending.priority
            }
          );
        } catch (e) {
          console.error('❌ Error notifying pending assignment:', e);
        }
        // Mark as processed so we don't spam
        processedNotificationIdsRef.current.add(pending.id);
      }

      // Show modal ONLY when status is accepted (station accepted)
      const acceptedAssignments = list.filter(n =>
        n.status === 'accepted' &&
        !n.is_read &&
        (n.priority === 'high' || n.priority === 'urgent') &&
        !processedNotificationIdsRef.current.has(`accepted-${n.id}`)
      );

      if (acceptedAssignments.length > 0 && !showAssignmentModal) {
        const accepted = acceptedAssignments[0];
        console.log('🚨 Station accepted assignment, showing modal:', accepted.id);

        // Push notification + alarm for accepted assignment
        try {
          await scheduleLocalNotification(
            accepted.title || '🚨 FIRE EMERGENCY ASSIGNMENT',
            accepted.message || 'You have been assigned to a fire incident. Please respond immediately.',
            {
              type: 'fire_assignment',
              notificationId: accepted.id,
              fireReportId: accepted.fire_report_id,
              priority: accepted.priority
            }
          );
        } catch (notifError) {
          console.error('❌ Error sending push notification:', notifError);
        }

        // Show modal with details (no accept button)
        setCurrentAssignment(accepted);
        setShowAssignmentModal(true);

        // Start alarm
        if (!shouldBePlayingRef.current) {
          await playAlert();
        }

        // Mark processed key for accepted so we don't reopen
        processedNotificationIdsRef.current.add(`accepted-${accepted.id}`);
        return;
      }
      
      // Check for ALARM LEVEL CHANGE notifications (urgent priority with alarm level in title)
      const alarmLevelChanges = list.filter(n => 
        n.priority === 'urgent' &&
        !n.is_read &&
        n.title?.includes('Alarm Level Changed') &&
        !processedNotificationIdsRef.current.has(`alarm-${n.id}`) // Use different key for alarm changes
      );
      
      // Send push notifications for alarm level changes
      if (alarmLevelChanges.length > 0) {
        console.log(`⚠️ Found ${alarmLevelChanges.length} alarm level change(s) to notify`);
        
        for (const alarmChange of alarmLevelChanges) {
          try {
            console.log('📱 Sending alarm level change push notification...');
            console.log('📱 Title:', alarmChange.title);
            console.log('📱 Message:', alarmChange.message);
            
            await scheduleLocalNotification(
              alarmChange.title || '⚠️ Alarm Level Changed',
              alarmChange.message || 'The fire alarm level has been updated.',
              {
                type: 'alarm_level_change',
                notificationId: alarmChange.id,
                fireReportId: alarmChange.fire_report_id,
                priority: alarmChange.priority
              }
            );
            
            console.log('✅ Alarm level change push notification sent');
            
            // Mark this alarm change as processed
            processedNotificationIdsRef.current.add(`alarm-${alarmChange.id}`);
            
          } catch (notifError) {
            console.error('❌ Error sending alarm level change notification:', notifError);
          }
        }
      }
      
      // Check for STATUS UPDATE notifications (completed status with unread flag)
      const statusUpdates = list.filter(n => 
        n.status === 'completed' && 
        !n.is_read &&
        (n.priority === 'high' || n.priority === 'urgent') &&
        !n.title?.includes('Alarm Level Changed') && // Exclude alarm changes (already handled)
        !processedNotificationIdsRef.current.has(`status-${n.id}`) // Use different key for status updates
      );
      
      // Send push notifications for status updates (Fire Out, Under Control, etc.)
      if (statusUpdates.length > 0) {
        console.log(`📊 Found ${statusUpdates.length} status update(s) to notify`);
        
        for (const statusUpdate of statusUpdates) {
          try {
            console.log('📱 Sending status update push notification...');
            console.log('📱 Title:', statusUpdate.title);
            console.log('📱 Message:', statusUpdate.message);
            
            await scheduleLocalNotification(
              statusUpdate.title || '🔥 Fire Status Update',
              statusUpdate.message || 'The fire report status has been updated.',
              {
                type: 'status_update',
                notificationId: statusUpdate.id,
                fireReportId: statusUpdate.fire_report_id,
                priority: statusUpdate.priority,
                status: statusUpdate.status
              }
            );
            
            console.log('✅ Status update push notification sent');
            
            // Mark this status update as processed (use different key)
            processedNotificationIdsRef.current.add(`status-${statusUpdate.id}`);
            
          } catch (notifError) {
            console.error('❌ Error sending status update notification:', notifError);
          }
        }
      }
      
      // Check if there are any unread high or urgent priority notifications (ONLY pending status)
      const hasUnreadAlert = list.some(n => 
        (n.priority === 'high' || n.priority === 'urgent') && 
        !n.is_read && 
        n.status === 'pending' // Only trigger alarm for pending assignments
      );
      
      // If NO unread alerts, stop the alarm
      if (!hasUnreadAlert && shouldBePlayingRef.current) {
        console.log('🔇 No unread alerts found, stopping alarm...');
        await stopAlert();
        return;
      }
      
      // Check for NEW high or urgent priority alerts (ONLY pending status)
      const newAlerts = list.filter(n => 
        (n.priority === 'high' || n.priority === 'urgent') && 
        !n.is_read && 
        n.status === 'pending' && // Only alarm for pending assignments
        !processedNotificationIdsRef.current.has(n.id)
      );
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
      }, async (payload) => {
        console.log('🔥 Real-time: New responder notification inserted:', payload.new);
        const newNotif = payload.new;
        
        if (newNotif?.priority === 'high' || newNotif?.priority === 'urgent') {
          // Push notification for pending (with alarm), and for accepted (no alarm) to inform acceptance
          if (!processedNotificationIdsRef.current.has(newNotif.id)) {
            try {
              if (newNotif.status === 'pending') {
                console.log('📱 Real-time: Sending push notification (pending)...');
                await scheduleLocalNotification(
                  newNotif.title || '🚨 FIRE EMERGENCY ASSIGNMENT',
                  newNotif.message || 'You have been assigned to a fire incident.',
                  {
                    type: 'fire_assignment',
                    notificationId: newNotif.id,
                    fireReportId: newNotif.fire_report_id,
                    priority: newNotif.priority
                  }
                );
                playAlert();
              } else if (newNotif.status === 'accepted') {
                console.log('📱 Real-time: Sending push notification (station accepted)...');
                await scheduleLocalNotification(
                  newNotif.title || '✅ Station Accepted Report',
                  newNotif.message || 'Your station has accepted the assigned report.',
                  {
                    type: 'fire_assignment_accepted',
                    notificationId: newNotif.id,
                    fireReportId: newNotif.fire_report_id,
                    priority: newNotif.priority
                  }
                );
                // No alarm for acceptance
              }
            } catch (notifError) {
              console.error('❌ Real-time: Error sending push notification:', notifError);
            }
            processedNotificationIdsRef.current.add(newNotif.id);
          }
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'responder_notifications',
        filter: `responder_id=eq.${responderId}`
      }, async (payload) => {
        const isHighOrUrgent = payload.new?.priority === 'high' || payload.new?.priority === 'urgent';
        const newData = payload.new;
        const oldData = payload.old;
        
        console.log('🔄 Real-time: Notification UPDATE detected');
        console.log('🔄 Old status:', oldData?.status, 'New status:', newData?.status);
        console.log('🔄 Old is_read:', oldData?.is_read, 'New is_read:', newData?.is_read);
        
        // Detect alarm level change
        const isAlarmLevelChange = newData?.title?.includes('Alarm Level Changed');
        
        // Detect status change (e.g., pending → completed for "Fire Out" or "Under Control")
        const statusChanged = oldData?.status !== newData?.status;
        const isStatusUpdate = newData?.status === 'completed' && !newData?.is_read && !isAlarmLevelChange;
        
        // Send push notification for alarm level changes - NO ALARM SOUND
        if (isAlarmLevelChange && !newData?.is_read && !processedNotificationIdsRef.current.has(`alarm-${newData.id}`)) {
          try {
            console.log('⚠️ Real-time: Alarm level changed! Sending push notification (no alarm)...');
            await scheduleLocalNotification(
              newData.title || '⚠️ Alarm Level Changed',
              newData.message || 'The fire alarm level has been updated.',
              {
                type: 'alarm_level_change',
                notificationId: newData.id,
                fireReportId: newData.fire_report_id,
                priority: newData.priority
              }
            );
            processedNotificationIdsRef.current.add(`alarm-${newData.id}`);
            console.log('✅ Real-time: Alarm level change push notification sent (no alarm)');
          } catch (notifError) {
            console.error('❌ Real-time: Error sending alarm level change notification:', notifError);
          }
        }
        
        // Send push notification for status updates (Fire Out, Under Control, etc.) - NO ALARM SOUND
        if (statusChanged && isStatusUpdate && isHighOrUrgent) {
          try {
            console.log('📱 Real-time: Status changed! Sending push notification (no alarm)...');
            await scheduleLocalNotification(
              newData.title || '🔥 Fire Status Update',
              newData.message || 'The fire report status has been updated.',
              {
                type: 'status_update',
                notificationId: newData.id,
                fireReportId: newData.fire_report_id,
                priority: newData.priority,
                status: newData.status
              }
            );
            console.log('✅ Real-time: Status update push notification sent (no alarm)');
          } catch (notifError) {
            console.error('❌ Real-time: Error sending status update notification:', notifError);
          }
          // DO NOT play alarm for status updates - only notification
          return;
        }
        
        // If updated to unread with high/urgent priority AND still pending, play alarm
        if (!newData?.is_read && isHighOrUrgent && newData?.status === 'pending') {
          console.log('🔊 Real-time: Notification updated to unread with high/urgent priority, playing alarm...');
          playAlert();
        }
        
        // If marked as read, check if any other unread alerts remain
        if (newData?.is_read && isHighOrUrgent) {
          console.log('✅ Real-time: Alert marked as read, checking all notifications...');
          loadNotifications();
        }
      })
      .subscribe((status) => {
        console.log('🔊 RAlertsWorker: Subscription status:', status);
      });

    // NEW: Listen for station assignments (when a report is assigned to responder's station)
    let stationAssignmentChannel = null;
    if (responderStationId) {
      stationAssignmentChannel = supabase
        .channel(`responder-station-assignments:${responderStationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'report_assignments',
          filter: `assignee_type=eq.station`
        }, async (payload) => {
          const assignment = payload.new;
          
          // Check if this assignment is for our station
          if (String(assignment.assignee_id) === String(responderStationId) && assignment.assignee_type === 'station') {
            console.log('🚨 RAlertsWorker: New station assignment detected!', assignment);
            
            // Fetch report data
            const reportId = String(assignment.report_id);
            try {
              const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
              const reports = response.ok ? await response.json() : [];
              const reportData = reports.find(r => String(r.id) === reportId);
              
              // Notify all responders in the station (including this one)
              await notifyRespondersOnStationAssignment(
                responderStationId,
                reportId,
                reportData
              );
              
              console.log('✅ RAlertsWorker: Station assignment notification sent to all responders');
            } catch (error) {
              console.error('❌ RAlertsWorker: Error handling station assignment:', error);
            }
          }
        })
        .subscribe((status) => {
          console.log('🔊 RAlertsWorker: Station assignment subscription status:', status);
        });
    }

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
      if (stationAssignmentChannel) {
        try { stationAssignmentChannel.unsubscribe(); } catch (_) {}
      }
      appSub.remove();
    };
  }, [responderId, responderStationId]);

  // Acknowledge assignment (mark read and stop alarm)
  const handleAcknowledge = async () => {
    try {
      console.log('✅ RAlertsWorker: Acknowledging assignment...', currentAssignment?.id);
      
      if (!currentAssignment) return;
      
      // Stop alarm immediately
      await stopAlert();
      
      // Mark notification as read
      const { error } = await supabase
        .from('responder_notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', currentAssignment.id);
      
      if (error) {
        console.error('❌ RAlertsWorker: Error acknowledging assignment:', error);
      } else {
        console.log('✅ RAlertsWorker: Assignment acknowledged');
      }
      
      // Close modal
      setShowAssignmentModal(false);
      setCurrentAssignment(null);
      
    } catch (error) {
      console.error('❌ RAlertsWorker: Error in handleAcknowledge:', error);
    }
  };

  // Render modal for station-accepted assignments (view/acknowledge only)
  return (
    <Modal
      visible={showAssignmentModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}} // Prevent dismissing with back button
    >
      <View className="flex-1 bg-black/70 justify-center items-center px-6">
        <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
          {/* Fire Icon */}
          <View className="items-center mb-4">
            <View className="bg-red-100 rounded-full p-4 mb-3">
              <MaterialIcons name="local-fire-department" size={64} color="#dc2626" />
            </View>
            <Text className="text-2xl font-bold text-red-600 text-center">
              🚨 FIRE EMERGENCY ASSIGNMENT 🚨
            </Text>
          </View>
          
          {/* Assignment Details */}
          <View className="bg-red-50 rounded-2xl p-4 mb-6">
            <Text className="text-lg font-bold text-gray-800 mb-2">
              {currentAssignment?.title || 'New Fire Assignment'}
            </Text>
            <Text className="text-gray-700 mb-3">
              {currentAssignment?.message || 'You have been assigned to a fire incident.'}
            </Text>
            
            {currentAssignment?.priority && (
              <View className="flex-row items-center">
                <MaterialIcons name="warning" size={20} color="#dc2626" />
                <Text className="text-red-600 font-bold ml-2 uppercase">
                  {currentAssignment.priority} PRIORITY
                </Text>
              </View>
            )}
          </View>
          
          {/* Acknowledge Button */}
          <TouchableOpacity
            onPress={handleAcknowledge}
            className="bg-red-600 rounded-full py-4 shadow-lg"
            style={{
              shadowColor: '#dc2626',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8
            }}
          >
            <View className="flex-row items-center justify-center">
              <MaterialIcons name="check-circle" size={28} color="white" />
              <Text className="text-white text-xl font-bold ml-2">
                ACKNOWLEDGE
              </Text>
            </View>
          </TouchableOpacity>
          
          <Text className="text-gray-500 text-center mt-4 text-sm">
            Tap to stop alarm and acknowledge this station assignment
          </Text>
        </View>
      </View>
    </Modal>
  );
}

