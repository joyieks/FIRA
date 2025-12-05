import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow, Circle, useJsApiLoader } from '@react-google-maps/api';
import { supabase } from '../../../../config/supabase';
import { useNotifications } from '../../../../contexts/NotificationContext';

const Adashboard = () => {
  const { unreadCount, stopAlert, audioBlocked, playAlert } = useNotifications();
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBX5taF1AgNhicxw5_BXUJDs6ouniAuiQI';
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [fireReports, setFireReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [showAdminInfo, setShowAdminInfo] = useState(false);
  const [showLegend, setShowLegend] = useState(true); // New state for legend toggle
  const [showDashboard, setShowDashboard] = useState(true); // Toggle for entire dashboard panel
  const [isAutoSelecting, setIsAutoSelecting] = useState(false); // State for auto-selection indicator
  const [mapLoadTimeout, setMapLoadTimeout] = useState(false); // State for map load timeout
  const [retryCount, setRetryCount] = useState(0); // State for retry count
  const [pendingSelection, setPendingSelection] = useState(null); // State for pending report selection
  const [allStations, setAllStations] = useState([]);
  const [geocodedStations, setGeocodedStations] = useState([]);
  const [jurisdictionRadius] = useState(2000);
  const [responders, setResponders] = useState([]);
  const [assigneeType, setAssigneeType] = useState('station'); // 'station' | 'responder'
  const [assigneeId, setAssigneeId] = useState('');
  const [redirectTarget, setRedirectTarget] = useState(''); // e.g., 'station:<id>' | 'agency:police'
  const [redirectNote, setRedirectNote] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [currentAssignment, setCurrentAssignment] = useState(null); // Current assignment info
  const [forwardedTo, setForwardedTo] = useState([]); // List of stations this was forwarded to
  // Load Google Maps API once globally to avoid duplicate script loads
  const { isLoaded: isMapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  // Fixed location for Bureau of Fire Protection - Regional Office VII
  // 7VXR+5VG, 6000 Natalio B. Bacalso Ave, Cebu City, 6000 Cebu
  const adminLocation = {
    lat: 10.3157,
    lng: 123.8854
  };

  const [mapCenter, setMapCenter] = useState(adminLocation); // State for map center

  // Helper function to clean alarm level text
  const cleanAlarmLevel = (alarmLevel) => {
    if (!alarmLevel) return alarmLevel;
    if (typeof alarmLevel === 'string' && alarmLevel.includes('- structure count not provided')) {
      return alarmLevel.split('- structure count not provided')[0].trim();
    }
    return alarmLevel;
  };

  // Derive alarm level consistently across admin views
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

  // Color mapping based on Philippines Bureau of Fire Protection alarm levels
  const getAlarmLevelColor = (alarmLevel) => {
    if (!alarmLevel) return '#6b7280'; // Gray for unknown
    
    const cleanedLevel = cleanAlarmLevel(alarmLevel);
    const level = cleanedLevel.toLowerCase();
    
    // Fire alarm levels with appropriate colors
    if (level.includes('first alarm')) return '#fef3c7'; // Light yellow
    if (level.includes('second alarm')) return '#fed7aa'; // Light orange
    if (level.includes('third alarm')) return '#fecaca'; // Light red
    if (level.includes('fourth alarm')) return '#f87171'; // Medium red
    if (level.includes('fifth alarm')) return '#ef4444'; // Red
    if (level.includes('task force alpha')) return '#dc2626'; // Dark red
    if (level.includes('task force bravo')) return '#b91c1c'; // Darker red
    if (level.includes('task force charlie')) return '#991b1b'; // Very dark red
    if (level.includes('task force delta')) return '#7f1d1d'; // Deepest red
    if (level.includes('general alarm')) return '#450a0a'; // Darkest red
    
    // Special cases
    if (level.includes('fire out')) return '#93c5fd'; // Light blue
    if (level.includes('under control')) return '#fbbf24'; // Amber
    if (level.includes('false alarm')) return '#9ca3af'; // Gray
    
    return '#6b7280'; // Default gray
  };

  // Get marker color - prioritize alarm level over prediction
  const getMarkerColor = (report) => {
    // First check for alarm level (prioritize final_fire_alarm_level)
    const resolved = resolveAlarmLevel(report);
    if (resolved) return getAlarmLevelColor(resolved);
    
    // Fallback to prediction-based colors
    switch (report.prediction) {
      case 'Fire': return '#ef4444'; // Red for active fire
      case 'No Fire': return '#93c5fd'; // Light blue for no fire
      default: return '#6b7280'; // Gray for unknown
    }
  };

  // Get text color that contrasts well with background
  const getAlarmLevelTextColor = (alarmLevel) => {
    if (!alarmLevel) return '#374151';
    
    const level = alarmLevel.toLowerCase();
    
    // Light backgrounds need dark text
    if (level.includes('first alarm') || level.includes('second alarm') || level.includes('fire out')) {
      return '#374151';
    }
    
    // Medium backgrounds can use dark text
    if (level.includes('third alarm') || level.includes('under control')) {
      return '#1f2937';
    }
    
    // Dark backgrounds need light text
    return '#ffffff';
  };

  // Fetch fire reports from the API
  const fetchFireReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        // Fetched fire reports
        
        // Filter reports that have valid coordinates AND are not cancelled or fire out
        const reportsWithCoords = data.filter(report => {
          const hasCoords = report.latitude && report.longitude && !isNaN(report.latitude) && !isNaN(report.longitude);
          const statusText = (report.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          return hasCoords && !isCancelled && !isFireOut;
        });
        
        // Reports with valid coordinates
        
        // Log each report's location for debugging
        // Reports loaded
        
        setFireReports(reportsWithCoords);
        
        // Check if there's a selected report ID from navigation
        const selectedReportId = localStorage.getItem('selectedReportId');
        if (selectedReportId) {
          const reportToSelect = reportsWithCoords.find(report => String(report.id) === String(selectedReportId));
          if (reportToSelect) {
            // Auto-selecting report
            setSelectedReport(reportToSelect);
            setPendingSelection(reportToSelect);
            // Center map on the selected fire report
            setMapCenter({
              lat: parseFloat(reportToSelect.latitude),
              lng: parseFloat(reportToSelect.longitude)
            });
            // Don't clear the ID yet - wait for map to load
          }
        }
      } else {
        console.error('❌ Failed to fetch fire reports:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching fire reports:', error);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  // Load fire reports when component mounts
  useEffect(() => {
    fetchFireReports();
    
    // Debug: Check what happened with last notification click
    const lastClick = localStorage.getItem('lastNotificationClick');
    if (lastClick) {
      console.log('🔍 Last notification click data:', JSON.parse(lastClick));
      localStorage.removeItem('lastNotificationClick'); // Clean up
    }
    
    // Check for pending selection immediately on mount
    const selectedReportId = localStorage.getItem('selectedReportId');
    if (selectedReportId) {
      console.log('🎯 Found selectedReportId in localStorage:', selectedReportId);
      // Found pending selection
      // Set a flag that we have a pending selection
      setPendingSelection({ id: selectedReportId });
    } else {
      console.log('❌ No selectedReportId found in localStorage');
    }
    
    // Set up periodic refresh to get new reports
    const refreshInterval = setInterval(() => {
      // Refreshing fire reports
      fetchFireReports();
    }, 30000); // Refresh every 30 seconds
    
    // Set up map load timeout
    const mapTimeout = setTimeout(() => {
      if (!mapLoaded) {
        console.warn('⚠️ Map load timeout - enabling manual refresh');
        setMapLoadTimeout(true);
      }
    }, 10000); // 10 second timeout
    
    return () => {
      clearInterval(refreshInterval);
      clearTimeout(mapTimeout);
    };
  }, [fetchFireReports, mapLoaded]);

  // Load all stations and geocode addresses for full visibility
  useEffect(() => {
    const loadStations = async () => {
      try {
        const { data: stations, error } = await supabase
          .from('station_users')
          .select('id, station_name, address, lat, lng');
        if (error) {
          console.error('❌ Error fetching stations (admin):', error);
          return;
        }
        setAllStations(stations || []);

        if (!mapLoaded || !window.google?.maps) return;
        const geocoder = new window.google.maps.Geocoder();
        const results = await Promise.all(
          (stations || []).map((s) => new Promise((resolve) => {
            const latNum = s?.lat != null ? parseFloat(s.lat) : NaN;
            const lngNum = s?.lng != null ? parseFloat(s.lng) : NaN;
            if (!isNaN(latNum) && !isNaN(lngNum)) {
              resolve({ id: s.id, name: s.station_name || 'Station', lat: latNum, lng: lngNum });
              return;
            }
            if (!s?.address) { resolve(null); return; }
            geocoder.geocode({ address: s.address }, (res, status) => {
              if (status === 'OK' && res[0]) {
                const loc = res[0].geometry.location;
                resolve({ id: s.id, name: s.station_name || 'Station', lat: loc.lat(), lng: loc.lng() });
              } else {
                resolve(null);
              }
            });
          }))
        );
        setGeocodedStations(results.filter(Boolean));
      } catch (e) {
        console.error('❌ Error geocoding stations:', e);
      }
    };
    loadStations();
  }, [mapLoaded]);

  // Load responders for assignment dropdown
  useEffect(() => {
    const loadResponders = async () => {
      try {
        const { data, error } = await supabase
          .from('responders')
          .select('id, first_name, last_name, station_id')
          .limit(500);
        if (error) {
          console.error('❌ Error fetching responders:', error);
          return;
        }
        setResponders(data || []);
      } catch (e) {
        console.error('❌ Error loading responders:', e);
      }
    };
    loadResponders();
  }, []);

  // Fetch current assignment and forwarding info for a report
  const loadAssignmentInfo = useCallback(async (reportId) => {
    if (!reportId) return;

    try {
      // 1. Fetch current assignment
      const { data: assignment, error: assignError } = await supabase
        .from('report_assignments')
        .select('assignee_type, assignee_id, assigned_at, note')
        .eq('report_id', reportId)
        .single();

      if (assignError && assignError.code !== 'PGRST116') {
        console.error('Error fetching assignment:', assignError);
      }

      // If we have an assignment and it's a station, get the station name
      if (assignment && assignment.assignee_type === 'station') {
        const { data: stationData } = await supabase
          .from('station_users')
          .select('station_name')
          .eq('id', assignment.assignee_id)
          .single();

        setCurrentAssignment({
          type: assignment.assignee_type,
          id: assignment.assignee_id,
          name: stationData?.station_name || 'Unknown Station',
          assigned_at: assignment.assigned_at,
          note: assignment.note || ''
        });
      } else if (assignment && assignment.assignee_type === 'responder') {
        setCurrentAssignment({
          type: assignment.assignee_type,
          id: assignment.assignee_id,
          name: 'Responder',
          assigned_at: assignment.assigned_at,
          note: assignment.note || ''
        });
      } else {
        setCurrentAssignment(null);
      }

      // 2. Fetch forwarding history
      const { data: forwards, error: forwardError } = await supabase
        .from('report_routes')
        .select('target, note, forwarded_at')
        .eq('report_id', reportId)
        .order('forwarded_at', { ascending: false });

      if (forwardError) {
        console.error('Error fetching forwards:', forwardError);
      }

      // Parse the forwarded stations
      if (forwards && forwards.length > 0) {
        const forwardedStations = await Promise.all(
          forwards.map(async (forward) => {
            // Parse target format: 'station:<id>' or 'agency:police'
            const [targetType, targetId] = forward.target.split(':');
            
            if (targetType === 'station') {
              const { data: stationData } = await supabase
                .from('station_users')
                .select('station_name')
                .eq('id', targetId)
                .single();

              return {
                type: 'station',
                name: stationData?.station_name || 'Unknown Station',
                note: forward.note,
                forwarded_at: forward.forwarded_at
              };
            } else {
              return {
                type: 'agency',
                name: targetId,
                note: forward.note,
                forwarded_at: forward.forwarded_at
              };
            }
          })
        );

        setForwardedTo(forwardedStations);
      } else {
        setForwardedTo([]);
      }
    } catch (err) {
      console.error('Error loading assignment info:', err);
    }
  }, []);

  // Load assignment info when a report is selected
  useEffect(() => {
    if (selectedReport) {
      loadAssignmentInfo(selectedReport.id);
    } else {
      setCurrentAssignment(null);
      setForwardedTo([]);
    }
  }, [selectedReport, loadAssignmentInfo]);

  const handleAssign = useCallback(async () => {
    try {
      if (!selectedReport) {
        alert('Select a fire report first.');
        return;
      }
      if (!assigneeId) {
        alert('Choose an assignee.');
        return;
      }
      const payload = {
        report_id: selectedReport.id,
        assignee_type: assigneeType,
        assignee_id: assigneeId,
        assigned_at: new Date().toISOString()
      };
      // Assignment note processing
      const { error } = await supabase
        .from('report_assignments')
        .upsert({ ...payload, note: assignmentNote && assignmentNote.trim() ? assignmentNote.trim() : null }, { onConflict: 'report_id,assignee_id' });
      if (error) throw error;
      
      // Create notification for the assigned station
      if (assigneeType === 'station') {
        try {
          const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
          const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
          const title = `🚨 New Fire Report Assigned to Your Station`;
          const message = `A fire report has been assigned to your station.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nPlease review the incident details and take appropriate action.`;
          
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: assigneeId,
              user_type: 'station',
              type: 'assignment',
              related_report_id: String(selectedReport.id),
              title: title,
              message: message,
              priority: 'urgent',
              is_read: false
            });
          
          if (notifError) {
            console.error('❌ Error creating station notification:', notifError);
          } else {
            console.log('✅ Created notification for station:', assigneeId);
          }
        } catch (notifErr) {
          console.error('❌ Failed to create notification:', notifErr);
        }
      }
      
      // Snapshot report coordinates so station dashboards can render reliably
      try {
        const lat = parseFloat(selectedReport.latitude);
        const lng = parseFloat(selectedReport.longitude);
        await supabase
          .from('assigned_report_snapshots')
          .upsert({
            report_id: String(selectedReport.id),
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng,
            address: selectedReport.address || selectedReport.geotag_location || null,
            snapshot_json: selectedReport
          }, { onConflict: 'report_id' });
      } catch (snapErr) {
        console.warn('Snapshot upsert failed (table may not exist):', snapErr?.message || snapErr);
      }
      alert('Report assigned successfully.');
      setAssignmentNote('');
      // Reload the assignment info
      loadAssignmentInfo(selectedReport.id);
    } catch (e) {
      console.error('❌ Assign failed:', e);
      alert('Failed to assign report. Check console.');
    }
  }, [selectedReport, assigneeType, assigneeId, assignmentNote, loadAssignmentInfo]);

  const handleRedirect = useCallback(async () => {
    try {
      if (!selectedReport) {
        alert('Select a fire report first.');
        return;
      }
      if (!redirectTarget) {
        alert('Choose a redirect target.');
        return;
      }
      const payload = {
        report_id: selectedReport.id,
        target: redirectTarget,
        note: redirectNote || null,
        forwarded_at: new Date().toISOString()
      };
      const { error } = await supabase
        .from('report_routes')
        .insert(payload);
      if (error) throw error;
      
      // Create notification for forwarded station
      if (redirectTarget && redirectTarget.startsWith('station:')) {
        try {
          const stationId = redirectTarget.split(':')[1];
          const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
          const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
          const noteText = redirectNote ? `\n\nNote: ${redirectNote}` : '';
          const title = `📬 Fire Report Forwarded to Your Station`;
          const message = `A fire report has been forwarded to your station.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}${noteText}\n\nPlease review the incident details.`;
          
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: stationId,
              user_type: 'station',
              type: 'assignment',
              related_report_id: String(selectedReport.id),
              title: title,
              message: message,
              priority: 'high',
              is_read: false
            });
          
          if (notifError) {
            console.error('❌ Error creating forwarding notification:', notifError);
          } else {
            console.log('✅ Created forwarding notification for station:', stationId);
          }
        } catch (notifErr) {
          console.error('❌ Failed to create forwarding notification:', notifErr);
        }
      }
      
      alert('Report forwarded successfully.');
      setRedirectNote('');
      // Reload the forwarding info
      loadAssignmentInfo(selectedReport.id);
    } catch (e) {
      console.error('❌ Redirect failed:', e);
      alert('Failed to forward report. Check console.');
    }
  }, [selectedReport, redirectTarget, redirectNote, loadAssignmentInfo]);

  // Handle auto-selection when both map and reports are loaded
  useEffect(() => {
    if (mapLoaded && fireReports.length > 0) {
      const selectedReportId = localStorage.getItem('selectedReportId');
      // Map loaded, checking for selected report
      if (selectedReportId) {
        console.log('🔍 Searching for report with ID:', selectedReportId);
        
        // Try to find report by UUID first, then by timestamp match
        const reportToSelect = fireReports.find(report => {
          // Direct UUID match
          if (String(report.id) === String(selectedReportId)) {
            console.log('✅ Matched by UUID');
            return true;
          }
          
          // If selectedReportId is a timestamp (numeric), try to match against created_at
          if (/^\d+$/.test(selectedReportId)) {
            const timestampMs = parseInt(selectedReportId);
            const reportDate = new Date(report.created_at);
            const reportTimestamp = reportDate.getTime();
            
            console.log('🔍 Comparing timestamps:', {
              notification: new Date(timestampMs).toISOString(),
              report: report.created_at,
              reportMs: reportTimestamp,
              diff: Math.abs(timestampMs - reportTimestamp)
            });
            
            // Allow 5 minute tolerance for timestamp matching (in case of clock differences)
            const diff = Math.abs(timestampMs - reportTimestamp);
            if (diff < 300000) { // 5 minutes in milliseconds
              console.log('✅ Matched by timestamp within 5 minutes');
              return true;
            }
          }
          
          return false;
        });
        
        console.log('✅ Report match result:', reportToSelect ? 'FOUND' : 'NOT FOUND');
        if (reportToSelect) {
          console.log('📍 Matched report:', reportToSelect.id, reportToSelect.latitude, reportToSelect.longitude);
        }
        
        // Looking for report
        if (reportToSelect) {
          // Auto-selecting report
          setIsAutoSelecting(true);
          setSelectedReport(reportToSelect);
          setPendingSelection(null); // Clear pending selection
          // Center map on the selected fire report
          setMapCenter({
            lat: parseFloat(reportToSelect.latitude),
            lng: parseFloat(reportToSelect.longitude)
          });
          localStorage.removeItem('selectedReportId');
          setTimeout(() => setIsAutoSelecting(false), 2000);
        } else {
          // Report not found
        }
      } else if (pendingSelection) {
        // If we have a pending selection but no localStorage ID, use the pending selection
        // Using pending selection
        setIsAutoSelecting(true);
        setSelectedReport(pendingSelection);
        // Center map on the selected fire report
        setMapCenter({
          lat: parseFloat(pendingSelection.latitude),
          lng: parseFloat(pendingSelection.longitude)
        });
        setPendingSelection(null);
        setTimeout(() => setIsAutoSelecting(false), 2000);
      }
    }
  }, [mapLoaded, fireReports, pendingSelection]);

  // Fallback: Handle selection even if map is slow to load
  useEffect(() => {
    if (fireReports.length > 0 && pendingSelection && !mapLoaded) {
      // If we have reports and a pending selection but map is still loading,
      // wait a bit then try to select anyway
      const fallbackTimeout = setTimeout(() => {
        if (pendingSelection && !mapLoaded) {
          // Fallback selection
          setIsAutoSelecting(true);
          setSelectedReport(pendingSelection);
          setPendingSelection(null);
          setTimeout(() => setIsAutoSelecting(false), 2000);
        }
      }, 5000); // Wait 5 seconds for map to load, then fallback

      return () => clearTimeout(fallbackTimeout);
    }
  }, [fireReports, pendingSelection, mapLoaded]);

  const mapContainerStyle = {
    width: '100%',
    height: 'calc(100vh - 120px)'
  };

  const onLoad = useCallback((map) => {
    // Map loaded
    setMapLoaded(true);
    setMapError(null);
  }, []);

  // Handle LoadScript load
  const handleLoadScriptLoad = useCallback(() => {
    // Google Maps API loaded
  }, []);

  // Handle LoadScript error
  const handleLoadScriptError = useCallback((error) => {
    console.error('❌ Google Maps API error:', error);
    setMapError('Failed to load Google Maps API. Please check your internet connection and refresh the page.');
    setMapLoaded(false);
  }, []);

  const onError = useCallback((error) => {
    console.error('❌ Map error:', error);
    setMapError('Failed to load map. Please refresh the page.');
    setMapLoaded(false);
  }, []);

  const onUnmount = useCallback(() => {
    // Map unmounted
    setMapLoaded(false);
  }, []);

  // Manual refresh function
  const handleManualRefresh = useCallback(() => {
    // Manual refresh triggered
    setMapLoaded(false);
    setMapError(null);
    setMapLoadTimeout(false);
    setRetryCount(prev => prev + 1);
    
    // Force complete re-render of the map component
    setTimeout(() => {
      setShowDashboard(prev => !prev);
      setTimeout(() => setShowDashboard(prev => !prev), 100);
    }, 100);
  }, [retryCount]);

  // Handle marker click to center map and select report
  const handleMarkerClick = useCallback((report) => {
    // Marker clicked
    setSelectedReport(report);
    // Center map on the clicked fire report
    setMapCenter({
      lat: parseFloat(report.latitude),
      lng: parseFloat(report.longitude)
    });
  }, []);

  return (
    <div className="relative">
      {/* Audio Blocked Warning */}
      {audioBlocked && (
        <div 
          onClick={playAlert}
          className="fixed top-24 left-6 z-50 bg-orange-600 text-white rounded-lg shadow-2xl cursor-pointer hover:bg-orange-700 transition-all p-4 max-w-sm"
        >
          <div className="flex items-center space-x-3">
            <svg className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2} />
            </svg>
            <div className="flex-1">
              <p className="font-bold text-sm">Sound Blocked</p>
              <p className="text-xs">Click here to enable fire alarm</p>
            </div>
          </div>
        </div>
      )}

      {/* Fire Alert Indicator - Shows when there are unread fire notifications */}
      {unreadCount > 0 && (
        <div 
          onClick={stopAlert}
          className="fixed top-24 right-6 z-50 bg-red-600 text-white rounded-full shadow-2xl cursor-pointer hover:bg-red-700 transition-all duration-300 animate-pulse"
          style={{ width: '80px', height: '80px' }}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-10 w-10 mb-1" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <span className="text-xs font-bold">{unreadCount} ALERT{unreadCount > 1 ? 'S' : ''}</span>
          </div>
          {/* Pulsing ring effect */}
          <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-75"></div>
        </div>
      )}
      {mapsLoadError && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">🗺️</div>
            <p className="text-red-600 font-semibold mb-2">Failed to load Google Maps API</p>
            <p className="text-gray-600">Please refresh the page.</p>
          </div>
        </div>
      )}
      {isMapsLoaded && (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={15}
          onLoad={onLoad}
          onError={onError}
          onUnmount={onUnmount}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
          }}
        >
          {/* Admin Station Marker - Bureau of Fire Protection Regional Office VII */}
          {mapLoaded && (
            <Marker
              position={adminLocation}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#1E40AF',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 3,
                scale: 25,
              }}
              label={{
                text: '🏢',
                fontSize: '20px'
              }}
              title="🏢 Click to view BFP Regional Office VII details (Your Location)"
              zIndex={2000}
              onClick={() => setShowAdminInfo(true)}
              cursor="pointer"
            />
          )}

          {/* Admin Station Info Window */}
          {showAdminInfo && (
            <InfoWindow
              position={adminLocation}
              onCloseClick={() => setShowAdminInfo(false)}
            >
              <div className="p-3 max-w-sm">
                <h3 className="font-bold text-lg mb-2 text-blue-600">🏢 BFP Regional Office VII</h3>
                <p className="text-sm text-blue-600 font-medium mb-2">📍 Your Current Location</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p><strong>Address:</strong> 6000 Natalio B. Bacalso Ave</p>
                  <p><strong>City:</strong> Cebu City, Cebu 6000</p>
                  <p><strong>Plus Code:</strong> 7VXR+5VG</p>
                  <p><strong>Coordinates:</strong></p>
                  <p className="ml-2">Lat: {adminLocation.lat}</p>
                  <p className="ml-2">Lng: {adminLocation.lng}</p>
                  <p><strong>Status:</strong> <span className="text-green-600 font-semibold">Active</span></p>
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Fire Report Markers */}
          {mapLoaded && fireReports.map((report) => {
            return (
              <Marker
                key={`${report.id}-${report.latitude}-${report.longitude}-${report.address || report.geotag_location || 'no-address'}`}
                position={{
                  lat: parseFloat(report.latitude),
                  lng: parseFloat(report.longitude)
                }}
                onClick={() => handleMarkerClick(report)}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: getMarkerColor(report),
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 4,
                  scale: 30,
                }}
                label={{
                  text: '🔥',
                  fontSize: '32px'
                }}
                zIndex={1000}
              />
            );
          })}

          {/* Stations visibility for Admin: markers and jurisdiction circles */}
          {mapLoaded && geocodedStations.map((s) => (
            <React.Fragment key={s.id}>
              <Marker
                position={{ lat: s.lat, lng: s.lng }}
                title={s.name}
                icon={{
                  url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iNCIgeT0iMTIiIHdpZHRoPSI0MCIgaGVpZ2h0PSIzMiIgcng9IjIiIGZpbGw9IiNlZjQ0NDQiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+CjxyZWN0IHg9IjgiIHk9IjE2IiB3aWR0aD0iMzIiIGhlaWdodD0iMjQiIGZpbGw9IiNmZmZmZmYiLz4KPHJlY3QgeD0iMTIiIHk9IjIwIiB3aWR0aD0iNiIgaGVpZ2h0PSI4IiBmaWxsPSIjZWY0NDQ0Ii8+CjxyZWN0IHg9IjIyIiB5PSIyMCIgd2lkdGg9IjYiIGhlaWdodD0iOCIgZmlsbD0iI2VmNDQ0NCIvPgo8cmVjdCB4PSIzMiIgeT0iMjAiIHdpZHRoPSI2IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMTIiIHk9IjMyIiB3aWR0aD0iNiIgaGVpZ2h0PSI4IiBmaWxsPSIjZWY0NDQ0Ii8+CjxyZWN0IHg9IjIyIiB5PSIzMiIgd2lkdGg9IjYiIGhlaWdodD0iOCIgZmlsbD0iI2VmNDQ0NCIvPgo8cmVjdCB4PSIzMiIgeT0iMzIiIHdpZHRoPSI2IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMjAiIHk9IjQiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMjIiIHk9IjYiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmZmZmYiLz4KPC9zdmc+',
                  scaledSize: new window.google.maps.Size(48, 48),
                  anchor: new window.google.maps.Point(24, 24)
                }}
                zIndex={1200}
              />
              <Circle
                center={{ lat: s.lat, lng: s.lng }}
                radius={jurisdictionRadius}
                options={{
                  fillColor: '#ef4444',
                  fillOpacity: 0.05,
                  strokeColor: '#ef4444',
                  strokeOpacity: 0.6,
                  strokeWeight: 1,
                  clickable: false,
                  zIndex: 1100
                }}
              />
            </React.Fragment>
          ))}

          {/* Info Window for Selected Report */}
          {selectedReport && (
            <InfoWindow
              position={{
                lat: parseFloat(selectedReport.latitude),
                lng: parseFloat(selectedReport.longitude)
              }}
              onCloseClick={() => setSelectedReport(null)}
            >
              <div className="p-0 max-w-md" style={{ minWidth: '420px' }}>
                {/* Header */}
                <div className="bg-red-600 text-white px-4 py-3 rounded-t-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">🔥</span>
                    <h3 className="font-bold text-lg">Fire Report</h3>
                  </div>
                </div>

                <div className="p-4 space-y-3 text-sm bg-white"  style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {/* Reporter Info */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">Reporter:</span>
                    <span className="font-medium text-gray-900">{selectedReport.reporter}</span>
                  </div>

                  {/* Cause */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">Cause:</span>
                    <span className="font-medium text-gray-900">{selectedReport.cause_of_fire || 'Hayssjshs'}</span>
                  </div>

                  {/* Fire Alarm Level */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">Fire Alarm Level:</span>
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: getMarkerColor(selectedReport) }}
                    >
                      {cleanAlarmLevel(resolveAlarmLevel(selectedReport))}
                    </span>
                  </div>

                  {/* AI Fire Detection */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">AI Fire Detection:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedReport.prediction === 'Fire' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      {selectedReport.prediction}{selectedReport.confidence ? ` (${selectedReport.confidence})` : ''}
                    </span>
                  </div>

                  {/* Smoke Analysis */}
                  {(selectedReport.smoke_intensity || selectedReport.smoke_confidence) && (
                    <div className="flex items-start space-x-2">
                      <span className="text-gray-500">Smoke Analysis:</span>
                      <span className="font-medium text-gray-900">{selectedReport.smoke_intensity || ''} {selectedReport.smoke_confidence || ''}</span>
                    </div>
                  )}

                  {/* Structure */}
                  {selectedReport.structure && (
                    <div className="flex items-start space-x-2">
                      <span className="text-gray-500">Structure:</span>
                      <span className="font-medium text-gray-900">{selectedReport.structure}{selectedReport.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}</span>
                    </div>
                  )}

                  {/* Structures Affected */}
                  {(() => {
                    const cleanStructuresValue = (value) => {
                      if (!value) return null;
                      const str = String(value);
                      if (str.toLowerCase().includes('count not provided') || 
                          str.toLowerCase().includes('not provided') ||
                          str.toLowerCase().includes('unknown -')) {
                        return null;
                      }
                      const num = Number(value);
                      if (!isNaN(num) && isFinite(num)) {
                        return num;
                      }
                      return null;
                    };
                    const structures = cleanStructuresValue(selectedReport.number_of_structures_on_fire);
                    return structures != null ? (
                      <div className="flex items-start space-x-2">
                        <span className="text-gray-500">Structures Affected:</span>
                        <span className="font-medium text-gray-900">{structures} structure(s)</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Location */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">Location:</span>
                    <span className="font-medium text-gray-900">{selectedReport.address || selectedReport.geotag_location}</span>
                  </div>

                  {/* Reported Time */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">Reported:</span>
                    <span className="font-medium text-gray-900">{selectedReport.formatted_timestamp}</span>
                  </div>

                  {/* Fire Image */}
                  {selectedReport.image_url && (
                    <div className="mt-2">
                      <img 
                        src={selectedReport.image_url} 
                        alt="Fire report" 
                        className="w-full h-48 object-cover rounded-lg shadow-sm"
                      />
                    </div>
                  )}
                  {/* Current Assignment Display */}
                  {currentAssignment && (
                    <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                      <div className="flex items-start space-x-2">
                        <span className="text-lg">📍</span>
                        <div className="flex-1">
                          <p className="font-bold text-blue-900 text-sm mb-1">Currently Assigned To:</p>
                          <p className="text-blue-800 font-semibold">{currentAssignment.name}</p>
                          <p className="text-blue-600 text-xs mt-1">
                            Assigned: {new Date(currentAssignment.assigned_at).toLocaleString()}
                          </p>
                          {currentAssignment.note && (
                            <p className="text-blue-700 text-xs mt-1 italic">
                              Note: {currentAssignment.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Forwarded To Display */}
                  {forwardedTo.length > 0 && (
                    <div className="mt-3 bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
                      <div className="flex items-start space-x-2">
                        <span className="text-lg">📨</span>
                        <div className="flex-1">
                          <p className="font-bold text-amber-900 text-sm mb-2">Forwarded To:</p>
                          {forwardedTo.map((forward, index) => (
                            <div key={index} className={`${index > 0 ? 'mt-2 pt-2 border-t border-amber-200' : ''}`}>
                              <p className="text-amber-800 font-semibold">{forward.name}</p>
                              {forward.note && (
                                <p className="text-amber-700 text-xs mt-1 italic">
                                  Note: {forward.note}
                                </p>
                              )}
                              <p className="text-amber-600 text-xs mt-1">
                                Forwarded: {new Date(forward.forwarded_at).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assignment Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="font-bold text-gray-900 mb-3">Assignment</p>
                    <div className="space-y-2">
                      <select 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={assigneeId} 
                        onChange={(e) => setAssigneeId(e.target.value)}
                      >
                        <option value="">Select station…</option>
                        {allStations.map(s => (
                          <option key={s.id} value={s.id}>{s.station_name || 'Station'}</option>
                        ))}
                      </select>
                      <textarea
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="3"
                        placeholder="Assignment note (optional)"
                        value={assignmentNote || ''}
                        onChange={(e) => setAssignmentNote((e.target.value || '').toString())}
                      ></textarea>
                      <button 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors" 
                        onClick={handleAssign}
                      >
                        Assign
                      </button>
                      <p className="text-xs text-gray-500 mt-1">You can reassign anytime — the latest assignment is active.</p>
                    </div>
                  </div>

                  {/* Redirect/Forward Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="font-bold text-gray-900 mb-3">Redirect/Forward</p>
                    <div className="space-y-2">
                      <select 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" 
                        value={redirectTarget} 
                        onChange={(e) => setRedirectTarget(e.target.value)}
                      >
                        <option value="">Choose station…</option>
                        {allStations.map(s => (
                          <option key={`st-${s.id}`} value={`station:${s.id}`}>{s.station_name || 'Station'}</option>
                        ))}
                      </select>
                      <textarea 
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" 
                        rows="3" 
                        placeholder="Note (optional)" 
                        value={redirectNote} 
                        onChange={(e) => setRedirectNote(e.target.value)}
                      ></textarea>
                      <button 
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors" 
                        onClick={handleRedirect}
                      >
                        Forward
                      </button>
                      <p className="text-xs text-gray-500 mt-1">Forwarding keeps the original assignment and records provenance.</p>
                    </div>
                  </div>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}
      
      {/* Loading Overlay */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600 mb-4">Loading map...</p>
            {mapLoadTimeout && (
              <div>
                <p className="text-gray-500 text-sm mb-3">Map is taking longer than expected to load.</p>
                <button
                  onClick={handleManualRefresh}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 mx-auto"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh Map</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auto-selection Indicator */}
      {isAutoSelecting && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span className="font-medium">Locating selected report...</span>
        </div>
      )}

      {/* Pending Selection Indicator */}
      {pendingSelection && !mapLoaded && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="animate-pulse rounded-full h-4 w-4 bg-white"></div>
          <span className="font-medium">Report selected, waiting for map to load...</span>
        </div>
      )}

      {/* Error Overlay */}
      {mapError && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">🗺️</div>
            <p className="text-red-600 font-semibold mb-2">Map Error</p>
            <p className="text-gray-600 mb-4">{mapError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}
      
      {/* Toggle Button for Dashboard Panel */}
      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={() => setShowDashboard(!showDashboard)}
          className="bg-white hover:bg-gray-50 rounded-lg shadow-lg border border-gray-200 p-3 transition-all duration-200 group"
          title={showDashboard ? "Hide Dashboard" : "Show Dashboard"}
        >
          <svg 
            className={`w-5 h-5 text-red-600 transition-transform duration-200 ${showDashboard ? 'rotate-180' : ''}`} 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Professional Admin Dashboard Panel - Compact & Toggleable */}
      {showDashboard && (
        <div className="absolute top-4 left-16 bg-white backdrop-blur-sm bg-opacity-98 rounded-lg shadow-xl border border-gray-100 z-20 w-64">
          {/* Compact Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 p-3 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm tracking-wide">Admin Dashboard</h3>
                <p className="text-red-100 text-xs">Fire Emergency</p>
              </div>
              <button 
                onClick={() => setShowDashboard(false)}
                className="text-white hover:text-red-200 transition-colors"
                title="Close Dashboard"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {/* Active Reports Section - Compact */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="bg-red-100 p-1.5 rounded-md">
                    <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Active Reports</p>
                    <p className="text-xs text-gray-500">Real-time incidents</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-red-600">{fireReports.length}</div>
                  <div className="text-xs text-gray-500">incidents</div>
                </div>
              </div>
            
            {reportsLoading && (
              <div className="flex items-center justify-center space-x-2 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                <span className="text-gray-600 text-sm">Updating reports...</span>
              </div>
            )}
            
              <button 
                onClick={fetchFireReports}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                disabled={reportsLoading}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <span>Refresh</span>
              </button>
          </div>
          
            {/* Fire Alarm Levels Legend - Compact & Toggleable */}
            <div className="bg-gray-50 rounded-lg">
              {/* Legend Header with Toggle Button */}
              <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setShowLegend(!showLegend)}>
                <div className="flex items-center space-x-2">
                  <div className="bg-orange-100 p-1.5 rounded-md">
                    <svg className="w-3 h-3 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Fire Alarm Levels</p>
                    <p className="text-xs text-gray-500">Severity indicators</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <svg 
                    className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showLegend ? 'transform rotate-180' : ''}`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            
              {/* Legend Content - Collapsible & Compact */}
              {showLegend && (
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#93c5fd' }}></div>
                      <span className="text-gray-700 font-medium">Fire Out</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#fef3c7' }}></div>
                      <span className="text-gray-700 font-medium">First Alarm</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#fed7aa' }}></div>
                      <span className="text-gray-700 font-medium">Second Alarm</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#fecaca' }}></div>
                      <span className="text-gray-700 font-medium">Third Alarm</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#ef4444' }}></div>
                      <span className="text-gray-700 font-medium">Fifth+ Alarm</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#450a0a' }}></div>
                      <span className="text-gray-700 font-medium">General Alarm</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Adashboard;