
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Image, Alert, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';

export default function SStatus() {
  const insets = useSafeAreaInsets();
  const [stationId, setStationId] = useState(null);
  const [stationName, setStationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Statistics
  const [totalReports, setTotalReports] = useState(0);
  const [activeReports, setActiveReports] = useState(0);
  const [resolvedReports, setResolvedReports] = useState(0);
  const [forwardedReports, setForwardedReports] = useState(0);

  // Search and reports
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState([]);
  const [assignedRespondersByReport, setAssignedRespondersByReport] = useState({});
  const [responders, setResponders] = useState([]);
  const [responderSelection, setResponderSelection] = useState({}); // reportId -> Set(ids)
  const [responderExisting, setResponderExisting] = useState({});
  const [isAssigning, setIsAssigning] = useState(false);

  const API_URL = 'https://fire-detection-api-production-f8a3.up.railway.app';

  // Format time helper
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return 'Unknown';
    }
  };

  // Minutes ago helper
  const minutesAgo = (timestamp) => {
    try {
      const d = new Date(timestamp);
      const mins = Math.floor((Date.now() - d) / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } catch {
      return 'Unknown';
    }
  };

  // Get station ID from AsyncStorage
  useEffect(() => {
    const loadStationData = async () => {
      try {
        const userDataStr = await AsyncStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          const id = userData?.id || userData?.uid;
          setStationId(id);
          setStationName(userData?.station_name || 'Fire Station');
          console.log('📱 Station Overview: Station ID:', id);
        }
      } catch (err) {
        console.error('📱 Station Overview: Error loading station data:', err);
      }
    };
    loadStationData();
  }, []);

  // Unified load function - combines both previous loads
  const loadAssignedReports = useCallback(async () => {
    if (!stationId) return;
    
    try {
      setLoading(true);
      console.log('📱 Station Overview: Loading reports for station:', stationId);

      // Fetch station assignments
      const { data: stationAssignments, error: assignError } = await supabase
        .from('report_assignments')
        .select('report_id, assigned_at, note')
        .eq('assignee_type', 'station')
        .eq('assignee_id', stationId);

      if (assignError) {
        console.error('📱 Station Overview: Error fetching assignments:', assignError);
      }

      // Fetch responders of this station
      const { data: stationResponders } = await supabase
        .from('responders')
        .select('id')
        .eq('station_id', stationId);
      const responderIds = (stationResponders || []).map(r => r.id);

      // Fetch responder assignments
      let responderAssignments = [];
      if (responderIds.length > 0) {
        const { data: respAssigns } = await supabase
          .from('report_assignments')
          .select('report_id')
          .eq('assignee_type', 'responder')
          .in('assignee_id', responderIds);
        responderAssignments = respAssigns || [];
      }

      // Fetch forwards
      const { data: forwarded, error: forwardError } = await supabase
        .from('report_routes')
        .select('report_id, forwarded_at, note')
        .eq('target', `station:${stationId}`);

      if (forwardError) {
        console.error('📱 Station Overview: Error fetching forwards:', forwardError);
      }

      // Create metadata maps
      const forwardedMetadata = new Map();
      (forwarded || []).forEach(f => {
        forwardedMetadata.set(String(f.report_id), {
          note: f.note,
          forwarded_at: f.forwarded_at
        });
      });

      // Combine all IDs
      const ids = new Set([
        ...((stationAssignments || []).map(a => String(a.report_id))),
        ...((responderAssignments || []).map(a => String(a.report_id))),
        ...((forwarded || []).map(f => String(f.report_id)))
      ]);

      console.log(`📱 Station Overview: ${ids.size} total reports`);

      if (ids.size === 0) {
        setReports([]);
        setTotalReports(0);
        setActiveReports(0);
        setResolvedReports(0);
        setForwardedReports(0);
        return;
      }

      // Fetch fire reports from API
      const resp = await fetch(`${API_URL}/get_reports`);
      const data = resp.ok ? await resp.json() : [];
      
      // Filter and map reports
      const filtered = (data || []).filter(r => ids.has(String(r.id)));
      const mapped = filtered.map(r => {
        const forwardingInfo = forwardedMetadata.get(String(r.id));
        return {
          id: r.id,
          time: formatTime(r.formatted_timestamp || r.created_at),
          reporter: r.reporter_name || r.reporter || 'Unknown Reporter',
          location: r.address || r.geotag_location || 'Location unavailable',
          status: r.status || 'On Going',
          suggestedAlarmLevel: r.recommended_alarm_level || r.alarm_level || 'Unknown',
          finalAlarmLevel: r.final_fire_alarm_level || '1st Alarm',
          description: r.cause_of_fire || r.cause || 'No cause specified',
          picture: r.image_url,
          minutesAgoText: minutesAgo(r.created_at || r.timestamp),
          prediction: r.prediction,
          confidence: r.confidence,
          structure: r.structure_type || r.structure,
          structure_confidence: r.structure_confidence,
          smokeIntensity: r.smoke_intensity,
          smokeConfidence: r.smoke_confidence,
          numberOfStructures: r.structures_affected || r.number_of_structures_on_fire,
          timestamp: r.created_at || r.timestamp,
          latitude: r.latitude,
          longitude: r.longitude,
          smoke_analysis: r.smoke_analysis,
          is_forwarded: !!forwardingInfo,
          forwarding_note: forwardingInfo?.note,
          forwarded_at: forwardingInfo?.forwarded_at
        };
      });

      // Sort by timestamp
      const sorted = mapped.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      setReports(sorted);

      // Calculate statistics
      setTotalReports(sorted.length);
      setActiveReports(sorted.filter(r => {
        const status = (r.status || '').toLowerCase();
        return status.includes('on going') || status.includes('ongoing') || !status.includes('out');
      }).length);
      setResolvedReports(sorted.filter(r => {
        const status = (r.status || '').toLowerCase();
        return status.includes('fire out') || status.includes('resolved');
      }).length);
      setForwardedReports(sorted.filter(r => r.is_forwarded).length);

      // Load assigned responders per report
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

    } catch (error) {
      console.error('📱 Station Overview: Error loading reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  // Load reports on mount and when stationId changes
  useEffect(() => {
    if (stationId) {
      loadAssignedReports();
    }
  }, [stationId, loadAssignedReports]);

  // Load responders for this station for assignment UI
  useEffect(() => {
    const loadResponders = async () => {
      try {
        if (!stationId) return;
        const { data, error } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email')
          .eq('station_id', stationId);
        if (!error) setResponders(data || []);
      } catch (_) {}
    };
    loadResponders();
  }, [stationId]);

  // Filter reports based on search
  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(r => 
      (r.location||'').toLowerCase().includes(q) || 
      (r.description||'').toLowerCase().includes(q)
    );
  }, [reports, searchQuery]);

  // Get status color
  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower.includes('fire out') || statusLower.includes('resolved')) {
      return { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' };
    }
    if (statusLower.includes('under control')) {
      return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
    }
    if (statusLower.includes('on going') || statusLower.includes('ongoing')) {
      return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
    }
    return { bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db' };
  };

  // Get alarm level color
  const getAlarmLevelColor = (level) => {
    const levelStr = String(level || '');
    if (levelStr.includes('General Alarm')) {
      return { bg: '#dc2626', text: '#ffffff', border: '#991b1b' };
    }
    if (levelStr.includes('5th') || levelStr.includes('TASK FORCE')) {
      return { bg: '#a855f7', text: '#ffffff', border: '#7e22ce' };
    }
    if (levelStr.includes('4th')) {
      return { bg: '#8b5cf6', text: '#ffffff', border: '#6d28d9' };
    }
    if (levelStr.includes('3rd')) {
      return { bg: '#ef4444', text: '#ffffff', border: '#dc2626' };
    }
    if (levelStr.includes('2nd')) {
      return { bg: '#f97316', text: '#ffffff', border: '#ea580c' };
    }
    if (levelStr.includes('1st')) {
      return { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' };
    }
    return { bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db' };
  };

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        style={{ paddingTop: insets.top + 60 }}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadAssignedReports} />
        }
      >
        {/* Header */}
        <View className="px-4 py-4">
          <Text className="text-2xl font-bold text-gray-800 mb-1">{stationName}</Text>
          <Text className="text-gray-500">Fire Reports Overview</Text>
        </View>

        {/* Statistics Cards */}
        <View className="px-4 mb-4">
          <View className="flex-row flex-wrap">
            {/* Total Reports */}
            <View className="w-1/2 p-2">
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons name="assignment" size={24} color="#3b82f6" />
                  <Text className="text-2xl font-bold text-gray-800">{totalReports}</Text>
                </View>
                <Text className="text-gray-600 text-sm">Total Reports</Text>
              </View>
            </View>

            {/* Active Reports */}
            <View className="w-1/2 p-2">
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons name="local-fire-department" size={24} color="#ef4444" />
                  <Text className="text-2xl font-bold text-red-600">{activeReports}</Text>
                </View>
                <Text className="text-gray-600 text-sm">Active</Text>
              </View>
            </View>

            {/* Resolved Reports */}
            <View className="w-1/2 p-2">
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons name="check-circle" size={24} color="#10b981" />
                  <Text className="text-2xl font-bold text-green-600">{resolvedReports}</Text>
                </View>
                <Text className="text-gray-600 text-sm">Resolved</Text>
              </View>
            </View>

            {/* Forwarded Reports */}
            <View className="w-1/2 p-2">
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                  <MaterialIcons name="forward" size={24} color="#f59e0b" />
                  <Text className="text-2xl font-bold text-amber-600">{forwardedReports}</Text>
                </View>
                <Text className="text-gray-600 text-sm">Forwarded</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View className="px-4 mb-4">
          <View className="bg-white rounded-xl p-3">
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search reports by location or description..."
              className="text-gray-800"
            />
          </View>
        </View>

        {/* Reports List */}
        <View className="px-4">
          <Text className="text-lg font-bold text-gray-800 mb-3">Fire Reports</Text>
          
          {loading ? (
            <View className="bg-white rounded-xl p-8 shadow-sm items-center">
              <Text className="text-gray-500">Loading reports...</Text>
            </View>
          ) : filteredReports.length === 0 ? (
            <View className="bg-white rounded-xl p-8 shadow-sm items-center">
              <MaterialIcons name="inbox" size={64} color="#9ca3af" />
              <Text className="text-xl font-bold text-gray-600 mt-4 mb-2">No Reports</Text>
              <Text className="text-gray-500 text-center">
                {searchQuery ? 'No reports match your search' : 'No fire reports assigned to your station yet'}
              </Text>
            </View>
          ) : (
            filteredReports.map((report) => {
              const statusColor = getStatusColor(report.status);
              const alarmColor = getAlarmLevelColor(report.suggestedAlarmLevel);
              
              return (
                <TouchableOpacity
                  key={report.id}
                  className="bg-white rounded-xl p-4 mb-3 shadow-sm"
                  onPress={async () => {
                    setSelectedReport(report);
                    // Preload assigned responders for this report
                    try {
                      const rid = String(report.id);
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
                  }}
                >
                  {/* Forwarded Badge */}
                  {report.is_forwarded && (
                    <View className="bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 mb-3 flex-row items-center">
                      <MaterialIcons name="forward" size={16} color="#d97706" />
                      <Text className="text-amber-800 text-xs font-medium ml-2">Forwarded Report</Text>
                    </View>
                  )}

                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1">
                      <Text className="font-bold text-gray-900 text-base mb-1">
                        {report.location}
                      </Text>
                      <Text className="text-gray-500 text-sm">{report.minutesAgoText}</Text>
                    </View>
                    <View style={{ backgroundColor: statusColor.bg, borderColor: statusColor.border }} className="px-3 py-1 rounded-lg border">
                      <Text style={{ color: statusColor.text }} className="text-xs font-bold">
                        {report.status}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="person" size={16} color="#6b7280" />
                    <Text className="text-gray-600 text-sm ml-2">{report.reporter}</Text>
                  </View>

                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                      <MaterialIcons name="warning" size={16} color="#6b7280" />
                      <View style={{ backgroundColor: alarmColor.bg, borderColor: alarmColor.border }} className="px-3 py-1 rounded-lg ml-2 border">
                        <Text style={{ color: alarmColor.text }} className="text-xs font-bold">
                          {report.suggestedAlarmLevel}
                        </Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity className="bg-fire px-4 py-2 rounded-lg">
                      <Text className="text-white text-xs font-bold">View Details</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Assigned Responders */}
                  {!!assignedRespondersByReport[String(report.id)] && assignedRespondersByReport[String(report.id)].length > 0 && (
                    <View className="flex-row flex-wrap mt-2">
                      {assignedRespondersByReport[String(report.id)].map((name, idx) => (
                        <Text key={`${report.id}-${idx}`} className="text-xs mr-2 mb-2 px-2 py-1 rounded-full bg-green-100 text-green-800">
                          {name}
                        </Text>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Report Details Modal */}
      <Modal
        visible={showReportModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center px-4">
          <View className="bg-white rounded-2xl w-full" style={{ maxWidth: 600, maxHeight: '90%' }}>
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-xl font-bold text-gray-900">Report Details</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <MaterialIcons name="close" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 20 }}>
              {selectedReport && (
                <>
                  {/* Forwarding Info */}
                  {selectedReport.is_forwarded && (
                    <View className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
                      <View className="flex-row items-start">
                        <MaterialIcons name="forward" size={24} color="#d97706" />
                        <View className="flex-1 ml-3">
                          <Text className="text-amber-900 font-bold text-base mb-2">Forwarded Report</Text>
                          {selectedReport.forwarding_note && (
                            <Text className="text-amber-800 text-sm mb-1">
                              <Text className="font-bold">Note:</Text> {selectedReport.forwarding_note}
                            </Text>
                          )}
                          {selectedReport.forwarded_at && (
                            <Text className="text-amber-700 text-xs">
                              Forwarded: {new Date(selectedReport.forwarded_at).toLocaleString()}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Image */}
                  {selectedReport.picture && (
                    <View className="bg-gray-100 rounded-lg mb-4 overflow-hidden">
                      <Image
                        source={{ uri: selectedReport.picture }}
                        className="w-full h-48"
                        resizeMode="cover"
                      />
                    </View>
                  )}

                  {/* Location & Time */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm mb-1">Location</Text>
                    <Text className="text-gray-900 font-bold text-base">{selectedReport.location}</Text>
                    <Text className="text-gray-500 text-sm mt-1">{selectedReport.minutesAgoText}</Text>
                  </View>

                  {/* Reporter */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm mb-1">Reporter</Text>
                    <Text className="text-gray-900 font-semibold">{selectedReport.reporter}</Text>
                  </View>

                  {/* Status Changer */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm mb-2">Change Status</Text>
                    <View className="flex-row flex-wrap">
                      {['On Going', 'Under Control', 'Fire Out'].map((s) => (
                        <TouchableOpacity 
                          key={s} 
                          onPress={async () => {
                            try {
                              setIsAssigning(true);
                              const res = await fetch(`${API_URL}/update_report_status`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ report_id: selectedReport.id, status: s })
                              });
                              if (!res.ok) throw new Error(`HTTP ${res.status}`);
                              setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, status: s } : r));
                              setSelectedReport(prev => prev ? { ...prev, status: s } : prev);
                              Alert.alert('Success', 'Status updated successfully');
                            } catch (e) {
                              Alert.alert('Error', `Failed to update status: ${e.message}`);
                            } finally { 
                              setIsAssigning(false); 
                            }
                          }} 
                          disabled={isAssigning}
                          style={{ 
                            paddingHorizontal: 12, 
                            paddingVertical: 8, 
                            borderRadius: 6, 
                            borderWidth: 1, 
                            borderColor: selectedReport.status === s ? '#3b82f6' : '#d1d5db', 
                            backgroundColor: selectedReport.status === s ? '#3b82f6' : '#f3f4f6', 
                            marginRight: 8, 
                            marginBottom: 8 
                          }}
                        >
                          <Text style={{ color: selectedReport.status === s ? 'white' : '#374151', fontWeight: '600' }}>
                            {s}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Alarm Levels */}
                  <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                      <Text className="text-gray-600 text-sm mb-2">Suggested Alarm</Text>
                      <View 
                        style={{ 
                          backgroundColor: getAlarmLevelColor(selectedReport.suggestedAlarmLevel).bg,
                          borderColor: getAlarmLevelColor(selectedReport.suggestedAlarmLevel).border 
                        }} 
                        className="px-3 py-2 rounded-lg border"
                      >
                        <Text 
                          style={{ color: getAlarmLevelColor(selectedReport.suggestedAlarmLevel).text }} 
                          className="text-sm font-bold text-center"
                        >
                          {selectedReport.suggestedAlarmLevel}
                        </Text>
                      </View>
                    </View>
                    
                    <View className="flex-1 ml-2">
                      <Text className="text-gray-600 text-sm mb-2">Final Alarm</Text>
                      <View 
                        style={{ 
                          backgroundColor: getAlarmLevelColor(selectedReport.finalAlarmLevel).bg,
                          borderColor: getAlarmLevelColor(selectedReport.finalAlarmLevel).border 
                        }} 
                        className="px-3 py-2 rounded-lg border"
                      >
                        <Text 
                          style={{ color: getAlarmLevelColor(selectedReport.finalAlarmLevel).text }} 
                          className="text-sm font-bold text-center"
                        >
                          {selectedReport.finalAlarmLevel}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Description */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm mb-1">Cause of Fire</Text>
                    <Text className="text-gray-900">{selectedReport.description}</Text>
                  </View>

                  {/* AI Analysis */}
                  {selectedReport.prediction && (
                    <View className="bg-blue-50 rounded-lg p-4 mb-4">
                      <Text className="text-blue-900 font-bold mb-2">AI Detection</Text>
                      <Text className="text-blue-800">
                        {selectedReport.prediction} {selectedReport.confidence ? `(${selectedReport.confidence}% confidence)` : ''}
                      </Text>
                    </View>
                  )}

                  {/* Additional Info */}
                  {selectedReport.structure && (
                    <View className="mb-2">
                      <Text className="text-gray-600 text-sm">Structure Type: <Text className="text-gray-900 font-semibold">{selectedReport.structure}{selectedReport.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}</Text></Text>
                    </View>
                  )}
                  {selectedReport.numberOfStructures && (
                    <View className="mb-2">
                      <Text className="text-gray-600 text-sm">Structures Affected: <Text className="text-gray-900 font-semibold">{selectedReport.numberOfStructures}</Text></Text>
                    </View>
                  )}
                  {selectedReport.smoke_analysis && (
                    <View className="mb-4">
                      <Text className="text-gray-600 text-sm">Smoke Analysis: <Text className="text-gray-900 font-semibold">{selectedReport.smoke_analysis}</Text></Text>
                    </View>
                  )}

                  {/* Assign Responders Section */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm mb-2 font-bold">Assign Responders</Text>
                    <View className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <ScrollView style={{ maxHeight: 200 }}>
                        {(responders || []).length === 0 ? (
                          <View className="p-4">
                            <Text className="text-gray-500">No responders available for this station.</Text>
                          </View>
                        ) : responders.map((r) => {
                          const rid = String(selectedReport.id);
                          const setSel = responderSelection[rid] || new Set();
                          const checked = setSel.has(r.id);
                          const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Responder';
                          return (
                            <TouchableOpacity 
                              key={r.id} 
                              onPress={() => {
                                setResponderSelection(prev => {
                                  const next = new Set(prev[rid] || []);
                                  if (checked) next.delete(r.id); 
                                  else next.add(r.id);
                                  return { ...prev, [rid]: next };
                                });
                              }} 
                              className="px-4 py-3 flex-row justify-between items-center border-b border-gray-100"
                            >
                              <Text className="text-gray-900">{name}</Text>
                              <View className={`px-3 py-1 rounded-lg ${checked ? 'bg-green-100' : 'bg-gray-100'}`}>
                                <Text className={`text-xs font-semibold ${checked ? 'text-green-800' : 'text-gray-600'}`}>
                                  {checked ? '✓ Assigned' : 'Assign'}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      
                      <View className="p-3 bg-white border-t border-gray-200 items-end">
                        <TouchableOpacity 
                          disabled={isAssigning} 
                          onPress={async () => {
                            try {
                              setIsAssigning(true);
                              const rid = String(selectedReport.id);
                              const selected = responderSelection[rid] || new Set();
                              const existing = responderExisting[rid] || new Set();
                              const toAdd = [...selected].filter(id => !existing.has(id));
                              const toRemove = [...existing].filter(id => !selected.has(id));
                              
                              if (toAdd.length > 0) {
                                const rows = toAdd.map(id => ({ 
                                  report_id: rid, 
                                  assignee_type: 'responder', 
                                  assignee_id: id 
                                }));
                                const { error: addErr } = await supabase
                                  .from('report_assignments')
                                  .insert(rows);
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
                              
                              // Update the assigned responders display
                              await loadAssignedReports();
                              
                              Alert.alert('Success', 'Responder assignments updated successfully');
                            } catch (e) {
                              Alert.alert('Error', e.message || 'Failed to update assignments');
                            } finally { 
                              setIsAssigning(false); 
                            }
                          }} 
                          className={`px-4 py-2 rounded-lg ${isAssigning ? 'bg-gray-400' : 'bg-blue-600'}`}
                        >
                          <Text className="text-white font-bold">
                            {isAssigning ? 'Saving...' : 'Save Assignments'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

