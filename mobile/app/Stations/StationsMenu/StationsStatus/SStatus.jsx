
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Image, Alert, RefreshControl, Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../../config/supabase';
import { notifyRespondersOnStatusChange, fetchReportData } from '../../../services/responderNotificationService';
import { notifyRespondersOnBulkAssignment } from '../../../services/responderAssignmentNotification';
import { notifyAllUsersOnStatusChange } from '../../../services/universalNotificationService';
import { checkStationIsBusy, handleAssignmentResponse, requestForwarding } from '../../../utils/assignmentHelpers';

export default function SStatus({ reportIdToOpen, onReportOpened }) {
  const insets = useSafeAreaInsets();
  const [stationId, setStationId] = useState(null);
  const [stationName, setStationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [aiChatSuggestions, setAiChatSuggestions] = useState([]);
  const [chatAlarmByReport, setChatAlarmByReport] = useState({});
  
  // Alarm system state
  const [sound, setSound] = useState(null);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const knownReportIds = useRef(new Set());
  const alarmedReportIds = useRef(new Set()); // Track which reports have already triggered alarm
  const isInitialLoad = useRef(true);
  
  // Statistics
  const [totalReports, setTotalReports] = useState(0);
  const [activeReports, setActiveReports] = useState(0);
  const [resolvedReports, setResolvedReports] = useState(0);
  const [forwardedReports, setForwardedReports] = useState(0);

  // Search, filters and reports
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All | On Going | Under Control | Fire Out
  const [reports, setReports] = useState([]);
  const [assignedRespondersByReport, setAssignedRespondersByReport] = useState({});
  const [responders, setResponders] = useState([]);
  const [responderSelection, setResponderSelection] = useState({}); // reportId -> Set(ids)
  const [responderExisting, setResponderExisting] = useState({});
  const [isAssigning, setIsAssigning] = useState(false);
  const [isEditingAssignments, setIsEditingAssignments] = useState(false);
  
  // Assignment acceptance/decline modals
  const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
  const [showForwardingRequestModal, setShowForwardingRequestModal] = useState(false);
  const [pendingAssignmentData, setPendingAssignmentData] = useState(null);
  
  // Track which assignments have already been shown in modals (to prevent duplicates)
  const shownAssignmentsRef = useRef(new Set()); // Set of assignment IDs that have been shown

  const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';

  // Format time helper
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return 'Unknown';
    }
  };

  // Minutes ago helper
  const minutesAgo = (timestamp) => {
    try {
      const d = new Date(timestamp);
      const mins = Math.floor((Date.now() - d) / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } catch {
      return 'Unknown';
    }
  };

  // Full date-time helper (matches Admin Overview style)
  const formatFullDateTime = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Unknown time';
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch {
      return 'Unknown time';
    }
  };

  // Configure notification handler
  useEffect(() => {
    const setupNotifications = async () => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Notification permissions not granted');
      } else {
        console.log('✅ Notification permissions granted');
      }

      // Configure Android notification channel for alarm level changes
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('alarm-level-changes', {
            name: 'Alarm Level Changes',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'default',
            description: 'Notifications for fire alarm level changes',
          });
          console.log('✅ Android notification channel configured for alarm level changes');
        } catch (error) {
          console.error('❌ Error setting up Android notification channel:', error);
        }
      }
    };

    setupNotifications();

    // Configure audio session
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });
      } catch (error) {
        console.error('❌ Error configuring audio:', error);
      }
    };
    configureAudio();
  }, []);

  // Play alarm sound with vibration
  const playAlarm = async (report) => {
    try {
      console.log('🚨 Playing fire alarm for report:', report.id);
      
      // Stop any existing alarm
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      // Load and play the alarm sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        require('../../../../assets/sounds/fire_alarm_sound.mp3'),
        { isLooping: true, volume: 1.0 },
        (status) => {
          if (status.didJustFinish && !status.isLooping) {
            setIsAlarmPlaying(false);
          }
        }
      );
      
      setSound(newSound);
      await newSound.playAsync();
      setIsAlarmPlaying(true);

      // Start vibration pattern (vibrate for 1 second, pause 0.5 seconds, repeat)
      const vibrationPattern = [0, 1000, 500];
      Vibration.vibrate(vibrationPattern, true);

      // Send push notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 NEW FIRE REPORT',
          body: `Location: ${report.location}\nStatus: ${report.status}\nAlarm Level: ${report.finalAlarmLevel}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { reportId: report.id },
        },
        trigger: null, // Immediate notification
      });

      console.log('✅ Alarm, vibration, and notification triggered');
    } catch (error) {
      console.error('❌ Error playing alarm:', error);
    }
  };

  // Stop alarm
  const stopAlarm = async () => {
    try {
      console.log('🛑 Stopping alarm');
      
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }
      
      Vibration.cancel();
      setIsAlarmPlaying(false);
    } catch (error) {
      console.error('❌ Error stopping alarm:', error);
    }
  };

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      Vibration.cancel();
    };
  }, [sound]);

  // Get station ID from AsyncStorage
  useEffect(() => {
    const loadStationData = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const id = userData?.id || userData?.uid;
          if (id) {
            setStationId(id);
            setStationName(userData?.station_name || 'Fire Station');
            console.log('📱 Station Overview: Station ID loaded:', id);
          } else {
            console.warn('📱 Station Overview: User data found but no ID available');
            setLoading(false);
          }
        } else {
          console.warn('📱 Station Overview: No user data found in AsyncStorage');
          setLoading(false);
        }
      } catch (err) {
        console.error('📱 Station Overview: Error loading station data:', err);
        setLoading(false);
        // Only show alert if this seems like a persistent issue, not during initial load
        setTimeout(() => {
          Alert.alert('❌ Error', `Error loading station data: ${err.message}`);
        }, 1000);
      }
    };
    loadStationData();
  }, []);

  // Load AI suggestions from messages table
  // Optimized: Only query messages for reports assigned to this station or its responders
  useEffect(() => {
    if (!stationId) return;
    
    const loadAiSuggestions = async () => {
      try {
        // Get all report IDs assigned to this station and its responders
        const [stationAssignments, responderData] = await Promise.all([
          supabase
            .from('report_assignments')
            .select('report_id')
            .eq('assignee_type', 'station')
            .eq('assignee_id', stationId),
          supabase
            .from('responders')
            .select('id')
            .eq('station_id', stationId)
        ]);

        let reportIds = new Set();
        
        // Add station's directly assigned reports
        if (stationAssignments.data) {
          stationAssignments.data.forEach(a => reportIds.add(String(a.report_id)));
        }

        // Get responder assignments
        if (responderData.data && responderData.data.length > 0) {
          const responderIds = responderData.data.map(r => r.id);
          const { data: responderAssignments } = await supabase
            .from('responder_notifications')
            .select('fire_report_id')
            .in('responder_id', responderIds)
            .in('status', ['pending', 'accepted']);
          
          if (responderAssignments) {
            responderAssignments.forEach(a => reportIds.add(String(a.fire_report_id)));
          }
        }

        // Add forwarded reports
        const { data: forwarded } = await supabase
          .from('report_routes')
          .select('report_id')
          .eq('target', `station:${stationId}`);
        
        if (forwarded) {
          forwarded.forEach(f => reportIds.add(String(f.report_id)));
        }

        // If no reports assigned, return early
        if (reportIds.size === 0) {
          setAiChatSuggestions([]);
          return;
        }

        // Query only messages for these specific reports
        const reportIdsArray = Array.from(reportIds);
        const { data, error } = await supabase
          .from('messages')
          .select('id, ai_suggested_alarm, suggested_alarm_level, created_at, report_id')
          .not('ai_suggested_alarm', 'is', null)
          .in('report_id', reportIdsArray)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (!error) {
          console.log(`📱 AI Suggestions: Loaded ${data?.length || 0} suggestions for ${reportIds.size} assigned reports`);
          setAiChatSuggestions(data || []);
        }
      } catch (err) {
        console.error('📱 Error loading AI suggestions:', err);
      }
    };
    
    loadAiSuggestions();
    
    // Fast polling - every 2 seconds for real-time operations
    const interval = setInterval(loadAiSuggestions, 2000);
    
    // Real-time subscription for instant updates
    const subscription = supabase
      .channel('ai_suggestions_mobile_station')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: 'ai_suggested_alarm=not.is.null'
      }, () => {
        console.log('🔔 Real-time: AI suggestion detected, reloading...');
        loadAiSuggestions();
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [stationId]);

  // Listen for alarm level change notifications and update reports
  useEffect(() => {
    if (!stationId) {
      // Station ID is still loading from AsyncStorage, wait for it
      console.log('📱 Station Overview: Waiting for station ID to load...');
      return;
    }

    console.log('📱 Station Overview: Setting up alarm level change listener for station:', stationId);

    const channel = supabase
      .channel(`station-alarm-level-changes:${stationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${stationId}`
      }, async (payload) => {
        console.log('🔔 Notification received:', payload.new);
        
        const notification = payload.new;
        
        // Check if this is an alarm level change notification for this station
        if (notification.user_type === 'station' && notification.type === 'alarm_level_change') {
          console.log('✅ Alarm level change notification detected!');
          
          // Show alert for debugging (remove in production)
          Alert.alert(
            '🔔 Alarm Level Changed',
            `Notification received!\n\nTitle: ${notification.title || 'N/A'}\nReport ID: ${notification.related_report_id || 'N/A'}`,
            [{ text: 'OK' }]
          );
          
          const reportId = notification.related_report_id;
          
          if (reportId) {
            // Check permissions before sending notification
            try {
              const { status } = await Notifications.getPermissionsAsync();
              if (status !== 'granted') {
                console.warn('⚠️ Notification permissions not granted, requesting...');
                Alert.alert('Permission Needed', 'Requesting notification permission...');
                const { status: newStatus } = await Notifications.requestPermissionsAsync();
                if (newStatus !== 'granted') {
                  Alert.alert('Permission Denied', 'Notification permission was denied. Please enable it in settings.');
                  return;
                }
              }

              // Send push notification
              const notificationConfig = {
                content: {
                  title: notification.title || '⚠️ Alarm Level Changed',
                  body: notification.message || 'The fire alarm level has been updated',
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                  data: {
                    type: 'alarm_level_change',
                    reportId: reportId,
                    notificationId: notification.id,
                  },
                },
                trigger: null, // Immediate notification
              };

              // Add Android channel if on Android
              if (Platform.OS === 'android') {
                notificationConfig.content.android = {
                  channelId: 'alarm-level-changes',
                  priority: 'high',
                  sound: true,
                  vibrate: [0, 250, 250, 250],
                };
              }

              const notificationId = await Notifications.scheduleNotificationAsync(notificationConfig);
              console.log('✅ Push notification sent for alarm level change');
              
              // Show success alert for debugging
              Alert.alert(
                '✅ Notification Sent',
                `Push notification scheduled!\nNotification ID: ${notificationId}`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('❌ Error sending push notification:', error);
              Alert.alert(
                '❌ Error',
                `Failed to send notification:\n${error.message || 'Unknown error'}`,
                [{ text: 'OK' }]
              );
            }

            // Reload reports to get updated alarm level
            console.log('🔄 Reloading reports to reflect alarm level change...');
            await loadAssignedReports();
          } else {
            console.log('⚠️ Warning: Notification received but no report ID found');
          }
        } else {
          console.log('📱 Notification received (not alarm level change):', notification);
        }
      })
      .subscribe((status, err) => {
        console.log('📱 Station Overview: Alarm level change subscription status:', status);
        console.log('📱 Station Overview: Subscription error (if any):', err);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [stationId, loadAssignedReports]);

  // Compute strongest AI alarm per report
  useEffect(() => {
    const toStrength = (label) => {
      const map = {
        'Under Control': 0, '1st Alarm': 1, '2nd Alarm': 2, '3rd Alarm': 3,
        '4th Alarm': 4, '5th Alarm': 5, 'TASK FORCE ALPHA': 6,
        'TASK FORCE BRAVO': 7, 'TASK FORCE CHARLIE': 8,
        'TASK FORCE DELTA': 9, 'GENERAL ALARM': 10
      };
      return map[label] ?? 0;
    };
    
    const normalizeAiLabel = (aiValue, suggestedAlarmLevel) => {
      if (suggestedAlarmLevel && suggestedAlarmLevel !== 'NONE') {
        const normalized = suggestedAlarmLevel.toLowerCase().trim();
        const map = {
          'none': 'Under Control', 'first': '1st Alarm', 'first_alarm': '1st Alarm',
          '1st alarm': '1st Alarm', 'second': '2nd Alarm', 'second_alarm': '2nd Alarm',
          '2nd alarm': '2nd Alarm', 'third': '3rd Alarm', 'third_alarm': '3rd Alarm',
          '3rd alarm': '3rd Alarm', 'fourth': '4th Alarm', 'fourth_alarm': '4th Alarm',
          '4th alarm': '4th Alarm', 'fifth': '5th Alarm', 'fifth_alarm': '5th Alarm',
          '5th alarm': '5th Alarm', 'task_force_alpha': 'TASK FORCE ALPHA',
          'task_force_bravo': 'TASK FORCE BRAVO', 'task_force_charlie': 'TASK FORCE CHARLIE',
          'task_force_delta': 'TASK FORCE DELTA', 'general': 'GENERAL ALARM',
          'general_alarm': 'GENERAL ALARM'
        };
        return map[normalized] || suggestedAlarmLevel;
      }
      return null;
    };

    // Use MOST RECENT suggestion per report (not strongest) to match real-time chat context
    const bestByReport = {};
    const messageTimestamps = {};
    (aiChatSuggestions || []).forEach((m) => {
      const reportId = m.report_id;
      if (!reportId) return;
      const reportIdStr = String(reportId);
      const label = normalizeAiLabel(m.ai_suggested_alarm, m.suggested_alarm_level);
      if (!label) return;
      
      const currentTimestamp = messageTimestamps[reportIdStr];
      const newTimestamp = new Date(m.created_at).getTime();
      
      // Keep the most recent message (highest timestamp)
      if (!currentTimestamp || newTimestamp > currentTimestamp) {
        bestByReport[reportIdStr] = label;
        messageTimestamps[reportIdStr] = newTimestamp;
      }
    });
    setChatAlarmByReport(bestByReport);
  }, [aiChatSuggestions]);

  // Unified load function - combines both previous loads
  const loadAssignedReports = useCallback(async () => {
    if (!stationId) return;
    
    try {
      setLoading(true);
      console.log('📱 Station Overview: Loading reports for station:', stationId);

      // Fetch station assignments
      const { data: stationAssignments, error: assignError } = await supabase
        .from('report_assignments')
        .select('report_id, assigned_at, note')
        .eq('assignee_type', 'station')
        .eq('assignee_id', stationId);

      if (assignError) {
        console.error('📱 Station Overview: Error fetching assignments:', assignError);
      }

      // Fetch responders of this station
      const { data: stationResponders } = await supabase
        .from('responders')
        .select('id')
        .eq('station_id', stationId);
      const responderIds = (stationResponders || []).map(r => r.id);

      // Fetch responder assignments
      let responderAssignments = [];
      if (responderIds.length > 0) {
        const { data: respAssigns } = await supabase
          .from('report_assignments')
          .select('report_id')
          .eq('assignee_type', 'responder')
          .in('assignee_id', responderIds);
        responderAssignments = respAssigns || [];
      }

      // Fetch forwards
      const { data: forwarded, error: forwardError } = await supabase
        .from('report_routes')
        .select('report_id, forwarded_at, note')
        .eq('target', `station:${stationId}`);

      if (forwardError) {
        console.error('📱 Station Overview: Error fetching forwards:', forwardError);
      }

      // Create metadata maps
      const forwardedMetadata = new Map();
      (forwarded || []).forEach(f => {
        forwardedMetadata.set(String(f.report_id), {
          note: f.note,
          forwarded_at: f.forwarded_at
        });
      });

      // Combine all IDs
      const ids = new Set([
        ...((stationAssignments || []).map(a => String(a.report_id))),
        ...((responderAssignments || []).map(a => String(a.report_id))),
        ...((forwarded || []).map(f => String(f.report_id)))
      ]);

      console.log(`📱 Station Overview: ${ids.size} total reports`);

      if (ids.size === 0) {
        setReports([]);
        setTotalReports(0);
        setActiveReports(0);
        setResolvedReports(0);
        setForwardedReports(0);
        return;
      }

      // Fetch fire reports from API
      const resp = await fetch(`${API_URL}/get_reports`);
      const data = resp.ok ? await resp.json() : [];
      
      // Filter and map reports
      const filtered = (data || []).filter(r => ids.has(String(r.id)));
      const mapped = filtered.map(r => {
        const forwardingInfo = forwardedMetadata.get(String(r.id));
        const aiOverride = chatAlarmByReport[String(r.id)];
        const suggested = aiOverride || r.recommended_alarm_level || r.alarm_level || '';
        const normalizedSuggested = suggested && suggested.toLowerCase().startsWith('unknown') ? 'Unknown' : (suggested || 'Unknown');
        return {
          id: r.id,
          time: formatTime(r.formatted_timestamp || r.created_at),
          reporter: r.reporter_name || r.reporter || 'Unknown Reporter',
          location: r.address || r.geotag_location || 'Location unavailable',
          status: r.status || 'On Going',
          suggestedAlarmLevel: normalizedSuggested,
          finalAlarmLevel: r.final_fire_alarm_level || '1st Alarm',
          description: r.cause_of_fire || r.cause || 'No cause specified',
          picture: r.image_url,
          minutesAgoText: minutesAgo(r.created_at || r.timestamp),
          prediction: r.prediction,
          confidence: r.confidence,
          structure: r.structure_type || r.structure,
          structure_confidence: r.structure_confidence,
          smokeIntensity: r.smoke_intensity,
          smokeConfidence: r.smoke_confidence,
          numberOfStructures: r.structures_affected || r.number_of_structures_on_fire,
          timestamp: r.created_at || r.timestamp,
          latitude: r.latitude,
          longitude: r.longitude,
          smoke_analysis: r.smoke_analysis,
          is_forwarded: !!forwardingInfo,
          forwarding_note: forwardingInfo?.note,
          forwarded_at: forwardingInfo?.forwarded_at
        };
      });

      // Sort by timestamp
      const sorted = mapped.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      setReports(sorted);

      // Check for new reports and trigger alarm (only after initial load)
      if (isInitialLoad.current) {
        // On first load, just record all existing report IDs without triggering alarm
        console.log('📋 Initial load: Recording existing reports without alarm');
        sorted.forEach((report) => {
          const reportId = String(report.id);
          knownReportIds.current.add(reportId);
          alarmedReportIds.current.add(reportId); // Also mark as already processed for alarm
        });
        isInitialLoad.current = false;
      } else {
        // After initial load, check for genuinely new reports
        sorted.forEach((report) => {
          const reportId = String(report.id);
          if (!knownReportIds.current.has(reportId)) {
            // New report detected!
            console.log('🚨 NEW FIRE REPORT DETECTED:', reportId);
            knownReportIds.current.add(reportId);
            
            // Only trigger alarm ONCE per report (check if not already alarmed)
            if (!alarmedReportIds.current.has(reportId)) {
              const status = (report.status || '').toLowerCase();
              const isActive = !status.includes('fire out') && !status.includes('cancelled') && !status.includes('resolved');
              
              if (isActive) {
                alarmedReportIds.current.add(reportId); // Mark as alarmed
                playAlarm(report);
              }
            }
          }
        });
      }

      // Calculate statistics
      setTotalReports(sorted.length);
      setActiveReports(sorted.filter(r => {
        const status = (r.status || '').toLowerCase();
        return status.includes('on going') || status.includes('ongoing') || !status.includes('out');
      }).length);
      setResolvedReports(sorted.filter(r => {
        const status = (r.status || '').toLowerCase();
        return status.includes('fire out') || status.includes('resolved');
      }).length);
      setForwardedReports(sorted.filter(r => r.is_forwarded).length);

      // Load assigned responders per report
      const idArr = [...ids];
      const { data: ra } = await supabase
        .from('report_assignments')
        .select('report_id, assignee_id')
        .in('report_id', idArr)
        .eq('assignee_type', 'responder');
      
      const byReport = ra?.reduce((acc, row) => {
        const rid = String(row.report_id);
        (acc[rid] = acc[rid] || []).push(row.assignee_id);
        return acc;
      }, {}) || {};

      // Resolve names
      const allResponderIds = Array.from(new Set(Object.values(byReport).flat()));
      if (allResponderIds.length) {
        const { data: respInfo } = await supabase
          .from('responders')
          .select('id, first_name, last_name')
          .in('id', allResponderIds);
        const nameMap = new Map((respInfo||[]).map(r => [r.id, `${r.first_name||''} ${r.last_name||''}`.trim() || 'Responder']));
        const labeled = Object.fromEntries(Object.entries(byReport).map(([rid, arr]) => [rid, arr.map(id => nameMap.get(id) || 'Responder')]));
        setAssignedRespondersByReport(labeled);
      } else {
        setAssignedRespondersByReport({});
      }

    } catch (error) {
      console.error('📱 Station Overview: Error loading reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [stationId, chatAlarmByReport]);

  // Load reports on mount and when stationId changes
  useEffect(() => {
    if (stationId) {
      loadAssignedReports();
    }
  }, [stationId, loadAssignedReports]);

  // Load responders for this station for assignment UI
  useEffect(() => {
    const loadResponders = async () => {
      try {
        if (!stationId) return;
        const { data, error } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email')
          .eq('station_id', stationId);
        if (!error) setResponders(data || []);
      } catch (_) {}
    };
    loadResponders();
  }, [stationId]);

  // Check for existing pending assignments on mount (in case assignment was created before listener was ready)
  useEffect(() => {
    if (!stationId) return;

    const checkPendingAssignments = async () => {
      try {
        console.log('🔍 SStatus: Checking for existing pending assignments...');
        const { data: pendingAssignments, error } = await supabase
          .from('report_assignments')
          .select('*')
          .eq('assignee_type', 'station')
          .eq('assignee_id', stationId)
          .eq('status', 'pending');

        if (error) {
          console.error('❌ Error checking pending assignments:', error);
          return;
        }

        if (pendingAssignments && pendingAssignments.length > 0) {
          console.log(`✅ Found ${pendingAssignments.length} pending assignment(s)`);
          
          // Process the first pending assignment
          const assignment = pendingAssignments[0];
          
          // Check if we've already shown a modal for this assignment
          const assignmentKey = `${assignment.report_id}-${assignment.id}`;
          if (shownAssignmentsRef.current.has(assignmentKey)) {
            console.log('⏭️ SStatus: Modal already shown for this assignment (mount check), skipping:', assignmentKey);
            return;
          }
          
          // Check if modal is already showing
          if (showAcceptanceModal || showForwardingRequestModal) {
            console.log('⏭️ SStatus: Another modal is already showing (mount check), skipping');
            return;
          }
          
          // Mark this assignment as shown
          shownAssignmentsRef.current.add(assignmentKey);
          
          // Fetch report data
          const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
          const reports = response.ok ? await response.json() : [];
          const reportData = reports.find(r => String(r.id) === String(assignment.report_id));

          // Check if station is busy
          const busyCheck = await checkStationIsBusy(stationId);
          
          if (!busyCheck.isBusy) {
            // Station is free - auto-accept regardless of assignment source
            console.log('✅ Station is free - auto-accepting existing pending assignment');
            await handleAssignmentResponse(assignment.report_id, stationId, 'accepted');
            // Remove from shown set since we auto-accepted
            shownAssignmentsRef.current.delete(assignmentKey);
          } else if (assignment.assignment_source === 'manual') {
            // Admin assigned and station is busy - show acceptance modal
            console.log('✅ Showing acceptance modal for existing pending assignment (station busy)');
            setPendingAssignmentData({
              reportId: assignment.report_id,
              assignmentSource: 'manual',
              reportData: reportData,
              assignmentId: assignment.id
            });
            setShowAcceptanceModal(true);
          } else if (assignment.assignment_source === 'automatic') {
            // Auto-assigned and station is busy - show forwarding request modal
            setPendingAssignmentData({
              reportId: assignment.report_id,
              assignmentSource: 'automatic',
              reportData: reportData,
              assignmentId: assignment.id,
              busyCount: busyCheck.busyCount
            });
            setShowForwardingRequestModal(true);
          }
        } else {
          console.log('ℹ️ No pending assignments found');
        }
      } catch (error) {
        console.error('❌ Error checking pending assignments:', error);
      }
    };

    // Check after a short delay to ensure stationId is set
    const timeoutId = setTimeout(checkPendingAssignments, 1000);
    return () => clearTimeout(timeoutId);
  }, [stationId]);

  // Real-time listener for new assignments (for acceptance/decline modals)
  useEffect(() => {
    if (!stationId) {
      console.log('⚠️ SStatus: No stationId, skipping real-time listener setup');
      return;
    }

    console.log('🔔 SStatus: Setting up real-time listener for station:', stationId);

    const channel = supabase
      .channel(`station-assignments-status-${stationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'report_assignments' 
      }, async (payload) => {
        try {
          console.log('📥 SStatus: Received INSERT event:', payload);
          const row = payload?.new;
          if (!row) {
            console.log('⚠️ SStatus: No row data in payload');
            return;
          }
          
          console.log('📋 SStatus: Assignment row:', {
            assignee_type: row.assignee_type,
            assignee_id: row.assignee_id,
            stationId: stationId,
            status: row.status,
            assignment_source: row.assignment_source
          });
          
          if (row.assignee_type === 'station' && String(row.assignee_id) === String(stationId)) {
            console.log('✅ SStatus: Assignment matches this station!');
            console.log('🚨 New assignment received in SStatus:', row);
            
            // Fetch report data
            const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
            const reports = response.ok ? await response.json() : [];
            const reportData = reports.find(r => String(r.id) === String(row.report_id));

            // Check if assignment is pending (needs approval)
            if (row.status === 'pending') {
              // Check if we've already shown a modal for this assignment
              const assignmentKey = `${row.report_id}-${row.id}`;
              if (shownAssignmentsRef.current.has(assignmentKey)) {
                console.log('⏭️ SStatus: Modal already shown for this assignment, skipping:', assignmentKey);
                return;
              }
              
              // Check if modal is already showing for another assignment
              if (showAcceptanceModal || showForwardingRequestModal) {
                console.log('⏭️ SStatus: Another modal is already showing, skipping');
                return;
              }
              
              console.log('📋 Assignment is pending, checking if station is busy...');
              
              // Mark this assignment as shown
              shownAssignmentsRef.current.add(assignmentKey);
              
              // Check if station is busy
              const busyCheck = await checkStationIsBusy(stationId);
              
              if (!busyCheck.isBusy) {
                // Station is free - auto-accept regardless of assignment source
                console.log('✅ Station is free - auto-accepting assignment');
                await handleAssignmentResponse(row.report_id, stationId, 'accepted');
                // Remove from shown set since we auto-accepted
                shownAssignmentsRef.current.delete(assignmentKey);
              } else if (row.assignment_source === 'manual') {
                // Admin assigned and station is busy - show acceptance modal
                console.log('✅ Showing acceptance modal for manual assignment (station busy)');
                setPendingAssignmentData({
                  reportId: row.report_id,
                  assignmentSource: 'manual',
                  reportData: reportData,
                  assignmentId: row.id
                });
                setShowAcceptanceModal(true);
              } else if (row.assignment_source === 'automatic') {
                // Auto-assigned and station is busy - show forwarding request modal
                console.log('✅ Showing forwarding request modal for auto-assignment (station busy)');
                setPendingAssignmentData({
                  reportId: row.report_id,
                  assignmentSource: 'automatic',
                  reportData: reportData,
                  assignmentId: row.id,
                  busyCount: busyCheck.busyCount
                });
                setShowForwardingRequestModal(true);
              }
            } else {
              console.log('ℹ️ Assignment status is not pending:', row.status);
            }
          } else {
            console.log('❌ SStatus: Assignment does not match this station');
          }
        } catch (e) {
          console.error('❌ Station status: RT assignment handler error:', e);
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'report_assignments',
        filter: `assignee_type=eq.station&assignee_id=eq.${stationId}`
      }, async (payload) => {
        try {
          const row = payload?.new;
          const oldRow = payload?.old;
          if (!row) return;
          if (row.assignee_type === 'station' && String(row.assignee_id) === String(stationId)) {
            // Handle assignments that become pending (e.g., rerouted assignments)
            const wasPending = oldRow?.status === 'pending';
            const isNowPending = row.status === 'pending';
            
            if (isNowPending && !wasPending) {
              console.log('📋 Assignment status changed to pending (rerouted?)');
              
              // Check if we've already shown a modal for this assignment
              const assignmentKey = `${row.report_id}-${row.id}`;
              if (shownAssignmentsRef.current.has(assignmentKey)) {
                console.log('⏭️ SStatus: Modal already shown for this assignment (UPDATE), skipping:', assignmentKey);
                return;
              }
              
              // Check if modal is already showing for another assignment
              if (showAcceptanceModal || showForwardingRequestModal) {
                console.log('⏭️ SStatus: Another modal is already showing (UPDATE), skipping');
                return;
              }
              
              // Fetch report data
              const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
              const reports = response.ok ? await response.json() : [];
              const reportData = reports.find(r => String(r.id) === String(row.report_id));

              // Check if station is busy
              const busyCheck = await checkStationIsBusy(stationId);
              
              // Mark this assignment as shown
              shownAssignmentsRef.current.add(assignmentKey);
              
              if (!busyCheck.isBusy) {
                // Station is free - auto-accept regardless of assignment source
                console.log('✅ Station is free - auto-accepting rerouted assignment');
                await handleAssignmentResponse(row.report_id, stationId, 'accepted');
                // Remove from shown set since we auto-accepted
                shownAssignmentsRef.current.delete(assignmentKey);
              } else if (row.assignment_source === 'manual') {
                // Admin assigned (including rerouted) and station is busy - show acceptance modal
                console.log('✅ Showing acceptance modal for rerouted assignment (station busy)');
                setPendingAssignmentData({
                  reportId: row.report_id,
                  assignmentSource: 'manual',
                  reportData: reportData,
                  assignmentId: row.id
                });
                setShowAcceptanceModal(true);
              } else if (row.assignment_source === 'automatic') {
                // Auto-assigned and station is busy - show forwarding request modal
                setPendingAssignmentData({
                  reportId: row.report_id,
                  assignmentSource: 'automatic',
                  reportData: reportData,
                  assignmentId: row.id,
                  busyCount: busyCheck.busyCount
                });
                setShowForwardingRequestModal(true);
              }
            }
            
            // If assignment was declined or accepted, remove from shown set (allows new assignment for same report)
            if ((row.status === 'declined' || row.status === 'accepted') && 
                row.assignee_type === 'station' && 
                String(row.assignee_id) === String(stationId)) {
              const assignmentKey = `${row.report_id}-${row.id}`;
              shownAssignmentsRef.current.delete(assignmentKey);
              console.log('🗑️ SStatus: Removed assignment from shown set (responded):', assignmentKey);
            }
            
            // If assignment was declined, mark notification as read to stop alarm
            if (row.status === 'declined' && 
                row.assignee_type === 'station' && 
                String(row.assignee_id) === String(stationId)) {
              try {
                await supabase
                  .from('notifications')
                  .update({ is_read: true })
                  .eq('user_id', stationId)
                  .eq('user_type', 'station')
                  .eq('type', 'assignment')
                  .eq('related_report_id', String(row.report_id))
                  .eq('is_read', false);
              } catch (notifError) {
                console.error('Error marking notification as read:', notifError);
              }
            }
          }
        } catch (e) {
          console.error('❌ Station status: RT assignment update handler error:', e);
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ SStatus: Subscription error:', err);
        } else {
          console.log('✅ SStatus: Subscription status:', status);
        }
      });

    return () => {
      console.log('🔕 SStatus: Cleaning up real-time listener');
      supabase.removeChannel(channel);
    };
  }, [stationId]);

  // Handle opening a specific report from notification
  useEffect(() => {
    const openSpecificReport = async () => {
      if (!reportIdToOpen || !stationId) return;

      console.log('📍 Opening specific report from notification:', reportIdToOpen);

      try {
        // IMPORTANT: Mark this report as already processed for alarm to prevent retriggering
        const reportIdStr = String(reportIdToOpen);
        if (!alarmedReportIds.current.has(reportIdStr)) {
          alarmedReportIds.current.add(reportIdStr);
          console.log('🔕 Marking report as already alarmed to prevent duplicate alarm:', reportIdStr);
        }
        if (!knownReportIds.current.has(reportIdStr)) {
          knownReportIds.current.add(reportIdStr);
        }

        // Find the report in the current reports list
        const report = reports.find(r => String(r.id) === String(reportIdToOpen));

        if (report) {
          console.log('✅ Found report in list, opening modal');
          setSelectedReport(report);
          setIsEditingAssignments(false);

          // Preload assigned responders for this report
          const rid = String(report.id);
          
          // 1) Assignments table (mobile flow)
          const { data: assigns } = await supabase
            .from('report_assignments')
            .select('assignee_id')
            .eq('report_id', rid)
            .eq('assignee_type', 'responder');
          const ids = new Set((assigns || []).map(a => a.assignee_id));

          // 2) Notifications table (web flow) – pending/accepted responders
          const { data: notifAssigns } = await supabase
            .from('responder_notifications')
            .select('responder_id,status')
            .eq('fire_report_id', rid)
            .in('status', ['pending', 'accepted']);
          (notifAssigns || []).forEach(n => ids.add(n.responder_id));

          setResponderExisting(prev => ({ ...prev, [rid]: new Set(ids) }));
          setResponderSelection(prev => ({ ...prev, [rid]: new Set(ids) }));

          setShowReportModal(true);
          
          // Notify parent that report has been opened
          if (onReportOpened) {
            onReportOpened();
          }
        } else {
          console.log('⚠️ Report not found in current list, fetching from API');
          
          // Fetch from API if not in list
          const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';
          const response = await fetch(`${API_URL}/get_reports`);
          const allReports = await response.json();
          const fetchedReport = allReports.find(r => String(r.id) === String(reportIdToOpen));

          if (fetchedReport) {
            // Map the report to match the expected format
            const aiOverride = chatAlarmByReport[String(fetchedReport.id)];
            const suggested = aiOverride || fetchedReport.recommended_alarm_level || fetchedReport.alarm_level || '';
            const normalizedSuggested = suggested && suggested.toLowerCase().startsWith('unknown') ? 'Unknown' : (suggested || 'Unknown');
            
            const mappedReport = {
              id: fetchedReport.id,
              time: formatTime(fetchedReport.formatted_timestamp || fetchedReport.created_at),
              reporter: fetchedReport.reporter_name || fetchedReport.reporter || 'Unknown Reporter',
              location: fetchedReport.address || fetchedReport.geotag_location || 'Location unavailable',
              status: fetchedReport.status || 'On Going',
              suggestedAlarmLevel: normalizedSuggested,
              finalAlarmLevel: fetchedReport.final_fire_alarm_level || '1st Alarm',
              description: fetchedReport.cause_of_fire || fetchedReport.cause || 'No cause specified',
              picture: fetchedReport.image_url,
              minutesAgoText: minutesAgo(fetchedReport.created_at || fetchedReport.timestamp),
              prediction: fetchedReport.prediction,
              confidence: fetchedReport.confidence,
              structure: fetchedReport.structure_type || fetchedReport.structure,
              structure_confidence: fetchedReport.structure_confidence,
              smokeIntensity: fetchedReport.smoke_intensity,
              smokeConfidence: fetchedReport.smoke_confidence,
              numberOfStructures: fetchedReport.structures_affected || fetchedReport.number_of_structures_on_fire,
              timestamp: fetchedReport.created_at || fetchedReport.timestamp,
              latitude: fetchedReport.latitude,
              longitude: fetchedReport.longitude,
              smoke_analysis: fetchedReport.smoke_analysis,
            };

            setSelectedReport(mappedReport);
            setShowReportModal(true);
            
            if (onReportOpened) {
              onReportOpened();
            }
          } else {
            Alert.alert('Report Not Found', 'Unable to find this fire report.');
            if (onReportOpened) {
              onReportOpened();
            }
          }
        }
      } catch (error) {
        console.error('❌ Error opening specific report:', error);
        Alert.alert('Error', 'Unable to open fire report details');
        if (onReportOpened) {
          onReportOpened();
        }
      }
    };

    openSpecificReport();
  }, [reportIdToOpen, reports, stationId, chatAlarmByReport]);

  // Filter reports based on search and status
  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      // status chip filter
      if (statusFilter !== 'All') {
        const st = (r.status || '').toLowerCase();
        if (statusFilter === 'On Going' && !(st.includes('on going') || st.includes('ongoing'))) return false;
        if (statusFilter === 'Under Control' && !st.includes('under control')) return false;
        if (statusFilter === 'Fire Out' && !st.includes('fire out')) return false;
      }
      // search
      if (!q) return true;
      return (r.location || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
    });
  }, [reports, searchQuery, statusFilter]);

  // Get status color
  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower.includes('fire out') || statusLower.includes('resolved')) {
      return { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' };
    }
    if (statusLower.includes('under control')) {
      return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
    }
    if (statusLower.includes('on going') || statusLower.includes('ongoing')) {
      return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
    }
    return { bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db' };
  };

  // Get alarm level color
  const getAlarmLevelColor = (level) => {
    const levelStr = String(level || '');
    if (levelStr.includes('General Alarm')) {
      return { bg: '#dc2626', text: '#ffffff', border: '#991b1b' };
    }
    if (levelStr.includes('5th') || levelStr.includes('TASK FORCE')) {
      return { bg: '#a855f7', text: '#ffffff', border: '#7e22ce' };
    }
    if (levelStr.includes('4th')) {
      return { bg: '#8b5cf6', text: '#ffffff', border: '#6d28d9' };
    }
    if (levelStr.includes('3rd')) {
      return { bg: '#ef4444', text: '#ffffff', border: '#dc2626' };
    }
    if (levelStr.includes('2nd')) {
      return { bg: '#f97316', text: '#ffffff', border: '#ea580c' };
    }
    if (levelStr.includes('1st')) {
      return { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' };
    }
    return { bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db' };
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        style={{ paddingTop: insets.top + 60 }}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadAssignedReports} />
        }
      >
        {/* Header */}
        <View className="px-4 py-4">
          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-800 mb-1">{stationName}</Text>
              <Text className="text-gray-500">Fire Reports Overview</Text>
            </View>
            
            {/* Alarm Indicator and Stop Button */}
            {isAlarmPlaying && (
              <TouchableOpacity
                onPress={stopAlarm}
                className="bg-red-600 px-4 py-3 rounded-xl flex-row items-center shadow-lg"
                style={{ elevation: 5 }}
              >
                <MaterialIcons name="volume-off" size={24} color="white" />
                <Text className="text-white font-bold ml-2">Stop Alarm</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Statistics Cards */}
        <View className="px-4 mb-4">
          <View className="flex-row flex-wrap">
            {/* Total Reports */}
            <View className="w-1/2 p-2">
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons name="assignment" size={24} color="#3b82f6" />
                  <Text className="text-2xl font-bold text-gray-800">{totalReports}</Text>
                </View>
                <Text className="text-gray-600 text-sm">Total Reports</Text>
              </View>
            </View>

            {/* Active Reports */}
            <View className="w-1/2 p-2">
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons name="local-fire-department" size={24} color="#ef4444" />
                  <Text className="text-2xl font-bold text-red-600">{activeReports}</Text>
                </View>
                <Text className="text-gray-600 text-sm">Active</Text>
              </View>
            </View>

            {/* Resolved Reports */}
            <View className="w-1/2 p-2">
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons name="check-circle" size={24} color="#10b981" />
                  <Text className="text-2xl font-bold text-green-600">{resolvedReports}</Text>
                </View>
                <Text className="text-gray-600 text-sm">Resolved</Text>
              </View>
            </View>

            {/* Forwarded Reports */}
            <View className="w-1/2 p-2">
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons name="forward" size={24} color="#f59e0b" />
                  <Text className="text-2xl font-bold text-amber-600">{forwardedReports}</Text>
                </View>
                <Text className="text-gray-600 text-sm">Forwarded</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View className="px-4 mb-4">
          <View className="bg-white rounded-xl p-3" style={{ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search reports by location or description..."
              className="text-gray-800"
            />
          </View>
        </View>

        {/* Filters Row */}
        <View className="px-4 mb-3">
          <View className="flex-row">
            {['All', 'On Going', 'Under Control', 'Fire Out'].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatusFilter(s)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  marginRight: 8,
                  backgroundColor: statusFilter === s ? '#fee2e2' : '#f1f5f9'
                }}
              >
                <Text style={{ color: statusFilter === s ? '#b91c1c' : '#334155', fontWeight: '600' }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reports List */}
        <View className="px-4">
          <Text className="text-lg font-bold text-gray-800 mb-3">Fire Reports</Text>
          
          {loading ? (
            <View className="bg-white rounded-xl p-8 shadow-sm items-center">
              <Text className="text-gray-500">Loading reports...</Text>
            </View>
          ) : filteredReports.length === 0 ? (
            <View className="bg-white rounded-xl p-8 shadow-sm items-center">
              <MaterialIcons name="inbox" size={64} color="#9ca3af" />
              <Text className="text-xl font-bold text-gray-600 mt-4 mb-2">No Reports</Text>
              <Text className="text-gray-500 text-center">
                {searchQuery ? 'No reports match your search' : 'No fire reports assigned to your station yet'}
              </Text>
            </View>
          ) : (
            filteredReports.map((report) => {
              const statusColor = getStatusColor(report.status);
              const alarmColor = getAlarmLevelColor(report.finalAlarmLevel || report.suggestedAlarmLevel);
              
              return (
                <TouchableOpacity
                  key={report.id}
                  className="bg-white rounded-xl p-4 mb-3 shadow-sm"
                  onPress={async () => {
                    setSelectedReport(report);
                    setIsEditingAssignments(false); // Reset edit mode when opening report
                    // Preload assigned responders for this report (include web-side notifications)
                    try {
                      const rid = String(report.id);

                      // 1) Assignments table (mobile flow)
                      const { data: assigns } = await supabase
                        .from('report_assignments')
                        .select('assignee_id')
                        .eq('report_id', rid)
                        .eq('assignee_type', 'responder');
                      const ids = new Set((assigns || []).map(a => a.assignee_id));

                      // 2) Notifications table (web flow) – pending/accepted responders
                      const { data: notifAssigns } = await supabase
                        .from('responder_notifications')
                        .select('responder_id,status')
                        .eq('fire_report_id', rid)
                        .in('status', ['pending', 'accepted']);
                      (notifAssigns || []).forEach(n => ids.add(n.responder_id));

                      setResponderExisting(prev => ({ ...prev, [rid]: new Set(ids) }));
                      setResponderSelection(prev => ({ ...prev, [rid]: new Set(ids) }));
                    } catch (_) {}
                    setShowReportModal(true);
                  }}
                >
                  {/* Forwarded Badge */}
                  {report.is_forwarded && (
                    <View className="bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 mb-3 flex-row items-center">
                      <MaterialIcons name="forward" size={16} color="#d97706" />
                      <Text className="text-amber-800 text-xs font-medium ml-2">Forwarded Report</Text>
                    </View>
                  )}

                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900 text-base mb-1">
                        {report.location}
                      </Text>
                      <Text className="text-gray-500 text-sm">{formatFullDateTime(report.timestamp)}</Text>
                    </View>
                    <View style={{ backgroundColor: statusColor.bg, borderColor: statusColor.border }} className="px-3 py-1 rounded-lg border">
                      <Text style={{ color: statusColor.text }} className="text-xs font-bold">
                        {report.status}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="person" size={16} color="#6b7280" />
                    <Text className="text-gray-600 text-sm ml-2">{report.reporter}</Text>
                  </View>

                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <MaterialIcons name="local-fire-department" size={16} color="#dc2626" />
                      <View style={{ backgroundColor: alarmColor.bg, borderColor: alarmColor.border }} className="px-3 py-1 rounded-lg ml-2 border">
                        <Text style={{ color: alarmColor.text }} className="text-xs font-bold">
                          {report.finalAlarmLevel || report.suggestedAlarmLevel || '1st Alarm'}
                        </Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity className="bg-fire px-4 py-2 rounded-lg">
                      <Text className="text-white text-xs font-bold">View Details</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Assigned Responders */}
                  {!!assignedRespondersByReport[String(report.id)] && assignedRespondersByReport[String(report.id)].length > 0 && (
                    <View className="flex-row flex-wrap mt-2">
                      {assignedRespondersByReport[String(report.id)].map((name, idx) => (
                        <Text key={`${report.id}-${idx}`} className="text-xs mr-2 mb-2 px-2 py-1 rounded-full bg-green-100 text-green-800">
                          {name}
                        </Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Report Details Modal */}
      <Modal
        visible={showReportModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowReportModal(false);
          setIsEditingAssignments(false);
        }}
      >
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center px-4">
          <View className="bg-white rounded-2xl w-full" style={{ maxWidth: 600, maxHeight: '90%' }}>
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-xl font-bold text-gray-900">Report Details</Text>
              <TouchableOpacity onPress={() => {
                setShowReportModal(false);
                setIsEditingAssignments(false);
              }}>
                <MaterialIcons name="close" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 20 }}>
              {selectedReport && (
                <>
                  {/* Forwarding Info */}
                  {selectedReport.is_forwarded && (
                    <View className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
                      <View className="flex-row items-start">
                        <MaterialIcons name="forward" size={24} color="#d97706" />
                        <View className="flex-1 ml-3">
                          <Text className="text-amber-900 font-bold text-base mb-2">Forwarded Report</Text>
                          {selectedReport.forwarding_note && (
                            <Text className="text-amber-800 text-sm mb-1">
                              <Text className="font-bold">Note:</Text> {selectedReport.forwarding_note}
                            </Text>
                          )}
                          {selectedReport.forwarded_at && (
                            <Text className="text-amber-700 text-xs">
                              Forwarded: {new Date(selectedReport.forwarded_at).toLocaleString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Image */}
                  {selectedReport.picture && (
                    <View className="bg-gray-100 rounded-lg mb-4 overflow-hidden">
                      <Image
                        source={{ uri: selectedReport.picture }}
                        className="w-full h-48"
                        resizeMode="cover"
                      />
                    </View>
                  )}

                  {/* Location & Time */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm mb-1">Location</Text>
                    <Text className="text-gray-900 font-bold text-base">{selectedReport.location}</Text>
                    <Text className="text-gray-500 text-sm mt-1">{selectedReport.minutesAgoText}</Text>
                  </View>

                  {/* Reporter */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm mb-1">Reporter</Text>
                    <Text className="text-gray-900 font-semibold">{selectedReport.reporter}</Text>
                  </View>

                  {/* Status Changer */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm mb-2">Change Status</Text>
                    <View className="flex-row flex-wrap">
                      {['On Going', 'Under Control', 'Fire Out'].map((s) => (
                        <TouchableOpacity 
                          key={s} 
                          onPress={async () => {
                            try {
                              setIsAssigning(true);
                              const oldStatus = selectedReport.status;
                              const res = await fetch(`${API_URL}/update_report_status`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ report_id: selectedReport.id, status: s })
                              });
                              if (!res.ok) throw new Error(`HTTP ${res.status}`);
                              
                              // Update local state
                              setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, status: s } : r));
                              setSelectedReport(prev => prev ? { ...prev, status: s } : prev);
                              
                              // Notify responders of status change
                              try {
                                // Fetch full report data for notification
                                const reportData = await fetchReportData(selectedReport.id);
                                const reportForNotification = reportData || {
                                  ...selectedReport,
                                  status: s,
                                  latitude: selectedReport.latitude,
                                  longitude: selectedReport.longitude,
                                  address: selectedReport.location
                                };
                                
                                // Notify responders (existing service)
                                await notifyRespondersOnStatusChange(
                                  selectedReport.id,
                                  s,
                                  oldStatus,
                                  reportForNotification
                                );
                                console.log('✅ Responder notifications sent for status change');
                                
                                // Notify all users (admin, station, citizen)
                                await notifyAllUsersOnStatusChange(
                                  selectedReport.id,
                                  s,
                                  oldStatus,
                                  reportForNotification
                                );
                                console.log('✅ Universal notifications sent for status change');
                              } catch (notifError) {
                                console.error('⚠️ Error sending notifications:', notifError);
                                // Don't fail the status update if notification fails
                              }
                              
                              Alert.alert('Success', 'Status updated successfully');
                            } catch (e) {
                              Alert.alert('Error', `Failed to update status: ${e.message}`);
                            } finally { 
                              setIsAssigning(false); 
                            }
                          }} 
                          disabled={isAssigning}
                          style={{ 
                            paddingHorizontal: 12, 
                            paddingVertical: 8, 
                            borderRadius: 6, 
                            borderWidth: 1, 
                            borderColor: selectedReport.status === s ? '#3b82f6' : '#d1d5db', 
                            backgroundColor: selectedReport.status === s ? '#3b82f6' : '#f3f4f6', 
                            marginRight: 8, 
                            marginBottom: 8 
                          }}
                        >
                          <Text style={{ color: selectedReport.status === s ? 'white' : '#374151', fontWeight: '600' }}>
                            {s}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Alarm Levels */}
                  <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                      <Text className="text-gray-600 text-sm mb-2">Suggested Alarm</Text>
                      <View 
                        style={{ 
                          backgroundColor: getAlarmLevelColor(selectedReport.suggestedAlarmLevel).bg,
                          borderColor: getAlarmLevelColor(selectedReport.suggestedAlarmLevel).border 
                        }} 
                        className="px-3 py-2 rounded-lg border"
                      >
                        <Text 
                          style={{ color: getAlarmLevelColor(selectedReport.suggestedAlarmLevel).text }} 
                          className="text-sm font-bold text-center"
                        >
                          {selectedReport.suggestedAlarmLevel}
                        </Text>
                      </View>
                    </View>
                    
                    <View className="flex-1 ml-2">
                      <Text className="text-gray-600 text-sm mb-2">Final Alarm</Text>
                      <View 
                        style={{ 
                          backgroundColor: getAlarmLevelColor(selectedReport.finalAlarmLevel).bg,
                          borderColor: getAlarmLevelColor(selectedReport.finalAlarmLevel).border 
                        }} 
                        className="px-3 py-2 rounded-lg border"
                      >
                        <Text 
                          style={{ color: getAlarmLevelColor(selectedReport.finalAlarmLevel).text }} 
                          className="text-sm font-bold text-center"
                        >
                          {selectedReport.finalAlarmLevel}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Description */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm mb-1">Cause of Fire</Text>
                    <Text className="text-gray-900">{selectedReport.description}</Text>
                  </View>

                  {/* AI Analysis */}
                  {selectedReport.prediction && (
                    <View className="bg-blue-50 rounded-lg p-4 mb-4">
                      <Text className="text-blue-900 font-bold mb-2">AI Detection</Text>
                      <Text className="text-blue-800">
                        {selectedReport.prediction} {selectedReport.confidence ? `(${selectedReport.confidence}% confidence)` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Additional Info */}
                  {selectedReport.structure && (
                    <View className="mb-2">
                      <Text className="text-gray-600 text-sm">Structure Type: <Text className="text-gray-900 font-semibold">{selectedReport.structure}{selectedReport.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}</Text></Text>
                    </View>
                  )}
                  {selectedReport.numberOfStructures && (
                    <View className="mb-2">
                      <Text className="text-gray-600 text-sm">Structures Affected: <Text className="text-gray-900 font-semibold">{selectedReport.numberOfStructures}</Text></Text>
                    </View>
                  )}
                  {selectedReport.smoke_analysis && (
                    <View className="mb-4">
                      <Text className="text-gray-600 text-sm">Smoke Analysis: <Text className="text-gray-900 font-semibold">{selectedReport.smoke_analysis}</Text></Text>
                    </View>
                  )}

                  {/* Assignment Management Section */}
                  <View className="mb-4">
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-gray-600 text-sm font-bold">Responder Assignments</Text>
                      {!isEditingAssignments && (
                        <TouchableOpacity 
                          onPress={() => setIsEditingAssignments(true)} 
                          className="px-4 py-2 bg-blue-600 rounded-lg"
                        >
                          <Text className="text-white font-semibold text-sm">Edit Assignments</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isEditingAssignments ? (
                      <View className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                        <ScrollView style={{ maxHeight: 200 }}>
                          {(responders || []).length === 0 ? (
                            <View className="p-4">
                              <Text className="text-gray-500">No responders available for this station.</Text>
                            </View>
                          ) : responders.map((r) => {
                            const rid = String(selectedReport.id);
                            const setSel = responderSelection[rid] || new Set();
                            const checked = setSel.has(r.id);
                            const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Responder';
                            return (
                              <TouchableOpacity 
                                key={r.id} 
                                onPress={() => {
                                  setResponderSelection(prev => {
                                    const next = new Set(prev[rid] || []);
                                    if (checked) next.delete(r.id); 
                                    else next.add(r.id);
                                    return { ...prev, [rid]: next };
                                  });
                                }} 
                                className="px-4 py-3 flex-row justify-between items-center border-b border-gray-100"
                              >
                                <Text className="text-gray-900">{name}</Text>
                                <View className={`px-3 py-1 rounded-lg ${checked ? 'bg-green-100' : 'bg-gray-100'}`}>
                                  <Text className={`text-xs font-semibold ${checked ? 'text-green-800' : 'text-gray-600'}`}>
                                    {checked ? '✓ Assigned' : 'Assign'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                        
                        <View className="p-3 bg-white border-t border-gray-200 flex-row justify-end gap-2">
                          <TouchableOpacity 
                            onPress={() => {
                              // Reset selection to existing assignments
                              const rid = String(selectedReport.id);
                              const existing = responderExisting[rid] || new Set();
                              setResponderSelection(prev => ({ ...prev, [rid]: new Set(existing) }));
                              setIsEditingAssignments(false);
                            }} 
                            className="px-4 py-2 rounded-lg bg-gray-200"
                          >
                            <Text className="text-gray-700 font-bold">Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            disabled={isAssigning} 
                            onPress={async () => {
                              try {
                                setIsAssigning(true);
                                const rid = String(selectedReport.id);
                                const selected = responderSelection[rid] || new Set();
                                const existing = responderExisting[rid] || new Set();
                                const toAdd = [...selected].filter(id => !existing.has(id));
                                const toRemove = [...existing].filter(id => !selected.has(id));
                                
                                if (toAdd.length > 0) {
                                  // Check for existing entries in report_assignments to avoid duplicates
                                  const { data: existingAssignments } = await supabase
                                    .from('report_assignments')
                                    .select('assignee_id')
                                    .eq('report_id', rid)
                                    .eq('assignee_type', 'responder')
                                    .in('assignee_id', toAdd);
                                  
                                  const alreadyInAssignments = new Set((existingAssignments || []).map(a => a.assignee_id));
                                  const newAssignments = toAdd.filter(id => !alreadyInAssignments.has(id));
                                  
                                  if (newAssignments.length > 0) {
                                    const rows = newAssignments.map(id => ({ 
                                      report_id: rid, 
                                      assignee_type: 'responder', 
                                      assignee_id: id
                                    }));
                                    const { error: addErr } = await supabase
                                      .from('report_assignments')
                                      .insert(rows);
                                    if (addErr) {
                                      console.error('Failed to create report assignments:', addErr);
                                      throw addErr;
                                    }
                                    console.log(`✅ Created ${newAssignments.length} report_assignments entries`);
                                  }
                                  
                                  // Notify newly assigned responders (creates responder_notifications entries)
                                  try {
                                    const reportData = await fetchReportData(rid);
                                    const reportForNotification = reportData || selectedReport;
                                    await notifyRespondersOnBulkAssignment(toAdd, rid, reportForNotification);
                                    console.log('✅ Assignment notifications sent to responders');
                                  } catch (notifError) {
                                    console.error('⚠️ Error sending assignment notifications:', notifError);
                                    // Don't fail the assignment if notification fails
                                  }
                                }
                                
                                if (toRemove.length > 0) {
                                  // Remove from report_assignments
                                  const { error: delErr } = await supabase
                                    .from('report_assignments')
                                    .delete()
                                    .eq('report_id', rid)
                                    .eq('assignee_type', 'responder')
                                    .in('assignee_id', toRemove);
                                  if (delErr) {
                                    console.error('Failed to delete report assignments:', delErr);
                                  }
                                  
                                  // Also remove from responder_notifications
                                  const { error: notifDelErr } = await supabase
                                    .from('responder_notifications')
                                    .delete()
                                    .eq('fire_report_id', rid)
                                    .in('responder_id', toRemove)
                                    .in('status', ['pending', 'accepted']);
                                  if (notifDelErr) {
                                    console.error('Failed to delete responder notifications:', notifDelErr);
                                  }
                                }
                                
                                setResponderExisting(prev => ({ ...prev, [rid]: new Set(selected) }));
                                
                                // Update the assigned responders display
                                await loadAssignedReports();
                                
                                setIsEditingAssignments(false);
                                Alert.alert('Success', 'Responder assignments updated successfully');
                              } catch (e) {
                                Alert.alert('Error', e.message || 'Failed to update assignments');
                              } finally { 
                                setIsAssigning(false); 
                              }
                            }} 
                            className={`px-4 py-2 rounded-lg ${isAssigning ? 'bg-gray-400' : 'bg-green-600'}`}
                          >
                            <Text className="text-white font-bold">
                              {isAssigning ? 'Saving...' : 'Save Assignments'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        {(() => {
                          const rid = String(selectedReport.id);
                          const assigned = assignedRespondersByReport[rid] || [];
                          if (assigned.length === 0) {
                            return <Text className="text-gray-500 text-sm">No responders assigned yet.</Text>;
                          }
                          return (
                            <View>
                              <Text className="text-gray-600 text-sm mb-2">Assigned Responders:</Text>
                              {assigned.map((name, idx) => (
                                <View key={idx} className="flex-row items-center mb-1">
                                  <View className="w-2 h-2 bg-green-600 rounded-full mr-2" />
                                  <Text className="text-gray-900">{name}</Text>
                                </View>
                              ))}
                            </View>
                          );
                        })()}
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Assignment Acceptance Modal */}
      <Modal
        visible={showAcceptanceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAcceptanceModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: '#dbeafe', borderRadius: 50, padding: 12 }}>
                <MaterialIcons name="assignment" size={32} color="#2563eb" />
              </View>
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Assignment Request
            </Text>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
              Command Center is assigning you a report <Text style={{ fontWeight: '600' }}>
                {pendingAssignmentData?.reportData?.address || pendingAssignmentData?.reportData?.geotag_location || 'at a location'}
              </Text>. Will you accept this assignment?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const result = await handleAssignmentResponse(
                      pendingAssignmentData.reportId,
                      stationId,
                      'declined'
                    );
                    if (result.success) {
                      // Mark the related notification as read to stop alarm
                      try {
                        await supabase
                          .from('notifications')
                          .update({ is_read: true })
                          .eq('user_id', stationId)
                          .eq('user_type', 'station')
                          .eq('type', 'assignment')
                          .eq('related_report_id', String(pendingAssignmentData.reportId))
                          .eq('is_read', false);
                        console.log('✅ SStatus: Marked assignment notification as read (declined)');
                      } catch (notifError) {
                        console.error('Error marking notification as read:', notifError);
                      }
                      
                      // Stop local alarm if playing
                      await stopAlarm();
                      
                      setShowAcceptanceModal(false);
                      setPendingAssignmentData(null);
                      // Remove from shown set so it won't show again
                      if (pendingAssignmentData?.assignmentId) {
                        const assignmentKey = `${pendingAssignmentData.reportId}-${pendingAssignmentData.assignmentId}`;
                        shownAssignmentsRef.current.delete(assignmentKey);
                        console.log('🗑️ SStatus: Removed assignment from shown set (declined):', assignmentKey);
                      }
                    } else {
                      Alert.alert('Error', result.error || 'Failed to decline assignment. Please try again.');
                    }
                  } catch (error) {
                    console.error('Error declining assignment:', error);
                    Alert.alert('Error', 'An error occurred. Please try again.');
                  }
                }}
                style={{ flex: 1, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const result = await handleAssignmentResponse(
                      pendingAssignmentData.reportId,
                      stationId,
                      'accepted'
                    );
                    if (result.success) {
                      // Mark the related notification as read to stop alarm
                      try {
                        await supabase
                          .from('notifications')
                          .update({ is_read: true })
                          .eq('user_id', stationId)
                          .eq('user_type', 'station')
                          .eq('type', 'assignment')
                          .eq('related_report_id', String(pendingAssignmentData.reportId))
                          .eq('is_read', false);
                        console.log('✅ SStatus: Marked assignment notification as read (accepted)');
                      } catch (notifError) {
                        console.error('Error marking notification as read:', notifError);
                      }
                      
                      // Stop local alarm if playing
                      await stopAlarm();
                      
                      setShowAcceptanceModal(false);
                      setPendingAssignmentData(null);
                      // Remove from shown set so it won't show again
                      if (pendingAssignmentData?.assignmentId) {
                        const assignmentKey = `${pendingAssignmentData.reportId}-${pendingAssignmentData.assignmentId}`;
                        shownAssignmentsRef.current.delete(assignmentKey);
                        console.log('🗑️ SStatus: Removed assignment from shown set (accepted):', assignmentKey);
                      }
                      Alert.alert('✅ Accepted', 'Assignment accepted successfully!');
                    } else {
                      Alert.alert('Error', result.error || 'Failed to accept assignment. Please try again.');
                    }
                  } catch (error) {
                    console.error('Error accepting assignment:', error);
                    Alert.alert('Error', 'An error occurred. Please try again.');
                  }
                }}
                style={{ flex: 1, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Forwarding Request Modal */}
      <Modal
        visible={showForwardingRequestModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowForwardingRequestModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: '#fed7aa', borderRadius: 50, padding: 12 }}>
                <MaterialIcons name="warning" size={32} color="#ea580c" />
              </View>
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Request Forwarding?
            </Text>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
              You are currently handling <Text style={{ fontWeight: '600' }}>{pendingAssignmentData?.busyCount || 0} other incident(s)</Text>. 
              Would you like to request admin for forwarding of this report to another station?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await handleAssignmentResponse(
                      pendingAssignmentData.reportId,
                      stationId,
                      'accepted'
                    );
                  } catch (error) {
                    console.error('Error accepting assignment:', error);
                  }
                  setShowForwardingRequestModal(false);
                  setPendingAssignmentData(null);
                }}
                style={{ flex: 1, backgroundColor: '#e5e7eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
              >
                <Text style={{ color: '#374151', fontWeight: 'bold', fontSize: 16 }}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const result = await requestForwarding(pendingAssignmentData.reportId, stationId);
                    if (result.success) {
                      const declineResult = await handleAssignmentResponse(
                        pendingAssignmentData.reportId,
                        stationId,
                        'declined'
                      );
                      if (declineResult.success) {
                        // Mark the related notification as read to stop alarm
                        try {
                          await supabase
                            .from('notifications')
                            .update({ is_read: true })
                            .eq('user_id', stationId)
                            .eq('user_type', 'station')
                            .eq('type', 'assignment')
                            .eq('related_report_id', String(pendingAssignmentData.reportId))
                            .eq('is_read', false);
                          console.log('✅ SStatus: Marked assignment notification as read (forwarding requested)');
                        } catch (notifError) {
                          console.error('Error marking notification as read:', notifError);
                        }
                        
                        // Stop local alarm if playing
                        await stopAlarm();
                        
                        setShowForwardingRequestModal(false);
                        setPendingAssignmentData(null);
                        // Remove from shown set so it won't show again
                        if (pendingAssignmentData?.assignmentId) {
                          const assignmentKey = `${pendingAssignmentData.reportId}-${pendingAssignmentData.assignmentId}`;
                          shownAssignmentsRef.current.delete(assignmentKey);
                          console.log('🗑️ SStatus: Removed assignment from shown set (forwarding requested):', assignmentKey);
                        }
                        Alert.alert('✅ Request Sent', 'Forwarding request sent to admin. They will reroute the incident to another station.');
                      } else {
                        Alert.alert('Error', declineResult.error || 'Failed to decline assignment. Please try again.');
                      }
                    } else {
                      Alert.alert('Error', result.error || 'Failed to send forwarding request. Please try again.');
                    }
                  } catch (error) {
                    console.error('Error requesting forwarding:', error);
                    Alert.alert('Error', 'An error occurred. Please try again.');
                  }
                }}
                style={{ flex: 1, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

