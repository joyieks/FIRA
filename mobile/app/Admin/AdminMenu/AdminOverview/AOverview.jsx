import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, TextInput, Modal, Image, Platform } from 'react-native';

const API_URL = 'https://fire-detection-api-production-f543.up.railway.app';

export default function AOverview() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | On Going | Under Control
  const [timeRangeFilter, setTimeRangeFilter] = useState('all'); // all | today | week | month
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/get_reports`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }, [fetchReports]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const hasCoords = r.latitude && r.longitude && !isNaN(parseFloat(r.latitude)) && !isNaN(parseFloat(r.longitude));
      const statusText = (r.status || '').toString().toLowerCase();
      const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
      const isFireOut = statusText.includes('fire out');
      if (!(hasCoords && !isCancelled && !isFireOut)) return false;

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const location = (r.address || r.geotag_location || '').toLowerCase();
        const reporter = (r.reporter || '').toLowerCase();
        const cause = (r.cause_of_fire || '').toLowerCase();
        const structure = (r.structure || '').toLowerCase();
        if (!(location.includes(q) || reporter.includes(q) || cause.includes(q) || structure.includes(q))) return false;
      }

      if (statusFilter !== 'all') {
        if ((r.status || '') !== statusFilter) return false;
      }

      if (timeRangeFilter !== 'all') {
        const ts = r.created_at || r.timestamp;
        if (!ts) return false;
        const d = new Date(ts);
        const now = new Date();
        if (timeRangeFilter === 'today') {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (d < start) return false;
        } else if (timeRangeFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (d < weekAgo) return false;
        } else if (timeRangeFilter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (d < monthAgo) return false;
        }
      }

      return true;
    });
  }, [reports, searchQuery, statusFilter, timeRangeFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const fire = filtered.filter((r) => (r.prediction || '').toLowerCase() === 'fire').length;
    const noFire = filtered.filter((r) => (r.prediction || '').toLowerCase() === 'no fire').length;
    return { total, fire, noFire };
  }, [filtered]);

  const getSafeImageUri = (uri) => {
    if (!uri || typeof uri !== 'string') return null;
    // iOS blocks http by default; try to upgrade to https if possible
    if (Platform.OS === 'ios' && uri.startsWith('http://')) {
      return uri.replace('http://', 'https://');
    }
    return uri;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 100, paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 16 }}>Emergency Reports Overview</Text>

        <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search report by location, reporter, cause, or structure type..."
            placeholderTextColor="#94a3b8"
            style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a' }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <View style={{ flexDirection: 'row' }}>
              {['all', 'On Going', 'Under Control'].map((s) => (
                <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginRight: 8, backgroundColor: statusFilter === s ? '#fee2e2' : '#f1f5f9' }}>
                  <Text style={{ color: statusFilter === s ? '#b91c1c' : '#334155', fontWeight: '600' }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {['all', 'today', 'week', 'month'].map((t) => (
                <TouchableOpacity key={t} onPress={() => setTimeRangeFilter(t)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginLeft: 8, backgroundColor: timeRangeFilter === t ? '#fee2e2' : '#f1f5f9' }}>
                  <Text style={{ color: timeRangeFilter === t ? '#b91c1c' : '#334155', fontWeight: '600', textTransform: 'capitalize' }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ef4444' }}>{stats.total}</Text>
            <Text style={{ color: '#64748b', marginTop: 4 }}>Active Reports</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ef4444' }}>{stats.fire}</Text>
            <Text style={{ color: '#64748b', marginTop: 4 }}>Fire Detected</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ef4444' }}>{stats.noFire}</Text>
            <Text style={{ color: '#64748b', marginTop: 4 }}>No Fire</Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: '#e2e8f0', marginBottom: 12 }} />

        <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 }}>Active Fire Reports</Text>
        {loading ? (
          <Text style={{ color: '#64748b' }}>Loading...</Text>
        ) : filtered.length === 0 ? (
          <Text style={{ color: '#64748b' }}>No active fire reports</Text>
        ) : (
          filtered.slice(0, 10).map((r) => (
            <TouchableOpacity
              key={`${r.id}`}
              activeOpacity={0.85}
              onPress={() => setSelectedReport(r)}
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 14,
                marginBottom: 12,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Report #{r.id}</Text>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#f1f5f9', borderRadius: 999 }}>
                  <Text style={{ color: '#0f172a', fontSize: 12 }}>{(r.prediction || 'Unknown')}</Text>
                </View>
              </View>
              <Text style={{ color: '#475569', marginTop: 6 }}>{r.address || r.geotag_location || 'No address'}</Text>
              {getSafeImageUri(r.image_url) ? (
                <Image
                  source={{ uri: getSafeImageUri(r.image_url) }}
                  style={{ width: '100%', height: 180, borderRadius: 10, marginTop: 8 }}
                  resizeMode="cover"
                  onError={() => { /* swallow image errors */ }}
                />
              ) : null}
              {(r.recommended_alarm_level || r.alarm_level) ? (
                <Text style={{ marginTop: 6, color: '#9f1239', fontWeight: '700' }}>{r.recommended_alarm_level || r.alarm_level}</Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity onPress={onRefresh} style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Refresh</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!selectedReport} transparent animationType="fade" onRequestClose={() => setSelectedReport(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, maxWidth: 600, width: '100%', padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Emergency Report Details</Text>
              <TouchableOpacity onPress={() => setSelectedReport(null)} style={{ padding: 6 }}>
                <Text style={{ fontWeight: '800', color: '#334155' }}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedReport && (
              <View>
                <Text style={{ color: '#475569', marginBottom: 6 }}>Location: <Text style={{ color: '#0f172a' }}>{selectedReport.address || selectedReport.geotag_location || 'No address'}</Text></Text>
                <Text style={{ color: '#475569', marginBottom: 6 }}>Prediction: <Text style={{ color: '#0f172a' }}>{selectedReport.prediction || 'Unknown'}</Text></Text>
                {(selectedReport.recommended_alarm_level || selectedReport.alarm_level) && (
                  <Text style={{ color: '#475569', marginBottom: 6 }}>Alarm Level: <Text style={{ color: '#0f172a' }}>{selectedReport.recommended_alarm_level || selectedReport.alarm_level}</Text></Text>
                )}
                <Text style={{ color: '#475569' }}>Timestamp: <Text style={{ color: '#0f172a' }}>{selectedReport.created_at || selectedReport.timestamp || 'Unknown'}</Text></Text>
                {getSafeImageUri(selectedReport.image_url) ? (
                  <Image
                    source={{ uri: getSafeImageUri(selectedReport.image_url) }}
                    style={{ width: '100%', height: 220, borderRadius: 10, marginTop: 12 }}
                    resizeMode="cover"
                    onError={() => { /* swallow image errors */ }}
                  />
                ) : null}
              </View>
            )}
            <TouchableOpacity onPress={() => setSelectedReport(null)} style={{ alignSelf: 'flex-end', marginTop: 16, backgroundColor: '#ef4444', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

