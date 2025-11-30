import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiX, FiChevronDown, FiUserPlus, FiMapPin } from 'react-icons/fi';
import { supabase } from '../../../../config/supabase';

const Station_Overview = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openStatusDropdown, setOpenStatusDropdown] = useState(null);
  const [openAssignDropdown, setOpenAssignDropdown] = useState(null);
  const [assigning, setAssigning] = useState({}); // reportId->boolean
  const [responders, setResponders] = useState([]);
  const [currentStationId, setCurrentStationId] = useState(null);
  const [assignedResponders, setAssignedResponders] = useState([]);
  const [showAssignedDropdown, setShowAssignedDropdown] = useState(false);
  const [responderSelection, setResponderSelection] = useState({}); // reportId -> Set of responderIds
  const [responderExisting, setResponderExisting] = useState({}); // reportId -> Set of responderIds
  const [aiChatSuggestions, setAiChatSuggestions] = useState([]); // recent AI suggestions from messages
  const [chatAlarmByReport, setChatAlarmByReport] = useState({}); // reportId -> normalized label

  const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';

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

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      if (typeof timestamp === 'string' && !timestamp.includes('T') && !timestamp.includes('Z')) return timestamp;
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch { return 'Unknown'; }
  };
  const minutesAgo = (timestamp) => {
    try { const d = new Date(timestamp); return Math.floor((Date.now()-d)/60000); } catch { return 0; }
  };

  // Determine suggested alarm level based on number of structures on fire
  const determineSuggestedAlarm = (numStructures) => {
    if (!numStructures || numStructures === 0) return 'Unknown - structure count not provided';
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

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
        const stationId = userData?.id;
        setCurrentStationId(stationId || null);
        if (!stationId) { setReports([]); return; }
        
        // Fetch assigned reports for this station directly
        const { data: stationAssignments, error: stationErr } = await supabase
          .from('report_assignments')
          .select('report_id')
          .eq('assignee_type', 'station')
          .eq('assignee_id', stationId);
        if (stationErr) throw stationErr;

        // Fetch responders for this station, then their assigned reports
        const { data: stationResponders, error: respErr } = await supabase
          .from('responders')
          .select('id')
          .eq('station_id', stationId);
        if (respErr) throw respErr;
        const responderIds = (stationResponders || []).map(r => r.id);

        let responderAssignments = [];
        if (responderIds.length > 0) {
          const { data: respAssigns, error: respAssignErr } = await supabase
            .from('responder_notifications')
            .select('fire_report_id')
            .in('responder_id', responderIds)
            .in('status', ['pending', 'accepted']);
          if (respAssignErr) throw respAssignErr;
          // Map fire_report_id to report_id for consistency
          responderAssignments = (respAssigns || []).map(r => ({ report_id: r.fire_report_id }));
        }
        
        const { data: forwarded, error: forwardError } = await supabase
          .from('report_routes')
          .select('report_id, note, forwarded_at')
          .eq('target', `station:${stationId}`);
        if (forwardError) console.error('Error fetching forwarded reports:', forwardError);
        
        // Get original assignee info for forwarded reports
        const forwardedReportIds = (forwarded||[]).map(f => String(f.report_id));
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
        (forwarded||[]).forEach(f => {
          const originalAssignee = originalAssignees.get(String(f.report_id));
          forwardedMetadata.set(String(f.report_id), {
            note: f.note,
            forwarded_at: f.forwarded_at,
            original_assignee: originalAssignee
          });
        });
        
        // Combine both
        const assignedIds = new Set([
          ...((stationAssignments || []).map(a => String(a.report_id))),
          ...((responderAssignments || []).map(a => String(a.report_id)))
        ]);
        const forwardedIds = new Set((forwarded||[]).map(f=>String(f.report_id)));
        const ids = new Set([...assignedIds, ...forwardedIds]);
        
        console.log(`Station Overall: ${assignedIds.size} assigned, ${forwardedIds.size} forwarded`);
        
        if (!ids.size) { setReports([]); return; }
        const resp = await fetch(`${API_URL}/get_reports`);
        const data = resp.ok ? await resp.json() : [];
        const filtered = (data||[]).filter(r=>ids.has(String(r.id)));
        const mapped = filtered.map(r=>{
          const aiOverride = chatAlarmByReport[String(r.id)];
          const forwardingInfo = forwardedMetadata.get(String(r.id));
          return {
            id: r.id,
            time: formatTime(r.formatted_timestamp || r.created_at),
            reporter: r.reporter || 'Unknown Reporter',
            location: r.address || r.geotag_location || 'Location unavailable',
            status: r.status || 'On Going',
            suggestedAlarmLevel: aiOverride || r.recommended_alarm_level || r.alarm_level || determineSuggestedAlarm(r.number_of_structures_on_fire),
            finalAlarmLevel: r.final_fire_alarm_level || '1st Alarm',
            description: r.cause_of_fire || 'No cause specified',
            picture: r.image_url,
            minutesAgo: minutesAgo(r.created_at || r.timestamp),
            prediction: r.prediction,
            confidence: r.confidence,
            structure: r.structure,
            smokeIntensity: r.smoke_intensity,
            smokeConfidence: r.smoke_confidence,
            numberOfStructures: cleanStructuresValue(r.number_of_structures_on_fire),
            timestamp: r.created_at || r.timestamp,
            latitude: r.latitude,
            longitude: r.longitude,
            address: r.address,
            geotag_location: r.geotag_location,
            // Attach forwarding metadata
            is_forwarded: !!forwardingInfo,
            forwarding_note: forwardingInfo?.note,
            forwarded_at: forwardingInfo?.forwarded_at,
            original_assignee: forwardingInfo?.original_assignee
          };
        });
        setReports(mapped.sort((a,b)=> new Date(b.timestamp||0)-new Date(a.timestamp||0)));
      } catch (e) {
        console.error('Station Overall load error:', e);
        setReports([]);
      } finally { setIsLoading(false); }
    };
    load();
  }, []);

  // Load AI suggestions from messages table to override suggested alarm level
  useEffect(() => {
    const loadAiSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, ai_suggested_alarm, suggested_alarm_level, created_at, report_id')
          .not('ai_suggested_alarm', 'is', null)
          .order('created_at', { ascending: false })
          .limit(300);
        if (!error) setAiChatSuggestions(data || []);
      } catch (_) {}
    };
    loadAiSuggestions();
    
    // Faster polling - every 5 seconds instead of 30
    const interval = setInterval(loadAiSuggestions, 5000);
    
    // Real-time subscription for instant updates
    const subscription = supabase
      .channel('ai_suggestions_station')
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

  // Normalize and keep strongest AI suggested alarm per report
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
    const normalizeAiLabel = (aiValue, suggestedAlarmLevel) => {
      // Priority 1: Use suggested_alarm_level field directly if available
      if (suggestedAlarmLevel && suggestedAlarmLevel !== 'NONE') {
        return suggestedAlarmLevel;
      }
      
      if (!aiValue) return null;
      let suggested = null;
      if (typeof aiValue === 'string') {
        const trimmed = aiValue.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try { return normalizeAiLabel(JSON.parse(trimmed), suggestedAlarmLevel); } catch (_) {}
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

  // When AI overrides change, update suggestedAlarmLevel in current list
  useEffect(() => {
    if (!reports || Object.keys(chatAlarmByReport).length === 0) return;
    setReports(prev => prev.map(r => ({
      ...r,
      suggestedAlarmLevel: chatAlarmByReport[String(r.id)] || r.suggestedAlarmLevel
    })));
  }, [chatAlarmByReport]);

  // Load responders for this station (active contacts)
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

  const toggleStatusDropdown = (reportId) => {
    setOpenStatusDropdown(openStatusDropdown === reportId ? null : reportId);
  };

  const toggleAssignDropdown = async (reportId) => {
    const nextOpen = openAssignDropdown === reportId ? null : reportId;
    setOpenAssignDropdown(nextOpen);
    if (nextOpen) {
      try {
        const rid = String(reportId);
        // Query responder_notifications with status 'pending' or 'accepted' to get assigned responders
        const { data, error } = await supabase
          .from('responder_notifications')
          .select('responder_id')
          .eq('fire_report_id', rid)
          .in('status', ['pending', 'accepted']);
        if (!error) {
          const ids = new Set((data || []).map(r => r.responder_id));
          setResponderExisting(prev => ({ ...prev, [rid]: ids }));
          setResponderSelection(prev => ({ ...prev, [rid]: new Set(ids) }));
        }
      } catch (_) {}
    }
  };

  const handleStatusChange = async (reportId, newStatus) => {
    try {
      // Get the report data before updating
      const currentReport = reports.find(r => r.id === reportId);
      const oldStatus = currentReport?.status || 'On Going';
      
      // Optimistic UI update
      setReports(prev => prev.map(report => 
        report.id === reportId ? { ...report, status: newStatus } : report
      ));
      setOpenStatusDropdown(null);

      const res = await fetch(`${API_URL}/update_report_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ report_id: reportId, status: newStatus })
      });

      if (!res.ok) {
        // Revert change on failure
        setReports(prev => prev.map(report =>
          report.id === reportId ? { ...report, status: report.status || 'On Going' } : report
        ));
        let err = '';
        try { const j = await res.clone().json(); err = j?.error || j?.message || JSON.stringify(j); }
        catch (_) { try { err = await res.text(); } catch (_) { err = `HTTP ${res.status}`; } }
        alert(`Failed to update status: ${err}`);
        return;
      }

      // ✅ SUCCESS - Now create notifications for all users
      try {
        console.log('🔔 Creating notifications for status change:', { reportId, oldStatus, newStatus });
        
        // Fetch the full report data from API for notification details
        let fullReportData = currentReport;
        try {
          const reportRes = await fetch(`${API_URL}/get_reports`);
          if (reportRes.ok) {
            const allReports = await reportRes.json();
            const foundReport = allReports.find(r => String(r.id) === String(reportId));
            if (foundReport) {
              fullReportData = foundReport;
            }
          }
        } catch (fetchErr) {
          console.log('Could not fetch full report data, using current data:', fetchErr);
        }

        // Create notifications using the universal notification service approach
        await createNotificationsForStatusChange(reportId, newStatus, oldStatus, fullReportData);
        console.log('✅ Notifications created successfully');
      } catch (notifErr) {
        console.error('⚠️ Failed to create notifications (non-critical):', notifErr);
        // Don't fail the status update if notifications fail
      }
    } catch (e) {
      setReports(prev => prev.map(report =>
        report.id === reportId ? { ...report, status: report.status || 'On Going' } : report
      ));
      alert(`Error updating status: ${e.message}`);
    }
  };

  // Helper function to create notifications for all users when status changes
  const createNotificationsForStatusChange = async (reportId, newStatus, oldStatus, reportData) => {
    console.log('🚀 FUNCTION CALLED: createNotificationsForStatusChange');
    console.log('📦 Parameters:', { reportId, newStatus, oldStatus, reportData });
    
    // Import supabase if not already available
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = 'https://wedqhsgrxnvbhklzhnet.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHFoc2dyeG52YmhrbHpobmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzYzNzcsImV4cCI6MjA3MTg1MjM3N30.MimeT7vfd8M5mLByJqSRBFby_OpyODfegoMouIlf7mU';
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client created');

    // Check if this is a significant status change for citizen notifications
    const significantChanges = [
      { from: 'On Going', to: 'Under Control' },
      { from: 'Under Control', to: 'Fire Out' },
      { from: 'On Going', to: 'Fire Out' }
    ];

    const isSignificantForCitizen = significantChanges.some(
      change => change.from === oldStatus && change.to === newStatus
    );

    // ALWAYS notify responders when status becomes "Fire Out" or "Under Control"
    const shouldNotifyResponders = newStatus === 'Fire Out' || newStatus === 'Under Control';

    if (!isSignificantForCitizen && !shouldNotifyResponders && oldStatus) {
      console.log('ℹ️ Status change not significant for notifications');
      return;
    }

    // Format notification details
    const locationInfo = reportData?.location || reportData?.address || reportData?.geotag_location || 'Location not specified';
    const alarmLevel = reportData?.alarm_level || reportData?.recommended_alarm_level || 'Unknown';
    const reporter = reportData?.reporter || reportData?.reporter_name || 'Unknown Reporter';
    
    const message = `📍 Location: ${locationInfo}\n🔥 Alarm Level: ${alarmLevel}\n👤 Reporter: ${reporter}\n\nStatus changed from "${oldStatus}" to "${newStatus}"`;

    // 1. Get citizen who created the report
    let citizenId = null;
    
    console.log('🔍 Looking for citizen ID. Report data:', {
      user_id: reportData?.user_id,
      reporter_email: reportData?.reporter_email,
      reporter: reportData?.reporter,
      reporter_name: reportData?.reporter_name
    });
    
    // Try multiple methods to get the citizen ID
    if (reportData?.user_id) {
      citizenId = reportData.user_id;
      console.log('📱 Found citizen ID from report user_id:', citizenId);
    }
    
    // If not found, try to find by reporter email
    if (!citizenId && reportData?.reporter_email) {
      console.log('🔍 Searching citizen_users by email:', reportData.reporter_email);
      const { data: citizenUsers, error: emailError } = await supabase
        .from('citizen_users')
        .select('id, email')
        .eq('email', reportData.reporter_email)
        .limit(1);
      
      if (emailError) {
        console.error('❌ Error searching by email:', emailError);
      }
      
      if (citizenUsers && citizenUsers.length > 0) {
        citizenId = citizenUsers[0].id;
        console.log('📱 Found citizen ID from reporter email:', citizenId, 'Email:', citizenUsers[0].email);
      } else {
        console.warn('⚠️ No citizen found with email:', reportData.reporter_email);
      }
    }
    
    // If still not found, try to search by reporter name in display_name or email
    if (!citizenId && reportData?.reporter) {
      console.log('🔍 Searching citizen_users by reporter name:', reportData.reporter);
      const { data: citizenByName, error: nameError } = await supabase
        .from('citizen_users')
        .select('id, email, display_name, first_name, last_name')
        .or(`email.ilike.%${reportData.reporter}%,display_name.ilike.%${reportData.reporter}%,first_name.ilike.%${reportData.reporter}%,last_name.ilike.%${reportData.reporter}%`)
        .limit(1);
      
      if (nameError) {
        console.error('❌ Error searching by name:', nameError);
      }
      
      if (citizenByName && citizenByName.length > 0) {
        citizenId = citizenByName[0].id;
        console.log('📱 Found citizen ID from reporter name:', citizenId, 'Matched user:', citizenByName[0]);
      } else {
        console.warn('⚠️ No citizen found matching name:', reportData.reporter);
      }
    }
    
    if (!citizenId) {
      console.error('❌ Could not find citizen ID using any method');
      console.log('📊 All citizen users in database:');
      const { data: allCitizens } = await supabase
        .from('citizen_users')
        .select('id, email, display_name, first_name, last_name')
        .limit(10);
      console.log(allCitizens);
    }

    // Create citizen notification (special acknowledgment message) - only for significant changes
    console.log('🎯 About to create citizen notification. Citizen ID:', citizenId, 'isSignificant:', isSignificantForCitizen);
    
    if (citizenId && isSignificantForCitizen) {
      let citizenTitle = `Report Status Changed to ${newStatus}`;
      let citizenMessage = message;
      let citizenType = 'user_action'; // Changed from 'status_change' to valid type

      if (newStatus === 'Under Control') {
        citizenTitle = '🎉 Report Acknowledged - Under Control';
        citizenMessage = `Great news! Your fire report has been acknowledged by our emergency responders.\n\n✅ Status: Under Control\n${message}`;
        citizenType = 'user_action';
      } else if (newStatus === 'Fire Out') {
        citizenTitle = '✅ Fire Resolved - All Clear';
        citizenMessage = `Excellent news! Your fire report has been successfully resolved. The fire is now out and the situation is under control.\n\n✅ Status: Fire Out\n${message}`;
        citizenType = 'user_action';
      }

      console.log('📝 Creating citizen notification with:', {
        user_id: citizenId,
        user_type: 'citizen',
        title: citizenTitle,
        type: citizenType,
        priority: 'high',
        related_report_id: String(reportId)
      });

      const { data: insertedNotif, error: insertError } = await supabase.from('notifications').insert({
        user_id: citizenId,
        user_type: 'citizen',
        title: citizenTitle,
        message: citizenMessage,
        type: citizenType, // Using 'user_action' which is a valid type
        priority: 'high',
        related_report_id: String(reportId),
        is_read: false
      }).select();
      
      if (insertError) {
        console.error('❌ Error creating citizen notification:', insertError);
        console.error('❌ Insert error details:', JSON.stringify(insertError));
        console.error('❌ Error code:', insertError.code);
        console.error('❌ Error message:', insertError.message);
      } else {
        console.log('✅ Created citizen notification for user:', citizenId);
        console.log('✅ Notification data:', insertedNotif);
      }
    } else {
      console.error('❌ Could not find citizen ID for report:', reportId);
      console.error('❌ This means the status change notification will NOT be sent to the citizen');
    }

    // 2. Get all responders assigned to this report and create notifications
    console.log('🔍 Looking for responders assigned to report:', reportId);
    console.log('🔍 Query details:', { report_id: String(reportId), assignee_type: 'responder' });
    
    // DEBUG: Check ALL notifications in the database
    const { data: allNotifications, error: _allNotifsError } = await supabase
      .from('responder_notifications')
      .select('*')
      .limit(20);
    console.log('🗂️ ALL responder notifications in database (sample):', allNotifications);
    console.log('🗂️ Total notifications found:', allNotifications?.length || 0);
    
    const { data: existingNotifications, error: assignError } = await supabase
      .from('responder_notifications')
      .select('id, responder_id, station_id, status')
      .eq('fire_report_id', String(reportId))
      .in('status', ['pending', 'accepted']);

    console.log('📊 Query result for this report:', { 
      reportId: String(reportId),
      existingNotifications, 
      assignError,
      notificationCount: existingNotifications?.length || 0
    });

    if (assignError) {
      console.error('❌ Error fetching responder notifications:', assignError);
    }

    if (existingNotifications && existingNotifications.length > 0) {
      console.log(`📋 Found ${existingNotifications.length} responder(s) assigned to this report`);
      console.log('📋 Notification details:', existingNotifications);
      
      // Update existing notifications with status change info
      const updatePromises = existingNotifications.map(notification => {
        let responderTitle = `Fire Report Status: ${newStatus}`;
        let responderMessage = message;
        
        if (newStatus === 'Under Control') {
          responderTitle = '✅ Fire Under Control';
          responderMessage = `The fire you were assigned to is now under control.\n\n${message}\n\nThank you for your service!`;
        } else if (newStatus === 'Fire Out') {
          responderTitle = '🎉 Fire Extinguished - Mission Complete';
          responderMessage = `Great work! The fire you were assigned to has been extinguished.\n\n${message}\n\nYour assignment has been completed. Stay safe!`;
        }

        return supabase
          .from('responder_notifications')
          .update({
            title: responderTitle,
            message: responderMessage,
            priority: 'high', // Always high priority to trigger alarm for status updates
            status: 'completed', // Mark as completed for Fire Out/Under Control
            is_read: false // Reset is_read so responder sees the update
          })
          .eq('id', notification.id);
      });

      console.log(`📝 Attempting to update ${updatePromises.length} responder notification(s)`);
      
      const updateResults = await Promise.all(updatePromises);
      const responderInsertError = updateResults.find(r => r.error)?.error;

      if (responderInsertError) {
        console.error('❌ Error updating responder notifications:', responderInsertError);
        console.error('❌ Error details:', JSON.stringify(responderInsertError, null, 2));
        console.error('❌ Error code:', responderInsertError.code);
        console.error('❌ Error message:', responderInsertError.message);
      } else {
        console.log(`✅ Updated ${existingNotifications.length} responder notification(s) to 'completed' status`);
        console.log('✅ Notifications marked as completed with status update message');
      }

      // Note: Notifications are updated to 'completed' status instead of being deleted
      // This preserves the notification history for responders to view
    } else {
      console.log('ℹ️ No responders assigned to this report');
    }

    // 3. Get all admins and create notifications
    const { data: admins } = await supabase
      .from('admin_users')
      .select('id')
      .eq('active', true);

    if (admins && admins.length > 0) {
      const adminNotifications = admins.map(admin => ({
        user_id: admin.id,
        user_type: 'admin',
        title: `Report Status Changed to ${newStatus}`,
        message: message,
        type: 'fire_alert',
        priority: 'high',
        related_report_id: String(reportId),
        is_read: false
      }));
      await supabase.from('notifications').insert(adminNotifications);
      console.log(`✅ Created ${admins.length} admin notification(s)`);
    }
  };

  const closeAllDropdowns = () => {
    setOpenStatusDropdown(null);
    setOpenAssignDropdown(null);
  };

  // Filter reports based on search
  const filteredReports = reports.filter(report => {
    return report.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
    navigate('/station-dashboard');
  };

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  // Load assigned responders for the selected report when modal opens
  useEffect(() => {
    const loadAssigned = async () => {
      try {
        if (!showReportModal || !selectedReport?.id) { setAssignedResponders([]); return; }
        const rid = String(selectedReport.id);
        const { data: assigns, error } = await supabase
          .from('report_assignments')
          .select('assignee_id')
          .eq('report_id', rid)
          .eq('assignee_type', 'responder');
        if (error) { setAssignedResponders([]); return; }
        const responderIds = (assigns || []).map(a => a.assignee_id);
        if (responderIds.length === 0) { setAssignedResponders([]); return; }
        const { data: respData } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email')
          .in('id', responderIds);
        setAssignedResponders(respData || []);
      } catch (_) {
        setAssignedResponders([]);
      }
    };
    loadAssigned();
  }, [showReportModal, selectedReport?.id]);

  // Commit responder assignments for a report (adds/removes to match current selection)
  const commitResponderAssignments = async (reportId) => {
    const rid = String(reportId);
    const selected = responderSelection[rid] || new Set();
    const existing = responderExisting[rid] || new Set();
    const toAdd = [...selected].filter(id => !existing.has(id));
    const toRemove = [...existing].filter(id => !selected.has(id));
    try {
      setAssigning(prev => ({ ...prev, [rid]: true }));
      // Add new responders by creating notifications in responder_notifications
      if (toAdd.length > 0) {
        try {
          // Re-fetch to avoid stale existing set and filter duplicates manually
          const { data: existingRows } = await supabase
            .from('responder_notifications')
            .select('responder_id')
            .eq('fire_report_id', rid)
            .in('status', ['pending', 'accepted']);
          const latest = new Set((existingRows || []).map(r => r.responder_id));
          const uniqueAdds = toAdd.filter(id => !latest.has(id));
          if (uniqueAdds.length > 0) {
            // Get report details for notification message
            const currentReport = reports.find(r => String(r.id) === rid);
            const location = currentReport?.location || currentReport?.address || 'Unknown location';
            const reporter = currentReport?.reporter || 'Unknown reporter';
            
            const rows = uniqueAdds.map(id => ({
              responder_id: id,
              station_id: currentStationId,
              fire_report_id: rid,
              title: '🚨 New Fire Assignment',
              message: `You have been assigned to a fire incident.\n\n📍 Location: ${location}\n👤 Reporter: ${reporter}\n\nPlease respond as soon as possible.`,
              priority: 'urgent',
              status: 'pending',
              is_read: false
            }));
            const { error: addErr } = await supabase
              .from('responder_notifications')
              .insert(rows);
            if (addErr) {
              console.error('Failed to create responder notifications:', addErr);
              alert(`Failed to add responder(s): ${addErr.message}`);
            }
          }
        } catch (err) {
          alert(`Failed to add responder(s): ${err.message}`);
        }
      }
      // Remove unchecked responders by deleting their notifications
      if (toRemove.length > 0) {
        const { error: delErr } = await supabase
          .from('responder_notifications')
          .delete()
          .eq('fire_report_id', rid)
          .in('responder_id', toRemove);
        if (delErr) {
          alert(`Failed to remove responder(s): ${delErr.message}`);
        }
      }
      // Auto-update status to "Under Control" if at least one responder is assigned and status is "On Going"
      // Check the final state after additions - if there's at least one responder assigned
      const finalResponderCount = selected.size;
      console.log('🔍 Checking auto-update conditions:', { 
        reportId: rid, 
        selectedCount: finalResponderCount, 
        selected: Array.from(selected) 
      });
      
      if (finalResponderCount > 0) {
        const currentReport = reports.find(r => String(r.id) === rid);
        const currentStatus = currentReport?.status || currentReport?.progress || 'On Going';
        
        console.log('📊 Current report status:', currentStatus);
        
        if (currentStatus === 'On Going') {
          console.log('🔄 Auto-updating status from "On Going" to "Under Control" (at least one responder assigned)');
          try {
            // Update via API
            const updateRes = await fetch(`${API_URL}/update_report_progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                report_id: rid,
                progress: 'Under Control'
              })
            });
            
            if (updateRes.ok) {
              // Update local state immediately
              setReports(prev => prev.map(report =>
                String(report.id) === rid
                  ? { ...report, status: 'Under Control', progress: 'Under Control' }
                  : report
              ));
              
              // Reload the full report data from API to ensure UI is in sync
              try {
                const reloadRes = await fetch(`${API_URL}/get_reports`);
                if (reloadRes.ok) {
                  const allReportsData = await reloadRes.json();
                  const updatedReport = allReportsData.find(r => String(r.id) === rid);
                  if (updatedReport) {
                    setReports(prev => prev.map(report =>
                      String(report.id) === rid ? updatedReport : report
                    ));
                  }
                }
              } catch (reloadErr) {
                console.warn('⚠️ Failed to reload report data:', reloadErr);
              }
              
              // Create notifications for status change
              await createNotificationsForStatusChange(rid, 'Under Control', 'On Going', currentReport);
              console.log('✅ Status automatically updated to "Under Control"');
            } else {
              console.warn('⚠️ Failed to auto-update status:', await updateRes.text());
            }
          } catch (statusErr) {
            console.error('⚠️ Error auto-updating status:', statusErr);
            // Don't fail the assignment if status update fails
          }
        } else {
          console.log('ℹ️ Status is already "' + currentStatus + '", no auto-update needed');
        }
      }
      
      // Update baselines and close
      const newExisting = new Set(selected);
      setResponderExisting(prev => ({ ...prev, [rid]: newExisting }));
      setOpenAssignDropdown(null);
      // Refresh assigned responders in modal if open on this report
      if (showReportModal && selectedReport?.id && String(selectedReport.id) === rid) {
        try {
          const { data: assigns2 } = await supabase
            .from('responder_notifications')
            .select('responder_id')
            .eq('fire_report_id', rid)
            .in('status', ['pending', 'accepted']);
          const ids2 = (assigns2 || []).map(a => a.responder_id);
          if (ids2.length > 0) {
            const { data: respData2 } = await supabase
              .from('responders')
              .select('id, first_name, last_name, email')
              .in('id', ids2);
            setAssignedResponders(respData2 || []);
          } else {
            setAssignedResponders([]);
          }
        } catch (_) {}
      }
    } catch (e) {
      alert(`Failed to update assignments: ${e.message}`);
    } finally {
      setAssigning(prev => ({ ...prev, [rid]: false }));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'On Going': return 'bg-red-100 text-red-800 border-red-200';
      case 'Under Control': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Fire Out': return 'bg-green-100 text-green-800 border-green-200';
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

  const getEquipmentStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-800 border-green-200';
      case 'Deployed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Maintenance': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getResponderStatusColor = (status) => {
    switch (status) {
      case 'On Scene': return 'bg-red-100 text-red-800 border-red-200';
      case 'En Route': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Standby': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Confirmation modal for status changes
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null); // { reportId, status, currentStatus }

  return (
    <div className="min-h-screen bg-gray-50 p-6" onClick={closeAllDropdowns}>
      <div className="max-w-none mx-auto">
        <div className="w-full">
          {/* Header */}
          

          {/* Search and Reports Table */}
          <div className="bg-white rounded-xl shadow-sm p-12 mb-6 w-full">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  placeholder="Search emergency reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

              {/* Assigned Reports Table */}
            <div className="w-full">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Assign</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Time</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Reporter</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Location</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Status</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Fire Alarm Level</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Suggested Fire Alarm</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReports.map((report) => {
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
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleAssignDropdown(report.id); }}
                            className="px-3 py-1 rounded-md text-xs font-medium border bg-white hover:bg-gray-50 flex items-center gap-1"
                            title="Assign responders"
                          >
                            <FiUserPlus className="inline" />
                            Assign
                            <FiChevronDown className="inline" />
                          </button>
                          {openAssignDropdown === report.id && (
                            <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg p-2">
                              <div className="max-h-56 overflow-auto">
                                {responders.length === 0 ? (
                                  <div className="text-xs text-gray-500 px-2 py-2">No responders for this station.</div>
                                ) : (
                                  responders.map((r) => {
                                    const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Responder';
                                    const rid = String(report.id);
                                    const selectedSet = responderSelection[rid] || new Set();
                                    const checked = selectedSet.has(r.id);
                                    const alreadyAssigned = (responderExisting[rid] || new Set()).has(r.id);
                                    return (
                                      <label key={r.id} className="flex items-center justify-between gap-2 px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer" onClick={(e)=>e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            setResponderSelection(prev => {
                                              const next = new Set(prev[rid] || []);
                                              if (e.target.checked) next.add(r.id); else next.delete(r.id);
                                              return { ...prev, [rid]: next };
                                            });
                                          }}
                                        />
                                        <span className="flex-1">{name}</span>
                                        {alreadyAssigned && (
                                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">Assigned</span>
                                        )}
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                              <div className="pt-2 text-right">
                                <button
                                  className={`px-3 py-1 text-xs rounded ${assigning[String(report.id)] ? 'bg-gray-300 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                  disabled={!!assigning[String(report.id)]}
                                  onClick={(e) => { e.stopPropagation(); commitResponderAssignments(report.id); }}
                                >
                                  {assigning[String(report.id)] ? 'Saving...' : 'Done'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span>{report.time}</span>
                          {isMapClickable && (
                            <FiMapPin className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" size={14} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.reporter || 'Unknown'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.location}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatusDropdown(report.id);
                            }}
                            className={`px-3 py-1 rounded-md text-xs font-medium border ${getStatusColor(report.status)} hover:bg-gray-50 transition-colors`}
                          >
                            {report.status}
                          </button>
                          {openStatusDropdown === report.id && (
                            <div className="absolute z-10 mt-1 w-32 bg-white border border-gray-300 rounded-md shadow-lg">
                              <div className="py-1">
                                {['On Going', 'Under Control', 'Fire Out'].map((status) => (
                                  <button
                                    key={status}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPendingStatusChange({ reportId: report.id, status, currentStatus: report.status });
                                      setShowStatusConfirmModal(true);
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    {status}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Fire Alarm Level (display only - stations cannot modify) */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-md text-xs font-medium border ${getAlarmLevelColor(report.finalAlarmLevel)}`}>
                          {report.finalAlarmLevel}
                        </span>
                      </td>
                      {/* AI Suggested Fire Alarm (display only) */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-md text-xs font-medium border ${getAlarmLevelColor(report.suggestedAlarmLevel)}`}>
                          {report.suggestedAlarmLevel}
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
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status Change Confirmation Modal */}
          {showStatusConfirmModal && pendingStatusChange && (
            <div 
              className="fixed inset-0 backdrop-blur-lg bg-white/20 flex items-center justify-center p-4 z-[9999]"
              onClick={() => { setShowStatusConfirmModal(false); setPendingStatusChange(null); }}
            >
              <div 
                className="bg-white rounded-xl shadow-xl max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Status Change</h3>
                  <p className="text-gray-700">Change status from <span className="font-semibold">{pendingStatusChange.currentStatus || 'Unknown'}</span> to <span className="font-semibold">{pendingStatusChange.status}</span>?</p>
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => { setShowStatusConfirmModal(false); setPendingStatusChange(null); }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { setShowStatusConfirmModal(false); const { reportId, status } = pendingStatusChange; setPendingStatusChange(null); handleStatusChange(reportId, status); }}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Report Modal */}
          {showReportModal && selectedReport && (
            <div 
              className="fixed inset-0 backdrop-blur-md bg-white/20 flex items-center justify-center p-4 z-[9999]"
              onClick={() => setShowReportModal(false)}
            >
              <div 
                className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
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
                        alt="Emergency Scene" 
                        className="w-full h-64 object-cover rounded-lg"
                      />
                    </div>

                    {/* Show forwarding information if this report was forwarded */}
                    {selectedReport.is_forwarded && (
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <span className="text-2xl">📨</span>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-amber-900 mb-2">Forwarded Report</h4>
                            {selectedReport.original_assignee && (
                              <p className="text-base text-amber-800 mb-2">
                                <strong>Originally assigned to:</strong> {selectedReport.original_assignee.name}
                              </p>
                            )}
                            {selectedReport.forwarding_note && (
                              <p className="text-base text-amber-800 mb-2">
                                <strong>Note:</strong> {selectedReport.forwarding_note}
                              </p>
                            )}
                            {selectedReport.forwarded_at && (
                              <p className="text-sm text-amber-700">
                                Forwarded: {new Date(selectedReport.forwarded_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Location and Time with Assigned Responders Dropdown */}
                    <div className="flex justify-between items-center">
                      <div>
                        <label className="block text-lg font-medium text-gray-700 mb-2">Location:</label>
                        <span className="text-xl font-semibold text-gray-900">{selectedReport.location}</span>
                      </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <button
                          onClick={() => setShowAssignedDropdown(v => !v)}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                          title="View assigned responders"
                        >
                          Assigned Responders ({assignedResponders.length})
                        </button>
                        {showAssignedDropdown && (
                          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-[99999]">
                            <div className="max-h-56 overflow-auto py-2">
                              {assignedResponders.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-500">No responders assigned</div>
                              ) : assignedResponders.map(r => (
                                <div key={r.id} className="px-3 py-2 text-sm text-gray-800 hover:bg-gray-50">
                                  {`${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Responder'}
                                  <div className="text-xs text-gray-500">{r.email}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-lg text-gray-500">{selectedReport.minutesAgo} min ago</span>
                    </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-lg font-medium text-gray-700 mb-3">Description:</label>
                      <p className="text-gray-900 leading-relaxed text-lg">{selectedReport.description}</p>
                    </div>

                    {/* Status and Alarm Levels (match admin view) */}
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
                          {selectedReport.suggestedAlarmLevel?.includes('Unknown - structure count not provided') 
                            ? 'Unknown' 
                            : selectedReport.suggestedAlarmLevel}
                        </span>
                      </div>
                      <div>
                        <label className="block text-lg font-medium text-gray-700 mb-3">Final Alarm Level:</label>
                        <span className={`px-3 py-3 rounded-md text-base font-medium border ${getAlarmLevelColor(selectedReport.finalAlarmLevel)}`}>
                          {selectedReport.finalAlarmLevel}
                        </span>
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
        </div>
      </div>
    </div>
  );
};

export default Station_Overview;