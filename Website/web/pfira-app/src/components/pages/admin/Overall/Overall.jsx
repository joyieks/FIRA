                                          import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../config/supabase';
import { FiSearch, FiFilter, FiClock, FiMapPin, FiUser, FiAlertTriangle, FiBell, FiTrendingUp, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const Overview = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reports, setReports] = useState([]);
  const [generalAlarmStates, setGeneralAlarmStates] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [editingFinalAlarm, setEditingFinalAlarm] = useState({});
  const [aiChatSuggestions, setAiChatSuggestions] = useState([]);
  const [chatAlarmByReport, setChatAlarmByReport] = useState({});
  const [assignedResponders, setAssignedResponders] = useState([]);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState(false);
  const [stationAssignments, setStationAssignments] = useState({}); // reportId -> station info
  
  // Admin cancellation states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [reportToCancel, setReportToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Alarm level change confirmation states
  const [showAlarmConfirm, setShowAlarmConfirm] = useState(false);
  const [alarmChangeData, setAlarmChangeData] = useState(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [alarmLevelFilter, setAlarmLevelFilter] = useState('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState('all');

  // API endpoint for fetching reports
  const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';

  // Fetch reports from Railway API
  const fetchReports = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching reports from Railway API...');
      
      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Fetch from Railway API
      const response = await fetch(`${API_URL}/get_reports`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error('Railway API error:', response.status, response.statusText);
        setReports([]);
        setIsLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('Railway API data received:', data);
      console.log('Total reports received:', data?.length || 0);
      
      if (!data || data.length === 0) {
        console.log('No reports found from Railway API');
        setReports([]);
        setLastRefresh(new Date());
        setIsLoading(false);
        return;
      }
      
      // Transform Railway API data to match the expected format
      const transformedReports = data.map(report => {
        const aiOverride = chatAlarmByReport[String(report.id)];
        const suggested = aiOverride || report.recommended_alarm_level || report.alarm_level || determineSuggestedAlarm(report.number_of_structures_on_fire);
        return {
        id: report.id,
        time: formatTime(report.formatted_timestamp || report.created_at || report.timestamp),
        reporter: report.reporter || 'Unknown Reporter',
        location: report.address || report.geotag_location || 'Location unavailable',
        status: report.status || determineStatus(report.prediction),
        suggestedAlarmLevel: suggested,
        finalAlarmLevel: report.final_fire_alarm_level || '1st Alarm',
        description: report.cause_of_fire || 'No cause specified',
        picture: report.image_url,
        minutesAgo: calculateMinutesAgo(report.created_at || report.timestamp),
        // Additional fields
        prediction: report.prediction,
        confidence: report.confidence,
        structure: report.structure,
        smokeIntensity: report.smoke_intensity,
        smokeConfidence: report.smoke_confidence,
        numberOfStructures: cleanStructuresValue(report.number_of_structures_on_fire),
        reporterId: report.reporterId,
        timestamp: report.created_at || report.timestamp,
        // Location data
        latitude: report.latitude,
        longitude: report.longitude,
        address: report.address,
        geotag_location: report.geotag_location,
        // Cancellation info
        cancelled_by: report.cancelled_by,
        cancellation_reason: report.cancellation_reason
      };
      });
      
      console.log('Transformed reports:', transformedReports);
      setReports(transformedReports);
      setLastRefresh(new Date());
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Request timeout: Railway API took too long to respond');
      } else {
        console.error('Error loading reports:', error);
      }
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };  

  // Format timestamp to readable time
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      // Handle formatted_timestamp from API (already formatted)
      if (typeof timestamp === 'string' && !timestamp.includes('T') && !timestamp.includes('Z')) {
        return timestamp;
      }
      // Handle ISO timestamps
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (e) {
      return 'Unknown';
    }
  };

  // Calculate minutes ago
  const calculateMinutesAgo = (timestamp) => {
    if (!timestamp) return 0;
    try {
      // Handle both ISO timestamps and formatted timestamps
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 0;
      const now = new Date();
      const diffMs = now - date;
      return Math.floor(diffMs / (1000 * 60));
    } catch (e) {
      return 0;
    }
  };

  // Determine status based on prediction
  const determineStatus = (prediction) => {
    if (!prediction) return 'Unknown';
    switch ((prediction || '').toLowerCase()) {
      case 'fire': return 'On Going';
      case 'no fire': return 'Under Control';
      default: return 'Unknown';
    }
  };

  // Helper function to clean up "Unknown - count not provided" text
  const cleanStructuresValue = (value) => {
    if (!value) return null;
    const str = String(value);
    // Check if it contains "count not provided" or similar patterns
    if (str.toLowerCase().includes('count not provided') || 
        str.toLowerCase().includes('not provided') ||
        str.toLowerCase().includes('unknown -')) {
      return null; // Return null so it displays as "Unknown"
    }
    // If it's a valid number, return it
    const num = Number(value);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
    return null;
  };

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
    if (!numStructures || numStructures === 0) return '1st Alarm';
    if (numStructures >= 80) return 'GENERAL ALARM';
    if (numStructures >= 36) return 'TASK FORCE DELTA';
    if (numStructures >= 32) return 'TASK FORCE CHARLIE';
    if (numStructures >= 28) return 'TASK FORCE BRAVO';
    if (numStructures >= 24) return 'TASK FORCE ALPHA';
    if (numStructures >= 20) return '5th Alarm';
    if (numStructures >= 16) return '4th Alarm';
    if (numStructures >= 12) return '3rd Alarm';
    if (numStructures >= 8) return '2nd Alarm';
    if (numStructures >= 4) return '1st Alarm';
    return 'Under Control';
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchReports(); // Initial fetch
    
    const interval = setInterval(() => {
      fetchReports();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Fetch station assignments for all reports
  useEffect(() => {
    const fetchStationAssignments = async () => {
      if (!reports || reports.length === 0) return;
      
      try {
        const reportIds = reports.map(r => String(r.id));
        
        // Fetch all station assignments for these reports
        const { data: assignments, error } = await supabase
          .from('report_assignments')
          .select('report_id, assignee_id, assignee_type, assigned_at')
          .in('report_id', reportIds)
          .eq('assignee_type', 'station');
        
        if (error) {
          console.error('Error fetching station assignments:', error);
          return;
        }
        
        // Fetch station details for assigned station IDs
        const stationIds = [...new Set((assignments || []).map(a => a.assignee_id))];
        if (stationIds.length === 0) {
          setStationAssignments({});
          return;
        }
        
        const { data: stations, error: stationErr } = await supabase
          .from('station_users')
          .select('id, station_name')
          .in('id', stationIds);
        
        if (stationErr) {
          console.error('Error fetching station details:', stationErr);
          return;
        }
        
        // Create a map of station ID to station name
        const stationMap = new Map(stations?.map(s => [s.id, s.station_name]) || []);
        
        // Create assignment map: reportId -> station info
        const assignmentMap = {};
        (assignments || []).forEach(a => {
          assignmentMap[String(a.report_id)] = {
            stationId: a.assignee_id,
            stationName: stationMap.get(a.assignee_id) || 'Unknown Station',
            assignedAt: a.assigned_at
          };
        });
        
        setStationAssignments(assignmentMap);
      } catch (err) {
        console.error('Error in fetchStationAssignments:', err);
      }
    };
    
    fetchStationAssignments();
  }, [reports]);

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
          console.error('Web: error fetching report assignments:', error);
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
          console.error('Web: error fetching responder profiles:', respErr);
          setAssignedResponders([]);
          return;
        }

        setAssignedResponders(responders || []);
      } catch (e) {
        console.error('Web: failed loading assigned responders:', e);
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

  // Load recent AI suggestions from chat messages
  // Optimized: Only query messages that have a report_id (fire report context)
  useEffect(() => {
    const loadAiSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, text, ai_suggested_alarm, suggested_alarm_level, created_at, sender_type, report_id')
          .not('ai_suggested_alarm', 'is', null)
          .not('report_id', 'is', null)  // Only get messages linked to fire reports
          .order('created_at', { ascending: false })
          .limit(300);  // Increased to ensure we get all recent messages
        
        if (!error) {
          setAiChatSuggestions(data || []);
        }
      } catch (err) {
        console.error('Error loading AI suggestions:', err);
        // ignore; UI degrades gracefully
      }
    };
    loadAiSuggestions();
    
    // Fast polling - every 2 seconds for real-time operations
    const interval = setInterval(loadAiSuggestions, 2000);
    
    // Real-time subscription for instant updates - only report-linked messages
    const subscription = supabase
      .channel('ai_suggestions_admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: 'ai_suggested_alarm=not.is.null'
      }, (payload) => {
        // Only reload if the message has a report_id
        if (payload.new?.report_id) {
          console.log('🔔 Real-time: Report-linked AI suggestion detected, reloading...');
          loadAiSuggestions();
        }
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  // Compute strongest chat-based alarm per report_id
  useEffect(() => {
    const toStrength = (label) => {
      const map = {
        'Under Control': 0,
        '1st Alarm': 1,
        '2nd Alarm': 2,
        '3rd Alarm': 3,
        '4th Alarm': 4,
        '5th Alarm': 5,
        'TASK FORCE ALPHA': 6,
        'TASK FORCE BRAVO': 7,
        'TASK FORCE CHARLIE': 8,
        'TASK FORCE DELTA': 9,
        'GENERAL ALARM': 10
      };
      return map[label] ?? 0;
    };
    const normalizeAiLabelLocal = (aiValue, suggestedAlarmLevel) => {
      // Priority 1: Use suggested_alarm_level field directly if available
      if (suggestedAlarmLevel && suggestedAlarmLevel !== 'NONE') {
        // Normalize the suggested_alarm_level value
        const normalized = suggestedAlarmLevel.toLowerCase().trim();
        const map = {
          'none': 'Under Control',
          'first': '1st Alarm', 'first_alarm': '1st Alarm', '1st alarm': '1st Alarm',
          'second': '2nd Alarm', 'second_alarm': '2nd Alarm', '2nd alarm': '2nd Alarm',
          'third': '3rd Alarm', 'third_alarm': '3rd Alarm', '3rd alarm': '3rd Alarm',
          'fourth': '4th Alarm', 'fourth_alarm': '4th Alarm', '4th alarm': '4th Alarm',
          'fifth': '5th Alarm', 'fifth_alarm': '5th Alarm', '5th alarm': '5th Alarm',
          'task_force_alpha': 'TASK FORCE ALPHA',
          'task_force_bravo': 'TASK FORCE BRAVO',
          'task_force_charlie': 'TASK FORCE CHARLIE',
          'task_force_delta_echo_hotel_india': 'TASK FORCE DELTA',
          'task_force_delta': 'TASK FORCE DELTA',
          'general': 'GENERAL ALARM', 'general_alarm': 'GENERAL ALARM'
        };
        return map[normalized] || suggestedAlarmLevel;
      }
      
      if (!aiValue) return null;
      let suggested = null;
      if (typeof aiValue === 'string') {
        const trimmed = aiValue.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try { return normalizeAiLabelLocal(JSON.parse(trimmed), suggestedAlarmLevel); } catch (_) {}
        }
        suggested = aiValue;
      } else if (aiValue?.suggested_alarm) {
        suggested = aiValue.suggested_alarm;
      } else if (aiValue?.original_response?.alarm_level) {
        suggested = aiValue.original_response.alarm_level.toLowerCase().replace(/\s+/g, '_');
      }
      if (!suggested) return null;
      const map = {
        none: 'Under Control',
        first: '1st Alarm', first_alarm: '1st Alarm',
        second: '2nd Alarm', second_alarm: '2nd Alarm',
        third: '3rd Alarm', third_alarm: '3rd Alarm',
        fourth: '4th Alarm', fourth_alarm: '4th Alarm',
        fifth: '5th Alarm', fifth_alarm: '5th Alarm',
        task_force_alpha: 'TASK FORCE ALPHA',
        task_force_bravo: 'TASK FORCE BRAVO',
        task_force_charlie: 'TASK FORCE CHARLIE',
        task_force_delta_echo_hotel_india: 'TASK FORCE DELTA',
        general: 'GENERAL ALARM'
      };
      return map[suggested] || suggested;
    };

    // Use MOST RECENT suggestion per report (not strongest) to match real-time chat context
    const bestByReport = {};
    const messageTimestamps = {};
    (aiChatSuggestions || []).forEach((m) => {
      const reportId = m.report_id;
      if (!reportId) return;
      const reportIdStr = String(reportId);
      const label = normalizeAiLabelLocal(m.ai_suggested_alarm, m.suggested_alarm_level);
      if (!label) return;
      
      const currentTimestamp = messageTimestamps[reportIdStr];
      const newTimestamp = new Date(m.created_at).getTime();
      
      // Keep the most recent message (highest timestamp)
      if (!currentTimestamp || newTimestamp > currentTimestamp) {
        bestByReport[reportIdStr] = label;
        messageTimestamps[reportIdStr] = newTimestamp;
      }
    });
    setChatAlarmByReport(bestByReport);
  }, [aiChatSuggestions]);

  // When AI overrides change, update suggestedAlarmLevel in current list
  useEffect(() => {
    if (!reports || reports.length === 0) return;
    
    setReports(prev => prev.map(r => ({
      ...r,
      suggestedAlarmLevel: chatAlarmByReport[String(r.id)] || r.suggestedAlarmLevel
    })));
  }, [chatAlarmByReport]);

  // Normalize AI labels across variants
  const normalizeAiLabel = (aiValue) => {
    if (!aiValue) return null;
    let suggested = null;
    if (typeof aiValue === 'string') {
      const trimmed = aiValue.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try { return normalizeAiLabel(JSON.parse(trimmed)); } catch (_) {}
      }
      suggested = aiValue;
    } else if (aiValue?.suggested_alarm) {
      suggested = aiValue.suggested_alarm;
    } else if (aiValue?.original_response?.alarm_level) {
      suggested = aiValue.original_response.alarm_level.toLowerCase().replace(/\s+/g, '_');
    }
    if (!suggested) return null;
    const map = {
      none: 'Under Control',
      first: '1st Alarm', 'first_alarm': '1st Alarm',
      second: '2nd Alarm', 'second_alarm': '2nd Alarm',
      third: '3rd Alarm', 'third_alarm': '3rd Alarm',
      fourth: '4th Alarm', 'fourth_alarm': '4th Alarm',
      fifth: '5th Alarm', 'fifth_alarm': '5th Alarm',
      task_force_alpha: 'TASK FORCE ALPHA',
      task_force_bravo: 'TASK FORCE BRAVO',
      task_force_charlie: 'TASK FORCE CHARLIE',
      task_force_delta_echo_hotel_india: 'TASK FORCE DELTA',
      general: 'GENERAL ALARM'
    };
    return map[suggested] || suggested;
  };

  // Filter reports based on search and filters
  const filteredReports = reports.filter(report => {
    // Search filter
    const matchesSearch = report.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.reporter.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.structure?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;

    // Alarm level filter
    const matchesAlarmLevel = alarmLevelFilter === 'all' || 
                             report.suggestedAlarmLevel === alarmLevelFilter ||
                             report.finalAlarmLevel === alarmLevelFilter;

    // Time range filter
    const matchesTimeRange = (() => {
      if (timeRangeFilter === 'all') return true;
      
      const reportDate = new Date(report.timestamp || report.created_at || 0);
      const now = new Date();
      
      switch (timeRangeFilter) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return reportDate >= today;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return reportDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return reportDate >= monthAgo;
        default:
          return true;
      }
    })();

    return matchesSearch && matchesStatus && matchesAlarmLevel && matchesTimeRange;
  }).sort((a, b) => {
    // Sort reports from most recent to oldest
    const dateA = new Date(a.timestamp || 0);
    const dateB = new Date(b.timestamp || 0);
    return dateB - dateA; // Descending order (newest first)
  });

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  // Handle map redirection with report selection
  const handleMapRedirect = (report) => {
    // Check if report is cancelled or fire out - don't redirect if so
    const status = (report.status || '').toString().toLowerCase();
    const isCancelled = status.includes('cancelled') || status.includes('canceled');
    const isFireOut = status.includes('fire out');
    
    if (isCancelled || isFireOut) {
      // Show a message explaining why redirection is not available
      alert('This report cannot be viewed on the map because it has been cancelled or the fire is out.');
      return;
    }
    
    // Store the selected report ID in localStorage for the map to pick up
    localStorage.setItem('selectedReportId', report.id);
    // Navigate to the map dashboard
    navigate('/admin-dashboard');
  };

  const handleGeneralAlarm = (reportId) => {
    setGeneralAlarmStates(prev => ({
      ...prev,
      [reportId]: !prev[reportId]
    }));
    
    const isActive = !generalAlarmStates[reportId];
    if (isActive) {
      alert(`GENERAL ALARM ACTIVATED for Report ${reportId}! Emergency units alerted.`);
    } else {
      alert(`GENERAL ALARM DEACTIVATED for Report ${reportId}.`);
    }
  };

  const handleManualRefresh = () => {
    fetchReports();
  };

  // Update status in database
  const updateReportStatus = async (reportId, newStatus, reason = null) => {
    try {
      console.log('[updateReportStatus] Sending status update', { reportId, newStatus, reason, url: `${API_URL}/update_report_status` });
      
      const payload = {
        report_id: reportId,
        status: newStatus
      };
      
      // Add reason and cancelled_by if status is Cancelled
      if (newStatus === 'Cancelled') {
        if (!reason || !reason.trim()) {
          alert('Please provide a reason for cancellation.');
          return;
        }
        payload.reason = reason.trim();
        payload.cancelled_by = 'Admin User';
        payload.cancelled_by_role = 'admin';
      }
      
      console.log('[updateReportStatus] Payload being sent:', payload);
      
      const response = await fetch(`${API_URL}/update_report_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        // Update local state
        setReports(prev => prev.map(report => 
          report.id === reportId ? { ...report, status: newStatus } : report
        ));
        console.log(`Status updated for report ${reportId}: ${newStatus}`);

        // If report is completed/cancelled, release responder assignments for reuse
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
          // Try to parse JSON error first
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
        alert(`Failed to update status (HTTP ${response.status}).\n${errorText || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('[updateReportStatus] Network/JS error:', error);
      alert(`Error updating status: ${error?.message || 'Unknown error'}`);
    }
  };

  // Update final alarm level in database
  const updateFinalAlarmLevel = async (reportId, newAlarmLevel) => {
    try {
      const response = await fetch(`${API_URL}/update_final_alarm_level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_id: reportId,
          final_alarm_level: newAlarmLevel
        })
      });
      
      if (response.ok) {
        // Update local state
        setReports(prev => prev.map(report => 
          report.id === reportId ? { ...report, finalAlarmLevel: newAlarmLevel } : report
        ));
        console.log(`Final alarm level updated for report ${reportId}: ${newAlarmLevel}`);
        
        // Notify assigned responders about the alarm level change
        try {
          console.log('🔔 Notifying responders about alarm level change...');
          
          // Get all responders assigned to this report
          const { data: assignedNotifications, error } = await supabase
            .from('responder_notifications')
            .select('id, responder_id, fire_report_id, status')
            .eq('fire_report_id', String(reportId))
            .in('status', ['pending', 'accepted', 'completed']);
          
          if (error) {
            console.error('❌ Error fetching assigned responders:', error);
          } else if (assignedNotifications && assignedNotifications.length > 0) {
            console.log(`📋 Found ${assignedNotifications.length} responder(s) to notify`);
            
            // Update each responder's notification with alarm level change info
            const updatePromises = assignedNotifications.map(notification => {
              return supabase
                .from('responder_notifications')
                .update({
                  title: `⚠️ Alarm Level Changed: ${newAlarmLevel}`,
                  message: `The fire alarm level has been updated to ${newAlarmLevel}.\n\nPlease adjust your response accordingly. This may require additional resources or personnel.`,
                  priority: 'urgent', // High priority for alarm level changes
                  is_read: false // Mark as unread so responder sees the update
                })
                .eq('id', notification.id);
            });
            
            const results = await Promise.all(updatePromises);
            const updateError = results.find(r => r.error)?.error;
            
            if (updateError) {
              console.error('❌ Error updating responder notifications:', updateError);
            } else {
              console.log(`✅ Notified ${assignedNotifications.length} responder(s) about alarm level change to ${newAlarmLevel}`);
            }
          } else {
            console.log('ℹ️ No responders assigned to this report');
          }
        } catch (notifError) {
          console.error('❌ Error notifying responders:', notifError);
        }
        
        // Notify assigned stations about the alarm level change
        try {
          console.log('🔔 Notifying stations about alarm level change...');
          console.log('🔍 Looking for stations assigned to report ID:', reportId);
          
          // Get station assigned to this report
          const { data: stationAssignments, error: stationError } = await supabase
            .from('report_assignments')
            .select('assignee_id')
            .eq('report_id', reportId)
            .eq('assignee_type', 'station');
          
          console.log('📊 Query result:', { stationAssignments, stationError });
          
          if (stationError) {
            console.error('❌ Error fetching assigned stations:', stationError);
          } else if (stationAssignments && stationAssignments.length > 0) {
            console.log(`📋 Found ${stationAssignments.length} station(s) to notify`);
            console.log('📋 Station IDs:', stationAssignments.map(s => s.assignee_id));
            
            // Get report details for the notification
            const report = reports.find(r => r.id === reportId);
            const locationInfo = report?.location || 'Location unavailable';
            const reporterName = report?.reporter || 'Unknown Reporter';
            
            console.log('📝 Creating notifications with data:', {
              newAlarmLevel,
              locationInfo,
              reporterName
            });
            
            // Create notification for each assigned station
            const notificationPromises = stationAssignments.map(assignment => {
              const notificationData = {
                user_id: assignment.assignee_id,
                user_type: 'station',
                type: 'fire_alert',
                related_report_id: String(reportId),
                title: `🚨 Fire Incident - ${newAlarmLevel}`,
                message: `ALARM LEVEL CHANGED\n\nThe fire incident at ${locationInfo} has been escalated to ${newAlarmLevel}.\n\nReporter: ${reporterName}\n\nPlease adjust your response accordingly. Additional resources may be required.`,
                priority: 'urgent',
                is_read: false
              };
              console.log('💾 Inserting notification:', notificationData);
              return supabase
                .from('notifications')
                .insert(notificationData);
            });
            
            const notifResults = await Promise.all(notificationPromises);
            console.log('📤 Insert results:', notifResults);
            
            const notifError = notifResults.find(r => r.error)?.error;
            
            if (notifError) {
              console.error('❌ Error creating station notifications:', notifError);
            } else {
              console.log(`✅ Notified ${stationAssignments.length} station(s) about alarm level change to ${newAlarmLevel}`);
            }
          } else {
            console.log('ℹ️ No stations assigned to this report');
            console.log('💡 Make sure the report is assigned to a station first');
          }
        } catch (stationNotifError) {
          console.error('❌ Error notifying stations:', stationNotifError);
        }
        
        // Create admin notification for alarm level change
        try {
          console.log('🔔 Creating admin notification for alarm level change...');
          
          // Get current admin user
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user?.id) {
            const report = reports.find(r => r.id === reportId);
            const locationInfo = report?.location || 'Location unavailable';
            
            // First, verify what user_type values are allowed
            const { error: adminNotifError } = await supabase
              .from('notifications')
              .insert({
                user_id: user.id,
                user_type: 'admin',
                type: 'fire_alert',
                related_report_id: String(reportId),
                title: `🚨 Alarm Level Updated - ${newAlarmLevel}`,
                message: `You have updated the alarm level to ${newAlarmLevel} for the fire incident at ${locationInfo}.`,
                priority: 'urgent',
                is_read: false
              });
            
            if (adminNotifError) {
              console.error('❌ Error creating admin notification:', adminNotifError);
              console.error('❌ Full error details:', JSON.stringify(adminNotifError, null, 2));
            } else {
              console.log('✅ Admin notification created for alarm level change');
            }
          }
        } catch (adminNotifError) {
          console.error('❌ Error creating admin notification:', adminNotifError);
        }
        
      } else {
        console.error('Failed to update final alarm level');
        alert('Failed to update final alarm level. Please try again.');
      }
    } catch (error) {
      console.error('Error updating final alarm level:', error);
      alert('Error updating final alarm level. Please try again.');
    }
  };

  // Handle final alarm level change with confirmation
  const handleFinalAlarmChange = (reportId, newAlarmLevel) => {
    const currentReport = reports.find(r => r.id === reportId);
    const currentAlarmLevel = currentReport?.finalAlarmLevel || 'Unknown';
    
    // Show custom confirmation modal
    setAlarmChangeData({
      reportId,
      newAlarmLevel,
      currentAlarmLevel,
      location: currentReport?.location || 'Location unavailable',
      reportIdShort: reportId.toString().substring(0, 8)
    });
    setShowAlarmConfirm(true);
  };
  
  // Confirm alarm level change
  const confirmAlarmChange = () => {
    if (alarmChangeData) {
      setEditingFinalAlarm(prev => ({ ...prev, [alarmChangeData.reportId]: false }));
      updateFinalAlarmLevel(alarmChangeData.reportId, alarmChangeData.newAlarmLevel);
      setShowAlarmConfirm(false);
      setAlarmChangeData(null);
    }
  };
  
  // Cancel alarm level change
  const cancelAlarmChange = () => {
    if (alarmChangeData) {
      setEditingFinalAlarm(prev => ({ ...prev, [alarmChangeData.reportId]: false }));
      setShowAlarmConfirm(false);
      setAlarmChangeData(null);
    }
  };

  // Cancel report with reason
  const cancelReport = async () => {
    if (!reportToCancel || !cancelReason.trim()) {
      alert('Please provide a reason for cancellation.');
      return;
    }

    try {
      setIsCancelling(true);
      console.log('Admin cancelling report:', reportToCancel.id, 'Reason:', cancelReason);
      
      // Use the updateReportStatus function which handles the reason requirement
      await updateReportStatus(reportToCancel.id, 'Cancelled', cancelReason);
      
      // Update local state with additional cancellation details
      setReports(prev => prev.map(report => 
        report.id === reportToCancel.id ? { 
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
      
      alert('Report cancelled successfully.');
      setShowCancelModal(false);
      setCancelReason('');
      setReportToCancel(null);
    } catch (error) {
      console.error('Error cancelling report:', error);
      alert(`Failed to cancel report: ${error.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'On Going': return 'bg-red-100 text-red-800 border-red-200';
      case 'Under Control': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Fire Out': return 'bg-green-100 text-green-800 border-green-200';
      case 'Cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAlarmLevelColor = (level) => {
    switch (level) {
      case '1st Alarm': return 'bg-blue-100 text-blue-800 border-blue-200';
      case '2nd Alarm': return 'bg-orange-100 text-orange-800 border-orange-200';
      case '3rd Alarm': return 'bg-red-100 text-red-800 border-red-200';
      case '4th Alarm': return 'bg-purple-100 text-purple-800 border-purple-200';
      case '5th Alarm': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'TASK FORCE': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'General Alarm': return 'bg-red-600 text-white border-red-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4" onClick={() => {}}>
      <div className="w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Emergency Reports Overview</h1>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Search report by location, reporter, cause, or structure type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-3 px-8 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-lg"
            >
              <FiFilter className="w-6 h-6" />
              <span>FILTERS</span>
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="On Going">On Going</option>
                    <option value="Under Control">Under Control</option>
                    <option value="Fire Out">Fire Out</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Fire Alarm Level</label>
                  <select 
                    value={alarmLevelFilter}
                    onChange={(e) => setAlarmLevelFilter(e.target.value)}
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="all">All Levels</option>
                    <option value="1st Alarm">1st Alarm</option>
                    <option value="2nd Alarm">2nd Alarm</option>
                    <option value="3rd Alarm">3rd Alarm</option>
                    <option value="4th Alarm">4th Alarm</option>
                    <option value="5th Alarm">5th Alarm</option>
                    <option value="TASK FORCE ALPHA">TASK FORCE ALPHA</option>
                    <option value="TASK FORCE BRAVO">TASK FORCE BRAVO</option>
                    <option value="TASK FORCE CHARLIE">TASK FORCE CHARLIE</option>
                    <option value="TASK FORCE DELTA">TASK FORCE DELTA</option>
                    <option value="GENERAL ALARM">GENERAL ALARM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Time Range</label>
                  <select 
                    value={timeRangeFilter}
                    onChange={(e) => setTimeRangeFilter(e.target.value)}
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="all">All Times</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setAlarmLevelFilter('all');
                      setTimeRangeFilter('all');
                    }}
                    className="w-full px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-lg font-medium"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-xl shadow-sm p-8 mb-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading reports...</p>
          </div>
        )}

        {/* Reports Table */}
        {!isLoading && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w[X]1200px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Time</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Reporter</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Location</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Status</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Fire Alarm Level</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Suggested Fire Alarm</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        {searchQuery ? 'No reports match your search criteria' : 'No reports available'}
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((report) => {
                      // Check if report is cancelled or fire out
                      const status = (report.status || '').toString().toLowerCase();
                      const isCancelled = status.includes('cancelled') || status.includes('canceled');
                      const isFireOut = status.includes('fire out');
                      const isMapClickable = !isCancelled && !isFireOut;
                      
                      return (
                        <tr 
                          key={report.id} 
                          className={`transition-all duration-200 group ${
                            isMapClickable 
                              ? 'hover:bg-blue-50 hover:shadow-md cursor-pointer' 
                              : 'hover:bg-gray-50 cursor-default'
                          }`}
                          onClick={() => isMapClickable ? handleMapRedirect(report) : null}
                          title={isMapClickable ? "Click to view on map" : "Report not available on map (cancelled or fire out)"}
                        >
                        <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium transition-colors ${
                          isMapClickable 
                            ? 'text-gray-900 group-hover:text-blue-600' 
                            : 'text-gray-500'
                        }`}>
                          <div className="flex items-center space-x-2">
                            <span>{report.time}</span>
                            {isMapClickable && (
                              <FiMapPin className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" size={14} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.reporter}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {report.location}
                        </td>
                        {/* Status column - View only for Admins (only Stations can change status) */}
                        <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            <span 
                              className={`px-3 py-1 rounded-md text-xs font-medium border ${report.status === 'Cancelled' ? 'opacity-70' : ''} ${getStatusColor(report.status)}`}
                              title="Status can only be changed by Station users"
                            >
                              {report.status}
                              {report.status === 'Cancelled' && report?.cancelled_by && (
                                <span className="ml-1 text-xs opacity-75">
                                  ({report.cancelled_by === 'Admin User' || report.cancelled_by === 'admin' || report.cancelled_by === 'Admin' ? 'by admin' : 'by citizen'})
                                </span>
                              )}
                            </span>
                            {/* Show "NO STATION ASSIGNED YET" badge if no station is assigned */}
                            {!stationAssignments[String(report.id)] && (
                              <span className="px-2 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded text-xs font-semibold text-center animate-pulse">
                                ⚠️ NO STATION ASSIGNED
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {editingFinalAlarm[report.id] ? (
                            <select
                              value={report.finalAlarmLevel}
                              onChange={(e) => handleFinalAlarmChange(report.id, e.target.value)}
                              onBlur={() => setEditingFinalAlarm(prev => ({ ...prev, [report.id]: false }))}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                              disabled={report.status === 'Cancelled'}
                            >
                              <option value="1st Alarm">1st Alarm</option>
                              <option value="2nd Alarm">2nd Alarm</option>
                              <option value="3rd Alarm">3rd Alarm</option>
                              <option value="4th Alarm">4th Alarm</option>
                              <option value="5th Alarm">5th Alarm</option>
                              <option value="TASK FORCE ALPHA">TASK FORCE ALPHA</option>
                              <option value="TASK FORCE BRAVO">TASK FORCE BRAVO</option>
                              <option value="TASK FORCE CHARLIE">TASK FORCE CHARLIE</option>
                              <option value="TASK FORCE DELTA">TASK FORCE DELTA</option>
                              <option value="GENERAL ALARM">GENERAL ALARM</option>
                            </select>
                          ) : (
                            report.finalAlarmLevel === 'GENERAL ALARM' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (report.status === 'Cancelled') {
                                    const cancelledBy = report?.cancelled_by;
                                    const cancellationReason = report?.cancellation_reason;
                                    if (cancelledBy === 'Admin User' || cancelledBy === 'admin' || cancelledBy === 'Admin') {
                                      const reasonText = cancellationReason ? `\n\nReason: ${cancellationReason}` : '';
                                      alert(`This report was cancelled by an admin and cannot be edited.${reasonText}`);
                                    } else if (cancelledBy) {
                                      const reasonText = cancellationReason ? `\n\nReason: ${cancellationReason}` : '';
                                      alert(`This report was cancelled by the citizen and cannot be edited.${reasonText}`);
                                    } else {
                                      const reasonText = cancellationReason ? `\n\nReason: ${cancellationReason}` : '';
                                      alert(`This report was cancelled and cannot be edited.${reasonText}`);
                                    }
                                    return;
                                  }
                                  handleGeneralAlarm(report.id);
                                }}
                                className={`px-3 py-1 rounded-md text-xs font-medium text-white transition-all duration-300 transform hover:scale-105 ${
                                  report.status === 'Cancelled' 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : generalAlarmStates[report.id] 
                                    ? 'bg-red-600 animate-pulse shadow-red-500/50 ring-4 ring-red-400 ring-opacity-75 animate-bounce' 
                                    : 'bg-red-500 hover:bg-red-600 shadow-red-400/50 hover:ring-2 hover:ring-red-300 hover:ring-opacity-50'
                                }`}
                                disabled={report.status === 'Cancelled'}
                              >
                                {generalAlarmStates[report.id] ? '🚨 GENERAL ALARM ACTIVE 🚨' : 'GENERAL ALARM'}
                              </button>
                            ) : (
                              <span 
                                className={`px-3 py-1 rounded-md text-xs font-medium border ${report.status === 'Cancelled' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-opacity-80'} ${getAlarmLevelColor(report.finalAlarmLevel)}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (report.status === 'Cancelled') {
                                    const cancelledBy = report?.cancelled_by;
                                    const cancellationReason = report?.cancellation_reason;
                                    if (cancelledBy === 'Admin User' || cancelledBy === 'admin' || cancelledBy === 'Admin') {
                                      const reasonText = cancellationReason ? `\n\nReason: ${cancellationReason}` : '';
                                      alert(`This report was cancelled by an admin and cannot be edited.${reasonText}`);
                                    } else if (cancelledBy) {
                                      const reasonText = cancellationReason ? `\n\nReason: ${cancellationReason}` : '';
                                      alert(`This report was cancelled by the citizen and cannot be edited.${reasonText}`);
                                    } else {
                                      const reasonText = cancellationReason ? `\n\nReason: ${cancellationReason}` : '';
                                      alert(`This report was cancelled and cannot be edited.${reasonText}`);
                                    }
                                    return;
                                  }
                                  setEditingFinalAlarm(prev => ({ ...prev, [report.id]: true }));
                                }}
                                title={report.status === 'Cancelled' ? 'Cancelled reports cannot be edited' : 'Click to edit final alarm level'}
                              >
                                {report.finalAlarmLevel}
                              </span>
                            )
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-md text-xs font-medium border ${getAlarmLevelColor(report.suggestedAlarmLevel)}`}>
                            {cleanAlarmLevel(report.suggestedAlarmLevel)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-xs font-medium flex items-center space-x-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReportClick(report);
                            }}
                            title="View Details"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Report Modal */}
        {showReportModal && selectedReport && (
          <div className="fixed inset-0 backdrop-blur-md bg-white/20 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900">Emergency Report Details</h3>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX size={28} />
                  </button>
                </div>

                <div className="space-y-8">
                  {/* Picture */}
                  <div className="bg-gray-100 rounded-lg p-6 text-center">
                    <img 
                      src={selectedReport.picture} 
                      alt="Fire Scene" 
                      className="w-full h-64 object-cover rounded-lg"
                      onError={(e) => {
                        e.target.src = '/burnhouse.jpg';
                      }}
                    />
                  </div>

                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-2">Reporter:</label>
                      <span className="text-xl font-semibold text-gray-900">{selectedReport.reporter}</span>
                    </div>
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-2">Reported:</label>
                      <span className="text-lg text-gray-500">{selectedReport.minutesAgo} min ago</span>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-2">Location:</label>
                    <div className="space-y-2">
                      <span className="text-xl font-semibold text-gray-900">{selectedReport.location}</span>
                      {selectedReport.geotag_location && selectedReport.geotag_location !== selectedReport.location && (
                        <div className="text-sm text-gray-500">
                          Coordinates: {selectedReport.geotag_location}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cause of Fire */}
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-3">Cause of Fire:</label>
                    <p className="text-gray-900 leading-relaxed text-lg">{selectedReport.description}</p>
                  </div>

                  {/* AI Analysis Results */}
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-blue-900 mb-4">AI Analysis Results</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Fire Detection:</label>
                        <span className="text-lg font-semibold text-blue-900">
                          {selectedReport.prediction} ({selectedReport.confidence})
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Structure Type:</label>
                        <span className="text-lg font-semibold text-blue-900">
                          {selectedReport.structure}
                          {selectedReport.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Smoke Intensity:</label>
                        <span className="text-lg font-semibold text-blue-900">
                          {selectedReport.smokeIntensity} ({selectedReport.smokeConfidence})
                        </span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-700 mb-2">Structures Affected:</label>
                        <span className="text-lg font-semibold text-blue-900">
                          {selectedReport.numberOfStructures || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status and Alarm Levels */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">Current Status:</label>
                      <span className={`px-4 py-3 rounded-md text-base font-medium border ${getStatusColor(selectedReport.status)}`}>
                        {selectedReport.status}
                      </span>
                    </div>
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">Suggested Alarm Level:</label>
                      <span className={`px-3 py-3 rounded-md text-base font-medium border ${getAlarmLevelColor(selectedReport.suggestedAlarmLevel)}`}>
                        {cleanAlarmLevel(selectedReport.suggestedAlarmLevel)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">Final Alarm Level:</label>
                      <span className={`px-3 py-3 rounded-md text-base font-medium border ${getAlarmLevelColor(selectedReport.finalAlarmLevel)}`}>
                        {selectedReport.finalAlarmLevel}
                      </span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-2">Full Timestamp:</label>
                    <span className="text-lg text-gray-900">
                      {selectedReport.timestamp ? 
                        (selectedReport.timestamp.includes('T') || selectedReport.timestamp.includes('Z') ? 
                          new Date(selectedReport.timestamp).toLocaleString() : 
                          selectedReport.timestamp) : 
                        'Unknown'}
                    </span>
                  </div>

                  {/* Assigned Responder(s) */}
                  <div>
                    <label className="block text-lg font-medium text-gray-700 mb-2">Assigned Responder(s):</label>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      {isLoadingAssigned ? (
                        <div className="text-gray-600">Loading...</div>
                      ) : assignedResponders.length > 0 ? (
                        <div className="space-y-2">
                          {assignedResponders.map(r => (
                            <div key={r.id} className="">
                              <div className="text-blue-900 font-semibold">
                                {(r.first_name || '') + (r.last_name ? ` ${r.last_name}` : '') || 'Responder'}
                              </div>
                              {r.email && <div className="text-sm text-blue-800">{r.email}</div>}
                              {r.phone && <div className="text-sm text-blue-800">{r.phone}</div>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-blue-900">No responder assigned yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-8 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alarm Level Change Confirmation Modal */}
        {showAlarmConfirm && (
          <div 
            className="fixed inset-0 backdrop-blur-md bg-black/50 flex items-center justify-center p-4 z-50 transition-opacity duration-300"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all"
              style={{ animation: 'scaleIn 0.3s ease-out' }}
            >
              {/* Header */}
              <div className="bg-red-600 p-6 rounded-t-2xl">
                <div className="flex items-center space-x-3">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                    <FiAlertTriangle className="text-white" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white">Confirm Alarm Level Change</h3>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Warning Message */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-gray-800 text-sm">
                    Are you sure you want to change the final alarm level from{' '}
                    <span className="font-bold text-red-600">"{alarmChangeData?.currentAlarmLevel}"</span>{' '}
                    to{' '}
                    <span className="font-bold text-red-600">"{alarmChangeData?.newAlarmLevel}"</span>?
                  </p>
                </div>

                {/* Report Details */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start space-x-2">
                    <FiMapPin className="text-gray-500 mt-0.5" size={16} />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Report ID</p>
                      <p className="text-sm font-mono text-gray-800">{alarmChangeData?.reportIdShort}...</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <FiMapPin className="text-gray-500 mt-0.5" size={16} />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-1">Location</p>
                      <p className="text-sm text-gray-800">{alarmChangeData?.location}</p>
                    </div>
                  </div>
                </div>

                {/* Warning Notice */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <FiAlertTriangle className="text-red-600 mt-0.5 flex-shrink-0" size={16} />
                    <p className="text-gray-700 text-xs">
                      This action will update the emergency response level and may trigger additional resource deployment.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={cancelAlarmChange}
                    className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAlarmChange}
                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes scaleIn {
                from { 
                  opacity: 0;
                  transform: scale(0.95);
                }
                to { 
                  opacity: 1;
                  transform: scale(1);
                }
              }
            `}</style>
          </div>
        )}

        {/* Admin Cancellation Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 backdrop-blur-md bg-white/20 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Cancel Report</h3>
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setCancelReason('');
                      setReportToCancel(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    disabled={isCancelling}
                  >
                    <FiX size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Report Details:
                    </label>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                      <p><strong>Reporter:</strong> {reportToCancel?.reporter}</p>
                      <p><strong>Location:</strong> {reportToCancel?.location}</p>
                      <p><strong>Current Status:</strong> {reportToCancel?.status}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Cancellation *
                    </label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Please provide a reason for cancelling this report..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                      rows={4}
                      disabled={isCancelling}
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setShowCancelModal(false);
                        setCancelReason('');
                        setReportToCancel(null);
                      }}
                      disabled={isCancelling}
                      className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={cancelReport}
                      disabled={!cancelReason.trim() || isCancelling}
                      className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                        !cancelReason.trim() || isCancelling
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Overview;