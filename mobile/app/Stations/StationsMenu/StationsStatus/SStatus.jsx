import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';

export default function SStatus() {
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStationId, setCurrentStationId] = useState(null);
  const [assignedRespondersByReport, setAssignedRespondersByReport] = useState({});
  const [responders, setResponders] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [responderSelection, setResponderSelection] = useState({}); // reportId -> Set(ids)
  const [responderExisting, setResponderExisting] = useState({});
  const [isAssigning, setIsAssigning] = useState(false);

  const API_URL = 'https://fire-detection-api-production-f8a3.up.railway.app';

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return String(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return 'Unknown'; }
  };

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const raw = await AsyncStorage.getItem('userData');
      const userData = raw ? JSON.parse(raw) : {};
      const stationId = userData?.id || userData?.uid;
      setCurrentStationId(stationId || null);
      if (!stationId) { setReports([]); return; }

      // Station assignments
      const { data: stationAssignments } = await supabase
        .from('report_assignments')
        .select('report_id')
        .eq('assignee_type', 'station')
        .eq('assignee_id', stationId);

      // Responders of this station → their assignments
      const { data: stationResponders } = await supabase
        .from('responders')
        .select('id')
        .eq('station_id', stationId);
      const responderIds = (stationResponders || []).map(r => r.id);
      let responderAssignments = [];
      if (responderIds.length > 0) {
        const { data: respAssigns } = await supabase
          .from('report_assignments')
          .select('report_id')
          .eq('assignee_type', 'responder')
          .in('assignee_id', responderIds);
        responderAssignments = respAssigns || [];
      }

      // Forwarded reports to this station
      const { data: forwarded } = await supabase
        .from('report_routes')
        .select('report_id')
        .eq('target', `station:${stationId}`);

      const ids = new Set([
        ...((stationAssignments || []).map(a => String(a.report_id))),
        ...((responderAssignments || []).map(a => String(a.report_id))),
        ...((forwarded || []).map(f => String(f.report_id)))
      ]);

      if (!ids.size) { setReports([]); return; }

      const resp = await fetch(`${API_URL}/get_reports`);
      const data = resp.ok ? await resp.json() : [];
      const mapped = (data || [])
        .filter(r => ids.has(String(r.id)))
        .map(r => ({
          id: r.id,
          time: formatTime(r.formatted_timestamp || r.created_at),
          reporter: r.reporter || 'Unknown Reporter',
          location: r.address || r.geotag_location || 'Location unavailable',
          status: r.status || 'On Going',
          suggestedAlarmLevel: r.recommended_alarm_level || r.alarm_level || 'Under Control',
          finalAlarmLevel: r.final_fire_alarm_level || '1st Alarm',
          description: r.cause_of_fire || 'No cause specified',
          timestamp: r.created_at || r.timestamp,
          picture: r.image_url,
        }))
        .sort((a,b) => new Date(b.timestamp||0) - new Date(a.timestamp||0));
      setReports(mapped);

      // Load assigned responders per report (for quick view chips)
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
    } catch (e) {
      setReports([]);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load responders for this station for assignment UI
  useEffect(() => {
    const loadResponders = async () => {
      try {
        if (!currentStationId) return;
        const { data, error } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email')
          .eq('station_id', currentStationId);
        if (!error) setResponders(data || []);
      } catch (_) {}
    };
    loadResponders();
  }, [currentStationId]);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(r => (r.location||'').toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q));
  }, [reports, searchQuery]);

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ paddingTop: 100, paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text className="text-2xl font-bold text-gray-900 mb-4">Assigned Fire Reports</Text>
        <View className="bg-white rounded-xl p-3 mb-4">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search reports by location or description..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-gray-800"
          />
        </View>

        {isLoading ? (
          <View className="py-12 items-center"><Text className="text-gray-500">Loading reports...</Text></View>
        ) : filteredReports.length === 0 ? (
          <View className="py-12 items-center"><Text className="text-gray-500">No assigned reports</Text></View>
        ) : (
          filteredReports.map((r) => (
            <TouchableOpacity key={r.id} onPress={async () => {
              setSelectedReport(r);
              // preload assigned responders for this report into selection
              try {
                const rid = String(r.id);
                const { data: assigns } = await supabase
                  .from('report_assignments')
                  .select('assignee_id')
                  .eq('report_id', rid)
                  .eq('assignee_type', 'responder');
                const ids = new Set((assigns || []).map(a => a.assignee_id));
                setResponderExisting(prev => ({ ...prev, [rid]: new Set(ids) }));
                setResponderSelection(prev => ({ ...prev, [rid]: new Set(ids) }));
              } catch (_) {}
              setShowReportModal(true);
            }}>
            <View className="bg-white rounded-xl mb-3 p-4 border border-gray-100">
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-gray-500">{r.time}</Text>
                <Text className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{r.status}</Text>
              </View>
              <Text className="text-base font-semibold text-gray-900 mb-1">{r.location}</Text>
              <Text className="text-gray-600 mb-2">{r.description}</Text>
              <View className="flex-row mb-8">
                <View className="mr-3"><Text className="text-xs text-gray-500">Suggested</Text><Text className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">{r.suggestedAlarmLevel}</Text></View>
                <View><Text className="text-xs text-gray-500">Final</Text><Text className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-800">{r.finalAlarmLevel}</Text></View>
              </View>
              {!!assignedRespondersByReport[String(r.id)] && assignedRespondersByReport[String(r.id)].length > 0 && (
                <View className="flex-row flex-wrap">
                  {assignedRespondersByReport[String(r.id)].map((name, idx) => (
                    <Text key={`${r.id}-${idx}`} className="text-[11px] mr-2 mb-2 px-2 py-1 rounded-full bg-green-100 text-green-800">{name}</Text>
                  ))}
                </View>
              )}
            </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Report Details Modal with actions */}
      <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '90%' }}>
            {selectedReport && (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>Emergency Report Details</Text>
                  <TouchableOpacity onPress={() => setShowReportModal(false)}><Text style={{ fontSize: 22, fontWeight: '800', color: '#6b7280' }}>✕</Text></TouchableOpacity>
                </View>
                {selectedReport.picture ? (
                  <Image source={{ uri: selectedReport.picture }} resizeMode="cover" style={{ width: '100%', height: 200, borderRadius: 8, backgroundColor: '#e5e7eb', marginBottom: 12 }} />
                ) : null}
                <Text style={{ fontSize: 16, color: '#374151', marginBottom: 4 }}>Location:</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>{selectedReport.location}</Text>

                {/* Status changer */}
                <Text style={{ fontSize: 16, color: '#374151', marginBottom: 6 }}>Current Status</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                  {['On Going', 'Under Control', 'Fire Out'].map((s) => (
                    <TouchableOpacity key={s} onPress={async () => {
                      try {
                        // Call backend to persist status
                        const controller = new AbortController();
                        setIsAssigning(true);
                        const res = await fetch('https://fire-detection-api-production-f8a3.up.railway.app/update_report_status', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report_id: selectedReport.id, status: s }), signal: controller.signal
                        });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, status: s } : r));
                        setSelectedReport(prev => prev ? { ...prev, status: s } : prev);
                      } catch (e) {
                        Alert.alert('Error', `Failed to update status: ${e.message}`);
                      } finally { setIsAssigning(false); }
                    }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: selectedReport.status === s ? '#3b82f6' : '#d1d5db', backgroundColor: selectedReport.status === s ? '#3b82f6' : '#f3f4f6', marginRight: 8, marginBottom: 8 }}>
                      <Text style={{ color: selectedReport.status === s ? 'white' : '#374151', fontWeight: '600' }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Assign responders */}
                <Text style={{ fontSize: 16, color: '#374151', marginBottom: 6 }}>Assign Responders</Text>
                <View style={{ backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginBottom: 12 }}>
                  <ScrollView style={{ maxHeight: 200 }}>
                    {(responders || []).length === 0 ? (
                      <View style={{ padding: 12 }}><Text style={{ color: '#6b7280' }}>No responders for this station.</Text></View>
                    ) : responders.map((r) => {
                      const rid = String(selectedReport.id);
                      const setSel = responderSelection[rid] || new Set();
                      const checked = setSel.has(r.id);
                      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Responder';
                      return (
                        <TouchableOpacity key={r.id} onPress={() => {
                          setResponderSelection(prev => {
                            const next = new Set(prev[rid] || []);
                            if (checked) next.delete(r.id); else next.add(r.id);
                            return { ...prev, [rid]: next };
                          });
                        }} style={{ paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                          <Text style={{ color: '#111827' }}>{name}</Text>
                          <Text style={{ color: checked ? '#16a34a' : '#9ca3af' }}>{checked ? 'Assigned' : 'Assign'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <View style={{ padding: 12, alignItems: 'flex-end' }}>
                    <TouchableOpacity disabled={isAssigning} onPress={async () => {
                      try {
                        setIsAssigning(true);
                        const rid = String(selectedReport.id);
                        const selected = responderSelection[rid] || new Set();
                        const existing = responderExisting[rid] || new Set();
                        const toAdd = [...selected].filter(id => !existing.has(id));
                        const toRemove = [...existing].filter(id => !selected.has(id));
                        if (toAdd.length > 0) {
                          const rows = toAdd.map(id => ({ report_id: rid, assignee_type: 'responder', assignee_id: id }));
                          // Avoid duplicate key violations by upserting on a composite conflict target
                          const { error: addErr } = await supabase
                            .from('report_assignments')
                            .upsert(rows, { onConflict: 'report_id,assignee_type,assignee_id' });
                          if (addErr) throw addErr;
                        }
                        if (toRemove.length > 0) {
                          const { error: delErr } = await supabase
                            .from('report_assignments')
                            .delete()
                            .eq('report_id', rid)
                            .eq('assignee_type', 'responder')
                            .in('assignee_id', toRemove);
                          if (delErr) throw delErr;
                        }
                        setResponderExisting(prev => ({ ...prev, [rid]: new Set(selected) }));
                        Alert.alert('Success', 'Assignments updated.');
                      } catch (e) {
                        Alert.alert('Error', e.message || 'Failed to update assignments');
                      } finally { setIsAssigning(false); }
                    }} style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: isAssigning ? '#9ca3af' : '#3b82f6', borderRadius: 6 }}>
                      <Text style={{ color: 'white', fontWeight: '700' }}>{isAssigning ? 'Saving...' : 'Save'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}