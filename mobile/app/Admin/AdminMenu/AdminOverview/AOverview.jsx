import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, TextInput, Modal, Image, Platform, Alert } from 'react-native';
import { supabase } from '../../../config/supabase';

const API_URL = 'https://fire-detection-api-production-f8a3.up.railway.app';

export default function AOverview() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All | On Going | Under Control
  const [timeRangeFilter, setTimeRangeFilter] = useState('all'); // all | today | week | month
  const [selectedReport, setSelectedReport] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editReport, setEditReport] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReport, setCancelReport] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [assignedResponders, setAssignedResponders] = useState([]);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const res = await fetch(`${API_URL}/get_reports`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching reports:', e);
      if (e.name === 'AbortError') {
        console.error('Request timed out');
      }
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, []); // Remove fetchReports dependency to prevent infinite re-renders

  // Load assigned responders when a report is selected
  useEffect(() => {
    const loadAssignedResponders = async (reportId) => {
      try {
        setIsLoadingAssigned(true);
        setAssignedResponders([]);

        if (!reportId) return;

        const { data: assignments, error } = await supabase
          .from('report_assignments')
          .select('assignee_type, assignee_id, assigned_at')
          .eq('report_id', reportId)
          .eq('assignee_type', 'responder');

        if (error) {
          console.error('Error fetching report assignments:', error);
          return;
        }

        const responderIds = (assignments || []).map(a => a.assignee_id).filter(Boolean);
        if (responderIds.length === 0) {
          setAssignedResponders([]);
          return;
        }

        const { data: responders, error: respErr } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email, phone')
          .in('id', responderIds);

        if (respErr) {
          console.error('Error fetching responder profiles:', respErr);
          setAssignedResponders([]);
          return;
        }

        setAssignedResponders(responders || []);
      } catch (e) {
        console.error('Failed loading assigned responders:', e);
      } finally {
        setIsLoadingAssigned(false);
      }
    };

    if (selectedReport?.id) {
      loadAssignedResponders(selectedReport.id);
    } else {
      setAssignedResponders([]);
      setIsLoadingAssigned(false);
    }
  }, [selectedReport?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/get_reports`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error refreshing reports:', e);
      setReports([]);
    } finally {
      setRefreshing(false);
    }
  }, []); // Remove fetchReports dependency

  // Update report status
  const updateReportStatus = async (reportId, newStatus, reason = null) => {
    try {
      setIsUpdating(true);
      console.log('[updateReportStatus] Sending status update', { reportId, newStatus, reason });
      
      const payload = {
        report_id: reportId,
        status: newStatus
      };
      
      // Add reason and cancelled_by if status is Cancelled
      if (newStatus === 'Cancelled') {
        if (!reason || !reason.trim()) {
          Alert.alert('Error', 'Please provide a reason for cancellation.');
          setIsUpdating(false);
          return;
        }
        payload.reason = reason.trim();
        payload.cancelled_by = 'Admin User';
        payload.cancelled_by_role = 'admin';
      }
      
      console.log('[updateReportStatus] Payload being sent:', payload);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${API_URL}/update_report_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        // Update local state
        setReports(prev => prev.map(report => 
          report.id === reportId ? { ...report, status: newStatus } : report
        ));
        
        // Update editReport state if it's the same report
        if (editReport && editReport.id === reportId) {
          setEditReport(prev => ({ ...prev, status: newStatus }));
        }
        
        console.log(`Status updated for report ${reportId}: ${newStatus}`);
        Alert.alert('Success', 'Report status updated successfully.');
      } else {
        // If cancelling and primary endpoint failed, try dedicated cancel endpoint
        if (newStatus === 'Cancelled') {
          console.log('Primary endpoint failed for cancellation, trying dedicated cancel endpoint...');
          try {
            const cancelResponse = await fetch(`${API_URL}/cancel_report/${reportId}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                reason: reason,
                cancellation_reason: reason,
                cancelled_by: 'Admin User',
                cancelled_by_role: 'admin',
                cancellation_timestamp: new Date().toLocaleString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric', 
                  hour: 'numeric', 
                  minute: '2-digit' 
                }).replace('AM', 'am').replace('PM', 'pm')
              })
            });
            
            if (cancelResponse.ok) {
              // Update local state
              setReports(prev => prev.map(report => 
                report.id === reportId ? { 
                  ...report, 
                  status: newStatus,
                  cancelled_by: 'Admin User',
                  cancellation_reason: reason,
                  cancellation_timestamp: new Date().toLocaleString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  }).replace('AM', 'am').replace('PM', 'pm')
                } : report
              ));
              console.log(`Report cancelled via dedicated endpoint for report ${reportId}`);
              Alert.alert('Success', 'Report cancelled successfully.');
              // Close edit modal after successful cancellation
              setShowEditModal(false);
              return;
            } else {
              console.error('Dedicated cancel endpoint also failed:', cancelResponse.status);
            }
          } catch (cancelError) {
            console.error('Error with dedicated cancel endpoint:', cancelError);
          }
        }
        
        let errorText = '';
        try {
          const errJson = await response.clone().json();
          errorText = errJson?.error || errJson?.message || JSON.stringify(errJson);
        } catch (_) {
          try {
            errorText = await response.text();
          } catch (_) {
            errorText = `HTTP ${response.status} ${response.statusText}`;
          }
        }
        console.error('[updateReportStatus] Backend error:', response.status, response.statusText, errorText);
        Alert.alert('Error', `Failed to update status (HTTP ${response.status}).\n${errorText || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('[updateReportStatus] Network/JS error:', error);
      if (error.name === 'AbortError') {
        Alert.alert('Error', 'Request timed out. Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', `Error updating status: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Update final alarm level
  const updateFinalAlarmLevel = async (reportId, newAlarmLevel) => {
    try {
      setIsUpdating(true);
      console.log('[updateFinalAlarmLevel] Updating alarm level', { reportId, newAlarmLevel });
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${API_URL}/update_final_alarm_level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          report_id: reportId,
          final_alarm_level: newAlarmLevel
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        // Update local state
        setReports(prev => prev.map(report => 
          report.id === reportId ? { ...report, final_alarm_level: newAlarmLevel } : report
        ));
        
        // Update editReport state if it's the same report
        if (editReport && editReport.id === reportId) {
          setEditReport(prev => ({ ...prev, final_alarm_level: newAlarmLevel }));
        }
        
        console.log(`Final alarm level updated for report ${reportId}: ${newAlarmLevel}`);
        Alert.alert('Success', 'Final alarm level updated successfully.');
      } else {
        let errorText = '';
        try {
          const errJson = await response.clone().json();
          errorText = errJson?.error || errJson?.message || JSON.stringify(errJson);
        } catch (_) {
          try {
            errorText = await response.text();
          } catch (_) {
            errorText = `HTTP ${response.status} ${response.statusText}`;
          }
        }
        console.error('Failed to update final alarm level:', response.status, errorText);
        Alert.alert('Error', `Failed to update final alarm level: ${errorText || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error updating final alarm level:', error);
      if (error.name === 'AbortError') {
        Alert.alert('Error', 'Request timed out. Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', `Error updating final alarm level: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle status change
  const handleStatusChange = (reportId, newStatus) => {
    console.log('[handleStatusChange] Called with:', { reportId, newStatus });
    
    // If cancelling, show the cancel modal instead of direct update
    if (newStatus === 'Cancelled') {
      const report = reports.find(r => r.id === reportId);
      setSelectedReport(report);
      setCancelReason('');
      setShowCancelModal(true);
    } else {
      // Update status without closing modal
      updateReportStatus(reportId, newStatus);
    }
  };

  // Cancel report with reason
  const handleCancelReport = async () => {
    console.log('[handleCancelReport] cancelReport:', cancelReport);
    console.log('[handleCancelReport] cancelReason:', cancelReason);
    if (!cancelReport || !cancelReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation.');
      return;
    }

    try {
      setIsCancelling(true);
      console.log('Admin cancelling report:', cancelReport.id, 'Reason:', cancelReason);
      
      // Use the updateReportStatus function which handles the reason requirement
      await updateReportStatus(cancelReport.id, 'Cancelled', cancelReason);
      
      // Update local state with additional cancellation details
      setReports(prev => prev.map(report => 
        report.id === cancelReport.id ? { 
          ...report, 
          status: 'Cancelled',
          cancelled_by: 'Admin User',
          cancellation_reason: cancelReason,
          cancellation_timestamp: new Date().toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: 'numeric', 
            minute: '2-digit' 
          }).replace('AM', 'am').replace('PM', 'pm')
        } : report
      ));
      
      Alert.alert('Success', 'Report cancelled successfully.');
      setShowCancelModal(false);
      setCancelReason('');
      setCancelReport(null);
    } catch (error) {
      console.error('Error cancelling report:', error);
      Alert.alert('Error', `Failed to cancel report: ${error.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

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

      if (statusFilter !== 'All') {
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
    }).sort((a, b) => {
      // Sort by most recent first (descending order)
      const timestampA = a.created_at || a.timestamp || a.time;
      const timestampB = b.created_at || b.timestamp || b.time;
      
      if (!timestampA && !timestampB) return 0;
      if (!timestampA) return 1; // Put items without timestamp at the end
      if (!timestampB) return -1; // Put items without timestamp at the end
      
      try {
        const dateA = new Date(timestampA);
        const dateB = new Date(timestampB);
        
        // If either date is invalid, put it at the end
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        
        // Sort by most recent first (newest to oldest)
        return dateB.getTime() - dateA.getTime();
      } catch (error) {
        console.warn('Error sorting reports by date:', error);
        return 0;
      }
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
              {['All', 'On Going', 'Under Control'].map((s) => (
                <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginRight: 8, backgroundColor: statusFilter === s ? '#fee2e2' : '#f1f5f9' }}>
                  <Text style={{ color: statusFilter === s ? '#b91c1c' : '#334155', fontWeight: '600' }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {['week', 'month'].map((t) => (
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
        
        {/* Mobile-Friendly Report Cards */}
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#6b7280' }}>Loading reports...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>No active fire reports</Text>
          </View>
        ) : (
          filtered.slice(0, 10).map((r) => (
            <View
              key={r.id}
              style={{
                backgroundColor: 'white',
                borderRadius: 12,
                marginBottom: 12,
                shadowColor: '#000',
                shadowOpacity: 0.05,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
                position: 'relative',
              }}
            >
              {/* Content Area */}
              <View style={{ padding: 16 }}>
                {/* Header Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
                      {r.reporter || r.user_name || 'Anonymous Reporter'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6b7280' }}>
                      {(() => {
                        const timestamp = r.created_at || r.timestamp || r.time;
                        if (!timestamp) return 'Unknown time';
                        try {
                          const date = new Date(timestamp);
                          if (isNaN(date.getTime())) return 'Unknown time';
                          return date.toLocaleString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: true
                          });
                        } catch {
                          return 'Unknown time';
                        }
                      })()}
                    </Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: r.status === 'On Going' ? '#fef2f2' : r.status === 'Under Control' ? '#fef3c7' : r.status === 'Fire Out' ? '#d1fae5' : '#f3f4f6',
                  }}>
                    <Text style={{
                      color: r.status === 'On Going' ? '#dc2626' : r.status === 'Under Control' ? '#d97706' : r.status === 'Fire Out' ? '#059669' : '#6b7280',
                      fontWeight: '600',
                      fontSize: 12
                    }}>
                      {r.status || 'Unknown'}
                    </Text>
                  </View>
                </View>

                {/* Location */}
                <Text style={{ fontSize: 14, color: '#4b5563', marginBottom: 12 }} numberOfLines={2}>
                  📍 {r.address || r.geotag_location || 'No address'}
                </Text>

                {/* Alarm Levels Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Suggested Alarm:</Text>
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: '#f3f4f6',
                      alignSelf: 'flex-start'
                    }}>
                      <Text style={{
                        color: '#6b7280',
                        fontWeight: '500',
                        fontSize: 12
                      }}>
                        {r.recommended_alarm_level || r.alarm_level || 'N/A'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Final Alarm:</Text>
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: '#dbeafe',
                      alignSelf: 'flex-start'
                    }}>
                      <Text style={{
                        color: '#1d4ed8',
                        fontWeight: '600',
                        fontSize: 12
                      }}>
                        {r.final_alarm_level || '1st Alarm'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Actions Row - Positioned at bottom, outside content area */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingBottom: 16,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6'
              }}>
                {/* View Details Button */}
                <TouchableOpacity
                  onPress={() => setSelectedReport(r)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: '#3b82f6',
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    flex: 1,
                    marginRight: 8
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12, marginRight: 4 }}>👁️</Text>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: '#3b82f6',
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginRight: 8
                  }}
                  onPress={() => {
                    console.log('[Edit Button] Setting editReport to:', r);
                    setEditReport(r);
                    setShowEditModal(true);
                    console.log('[Edit Button] showEditModal set to true');
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12, marginRight: 4 }}>✏️</Text>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: '#ef4444',
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}
                  onPress={() => {
                    Alert.alert(
                      'Confirm Cancellation',
                      `Are you sure you want to cancel this report?\n\nReporter: ${r.reporter || r.user_name || 'Anonymous Reporter'}\nLocation: ${r.address || r.geotag_location || 'No address'}\n\nYou will be asked to provide a reason for cancellation.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Proceed', 
                          style: 'destructive',
                          onPress: () => {
                            setCancelReport(r);
                            setCancelReason('');
                            setShowCancelModal(true);
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12, marginRight: 4 }}>❌</Text>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity onPress={onRefresh} style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Refresh</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!selectedReport} transparent animationType="fade" onRequestClose={() => setSelectedReport(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, maxWidth: 600, width: '100%', maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: 16, paddingBottom: 12 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>Emergency Report Details</Text>
                <TouchableOpacity onPress={() => setSelectedReport(null)} style={{ padding: 6 }}>
                  <Text style={{ fontWeight: '800', color: '#334155', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {selectedReport && (
                <View style={{ paddingHorizontal: 16 }}>
                  {/* Picture */}
                  {getSafeImageUri(selectedReport.image_url) && (
                    <View style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 20, alignItems: 'center' }}>
                      <Image
                        source={{ uri: getSafeImageUri(selectedReport.image_url) }}
                        style={{ width: '100%', height: 200, borderRadius: 8 }}
                        resizeMode="cover"
                        onError={() => { /* swallow image errors */ }}
                      />
                    </View>
                  )}

                  {/* Basic Information */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Reporter:</Text>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>
                        {selectedReport.reporter || selectedReport.user_name || 'Anonymous Reporter'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Reported:</Text>
                      <Text style={{ fontSize: 16, color: '#6b7280' }}>
                        {(() => {
                          const timestamp = selectedReport.created_at || selectedReport.timestamp;
                          if (!timestamp) return 'Unknown';
                          try {
                            const date = new Date(timestamp);
                            if (isNaN(date.getTime())) return String(timestamp);
                            return date.toLocaleString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit', hour12: true
                            });
                          } catch {
                            return String(timestamp);
                          }
                        })()}
                      </Text>
                    </View>
                  </View>

                  {/* Location */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Location:</Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 }}>
                      {selectedReport.address || selectedReport.geotag_location || 'No address'}
                    </Text>
                    {selectedReport.latitude && selectedReport.longitude && (
                      <Text style={{ fontSize: 14, color: '#6b7280' }}>
                        Coordinates: {parseFloat(selectedReport.latitude).toFixed(6)}, {parseFloat(selectedReport.longitude).toFixed(6)}
                      </Text>
                    )}
                  </View>

                  {/* Cause of Fire */}
                  {selectedReport.cause_of_fire && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Cause of Fire:</Text>
                      <Text style={{ fontSize: 16, color: '#0f172a', lineHeight: 24 }}>
                        {selectedReport.cause_of_fire}
                      </Text>
                    </View>
                  )}

                  {/* AI Analysis Results */}
                  <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e40af', marginBottom: 16 }}>AI Analysis Results</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      <View style={{ width: '48%', marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>Fire Detection:</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e40af' }}>
                          {selectedReport.prediction || 'Unknown'} {selectedReport.confidence ? `(${selectedReport.confidence})` : ''}
                        </Text>
                      </View>
                      <View style={{ width: '48%', marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>Structure Type:</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e40af' }}>
                          {selectedReport.structure || 'Unknown'} {selectedReport.structure_confidence ? `(${selectedReport.structure_confidence})` : ''}
                        </Text>
                      </View>
                      <View style={{ width: '48%', marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>Smoke Intensity:</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e40af' }}>
                          {selectedReport.smoke_intensity || 'Unknown'} {selectedReport.smoke_confidence ? `(${selectedReport.smoke_confidence})` : ''}
                        </Text>
                      </View>
                      <View style={{ width: '48%', marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>Structures Affected:</Text>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e40af' }}>
                          {selectedReport.number_of_structures_on_fire || 'Not specified'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Status and Alarm Levels */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Current Status:</Text>
                      <View style={{ 
                        backgroundColor: selectedReport.status === 'On Going' ? '#fef2f2' : '#f0f9ff',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: selectedReport.status === 'On Going' ? '#fecaca' : '#bae6fd'
                      }}>
                        <Text style={{ 
                          fontSize: 16, 
                          fontWeight: '600', 
                          color: selectedReport.status === 'On Going' ? '#dc2626' : '#0369a1'
                        }}>
                          {selectedReport.status || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Alarm Level:</Text>
                      <View style={{ 
                        backgroundColor: '#fef3c7',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#fde68a'
                      }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#d97706' }}>
                          {selectedReport.recommended_alarm_level || selectedReport.alarm_level || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                  </View>


                  {/* Full Timestamp */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Full Timestamp:</Text>
                    <Text style={{ fontSize: 16, color: '#0f172a' }}>
                      {(() => {
                        const timestamp = selectedReport.created_at || selectedReport.timestamp;
                        if (!timestamp) return 'Unknown';
                        try {
                          const date = new Date(timestamp);
                          if (isNaN(date.getTime())) return String(timestamp);
                          return date.toLocaleString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                          });
                        } catch {
                          return String(timestamp);
                        }
                      })()}
                    </Text>
                  </View>

                  {/* Assigned Responder(s) */}
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Assigned Responder(s):</Text>
                    <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, padding: 12 }}>
                      {isLoadingAssigned ? (
                        <Text style={{ fontSize: 16, color: '#6b7280' }}>Loading...</Text>
                      ) : assignedResponders.length > 0 ? (
                        assignedResponders.map(r => (
                          <View key={r.id} style={{ paddingVertical: 6 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e3a8a' }}>
                              {(r.first_name || '') + (r.last_name ? ` ${r.last_name}` : '') || 'Responder'}
                            </Text>
                            {!!r.email && (
                              <Text style={{ fontSize: 12, color: '#1e40af' }}>{r.email}</Text>
                            )}
                            {!!r.phone && (
                              <Text style={{ fontSize: 12, color: '#1e40af' }}>{r.phone}</Text>
                            )}
                          </View>
                        ))
                      ) : (
                        <Text style={{ fontSize: 14, color: '#1e40af' }}>No responder assigned yet.</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
            
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => {
        console.log('[Edit Modal] onRequestClose called');
        setShowEditModal(false);
        setEditReport(null);
      }}>
        {console.log('[Edit Modal] Modal visible:', showEditModal, 'selectedReport:', selectedReport)}
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, width: '100%', maxWidth: 400, minHeight: 300 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Edit Report</Text>
              <TouchableOpacity onPress={() => {
                console.log('[Edit Modal] Close button pressed');
                setShowEditModal(false);
                setEditReport(null);
              }} style={{ padding: 4 }}>
                <Text style={{ fontWeight: '800', color: '#334155', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            
            {editReport ? (
              <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                {console.log('[Edit Modal] Rendering with editReport:', editReport.id, editReport)}
                
                {/* Test Content */}
                <View style={{ marginBottom: 20, padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Report ID:</Text>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>{editReport.id}</Text>
                </View>
                
                {/* Status Selection */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Status:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginRight: 8, marginBottom: 8 }}>
                    {['On Going', 'Under Control', 'Fire Out'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        onPress={() => {
                          console.log('[Status Button] Pressed:', status);
                          const currentStatus = editReport.status || 'Unknown';
                          if (status === 'Cancelled') {
                            // For cancellation, show the cancel modal instead
                            handleStatusChange(editReport.id, status);
                          } else {
                            // For other status changes, show confirmation
                            Alert.alert(
                              'Confirm Status Change',
                              `Are you sure you want to change the status from "${currentStatus}" to "${status}"?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { 
                                  text: 'Confirm', 
                                  style: 'default',
                                  onPress: () => handleStatusChange(editReport.id, status)
                                }
                              ]
                            );
                          }
                        }}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 6,
                          backgroundColor: editReport.status === status ? '#3b82f6' : '#f3f4f6',
                          borderWidth: 1,
                          borderColor: editReport.status === status ? '#3b82f6' : '#d1d5db'
                        }}
                        disabled={isUpdating}
                      >
                        <Text style={{
                          color: editReport.status === status ? 'white' : '#374151',
                          fontWeight: '600',
                          fontSize: 14
                        }}>
                          {status}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Final Alarm Level Selection */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Final Alarm Level:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginRight: 8, marginBottom: 8 }}>
                    {['1st Alarm', '2nd Alarm', '3rd Alarm', '4th Alarm', '5th Alarm', 'TASK FORCE ALPHA', 'TASK FORCE BRAVO', 'TASK FORCE CHARLIE', 'TASK FORCE DELTA', 'GENERAL ALARM'].map((alarm) => (
                      <TouchableOpacity
                        key={alarm}
                        onPress={() => {
                          console.log('[Alarm Button] Pressed:', alarm);
                          const currentAlarm = editReport.final_alarm_level || editReport.recommended_alarm_level || 'Unknown';
                          Alert.alert(
                            'Confirm Alarm Level Change',
                            `Are you sure you want to change the final alarm level from "${currentAlarm}" to "${alarm}"?\n\nThis action will update the emergency response level and may trigger additional resource deployment.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { 
                                text: 'Confirm', 
                                style: 'default',
                                onPress: () => updateFinalAlarmLevel(editReport.id, alarm)
                              }
                            ]
                          );
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 6,
                          backgroundColor: (editReport.final_alarm_level || editReport.recommended_alarm_level) === alarm ? '#f59e0b' : '#f3f4f6',
                          borderWidth: 1,
                          borderColor: (editReport.final_alarm_level || editReport.recommended_alarm_level) === alarm ? '#f59e0b' : '#d1d5db'
                        }}
                        disabled={isUpdating}
                      >
                        <Text style={{
                          color: (editReport.final_alarm_level || editReport.recommended_alarm_level) === alarm ? 'white' : '#374151',
                          fontWeight: '600',
                          fontSize: 12
                        }}>
                          {alarm}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {isUpdating && (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <Text style={{ color: '#6b7280', fontSize: 14 }}>Updating...</Text>
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: '#6b7280' }}>No report selected for editing</Text>
                {console.log('[Edit Modal] editReport is null or undefined')}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Cancel Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => {
        setShowCancelModal(false);
        setCancelReport(null);
        setCancelReason('');
      }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, width: '100%', maxWidth: 400 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>Cancel Report</Text>
              <TouchableOpacity onPress={() => {
                setShowCancelModal(false);
                setCancelReport(null);
                setCancelReason('');
              }} style={{ padding: 4 }}>
                <Text style={{ fontWeight: '800', color: '#334155', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Reason for Cancellation:</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  color: '#374151',
                  minHeight: 100,
                  textAlignVertical: 'top'
                }}
                placeholder="Please provide a reason for cancelling this report..."
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={4}
              />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowCancelModal(false);
                    setCancelReport(null);
                    setCancelReason('');
                  }}
                  style={{
                    backgroundColor: '#6b7280',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    flex: 1,
                    marginRight: 8
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Final Confirmation',
                      `Are you absolutely sure you want to cancel this report?\n\nReason: "${cancelReason}"\n\nThis action cannot be undone.`,
                      [
                        { text: 'Back', style: 'cancel' },
                        { 
                          text: 'Cancel Report', 
                          style: 'destructive',
                          onPress: handleCancelReport
                        }
                      ]
                    );
                  }}
                  disabled={!cancelReason.trim() || isCancelling}
                  style={{
                    backgroundColor: !cancelReason.trim() || isCancelling ? '#9ca3af' : '#ef4444',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    flex: 1,
                    marginLeft: 8
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                    {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

