import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Dimensions, StatusBar, Platform, StyleSheet, Modal, TouchableOpacity, Image, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle, Callout } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';

export default function SMap({ reportIdToOpen, onReportOpened }) {
  const [isLoading, setIsLoading] = useState(true);
  const [stations, setStations] = useState([]);
  const [myStation, setMyStation] = useState(null);
  const [region, setRegion] = useState(null);
  const jurisdictionRadius = 2000; // 2km
  const [assignedReports, setAssignedReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [currentStationId, setCurrentStationId] = useState(null);
  const [assignmentInfo, setAssignmentInfo] = useState(null); // Store assignment info including note

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

  // Color helpers (mirror web/admin)
  const getAlarmLevelColor = (alarmLevel) => {
    if (!alarmLevel) return '#6b7280';
    const level = String(alarmLevel).toLowerCase();
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

  const getMarkerColor = (report) => {
    const resolved = resolveAlarmLevel(report);
    if (resolved) return getAlarmLevelColor(resolved);
    const pred = report?.prediction;
    if (pred === 'Fire') return '#ef4444';
    if (pred === 'No Fire') return '#93c5fd';
    return '#6b7280';
  };

  const formatAlarm = (report) => {
    const level = resolveAlarmLevel(report);
    if (!level) return null;
    const l = String(level).toLowerCase();
    if (l.includes('fifth')) return 'Fifth Alarm - 20 fire trucks';
    if (l.includes('fourth')) return 'Fourth Alarm - 16 fire trucks';
    if (l.includes('third')) return 'Third Alarm - 12 fire trucks';
    if (l.includes('second')) return 'Second Alarm - 8 fire trucks';
    if (l.includes('first')) return 'First Alarm - 4 fire trucks';
    if (l.includes('task force')) return level.toUpperCase();
    return level;
  };

  const formatPrediction = (report) => {
    const p = report?.prediction;
    const c = report?.confidence;
    if (!p) return null;
    return c ? `${p} (${c})` : p;
  };

  const toStr = (v, fallback = 'Unknown') => {
    try {
      if (v === null || v === undefined) return fallback;
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
      if (v?.toISOString) return v.toISOString();
      return JSON.stringify(v);
    } catch {
      return fallback;
    }
  };


  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        // 1) Identify current station from stored userData
        const stored = await AsyncStorage.getItem('userData');
        const parsed = stored ? JSON.parse(stored) : {};
        const myId = parsed?.uid || parsed?.id;
        setCurrentStationId(myId);

        // 2) Check if there's a selected fire report from notification
        const selectedReportStr = await AsyncStorage.getItem('selectedFireReport');
        let initialRegion = null;
        
        if (selectedReportStr) {
          try {
            const selectedReport = JSON.parse(selectedReportStr);
            console.log('📍 Found selected fire report from notification:', selectedReport);
            
            // Set region to fire location
            if (selectedReport.latitude && selectedReport.longitude) {
              initialRegion = {
                latitude: selectedReport.latitude,
                longitude: selectedReport.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              };
              setRegion(initialRegion);
            }
            
            // Clear the selected report from storage after using it
            await AsyncStorage.removeItem('selectedFireReport');
          } catch (parseError) {
            console.error('Error parsing selected fire report:', parseError);
          }
        }

        // 3) Load all stations with lat/lng
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

        // Remove duplicate stations based on lat/lng coordinates to avoid overlapping circles
        const uniqueStations = [];
        const coordsSet = new Set();
        withCoords.forEach(s => {
          const coordKey = `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;
          if (!coordsSet.has(coordKey)) {
            coordsSet.add(coordKey);
            uniqueStations.push(s);
          }
        });

        setStations(uniqueStations);
        const mine = uniqueStations.find(s => s.id === myId) || uniqueStations[0] || null;
        setMyStation(mine);
        
        // Only set region to station if we didn't already set it to fire location
        if (!initialRegion && mine) {
          setRegion({
            latitude: mine.lat,
            longitude: mine.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
        }
      } catch (e) {
        console.error('Station map load error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);


  // Load assignment info when a report is selected
  useEffect(() => {
    const loadAssignmentInfo = async () => {
      if (!selectedReport?.id || !currentStationId) {
        setAssignmentInfo(null);
        return;
      }

      try {
        const { data: assignment, error } = await supabase
          .from('report_assignments')
          .select('note, assigned_at')
          .eq('report_id', String(selectedReport.id))
          .eq('assignee_type', 'station')
          .eq('assignee_id', currentStationId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching assignment info:', error);
          setAssignmentInfo(null);
          return;
        }

        setAssignmentInfo(assignment || null);
      } catch (err) {
        console.error('Error loading assignment info:', err);
        setAssignmentInfo(null);
      }
    };

    loadAssignmentInfo();
  }, [selectedReport?.id, currentStationId]);

  // Handle opening a specific report from notification
  useEffect(() => {
    if (!reportIdToOpen) return;

    const openReport = async () => {
      try {
        console.log('📍 Opening report from notification:', reportIdToOpen);
        
        // First, check if the report is already in assignedReports
        const existingReport = assignedReports.find(r => String(r.id) === String(reportIdToOpen));
        
        if (existingReport) {
          console.log('✅ Found report in local data:', existingReport);
          
          // Center map on the fire location
          if (existingReport.latitude && existingReport.longitude) {
            setRegion({
              latitude: existingReport.latitude,
              longitude: existingReport.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
          
          // Open the modal with the report
          setSelectedReport(existingReport);
          setShowReportModal(true);
          
          // Notify parent that we've opened the report
          if (onReportOpened) {
            onReportOpened();
          }
          return;
        }
        
        // If not found locally, fetch from API
        console.log('🔍 Report not found locally, fetching from API...');
        const resp = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
        if (!resp.ok) throw new Error('Failed to fetch reports from API');
        
        const apiData = await resp.json();
        const report = apiData.find(r => String(r.id) === String(reportIdToOpen));
        
        if (!report) {
          console.error('❌ Report not found in API');
          alert('Report not found');
          if (onReportOpened) onReportOpened();
          return;
        }
        
        console.log('✅ Found report in API:', report);
        
        // Center map on the fire location
        if (report.latitude && report.longitude) {
          setRegion({
            latitude: report.latitude,
            longitude: report.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
        
        // Open the modal
        setSelectedReport(report);
        setShowReportModal(true);
        
        // Notify parent that we've opened the report
        if (onReportOpened) {
          onReportOpened();
        }
      } catch (error) {
        console.error('❌ Error opening report:', error);
        alert(`Error opening report: ${error.message}`);
        if (onReportOpened) {
          onReportOpened();
        }
      }
    };

    openReport();
  }, [reportIdToOpen, assignedReports, onReportOpened]);

  // Load assigned reports for this station
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('userData');
        const parsed = stored ? JSON.parse(stored) : {};
        const myId = parsed?.uid || parsed?.id;
        if (!myId) return;

        // 1) Fetch directly assigned reports
        const { data: assignments, error } = await supabase
          .from('report_assignments')
          .select('report_id')
          .eq('assignee_type', 'station')
          .eq('assignee_id', myId);
        if (error) throw error;

        // 2) Fetch forwarded reports with notes
        const { data: forwarded, error: forwardError } = await supabase
          .from('report_routes')
          .select('report_id, note, forwarded_at')
          .eq('target', `station:${myId}`);
        if (forwardError) {
          console.error('Error fetching forwarded reports:', forwardError);
        }

        // 3) Get original assignee info for forwarded reports
        const forwardedReportIds = (forwarded || []).map(f => String(f.report_id));
        let originalAssignees = new Map();
        
        if (forwardedReportIds.length > 0) {
          const { data: assignmentData } = await supabase
            .from('report_assignments')
            .select('report_id, assignee_type, assignee_id')
            .in('report_id', forwardedReportIds);
          
          if (assignmentData) {
            const stationAssignees = assignmentData.filter(a => a.assignee_type === 'station');
            if (stationAssignees.length > 0) {
              const stationIds = stationAssignees.map(a => a.assignee_id);
              const { data: stationNames } = await supabase
                .from('station_users')
                .select('id, station_name')
                .in('id', stationIds);
              
              if (stationNames) {
                const stationNameMap = new Map(stationNames.map(s => [s.id, s.station_name]));
                assignmentData.forEach(a => {
                  if (a.assignee_type === 'station') {
                    originalAssignees.set(String(a.report_id), {
                      type: 'station',
                      name: stationNameMap.get(a.assignee_id) || 'Unknown Station'
                    });
                  } else {
                    originalAssignees.set(String(a.report_id), {
                      type: 'responder',
                      name: 'Responder'
                    });
                  }
                });
              }
            }
          }
        }

        // Create map of forwarded metadata
        const forwardedMetadata = new Map();
        (forwarded || []).forEach(f => {
          const originalAssignee = originalAssignees.get(String(f.report_id));
          forwardedMetadata.set(String(f.report_id), {
            note: f.note,
            forwarded_at: f.forwarded_at,
            original_assignee: originalAssignee
          });
        });

        // Combine both assigned and forwarded
        const assignedIds = new Set((assignments || []).map(a => String(a.report_id)));
        const forwardedIds = new Set((forwarded || []).map(f => String(f.report_id)));
        const ids = Array.from(new Set([...assignedIds, ...forwardedIds]));

        console.log(`📋 Station has ${assignedIds.size} assigned and ${forwardedIds.size} forwarded reports`);

        if (!ids.length) { setAssignedReports([]); return; }

        // Load from external API
        const resp = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
        const apiData = resp.ok ? await resp.json() : [];
        const apiById = new Map((apiData || []).map(r => [String(r.id), r]));

        // Load fallbacks/snapshots from Supabase
        const { data: snapshots, error: snapErr } = await supabase
          .from('assigned_report_snapshots')
          .select('report_id, lat, lng, address, snapshot_json')
          .in('report_id', ids);
        if (snapErr) throw snapErr;

        const merged = ids.map(id => {
          const api = apiById.get(id);
          const forwardingInfo = forwardedMetadata.get(id);
          
          let report;
          if (api && api.latitude && api.longitude) {
            report = api;
          } else {
            const snap = (snapshots || []).find(s => String(s.report_id) === id);
            if (!snap) return null;
            const payload = typeof snap.snapshot_json === 'string' ? (() => { try { return JSON.parse(snap.snapshot_json); } catch { return {}; } })() : (snap.snapshot_json || {});
            report = {
              id,
              latitude: typeof snap.lat === 'number' ? snap.lat : parseFloat(snap.lat),
              longitude: typeof snap.lng === 'number' ? snap.lng : parseFloat(snap.lng),
              address: snap.address || payload.address,
              ...payload,
            };
          }
          
          // Attach forwarding metadata if exists
          if (forwardingInfo) {
            return {
              ...report,
              is_forwarded: true,
              forwarding_note: forwardingInfo.note,
              forwarded_at: forwardingInfo.forwarded_at,
              original_assignee: forwardingInfo.original_assignee
            };
          }
          
          return {
            ...report,
            is_forwarded: false
          };
        }).filter(Boolean).filter(r => {
          // Filter out reports with invalid coordinates, cancelled reports, or fire out reports
          const hasValidCoords = !isNaN(parseFloat(r.latitude)) && !isNaN(parseFloat(r.longitude));
          const statusText = (r.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          return hasValidCoords && !isCancelled && !isFireOut;
        });

        setAssignedReports(merged);
      } catch (e) {
        console.error('Load assigned reports (mobile station) error:', e);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ff512f" />
        <Text style={{ marginTop: 10, color: 'gray' }}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
        region={region || {
          latitude: 14.5995,
          longitude: 120.9842,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        mapType="standard"
        showsPointsOfInterest
        showsBuildings
        showsIndoors
        >
        {/* Logged-in station marker */}
        {myStation && (
          <>
            <Marker
              coordinate={{ latitude: myStation.lat, longitude: myStation.lng }}
              title={myStation.station_name || 'My Station'}
            >
              <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 18 }}>🏢</Text>
              </View>
            </Marker>
            <Circle
              center={{ latitude: myStation.lat, longitude: myStation.lng }}
              radius={jurisdictionRadius}
              strokeColor="#ef4444"
              fillColor="rgba(239,68,68,0.08)"
              strokeWidth={1}
            />
          </>
        )}

        {/* Command Center - BFP Regional Office VII */}
        <Marker 
          coordinate={{ latitude: 10.3157, longitude: 123.8854 }} 
          title="BFP Regional Office VII"
          description="Command Center"
        >
          <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#1e3a8a', borderWidth: 2, borderColor: '#ffffff', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 20 }}>🏢</Text>
          </View>
          <Callout>
            <View style={{ padding: 10, minWidth: 200 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 4 }}>🏢 BFP Regional Office VII</Text>
              <Text style={{ fontSize: 14, color: '#2563eb', fontWeight: '600', marginBottom: 8 }}>Command Center</Text>
              <Text style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>Address: 6000 Natalio B. Bacalso Ave</Text>
              <Text style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>City: Cebu City, Cebu 6000</Text>
              <Text style={{ fontSize: 12, color: '#374151' }}>Status: <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>Active</Text></Text>
            </View>
          </Callout>
        </Marker>

        {/* Other stations - explicitly filter out myStation to avoid duplicate circles */}
        {stations
          .filter(s => {
            // Don't render if this is the logged-in station
            if (myStation && s.id === myStation.id) return false;
            // Don't render if coordinates match myStation (extra safety check)
            if (myStation && Math.abs(s.lat - myStation.lat) < 0.0001 && Math.abs(s.lng - myStation.lng) < 0.0001) return false;
            return true;
          })
          .map(s => (
            <React.Fragment key={s.id}>
              <Marker coordinate={{ latitude: s.lat, longitude: s.lng }} title={s.station_name || 'Station'}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#3b82f6', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 16 }}>🏢</Text>
                </View>
              </Marker>
              <Circle
                center={{ latitude: s.lat, longitude: s.lng }}
                radius={jurisdictionRadius}
                strokeColor="#3b82f6"
                fillColor="rgba(59,130,246,0.08)"
                strokeWidth={1}
              />
            </React.Fragment>
          ))}

        {/* Assigned fire reports markers */}
        {assignedReports.map(r => {
          const latNum = typeof r?.latitude === 'number' ? r.latitude : parseFloat(r?.latitude);
          const lngNum = typeof r?.longitude === 'number' ? r.longitude : parseFloat(r?.longitude);
          if (isNaN(latNum) || isNaN(lngNum)) return null;

          const color = getMarkerColor(r);
          const alarmText = toStr(formatAlarm(r));
          const aiText = toStr(formatPrediction(r));
          const smokeText = r?.smoke_intensity ? toStr(`${r.smoke_intensity}${r.smoke_confidence ? ` ${r.smoke_confidence}` : ''}`) : null;
          const structuresText = r?.number_of_structures_on_fire != null ? toStr(r.number_of_structures_on_fire) : null;
          const locText = toStr(r?.address || r?.geotag_location || 'Not specified', 'Not specified');
          const repText = toStr(r?.formatted_timestamp || r?.timestamp);

          return (
            <Marker
              key={`assigned-${r.id}`}
              coordinate={{ latitude: latNum, longitude: lngNum }}
              title={'Assigned'}
              onPress={() => { setSelectedReport(r); setShowReportModal(true); }}
            >
              <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: color, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 10 }}>
                <Text style={{ color: '#fff', fontSize: 38 }}>🔥</Text>
              </View>
            </Marker>
          );
        })}
        </MapView>


      {/* Modal detail - Styled like Citizen Map */}
      <Modal
        visible={!!showReportModal && !!selectedReport}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 24, width: '92%', maxHeight: '85%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 }}>
            {selectedReport && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Enhanced Header with Gradient */}
                <LinearGradient
                  colors={['#ff6b35', '#ff512f', '#dc2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingTop: 16,
                    paddingBottom: 16,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialIcons name="description" size={24} color="#ffffff" />
                    <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginLeft: 8, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>Report Details</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowReportModal(false)}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 20,
                      padding: 8,
                    }}
                  >
                    <MaterialIcons name="close" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </LinearGradient>

                <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 }}>
                  {/* Auto-Assignment Badge */}
                  {assignmentInfo?.note && assignmentInfo.note.includes('Auto-assigned') && (
                    <View style={{ backgroundColor: '#dbeafe', borderWidth: 2, borderColor: '#3b82f6', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <MaterialIcons name="auto-awesome" size={18} color="#3b82f6" />
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e40af', marginLeft: 6 }}>Auto-Assigned to Your Station</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#1e3a8a', marginTop: 4 }}>
                        {assignmentInfo.note}
                      </Text>
                      {assignmentInfo.assigned_at && (
                        <Text style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                          Assigned: {new Date(assignmentInfo.assigned_at).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Forwarding Information */}
                  {selectedReport?.is_forwarded && (
                    <View style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fbbf24', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <MaterialIcons name="forward" size={18} color="#92400e" />
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#92400e', marginLeft: 6 }}>Forwarded Report</Text>
                      </View>
                      {selectedReport?.original_assignee && (
                        <Text style={{ fontSize: 12, color: '#78350f', marginBottom: 2 }}>
                          <Text style={{ fontWeight: 'bold' }}>Originally assigned to:</Text> {selectedReport.original_assignee.name}
                        </Text>
                      )}
                      {selectedReport?.forwarding_note && (
                        <Text style={{ fontSize: 12, color: '#78350f', marginBottom: 2 }}>
                          <Text style={{ fontWeight: 'bold' }}>Note:</Text> {selectedReport.forwarding_note}
                        </Text>
                      )}
                      {selectedReport?.forwarded_at && (
                        <Text style={{ fontSize: 11, color: '#a16207', marginTop: 2 }}>
                          Forwarded: {new Date(selectedReport.forwarded_at).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Fire Image */}
                  <View style={{ marginBottom: 20 }}>
                    {(() => {
                      const r = selectedReport || {};
                      const payload = r || {};
                      const candidate = payload.image_url || payload.image || payload.photo_url || payload.media_url || (Array.isArray(payload.images) && payload.images[0]) || null;
                      if (!candidate || typeof candidate !== 'string') return null;
                      return (
                        <Image 
                          source={{ uri: candidate }} 
                          resizeMode="cover" 
                          style={{ 
                            width: '100%', 
                            height: 224, 
                            borderRadius: 16, 
                            backgroundColor: '#e5e7eb',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 8,
                            elevation: 8,
                          }} 
                        />
                      );
                    })()}
                  </View>

                  {/* Status Badge */}
                  {(() => {
                    const progress = selectedReport.status || selectedReport.progress ||
                      (selectedReport.prediction === 'Fire' ? 'On Going' : 'Under Control') ||
                      'Unknown';
                    const getProgressColor = (p) => {
                      switch (p) {
                        case 'On Going': return '#ef4444';
                        case 'Under Control': return '#f59e0b';
                        case 'Fire Out': return '#10b981';
                        default: return '#6b7280';
                      }
                    };
                    const color = getProgressColor(progress);
                    return (
                      <View style={{ marginBottom: 20, alignItems: 'center' }}>
                        <View
                          style={{ 
                            paddingHorizontal: 20,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: color + '20',
                            borderWidth: 2,
                            borderColor: color,
                          }}
                        >
                          <Text
                            style={{ 
                              fontSize: 16, 
                              fontWeight: 'bold',
                              color: color
                            }}
                          >
                            {progress}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Map Preview */}
                  {selectedReport.latitude && selectedReport.longitude && (
                    <View style={{ marginBottom: 20, borderRadius: 16, overflow: 'hidden', height: 180 }}>
                      <MapView
                        style={{ flex: 1 }}
                        provider={PROVIDER_GOOGLE}
                        initialRegion={{
                          latitude: parseFloat(selectedReport.latitude),
                          longitude: parseFloat(selectedReport.longitude),
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        pitchEnabled={false}
                        rotateEnabled={false}
                      >
                        <Marker
                          coordinate={{
                            latitude: parseFloat(selectedReport.latitude),
                            longitude: parseFloat(selectedReport.longitude),
                          }}
                        />
                      </MapView>
                    </View>
                  )}

                  {/* Basic Information Section */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Basic Information</Text>
                    <View style={{ backgroundColor: '#f9fafb', borderRadius: 16, padding: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                        <MaterialIcons name="person" size={18} color="#6b7280" />
                         <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Reporter</Text>
                          <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 16 }}>
                            {toStr(selectedReport?.reporter_name || selectedReport?.reporter || selectedReport?.reported_by, 'Unknown Reporter')}
                          </Text>
                        </View>
                      </View>
                      <View style={{ height: 1, backgroundColor: '#e5e7eb', marginBottom: 12 }} />
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                        <MaterialIcons name="place" size={18} color="#6b7280" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Location</Text>
                          <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 16 }}>
                            {toStr(selectedReport?.address || selectedReport?.geotag_location || selectedReport?.location || 'Not specified')}
                          </Text>
                        </View>
                      </View>
                      <View style={{ height: 1, backgroundColor: '#e5e7eb', marginBottom: 12 }} />
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <MaterialIcons name="schedule" size={18} color="#6b7280" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Reported</Text>
                          <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 16 }}>
                            {toStr(selectedReport?.formatted_timestamp || selectedReport?.timestamp, 'Unknown time')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Fire Details Section */}
                  {(selectedReport.cause || selectedReport.cause_of_fire || selectedReport.number_of_structures_on_fire) && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Fire Details</Text>
                      <View style={{ borderRadius: 16, padding: 16, backgroundColor: 'rgba(255, 81, 47, 0.05)' }}>
                        {selectedReport.cause || selectedReport.cause_of_fire ? (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                              <MaterialIcons name="warning" size={18} color="#ff512f" />
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Cause of Fire</Text>
                                <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 16 }}>
                                  {toStr(selectedReport?.cause_of_fire || selectedReport?.cause || selectedReport?.possible_cause || selectedReport?.fire_cause, 'No cause specified')}
                                </Text>
                              </View>
                            </View>
                            {selectedReport.number_of_structures_on_fire && <View style={{ height: 1, marginBottom: 12, backgroundColor: 'rgba(255, 81, 47, 0.2)' }} />}
                          </>
                        ) : null}
                        {selectedReport.number_of_structures_on_fire != null && (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <MaterialIcons name="business" size={18} color="#ff512f" />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Structures Affected</Text>
                              <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 16 }}>
                                {toStr(selectedReport.number_of_structures_on_fire)} structure(s)
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* AI Analysis Section */}
                  {(selectedReport.prediction || selectedReport.structure || selectedReport.smoke_intensity || formatAlarm(selectedReport)) && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>AI Analysis</Text>
                      <View style={{ borderRadius: 16, padding: 16, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                        {selectedReport.prediction && (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                              <MaterialIcons name="psychology" size={18} color="#3b82f6" />
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>AI Confidence</Text>
                                <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 16 }}>
                                  {toStr(formatPrediction(selectedReport), 'Not analyzed')}
                                </Text>
                              </View>
                            </View>
                            {(selectedReport.structure || selectedReport.smoke_intensity || formatAlarm(selectedReport)) && <View style={{ height: 1, marginBottom: 12, backgroundColor: 'rgba(59, 130, 246, 0.2)' }} />}
                          </>
                        )}
                        {selectedReport.structure && (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                              <MaterialIcons name="domain" size={18} color="#3b82f6" />
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Structure Type</Text>
                                <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 16 }}>
                                  {toStr(selectedReport?.structure || selectedReport?.building_type)}{selectedReport?.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}
                                </Text>
                              </View>
                            </View>
                            {(selectedReport.smoke_intensity || formatAlarm(selectedReport)) && <View style={{ height: 1, marginBottom: 12, backgroundColor: 'rgba(59, 130, 246, 0.2)' }} />}
                          </>
                        )}
                        {selectedReport.smoke_intensity && (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                              <MaterialIcons name="cloud" size={18} color="#3b82f6" />
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Smoke Intensity</Text>
                                <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 16 }}>
                                  {toStr(`${selectedReport.smoke_intensity}${selectedReport.smoke_confidence ? ` ${selectedReport.smoke_confidence}` : ''}`)}
                                </Text>
                              </View>
                            </View>
                            {formatAlarm(selectedReport) && <View style={{ height: 1, marginBottom: 12, backgroundColor: 'rgba(59, 130, 246, 0.2)' }} />}
                          </>
                        )}
                        {formatAlarm(selectedReport) && (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <MaterialIcons name="notifications-active" size={18} color="#3b82f6" />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Alarm Level</Text>
                              <Text style={{ color: '#1f2937', fontWeight: '600', fontSize: 16 }}>
                                {toStr(formatAlarm(selectedReport))}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      </View>
    </View>
  );
} 

const { width, height } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});