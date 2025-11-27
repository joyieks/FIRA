import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, TextInput, Modal, Image, Platform, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';
import { notifyRespondersOnStatusChange, notifyRespondersOnAlarmChange, fetchReportData } from '../../../services/responderNotificationService';
import { notifyAllUsersOnStatusChange, notifyAllUsersOnAlarmChange } from '../../../services/universalNotificationService';

const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';

export default function AOverview() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All | On Going | Under Control
  const [aiChatSuggestions, setAiChatSuggestions] = useState([]);
  const [chatAlarmByReport, setChatAlarmByReport] = useState({});
  const [timeRangeFilter, setTimeRangeFilter] = useState('all'); // all | today | week | month
  const [selectedReport, setSelectedReport] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editReport, setEditReport] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReport, setCancelReport] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [stations, setStations] = useState([]);
  const [assignStationId, setAssignStationId] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignedResponders, setAssignedResponders] = useState([]);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(false);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [showAlarmConfirmModal, setShowAlarmConfirmModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [pendingAlarmChange, setPendingAlarmChange] = useState(null);
  const [assignedStationReportIds, setAssignedStationReportIds] = useState(new Set()); // Set of report_id strings with station assigned

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      // 1) Prefer Supabase table (source of truth)
      try {
        const { data: sbData, error: sbErr } = await supabase
          .from('fire_reports')
          .select('*')
          .order('created_at', { ascending: false });
        if (!sbErr && Array.isArray(sbData) && sbData.length > 0) {
          console.log('[AOverview] Supabase fire_reports rows:', sbData.length);
          setReports(sbData);
          // Load station assignments for these reports
          const ids = sbData.map(r => String(r.id));
          if (ids.length) {
            const { data: assigns } = await supabase
              .from('report_assignments')
              .select('report_id')
              .in('report_id', ids)
              .eq('assignee_type', 'station');
            setAssignedStationReportIds(new Set((assigns || []).map(a => String(a.report_id))));
          } else {
            setAssignedStationReportIds(new Set());
          }
          return;
        }
        if (sbErr) console.warn('[AOverview] Supabase fire_reports error:', sbErr?.message || sbErr);
      } catch (sbCatch) {
        console.warn('[AOverview] Supabase fire_reports catch:', sbCatch?.message || sbCatch);
      }

      // 2) Fallback to Flask API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API_URL}/get_reports`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('[AOverview] API get_reports length:', Array.isArray(data) ? data.length : 'non-array');
      if (Array.isArray(data)) {
        setReports(data);
        const ids = data.map(r => String(r.id));
        if (ids.length) {
          const { data: assigns } = await supabase
            .from('report_assignments')
            .select('report_id')
            .in('report_id', ids)
            .eq('assignee_type', 'station');
          setAssignedStationReportIds(new Set((assigns || []).map(a => String(a.report_id))));
        } else {
          setAssignedStationReportIds(new Set());
        }
      }
    } catch (e) {
      console.error('Error fetching reports:', e);
      if (e.name === 'AbortError') {
        console.error('Request timed out');
      }
      // Keep previous reports on error
    } finally {
      setLoading(false);
    }
  }, []);

  // Load AI suggestions from messages table
  useEffect(() => {
    const loadAiSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, ai_suggested_alarm, suggested_alarm_level, created_at, report_id')
          .not('ai_suggested_alarm', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200);
        if (!error) setAiChatSuggestions(data || []);
      } catch (_) {}
    };
    loadAiSuggestions();
    
    // Faster polling - every 5 seconds
    const interval = setInterval(loadAiSuggestions, 5000);
    
    // Real-time subscription for instant updates
    const subscription = supabase
      .channel('ai_suggestions_mobile_admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: 'ai_suggested_alarm=not.is.null'
      }, () => {
        console.log('🔔 Real-time: AI suggestion detected, reloading...');
        loadAiSuggestions();
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  // Compute strongest AI alarm per report
  useEffect(() => {
    const toStrength = (label) => {
      const map = {
        'Under Control': 0, '1st Alarm': 1, '2nd Alarm': 2, '3rd Alarm': 3,
        '4th Alarm': 4, '5th Alarm': 5, 'TASK FORCE ALPHA': 6,
        'TASK FORCE BRAVO': 7, 'TASK FORCE CHARLIE': 8,
        'TASK FORCE DELTA': 9, 'GENERAL ALARM': 10
      };
      return map[label] ?? 0;
    };
    
    const normalizeAiLabel = (aiValue, suggestedAlarmLevel) => {
      if (suggestedAlarmLevel && suggestedAlarmLevel !== 'NONE') {
        const normalized = suggestedAlarmLevel.toLowerCase().trim();
        const map = {
          'none': 'Under Control', 'first': '1st Alarm', 'first_alarm': '1st Alarm',
          '1st alarm': '1st Alarm', 'second': '2nd Alarm', 'second_alarm': '2nd Alarm',
          '2nd alarm': '2nd Alarm', 'third': '3rd Alarm', 'third_alarm': '3rd Alarm',
          '3rd alarm': '3rd Alarm', 'fourth': '4th Alarm', 'fourth_alarm': '4th Alarm',
          '4th alarm': '4th Alarm', 'fifth': '5th Alarm', 'fifth_alarm': '5th Alarm',
          '5th alarm': '5th Alarm', 'task_force_alpha': 'TASK FORCE ALPHA',
          'task_force_bravo': 'TASK FORCE BRAVO', 'task_force_charlie': 'TASK FORCE CHARLIE',
          'task_force_delta': 'TASK FORCE DELTA', 'general': 'GENERAL ALARM',
          'general_alarm': 'GENERAL ALARM'
        };
        return map[normalized] || suggestedAlarmLevel;
      }
      return null;
    };

    const bestByReport = {};
    (aiChatSuggestions || []).forEach((m) => {
      const reportId = m.report_id;
      if (!reportId) return;
      const label = normalizeAiLabel(m.ai_suggested_alarm, m.suggested_alarm_level);
      if (!label) return;
      const current = bestByReport[reportId];
      if (!current || toStrength(label) > toStrength(current)) {
        bestByReport[reportId] = label;
      }
    });
    setChatAlarmByReport(bestByReport);
  }, [aiChatSuggestions]);

  useEffect(() => {
    fetchReports();
  }, []); // Remove fetchReports dependency to prevent infinite re-renders

  // Removed auto-polling: rely on manual Refresh button only

  // Load stations for assignment when screen mounts
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('station_users')
          .select('id, station_name, email')
          .order('station_name', { ascending: true });
        if (!error) setStations(data || []);
      } catch (_) {}
    })();
  }, []);

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
      // Prefer Supabase, fallback to API
      try {
        const { data: sbData, error: sbErr } = await supabase
          .from('fire_reports')
          .select('*')
          .order('created_at', { ascending: false });
        if (!sbErr && Array.isArray(sbData) && sbData.length > 0) {
          setReports(sbData);
          const ids = sbData.map(r => String(r.id));
          if (ids.length) {
            const { data: assigns } = await supabase
              .from('report_assignments')
              .select('report_id')
              .in('report_id', ids)
              .eq('assignee_type', 'station');
            setAssignedStationReportIds(new Set((assigns || []).map(a => String(a.report_id))));
          } else {
            setAssignedStationReportIds(new Set());
          }
          return;
        }
      } catch (_) {}
      const res = await fetch(`${API_URL}/get_reports`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setReports(data);
        const ids = data.map(r => String(r.id));
        if (ids.length) {
          const { data: assigns } = await supabase
            .from('report_assignments')
            .select('report_id')
            .in('report_id', ids)
            .eq('assignee_type', 'station');
          setAssignedStationReportIds(new Set((assigns || []).map(a => String(a.report_id))));
        } else {
          setAssignedStationReportIds(new Set());
        }
      }
    } catch (e) {
      console.error('Error refreshing reports:', e);
      // Keep previous reports on error
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
        // Get old status before updating
        const oldStatus = reports.find(r => r.id === reportId)?.status;
        
        // Update local state
        setReports(prev => prev.map(report => 
          report.id === reportId ? { ...report, status: newStatus } : report
        ));
        
        // Update editReport state if it's the same report
        if (editReport && editReport.id === reportId) {
          setEditReport(prev => ({ ...prev, status: newStatus }));
        }
        
        console.log(`Status updated for report ${reportId}: ${newStatus}`);
        
        // Notify responders of status change
        try {
          const report = reports.find(r => r.id === reportId);
          const reportData = await fetchReportData(reportId);
          const reportForNotification = reportData || {
            ...report,
            status: newStatus,
            latitude: report?.latitude,
            longitude: report?.longitude,
            address: report?.location || report?.geotag_location
          };
          
          // Notify responders (existing service)
          await notifyRespondersOnStatusChange(
            reportId,
            newStatus,
            oldStatus,
            reportForNotification
          );
          console.log('✅ Responder notifications sent for status change');
          
          // Notify all users (admin, station, citizen)
          await notifyAllUsersOnStatusChange(
            reportId,
            newStatus,
            oldStatus,
            reportForNotification
          );
          console.log('✅ Universal notifications sent for status change');
        } catch (notifError) {
          console.error('⚠️ Error sending notifications:', notifError);
          // Don't fail the status update if notification fails
        }
        
        Alert.alert('Success', 'Report status updated successfully.');

        // If report is finished/cancelled, clear responder assignments so they can be reassigned elsewhere
        try {
          if (newStatus === 'Fire Out' || newStatus === 'Cancelled') {
            await supabase
              .from('report_assignments')
              .delete()
              .eq('report_id', String(reportId))
              .eq('assignee_type', 'responder');
          }
        } catch (_) {}
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
        // Get old alarm level BEFORE updating - check both editReport and reports
        const currentReport = editReport?.id === reportId ? editReport : reports.find(r => r.id === reportId);
        const oldAlarmLevel = currentReport?.final_alarm_level || 
                             currentReport?.recommended_alarm_level ||
                             currentReport?.alarm_level ||
                             'Unknown';
        
        console.log('[updateFinalAlarmLevel] Alarm level change:', { 
          reportId, 
          oldAlarmLevel, 
          newAlarmLevel,
          currentReport: currentReport ? 'found' : 'not found'
        });
        
        // Update local state
        setReports(prev => prev.map(report => 
          report.id === reportId ? { ...report, final_alarm_level: newAlarmLevel } : report
        ));
        
        // Update editReport state if it's the same report
        if (editReport && editReport.id === reportId) {
          setEditReport(prev => ({ ...prev, final_alarm_level: newAlarmLevel }));
        }
        
        console.log(`Final alarm level updated for report ${reportId}: ${newAlarmLevel}`);
        
        // Notify responders of alarm level change - ALWAYS notify if there's a change
        try {
          const report = currentReport || reports.find(r => r.id === reportId);
          
          // Try to fetch fresh report data from API
          let reportData = null;
          try {
            reportData = await fetchReportData(reportId);
            console.log('[updateFinalAlarmLevel] Fetched report data from API:', reportData ? 'success' : 'not found');
          } catch (fetchError) {
            console.log('[updateFinalAlarmLevel] Could not fetch from API, using local data:', fetchError.message);
          }
          
          const reportForNotification = reportData || {
            ...report,
            final_alarm_level: newAlarmLevel,
            recommended_alarm_level: newAlarmLevel,
            alarm_level: newAlarmLevel,
            latitude: report?.latitude || reportData?.latitude,
            longitude: report?.longitude || reportData?.longitude,
            address: report?.location || report?.geotag_location || reportData?.address || reportData?.geotag_location
          };
          
          console.log('[updateFinalAlarmLevel] Calling notifyRespondersOnAlarmChange with:', {
            reportId,
            newAlarmLevel,
            oldAlarmLevel,
            hasReportData: !!reportForNotification
          });
          
          // Notify responders (existing service)
          const notifResult = await notifyRespondersOnAlarmChange(
            reportId,
            newAlarmLevel,
            oldAlarmLevel,
            reportForNotification
          );
          
          if (notifResult.success) {
            console.log('✅ Responder notifications sent for alarm level change:', notifResult);
          } else {
            console.warn('⚠️ Responder notification service returned:', notifResult);
          }
          
          // Notify all users (admin, station, citizen)
          const universalResult = await notifyAllUsersOnAlarmChange(
            reportId,
            newAlarmLevel,
            oldAlarmLevel,
            reportForNotification
          );
          
          if (universalResult.success) {
            console.log('✅ Universal notifications sent for alarm level change:', universalResult);
          } else {
            console.warn('⚠️ Universal notification service returned:', universalResult);
          }
        } catch (notifError) {
          console.error('⚠️ Error sending responder notifications:', notifError);
          console.error('⚠️ Error stack:', notifError.stack);
          // Don't fail the alarm update if notification fails
        }
        
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

  // Handle status change click with custom modal
  const handleStatusChangeClick = (status) => {
    const currentStatus = editReport.status || 'Unknown';
    setPendingStatusChange({ status, currentStatus });
    setShowStatusConfirmModal(true);
  };

  // Handle alarm change click with custom modal
  const handleAlarmChangeClick = (alarm) => {
    const currentAlarm = editReport.final_alarm_level || editReport.recommended_alarm_level || 'Unknown';
    setPendingAlarmChange({ alarm, currentAlarm });
    setShowAlarmConfirmModal(true);
  };

  // Confirm status change
  const confirmStatusChange = () => {
    if (pendingStatusChange) {
      handleStatusChange(editReport.id, pendingStatusChange.status);
      setShowStatusConfirmModal(false);
      setPendingStatusChange(null);
    }
  };

  // Confirm alarm change
  const confirmAlarmChange = () => {
    if (pendingAlarmChange) {
      updateFinalAlarmLevel(editReport.id, pendingAlarmChange.alarm);
      setShowAlarmConfirmModal(false);
      setPendingAlarmChange(null);
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
    const result = reports.filter((r) => {
      const statusText = (r.status || '').toString().toLowerCase();
      // Do NOT hide any statuses by default. Only apply explicit status filter below.
      if (statusFilter !== 'All') {
        if ((r.status || '') !== statusFilter) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const location = (r.address || r.geotag_location || '').toLowerCase();
        const reporter = (r.reporter || '').toLowerCase();
        const cause = (r.cause_of_fire || '').toLowerCase();
        const structure = (r.structure || '').toLowerCase();
        if (!(location.includes(q) || reporter.includes(q) || cause.includes(q) || structure.includes(q))) return false;
      }

      // No additional status gating here when statusFilter is All

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
    // Safety: if filtering produced zero results but we actually have reports, log and return original
    if (result.length === 0 && reports.length > 0) {
      console.log('[AOverview] filter returned 0 but reports length =', reports.length, {
        statusFilter,
        timeRangeFilter,
        searchQuery
      });
    }
    return result;
  }, [reports, searchQuery, statusFilter, timeRangeFilter]);

  const stats = useMemo(() => {
    const normalizePred = (p) => {
      const s = String(p || '').toLowerCase().trim().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!s) return 'unknown';
      if (s.includes('no') && s.includes('fire')) return 'no fire';
      if (s.includes('fire')) return 'fire';
      return s;
    };
    const active = filtered.filter((r) => {
      const st = String(r.status || '').toLowerCase();
      return st.includes('on going') || st.includes('ongoing') || st.includes('under control');
    }).length;
    const fire = filtered.filter((r) => normalizePred(r.prediction) === 'fire').length;
    const noFire = filtered.filter((r) => normalizePred(r.prediction) === 'no fire').length;
    return { active, fire, noFire };
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
        contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 16 }}>Emergency Reports Overview</Text>

        <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <View style={{
            backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 0,
            shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3
          }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search reports by location, reporter, cause, or structure type..."
              placeholderTextColor="#94a3b8"
              style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a' }}
            />
          </View>

          {/* Status Filter Chips (match Stations UI) */}
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            {['All', 'On Going', 'Under Control', 'Fire Out'].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatusFilter(s)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  marginRight: 8,
                  backgroundColor: statusFilter === s ? '#fee2e2' : '#f1f5f9'
                }}
              >
                <Text style={{ color: statusFilter === s ? '#b91c1c' : '#334155', fontWeight: '600' }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ef4444' }}>{stats.active}</Text>
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

                {/* No Station Assigned badge */}
                {!assignedStationReportIds.has(String(r.id)) && (
                  <View style={{
                    backgroundColor: '#fef3c7',
                    borderWidth: 1,
                    borderColor: '#fde68a',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    alignSelf: 'flex-start',
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <MaterialIcons name="warning-amber" size={14} color="#d97706" />
                    <Text style={{ marginLeft: 6, color: '#92400e', fontWeight: '700', fontSize: 12 }}>No station assigned</Text>
                  </View>
                )}

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
                        {(() => {
                          const aiOverride = chatAlarmByReport[String(r.id)];
                          const s = aiOverride || r.recommended_alarm_level || r.alarm_level || '';
                          return s && s.toLowerCase().startsWith('unknown') ? 'Unknown' : (s || 'Unknown');
                        })()}
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

              {/* Actions Row - modern pill buttons aligned with Stations UI */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingBottom: 16,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6',
                gap: 8
              }}>
                <TouchableOpacity
                  onPress={() => setSelectedReport(r)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: '#ef4444',
                    alignItems: 'center',
                    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    console.log('[Edit Button] Setting editReport to:', r);
                    setEditReport(r);
                    setShowEditModal(true);
                    console.log('[Edit Button] showEditModal set to true');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: '#f59e0b',
                    alignItems: 'center',
                    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Confirm Cancellation',
                      `Are you sure you want to cancel this report?\n\nReporter: ${r.reporter || r.user_name || 'Anonymous Reporter'}\nLocation: ${r.address || r.geotag_location || 'No address'}\n\nYou will be asked to provide a reason for cancellation.`,
                      [
                        { text: 'Back', style: 'cancel' },
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
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: '#6b7280',
                    alignItems: 'center',
                    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
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

                  {/* Assign to Station */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Assign to Station:</Text>
                    <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden' }}>
                      <ScrollView style={{ maxHeight: 180 }}>
                        {(stations || []).map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            onPress={() => setAssignStationId(s.id)}
                            style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: assignStationId === s.id ? '#dbeafe' : 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}
                          >
                            <Text style={{ color: '#0f172a', fontWeight: assignStationId === s.id ? '700' : '500' }}>
                              {s.station_name || 'Station'}
                            </Text>
                            {s.email ? (
                              <Text style={{ color: '#6b7280', fontSize: 12 }}>{s.email}</Text>
                            ) : null}
                          </TouchableOpacity>
                        ))}
                        {(!stations || stations.length === 0) && (
                          <View style={{ padding: 12 }}>
                            <Text style={{ color: '#6b7280' }}>No stations found.</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        if (!assignStationId || !selectedReport?.id) return;
                        try {
                          setIsAssigning(true);
                          const payload = { report_id: String(selectedReport.id), assignee_type: 'station', assignee_id: assignStationId };
                          // Prefer insert; if schema enforces unique report_id, use upsert on report_id
                          const { error } = await supabase
                            .from('report_assignments')
                            .upsert(payload, { onConflict: 'report_id,assignee_type,assignee_id' });
                          if (error) throw error;
                          Alert.alert('Assigned', 'Report assigned to station successfully.');
                          // Mark this report as assigned locally for the badge
                          setAssignedStationReportIds(prev => {
                            const next = new Set(prev);
                            next.add(String(selectedReport.id));
                            return next;
                          });
                        } catch (e) {
                          Alert.alert('Error', e.message || 'Failed to assign station');
                        } finally {
                          setIsAssigning(false);
                        }
                      }}
                      disabled={!assignStationId || isAssigning}
                      style={{ marginTop: 10, backgroundColor: !assignStationId || isAssigning ? '#9ca3af' : '#ef4444', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700' }}>{isAssigning ? 'Assigning...' : 'Assign Station'}</Text>
                    </TouchableOpacity>
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

                {/* Final Alarm Level Selection */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Final Alarm Level:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginRight: 8, marginBottom: 8, gap: 8 }}>
                    {['1st Alarm', '2nd Alarm', '3rd Alarm', '4th Alarm', '5th Alarm', 'TASK FORCE ALPHA', 'TASK FORCE BRAVO', 'TASK FORCE CHARLIE', 'TASK FORCE DELTA', 'GENERAL ALARM'].map((alarm) => (
                      <TouchableOpacity
                        key={alarm}
                        onPress={() => {
                          console.log('[Alarm Button] Pressed:', alarm);
                          handleAlarmChangeClick(alarm);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 6,
                          backgroundColor: (editReport.final_alarm_level || editReport.recommended_alarm_level) === alarm ? '#f59e0b' : '#f3f4f6',
                          borderWidth: 1,
                          borderColor: (editReport.final_alarm_level || editReport.recommended_alarm_level) === alarm ? '#f59e0b' : '#d1d5db',
                          marginRight: 8,
                          marginBottom: 8
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

      {/* Custom Status Change Confirmation Modal */}
      <Modal visible={showStatusConfirmModal} transparent animationType="fade" onRequestClose={() => setShowStatusConfirmModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, width: '85%', maxWidth: 400 }}>
            {/* Icon */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, color: 'white' }}>⚠️</Text>
              </View>
            </View>
            
            {/* Title */}
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginBottom: 8 }}>
              Confirm Status Change
            </Text>
            
            {/* Message */}
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Are you sure you want to change the status from{' '}
              <Text style={{ fontWeight: '600', color: '#374151' }}>"{pendingStatusChange?.currentStatus}"</Text> to{' '}
              <Text style={{ fontWeight: '600', color: '#3b82f6' }}>"{pendingStatusChange?.status}"</Text>?
            </Text>
            
            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#f3f4f6',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={() => setShowStatusConfirmModal(false)}
              >
                <Text style={{ color: '#374151', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#3b82f6',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={confirmStatusChange}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Alarm Level Change Confirmation Modal */}
      <Modal visible={showAlarmConfirmModal} transparent animationType="fade" onRequestClose={() => setShowAlarmConfirmModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, width: '85%', maxWidth: 400 }}>
            {/* Icon */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, color: 'white' }}>🚨</Text>
              </View>
            </View>
            
            {/* Title */}
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginBottom: 8 }}>
              Confirm Alarm Level Change
            </Text>
            
            {/* Message */}
            <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Are you sure you want to change the final alarm level from{' '}
              <Text style={{ fontWeight: '600', color: '#374151' }}>"{pendingAlarmChange?.currentAlarm}"</Text> to{' '}
              <Text style={{ fontWeight: '600', color: '#f59e0b' }}>"{pendingAlarmChange?.alarm}"</Text>?
            </Text>
            
            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#f3f4f6',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={() => setShowAlarmConfirmModal(false)}
              >
                <Text style={{ color: '#374151', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#f59e0b',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center'
                }}
                onPress={confirmAlarmChange}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

