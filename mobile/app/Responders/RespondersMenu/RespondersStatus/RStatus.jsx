import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../../config/AuthContext';
import { supabase } from '../../../config/supabase';

export default function RStatus({ onNavigateToMap }) {
  const { userData } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [nearbyReports, setNearbyReports] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
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

  // Helper function to check if report is "No Fire" + "No Smoke"
  const isNoFireNoSmoke = (report) => {
    const pred = (report?.prediction || '').toLowerCase();
    const smoke = (report?.smoke_detection || report?.smokeDetection || '').toLowerCase();
    return pred.includes('no fire') && smoke.includes('no smoke');
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Fetch nearby reports
  const fetchNearbyReports = async () => {
    if (!userLocation) {
      console.log('⚠️ No user location available for nearby reports');
      setNearbyReports([]);
      return;
    }

    try {
      console.log('🔍 Fetching nearby reports for responder...');
      
      // Fetch all reports from API
      const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
      if (!response.ok) {
        console.error('Failed to fetch fire reports from API');
        return;
      }

      const allReports = await response.json();
      console.log('🔥 All reports from API:', allReports.length);

      // Get assigned report IDs to exclude them from nearby reports
      const stationId = userData?.stationId || userData?.station_id;
      const assignedReportIds = new Set();
      
      if (stationId) {
        const { data: stationAssignments } = await supabase
          .from('report_assignments')
          .select('report_id')
          .eq('assignee_type', 'station')
          .eq('assignee_id', stationId);
        
        if (stationAssignments) {
          stationAssignments.forEach(a => assignedReportIds.add(String(a.report_id)));
        }
      }

      // Also exclude reports from current assignments list
      assignments.forEach(a => {
        if (a.fireReportId) {
          assignedReportIds.add(String(a.fireReportId));
        }
      });

      // Filter and calculate distance for nearby reports
      const MIN_DISTANCE_KM = 0.0; // Start from 0km
      const MAX_DISTANCE_KM = 10.0; // Within 10km
      
      const nearby = allReports
        .filter(report => {
          // Exclude "No Fire/No Smoke" reports
          if (isNoFireNoSmoke(report)) return false;
          
          // Exclude already assigned reports
          if (assignedReportIds.has(String(report.id))) return false;
          
          // Must have valid coordinates
          const latNum = typeof report?.latitude === 'number' ? report.latitude : parseFloat(report?.latitude);
          const lngNum = typeof report?.longitude === 'number' ? report.longitude : parseFloat(report?.longitude);
          if (isNaN(latNum) || isNaN(lngNum)) return false;
          
          // Calculate distance
          const distance = calculateDistance(
            userLocation.coords.latitude,
            userLocation.coords.longitude,
            latNum,
            lngNum
          );
          
          // Only include reports within range
          return distance >= MIN_DISTANCE_KM && distance <= MAX_DISTANCE_KM;
        })
        .map(report => {
          const latNum = typeof report?.latitude === 'number' ? report.latitude : parseFloat(report?.latitude);
          const lngNum = typeof report?.longitude === 'number' ? report.longitude : parseFloat(report?.longitude);
          const distance = calculateDistance(
            userLocation.coords.latitude,
            userLocation.coords.longitude,
            latNum,
            lngNum
          );
          
          return {
            ...report,
            latitude: latNum,
            longitude: lngNum,
            distance: distance,
            distanceText: distance < 1 
              ? `${Math.round(distance * 1000)}m away` 
              : `${distance.toFixed(1)}km away`
          };
        })
        .sort((a, b) => a.distance - b.distance); // Sort by closest first

      console.log(`✅ Found ${nearby.length} nearby report(s) within ${MAX_DISTANCE_KM}km`);
      setNearbyReports(nearby);
    } catch (error) {
      console.error('❌ Error fetching nearby reports:', error);
      setNearbyReports([]);
    }
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

      // APPROACH 2a: Direct responder assignments
      const { data: assignmentData, error: assignError } = await supabase
        .from('report_assignments')
        .select('report_id, assigned_at, note')
        .eq('assignee_type', 'responder')
        .eq('assignee_id', userData.id);

      if (assignError) {
        console.error('❌ Error loading report_assignments:', assignError);
      }

      // APPROACH 2b: Station-level assignments (what powers Map routes)
      const stationId = userData?.stationId || userData?.station_id;
      let stationAssignments = [];
      if (stationId) {
        const { data: stationData, error: stationAssignError } = await supabase
          .from('report_assignments')
          .select('report_id, assigned_at, note')
          .eq('assignee_type', 'station')
          .eq('assignee_id', stationId);

        if (stationAssignError) {
          console.error('❌ Error loading station assignments:', stationAssignError);
        } else {
          stationAssignments = stationData || [];
        }
      } else {
        console.log('ℹ️ No stationId on userData; skipping station assignments fetch');
      }

      console.log('📊 Notifications found:', notificationData?.length || 0);
      console.log('📊 Notification details:', JSON.stringify(notificationData, null, 2));
      console.log('📊 Direct assignments found:', assignmentData?.length || 0);
      console.log('📊 Assignment details:', JSON.stringify(assignmentData, null, 2));
      console.log('📊 Station assignments found:', stationAssignments.length || 0);
      console.log('📊 Station assignment details:', JSON.stringify(stationAssignments, null, 2));

      // Combine report IDs from both sources
      const reportIdsFromNotifications = (notificationData || [])
        .map(n => n.fire_report_id)
        .filter(Boolean)
        .map(String);
      
      const reportIdsFromAssignments = (assignmentData || [])
        .map(a => a.report_id)
        .filter(Boolean)
        .map(String);

      const reportIdsFromStationAssignments = stationAssignments
        .map(a => a.report_id)
        .filter(Boolean)
        .map(String);

      // Use Set to get unique report IDs
      const uniqueReportIds = [...new Set([
        ...reportIdsFromNotifications,
        ...reportIdsFromAssignments,
        ...reportIdsFromStationAssignments
      ])];
      
      console.log('📋 Report IDs from notifications:', reportIdsFromNotifications);
      console.log('📋 Report IDs from assignments:', reportIdsFromAssignments);
      console.log('📋 Report IDs from station assignments:', reportIdsFromStationAssignments);
      console.log('📋 Unique report IDs to load:', uniqueReportIds);

      if (uniqueReportIds.length === 0) {
        console.log('⚠️ No report IDs found - setting empty assignments');
        setAssignments([]);
        return;
      }

      // Create quick lookup maps for assignment metadata
      const stationAssignmentMap = new Map();
      stationAssignments.forEach(a => {
        stationAssignmentMap.set(String(a.report_id), {
          assignedAt: a.assigned_at,
          note: a.note,
          source: 'station'
        });
      });

      const directAssignmentMap = new Map();
      (assignmentData || []).forEach(a => {
        directAssignmentMap.set(String(a.report_id), {
          assignedAt: a.assigned_at,
          note: a.note,
          source: 'responder'
        });
      });

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
        const stationMeta = stationAssignmentMap.get(String(rid));
        const directMeta = directAssignmentMap.get(String(rid));
        const assignmentMeta = stationMeta || directMeta || null;
        return buildAssignmentFromReport(report, notif, assignmentMeta);
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
  const buildAssignmentFromReport = (fireReport, notification, assignmentMeta = null) => {
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
    const alarmLevelCleaned = cleanAlarmLevel(rawAlarmLevel);
    const alarmLevel = (!alarmLevelCleaned || String(alarmLevelCleaned).toLowerCase().includes('unknown'))
      ? '1st Alarm'
      : alarmLevelCleaned;
    
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
    // Derive status label
    let derivedStatus = fireReport.status || 'On Going';
    if (notification?.status) {
      derivedStatus = notification.status;
    } else if (assignmentMeta?.source === 'station') {
      derivedStatus = 'Assigned to Station';
    } else if (assignmentMeta?.source === 'responder') {
      derivedStatus = 'Assigned';
    }

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
      status: derivedStatus,
      isAccepted: notification?.status === 'accepted',
      reporter: reporterFromAPI,
      smokeAnalysis: smokeAnalysisFromAPI,
      structure: structureFromAPI,
      structuresAffected: structuresAffectedFromAPI,
      assignedAt: assignmentMeta?.assignedAt || notification?.created_at || fireReport.created_at || null,
      assignmentNote: assignmentMeta?.note || null,
      assignmentSource: assignmentMeta?.source || (notification ? 'notification' : null)
    };
  };

  // Get user location for nearby reports
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation(location);
          console.log('✅ Responder location obtained for nearby reports');
        }
      } catch (error) {
        console.error('❌ Error getting responder location:', error);
      }
    })();
  }, []);

  // Fetch nearby reports when location is available
  useEffect(() => {
    if (userLocation && userData?.id) {
      fetchNearbyReports();
      
      // Refresh nearby reports every 30 seconds
      const nearbyInterval = setInterval(() => {
        fetchNearbyReports();
      }, 30000);
      
      return () => clearInterval(nearbyInterval);
    }
  }, [userLocation, userData?.id, userData?.stationId, userData?.station_id, assignments]);

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
    await Promise.all([
      loadNotifications(),
      fetchNearbyReports()
    ]);
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

      {/* Nearby Reports Section */}
      {userLocation && (
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-3">
            Nearby Reports ({nearbyReports.length})
          </Text>
          
          {nearbyReports.length > 0 ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {nearbyReports.map((report) => {
                const alarmLevelRaw = report?.final_fire_alarm_level || report?.alarm_level || report?.recommended_alarm_level || report?.suggested_alarm_level || '1st Alarm';
                const alarmLevelText = (typeof alarmLevelRaw === 'string' ? alarmLevelRaw : String(alarmLevelRaw || '')).trim();
                const alarmLevel = !alarmLevelText || alarmLevelText.toLowerCase().includes('unknown') ? '1st Alarm' : alarmLevelText;
                const aiDetection = report?.prediction ? `${report.prediction}${report.confidence ? ` (${report.confidence}%)` : ''}` : 'Not analyzed';
                const location = report?.address || report?.resolved_address || report?.geotag_location || 'Unknown location';
                
                return (
                  <TouchableOpacity 
                    key={`nearby-${report.id}`}
                    className="p-3 rounded-lg mb-3 bg-blue-50 border border-blue-200"
                    onPress={() => {
                      if (onNavigateToMap) {
                        onNavigateToMap({
                          fireReportId: report.id,
                          location,
                          focusOnly: true, // do not build routes, just focus & open modal
                          destination: {
                            latitude: report.latitude ?? report.lat,
                            longitude: report.longitude ?? report.lng,
                          },
                        });
                      }
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-2">
                        <View className="flex-row items-center flex-wrap mb-1">
                          <Text className="font-bold text-base text-blue-800">
                            Fire Report {generateReadableReportId(report.id)}
                          </Text>
                          <View className="ml-2 bg-blue-100 px-2 py-1 rounded-full">
                            <Text className="text-blue-700 text-xs font-bold">{report.distanceText}</Text>
                          </View>
                        </View>
                        <View className="flex-row items-center flex-wrap gap-2 mb-2">
                          <View 
                            className="px-3 py-1.5 rounded-full"
                            style={{ backgroundColor: getFireReportStatusColor(report.status || 'On Going') }}
                          >
                            <Text className="text-xs font-bold text-white">
                              {(report.status || 'ON GOING').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-sm mt-1 text-blue-700" numberOfLines={2}>
                          📍 {location}
                        </Text>
                        <Text className="text-xs mt-1 text-blue-600" numberOfLines={1}>
                          🔥 {alarmLevel} • 📊 {aiDetection}
                        </Text>
                        {report.created_at && (
                          <Text className="text-xs mt-1 text-blue-500">
                            Reported: {new Date(report.created_at).toLocaleString()}
                          </Text>
                        )}
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color="#3b82f6" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View className="bg-gray-50 p-6 rounded-lg items-center">
              <MaterialIcons name="location-off" size={48} color="#9ca3af" />
              <Text className="text-gray-500 text-center mt-2">No nearby reports</Text>
              <Text className="text-gray-400 text-sm text-center">Reports within 10km will appear here</Text>
            </View>
          )}
        </View>
      )}

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
