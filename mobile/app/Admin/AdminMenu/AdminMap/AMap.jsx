import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput,
  StyleSheet, 
  Alert, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
  Image
} from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';
import { checkStationIsBusy, findNearestStations, findNearestStationsToStation, handleAssignmentResponse, calculateDistance } from '../../../utils/assignmentHelpers';

const { width, height } = Dimensions.get('window');

// Helper to drop "No Fire" + "No Smoke" reports
const isNoFireNoSmoke = (report) => {
  const pred = (report?.prediction || '').toLowerCase();
  const smoke = (report?.smoke_detection || report?.smokeDetection || '').toLowerCase();
  return pred.includes('no fire') && smoke.includes('no smoke');
};

export default function AMap({ isSidebarOpen = false }) {
  // Location states
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Map states
  const [mapRegion, setMapRegion] = useState({
    latitude: 10.3157, // BFP Regional Office VII
    longitude: 123.8854,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Fire reports states
  const [fireReports, setFireReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [stations, setStations] = useState([]);
  const [jurisdictionRadius] = useState(2000);
  const [assigneeType, setAssigneeType] = useState('station');
  const [assigneeId, setAssigneeId] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [redirectTarget, setRedirectTarget] = useState('');
  const [redirectNote, setRedirectNote] = useState('');
  
  // Assignment tracking states (for displaying current assignments and backup stations)
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [allAssignedStations, setAllAssignedStations] = useState([]);
  const [backupStationId, setBackupStationId] = useState(null);
  const [showWaitingBackupModal, setShowWaitingBackupModal] = useState(false);
  const [pendingBackupAssignment, setPendingBackupAssignment] = useState(null);

  // Dashboard states
  const [showDashboard, setShowDashboard] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWaitingApprovalModal, setShowWaitingApprovalModal] = useState(false);
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [isRerouteForForwarding, setIsRerouteForForwarding] = useState(false);
  const [nearestStations, setNearestStations] = useState([]);
  const [pendingAssignment, setPendingAssignment] = useState(null);
  const [selectedRerouteStation, setSelectedRerouteStation] = useState('');
  const [rerouteNote, setRerouteNote] = useState('');
  const [stationActiveCounts, setStationActiveCounts] = useState({}); // {stationId: busyCount} for reroute modal
  const [showDeclinedModal, setShowDeclinedModal] = useState(false);
  const [declinedStationName, setDeclinedStationName] = useState('');

  // Drawer gesture is disabled for this screen via exported options below.

  // Admin location - Bureau of Fire Protection Regional Office VII
  const adminLocation = {
    latitude: 10.3157,
    longitude: 123.8854,
    title: 'BFP Regional Office VII',
    description: 'Your Admin Location'
  };

  // Disable current location; keep map centered on adminLocation
  useEffect(() => {
    setLocationLoading(false);
    setLocation(null);
    setMapRegion({
      latitude: adminLocation.latitude,
      longitude: adminLocation.longitude,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    });
  }, []);

  // Fetch fire reports
  const fetchFireReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Fetched fire reports for mobile admin dashboard:', data.length);
        
        // Filter reports that have valid coordinates AND are not cancelled or fire out (and not no-fire/no-smoke or invalidated)
        const reportsWithCoords = data.filter(report => {
          const hasCoords = report.latitude && report.longitude && !isNaN(parseFloat(report.latitude)) && !isNaN(parseFloat(report.longitude));
          const statusText = (report.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          const isInvalidated = report.invalidated === true;
          return hasCoords && !isCancelled && !isFireOut && !isInvalidated && !isNoFireNoSmoke(report);
        });
        
        console.log('🔥 Reports with valid coordinates (excluding cancelled/fire out):', reportsWithCoords.length);
        
        // Log each report's location for debugging
        reportsWithCoords.forEach(report => {
          console.log(`Mobile Admin Report ${report.id}: ${parseFloat(report.latitude).toFixed(6)}, ${parseFloat(report.longitude).toFixed(6)} - ${report.address || report.geotag_location || 'No address'} - Status: ${report.status || 'Unknown'}`);
        });
        
        setFireReports(reportsWithCoords);
        console.log('✅ Valid fire reports (filtered):', reportsWithCoords.length);
      } else {
        console.error('❌ Failed to fetch fire reports:', response.status);
        Alert.alert('Error', 'Failed to fetch fire reports');
      }
    } catch (error) {
      console.error('❌ Error fetching fire reports:', error);
      Alert.alert('Error', 'Network error while fetching fire reports');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  // Load fire reports on component mount
  useEffect(() => {
    fetchFireReports();
  }, [fetchFireReports]);

  // Check for existing declined assignments on mount (in case admin logged in after station declined)
  useEffect(() => {
    const checkForDeclinedAssignments = async () => {
      try {
        console.log('🔍 AMap: Checking for existing declined assignments on mount...');
        
        // Get all declined assignments from the last 30 minutes
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        
        const { data: declinedAssignments, error } = await supabase
          .from('report_assignments')
          .select('*')
          .eq('assignee_type', 'station')
          .eq('status', 'declined')
          .gte('assigned_at', thirtyMinutesAgo)
          .order('assigned_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('❌ AMap: Error checking declined assignments:', error);
          return;
        }

        if (declinedAssignments && declinedAssignments.length > 0) {
          console.log(`✅ AMap: Found ${declinedAssignments.length} declined assignment(s) on mount`);
          
          // Process the most recent one
          const assignment = declinedAssignments[0];
          
          // Get station name
          const { data: stationData } = await supabase
            .from('station_users')
            .select('station_name')
            .eq('id', assignment.assignee_id)
            .single();
          
          const stationName = stationData?.station_name || 'Unknown Station';
          
          // Get report details
          const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';
          let reportData = null;
          try {
            const reportRes = await fetch(`${API_URL}/get_reports`);
            if (reportRes.ok) {
              const allReports = await reportRes.json();
              reportData = allReports.find(r => String(r.id) === String(assignment.report_id));
              
              // Skip if report is invalidated
              if (reportData && reportData.invalidated === true) {
                console.log('⚠️ Skipping invalidated report for declined assignment:', assignment.report_id);
                return;
              }
            }
          } catch (err) {
            console.error('Error fetching report data:', err);
          }
          
          // Set pending assignment
          setPendingAssignment({
            reportId: assignment.report_id,
            stationId: assignment.assignee_id,
            stationName: stationName
          });
          
          // Get report location
          const reportLat = reportData ? parseFloat(reportData.latitude) : NaN;
          const reportLng = reportData ? parseFloat(reportData.longitude) : NaN;
          const incidentLocation = (!isNaN(reportLat) && !isNaN(reportLng)) 
            ? { lat: reportLat, lng: reportLng } 
            : null;
          
          // Find nearest stations
          let nearest = [];
          if (!isNaN(reportLat) && !isNaN(reportLng)) {
            nearest = await findNearestStations(reportLat, reportLng, assignment.assignee_id, 5, incidentLocation);
          }
          if (nearest.length === 0) {
            nearest = await findNearestStationsToStation(assignment.assignee_id, assignment.assignee_id, 5, incidentLocation);
          }
          if (nearest.length === 0) {
            const { data: stations } = await supabase
              .from('station_users')
              .select('id, station_name, lat, lng')
              .neq('id', assignment.assignee_id);
            
            if (stations && stations.length > 0) {
              const stationsWithDistance = stations.map(station => {
                const stationLat = parseFloat(station.lat);
                const stationLng = parseFloat(station.lng);
                if (!isNaN(stationLat) && !isNaN(stationLng) && incidentLocation) {
                  const distanceToIncident = calculateDistance(stationLat, stationLng, incidentLocation.lat, incidentLocation.lng);
                  return {
                    ...station,
                    distanceToIncident: distanceToIncident,
                    distanceToIncidentKm: (distanceToIncident / 1000).toFixed(2)
                  };
                }
                return { ...station, distanceToIncident: null, distanceToIncidentKm: null };
              }).sort((a, b) => {
                if (a.distanceToIncident === null || a.distanceToIncident === Infinity) return 1;
                if (b.distanceToIncident === null || b.distanceToIncident === Infinity) return -1;
                return a.distanceToIncident - b.distanceToIncident;
              });
              nearest = stationsWithDistance;
            }
          }
          
          setNearestStations(nearest);
          
          if (reportData) {
            setSelectedReport({
              id: reportData.id,
              address: reportData.address,
              geotag_location: reportData.geotag_location,
              latitude: reportData.latitude,
              longitude: reportData.longitude,
              ...reportData
            });
          }
          
          // Show custom declined modal, then reroute modal
          setDeclinedStationName(stationName);
          setShowDeclinedModal(true);
          
          setTimeout(() => {
            setShowDeclinedModal(false);
            setShowRerouteModal(true);
            console.log('✅ AMap: Showing reroute modal for existing declined assignment');
          }, 2000);
        } else {
          console.log('ℹ️ AMap: No declined assignments found on mount');
        }
      } catch (error) {
        console.error('❌ AMap: Error checking declined assignments on mount:', error);
      }
    };

    // Check after a short delay to ensure component is mounted
    const timeoutId = setTimeout(checkForDeclinedAssignments, 2000);
    return () => clearTimeout(timeoutId);
  }, []); // Only run on mount

  // Real-time listener for assignment responses
  useEffect(() => {
    if (!pendingAssignment) return;

    const channel = supabase
      .channel(`assignment-responses-${pendingAssignment.reportId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'report_assignments',
        filter: `report_id=eq.${pendingAssignment.reportId}`
      }, async (payload) => {
        const assignment = payload.new;
        if (assignment.assignee_type === 'station' && 
            String(assignment.assignee_id) === String(pendingAssignment.stationId)) {
          
          if (assignment.status === 'accepted') {
            setShowWaitingApprovalModal(false);
            Alert.alert('✅ Accepted', `${pendingAssignment.stationName} has accepted the assignment.`);
            setPendingAssignment(null);
          } else if (assignment.status === 'declined') {
            setShowWaitingApprovalModal(false);
            
            // Get report location for finding nearest stations
            const reportLat = parseFloat(selectedReport?.latitude);
            const reportLng = parseFloat(selectedReport?.longitude);
            
            const incidentLocation = (!isNaN(reportLat) && !isNaN(reportLng)) 
              ? { lat: reportLat, lng: reportLng } 
              : null;
            
            let nearest = [];
            
            // First, try to find stations near the report location
            if (!isNaN(reportLat) && !isNaN(reportLng)) {
              nearest = await findNearestStations(
                reportLat, 
                reportLng, 
                pendingAssignment.stationId, 
                5,
                incidentLocation
              );
            }
            
            // If no stations found near report, find stations near the declined station
            if (nearest.length === 0) {
              console.log('📍 No stations found near report location, finding stations near declined station...');
              nearest = await findNearestStationsToStation(
                pendingAssignment.stationId,
                pendingAssignment.stationId,
                5,
                incidentLocation
              );
            }
            
            // If still no stations, fallback to ALL stations sorted by distance to incident
            if (nearest.length === 0) {
              console.log('📍 Fallback: Fetching all stations...');
              const { data: stations, error: stationsError } = await supabase
                .from('station_users')
                .select('id, station_name, lat, lng')
                .neq('id', pendingAssignment.stationId);
              
              if (stationsError) {
                console.error('❌ Error fetching stations:', stationsError);
              }
              
              console.log(`📍 Found ${stations?.length || 0} stations in database`);
              
              // Calculate distances to incident for all stations and sort
              if (stations && stations.length > 0) {
                const stationsWithDistance = stations
                  .map(station => {
                    const stationLat = parseFloat(station.lat);
                    const stationLng = parseFloat(station.lng);
                    if (!isNaN(stationLat) && !isNaN(stationLng) && incidentLocation) {
                      const distanceToIncident = calculateDistance(
                        stationLat,
                        stationLng,
                        incidentLocation.lat,
                        incidentLocation.lng
                      );
                      return {
                        ...station,
                        distance: 0, // No reference distance
                        distanceKm: '0',
                        distanceToIncident: distanceToIncident,
                        distanceToIncidentKm: (distanceToIncident / 1000).toFixed(2)
                      };
                    }
                    // If no coordinates or incident location, put at end but still include
                    return {
                      ...station,
                      distance: 0,
                      distanceKm: '0',
                      distanceToIncident: incidentLocation ? Infinity : null,
                      distanceToIncidentKm: null
                    };
                  })
                  .sort((a, b) => {
                    // Sort by distance to incident (stations with null/Infinity distance go to end)
                    if (a.distanceToIncident === null || a.distanceToIncident === Infinity) return 1;
                    if (b.distanceToIncident === null || b.distanceToIncident === Infinity) return -1;
                    return a.distanceToIncident - b.distanceToIncident;
                  });
                
                console.log(`📍 Prepared ${stationsWithDistance.length} stations with distances`);
                nearest = stationsWithDistance;
              } else {
                console.warn('⚠️ No stations found in database');
                nearest = stations || [];
              }
            }
            
            setNearestStations(nearest);
            setShowRerouteModal(true);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingAssignment, selectedReport]);

  // Real-time listener for backup assignment responses
  useEffect(() => {
    if (!pendingBackupAssignment) return;

    const channel = supabase
      .channel(`backup-assignment-responses-${pendingBackupAssignment.reportId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'report_assignments',
        filter: `report_id=eq.${pendingBackupAssignment.reportId}`
      }, async (payload) => {
        const assignment = payload.new;
        if (assignment.assignee_type === 'station' && 
            String(assignment.assignee_id) === String(pendingBackupAssignment.stationId) &&
            assignment.assignment_role === 'backup') {
          
          if (assignment.status === 'accepted') {
            setShowWaitingBackupModal(false);
            Alert.alert('✅ Backup Accepted', `${pendingBackupAssignment.stationName} has accepted the backup assignment.`);
            setPendingBackupAssignment(null);
            
            // Reload assignments
            if (selectedReport?.id) {
              loadAssignmentInfo(selectedReport.id);
            }
          } else if (assignment.status === 'declined') {
            setShowWaitingBackupModal(false);
            Alert.alert('⚠️ Backup Declined', `${pendingBackupAssignment.stationName} has declined the backup assignment.`);
            setPendingBackupAssignment(null);
            
            // Reload assignments
            if (selectedReport?.id) {
              loadAssignmentInfo(selectedReport.id);
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingBackupAssignment, selectedReport, loadAssignmentInfo]);

  // Global listener for declined assignments (works even if admin closed waiting modal)
  useEffect(() => {
    console.log('🔔 AMap: Setting up global declined assignments listener');
    
    const channel = supabase
      .channel('global-declined-assignments-mobile')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'report_assignments'
      }, async (payload) => {
        try {
          const assignment = payload.new;
          const oldAssignment = payload.old;
          
          console.log('🔄 AMap: Assignment UPDATE received:', {
            reportId: assignment.report_id,
            stationId: assignment.assignee_id,
            assigneeType: assignment.assignee_type,
            oldStatus: oldAssignment?.status,
            newStatus: assignment.status
          });
          
          // Only handle station declines
          if (assignment.assignee_type !== 'station') {
            console.log('⏭️ AMap: Not a station assignment, skipping');
            return;
          }
          
          // Check if status changed TO 'declined' (not just any update)
          const wasDeclined = oldAssignment?.status === 'declined';
          const isNowDeclined = assignment.status === 'declined';
          
          if (!isNowDeclined) {
            console.log('⏭️ AMap: Status is not declined, skipping. Current status:', assignment.status);
            return;
          }
          
          if (wasDeclined) {
            console.log('⏭️ AMap: Status was already declined, skipping (duplicate event)');
            return;
          }
          
          console.log('🚨 AMap: Station declined assignment detected (global listener):', {
            reportId: assignment.report_id,
            stationId: assignment.assignee_id,
            stationName: 'Fetching...'
          });
        
        // Get station name
        const { data: stationData } = await supabase
          .from('station_users')
          .select('station_name')
          .eq('id', assignment.assignee_id)
          .single();
        
        const stationName = stationData?.station_name || 'Unknown Station';
        
        // Get report details
        const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';
        let reportData = null;
        try {
          const reportRes = await fetch(`${API_URL}/get_reports`);
          if (reportRes.ok) {
            const allReports = await reportRes.json();
            reportData = allReports.find(r => String(r.id) === String(assignment.report_id));
            
            // Skip if report is invalidated
            if (reportData && reportData.invalidated === true) {
              console.log('⚠️ Skipping invalidated report for assignment:', assignment.report_id);
              return;
            }
          }
        } catch (err) {
          console.error('Error fetching report data:', err);
        }
        
        // Set pending assignment info for reroute modal
        setPendingAssignment({
          reportId: assignment.report_id,
          stationId: assignment.assignee_id,
          stationName: stationName
        });
        
        // Close waiting modal if open (use functional update to ensure we close it)
        setShowWaitingApprovalModal(prev => {
          if (prev) {
            console.log('🔄 AMap: Closing waiting approval modal');
          }
          return false;
        });
        
        // Get report location for finding nearest stations
        const reportLat = reportData ? parseFloat(reportData.latitude) : NaN;
        const reportLng = reportData ? parseFloat(reportData.longitude) : NaN;
        
        const incidentLocation = (!isNaN(reportLat) && !isNaN(reportLng)) 
          ? { lat: reportLat, lng: reportLng } 
          : null;
        
        let nearest = [];
        
        // First, try to find stations near the report location
        if (!isNaN(reportLat) && !isNaN(reportLng)) {
          nearest = await findNearestStations(
            reportLat, 
            reportLng, 
            assignment.assignee_id, 
            5,
            incidentLocation
          );
        }
        
        // If no stations found near report, find stations near the declined station
        if (nearest.length === 0) {
          console.log('📍 No stations found near report location, finding stations near declined station...');
          nearest = await findNearestStationsToStation(
            assignment.assignee_id,
            assignment.assignee_id,
            5,
            incidentLocation
          );
        }
        
        // If still no stations, fallback to ALL stations sorted by distance to incident
        if (nearest.length === 0) {
          console.log('📍 Fallback: Fetching all stations...');
          const { data: stations, error: stationsError } = await supabase
            .from('station_users')
            .select('id, station_name, lat, lng')
            .neq('id', assignment.assignee_id);
          
          if (stationsError) {
            console.error('❌ Error fetching stations:', stationsError);
          }
          
          console.log(`📍 Found ${stations?.length || 0} stations in database`);
          
          // Calculate distances to incident for all stations and sort
          if (stations && stations.length > 0) {
            const stationsWithDistance = stations
              .map(station => {
                const stationLat = parseFloat(station.lat);
                const stationLng = parseFloat(station.lng);
                if (!isNaN(stationLat) && !isNaN(stationLng) && incidentLocation) {
                  const distanceToIncident = calculateDistance(
                    stationLat,
                    stationLng,
                    incidentLocation.lat,
                    incidentLocation.lng
                  );
                  return {
                    ...station,
                    distance: 0, // No reference distance
                    distanceKm: '0',
                    distanceToIncident: distanceToIncident,
                    distanceToIncidentKm: (distanceToIncident / 1000).toFixed(2)
                  };
                }
                // If no coordinates or incident location, put at end but still include
                return {
                  ...station,
                  distance: 0,
                  distanceKm: '0',
                  distanceToIncident: incidentLocation ? Infinity : null,
                  distanceToIncidentKm: null
                };
              })
              .sort((a, b) => {
                // Sort by distance to incident (stations with null/Infinity distance go to end)
                if (a.distanceToIncident === null || a.distanceToIncident === Infinity) return 1;
                if (b.distanceToIncident === null || b.distanceToIncident === Infinity) return -1;
                return a.distanceToIncident - b.distanceToIncident;
              });
            
            console.log(`📍 Prepared ${stationsWithDistance.length} stations with distances`);
            nearest = stationsWithDistance;
          } else {
            console.warn('⚠️ No stations found in database');
            nearest = stations || [];
          }
        }
        
        setNearestStations(nearest);
        
        // If report is not selected, select it for context (even if minimal data)
        if (!selectedReport || String(selectedReport.id) !== String(assignment.report_id)) {
          if (reportData) {
            setSelectedReport({
              id: reportData.id,
              address: reportData.address,
              geotag_location: reportData.geotag_location,
              latitude: reportData.latitude,
              longitude: reportData.longitude,
              ...reportData // Include all report data for context
            });
          } else {
            // Set minimal report data so modal can show
            setSelectedReport({
              id: assignment.report_id,
              address: null,
              geotag_location: null,
              latitude: null,
              longitude: null
            });
          }
        }
        
        // Create notification for admin about the decline
        try {
          const locationInfo = reportData?.address || reportData?.geotag_location || 'Location unavailable';
          await supabase
            .from('notifications')
            .insert({
              user_id: 'admin', // Admin notifications
              user_type: 'admin',
              type: 'assignment',
              related_report_id: String(assignment.report_id),
              title: `⚠️ Station Declined Assignment`,
              message: `${stationName} has declined the assignment for report at ${locationInfo}. Please reroute to another station.`,
              priority: 'urgent',
              is_read: false
            });
          console.log('✅ AMap: Created admin notification for declined assignment');
        } catch (notifError) {
          console.error('❌ AMap: Error creating admin notification:', notifError);
        }
        
        // Show custom declined modal, then reroute modal
        setDeclinedStationName(stationName);
        setShowDeclinedModal(true);
        
        // Show reroute modal after declined modal (always show, even if report data is minimal)
        console.log('✅ AMap: Showing reroute modal');
        console.log('📊 AMap: Modal state before:', {
          pendingAssignment: { reportId: assignment.report_id, stationId: assignment.assignee_id, stationName },
          nearestStationsCount: nearest.length,
          selectedReportId: reportData?.id || assignment.report_id
        });
        
        // Use setTimeout to ensure state updates are processed
        setTimeout(() => {
          setShowDeclinedModal(false);
          setShowRerouteModal(true);
          console.log('✅ AMap: setShowRerouteModal(true) called');
        }, 2000);
        } catch (error) {
          console.error('❌ AMap: Error in global declined assignments listener:', error);
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ AMap: Subscription error:', err);
          Alert.alert('Subscription Error', `Failed to subscribe to assignment updates: ${err.message}`);
        } else {
          console.log('✅ AMap: Global declined assignments listener subscribed:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ AMap: Successfully subscribed to report_assignments updates');
          } else {
            console.warn('⚠️ AMap: Subscription status is:', status);
          }
        }
      });

    return () => {
      console.log('🛑 AMap: Cleaning up global declined assignments listener');
      supabase.removeChannel(channel);
    };
  }, []); // Empty dependencies - listener should always be active

  // Fallback: Poll for declined assignments every 5 seconds (in case real-time fails)
  useEffect(() => {
    let pollInterval;
    
    const checkForDeclinedAssignments = async () => {
      try {
        // Get all declined assignments from the last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        const { data: declinedAssignments, error } = await supabase
          .from('report_assignments')
          .select('*')
          .eq('assignee_type', 'station')
          .eq('status', 'declined')
          .gte('assigned_at', fiveMinutesAgo)
          .order('assigned_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('❌ AMap: Error polling declined assignments:', error);
          return;
        }

        if (declinedAssignments && declinedAssignments.length > 0) {
          // Check if we already have a pending assignment for this report
          const unhandledDecline = declinedAssignments.find(assignment => {
            // Only handle if we don't already have this in pendingAssignment
            if (pendingAssignment && String(assignment.report_id) === String(pendingAssignment.reportId)) {
              return false; // Already handling this
            }
            return true;
          });

          if (unhandledDecline && !showRerouteModal) {
            console.log('🔍 AMap: Found unhandled declined assignment via polling:', unhandledDecline);
            // Trigger the same logic as the real-time listener
            // This will be handled by creating a synthetic event
            const syntheticPayload = {
              new: unhandledDecline,
              old: { status: 'pending' } // Assume it was pending before
            };
            
            // Manually trigger the handler
            // We'll set a flag to prevent duplicate processing
            const assignment = unhandledDecline;
            
            // Get station name
            const { data: stationData } = await supabase
              .from('station_users')
              .select('station_name')
              .eq('id', assignment.assignee_id)
              .single();
            
            const stationName = stationData?.station_name || 'Unknown Station';
            
            // Get report details
            const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';
            let reportData = null;
            try {
              const reportRes = await fetch(`${API_URL}/get_reports`);
              if (reportRes.ok) {
                const allReports = await reportRes.json();
                reportData = allReports.find(r => String(r.id) === String(assignment.report_id));
                
                // Skip if report is invalidated
                if (reportData && reportData.invalidated === true) {
                  console.log('⚠️ Skipping invalidated report for backup assignment:', assignment.report_id);
                  return;
                }
              }
            } catch (err) {
              console.error('Error fetching report data:', err);
            }
            
            // Set pending assignment
            setPendingAssignment({
              reportId: assignment.report_id,
              stationId: assignment.assignee_id,
              stationName: stationName
            });
            
            // Get report location
            const reportLat = reportData ? parseFloat(reportData.latitude) : NaN;
            const reportLng = reportData ? parseFloat(reportData.longitude) : NaN;
            const incidentLocation = (!isNaN(reportLat) && !isNaN(reportLng)) 
              ? { lat: reportLat, lng: reportLng } 
              : null;
            
            // Find nearest stations
            let nearest = [];
            if (!isNaN(reportLat) && !isNaN(reportLng)) {
              nearest = await findNearestStations(reportLat, reportLng, assignment.assignee_id, 5, incidentLocation);
            }
            if (nearest.length === 0) {
              nearest = await findNearestStationsToStation(assignment.assignee_id, assignment.assignee_id, 5, incidentLocation);
            }
            if (nearest.length === 0) {
              const { data: stations } = await supabase
                .from('station_users')
                .select('id, station_name, lat, lng')
                .neq('id', assignment.assignee_id);
              
              if (stations && stations.length > 0) {
                const stationsWithDistance = stations.map(station => {
                  const stationLat = parseFloat(station.lat);
                  const stationLng = parseFloat(station.lng);
                  if (!isNaN(stationLat) && !isNaN(stationLng) && incidentLocation) {
                    const distanceToIncident = calculateDistance(stationLat, stationLng, incidentLocation.lat, incidentLocation.lng);
                    return {
                      ...station,
                      distanceToIncident: distanceToIncident,
                      distanceToIncidentKm: (distanceToIncident / 1000).toFixed(2)
                    };
                  }
                  return { ...station, distanceToIncident: null, distanceToIncidentKm: null };
                }).sort((a, b) => {
                  if (a.distanceToIncident === null || a.distanceToIncident === Infinity) return 1;
                  if (b.distanceToIncident === null || b.distanceToIncident === Infinity) return -1;
                  return a.distanceToIncident - b.distanceToIncident;
                });
                nearest = stationsWithDistance;
              }
            }
            
            setNearestStations(nearest);
            
            if (reportData) {
              setSelectedReport({
                id: reportData.id,
                address: reportData.address,
                geotag_location: reportData.geotag_location,
                latitude: reportData.latitude,
                longitude: reportData.longitude,
                ...reportData
              });
            }
            
            // Show custom declined modal, then reroute modal
            setDeclinedStationName(stationName);
            setShowDeclinedModal(true);
            
            setTimeout(() => {
              setShowDeclinedModal(false);
              setShowRerouteModal(true);
            }, 2000);
          }
        }
      } catch (error) {
        console.error('❌ AMap: Error in polling check:', error);
      }
    };

    // Poll every 5 seconds
    pollInterval = setInterval(checkForDeclinedAssignments, 5000);
    
    // Also check immediately
    checkForDeclinedAssignments();

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pendingAssignment, showRerouteModal]); // Re-check when these change

  // Fetch active incident counts for stations in reroute modal
  useEffect(() => {
    if (nearestStations.length > 0 && showRerouteModal) {
      const fetchActiveCounts = async () => {
        const counts = {};
        await Promise.all(
          nearestStations.map(async (station) => {
            try {
              const busyCheck = await checkStationIsBusy(station.id);
              counts[station.id] = busyCheck.busyCount || 0;
            } catch (error) {
              console.error(`Error fetching active count for station ${station.id}:`, error);
              counts[station.id] = 0;
            }
          })
        );
        setStationActiveCounts(counts);
      };
      fetchActiveCounts();
    } else {
      setStationActiveCounts({});
    }
  }, [nearestStations, showRerouteModal]);

  // Handle reroute/forward to selected station
  const handleReroute = async () => {
    if (!selectedRerouteStation || !pendingAssignment) {
      Alert.alert('Error', `Please select a station to ${isRerouteForForwarding ? 'forward to' : 'reroute to'}.`);
      return;
    }

    try {
      // Get new station name
      const { data: newStationData } = await supabase
        .from('station_users')
        .select('station_name')
        .eq('id', selectedRerouteStation)
        .single();

      const newStationName = newStationData?.station_name || 'Station';

      if (isRerouteForForwarding) {
        // Forwarding: Remove old assignment and create new one (same as web version)
        // First, delete the current assignment
        await supabase
          .from('report_assignments')
          .delete()
          .eq('report_id', pendingAssignment.reportId)
          .eq('assignee_type', 'station')
          .eq('assignee_id', pendingAssignment.stationId);

        // Delete ALL station assignments for this report to ensure clean state
        await supabase
          .from('report_assignments')
          .delete()
          .eq('report_id', pendingAssignment.reportId)
          .eq('assignee_type', 'station');
        
        // Create new assignment (always pending for forwarded assignments)
        const noteText = rerouteNote && rerouteNote.trim() 
          ? `Forwarded from ${pendingAssignment.stationName}: ${rerouteNote.trim()}` 
          : `Forwarded from ${pendingAssignment.stationName}`;
        
        const payload = {
          report_id: pendingAssignment.reportId,
          assignee_type: 'station',
          assignee_id: selectedRerouteStation,
          assigned_at: new Date().toISOString(),
          status: 'pending', // Always require approval for forwarded assignments
          assignment_source: 'manual',
          note: noteText
        };

        const { error } = await supabase
          .from('report_assignments')
          .insert(payload);

        if (error) {
          console.error('❌ Error inserting new assignment:', error);
          throw error;
        }

        // Update pendingAssignment to track the new station
        setPendingAssignment({
          reportId: pendingAssignment.reportId,
          stationId: selectedRerouteStation,
          stationName: newStationName
        });

        // Show waiting modal
        setShowRerouteModal(false);
        setShowWaitingApprovalModal(true);

        // Create notification for new station
        if (selectedReport) {
          const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
          const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
          const noteText = rerouteNote && rerouteNote.trim() ? `\n\nNote: ${rerouteNote.trim()}` : '';
          const title = `🚨 Fire Report Forwarded to Your Station - Action Required`;
          const message = `Command Center is forwarding a fire report to your station.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\nPrevious station: ${pendingAssignment.stationName}${noteText}\n\nWill you accept this assignment?`;
          
          await supabase
            .from('notifications')
            .insert({
              user_id: selectedRerouteStation,
              user_type: 'station',
              type: 'assignment',
              related_report_id: String(pendingAssignment.reportId),
              title: title,
              message: message,
              priority: 'urgent',
              is_read: false
            });
        }

        // Reload assignment info
        if (selectedReport?.id) {
          loadAssignmentInfo(selectedReport.id);
        }
      } else {
        // Rerouting: Remove the declined assignment and create new one
        await supabase
          .from('report_assignments')
          .delete()
          .eq('report_id', pendingAssignment.reportId)
          .eq('assignee_type', 'station')
          .eq('assignee_id', pendingAssignment.stationId);

        // Delete ALL station assignments for this report to ensure clean state
        await supabase
          .from('report_assignments')
          .delete()
          .eq('report_id', pendingAssignment.reportId)
          .eq('assignee_type', 'station');

        // Create new assignment to the selected station (always pending for reroutes)
        const noteText = rerouteNote && rerouteNote.trim() 
          ? `Rerouted from ${pendingAssignment.stationName}: ${rerouteNote.trim()}`
          : `Rerouted from ${pendingAssignment.stationName}`;
        
        const payload = {
          report_id: pendingAssignment.reportId,
          assignee_type: 'station',
          assignee_id: selectedRerouteStation,
          assigned_at: new Date().toISOString(),
          status: 'pending', // Always require approval for rerouted assignments
          assignment_source: 'manual',
          note: noteText
        };

        const { error } = await supabase
          .from('report_assignments')
          .insert(payload);

        if (error) {
          console.error('❌ Error inserting new assignment:', error);
          throw error;
        }

        // Update pendingAssignment to track the new station
        setPendingAssignment({
          reportId: pendingAssignment.reportId,
          stationId: selectedRerouteStation,
          stationName: newStationName
        });

        // Show waiting modal
        setShowRerouteModal(false);
        setShowWaitingApprovalModal(true);

        // Create notification for new station
        if (selectedReport) {
          const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
          const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
          const title = `🚨 Fire Report Rerouted to Your Station - Action Required`;
          const message = `Command Center is rerouting a fire report to your station.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\nPrevious station: ${pendingAssignment.stationName}\n\nWill you accept this assignment?`;
          
          await supabase
            .from('notifications')
            .insert({
              user_id: selectedRerouteStation,
              user_type: 'station',
              type: 'assignment',
              related_report_id: String(pendingAssignment.reportId),
              title: title,
              message: message,
              priority: 'urgent',
              is_read: false
            });
        }
      }

      setSelectedRerouteStation('');
      setRerouteNote('');
      setStationActiveCounts({});
      setIsRerouteForForwarding(false);
    } catch (e) {
      console.error(`❌ ${isRerouteForForwarding ? 'Forward' : 'Reroute'} failed:`, e);
      Alert.alert('Error', `Failed to ${isRerouteForForwarding ? 'forward' : 'reroute'} report. Check console.`);
    }
  };

  // Load stations and geocode addresses for markers
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('station_users')
          .select('id, station_name, lat, lng');
        if (error) throw error;
        const withCoords = (data || [])
          .map(s => ({
            ...s,
            lat: typeof s.lat === 'number' ? s.lat : parseFloat(s.lat),
            lng: typeof s.lng === 'number' ? s.lng : parseFloat(s.lng)
          }))
          .filter(s => !isNaN(s.lat) && !isNaN(s.lng));
        setStations(withCoords);
        if (withCoords.length > 0) {
          // Center to first station to guarantee visibility
          setMapRegion(r => ({
            latitude: withCoords[0].lat,
            longitude: withCoords[0].lng,
            latitudeDelta: r.latitudeDelta,
            longitudeDelta: r.longitudeDelta
          }));
        }
      } catch (e) {
        console.error('Stations load error (mobile):', e);
        setStations([]);
      }
    })();
  }, []);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFireReports();
    setRefreshing(false);
  }, [fetchFireReports]);

  // Helper function to clean alarm level text
  const cleanAlarmLevel = (alarmLevel) => {
    if (!alarmLevel) return alarmLevel;
    if (typeof alarmLevel === 'string' && alarmLevel.includes('- structure count not provided')) {
      return alarmLevel.split('- structure count not provided')[0].trim();
    }
    return alarmLevel;
  };

  // Determine suggested alarm based on number of structures
  const determineSuggestedAlarm = (numStructures) => {
    const count = Number(numStructures);
    if (!count || isNaN(count)) return null;
    if (count >= 80) return 'GENERAL ALARM';
    if (count >= 36) return 'TASK FORCE DELTA';
    if (count >= 32) return 'TASK FORCE CHARLIE';
    if (count >= 28) return 'TASK FORCE BRAVO';
    if (count >= 24) return 'TASK FORCE ALPHA';
    if (count >= 20) return '5th Alarm';
    if (count >= 16) return '4th Alarm';
    if (count >= 12) return '3rd Alarm';
    if (count >= 8) return '2nd Alarm';
    if (count >= 4) return '1st Alarm';
    return 'Under Control';
  };

  // Resolve the best available alarm level
  const resolveAlarmLevel = (report) => {
    const normalize = (value) => {
      if (!value) return null;
      const cleaned = cleanAlarmLevel(String(value).trim());
      if (!cleaned) return null;
      const lower = cleaned.toLowerCase();
      if (lower === 'unknown' || lower === 'none') return null;
      return cleaned;
    };

    const candidates = [
      normalize(report?.final_fire_alarm_level),
      normalize(report?.recommended_alarm_level),
      normalize(report?.suggested_alarm_level),
      normalize(report?.ai_suggested_alarm),
      normalize(report?.alarm_level)
    ].filter(Boolean);

    if (candidates.length > 0) return candidates[0];

    const computed = determineSuggestedAlarm(report?.number_of_structures_on_fire || report?.structures_affected);
    return computed || '1st Alarm';
  };

  // Get alarm level color
  const getAlarmLevelColor = (alarmLevel) => {
    if (!alarmLevel) return '#6b7280';
    
    const level = alarmLevel.toLowerCase();
    
    if (level.includes('1st') || level.includes('first')) return '#fef3c7';
    if (level.includes('2nd') || level.includes('second')) return '#fed7aa';
    if (level.includes('3rd') || level.includes('third')) return '#fecaca';
    if (level.includes('4th') || level.includes('fourth')) return '#f87171';
    if (level.includes('5th') || level.includes('fifth')) return '#ef4444';
    if (level.includes('task force alpha')) return '#dc2626';
    if (level.includes('task force bravo')) return '#b91c1c';
    if (level.includes('task force charlie')) return '#991b1b';
    if (level.includes('task force delta')) return '#7f1d1d';
    if (level.includes('general alarm')) return '#450a0a';
    if (level.includes('fire out')) return '#93c5fd';
    if (level.includes('under control')) return '#fbbf24';
    if (level.includes('false alarm')) return '#9ca3af';
    
    return '#6b7280';
  };

  // Get marker color
  const getMarkerColor = (report) => {
    const resolved = resolveAlarmLevel(report);
    if (resolved) return getAlarmLevelColor(resolved);
    
    switch (report.prediction) {
      case 'Fire': return '#ef4444';
      case 'No Fire': return '#93c5fd';
      default: return '#6b7280';
    }
  };

  // Handle marker press
  const handleMarkerPress = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const handleAssign = async () => {
    try {
      if (!selectedReport || !assigneeId) return;

      // If assigning to a station, check if station is busy
      if (assigneeType === 'station') {
        const busyCheck = await checkStationIsBusy(assigneeId);
        
        if (busyCheck.isBusy) {
          // Station is busy - set assignment to pending and show waiting modal
          // First, delete any existing assignment for this report to avoid conflicts
          await supabase
            .from('report_assignments')
            .delete()
            .eq('report_id', String(selectedReport.id))
            .eq('assignee_type', 'station');
          
          const payload = {
            report_id: String(selectedReport.id),
            assignee_type: assigneeType,
            assignee_id: assigneeId,
            assigned_at: new Date().toISOString(),
            status: 'pending',
            assignment_source: 'manual',
            assignment_role: assigneeType === 'station' ? 'primary' : null,
            note: assignmentNote && assignmentNote.trim() ? assignmentNote.trim() : null
          };
          
          // Use insert instead of upsert to ensure INSERT listener is triggered
          const { error } = await supabase
            .from('report_assignments')
            .insert(payload);
          
          if (error) throw error;

          // Get station name for modal
          const { data: stationData } = await supabase
            .from('station_users')
            .select('station_name')
            .eq('id', assigneeId)
            .single();

          setPendingAssignment({
            reportId: String(selectedReport.id),
            stationId: assigneeId,
            stationName: stationData?.station_name || 'Station'
          });
          setShowWaitingApprovalModal(true);

          // Create notification for the assigned station
          const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
          const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
          const title = `🚨 New Fire Report Assignment - Action Required`;
          const message = `Command Center is assigning you a report.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nWill you accept this assignment?`;
          
          await supabase
            .from('notifications')
            .insert({
              user_id: assigneeId,
              user_type: 'station',
              type: 'assignment',
              related_report_id: String(selectedReport.id),
              title: title,
              message: message,
              priority: 'urgent',
              is_read: false
            });

          setAssignmentNote('');
          return; // Don't show success alert, modal will handle it
        }
      }

      // Station is not busy - auto-accept assignment
      if (assigneeType === 'station') {
        // First, delete any existing assignment for this report to avoid conflicts
        await supabase
          .from('report_assignments')
          .delete()
          .eq('report_id', String(selectedReport.id))
          .eq('assignee_type', 'station');
        
        const payload = {
          report_id: String(selectedReport.id),
          assignee_type: assigneeType,
          assignee_id: assigneeId,
          assigned_at: new Date().toISOString(),
          status: 'accepted',
          assignment_source: 'manual',
          assignment_role: assigneeType === 'station' ? 'primary' : null,
          note: assignmentNote && assignmentNote.trim() ? assignmentNote.trim() : null
        };
        
        // Use insert instead of upsert to ensure INSERT listener is triggered
        const { error } = await supabase
          .from('report_assignments')
          .insert(payload);
        
        if (error) throw error;

        // Get station name for success message
        const { data: stationData } = await supabase
          .from('station_users')
          .select('station_name')
          .eq('id', assigneeId)
          .single();

        const stationName = stationData?.station_name || 'Station';
        
        // Create notification for the assigned station (even though auto-accepted, still notify)
        const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
        const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
        const title = `🚨 New Fire Report Assignment`;
        const message = `You have been assigned a new fire report.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}`;
        
        await supabase
          .from('notifications')
          .insert({
            user_id: assigneeId,
            user_type: 'station',
            type: 'assignment',
            related_report_id: String(selectedReport.id),
            title: title,
            message: message,
            priority: 'urgent',
            is_read: false
          });

        setAssignmentNote('');
        Alert.alert('✅ Assignment Successful', `Assignment successfully assigned to ${stationName}.`);
        
        // Reload assignment info
        if (selectedReport?.id) {
          loadAssignmentInfo(selectedReport.id);
        }
        return;
      }

      // For responders, proceed normally
      const payload = {
        report_id: String(selectedReport.id),
        assignee_type: assigneeType,
        assignee_id: assigneeId,
        assigned_at: new Date().toISOString(),
        status: 'accepted',
        assignment_source: 'manual'
      };
      
      console.log('[Assign-Mobile] assignmentNote=', assignmentNote);
      const { error } = await supabase
        .from('report_assignments')
        .upsert({ ...payload, note: assignmentNote && assignmentNote.trim() ? assignmentNote.trim() : null }, { onConflict: 'report_id,assignee_type,assignee_id' });
      if (error) throw error;

      setAssignmentNote('');
      
      // Reload assignment info
      if (selectedReport?.id) {
        loadAssignmentInfo(selectedReport.id);
      }
    } catch (e) {
      console.error('Assign failed (mobile):', e);
      Alert.alert('Error', 'Failed to assign report.');
    }
  };

  const handleRedirect = async () => {
    try {
      if (!selectedReport || !redirectTarget) return;
      const payload = {
        report_id: String(selectedReport.id),
        target: redirectTarget,
        note: redirectNote || null,
        forwarded_at: new Date().toISOString()
      };
      const { error } = await supabase
        .from('report_routes')
        .insert(payload);
      if (error) throw error;
      Alert.alert('Forwarded', 'Report forwarded successfully.');
      setRedirectNote('');
    } catch (e) {
      console.error('Redirect failed (mobile):', e);
      Alert.alert('Error', 'Failed to forward report.');
    }
  };

  // Load assignment info (current assignment and all assigned stations including backups)
  const loadAssignmentInfo = useCallback(async (reportId) => {
    try {
      setCurrentAssignment(null);
      setAllAssignedStations([]);

      if (!reportId) return;

      // Fetch ALL station assignments (primary + backups)
      const { data: assignments, error } = await supabase
        .from('report_assignments')
        .select('assignee_id, status, assignment_role, assigned_at, note')
        .eq('report_id', reportId)
        .eq('assignee_type', 'station')
        .in('status', ['accepted', 'pending'])
        .order('assignment_role', { ascending: true }) // primary first
        .order('assigned_at', { ascending: false });

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Error fetching station assignments:', error);
        }
        return;
      }

      if (assignments && assignments.length > 0) {
        // Fetch all station names
        const stationIds = assignments.map(a => a.assignee_id);
        const { data: stationsData } = await supabase
          .from('station_users')
          .select('id, station_name')
          .in('id', stationIds);

        const stationMap = {};
        (stationsData || []).forEach(s => {
          stationMap[s.id] = s.station_name;
        });

        const allStations = assignments.map(a => ({
          id: a.assignee_id,
          name: stationMap[a.assignee_id] || 'Unknown Station',
          status: a.status,
          role: a.assignment_role || 'primary',
          assigned_at: a.assigned_at,
          note: a.note
        }));

        setAllAssignedStations(allStations);

        // Set primary station as current assignment
        const primary = allStations.find(s => s.role === 'primary');
        if (primary) {
          setCurrentAssignment({
            id: primary.id,
            name: primary.name,
            status: primary.status,
            assigned_at: primary.assigned_at,
            note: primary.note
          });
        } else if (allStations.length > 0) {
          // Fallback to first station if no primary found
          setCurrentAssignment({
            id: allStations[0].id,
            name: allStations[0].name,
            status: allStations[0].status,
            assigned_at: allStations[0].assigned_at,
            note: allStations[0].note
          });
        }
      }
    } catch (e) {
      console.error('Failed loading assignment info:', e);
      setCurrentAssignment(null);
      setAllAssignedStations([]);
    }
  }, []);

  // Load assignment info when a report is selected
  useEffect(() => {
    if (selectedReport?.id) {
      loadAssignmentInfo(selectedReport.id);
      setBackupStationId(null); // Reset backup station selection when report changes
    } else {
      setCurrentAssignment(null);
      setAllAssignedStations([]);
      setBackupStationId(null);
    }
  }, [selectedReport, loadAssignmentInfo]);

  // Handle backup station assignment (for alarm level 2+ incidents)
  const handleAssignBackup = async () => {
    try {
      if (!selectedReport) {
        Alert.alert('Error', 'Select a fire report first.');
        return;
      }
      if (!backupStationId) {
        Alert.alert('Error', 'Choose a backup station.');
        return;
      }

      // Validate alarm level - must be 2 or higher
      const alarmLevel = resolveAlarmLevel(selectedReport);
      const alarmLevelCleaned = alarmLevel || '';
      const alarmLevelLower = alarmLevelCleaned.toLowerCase();
      const isAlarmLevel2Plus = alarmLevelCleaned && (
        alarmLevelLower.includes('second alarm') ||
        alarmLevelLower.includes('2nd alarm') ||
        alarmLevelLower.includes('third alarm') ||
        alarmLevelLower.includes('3rd alarm') ||
        alarmLevelLower.includes('fourth alarm') ||
        alarmLevelLower.includes('4th alarm') ||
        alarmLevelLower.includes('fifth alarm') ||
        alarmLevelLower.includes('5th alarm') ||
        alarmLevelLower.includes('task force alpha') ||
        alarmLevelLower.includes('task force bravo') ||
        alarmLevelLower.includes('task force charlie') ||
        alarmLevelLower.includes('task force delta') ||
        alarmLevelLower.includes('general alarm')
      );

      if (!isAlarmLevel2Plus) {
        Alert.alert('Cannot Assign Backup', `Backup stations can only be assigned to incidents with Alarm Level 2 or higher.\n\nCurrent alarm level: ${alarmLevelCleaned}`);
        return;
      }

      // Check if this station is already assigned with active status
      const { data: existingAssignments, error: checkError } = await supabase
        .from('report_assignments')
        .select('assignment_role, status')
        .eq('report_id', selectedReport.id)
        .eq('assignee_type', 'station')
        .eq('assignee_id', backupStationId)
        .in('status', ['pending', 'accepted']);

      if (checkError) {
        console.error('Error checking existing backup assignment:', checkError);
        Alert.alert('Error', 'Failed to check station assignment status. Please try again.');
        return;
      }

      if (existingAssignments && existingAssignments.length > 0) {
        const activeAssignment = existingAssignments[0];
        const role = activeAssignment.assignment_role === 'primary' ? 'primary station' : 'backup station';
        Alert.alert('Already Assigned', `This station is already assigned as ${role} for this incident.`);
        return;
      }

      // Delete old declined assignments for this station
      await supabase
        .from('report_assignments')
        .delete()
        .eq('report_id', selectedReport.id)
        .eq('assignee_type', 'station')
        .eq('assignee_id', backupStationId)
        .neq('status', 'pending')
        .neq('status', 'accepted');

      // Check if station is busy
      const busyCheck = await checkStationIsBusy(backupStationId);
      
      const backupAssignment = {
        report_id: selectedReport.id,
        assignee_type: 'station',
        assignee_id: backupStationId,
        assigned_at: new Date().toISOString(),
        status: busyCheck.isBusy ? 'pending' : 'accepted',
        assignment_source: 'manual',
        assignment_role: 'backup',
        note: `Backup for ${alarmLevelCleaned} incident`
      };

      const { error } = await supabase
        .from('report_assignments')
        .upsert(backupAssignment, { 
          onConflict: 'report_id,assignee_type,assignee_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Backup assignment error:', error);
        Alert.alert('Error', 'Failed to assign backup station: ' + error.message);
        return;
      }

      // Get station name
      const { data: stationData } = await supabase
        .from('station_users')
        .select('station_name')
        .eq('id', backupStationId)
        .single();

      const stationName = stationData?.station_name || 'Station';

      if (busyCheck.isBusy) {
        // Show waiting modal
        setPendingBackupAssignment({
          reportId: selectedReport.id,
          stationId: backupStationId,
          stationName
        });
        setShowWaitingBackupModal(true);

        // Send notification
        const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
        const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
        
        await supabase
          .from('notifications')
          .insert({
            user_id: backupStationId,
            user_type: 'station',
            type: 'assignment',
            related_report_id: String(selectedReport.id),
            title: `🚨 Backup Assistance Request - ${alarmLevelCleaned}`,
            message: `Command Center is requesting your station as BACKUP for a ${alarmLevelCleaned} incident.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nNote: You will provide support but cannot change the fire status. Only the primary station can update the incident status.\n\nWill you accept this backup assignment?`,
            priority: 'urgent',
            is_read: false
          });
      } else {
        Alert.alert('Success', `✅ ${stationName} has been assigned as backup station.`);
      }

      // Reload assignments
      if (selectedReport?.id) {
        loadAssignmentInfo(selectedReport.id);
      }

      setBackupStationId(null);
    } catch (error) {
      console.error('Error assigning backup:', error);
      Alert.alert('Error', 'Failed to assign backup station');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get report status
  const getReportStatus = (report) => {
    // Since we're filtering out cancelled and fire out reports,
    // these shouldn't appear in the mobile admin map
    if (report.prediction === 'Fire') return 'Fire Detected';
    if (report.prediction === 'No Fire') return 'No Fire Detected';
    const alarmLevel = resolveAlarmLevel(report);
    if (alarmLevel) return alarmLevel;
    return 'Under Investigation';
  };

  // Format alarm text similar to web (approximate truck counts)
  const formatAlarm = (report) => {
    const level = resolveAlarmLevel(report);
    if (!level) return null;
    const l = (level || '').toLowerCase();
    if (l.includes('fifth')) return 'Fifth Alarm - 20 fire trucks';
    if (l.includes('fourth')) return 'Fourth Alarm - 16 fire trucks';
    if (l.includes('third')) return 'Third Alarm - 12 fire trucks';
    if (l.includes('second')) return 'Second Alarm - 8 fire trucks';
    if (l.includes('first')) return 'First Alarm - 4 fire trucks';
    if (l.includes('task force')) return level.toUpperCase();
    return level;
  };

  const formatPredictionBadge = (report) => {
    const pred = report.prediction;
    const conf = report.confidence;
    if (!pred) return null;
    if (conf) return `${pred} (${conf})`;
    return pred;
  };

  // Get cause of fire from report (check multiple possible field names)
  const getCauseOfFire = (report) => {
    return (
      report?.cause_of_fire ||
      report?.cause ||
      report?.possible_cause ||
      report?.fire_cause ||
      report?.causeOfFire ||
      report?.cause_description ||
      null
    );
  };

  const getSafeImageUri = (uri) => {
    if (!uri || typeof uri !== 'string') return null;
    const trimmed = uri.trim().replace(/\?$/, '');
    if (Platform.OS === 'ios' && trimmed.startsWith('http://')) {
      return trimmed.replace('http://', 'https://');
    }
    return trimmed;
  };

  if (errorMsg) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Location Error</Text>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents={isSidebarOpen ? 'none' : 'auto'}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Full Screen Map Container */}
      <View 
        style={styles.mapContainer}
      >
        <MapView
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          showsCompass={true}
          showsScale={true}
          loadingEnabled={true}
          loadingIndicatorColor="#dc2626"
          loadingBackgroundColor="#ffffff"
          moveOnMarkerPress={false}
          showsPointsOfInterest={false}
          showsBuildings={false}
          showsTraffic={false}
          showsIndoors={false}
          // REMOVED: Redundant event handlers that were conflicting
        >
        {/* Admin Station Marker */}
        <Marker coordinate={adminLocation} title={adminLocation.title} description={adminLocation.description}>
          <View style={styles.stationMarkerAdmin}>
            <Text style={styles.stationMarkerEmoji}>🏢</Text>
          </View>
          <Callout>
            <View style={styles.calloutContainer}>
              <Text style={styles.calloutTitle}>🏢 BFP Regional Office VII</Text>
              <Text style={styles.calloutSubtitle}>Your Admin Location</Text>
              <Text style={styles.calloutText}>Address: 6000 Natalio B. Bacalso Ave</Text>
              <Text style={styles.calloutText}>City: Cebu City, Cebu 6000</Text>
              <Text style={styles.calloutText}>Status: Active</Text>
            </View>
          </Callout>
        </Marker>

        {/* User Location Marker removed */}

        {/* Fire Report Markers */}
        {fireReports.map((report, index) => {
          const latNum = typeof report?.latitude === 'number' ? report.latitude : parseFloat(report?.latitude);
          const lngNum = typeof report?.longitude === 'number' ? report.longitude : parseFloat(report?.longitude);
          
          if (isNaN(latNum) || isNaN(lngNum)) {
            console.log(`❌ Invalid coords for report ${report.id}: lat=${report.latitude}, lng=${report.longitude}`);
            return null;
          }

          const color = getMarkerColor(report);
          
          console.log(`✅ Rendering marker for report ${report.id} at ${latNum}, ${lngNum} with color ${color}`);
          
          return (
            <Marker
              key={`fire-${report.id}-${index}`}
              coordinate={{
                latitude: latNum,
                longitude: lngNum,
              }}
              title={`Fire Report #${report.id}`}
              description={report.address || report.geotag_location || 'No address'}
              onPress={() => {
                handleMarkerPress(report);
              }}
              tracksViewChanges={Platform.OS === 'android' ? true : false}
            >
              <View style={[styles.fireMarker, { backgroundColor: color }]}>
                <Text style={styles.fireMarkerText}>🔥</Text>
              </View>
            </Marker>
          );
        })}
        {/* Station markers and jurisdiction circles from lat/lng */}
        {stations.map((s) => (
          <React.Fragment key={s.id}>
            <Marker coordinate={{ latitude: s.lat, longitude: s.lng }} title={s.station_name || 'Station'}>
              <View style={styles.stationMarker}>
                <Text style={styles.stationMarkerEmoji}>🏢</Text>
              </View>
            </Marker>
            <Circle
              center={{ latitude: s.lat, longitude: s.lng }}
              radius={jurisdictionRadius}
              strokeColor="#ef4444"
              fillColor="rgba(239,68,68,0.08)"
              strokeWidth={1}
            />
          </React.Fragment>
        ))}
        </MapView>
      </View>

      {/* Dashboard Panel */}
      {showDashboard && (
        <View style={styles.dashboardPanel}>
          <ScrollView 
            style={styles.dashboardContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Header */}
            <View style={styles.dashboardHeader}>
              <Text style={styles.dashboardTitle}>Admin Dashboard</Text>
              <TouchableOpacity 
                onPress={() => setShowDashboard(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Active Reports card */}
            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fecaca', marginRight: 8 }} />
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Active Reports</Text>
                    <Text style={{ color: '#94a3b8' }}>Real-time incidents</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#ef4444' }}>{fireReports.length}</Text>
                  <Text style={{ color: '#94a3b8' }}>incidents</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onRefresh} style={{ marginTop: 12, alignSelf: 'stretch', backgroundColor: '#ef4444', paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* Fire Alarm Levels card */}
            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Fire Alarm Levels</Text>
                  <Text style={{ color: '#94a3b8' }}>Severity indicators</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  { label: 'First Alarm', color: '#fde68a' },
                  { label: 'Second Alarm', color: '#fed7aa' },
                  { label: 'Third Alarm', color: '#fecaca' },
                  { label: 'Fourth Alarm', color: '#f87171' },
                  { label: 'Fifth Alarm', color: '#ef4444' },
                  { label: 'General Alarm', color: '#7f1d1d' },
                ].map((item) => (
                  <View key={item.label} style={{ width: '48%', backgroundColor: '#f8fafc', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 8 }} />
                    <Text style={{ color: '#0f172a', fontWeight: '600' }}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Recent Reports - Styled like web version */}
            <View style={styles.reportsContainer}>
              <Text style={styles.reportsTitle}>Active Fire Reports</Text>
              {reportsLoading ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : fireReports.length > 0 ? (
                <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                  {[...fireReports]
                    .sort((a, b) => {
                      // Sort by newest first (most recent timestamp at top)
                      const getTimestamp = (report) => {
                        if (report.updated_at) return new Date(report.updated_at).getTime();
                        if (report.created_at) return new Date(report.created_at).getTime();
                        if (report.timestamp) return new Date(report.timestamp).getTime();
                        return 0;
                      };
                      return getTimestamp(b) - getTimestamp(a);
                    })
                    .map((report, index) => {
                      const status = (report.status || '').toLowerCase();
                      const alarmLevel = report.final_fire_alarm_level || report.recommended_alarm_level || report.alarm_level || '1st Alarm';
                      const location = report.address || report.geotag_location || 'Location unavailable';
                      const timestamp = report.updated_at || report.created_at || report.timestamp;
                      
                      return (
                        <TouchableOpacity
                          key={`${report.id}-${index}`}
                          style={styles.styledReportItem}
                          onPress={() => handleMarkerPress(report)}
                        >
                          <View style={styles.styledReportContent}>
                            <View style={styles.styledReportHeader}>
                              <MaterialIcons name="location-on" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                              <Text style={styles.styledReportLocation} numberOfLines={2}>
                                {location}
                              </Text>
                            </View>
                            <View style={styles.styledReportBadges}>
                              <View style={[
                                styles.styledBadge,
                                status.includes('on going') ? styles.badgeOnGoing : styles.badgeUnderControl
                              ]}>
                                <Text style={styles.styledBadgeText}>
                                  {status.includes('on going') ? 'On Going' : status.includes('under control') ? 'Under Control' : 'Active'}
                                </Text>
                              </View>
                              <View style={[styles.styledBadge, styles.badgeAlarm]}>
                                <Text style={styles.styledBadgeText}>{alarmLevel}</Text>
                              </View>
                            </View>
                            <View style={styles.styledReportFooter}>
                              <View style={styles.styledReportDot} />
                              <Text style={styles.styledReportTime}>
                                {formatDate(timestamp)}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              ) : (
                <Text style={styles.noReportsText}>No active fire reports</Text>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowDashboard(!showDashboard)}
        >
          <MaterialIcons 
            name={showDashboard ? "dashboard" : "dashboard"} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={onRefresh}
        >
          <MaterialIcons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Report Detail Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedReport && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>🔥 Fire Report</Text>
                  <TouchableOpacity
                    onPress={() => setShowReportModal(false)}
                    style={styles.modalCloseButton}
                  >
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
                  {/* Reporter */}
                  {selectedReport.reporter ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Reporter:</Text>
                      <Text style={styles.modalValue}>{selectedReport.reporter}</Text>
                    </View>
                  ) : null}

                  {/* Cause */}
                  {getCauseOfFire(selectedReport) ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Cause:</Text>
                      <Text style={styles.modalValue}>{getCauseOfFire(selectedReport)}</Text>
                    </View>
                  ) : null}

                  {/* Alarm Level */}
                  {formatAlarm(selectedReport) ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Alarm Level:</Text>
                      <View style={styles.badge}><Text style={styles.badgeText}>{formatAlarm(selectedReport)}</Text></View>
                    </View>
                  ) : null}

                  {/* AI Fire Analysis */}
                  {selectedReport.prediction ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>AI Fire Analysis:</Text>
                      <View style={{
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 9999,
                        backgroundColor: selectedReport.prediction === 'Fire' ? '#dc2626' : '#f97316'
                      }}>
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#ffffff'
                        }}>
                          {selectedReport.prediction}{selectedReport.confidence ? ` (${selectedReport.confidence})` : ''}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Smoke Analysis */}
                  {(selectedReport.smoke_detection || selectedReport.smoke_confidence) && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Smoke Analysis:</Text>
                      <View style={{
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 9999,
                        backgroundColor: '#e0f2fe',
                        borderWidth: 1,
                        borderColor: '#bae6fd'
                      }}>
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#0f172a'
                        }}>
                          {selectedReport.smoke_detection || 'Smoke'}
                          {selectedReport.smoke_confidence ? ` (${selectedReport.smoke_confidence})` : ''}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* AI Structure Analysis */}
                  {selectedReport.structure && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>AI Structure Analysis:</Text>
                      <Text style={styles.modalValue}>
                        {selectedReport.structure}
                        {selectedReport.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Estimated Structures Affected */}
                  {selectedReport.number_of_structures_on_fire ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Estimated Structures Affected:</Text>
                      <Text style={styles.modalValue}>{selectedReport.number_of_structures_on_fire} structure(s)</Text>
                    </View>
                  ) : null}

                  {/* Location */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Location</Text>
                    <Text style={styles.modalText}>
                      {selectedReport.address || selectedReport.geotag_location || 'No address'}
                    </Text>
                    {selectedReport.latitude && selectedReport.longitude ? (
                      <>
                        <Text style={styles.modalCoordinates}>
                          Lat: {parseFloat(selectedReport.latitude).toFixed(6)}
                        </Text>
                        <Text style={styles.modalCoordinates}>
                          Lng: {parseFloat(selectedReport.longitude).toFixed(6)}
                        </Text>
                      </>
                    ) : null}
                  </View>

                  {/* Reported */}
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Reported:</Text>
                    <Text style={styles.modalValue}>{formatDate(selectedReport.created_at || selectedReport.timestamp)}</Text>
                  </View>

                  {/* Image */}
                  {selectedReport.image_url && (
                    <View style={[styles.modalSection, { marginTop: 8 }]}>
                      <Text style={styles.modalLabel}>Photo:</Text>
                      <Image
                        source={{ uri: selectedReport.image_url }}
                        defaultSource={Platform.OS === 'ios' ? require('../../../../assets/images/burnhouse.jpg') : undefined}
                        style={styles.modalImage}
                        resizeMode="cover"
                        onError={(error) => {
                          console.log('Image load error:', error);
                        }}
                        onLoad={() => {
                          console.log('Image loaded successfully:', selectedReport.image_url);
                        }}
                      />
                    </View>
                  )}

                  {/* Current Assignment Display */}
                  {currentAssignment && (
                    <View style={[styles.modalSection, { 
                      marginTop: 12, 
                      backgroundColor: currentAssignment.status === 'pending' ? '#fef3c7' : '#dbeafe',
                      borderLeftWidth: 4,
                      borderLeftColor: currentAssignment.status === 'pending' ? '#f59e0b' : '#2563eb',
                      borderRadius: 8,
                      padding: 12
                    }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 18, marginRight: 8 }}>
                          {currentAssignment.status === 'pending' ? '⏳' : '📍'}
                        </Text>
                        <Text style={{ 
                          fontSize: 14, 
                          fontWeight: '700',
                          color: currentAssignment.status === 'pending' ? '#92400e' : '#1e40af'
                        }}>
                          {currentAssignment.status === 'pending' 
                            ? 'Awaiting Station Confirmation' 
                            : 'Currently Assigned To:'}
                        </Text>
                      </View>
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: '600',
                        color: currentAssignment.status === 'pending' ? '#78350f' : '#1e3a8a',
                        marginBottom: 4
                      }}>
                        {currentAssignment.name}
                      </Text>
                      <Text style={{ 
                        fontSize: 12,
                        color: currentAssignment.status === 'pending' ? '#92400e' : '#1e40af'
                      }}>
                        {currentAssignment.status === 'pending' 
                          ? 'Waiting for station to accept or decline...' 
                          : `Assigned: ${formatDate(currentAssignment.assigned_at)}`}
                      </Text>
                      {currentAssignment.note && (
                        <Text style={{ 
                          fontSize: 12,
                          fontStyle: 'italic',
                          color: currentAssignment.status === 'pending' ? '#92400e' : '#1e40af',
                          marginTop: 4
                        }}>
                          Note: {currentAssignment.note}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* All Assigned Stations Display (Primary + Backups) */}
                  {allAssignedStations.length > 1 && (
                    <View style={[styles.modalSection, { 
                      marginTop: 12,
                      backgroundColor: '#f0fdf4',
                      borderLeftWidth: 4,
                      borderLeftColor: '#22c55e',
                      borderRadius: 8,
                      padding: 12
                    }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 18, marginRight: 8 }}>🚒</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#166534' }}>
                          All Assigned Stations:
                        </Text>
                      </View>
                      {allAssignedStations.map((station, index) => (
                        <View key={index} style={{ 
                          marginTop: index > 0 ? 8 : 0,
                          paddingTop: index > 0 ? 8 : 0,
                          borderTopWidth: index > 0 ? 1 : 0,
                          borderTopColor: '#bbf7d0'
                        }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#15803d' }}>
                              {station.name}
                            </Text>
                            <View style={{ 
                              backgroundColor: station.role === 'primary' ? '#3b82f6' : '#a855f7',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 12
                            }}>
                              <Text style={{ fontSize: 10, color: 'white', fontWeight: '700' }}>
                                {station.role === 'primary' ? '⭐ PRIMARY' : '🔧 BACKUP'}
                              </Text>
                            </View>
                          </View>
                          {station.note && (
                            <Text style={{ fontSize: 12, color: '#166534', fontStyle: 'italic', marginTop: 4 }}>
                              Note: {station.note}
                            </Text>
                          )}
                          <Text style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>
                            Assigned: {formatDate(station.assigned_at)}
                            {station.status === 'pending' && ' • ⏳ Pending approval'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Assignment controls - Only show if no station is assigned */}
                  {!currentAssignment && (
                    <View style={[styles.modalSection, { marginTop: 12 }]}> 
                    <Text style={styles.modalLabel}>Assignment</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <TouchableOpacity onPress={() => setAssigneeType('station')} style={{ padding: 8, backgroundColor: assigneeType==='station'?'#ef4444':'#e5e7eb', borderRadius: 6, marginRight: 8 }}>
                        <Text style={{ color: assigneeType==='station'?'white':'#111827' }}>Station</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setAssigneeType('responder')} style={{ padding: 8, backgroundColor: assigneeType==='responder'?'#ef4444':'#e5e7eb', borderRadius: 6 }}>
                        <Text style={{ color: assigneeType==='responder'?'white':'#111827' }}>Responder</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Assignee ID</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {(stations||[]).map(s => (
                          <TouchableOpacity key={s.id} onPress={() => { setAssigneeType('station'); setAssigneeId(s.id); }} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: assigneeId===s.id?'#ef4444':'#f3f4f6', borderRadius: 16, marginRight: 8 }}>
                            <Text style={{ color: assigneeId===s.id?'white':'#111827' }}>{s.station_name || 'Station'}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 10, marginBottom: 4 }}>Assignment Note (optional)</Text>
                      <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                        <TextInput
                          placeholder="Add a note for this assignment..."
                          value={assignmentNote}
                          onChangeText={setAssignmentNote}
                          multiline
                          numberOfLines={3}
                          style={{ paddingHorizontal: 10, paddingVertical: 8, minHeight: 60, color: '#111827' }}
                        />
                      </View>
                      <TouchableOpacity onPress={handleAssign} style={{ marginTop: 8, paddingVertical: 10, backgroundColor: '#2563eb', borderRadius: 8, alignItems: 'center' }}>
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Assign Station</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  )}

                  {/* Forward to Station - Only show if a station is already assigned */}
                  {currentAssignment && (
                    <View style={[styles.modalSection, { marginTop: 12 }]}>
                      <Text style={styles.modalLabel}>Forward to Station</Text>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                        Forward this report to another station.
                      </Text>
                      <TouchableOpacity 
                        onPress={async () => {
                          // Open forwarding modal
                          if (!selectedReport) return;
                          
                          // Close the report detail modal first
                          setShowReportModal(false);
                          
                          setIsRerouteForForwarding(true);
                          setSelectedRerouteStation('');
                          setRerouteNote('');
                          
                          // Set pendingAssignment for forwarding context
                          const pendingAssign = {
                            reportId: selectedReport.id,
                            stationId: currentAssignment.id,
                            stationName: currentAssignment.name
                          };
                          setPendingAssignment(pendingAssign);
                          
                          // QUERY ALL STATIONS DIRECTLY - NO FILTERS EXCEPT EXCLUDING CURRENT
                          try {
                            const lat = parseFloat(selectedReport.latitude);
                            const lng = parseFloat(selectedReport.longitude);
                            
                            console.log('🔍 Forwarding: Querying ALL stations (excluding current)...');
                            
                            // Query ALL stations directly - NO status filters
                            const { data: allStationsData, error: allStationsError } = await supabase
                              .from('station_users')
                              .select('id, station_name, lat, lng')
                              .neq('id', currentAssignment.id);
                            
                            console.log('🔍 Query result:', allStationsData?.length || 0, 'stations, error:', allStationsError);
                            
                            let fetchedStations = [];
                            
                            if (allStationsError) {
                              console.error('❌ Error fetching stations:', allStationsError);
                              Alert.alert('Error', `Failed to fetch stations: ${allStationsError.message}`);
                              setNearestStations([]);
                            } else if (allStationsData && allStationsData.length > 0) {
                              console.log('✅ Found', allStationsData.length, 'stations');
                              
                              // Calculate distances and sort
                              fetchedStations = allStationsData
                                .map(station => {
                                  const stationLat = parseFloat(station.lat);
                                  const stationLng = parseFloat(station.lng);
                                  let distanceToIncident = null;
                                  let distanceToIncidentKm = null;
                                  
                                  if (!isNaN(stationLat) && !isNaN(stationLng) && !isNaN(lat) && !isNaN(lng)) {
                                    distanceToIncident = calculateDistance(lat, lng, stationLat, stationLng);
                                    distanceToIncidentKm = (distanceToIncident / 1000).toFixed(2);
                                  }
                                  
                                  return {
                                    ...station,
                                    distanceToIncident: distanceToIncident,
                                    distanceToIncidentKm: distanceToIncidentKm
                                  };
                                })
                                .sort((a, b) => {
                                  if (a.distanceToIncident === null || a.distanceToIncident === Infinity) return 1;
                                  if (b.distanceToIncident === null || b.distanceToIncident === Infinity) return -1;
                                  return a.distanceToIncident - b.distanceToIncident;
                                });
                              
                              console.log('✅ Setting', fetchedStations.length, 'stations to state');
                            } else {
                              console.warn('⚠️ No stations found');
                            }
                            
                            console.log('🔍 Forwarding: Setting', fetchedStations.length, 'stations before opening modal');
                            // Set stations and open modal immediately (same as web version)
                            setNearestStations(fetchedStations);
                            setShowRerouteModal(true);
                          } catch (error) {
                            console.error('❌ Error fetching stations:', error);
                            Alert.alert('Error', `Failed to fetch stations: ${error.message}`);
                            setNearestStations([]);
                            setShowRerouteModal(true);
                          }
                        }}
                        style={{ marginTop: 8, paddingVertical: 10, backgroundColor: '#f59e0b', borderRadius: 8, alignItems: 'center' }}
                      >
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Forward Station</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Backup Station Assignment - Only show if alarm level 2+ and primary station exists */}
                  {currentAssignment && (() => {
                    const alarmLevel = resolveAlarmLevel(selectedReport);
                    const alarmLevelCleaned = alarmLevel || '';
                    const alarmLevelLower = alarmLevelCleaned.toLowerCase();
                    const isAlarmLevel2Plus = alarmLevelCleaned && (
                      alarmLevelLower.includes('second alarm') ||
                      alarmLevelLower.includes('2nd alarm') ||
                      alarmLevelLower.includes('third alarm') ||
                      alarmLevelLower.includes('3rd alarm') ||
                      alarmLevelLower.includes('fourth alarm') ||
                      alarmLevelLower.includes('4th alarm') ||
                      alarmLevelLower.includes('fifth alarm') ||
                      alarmLevelLower.includes('5th alarm') ||
                      alarmLevelLower.includes('task force alpha') ||
                      alarmLevelLower.includes('task force bravo') ||
                      alarmLevelLower.includes('task force charlie') ||
                      alarmLevelLower.includes('task force delta') ||
                      alarmLevelLower.includes('general alarm')
                    );

                    return isAlarmLevel2Plus && (
                      <View style={[styles.modalSection, { 
                        marginTop: 12,
                        backgroundColor: '#faf5ff',
                        borderLeftWidth: 4,
                        borderLeftColor: '#a855f7',
                        borderRadius: 8,
                        padding: 12
                      }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 20, marginRight: 8 }}>🚨</Text>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#7e22ce' }}>
                            {alarmLevelCleaned} - Assign Backup Station
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: '#6b21a8', marginBottom: 12 }}>
                          This incident requires backup support. Backup stations can view and support but cannot change the fire status.
                        </Text>

                        {/* Show all assigned stations */}
                        {allAssignedStations.length > 0 && (
                          <View style={{ backgroundColor: '#f3e8ff', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#7e22ce', marginBottom: 6 }}>
                              All Assigned Stations:
                            </Text>
                            {allAssignedStations.map((station, idx) => (
                              <View key={idx} style={{ 
                                flexDirection: 'row', 
                                justifyContent: 'space-between', 
                                marginTop: idx > 0 ? 8 : 0, 
                                paddingTop: idx > 0 ? 8 : 0, 
                                borderTopWidth: idx > 0 ? 1 : 0, 
                                borderTopColor: '#e9d5ff' 
                              }}>
                                <Text style={{ fontSize: 14, color: '#581c87', fontWeight: '600' }}>
                                  {station.name}
                                </Text>
                                <View style={{ 
                                  backgroundColor: station.role === 'primary' ? '#3b82f6' : '#a855f7', 
                                  paddingHorizontal: 8, 
                                  paddingVertical: 2, 
                                  borderRadius: 4 
                                }}>
                                  <Text style={{ fontSize: 10, color: 'white', fontWeight: '700' }}>
                                    {station.role === 'primary' ? 'PRIMARY' : 'BACKUP'}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        <View style={{ borderWidth: 1, borderColor: '#d8b4fe', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                          <ScrollView 
                            style={{ maxHeight: 120 }} 
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={true}
                          >
                            {(stations || [])
                              .filter(s => !allAssignedStations.some(assigned => assigned.id === s.id))
                              .map((s) => (
                              <TouchableOpacity
                                key={s.id}
                                onPress={() => setBackupStationId(s.id)}
                                style={{ 
                                  paddingVertical: 10, 
                                  paddingHorizontal: 12, 
                                  backgroundColor: backupStationId === s.id ? '#e9d5ff' : 'white', 
                                  borderBottomWidth: 1, 
                                  borderBottomColor: '#e9d5ff' 
                                }}
                              >
                                <Text style={{ color: '#581c87', fontWeight: backupStationId === s.id ? '700' : '500' }}>
                                  {s.station_name || 'Station'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>

                        <TouchableOpacity
                          onPress={handleAssignBackup}
                          disabled={!backupStationId}
                          style={{ 
                            backgroundColor: !backupStationId ? '#9ca3af' : '#a855f7', 
                            paddingVertical: 10, 
                            borderRadius: 8, 
                            alignItems: 'center' 
                          }}
                        >
                          <Text style={{ color: 'white', fontWeight: '700' }}>
                            Assign Backup Station
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })()}

                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Waiting for Station Approval Modal */}
      <Modal
        visible={showWaitingApprovalModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowWaitingApprovalModal(false);
          setPendingAssignment(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: '#dbeafe', borderRadius: 50, padding: 12 }}>
                <MaterialIcons name="schedule" size={32} color="#2563eb" />
              </View>
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Waiting for Station Approval
            </Text>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
              The assignment has been sent to <Text style={{ fontWeight: '600' }}>{pendingAssignment?.stationName}</Text>. 
              Please wait for their response.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowWaitingApprovalModal(false);
                setPendingAssignment(null);
              }}
              style={{ backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Waiting for Backup Station Approval Modal */}
      <Modal
        visible={showWaitingBackupModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowWaitingBackupModal(false);
          setPendingBackupAssignment(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ backgroundColor: '#f3e8ff', borderRadius: 50, padding: 12 }}>
                <MaterialIcons name="schedule" size={32} color="#a855f7" />
              </View>
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              Waiting for Backup Station Approval
            </Text>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
              The backup assignment has been sent to <Text style={{ fontWeight: '600' }}>{pendingBackupAssignment?.stationName}</Text>. 
              Please wait for their response.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowWaitingBackupModal(false);
                setPendingBackupAssignment(null);
              }}
              style={{ backgroundColor: '#a855f7', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Okay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Station Declined Assignment Modal */}
      <Modal
        visible={showDeclinedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDeclinedModal(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}>
            {/* Warning Icon */}
            <View style={{ 
              backgroundColor: '#fed7aa', 
              borderRadius: 50, 
              padding: 16, 
              marginBottom: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3
            }}>
              <MaterialIcons name="warning" size={48} color="#ea580c" />
            </View>

            {/* Title */}
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 12 }}>
              Station Declined Assignment
            </Text>

            {/* Message */}
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 24, marginBottom: 24 }}>
              <Text style={{ fontWeight: '600', color: '#111827' }}>{declinedStationName}</Text> has declined this assignment and is unable to handle this report. Please select a new station to reroute to.
            </Text>

            {/* OK Button */}
            <TouchableOpacity
              onPress={() => {
                setShowDeclinedModal(false);
              }}
              style={{
                backgroundColor: '#3b82f6',
                paddingVertical: 14,
                paddingHorizontal: 32,
                borderRadius: 12,
                width: '100%',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reroute/Forward Modal */}
      <Modal
        visible={showRerouteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowRerouteModal(false);
          setSelectedRerouteStation('');
          setRerouteNote('');
          setPendingAssignment(null);
          setIsRerouteForForwarding(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 16, maxHeight: height * 0.85, width: '100%', maxWidth: 500, overflow: 'hidden' }}>
            {/* Close Button - Top Right */}
            <TouchableOpacity
              onPress={() => {
                setShowRerouteModal(false);
                setSelectedRerouteStation('');
                setRerouteNote('');
                setPendingAssignment(null);
                setIsRerouteForForwarding(false);
              }}
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 }}
            >
              <MaterialIcons name="close" size={24} color="#9ca3af" />
            </TouchableOpacity>

            {/* Content */}
            <ScrollView 
              style={{ maxHeight: height * 0.85 - 100 }}
              contentContainerStyle={{ padding: 32, paddingTop: 24, paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
            >
              {/* Orange Warning Icon - Top Center */}
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View style={{ 
                  backgroundColor: '#f97316', 
                  borderRadius: 50, 
                  padding: 16, 
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5
                }}>
                  <MaterialIcons name="warning" size={40} color="#ffffff" />
                </View>
              </View>

              {/* Title */}
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 12 }}>
                {isRerouteForForwarding ? 'Forward to Station' : 'Station Declined Assignment'}
              </Text>

              {/* Description */}
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20, textAlign: 'center' }}>
                {isRerouteForForwarding ? (
                  <>Forward this report from <Text style={{ fontWeight: '600', color: '#111827' }}>{pendingAssignment?.stationName}</Text> to one of the nearest stations:</>
                ) : (
                  <><Text style={{ fontWeight: '600', color: '#111827' }}>{pendingAssignment?.stationName}</Text> has declined this assignment and is unable to handle this report. Please reroute the incident to one of the nearest stations:</>
                )}
              </Text>

              {/* Report Location */}
              {selectedReport && (
                <View style={{ backgroundColor: '#eff6ff', borderLeftWidth: 4, borderLeftColor: '#3b82f6', padding: 12, borderRadius: 8, marginBottom: 24 }}>
                  <Text style={{ fontSize: 14, color: '#1e40af' }}>
                    <Text style={{ fontWeight: '600' }}>Report Location:</Text> {selectedReport.address || selectedReport.geotag_location || 'Location unavailable'}
                  </Text>
                </View>
              )}
              
              {/* Station List */}
              <View style={{ marginBottom: 24 }}>
                {nearestStations.length > 0 ? (
                  nearestStations.map((station) => (
                    <TouchableOpacity
                      key={station.id}
                      onPress={() => setSelectedRerouteStation(station.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        padding: 16,
                        borderRadius: 12,
                        marginBottom: 12,
                        borderWidth: 2,
                        borderColor: selectedRerouteStation === station.id ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: selectedRerouteStation === station.id ? '#eff6ff' : '#f9fafb'
                      }}
                    >
                      {/* Radio Button */}
                      <View style={{ 
                        width: 20, 
                        height: 20, 
                        borderRadius: 10, 
                        borderWidth: 2, 
                        borderColor: selectedRerouteStation === station.id ? '#3b82f6' : '#9ca3af', 
                        backgroundColor: selectedRerouteStation === station.id ? '#3b82f6' : 'transparent', 
                        marginRight: 16,
                        marginTop: 2,
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        {selectedRerouteStation === station.id && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                          <Text style={{ fontWeight: '600', color: '#111827', fontSize: 16, marginRight: 8 }}>
                            {station.station_name || 'Station'}
                          </Text>
                          {stationActiveCounts[station.id] !== undefined && stationActiveCounts[station.id] > 0 && (
                            <View style={{ 
                              backgroundColor: '#fef3c7', 
                              borderWidth: 1, 
                              borderColor: '#fde68a', 
                              paddingHorizontal: 8, 
                              paddingVertical: 4, 
                              borderRadius: 12 
                            }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: '#92400e' }}>
                                Dealing with {stationActiveCounts[station.id]} Active {stationActiveCounts[station.id] === 1 ? 'Report' : 'Reports'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: '#6b7280', fontSize: 13 }}>
                          {station.distanceToIncidentKm 
                            ? `${station.distanceToIncidentKm} km from incident` 
                            : station.distanceKm 
                              ? `${station.distanceKm} km away` 
                              : 'Distance unavailable (no coordinates)'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <MaterialIcons name="location-off" size={48} color="#9ca3af" />
                    <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 12, fontSize: 14 }}>No stations available.</Text>
                  </View>
                )}
              </View>

              {/* Optional Message Field */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  Message (optional)
                </Text>
                <TextInput
                  style={{
                    width: '100%',
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    minHeight: 80,
                    textAlignVertical: 'top',
                    color: '#111827',
                    backgroundColor: '#ffffff'
                  }}
                  multiline
                  numberOfLines={3}
                  placeholder="Add a note for the receiving station (optional)"
                  value={rerouteNote}
                  onChangeText={setRerouteNote}
                />
              </View>
            </ScrollView>

            {/* Fixed Button at Bottom */}
            <View style={{ padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#ffffff' }}>
              <TouchableOpacity
                onPress={handleReroute}
                disabled={!selectedRerouteStation}
                style={{ 
                  width: '100%',
                  backgroundColor: selectedRerouteStation ? (isRerouteForForwarding ? '#f97316' : '#ea580c') : '#d1d5db', 
                  paddingVertical: 16, 
                  borderRadius: 12, 
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                  {isRerouteForForwarding ? 'Forward' : 'Reroute'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Disable drawer swipe/gestures for this screen (expo-router / React Navigation)
export const options = {
  swipeEnabled: false,
  gestureEnabled: false,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
    zIndex: 1,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dashboardPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 10,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 12,
    maxHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 8000,
  },
  dashboardContent: {
    padding: 16,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  legendContainer: {
    marginBottom: 16,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  reportsContainer: {
    marginBottom: 16,
  },
  reportsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  reportStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  reportInfo: {
    flex: 1,
  },
  reportId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  reportStatusText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reportLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reportTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  noReportsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Styled report items (like web version)
  styledReportItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  styledReportContent: {
    flex: 1,
  },
  styledReportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  styledReportLocation: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
  },
  styledReportBadges: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  styledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOnGoing: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  badgeUnderControl: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  badgeAlarm: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  styledBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  styledReportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  styledReportDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9ca3af',
    marginRight: 6,
  },
  styledReportTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    right: 20,
    alignItems: 'center',
    zIndex: 7000,
    elevation: 7,
  },
  fab: {
    backgroundColor: '#dc2626',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutContainer: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 8,
  },
  calloutText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  fireMarker: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
  },
  fireMarkerText: {
    fontSize: 38,
  },
  stationMarker: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationMarkerAdmin: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationMarkerEmoji: {
    fontSize: 20,
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: width * 0.9,
    maxHeight: height * 0.9,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalCoordinates: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  modalLabel: {
    fontSize: 14,
    color: '#6b7280',
    minWidth: 120,
    marginTop: 2,
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});