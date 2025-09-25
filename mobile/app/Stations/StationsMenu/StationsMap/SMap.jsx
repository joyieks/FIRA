import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Dimensions, StatusBar, Platform, StyleSheet, Modal, TouchableOpacity, Image, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
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

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        // 1) Identify current station from stored userData
        const stored = await AsyncStorage.getItem('userData');
        const parsed = stored ? JSON.parse(stored) : {};
        const myId = parsed?.uid || parsed?.id;

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

  // Load assigned reports for this station
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('userData');
        const parsed = stored ? JSON.parse(stored) : {};
        const myId = parsed?.uid || parsed?.id;
        if (!myId) return;

        const { data: assignments, error } = await supabase
          .from('report_assignments')
          .select('report_id')
          .eq('assignee_type', 'station')
          .eq('assignee_id', myId);
        if (error) throw error;

        const ids = Array.from(new Set((assignments || []).map(a => String(a.report_id))));
        if (!ids.length) { setAssignedReports([]); return; }

        // Load from external API
        const resp = await fetch('https://fire-detection-api-production-f543.up.railway.app/get_reports');
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
          if (api && api.latitude && api.longitude) return api;
          const snap = (snapshots || []).find(s => String(s.report_id) === id);
          if (!snap) return null;
          const payload = typeof snap.snapshot_json === 'string' ? (() => { try { return JSON.parse(snap.snapshot_json); } catch { return {}; } })() : (snap.snapshot_json || {});
          return {
            id,
            latitude: typeof snap.lat === 'number' ? snap.lat : parseFloat(snap.lat),
            longitude: typeof snap.lng === 'number' ? snap.lng : parseFloat(snap.lng),
            address: snap.address || payload.address,
            ...payload,
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
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: color, borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16 }}>🔥</Text>
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
              <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>🔥 Assigned Fire Report</Text>
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
              <TouchableOpacity onPress={() => setShowReportModal(false)} style={{ alignSelf: 'flex-end', marginTop: 12, backgroundColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}>
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