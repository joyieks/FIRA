import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../../config/AuthContext';
import { supabase } from '../../../config/supabase';

export default function RStatus({ onNavigateToMap }) {
  const { userData } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [showFullReport, setShowFullReport] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Helper function to generate human-readable report ID
  const generateReadableReportId = (uuid) => {
    if (!uuid) return 'Unknown';
    // Take first 8 characters and convert to uppercase for better readability
    const shortId = String(uuid).substring(0, 8).toUpperCase();
    return `FR-${shortId}`;
  };

  // Load notifications and set current assignment
  const loadNotifications = async () => {
    if (!userData?.id) {
      return;
    }

    try {
      console.log('🔄 Loading assignments for responder:', userData.id);
      
      // APPROACH 1: Load active notifications from responder_notifications table
      // Include 'completed' status so assignments remain visible after status changes (Under Control, Fire Out)
      const { data: notificationData, error } = await supabase
        .from('responder_notifications')
        .select('*')
        .eq('responder_id', userData.id)
        .in('status', ['pending', 'accepted', 'completed']) // Include completed for status updates
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading notifications:', error);
      }

      // APPROACH 2: ALSO check report_assignments table (when station assigns via web)
      const { data: assignmentData, error: assignError } = await supabase
        .from('report_assignments')
        .select('report_id, assigned_at, note')
        .eq('assignee_type', 'responder')
        .eq('assignee_id', userData.id);

      if (assignError) {
        console.error('❌ Error loading report_assignments:', assignError);
      }

      console.log('📊 Notifications found:', notificationData?.length || 0);
      console.log('📊 Notification details:', JSON.stringify(notificationData, null, 2));
      console.log('📊 Direct assignments found:', assignmentData?.length || 0);
      console.log('📊 Assignment details:', JSON.stringify(assignmentData, null, 2));

      // Combine report IDs from both sources
      const reportIdsFromNotifications = (notificationData || [])
        .map(n => n.fire_report_id)
        .filter(Boolean)
        .map(String);
      
      const reportIdsFromAssignments = (assignmentData || [])
        .map(a => a.report_id)
        .filter(Boolean)
        .map(String);

      // Use Set to get unique report IDs
      const uniqueReportIds = [...new Set([...reportIdsFromNotifications, ...reportIdsFromAssignments])];
      
      console.log('📋 Report IDs from notifications:', reportIdsFromNotifications);
      console.log('📋 Report IDs from assignments:', reportIdsFromAssignments);
      console.log('📋 Unique report IDs to load:', uniqueReportIds);

      if (uniqueReportIds.length === 0) {
        console.log('⚠️ No report IDs found - setting empty assignments');
        setAssignments([]);
        return;
      }

      // Fetch reports once and build assignment cards
      console.log('🌐 Fetching reports from Railway API...');
      const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
      const allReports = response.ok ? await response.json() : [];
      console.log('📊 Fetched reports from API:', allReports?.length || 0);
      
      const reportsById = new Map((allReports || []).map(r => [String(r.id), r]));
      console.log('🗺️ Reports by ID map size:', reportsById.size);

      const processedFromIds = await Promise.all(uniqueReportIds.map(async (rid) => {
        console.log(`🔍 Looking for report ID: ${rid}`);
        const report = reportsById.get(String(rid));
        if (!report) {
          console.warn(`⚠️ Report not found in API response: ${rid}`);
          console.warn(`⚠️ Available report IDs in API:`, Array.from(reportsById.keys()));
          return null;
        }
        
        // Filter out Fire Out reports (but keep Under Control - responders should see those)
        const status = report.status?.toLowerCase();
        console.log(`📊 Report ${rid} status: "${status}"`);
        if (status === 'fire out') {
          console.log(`⏭️ Skipping ${status} report: ${rid}`);
          return null;
        }
        
        console.log(`✅ Found active report: ${rid} - ${report.location || report.address || 'Unknown location'}`);
        // Try to find a notification for status/accepted flag
        const notif = (notificationData || []).find(n => String(n.fire_report_id) === String(rid));
        console.log(`🔔 Notification for report ${rid}:`, notif ? 'FOUND' : 'NOT FOUND');
        return buildAssignmentFromReport(report, notif);
      }));

      const validAssignments = processedFromIds.filter(Boolean);
      console.log('✅ Valid assignments processed:', validAssignments.length);
      console.log('📋 Assignment details:', validAssignments.map(a => ({ id: a.fireReportId, location: a.location, status: a.status })));
      setAssignments(validAssignments);
      console.log('✅ Loaded assignments for responder:', validAssignments.length);
    } catch (error) {
      console.error('❌ Error in loadNotifications:', error);
    }
  };

  // Build assignment object when we have the full report (with optional notification)
  const buildAssignmentFromReport = (fireReport, notification) => {
    const reporterFromAPI = fireReport.reporter_name || fireReport.reporter || fireReport.reported_by || fireReport.user_name || 'Unknown Reporter';
    const location = fireReport.address || fireReport.geotag_location || fireReport.location || 'Unknown location';
    
    // Helper to clean alarm level text (remove "- structure count not provided" suffix)
    const cleanAlarmLevel = (level) => {
      if (!level) return level;
      if (typeof level === 'string' && level.includes('- structure count not provided')) {
        return level.split('- structure count not provided')[0].trim();
      }
      return level;
    };
    
    // Use final_fire_alarm_level (set by admin) as primary, NOT recommended_alarm_level (AI suggestion)
    const rawAlarmLevel = fireReport.final_fire_alarm_level || fireReport.alarm_level || fireReport.recommended_alarm_level || '1st Alarm';
    const alarmLevel = cleanAlarmLevel(rawAlarmLevel);
    
    const aiDetection = (fireReport.prediction ? `${fireReport.prediction}` : 'Not analyzed') + (fireReport.confidence ? ` (${fireReport.confidence})` : '');
    const smokeDetection = fireReport.smoke_detection || fireReport.smoke_level || '';
    const smokeConfidence = fireReport.smoke_confidence || fireReport.smoke_analysis || '';
    const smokeAnalysisFromAPI = `${smokeDetection} ${smokeConfidence}`.trim() || 'Not analyzed';
    const structureFromAPI = fireReport.structure || fireReport.structure_type || fireReport.building_type || fireReport.property_type || 'Unknown';
    let structuresAffectedFromAPI = fireReport.number_of_structures_on_fire || fireReport.structures_affected || fireReport.affected_structures || fireReport.building_count || fireReport.property_count || 'Unknown';
    if (typeof structuresAffectedFromAPI === 'number') {
      structuresAffectedFromAPI = `${structuresAffectedFromAPI} structure(s)`;
    }
    const readableId = generateReadableReportId(fireReport.id);
    return {
      id: `report-${String(fireReport.id)}`, // Use simple ID without concatenation
      notificationId: notification?.id || null, // Store actual notification ID separately
      title: notification?.title || `Fire Report ${readableId}`,
      location,
      description: notification?.message || '',
      priority: notification?.priority || 'high',
      createdAt: notification?.created_at || fireReport.created_at || fireReport.timestamp,
      fireReportId: String(fireReport.id),
      alarmLevel,
      aiDetection,
      reportedTime: fireReport.formatted_timestamp || fireReport.timestamp || fireReport.created_at,
      cause: fireReport.cause || fireReport.possible_cause || fireReport.cause_of_fire || 'Under investigation',
      imageUrl: fireReport.image_url || null,
      status: fireReport.status || 'On Going',
      isAccepted: notification?.status === 'accepted',
      reporter: reporterFromAPI,
      smokeAnalysis: smokeAnalysisFromAPI,
      structure: structureFromAPI,
      structuresAffected: structuresAffectedFromAPI
    };
  };

  useEffect(() => {

    loadNotifications();

    // Set up real-time subscription for new notifications
    const notificationSubscription = supabase
      .channel(`responder_notifications:${userData?.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'responder_notifications',
        filter: `responder_id=eq.${userData?.id}`
      }, (payload) => {
        console.log('🔔 NEW NOTIFICATION INSERT detected:', payload);
        loadNotifications(); // Reload notifications
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'responder_notifications',
        filter: `responder_id=eq.${userData?.id}`
      }, (payload) => {
        console.log('🔄 NOTIFICATION UPDATE detected:', payload);
        loadNotifications(); // Reload notifications
      })
      .subscribe();

    // Set up real-time subscription for report_assignments (when station assigns via web)
    const assignmentSubscription = supabase
      .channel(`report_assignments:responder:${userData?.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'report_assignments',
        filter: `assignee_id=eq.${userData?.id}`
      }, (payload) => {
        console.log('🆕 NEW ASSIGNMENT detected via report_assignments:', payload);
        loadNotifications(); // Reload notifications to fetch new assignment
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'report_assignments',
        filter: `assignee_id=eq.${userData?.id}`
      }, (payload) => {
        console.log('🗑️ ASSIGNMENT REMOVED detected via report_assignments:', payload);
        loadNotifications(); // Reload notifications to remove assignment
      })
      .subscribe();

    // Set up polling as backup mechanism (every 10 seconds)
    console.log('⏰ Setting up 10-second polling for new assignments');
    const pollingInterval = setInterval(() => {
      console.log('🔄 POLLING: Checking for new assignments...');
      loadNotifications();
    }, 10000); // 10 seconds

    return () => {
      notificationSubscription.unsubscribe();
      assignmentSubscription.unsubscribe();
      clearInterval(pollingInterval);
      console.log('🛑 Cleaned up subscriptions and polling');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.id]);

  // Update selectedAssignment when assignments change (for real-time alarm level updates)
  useEffect(() => {
    if (selectedAssignment && showFullReport) {
      // Find the updated assignment data
      const updatedAssignment = assignments.find(
        a => a.fireReportId === selectedAssignment.fireReportId
      );
      
      if (updatedAssignment) {
        console.log('🔄 Updating selected assignment with latest data');
        console.log('🔄 Old alarm level:', selectedAssignment.alarmLevel);
        console.log('🔄 New alarm level:', updatedAssignment.alarmLevel);
        setSelectedAssignment(updatedAssignment);
      }
    }
  }, [assignments, selectedAssignment, showFullReport]);

  const getFireReportStatusColor = (status) => {
    switch (status) {
      case 'On Going': return '#dc2626'; // red-600
      case 'Under Control': return '#d97706'; // amber-600
      case 'Fire Out': return '#16a34a'; // green-600
      case 'Cancelled': return '#6b7280'; // gray-500
      default: return '#6b7280'; // gray-500
    }
  };

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#ff512f']}
          tintColor="#ff512f"
        />
      }
    >
      {/* Header */}
      <View className="bg-white pt-16 pb-4 px-4 border-b border-gray-200">
        <View className="items-center">
          <Text className="text-gray-600 mt-1">Welcome, {userData?.first_name && userData?.last_name ? `${userData.first_name} ${userData.last_name}` : userData?.displayName || 'Responder'}</Text>
        </View>
      </View>



      {/* Active Assignments */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm mb-6">
        <Text className="text-lg font-semibold text-gray-800 mb-3">
          Active Assignments ({assignments.length})
        </Text>
        
        {assignments.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {assignments.map((assignment, index) => (
              <TouchableOpacity 
                key={assignment.id}
                className={`p-3 rounded-lg mb-3 ${assignment.isAccepted ? 'bg-green-50' : 'bg-red-50'}`}
                onPress={() => {
                  setSelectedAssignment(assignment);
                  setShowFullReport(true);
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center flex-wrap mb-1">
                      <Text className={`font-bold text-base ${assignment.isAccepted ? 'text-green-800' : 'text-red-800'}`}>
                        Fire Report {generateReadableReportId(assignment.fireReportId)}
                      </Text>
                    </View>
                    <View className="flex-row items-center flex-wrap gap-2 mb-2">
                      {assignment.isAccepted && (
                        <View className="bg-green-100 px-2 py-1 rounded-full">
                          <Text className="text-green-800 text-xs font-bold">ACCEPTED</Text>
                        </View>
                      )}
                      <View 
                        className="px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: getFireReportStatusColor(assignment.status) }}
                      >
                        <Text 
                          className="text-xs font-bold text-white"
                        >
                          {assignment.status?.toUpperCase() || 'UNKNOWN'}
                        </Text>
                      </View>
                    </View>
                    <Text className={`text-sm mt-1 ${assignment.isAccepted ? 'text-green-700' : 'text-red-700'}`} numberOfLines={2}>
                      📍 {assignment.location}
                    </Text>
                    <Text className={`text-xs mt-1 ${assignment.isAccepted ? 'text-green-600' : 'text-red-600'}`} numberOfLines={1}>
                      🔥 {assignment.alarmLevel} • 📊 {assignment.aiDetection}
                    </Text>
                    {assignment.createdAt && (
                      <Text className={`text-xs mt-1 ${assignment.isAccepted ? 'text-green-500' : 'text-red-500'}`}>
                        Received: {new Date(assignment.createdAt).toLocaleString()}
                      </Text>
                    )}
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={assignment.isAccepted ? "#059669" : "#dc2626"} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View className="bg-gray-50 p-6 rounded-lg items-center">
            <MaterialIcons name="assignment" size={48} color="#9ca3af" />
            <Text className="text-gray-500 text-center mt-2">No active assignments</Text>
            <Text className="text-gray-400 text-sm text-center">You&apos;ll be notified when a new assignment comes in</Text>
          </View>
        )}
      </View>

      {/* Full Report Modal */}
      <Modal
        visible={showFullReport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFullReport(false)}
      >
        <View className="flex-1 bg-white">
          {/* Modal Header */}
          <View className="bg-red-600 pt-4 pb-3 px-4 flex-row items-center justify-between">
            <Text className="text-white text-xl font-bold">Fire Report Details</Text>
            <TouchableOpacity
              onPress={() => setShowFullReport(false)}
              className="bg-red-700 p-2 rounded-full"
            >
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4 pb-24">
            {selectedAssignment && (
              <View className="space-y-4">
                {/* Fire Report Header */}
                <View className="bg-white p-4 rounded-lg border border-gray-200">
                  <View className="flex-row items-center mb-4">
                    <Text className="text-2xl mr-2">🔥</Text>
                    <Text className="text-red-600 font-bold text-xl">Fire Report</Text>
                  </View>

                  {/* Reporter */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Reporter</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.reporter}</Text>
                  </View>

                  {/* Cause */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Cause</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.cause}</Text>
                  </View>

                  {/* Alarm Level with Badge */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Alarm Level</Text>
                    <View className="bg-red-600 px-3 py-1 rounded-full self-start">
                      <Text className="text-white text-sm font-bold">{selectedAssignment.alarmLevel}</Text>
                    </View>
                  </View>

                  {/* AI Fire Analysis with Badge */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">AI Fire Analysis</Text>
                    <View className="bg-red-600 px-3 py-1 rounded-full self-start">
                      <Text className="text-white text-sm font-bold">{selectedAssignment.aiDetection}</Text>
                    </View>
                  </View>

                  {/* Smoke Analysis */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Smoke Analysis</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.smokeAnalysis}</Text>
                  </View>

                  {/* Structure */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Structure</Text>
                    <Text className="text-gray-800 text-base">
                      {selectedAssignment.structure}
                      {selectedAssignment.structure_confidence ? ` (${selectedAssignment.structure_confidence})` : ''}
                    </Text>
                  </View>

                  {/* Structures Affected */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Structures Affected</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.structuresAffected}</Text>
                  </View>

                  {/* Location */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Location</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.location}</Text>
                  </View>

                  {/* Reported Time */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Reported</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.reportedTime}</Text>
                  </View>

                  {/* Fire Report Image */}
                  <View className="mb-4">
                    {selectedAssignment.imageUrl ? (
                      <Image
                        source={{ uri: selectedAssignment.imageUrl }}
                        className="w-full h-48 rounded-lg"
                        resizeMode="cover"
                        onError={() => {
                          console.log('Error loading image:', selectedAssignment.imageUrl);
                        }}
                      />
                    ) : (
                      <View className="bg-gray-200 h-48 rounded-lg items-center justify-center">
                        <MaterialIcons name="image" size={48} color="#9ca3af" />
                        <Text className="text-gray-500 text-sm mt-2">No image available</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

    </ScrollView>
  );
}
