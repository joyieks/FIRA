import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, AppState, Alert, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../../config/supabase';
import { checkStationIsBusy, handleAssignmentResponse, requestForwarding } from '../../../utils/assignmentHelpers';

export default function SNotifications({ onUnreadCountChange, onOpenReport }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentStationId, setCurrentStationId] = useState(null);
  const appState = useRef(AppState.currentState);
  
  // Assignment acceptance/decline modals
  const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
  const [showForwardingRequestModal, setShowForwardingRequestModal] = useState(false);
  const [pendingAssignmentData, setPendingAssignmentData] = useState(null);
  
  // Track which assignments have already been shown in modals (to prevent duplicates)
  const shownAssignmentsRef = useRef(new Set()); // Set of assignment IDs that have been shown

  // NOTE: Sound/alarm management is handled by SAlertsWorker component
  // which is mounted at the app level for consistent playback across all screens

  // Get current station user ID from AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        console.log('📱 Station: Raw userData from AsyncStorage:', userDataStr);
        
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          console.log('📱 Station: Parsed userData:', userData);
          
          const resolvedId = userData?.id || userData?.uid;
          console.log('📱 Station: Resolved ID:', resolvedId);
          setCurrentStationId(resolvedId);
        }
      } catch (err) {
        console.error('📱 Station: Error loading user data:', err);
      }
    };
    loadUserData();
  }, []);

  // Load notifications on mount and setup polling
  useEffect(() => {
    if (currentStationId) {
      console.log('📱 Station ID available, loading notifications');
      loadNotifications();
      
      // Poll notifications every 2 seconds
      const notificationInterval = setInterval(() => {
        loadNotifications();
      }, 2000);
      
      return () => {
        clearInterval(notificationInterval);
      };
    }
  }, [currentStationId]);

  const loadNotifications = async () => {
    if (!currentStationId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentStationId)
        .eq('user_type', 'station')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('📱 Station: Error fetching notifications:', error);
        return;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('📱 Station: Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription for notification updates
  useEffect(() => {
    if (!currentStationId) return;

    console.log('📱 Station: Setting up real-time subscription');

    const channel = supabase
      .channel(`station-notifications:${currentStationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentStationId}`
      }, async (payload) => {
        console.log('📱 Station: Real-time notification received:', payload.new);
        
        if (payload.new?.user_type === 'station') {
          // Send push notification for alarm level changes
          if (payload.new?.type === 'alarm_level_change') {
            try {
              // Check permissions before sending notification
              const { status } = await Notifications.getPermissionsAsync();
              if (status !== 'granted') {
                console.warn('⚠️ Notification permissions not granted, requesting...');
                const { status: newStatus } = await Notifications.requestPermissionsAsync();
                if (newStatus !== 'granted') {
                  console.error('❌ Notification permission denied');
                  return;
                }
              }

              await Notifications.scheduleNotificationAsync({
                content: {
                  title: payload.new.title || '⚠️ Alarm Level Changed',
                  body: payload.new.message || 'The fire alarm level has been updated',
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                  data: {
                    type: 'alarm_level_change',
                    reportId: payload.new.related_report_id,
                    notificationId: payload.new.id,
                  },
                },
                trigger: null, // Immediate notification
              });
              console.log('✅ Push notification sent for alarm level change');
            } catch (error) {
              console.error('❌ Error sending push notification:', error);
            }
          }
          
          setNotifications(prev => {
            const exists = prev.some(n => n.id === payload.new.id);
            if (!exists) {
              return [payload.new, ...prev];
            }
            return prev;
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentStationId}`
      }, (payload) => {
        if (payload.new?.user_type === 'station') {
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === payload.new.id ? payload.new : notification
            )
          );
        }
      })
      .subscribe((status) => {
        console.log('📱 Station: Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentStationId]);

  // Real-time listener for new assignments (for acceptance/decline modals)
  useEffect(() => {
    if (!currentStationId) return;

    console.log('🔔 SNotifications: Setting up real-time listener for assignments, station:', currentStationId);

    const channel = supabase
      .channel(`station-assignments-notifications-${currentStationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'report_assignments' 
      }, async (payload) => {
        try {
          console.log('📥 SNotifications: Received INSERT event:', payload);
          const row = payload?.new;
          if (!row) return;
          
          if (row.assignee_type === 'station' && String(row.assignee_id) === String(currentStationId)) {
            console.log('✅ SNotifications: Assignment matches this station!');
            console.log('🚨 New assignment received in SNotifications:', row);
            
            // Fetch report data
            const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
            const reports = response.ok ? await response.json() : [];
            const reportData = reports.find(r => String(r.id) === String(row.report_id));

            // Check if assignment is pending (needs approval)
            if (row.status === 'pending') {
              // Check if we've already shown a modal for this assignment
              const assignmentKey = `${row.report_id}-${row.id}`;
              if (shownAssignmentsRef.current.has(assignmentKey)) {
                console.log('⏭️ SNotifications: Modal already shown for this assignment, skipping:', assignmentKey);
                return;
              }
              
              // Check if modal is already showing for another assignment
              if (showAcceptanceModal || showForwardingRequestModal) {
                console.log('⏭️ SNotifications: Another modal is already showing, skipping');
                return;
              }
              
              console.log('📋 SNotifications: Assignment is pending, checking if station is busy...');
              
              // Mark this assignment as shown
              shownAssignmentsRef.current.add(assignmentKey);
              
              // Check if station is busy
              const busyCheck = await checkStationIsBusy(currentStationId);
              
              if (!busyCheck.isBusy) {
                // Station is free - auto-accept regardless of assignment source
                console.log('✅ SNotifications: Station is free - auto-accepting assignment');
                await handleAssignmentResponse(row.report_id, currentStationId, 'accepted');
                // Remove from shown set since we auto-accepted
                shownAssignmentsRef.current.delete(assignmentKey);
              } else if (row.assignment_source === 'manual') {
                // Admin assigned and station is busy - show acceptance modal
                console.log('✅ SNotifications: Showing acceptance modal for manual assignment (station busy)');
                setPendingAssignmentData({
                  reportId: row.report_id,
                  assignmentSource: 'manual',
                  reportData: reportData,
                  assignmentId: row.id
                });
                setShowAcceptanceModal(true);
              } else if (row.assignment_source === 'automatic') {
                // Auto-assigned and station is busy - show forwarding request modal
                console.log('✅ SNotifications: Showing forwarding request modal for auto-assignment (station busy)');
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
          }
        } catch (e) {
          console.error('❌ SNotifications: RT assignment handler error:', e);
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'report_assignments',
        filter: `assignee_type=eq.station&assignee_id=eq.${currentStationId}`
      }, async (payload) => {
        try {
          const row = payload?.new;
          const oldRow = payload?.old;
          if (!row) return;
          
          if (row.assignee_type === 'station' && String(row.assignee_id) === String(currentStationId)) {
            // Handle assignments that become pending (e.g., rerouted assignments)
            const wasPending = oldRow?.status === 'pending';
            const isNowPending = row.status === 'pending';
            
            if (isNowPending && !wasPending) {
              console.log('📋 SNotifications: Assignment status changed to pending (rerouted?)');
              
              // Check if we've already shown a modal for this assignment
              const assignmentKey = `${row.report_id}-${row.id}`;
              if (shownAssignmentsRef.current.has(assignmentKey)) {
                console.log('⏭️ SNotifications: Modal already shown for this assignment (UPDATE), skipping:', assignmentKey);
                return;
              }
              
              // Check if modal is already showing for another assignment
              if (showAcceptanceModal || showForwardingRequestModal) {
                console.log('⏭️ SNotifications: Another modal is already showing (UPDATE), skipping');
                return;
              }
              
              // Fetch report data
              const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
              const reports = response.ok ? await response.json() : [];
              const reportData = reports.find(r => String(r.id) === String(row.report_id));

              // Check if station is busy
              const busyCheck = await checkStationIsBusy(currentStationId);
              
              // Mark this assignment as shown
              shownAssignmentsRef.current.add(assignmentKey);
              
              if (!busyCheck.isBusy) {
                // Station is free - auto-accept regardless of assignment source
                console.log('✅ SNotifications: Station is free - auto-accepting rerouted assignment');
                await handleAssignmentResponse(row.report_id, currentStationId, 'accepted');
                // Remove from shown set since we auto-accepted
                shownAssignmentsRef.current.delete(assignmentKey);
              } else if (row.assignment_source === 'manual') {
                // Admin assigned (including rerouted) and station is busy - show acceptance modal
                console.log('✅ SNotifications: Showing acceptance modal for rerouted assignment (station busy)');
                setPendingAssignmentData({
                  reportId: row.report_id,
                  assignmentSource: 'manual',
                  reportData: reportData,
                  assignmentId: row.id
                });
                setShowAcceptanceModal(true);
              } else if (row.assignment_source === 'automatic') {
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
                String(row.assignee_id) === String(currentStationId)) {
              const assignmentKey = `${row.report_id}-${row.id}`;
              shownAssignmentsRef.current.delete(assignmentKey);
              console.log('🗑️ SNotifications: Removed assignment from shown set (responded):', assignmentKey);
            }
            
            // If assignment was declined, mark notification as read to stop alarm
            if (row.status === 'declined') {
              try {
                await supabase
                  .from('notifications')
                  .update({ is_read: true })
                  .eq('user_id', currentStationId)
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
          console.error('❌ SNotifications: RT assignment update handler error:', e);
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ SNotifications: Subscription error:', err);
        } else {
          console.log('✅ SNotifications: Subscription status:', status);
        }
      });

    return () => {
      console.log('🔕 SNotifications: Cleaning up real-time listener');
      supabase.removeChannel(channel);
    };
  }, [currentStationId]);

  // Check for existing pending assignments on mount
  useEffect(() => {
    if (!currentStationId) return;

    const checkPendingAssignments = async () => {
      try {
        console.log('🔍 SNotifications: Checking for existing pending assignments...');
        const { data: pendingAssignments, error } = await supabase
          .from('report_assignments')
          .select('*')
          .eq('assignee_type', 'station')
          .eq('assignee_id', currentStationId)
          .eq('status', 'pending');

        if (error) {
          console.error('❌ Error checking pending assignments:', error);
          return;
        }

        if (pendingAssignments && pendingAssignments.length > 0) {
          console.log(`✅ Found ${pendingAssignments.length} pending assignment(s)`);
          
          // Process the first pending assignment
          const assignment = pendingAssignments[0];
          
          // Fetch report data
          const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
          const reports = response.ok ? await response.json() : [];
          const reportData = reports.find(r => String(r.id) === String(assignment.report_id));

          // Check if station is busy
          const busyCheck = await checkStationIsBusy(currentStationId);
          
          if (!busyCheck.isBusy) {
            // Station is free - auto-accept regardless of assignment source
            console.log('✅ SNotifications: Station is free - auto-accepting existing pending assignment');
            await handleAssignmentResponse(assignment.report_id, currentStationId, 'accepted');
            // Remove from shown set since we auto-accepted
            const assignmentKey = `${assignment.report_id}-${assignment.id}`;
            shownAssignmentsRef.current.delete(assignmentKey);
          } else if (assignment.assignment_source === 'manual') {
            setPendingAssignmentData({
              reportId: assignment.report_id,
              assignmentSource: 'manual',
              reportData: reportData,
              assignmentId: assignment.id
            });
            setShowAcceptanceModal(true);
          } else if (assignment.assignment_source === 'automatic') {
            setPendingAssignmentData({
              reportId: assignment.report_id,
              assignmentSource: 'automatic',
              reportData: reportData,
              assignmentId: assignment.id,
              busyCount: busyCheck.busyCount
            });
            setShowForwardingRequestModal(true);
          }
        }
      } catch (error) {
        console.error('❌ Error checking pending assignments:', error);
      }
    };

    const timeoutId = setTimeout(checkPendingAssignments, 1000);
    return () => clearTimeout(timeoutId);
  }, [currentStationId]);

  // Handle app state changes (reload notifications when app comes to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 Station: App has come to foreground, reloading notifications...');
        if (currentStationId) {
          loadNotifications();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentStationId]);

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) {
        console.error('📱 Station: Error marking notification as read:', error);
        return;
      }

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id 
            ? { ...notification, is_read: true }
            : notification
        )
      );
      
      // SAlertsWorker will handle stopping the alarm via real-time subscription
    } catch (err) {
      console.error('📱 Station: Error marking notification as read:', err);
    }
  };

  const getNotificationIcon = (type) => {
    // For station notifications, type='assignment' means fire report assigned/forwarded
    switch (type) {
      case 'fire_alert':
      case 'emergency':
        return { name: 'emergency', color: '#ef4444', bg: '#fef2f2' };
      case 'assignment':
        return { name: 'emergency', color: '#ef4444', bg: '#fef2f2' };
      case 'equipment':
        return { name: 'local-fire-department', color: '#dc2626', bg: '#fef2f2' };
      case 'personnel':
        return { name: 'people', color: '#8b5cf6', bg: '#f3f4f6' };
      case 'inventory':
        return { name: 'inventory', color: '#3b82f6', bg: '#eff6ff' };
      case 'training':
        return { name: 'school', color: '#10b981', bg: '#f0fdf4' };
      case 'system':
      case 'info':
        return { name: 'info', color: '#6b7280', bg: '#f9fafb' };
      default:
        return { name: 'notifications', color: '#6b7280', bg: '#f9fafb' };
    }
  };

  const getPriorityColor = (priority) => {
    // Use priority field if available, otherwise fall back to type
    if (priority) {
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
    }
    // Fallback: Assignment and fire_alert notifications are high priority
    return '#ef4444';
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

  // Handle notification click - open report details
  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      await markAsRead(notification.id);
      
      // Check if notification has related report
      if (notification.related_report_id && onOpenReport) {
        console.log('📍 Opening fire report details:', notification.related_report_id);
        
        // Call the callback to open the report in Overview tab
        onOpenReport(notification.related_report_id);
      }
    } catch (error) {
      console.error('❌ Error handling notification click:', error);
      Alert.alert('Error', 'Unable to open fire report details');
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Filter Tabs */}
      <View 
        style={{
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          paddingTop: insets.top + 60, // Lowered from pt-20 (80px) to 60px + safe area
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-2">
          <TouchableOpacity className="bg-fire px-4 py-2 rounded-lg mr-2">
            <Text className="text-white font-medium">All</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Equipment</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Personnel</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg">
            <Text className="text-gray-700 font-medium">Operations</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Notifications List */}
      <ScrollView 
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadNotifications} />
        }
      >
        {notifications.map((notification) => {
          const icon = getNotificationIcon(notification.type);
          const priorityColor = getPriorityColor(notification.priority || notification.type);
          
          return (
            <TouchableOpacity
              key={notification.id}
              className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
                notification.is_read ? 'opacity-75' : ''
              }`}
              style={{ borderLeftColor: priorityColor }}
              onPress={() => handleNotificationClick(notification)}
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
                      {notification.type === 'assignment' && (
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
      {notifications.length === 0 && (
        <View className="flex-1 items-center justify-center px-8">
          <MaterialIcons name="notifications-off" size={64} color="#9ca3af" />
          <Text className="text-xl font-bold text-gray-600 mt-4 mb-2">
            No Notifications
          </Text>
          <Text className="text-gray-500 text-center">
            Station operations are running smoothly. We'll alert you when action is needed.
          </Text>
        </View>
      )}

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
                      currentStationId,
                      'declined'
                    );
                    if (result.success) {
                      // Mark the related notification as read to stop alarm
                      try {
                        await supabase
                          .from('notifications')
                          .update({ is_read: true })
                          .eq('user_id', currentStationId)
                          .eq('user_type', 'station')
                          .eq('type', 'assignment')
                          .eq('related_report_id', String(pendingAssignmentData.reportId))
                          .eq('is_read', false);
                      } catch (notifError) {
                        console.error('Error marking notification as read:', notifError);
                      }
                      
                      setShowAcceptanceModal(false);
                      setPendingAssignmentData(null);
                      // Remove from shown set so it won't show again
                      if (pendingAssignmentData?.assignmentId) {
                        const assignmentKey = `${pendingAssignmentData.reportId}-${pendingAssignmentData.assignmentId}`;
                        shownAssignmentsRef.current.delete(assignmentKey);
                        console.log('🗑️ SNotifications: Removed assignment from shown set (declined):', assignmentKey);
                      }
                    } else {
                      Alert.alert('Error', result.error || 'Failed to decline assignment. Please try again.');
                    }
                  } catch (error) {
                    console.error('Error declining assignment:', error);
                    Alert.alert('Error', 'An error occurred. Please try again.');
                  } finally {
                    // Remove from shown set even if there was an error
                    if (pendingAssignmentData?.assignmentId) {
                      const assignmentKey = `${pendingAssignmentData.reportId}-${pendingAssignmentData.assignmentId}`;
                      shownAssignmentsRef.current.delete(assignmentKey);
                    }
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
                      currentStationId,
                      'accepted'
                    );
                    if (result.success) {
                      // Mark the related notification as read to stop alarm
                      try {
                        await supabase
                          .from('notifications')
                          .update({ is_read: true })
                          .eq('user_id', currentStationId)
                          .eq('user_type', 'station')
                          .eq('type', 'assignment')
                          .eq('related_report_id', String(pendingAssignmentData.reportId))
                          .eq('is_read', false);
                        console.log('✅ SNotifications: Marked assignment notification as read (accepted)');
                      } catch (notifError) {
                        console.error('Error marking notification as read:', notifError);
                      }
                      
                      setShowAcceptanceModal(false);
                      setPendingAssignmentData(null);
                      // Remove from shown set so it won't show again
                      if (pendingAssignmentData?.assignmentId) {
                        const assignmentKey = `${pendingAssignmentData.reportId}-${pendingAssignmentData.assignmentId}`;
                        shownAssignmentsRef.current.delete(assignmentKey);
                        console.log('🗑️ SNotifications: Removed assignment from shown set (accepted):', assignmentKey);
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
                      currentStationId,
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
                    const result = await requestForwarding(pendingAssignmentData.reportId, currentStationId);
                    if (result.success) {
                      const declineResult = await handleAssignmentResponse(
                        pendingAssignmentData.reportId,
                        currentStationId,
                        'declined'
                      );
                      if (declineResult.success) {
                        // Mark the related notification as read to stop alarm
                        try {
                          await supabase
                            .from('notifications')
                            .update({ is_read: true })
                            .eq('user_id', currentStationId)
                            .eq('user_type', 'station')
                            .eq('type', 'assignment')
                            .eq('related_report_id', String(pendingAssignmentData.reportId))
                            .eq('is_read', false);
                        } catch (notifError) {
                          console.error('Error marking notification as read:', notifError);
                        }
                        
                        setShowForwardingRequestModal(false);
                        setPendingAssignmentData(null);
                        // Remove from shown set so it won't show again
                        if (pendingAssignmentData?.assignmentId) {
                          const assignmentKey = `${pendingAssignmentData.reportId}-${pendingAssignmentData.assignmentId}`;
                          shownAssignmentsRef.current.delete(assignmentKey);
                          console.log('🗑️ SNotifications: Removed assignment from shown set (forwarding requested):', assignmentKey);
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