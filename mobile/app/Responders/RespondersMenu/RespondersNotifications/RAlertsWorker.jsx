import React, { useEffect, useRef, useState } from 'react';
import { Vibration, AppState, Modal, View, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { supabase } from '../../../config/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { scheduleLocalNotification, registerForPushNotificationsAsync } from '../../../services/pushNotificationService';
import { BlurView } from 'expo-blur';

// Background worker for responder alerts WITH modal UI for accepting assignments
export default function RAlertsWorker() {
  const sirenRef = useRef(null);
  const sirenReadyRef = useRef(false);
  const [responderId, setResponderId] = useState(null);
  const isAlertingRef = useRef(false);
  const shouldBePlayingRef = useRef(false); // Track if alarm should be playing
  const processedNotificationIdsRef = useRef(new Set());
  const appState = useRef(AppState.currentState);
  const soundWatchdogRef = useRef(null);
  
  // NEW: Modal state for accepting assignments
  const [showAcceptModal, setShowAcceptModal] = useState(false);
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
      
      // Check for PENDING assignments (not accepted yet)
      const pendingAssignments = list.filter(n => 
        n.status === 'pending' && 
        !n.is_read &&
        (n.priority === 'high' || n.priority === 'urgent') &&
        !processedNotificationIdsRef.current.has(n.id)
      );
      
      // If we have a pending assignment, show modal and play alarm
      if (pendingAssignments.length > 0 && !showAcceptModal) {
        const newAssignment = pendingAssignments[0]; // Take the first one
        console.log('🚨 RAlertsWorker: NEW PENDING ASSIGNMENT!', newAssignment.id);
        console.log('🚨 Title:', newAssignment.title);
        
        // Send push notification to device
        try {
          console.log('📱 RAlertsWorker: Sending push notification...');
          await scheduleLocalNotification(
            newAssignment.title || '🚨 FIRE EMERGENCY ASSIGNMENT',
            newAssignment.message || 'You have been assigned to a fire incident. Please respond immediately.',
            {
              type: 'fire_assignment',
              notificationId: newAssignment.id,
              fireReportId: newAssignment.fire_report_id,
              priority: newAssignment.priority
            }
          );
          console.log('✅ RAlertsWorker: Push notification sent');
        } catch (notifError) {
          console.error('❌ RAlertsWorker: Error sending push notification:', notifError);
        }
        
        // Show modal with assignment details
        setCurrentAssignment(newAssignment);
        setShowAcceptModal(true);
        
        // Start alarm
        if (!shouldBePlayingRef.current) {
          await playAlert();
        }
        
        // Mark as seen (but not processed - that happens on ACCEPT)
        processedNotificationIdsRef.current.add(newAssignment.id);
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
          console.log('🔊 High/urgent priority alert received, playing alarm...');
          
          // Send push notification
          if (newNotif.status === 'pending' && !processedNotificationIdsRef.current.has(newNotif.id)) {
            try {
              console.log('📱 Real-time: Sending push notification...');
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
              console.log('✅ Real-time: Push notification sent');
            } catch (notifError) {
              console.error('❌ Real-time: Error sending push notification:', notifError);
            }
          }
          
          playAlert();
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

  // Handle accepting assignment
  const handleAccept = async () => {
    try {
      console.log('✅ RAlertsWorker: Accepting assignment...', currentAssignment?.id);
      
      if (!currentAssignment) return;
      
      // Stop alarm immediately
      await stopAlert();
      
      // Update notification status to 'accepted' and mark as read
      const { error } = await supabase
        .from('responder_notifications')
        .update({ 
          status: 'accepted',
          is_read: true,
          accepted_at: new Date().toISOString()
        })
        .eq('id', currentAssignment.id);
      
      if (error) {
        console.error('❌ RAlertsWorker: Error accepting assignment:', error);
      } else {
        console.log('✅ RAlertsWorker: Assignment accepted successfully');
      }
      
      // Close modal
      setShowAcceptModal(false);
      setCurrentAssignment(null);
      
    } catch (error) {
      console.error('❌ RAlertsWorker: Error in handleAccept:', error);
    }
  };

  // Render modal for accepting assignments
  return (
    <Modal
      visible={showAcceptModal}
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
          
          {/* Accept Button */}
          <TouchableOpacity
            onPress={handleAccept}
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
                ACCEPT ASSIGNMENT
              </Text>
            </View>
          </TouchableOpacity>
          
          <Text className="text-gray-500 text-center mt-4 text-sm">
            Tap to stop alarm and accept the assignment
          </Text>
        </View>
      </View>
    </Modal>
  );
}

