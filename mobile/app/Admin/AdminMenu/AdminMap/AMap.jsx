import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
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
  Image,
  TextInput
} from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';

const { width, height } = Dimensions.get('window');

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
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [forwardedTo, setForwardedTo] = useState([]);

  // Dashboard states
  const [showDashboard, setShowDashboard] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      const response = await fetch('https://fire-detection-api-production-f8a3.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Fetched fire reports for mobile admin dashboard:', data.length);
        
        // Filter reports that have valid coordinates AND are not cancelled or fire out
        const reportsWithCoords = data.filter(report => {
          const hasCoords = report.latitude && report.longitude && !isNaN(parseFloat(report.latitude)) && !isNaN(parseFloat(report.longitude));
          const statusText = (report.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          return hasCoords && !isCancelled && !isFireOut;
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

  // Get alarm level color
  const getAlarmLevelColor = (alarmLevel) => {
    if (!alarmLevel) return '#6b7280';
    
    const level = alarmLevel.toLowerCase();
    
    if (level.includes('first alarm')) return '#fef3c7';
    if (level.includes('second alarm')) return '#fed7aa';
    if (level.includes('third alarm')) return '#fecaca';
    if (level.includes('fourth alarm')) return '#f87171';
    if (level.includes('fifth alarm')) return '#ef4444';
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
    if (report.recommended_alarm_level || report.alarm_level) {
      return getAlarmLevelColor(report.recommended_alarm_level || report.alarm_level);
    }
    
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

  // Fetch current assignment and forwarding info for a report
  const loadAssignmentInfo = useCallback(async (reportId) => {
    if (!reportId) return;

    try {
      // 1. Fetch current assignment
      const { data: assignment, error: assignError } = await supabase
        .from('report_assignments')
        .select('assignee_type, assignee_id, assigned_at, note')
        .eq('report_id', reportId)
        .single();

      if (assignError && assignError.code !== 'PGRST116') {
        console.error('Error fetching assignment:', assignError);
      }

      // If we have an assignment and it's a station, get the station name
      if (assignment && assignment.assignee_type === 'station') {
        const { data: stationData } = await supabase
          .from('station_users')
          .select('station_name')
          .eq('id', assignment.assignee_id)
          .single();

        setCurrentAssignment({
          type: assignment.assignee_type,
          id: assignment.assignee_id,
          name: stationData?.station_name || 'Unknown Station',
          assigned_at: assignment.assigned_at,
          note: assignment.note || ''
        });
      } else if (assignment && assignment.assignee_type === 'responder') {
        setCurrentAssignment({
          type: assignment.assignee_type,
          id: assignment.assignee_id,
          name: 'Responder',
          assigned_at: assignment.assigned_at,
          note: assignment.note || ''
        });
      } else {
        setCurrentAssignment(null);
      }

      // 2. Fetch forwarding history
      const { data: forwards, error: forwardError } = await supabase
        .from('report_routes')
        .select('target, note, forwarded_at')
        .eq('report_id', reportId)
        .order('forwarded_at', { ascending: false });

      if (forwardError) {
        console.error('Error fetching forwards:', forwardError);
      }

      // Parse the forwarded stations
      if (forwards && forwards.length > 0) {
        const forwardedStations = await Promise.all(
          forwards.map(async (forward) => {
            // Parse target format: 'station:<id>' or 'agency:police'
            const [targetType, targetId] = forward.target.split(':');
            
            if (targetType === 'station') {
              const { data: stationData } = await supabase
                .from('station_users')
                .select('station_name')
                .eq('id', targetId)
                .single();

              return {
                type: 'station',
                name: stationData?.station_name || 'Unknown Station',
                note: forward.note,
                forwarded_at: forward.forwarded_at
              };
            } else {
              return {
                type: 'agency',
                name: targetId,
                note: forward.note,
                forwarded_at: forward.forwarded_at
              };
            }
          })
        );

        setForwardedTo(forwardedStations);
      } else {
        setForwardedTo([]);
      }
    } catch (err) {
      console.error('Error loading assignment info:', err);
    }
  }, []);

  // Load assignment info when a report is selected
  useEffect(() => {
    if (selectedReport) {
      loadAssignmentInfo(selectedReport.id);
    } else {
      setCurrentAssignment(null);
      setForwardedTo([]);
    }
  }, [selectedReport, loadAssignmentInfo]);

  const handleAssign = async () => {
    try {
      if (!selectedReport) {
        Alert.alert('Error', 'Select a fire report first.');
        return;
      }
      if (!assigneeId) {
        Alert.alert('Error', 'Choose an assignee.');
        return;
      }
      const payload = {
        report_id: String(selectedReport.id),
        assignee_type: assigneeType,
        assignee_id: assigneeId,
        assigned_at: new Date().toISOString()
      };
      console.log('[Assign-Mobile] assignmentNote=', assignmentNote);
      const { error } = await supabase
        .from('report_assignments')
        .upsert({ ...payload, note: assignmentNote && assignmentNote.trim() ? assignmentNote.trim() : null }, { onConflict: 'report_id' });
      if (error) throw error;

      // Snapshot report coordinates so station dashboards can render reliably
      try {
        const lat = parseFloat(selectedReport.latitude);
        const lng = parseFloat(selectedReport.longitude);
        await supabase
          .from('assigned_report_snapshots')
          .upsert({
            report_id: String(selectedReport.id),
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng,
            address: selectedReport.address || selectedReport.geotag_location || null,
            snapshot_json: selectedReport
          }, { onConflict: 'report_id' });
      } catch (snapErr) {
        console.warn('Snapshot upsert failed (table may not exist):', snapErr?.message || snapErr);
      }

      setAssignmentNote('');
      Alert.alert('Success', 'Report assigned successfully.');
      // Reload the assignment info
      loadAssignmentInfo(selectedReport.id);
    } catch (e) {
      console.error('Assign failed (mobile):', e);
      Alert.alert('Error', 'Failed to assign report.');
    }
  };

  const handleRedirect = async () => {
    try {
      if (!selectedReport) {
        Alert.alert('Error', 'Select a fire report first.');
        return;
      }
      if (!redirectTarget) {
        Alert.alert('Error', 'Choose a redirect target.');
        return;
      }
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
      Alert.alert('Success', 'Report forwarded successfully.');
      setRedirectNote('');
      // Reload the forwarding info
      loadAssignmentInfo(selectedReport.id);
    } catch (e) {
      console.error('Redirect failed (mobile):', e);
      Alert.alert('Error', 'Failed to forward report.');
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
    if (report.recommended_alarm_level || report.alarm_level) {
      return report.recommended_alarm_level || report.alarm_level;
    }
    return 'Under Investigation';
  };

  // Format alarm text similar to web (approximate truck counts)
  const formatAlarm = (report) => {
    const level = report.recommended_alarm_level || report.alarm_level || report.final_fire_alarm_level;
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
        {fireReports.map((report, index) => (
          <Marker
            key={`${report.id}-${index}`}
            coordinate={{
              latitude: parseFloat(report.latitude),
              longitude: parseFloat(report.longitude),
            }}
            title={`Fire Report #${report.id}`}
            description={report.address || report.geotag_location || 'No address'}
            onPress={(e) => {
              e.stopPropagation();
              handleMarkerPress(report);
            }}
            tracksViewChanges={false}
          >
            <TouchableOpacity
              style={[styles.fireMarker, { backgroundColor: getMarkerColor(report) }]}
              onPress={(e) => {
                e.stopPropagation();
                handleMarkerPress(report);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.fireMarkerText}>🔥</Text>
            </TouchableOpacity>
          </Marker>
        ))}
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
                  { label: 'Fire Out', color: '#60a5fa' },
                  { label: 'First Alarm', color: '#fde68a' },
                  { label: 'Second Alarm', color: '#fed7aa' },
                  { label: 'Third Alarm', color: '#fecaca' },
                  { label: 'Fifth+ Alarm', color: '#ef4444' },
                  { label: 'General Alarm', color: '#7f1d1d' },
                ].map((item) => (
                  <View key={item.label} style={{ width: '48%', backgroundColor: '#f8fafc', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 8 }} />
                    <Text style={{ color: '#0f172a', fontWeight: '600' }}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Recent Reports */}
            <View style={styles.reportsContainer}>
              <Text style={styles.reportsTitle}>Active Fire Reports</Text>
              {reportsLoading ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : fireReports.length > 0 ? (
                fireReports.slice(0, 5).map((report, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.reportItem}
                    onPress={() => handleMarkerPress(report)}
                  >
                    <View style={[styles.reportStatus, { backgroundColor: getMarkerColor(report) }]} />
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportId}>Report #{report.id}</Text>
                      <Text style={styles.reportStatusText}>{getReportStatus(report)}</Text>
                      <Text style={styles.reportLocation}>
                        {report.address || report.geotag_location || 'No address'}
                      </Text>
                      <Text style={styles.reportTime}>
                        {formatDate(report.created_at || report.timestamp)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
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
                  {selectedReport.cause_of_fire ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Cause:</Text>
                      <Text style={styles.modalValue}>{selectedReport.cause_of_fire}</Text>
                    </View>
                  ) : null}

                  {/* Alarm Level */}
                  {formatAlarm(selectedReport) ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Alarm Level:</Text>
                      <View style={styles.badge}><Text style={styles.badgeText}>{formatAlarm(selectedReport)}</Text></View>
                    </View>
                  ) : null}

                  {/* AI Fire Detection */}
                  {selectedReport.prediction ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>AI Fire Detection:</Text>
                      <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
                        <Text style={[styles.badgeText, { color: '#991b1b' }]}>{formatPredictionBadge(selectedReport)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Smoke Analysis */}
                  {selectedReport.smoke_intensity ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Smoke Analysis:</Text>
                      <Text style={styles.modalValue}>{selectedReport.smoke_intensity}{selectedReport.smoke_confidence ? ` ${selectedReport.smoke_confidence}` : ''}</Text>
                    </View>
                  ) : null}

                  {/* Structure Analysis */}
                  {selectedReport.structure ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Structure Analysis:</Text>
                      <Text style={styles.modalValue}>
                        {selectedReport.structure}
                        {selectedReport.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}
                      </Text>
                    </View>
                  ) : null}

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
                    <View style={[styles.modalSection, { marginTop: 12 }]}>
                      <View style={{ backgroundColor: '#dbeafe', borderLeftWidth: 4, borderLeftColor: '#3b82f6', padding: 12, borderRadius: 8 }}>
                        <Text style={{ fontWeight: 'bold', color: '#1e3a8a', marginBottom: 4 }}>📍 Currently Assigned To:</Text>
                        <Text style={{ color: '#1e40af', fontSize: 14, fontWeight: '600' }}>{currentAssignment.name}</Text>
                        <Text style={{ color: '#2563eb', fontSize: 12, marginTop: 4 }}>
                          Assigned: {formatDate(currentAssignment.assigned_at)}
                        </Text>
                        {currentAssignment.note && (
                          <Text style={{ color: '#1d4ed8', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                            Note: {currentAssignment.note}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Forwarded To Display */}
                  {forwardedTo.length > 0 && (
                    <View style={[styles.modalSection, { marginTop: 12 }]}>
                      <View style={{ backgroundColor: '#fef3c7', borderLeftWidth: 4, borderLeftColor: '#f59e0b', padding: 12, borderRadius: 8 }}>
                        <Text style={{ fontWeight: 'bold', color: '#78350f', marginBottom: 8 }}>📨 Forwarded To:</Text>
                        {forwardedTo.map((forward, index) => (
                          <View key={index} style={index > 0 ? { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#fde68a' } : null}>
                            <Text style={{ color: '#92400e', fontSize: 14, fontWeight: '600' }}>{forward.name}</Text>
                            {forward.note && (
                              <Text style={{ color: '#b45309', fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                                Note: {forward.note}
                              </Text>
                            )}
                            <Text style={{ color: '#d97706', fontSize: 12, marginTop: 4 }}>
                              Forwarded: {formatDate(forward.forwarded_at)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Assignment controls */}
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
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Assign</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>You can reassign anytime — the latest assignment is active.</Text>
                    </View>
                  </View>

                  {/* Redirect controls */}
                  <View style={[styles.modalSection, { marginTop: 12 }]}> 
                    <Text style={styles.modalLabel}>Redirect / Forward</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 6 }}>Select target station or agency</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {(stations||[]).map(s => (
                        <TouchableOpacity key={`rt-${s.id}`} onPress={() => setRedirectTarget(`station:${s.id}`)} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: redirectTarget===`station:${s.id}`?'#f59e0b':'#f3f4f6', borderRadius: 16, marginRight: 8 }}>
                          <Text style={{ color: redirectTarget===`station:${s.id}`?'white':'#111827' }}>{s.station_name || 'Station'}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity onPress={() => setRedirectTarget('agency:police')} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: redirectTarget==='agency:police'?'#f59e0b':'#f3f4f6', borderRadius: 16, marginRight: 8 }}>
                        <Text style={{ color: redirectTarget==='agency:police'?'white':'#111827' }}>Police</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setRedirectTarget('agency:utilities')} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: redirectTarget==='agency:utilities'?'#f59e0b':'#f3f4f6', borderRadius: 16, marginRight: 8 }}>
                        <Text style={{ color: redirectTarget==='agency:utilities'?'white':'#111827' }}>Utilities</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setRedirectTarget('agency:barangay')} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: redirectTarget==='agency:barangay'?'#f59e0b':'#f3f4f6', borderRadius: 16, marginRight: 8 }}>
                        <Text style={{ color: redirectTarget==='agency:barangay'?'white':'#111827' }}>Barangay</Text>
                      </TouchableOpacity>
                    </ScrollView>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 10, marginBottom: 4 }}>Forward Note (optional)</Text>
                    <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8 }}>
                      <TextInput
                        placeholder="Add a note for this forwarding..."
                        value={redirectNote}
                        onChangeText={setRedirectNote}
                        multiline
                        numberOfLines={3}
                        style={{ paddingHorizontal: 10, paddingVertical: 8, minHeight: 60, color: '#111827' }}
                      />
                    </View>
                    <TouchableOpacity onPress={handleRedirect} style={{ marginTop: 8, paddingVertical: 10, backgroundColor: '#f59e0b', borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: 'white', fontWeight: 'bold' }}>Forward</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Forwarding keeps the original assignment and records provenance.</Text>
                  </View>
                </ScrollView>
              </>
            )}
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
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 14,
    color: '#1f2937',
  },
  badge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
});