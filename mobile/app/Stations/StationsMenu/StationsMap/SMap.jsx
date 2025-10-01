import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Dimensions, StatusBar, Platform, StyleSheet, Modal, TouchableOpacity, Image, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle, Callout } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';

export default function SMap() {
  const [isLoading, setIsLoading] = useState(true);
  const [stations, setStations] = useState([]);
  const [myStation, setMyStation] = useState(null);
  const [region, setRegion] = useState(null);
  const jurisdictionRadius = 2000; // 2km
  const [assignedReports, setAssignedReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [responders, setResponders] = useState([]);
  const [isNotifying, setIsNotifying] = useState(false);
  const [currentStationId, setCurrentStationId] = useState(null);

  // Color helpers (mirror web/admin)
  const getAlarmLevelColor = (alarmLevel) => {
    if (!alarmLevel) return '#6b7280';
    const level = String(alarmLevel).toLowerCase();
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

  const getMarkerColor = (report) => {
    const alarm = report?.recommended_alarm_level || report?.alarm_level || report?.final_fire_alarm_level;
    if (alarm) return getAlarmLevelColor(alarm);
    const pred = report?.prediction;
    if (pred === 'Fire') return '#ef4444';
    if (pred === 'No Fire') return '#93c5fd';
    return '#6b7280';
  };

  const formatAlarm = (report) => {
    const level = report?.recommended_alarm_level || report?.alarm_level || report?.final_fire_alarm_level;
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

  // Handle notifying responders about fire report
  const handleNotifyResponders = async (fireReport) => {
    console.log('🚨 Notify Responders clicked:', { fireReport, responders: responders.length, currentStationId });
    
    if (!fireReport || !responders.length) {
      alert('No responders available to notify.');
      return;
    }

    if (!currentStationId) {
      alert('Station information not available. Please try again.');
      return;
    }

    if (isNotifying) return;

    setIsNotifying(true);
    
    try {
      // Create comprehensive notification message with fire report details
      const notificationMessage = `🔥 FIRE REPORT ASSIGNED 🔥
📍 Location: ${toStr(fireReport.address || fireReport.geotag_location || fireReport.location, 'Location not specified')}
🔥 Alarm Level: ${toStr(formatAlarm(fireReport), 'Not specified')}
📊 AI Detection: ${toStr(formatPrediction(fireReport), 'Not analyzed')}
👤 Reporter: ${toStr(fireReport.reporter_name || fireReport.reporter || fireReport.reported_by, 'Unknown Reporter')}
📝 Cause: ${toStr(fireReport.cause || fireReport.possible_cause || fireReport.fire_cause, 'Under investigation')}
💨 Smoke Analysis: ${fireReport.smoke_intensity ? toStr(`${fireReport.smoke_intensity}${fireReport.smoke_confidence ? ` ${fireReport.smoke_confidence}` : ''}`) : 'Not analyzed'}
🏠 Structure: ${toStr(fireReport.structure || fireReport.building_type, 'Not specified')}
🏘️ Structures Affected: ${fireReport.number_of_structures_on_fire != null ? toStr(fireReport.number_of_structures_on_fire) : 'Unknown'}
⏰ Reported: ${toStr(fireReport.formatted_timestamp || fireReport.timestamp, 'Time not specified')}

Please respond immediately to this assignment.`;

      // Notify all responders for this station
      const notificationPromises = responders.map(async (responder) => {
        try {
          const { error: notificationError } = await supabase
            .from('responder_notifications')
            .insert({
              responder_id: responder.id,
              station_id: currentStationId,
              fire_report_id: fireReport.id,
              title: `Fire Report #${fireReport.id} - ${toStr(formatAlarm(fireReport), 'Emergency')}`,
              message: notificationMessage,
              priority: 'high',
              is_read: false
            });

          if (notificationError) {
            console.error(`❌ Error notifying responder ${responder.id}:`, notificationError);
            return false;
          }

          console.log(`✅ Notification sent to responder ${responder.id}`);
          return true;
        } catch (error) {
          console.error(`❌ Error notifying responder ${responder.id}:`, error);
          return false;
        }
      });

      const results = await Promise.all(notificationPromises);
      const successCount = results.filter(Boolean).length;
      
      console.log('📊 Notification results:', { successCount, totalResponders: responders.length, results });
      
      if (successCount > 0) {
        alert(`✅ Successfully notified ${successCount} responder(s) about the fire report.`);
        setShowReportModal(false); // Close the modal
      } else {
        alert('❌ Failed to notify responders. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error notifying responders:', error);
      alert(`❌ Error notifying responders: ${error.message}`);
    } finally {
      setIsNotifying(false);
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

        // 2) Load all stations with lat/lng
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
        const mine = withCoords.find(s => s.id === myId) || withCoords[0] || null;
        setMyStation(mine);
        if (mine) {
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

  // Fetch responders for the current station
  useEffect(() => {
    const fetchResponders = async () => {
      if (!currentStationId) return;

      try {
        console.log('👥 Fetching responders for station:', currentStationId);
        const { data: respondersData, error } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email, phone')
          .eq('station_id', currentStationId);

        if (error) {
          console.error('❌ Error fetching responders:', error);
          return;
        }

        setResponders(respondersData || []);
        console.log('👥 Loaded responders for station:', respondersData?.length || 0);
      } catch (e) {
        console.error('❌ Error loading responders:', e);
      }
    };

    fetchResponders();
  }, [currentStationId]);

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
        const resp = await fetch('https://fire-detection-api-production-f8a3.up.railway.app/get_reports');
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
        }).filter(Boolean).filter(r => !isNaN(parseFloat(r.latitude)) && !isNaN(parseFloat(r.longitude)));

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

        {/* Other stations */}
        {stations.filter(s => !myStation || s.id !== myStation.id).map(s => (
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
      {/* Modal detail to avoid Callout-related crashes */}
      <Modal
        visible={!!showReportModal && !!selectedReport}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, width: '92%', maxHeight: '85%' }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>🔥 Fire Report</Text>
              
              {/* Show forwarding information if this report was forwarded */}
              {selectedReport?.is_forwarded && (
                <View style={{ backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fbbf24', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400e', marginBottom: 4 }}>📨 Forwarded Report</Text>
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
              
              {/* Reporter */}
              <Text style={{ marginBottom: 4 }}>Reporter: {toStr(selectedReport?.reporter_name || selectedReport?.reporter || selectedReport?.reported_by)}</Text>
              {/* Cause */}
              <Text style={{ marginBottom: 4 }}>Cause: {toStr(selectedReport?.cause || selectedReport?.possible_cause || selectedReport?.fire_cause)}</Text>
              {/* Alarm */}
              <Text style={{ marginBottom: 4 }}>Alarm Level: {toStr(formatAlarm(selectedReport))}</Text>
              {/* AI Detection */}
              <Text style={{ marginBottom: 4 }}>AI Fire Detection: {toStr(formatPrediction(selectedReport))}</Text>
              {/* Smoke */}
              {selectedReport?.smoke_intensity ? (
                <Text style={{ marginBottom: 4 }}>Smoke Analysis: {toStr(`${selectedReport.smoke_intensity}${selectedReport.smoke_confidence ? ` ${selectedReport.smoke_confidence}` : ''}`)}</Text>
              ) : null}
              {/* Structure */}
              <Text style={{ marginBottom: 4 }}>Structure: {toStr(selectedReport?.structure || selectedReport?.building_type)}</Text>
              {/* Structures affected */}
              {selectedReport?.number_of_structures_on_fire != null ? (
                <Text style={{ marginBottom: 4 }}>Structures Affected: {toStr(selectedReport.number_of_structures_on_fire)}</Text>
              ) : null}
              {/* Location */}
              <Text style={{ marginBottom: 4 }}>Location: {toStr(selectedReport?.address || selectedReport?.geotag_location || selectedReport?.location || 'Not specified')}</Text>
              {/* Reported */}
              <Text style={{ marginBottom: 8 }}>Reported: {toStr(selectedReport?.formatted_timestamp || selectedReport?.timestamp)}</Text>
              {/* Image */}
              {(() => {
                const r = selectedReport || {};
                const payload = r || {};
                const candidate = payload.image_url || payload.image || payload.photo_url || payload.media_url || (Array.isArray(payload.images) && payload.images[0]) || null;
                if (!candidate || typeof candidate !== 'string') return null;
                return (
                  <Image source={{ uri: candidate }} resizeMode="cover" style={{ width: '100%', height: 220, borderRadius: 8, backgroundColor: '#e5e7eb' }} />
                );
              })()}
              
              {/* Notify Responders Button */}
              <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                <TouchableOpacity
                  onPress={() => handleNotifyResponders(selectedReport)}
                  disabled={isNotifying || !responders.length}
                  style={{
                    width: '100%',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: isNotifying || !responders.length ? '#9ca3af' : '#ef4444',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8
                  }}
                >
                  {isNotifying ? (
                    <>
                      <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Notifying...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 16, marginRight: 8 }}>🚨</Text>
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                        Notify Responders ({responders.length})
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                {!responders.length && (
                  <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginBottom: 8 }}>
                    No responders assigned to this station
                  </Text>
                )}
              </View>

              <TouchableOpacity onPress={() => setShowReportModal(false)} style={{ alignSelf: 'flex-end', marginTop: 8, backgroundColor: '#6b7280', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width,
    height,
    zIndex: 1,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});