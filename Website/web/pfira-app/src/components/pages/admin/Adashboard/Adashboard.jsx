import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, Circle, useJsApiLoader } from '@react-google-maps/api';
import { supabase } from '../../../../config/supabase';
import { useNotifications } from '../../../../contexts/NotificationContext';
import { checkStationIsBusy, findNearestStations, findNearestStationsToStation, handleAssignmentResponse, calculateDistance } from '../../../../utils/assignmentHelpers';

// Move libraries outside component to prevent re-initialization
const GOOGLE_MAPS_LIBRARIES = ['places'];
const GOOGLE_MAPS_API_KEY = 'AIzaSyBX5taF1AgNhicxw5_BXUJDs6ouniAuiQI';

const Adashboard = () => {
  const { unreadCount, stopAlert, audioBlocked, playAlert } = useNotifications();
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
  const [jurisdictionRadius] = useState(2000); // 2km in meters
  const [responders, setResponders] = useState([]);
  const [autoAssignmentsInProgress, setAutoAssignmentsInProgress] = useState(new Set()); // Track assignments in progress to avoid duplicates
  const [assigneeType, setAssigneeType] = useState('station'); // 'station' | 'responder'
  const [assigneeId, setAssigneeId] = useState('');
  const [redirectTarget, setRedirectTarget] = useState(''); // e.g., 'station:<id>' | 'agency:police'
  const [redirectNote, setRedirectNote] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [currentAssignment, setCurrentAssignment] = useState(null); // Current assignment info
  const [forwardedTo, setForwardedTo] = useState([]); // List of stations this was forwarded to
  const [showWaitingApprovalModal, setShowWaitingApprovalModal] = useState(false);
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [nearestStations, setNearestStations] = useState([]);
  const [pendingAssignment, setPendingAssignment] = useState(null); // {reportId, stationId, stationName}
  const [selectedRerouteStation, setSelectedRerouteStation] = useState('');
  const [rerouteNote, setRerouteNote] = useState(''); // Optional message for reroute/forward
  const [isRerouteForForwarding, setIsRerouteForForwarding] = useState(false); // Track if reroute modal is for forwarding (not declined)
  const [isIncidentsModalMinimized, setIsIncidentsModalMinimized] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null); // Selected station for details modal
  const [stationResponders, setStationResponders] = useState([]); // Responders for selected station
  const [loadingResponders, setLoadingResponders] = useState(false); // Loading state for responders
  const [clusterIndex, setClusterIndex] = useState(0); // Pager index for clustered reports
  const noFireNotifiedRef = useRef(new Set()); // track notified report IDs to avoid duplicates
  const pendingAssignmentRef = useRef(null); // Ref to track current pendingAssignment for real-time listeners

  // Helpers to hide "No Fire" + "No Smoke" reports and notify citizen once
  const isNoFireNoSmoke = (report) => {
    const pred = (report?.prediction || '').toLowerCase();
    const smoke = (report?.smoke_detection || '').toLowerCase();
    return pred.includes('no fire') && smoke.includes('no smoke');
  };

  const getCitizenId = (report) => {
    return (
      report?.user_id ||
      report?.reporterId ||
      report?.reporter_id ||
      report?.userId ||
      null
    );
  };

  const notifyCitizenInvalid = async (report) => {
    const citizenId = getCitizenId(report);
    if (!citizenId) return;
    if (noFireNotifiedRef.current.has(String(report.id))) return;
    try {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', citizenId)
        .eq('related_report_id', String(report.id))
        .eq('type', 'system')
        .ilike('title', '%invalidated%')
        .limit(1);
      if (existing && existing.length > 0) {
        noFireNotifiedRef.current.add(String(report.id));
        return;
      }

      const title = 'Report invalidated: No smoke / no fire detected';
      const message = 'CNN has detected this photo as no smoke and no fire, so it will not appear on the map dashboard. Please submit another image if you believe this is inaccurate.';

      await supabase.from('notifications').insert({
        user_id: citizenId,
        user_type: 'citizen',
        type: 'system',
        title,
        message,
        related_report_id: String(report.id),
        is_read: false,
        priority: 'normal'
      });

      noFireNotifiedRef.current.add(String(report.id));
    } catch (err) {
      console.warn('Notification to citizen failed (non-blocking):', err);
    }
  };

  const [stationActiveCounts, setStationActiveCounts] = useState({}); // {stationId: busyCount} for reroute modal
  // Load Google Maps API once globally to avoid duplicate script loads
  const { isLoaded: isMapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    id: 'google-map-admin',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
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

  // Calculate distance between two coordinates using Haversine formula (returns distance in meters)
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  };

  // Find the nearest station within jurisdiction for a report
  const findNearestStationInJurisdiction = (reportLat, reportLng, stations) => {
    if (!reportLat || !reportLng || isNaN(reportLat) || isNaN(reportLng)) {
      return null;
    }

    let nearestStation = null;
    let nearestDistance = Infinity;

    stations.forEach(station => {
      if (!station.lat || !station.lng || isNaN(station.lat) || isNaN(station.lng)) {
        return; // Skip stations without valid coordinates
      }

      const distance = calculateDistance(reportLat, reportLng, station.lat, station.lng);
      
      // Check if within jurisdiction radius and is the nearest
      if (distance <= jurisdictionRadius && distance < nearestDistance) {
        nearestDistance = distance;
        nearestStation = {
          ...station,
          distance: distance
        };
      }
    });

    return nearestStation;
  };

  // Auto-assign report to nearest station within jurisdiction
  const autoAssignReportToStation = useCallback(async (report, station) => {
    const reportId = String(report.id);
    
    // Prevent duplicate assignments
    if (autoAssignmentsInProgress.has(reportId)) {
      return; // Already processing this report
    }

    try {
      setAutoAssignmentsInProgress(prev => new Set(prev).add(reportId));

      // Check if report is already assigned to a station
      const { data: existingAssignments, error: checkError } = await supabase
        .from('report_assignments')
        .select('assignee_id, assignee_type')
        .eq('report_id', reportId)
        .eq('assignee_type', 'station');

      if (checkError) {
        console.error('❌ Error checking existing assignments:', checkError);
        return;
      }

      // If already assigned to a station, skip auto-assignment
      if (existingAssignments && existingAssignments.length > 0) {
        console.log(`ℹ️ Report ${reportId} already assigned to station, skipping auto-assignment`);
        return;
      }

      // Check if station is busy
      const busyCheck = await checkStationIsBusy(station.id);
      const assignmentStatus = busyCheck.isBusy ? 'pending' : 'accepted';

      // Create assignment
      const assignmentPayload = {
        report_id: reportId,
        assignee_type: 'station',
        assignee_id: station.id,
        assigned_at: new Date().toISOString(),
        status: assignmentStatus,
        assignment_source: 'automatic',
        note: `Auto-assigned: Report is within ${station.name}'s jurisdiction (${Math.round(station.distance)}m away)`
      };

      const { error: assignError } = await supabase
        .from('report_assignments')
        .upsert(assignmentPayload, { onConflict: 'report_id,assignee_type,assignee_id' });

      if (assignError) {
        console.error('❌ Error auto-assigning report:', assignError);
        return;
      }

      console.log(`✅ Auto-assigned report ${reportId} to ${station.name} (${Math.round(station.distance)}m away) - Status: ${assignmentStatus}`);

      // Create notification for the assigned station
      const locationInfo = report.address || report.geotag_location || 'Location unavailable';
      const reporterName = report.reporter_name || report.reporter || 'Unknown Reporter';
      
      let title, message;
      if (busyCheck.isBusy) {
        title = `🚨 New Fire Report - Auto-Assigned (Action Required)`;
        message = `A fire report has been automatically assigned to your station.\n\nDistance: ${Math.round(station.distance)}m\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nYou are currently handling ${busyCheck.busyCount} other incident(s). Would you like to request forwarding to another station?`;
      } else {
        title = `🚨 New Fire Report - Auto-Assigned to Your Station`;
        message = `A fire report has been automatically assigned to your station because it is within your jurisdiction.\n\nDistance: ${Math.round(station.distance)}m\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nPlease review the incident details and take appropriate action.`;
      }

      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: station.id,
          user_type: 'station',
          type: 'assignment',
          related_report_id: reportId,
          title: title,
          message: message,
          priority: 'urgent',
          is_read: false
        });

      if (notifError) {
        console.error('❌ Error creating auto-assignment notification:', notifError);
      } else {
        console.log(`✅ Created notification for station: ${station.name}`);
      }

      // Snapshot report coordinates
      try {
        const lat = parseFloat(report.latitude);
        const lng = parseFloat(report.longitude);
        await supabase
          .from('assigned_report_snapshots')
          .upsert({
            report_id: reportId,
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng,
            address: report.address || report.geotag_location || null,
            snapshot_json: report
          }, { onConflict: 'report_id' });
      } catch (snapErr) {
        console.warn('Snapshot upsert failed (table may not exist):', snapErr?.message || snapErr);
      }

    } catch (error) {
      console.error('❌ Error in auto-assignment process:', error);
    } finally {
      setAutoAssignmentsInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  }, [autoAssignmentsInProgress, jurisdictionRadius]);

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
    
    // Fire alarm levels with appropriate colors (check both "1st" and "first" formats)
    if (level.includes('first alarm') || level.includes('1st alarm')) return '#fef3c7'; // Light yellow
    if (level.includes('second alarm') || level.includes('2nd alarm')) return '#fed7aa'; // Light orange
    if (level.includes('third alarm') || level.includes('3rd alarm')) return '#fecaca'; // Light red
    if (level.includes('fourth alarm') || level.includes('4th alarm')) return '#f87171'; // Medium red
    if (level.includes('fifth alarm') || level.includes('5th alarm')) return '#ef4444'; // Red
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
    if (resolved) {
      const color = getAlarmLevelColor(resolved);
      console.log('Report', report.id, 'resolved:', resolved, 'color:', color);
      return color;
    }
    
    // Fallback to prediction-based colors
    console.log('Report', report.id, 'no alarm, using prediction:', report.prediction);
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

  // AI-Assisted Duplicate Report Consolidation
  const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Generate custom marker icon with badge for clustered reports
  const getMarkerIconWithBadge = (report) => {
    const reportStrength = report.reportStrength || 1;
    const markerColor = getMarkerColor(report);
    
    // If only 1 report, use the standard icon
    if (reportStrength === 1) {
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: markerColor,
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 4,
        scale: 30,
      };
    }

    // Create SVG with badge for multiple reports
    const svg = `
      <svg width="60" height="60" xmlns="http://www.w3.org/2000/svg">
        <!-- Main marker circle -->
        <circle cx="30" cy="30" r="28" fill="${markerColor}" stroke="#FFFFFF" stroke-width="4"/>
        <!-- Fire emoji area (centered) -->
        <text x="30" y="40" font-size="32" text-anchor="middle">🔥</text>
        <!-- Badge circle in upper right corner -->
        <circle cx="48" cy="12" r="12" fill="#EF4444" stroke="#FFFFFF" stroke-width="2"/>
        <!-- Badge text -->
        <text x="48" y="17" font-size="14" font-weight="bold" text-anchor="middle" fill="#FFFFFF">${reportStrength}</text>
      </svg>
    `;
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(60, 60),
      anchor: new window.google.maps.Point(30, 30)
    };
  };

  const clusterReports = (reports = []) => {
    const consolidated = [];
    const getTimestampMs = (report) => {
      const candidates = [
        report?.updated_at,
        report?.timestamp,
        report?.created_at
      ];
      for (const c of candidates) {
        if (c) {
          const t = new Date(c).getTime();
          if (!isNaN(t)) return t;
        }
      }
      return null;
    };

    reports.forEach((report) => {
      const lat = parseFloat(report.latitude);
      const lng = parseFloat(report.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const tsMs = getTimestampMs(report);
      const reportDate = tsMs ? new Date(tsMs) : null;

      let matchedIndex = -1;
      consolidated.some((cluster, idx) => {
        const dist = haversineDistanceMeters(
          lat,
          lng,
          parseFloat(cluster.latitude),
          parseFloat(cluster.longitude)
        );
        if (dist > 50) return false;

        if (reportDate && cluster.latestTimestamp) {
          const diffMinutes = Math.abs(reportDate.getTime() - cluster.latestTimestamp.getTime()) / 60000;
          if (diffMinutes <= 10) {
            matchedIndex = idx;
            return true;
          }
        }
        return false;
      });

      if (matchedIndex !== -1) {
        const cluster = consolidated[matchedIndex];
        cluster.reports.push(report);
        cluster.reportStrength = (cluster.reportStrength || 1) + 1;

        const currentLatest = cluster.latestTimestamp;
        const shouldUpdateRep = reportDate && (!currentLatest || reportDate > currentLatest);
        if (shouldUpdateRep) {
          cluster.representativeReport = report;
          cluster.latitude = report.latitude;
          cluster.longitude = report.longitude;
        }

        if (reportDate && (!currentLatest || reportDate > currentLatest)) {
          cluster.latestTimestamp = reportDate;
          cluster.formatted_timestamp = report.formatted_timestamp || report.timestamp || report.updated_at || report.created_at;
        }

        if (report.image_url) {
          cluster.representativeImageUrl = report.image_url;
        }
      } else {
        consolidated.push({
          ...report,
          reports: [report],
          reportStrength: 1,
          representativeReport: report,
          representativeImageUrl: report.image_url,
          latestTimestamp: reportDate
        });
      }
    });

    return consolidated;
  };

  // Fetch fire reports from the API
  const fetchFireReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        // Fetched fire reports
        
        // Filter reports that have valid coordinates AND are not cancelled/fire out AND not unvalidated no-fire/no-smoke
        const filteredReports = [];
        for (const report of data) {
          const hasCoords = report.latitude && report.longitude && !isNaN(report.latitude) && !isNaN(report.longitude);
          const statusText = (report.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          if (!hasCoords || isCancelled || isFireOut) continue;
          // Skip No Fire/No Smoke reports UNLESS they've been validated by admin
          // Also skip any report that is currently marked as invalidated
          if (report.invalidated || (isNoFireNoSmoke(report) && !report.validated)) {
            if (!report.invalidated && isNoFireNoSmoke(report) && !report.validated) {
              await notifyCitizenInvalid(report);
            }
            continue;
          }
          filteredReports.push(report);
        }
        
        // Sort reports by newest first (most recent created_at or updated_at at the top)
        const sortedReports = filteredReports.sort((a, b) => {
          // Get the most recent timestamp for each report (prefer updated_at if available, else created_at)
          const getTimestamp = (report) => {
            if (report.updated_at) {
              return new Date(report.updated_at).getTime();
            }
            if (report.created_at) {
              return new Date(report.created_at).getTime();
            }
            if (report.timestamp) {
              return new Date(report.timestamp).getTime();
            }
            return 0;
          };
          
          const timeA = getTimestamp(a);
          const timeB = getTimestamp(b);
          
          // Sort descending (newest first)
          return timeB - timeA;
        });
        
        setFireReports(sortedReports);
        
        // Check if there's a selected report ID from navigation
        const selectedReportId = localStorage.getItem('selectedReportId');
        if (selectedReportId) {
          const reportToSelect = sortedReports.find(report => String(report.id) === String(selectedReportId));
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
    
    // Set up periodic refresh to get new reports (re-sorts by newest first)
    const refreshInterval = setInterval(() => {
      // Refreshing fire reports (will re-sort by newest first)
      fetchFireReports();
    }, 15000); // Refresh every 15 seconds to catch status updates faster
    
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
          .select('id, station_name, address, lat, lng, status');
        if (error) {
          console.error('❌ Error fetching stations (admin):', error);
          return;
        }
        const activeStations = (stations || []).filter(s => (s.status || 'active').toLowerCase() === 'active');
        setAllStations(activeStations);

        if (!mapLoaded || !window.google?.maps) return;
        const geocoder = new window.google.maps.Geocoder();
        const results = await Promise.all(
          (activeStations || []).map((s) => new Promise((resolve) => {
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
        
        // Remove duplicate stations based on coordinates to avoid overlapping circles
        const validResults = results.filter(Boolean);
        const uniqueStations = [];
        const coordsSet = new Set();
        
        validResults.forEach(station => {
          const coordKey = `${station.lat.toFixed(6)},${station.lng.toFixed(6)}`;
          if (!coordsSet.has(coordKey)) {
            coordsSet.add(coordKey);
            uniqueStations.push(station);
          }
        });
        
        setGeocodedStations(uniqueStations);
      } catch (e) {
        console.error('❌ Error geocoding stations:', e);
      }
    };
    loadStations();
  }, [mapLoaded]);

  // Auto-assign reports to stations within jurisdiction when both reports and stations are loaded
  useEffect(() => {
    if (geocodedStations.length > 0 && fireReports.length > 0) {
      // Check for unassigned reports and auto-assign them
      fireReports.forEach(report => {
        const reportLat = parseFloat(report.latitude);
        const reportLng = parseFloat(report.longitude);
        
        if (!isNaN(reportLat) && !isNaN(reportLng)) {
          const nearestStation = findNearestStationInJurisdiction(
            reportLat, 
            reportLng, 
            geocodedStations
          );
          
          if (nearestStation) {
            // Auto-assign asynchronously (don't block UI)
            autoAssignReportToStation(report, nearestStation).catch(err => {
              console.error('Error in auto-assignment:', err);
            });
          }
        }
      });
    }
  }, [geocodedStations, fireReports, autoAssignReportToStation]);

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
      // 1. Fetch current assignment (try to include status if column exists)
      const { data: assignment, error: assignError } = await supabase
        .from('report_assignments')
        .select('assignee_type, assignee_id, assigned_at, note, status')
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
          note: assignment.note || '',
          status: assignment.status || 'accepted' // Default to accepted if status column doesn't exist
        });
      } else if (assignment && assignment.assignee_type === 'responder') {
        setCurrentAssignment({
          type: assignment.assignee_type,
          id: assignment.assignee_id,
          name: 'Responder',
          assigned_at: assignment.assigned_at,
          note: assignment.note || '',
          status: assignment.status || 'accepted'
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

  // Real-time listener for assignment responses (when pendingAssignment is set)
  useEffect(() => {
    if (!pendingAssignment) {
      pendingAssignmentRef.current = null;
      return;
    }

    // Update ref immediately
    pendingAssignmentRef.current = { ...pendingAssignment };

    const channel = supabase
      .channel(`assignment-responses-${pendingAssignment.reportId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'report_assignments',
        filter: `report_id=eq.${pendingAssignment.reportId}`
      }, async (payload) => {
        const assignment = payload.new;
        // Use ref to get the latest pendingAssignment (avoids closure issues)
        const currentPending = pendingAssignmentRef.current;
        if (!currentPending) return;
        
        // Check if this assignment matches the CURRENT expected station ID
        if (assignment.assignee_type === 'station' && 
            String(assignment.assignee_id) === String(currentPending.stationId)) {
          
          if (assignment.status === 'accepted') {
            // Station accepted - close waiting modal and show success
            setShowWaitingApprovalModal(false);
            alert(`✅ ${currentPending.stationName} has accepted the assignment.`);
            setPendingAssignment(null);
            pendingAssignmentRef.current = null;
            if (selectedReport) {
              loadAssignmentInfo(selectedReport.id);
            }
          } else if (assignment.status === 'declined') {
            // Station declined - show reroute modal with nearest stations
            setShowWaitingApprovalModal(false);
            
            // Use the current pendingAssignment to get the declined station ID
            const declinedStationId = currentPending.stationId;
            
            // Get report location for finding nearest stations
            const reportLat = parseFloat(selectedReport?.latitude);
            const reportLng = parseFloat(selectedReport?.longitude);
            
            const incidentLocation = (!isNaN(reportLat) && !isNaN(reportLng)) 
              ? { lat: reportLat, lng: reportLng } 
              : null;
            
            let nearest = [];
            
            // First, try to find stations near the report location
            if (!isNaN(reportLat) && !isNaN(reportLng)) {
              nearest = await findNearestStations(
                reportLat, 
                reportLng, 
                declinedStationId, 
                5,
                incidentLocation
              );
            }
            
            // If no stations found near report, find stations near the declined station
            if (nearest.length === 0) {
              console.log('📍 No stations found near report location, finding stations near declined station...');
              nearest = await findNearestStationsToStation(
                declinedStationId,
                declinedStationId,
                5,
                incidentLocation
              );
            }
            
            // If still no stations, fallback to ALL stations sorted by distance to incident
            if (nearest.length === 0) {
              console.log('📍 Fallback: Fetching all stations...');
              const { data: stations, error: stationsError } = await supabase
                .from('station_users')
                .select('id, station_name, lat, lng')
                .eq('status', 'active')
                .neq('id', declinedStationId);
              
              if (stationsError) {
                console.error('❌ Error fetching stations:', stationsError);
              }
              
              console.log(`📍 Found ${stations?.length || 0} stations in database`);
              
              // Calculate distances to incident for all stations and sort
              if (stations && stations.length > 0) {
                const stationsWithDistance = stations
                  .map(station => {
                    const stationLat = parseFloat(station.lat);
                    const stationLng = parseFloat(station.lng);
                    if (!isNaN(stationLat) && !isNaN(stationLng) && incidentLocation) {
                      const distanceToIncident = calculateDistance(
                        stationLat,
                        stationLng,
                        incidentLocation.lat,
                        incidentLocation.lng
                      );
                      return {
                        ...station,
                        distance: 0, // No reference distance
                        distanceKm: '0',
                        distanceToIncident: distanceToIncident,
                        distanceToIncidentKm: (distanceToIncident / 1000).toFixed(2)
                      };
                    }
                    // If no coordinates or incident location, put at end but still include
                    return {
                      ...station,
                      distance: 0,
                      distanceKm: '0',
                      distanceToIncident: incidentLocation ? Infinity : null,
                      distanceToIncidentKm: null
                    };
                  })
                  .sort((a, b) => {
                    // Sort by distance to incident (stations with null/Infinity distance go to end)
                    if (a.distanceToIncident === null || a.distanceToIncident === Infinity) return 1;
                    if (b.distanceToIncident === null || b.distanceToIncident === Infinity) return -1;
                    return a.distanceToIncident - b.distanceToIncident;
                  });
                
                console.log(`📍 Prepared ${stationsWithDistance.length} stations with distances`);
                nearest = stationsWithDistance;
              } else {
                console.warn('⚠️ No stations found in database');
                nearest = stations || [];
              }
            }
            
            setNearestStations(nearest);
            setIsRerouteForForwarding(false); // This is for declined assignment, not forwarding
            setRerouteNote('');
            setShowRerouteModal(true);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingAssignment, selectedReport, loadAssignmentInfo]);

  // Global listener for declined assignments (works even if admin closed waiting modal)
  useEffect(() => {
    const channel = supabase
      .channel('global-declined-assignments')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'report_assignments',
        filter: 'status=eq.declined'
      }, async (payload) => {
        const assignment = payload.new;
        
        // Only handle station declines
        if (assignment.assignee_type !== 'station') return;
        
        // Check if status is actually 'declined' (not just any update)
        if (assignment.status !== 'declined') return;
        
        // Check if this is already being handled by the pendingAssignment listener
        // Only skip if we have an exact match AND the waiting modal is still open
        if (pendingAssignment && 
            String(assignment.report_id) === String(pendingAssignment.reportId) &&
            String(assignment.assignee_id) === String(pendingAssignment.stationId) &&
            showWaitingApprovalModal) {
          // This is already handled by the pendingAssignment listener
          return;
        }
        
        console.log('🚨 Station declined assignment detected (global listener):', assignment);
        
        // Get station name
        const { data: stationData } = await supabase
          .from('station_users')
          .select('station_name')
          .eq('id', assignment.assignee_id)
          .single();
        
        const stationName = stationData?.station_name || 'Unknown Station';
        
        // Get report details
        const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';
        let reportData = null;
        try {
          const reportRes = await fetch(`${API_URL}/get_reports`);
          if (reportRes.ok) {
            const allReports = await reportRes.json();
            reportData = allReports.find(r => String(r.id) === String(assignment.report_id));
          }
        } catch (err) {
          console.error('Error fetching report data:', err);
        }
        
        // Set pending assignment info for reroute modal
        const pendingAssign = {
          reportId: assignment.report_id,
          stationId: assignment.assignee_id,
          stationName: stationName
        };
        setPendingAssignment(pendingAssign);
        pendingAssignmentRef.current = pendingAssign;
        
        // Close waiting modal if open
        setShowWaitingApprovalModal(false);
        
        // Get report location for finding nearest stations
        const reportLat = reportData ? parseFloat(reportData.latitude) : NaN;
        const reportLng = reportData ? parseFloat(reportData.longitude) : NaN;
        
        const incidentLocation = (!isNaN(reportLat) && !isNaN(reportLng)) 
          ? { lat: reportLat, lng: reportLng } 
          : null;
        
        let nearest = [];
        
        // First, try to find stations near the report location
        if (!isNaN(reportLat) && !isNaN(reportLng)) {
          nearest = await findNearestStations(
            reportLat, 
            reportLng, 
            assignment.assignee_id, 
            5,
            incidentLocation
          );
        }
        
        // If no stations found near report, find stations near the declined station
        if (nearest.length === 0) {
          console.log('📍 No stations found near report location, finding stations near declined station...');
          nearest = await findNearestStationsToStation(
            assignment.assignee_id,
            assignment.assignee_id,
            5,
            incidentLocation
          );
        }
        
        // If still no stations, fallback to ALL stations sorted by distance to incident
        if (nearest.length === 0) {
          console.log('📍 Fallback: Fetching all stations...');
          const { data: stations, error: stationsError } = await supabase
            .from('station_users')
            .select('id, station_name, lat, lng')
            .neq('id', assignment.assignee_id);
          
          if (stationsError) {
            console.error('❌ Error fetching stations:', stationsError);
          }
          
          console.log(`📍 Found ${stations?.length || 0} stations in database`);
          
          // Calculate distances to incident for all stations and sort
          if (stations && stations.length > 0) {
            const stationsWithDistance = stations
              .map(station => {
                const stationLat = parseFloat(station.lat);
                const stationLng = parseFloat(station.lng);
                if (!isNaN(stationLat) && !isNaN(stationLng) && incidentLocation) {
                  const distanceToIncident = calculateDistance(
                    stationLat,
                    stationLng,
                    incidentLocation.lat,
                    incidentLocation.lng
                  );
                  return {
                    ...station,
                    distance: 0, // No reference distance
                    distanceKm: '0',
                    distanceToIncident: distanceToIncident,
                    distanceToIncidentKm: (distanceToIncident / 1000).toFixed(2)
                  };
                }
                // If no coordinates or incident location, put at end but still include
                return {
                  ...station,
                  distance: 0,
                  distanceKm: '0',
                  distanceToIncident: incidentLocation ? Infinity : null,
                  distanceToIncidentKm: null
                };
              })
              .sort((a, b) => {
                // Sort by distance to incident (stations with null/Infinity distance go to end)
                if (a.distanceToIncident === null || a.distanceToIncident === Infinity) return 1;
                if (b.distanceToIncident === null || b.distanceToIncident === Infinity) return -1;
                return a.distanceToIncident - b.distanceToIncident;
              });
            
            console.log(`📍 Prepared ${stationsWithDistance.length} stations with distances`);
            nearest = stationsWithDistance;
          } else {
            console.warn('⚠️ No stations found in database');
            nearest = stations || [];
          }
        }
        
        setNearestStations(nearest);
        
        // Show reroute modal
        setIsRerouteForForwarding(false); // This is for declined assignment, not forwarding
        setRerouteNote('');
        setShowRerouteModal(true);
        
        // If report is not selected, select it for context
        if (!selectedReport || String(selectedReport.id) !== String(assignment.report_id)) {
          if (reportData) {
            setSelectedReport({
              id: reportData.id,
              address: reportData.address,
              geotag_location: reportData.geotag_location,
              latitude: reportData.latitude,
              longitude: reportData.longitude,
              ...reportData // Include all report data for context
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingAssignment, selectedReport]);

  // Fetch active incident counts for stations in reroute modal
  useEffect(() => {
    if (nearestStations.length > 0 && showRerouteModal) {
      const fetchActiveCounts = async () => {
        const counts = {};
        await Promise.all(
          nearestStations.map(async (station) => {
            try {
              const busyCheck = await checkStationIsBusy(station.id);
              counts[station.id] = busyCheck.busyCount || 0;
            } catch (error) {
              console.error(`Error fetching active count for station ${station.id}:`, error);
              counts[station.id] = 0;
            }
          })
        );
        setStationActiveCounts(counts);
      };
      fetchActiveCounts();
    } else {
      setStationActiveCounts({});
    }
  }, [nearestStations, showRerouteModal]);

  // Real-time listener for report status updates - re-sort list when status changes
  // Note: Since reports come from external API, we'll handle updates via periodic refresh
  // But we can also track local updates to move reports to top immediately
  useEffect(() => {
    // This will be handled by the periodic refresh in fetchFireReports
    // When reports are refreshed, they'll be re-sorted by newest first
  }, []);

  // Helper function to update a report's timestamp when status changes
  const updateReportTimestamp = useCallback((reportId) => {
    setFireReports(prev => {
      const updated = prev.map(r => 
        String(r.id) === String(reportId) 
          ? { ...r, updated_at: new Date().toISOString() }
          : r
      );

      // Re-sort by newest first
      return updated.sort((a, b) => {
        const getTimestamp = (report) => {
          if (report.updated_at) {
            return new Date(report.updated_at).getTime();
          }
          if (report.created_at) {
            return new Date(report.created_at).getTime();
          }
          if (report.timestamp) {
            return new Date(report.timestamp).getTime();
          }
          return 0;
        };
        
        const timeA = getTimestamp(a);
        const timeB = getTimestamp(b);
        
        return timeB - timeA;
      });
    });
  }, []);

  // Handle reroute to selected station
  const handleReroute = useCallback(async () => {
    if (!selectedRerouteStation || !pendingAssignment) {
      alert('Please select a station to reroute to.');
      return;
    }

    // Validate that we're not rerouting to the same station
    if (String(selectedRerouteStation) === String(pendingAssignment.stationId)) {
      alert('Cannot reroute to the same station. Please select a different station.');
      return;
    }

    try {
      console.log('🔄 Rerouting report:', {
        reportId: pendingAssignment.reportId,
        fromStation: pendingAssignment.stationId,
        fromStationName: pendingAssignment.stationName,
        toStation: selectedRerouteStation
      });

      // Remove the declined assignment (or current assignment for forwarding)
      await supabase
        .from('report_assignments')
        .delete()
        .eq('report_id', pendingAssignment.reportId)
        .eq('assignee_type', 'station')
        .eq('assignee_id', pendingAssignment.stationId);

      // Get new station name
      const { data: newStationData } = await supabase
        .from('station_users')
        .select('station_name')
        .eq('id', selectedRerouteStation)
        .single();

      const newStationName = newStationData?.station_name || 'Station';

      // Check if new station is busy - always require approval for rerouted assignments
      const busyCheck = await checkStationIsBusy(selectedRerouteStation);
      
      // Also delete any existing assignment for this report to ensure clean state
      // (in case there's a leftover assignment from a previous reroute attempt)
      // IMPORTANT: Delete ALL station assignments for this report first
      const { error: deleteError } = await supabase
        .from('report_assignments')
        .delete()
        .eq('report_id', pendingAssignment.reportId)
        .eq('assignee_type', 'station');
      
      if (deleteError) {
        console.error('❌ Error deleting existing assignments:', deleteError);
        throw deleteError;
      }
      
      console.log('✅ Deleted all existing station assignments for report:', pendingAssignment.reportId);
      
      // Create new assignment to the selected station (always pending for reroutes)
      // Use insert instead of upsert to ensure it triggers INSERT listener on station side
      const noteText = isRerouteForForwarding 
        ? (rerouteNote && rerouteNote.trim() 
          ? `Forwarded from ${pendingAssignment.stationName}: ${rerouteNote.trim()}` 
          : `Forwarded from ${pendingAssignment.stationName}`)
        : `Rerouted from ${pendingAssignment.stationName}`;
      
      const payload = {
        report_id: pendingAssignment.reportId,
        assignee_type: 'station',
        assignee_id: selectedRerouteStation,
        assigned_at: new Date().toISOString(),
        status: 'pending', // Always require approval for rerouted/forwarded assignments
        assignment_source: 'manual',
        note: noteText
      };

      console.log('📝 Inserting new assignment:', payload);

      const { error, data } = await supabase
        .from('report_assignments')
        .insert(payload)
        .select();

      if (error) {
        // Check if error is due to missing columns (migration not run)
        if (error.message && (error.message.includes('column') && error.message.includes('does not exist'))) {
          alert('Database migration required! Please run the migration SQL file (assignment-status-migration.sql) in your Supabase SQL Editor first.');
          return;
        }
        console.error('❌ Error inserting new assignment:', error);
        throw error;
      }

      console.log('✅ Successfully created new assignment:', data);
      
      // Verify the assignment was created correctly
      const { data: verifyAssignment } = await supabase
        .from('report_assignments')
        .select('assignee_id, assignee_type, status')
        .eq('report_id', pendingAssignment.reportId)
        .eq('assignee_type', 'station')
        .single();
      
      if (verifyAssignment) {
        console.log('✅ Verified assignment:', {
          assignee_id: verifyAssignment.assignee_id,
          expected: selectedRerouteStation,
          match: String(verifyAssignment.assignee_id) === String(selectedRerouteStation)
        });
        
        if (String(verifyAssignment.assignee_id) !== String(selectedRerouteStation)) {
          console.error('❌ ASSIGNMENT MISMATCH! Expected:', selectedRerouteStation, 'Got:', verifyAssignment.assignee_id);
          alert('Error: Assignment was created for wrong station. Please try again.');
          return;
        }
      }

      // Store the old station name before updating pendingAssignment
      const oldStationName = pendingAssignment.stationName;
      const oldStationId = pendingAssignment.stationId;

      // Update pendingAssignment to track the new station
      const updatedPendingAssignment = {
        reportId: pendingAssignment.reportId,
        stationId: selectedRerouteStation,
        stationName: newStationName
      };
      setPendingAssignment(updatedPendingAssignment);
      pendingAssignmentRef.current = updatedPendingAssignment; // Update ref immediately

      // Show waiting modal
      setShowRerouteModal(false);
      setShowWaitingApprovalModal(true);
      setSelectedRerouteStation('');
      setRerouteNote('');
      setIsRerouteForForwarding(false);

      // Create notification for new station
      if (selectedReport) {
        const locationInfo = selectedReport.address || selectedReport.geotag_location || 'Location unavailable';
        const reporterName = selectedReport.reporter_name || selectedReport.reporter || 'Unknown Reporter';
        const actionText = isRerouteForForwarding ? 'forwarding' : 'rerouting';
        const noteText = rerouteNote && rerouteNote.trim() ? `\n\nNote: ${rerouteNote.trim()}` : '';
        const title = isRerouteForForwarding 
          ? `🚨 Fire Report Forwarded to Your Station - Action Required`
          : `🚨 Fire Report Rerouted to Your Station - Action Required`;
        const message = `Command Center is ${actionText} a fire report to your station.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\nPrevious station: ${oldStationName}${noteText}\n\nWill you accept this assignment?`;
        
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: selectedRerouteStation,
            user_type: 'station',
            type: 'assignment',
            related_report_id: String(pendingAssignment.reportId),
            title: title,
            message: message,
            priority: 'urgent',
            is_read: false
          });

        if (notifError) {
          console.error('❌ Error creating reroute notification:', notifError);
        }
      }

      // Snapshot report coordinates
      try {
        if (selectedReport) {
          const lat = parseFloat(selectedReport.latitude);
          const lng = parseFloat(selectedReport.longitude);
          await supabase
            .from('assigned_report_snapshots')
            .upsert({
              report_id: String(pendingAssignment.reportId),
              lat: isNaN(lat) ? null : lat,
              lng: isNaN(lng) ? null : lng,
              address: selectedReport.address || selectedReport.geotag_location || null,
              snapshot_json: selectedReport
            }, { onConflict: 'report_id' });
        }
      } catch (snapErr) {
        console.warn('Snapshot upsert failed:', snapErr?.message || snapErr);
      }
      
      if (selectedReport) {
        loadAssignmentInfo(selectedReport.id);
      }
    } catch (e) {
      console.error('❌ Reroute failed:', e);
      alert('Failed to reroute report. Check console.');
    }
  }, [selectedRerouteStation, pendingAssignment, nearestStations, selectedReport, loadAssignmentInfo, isRerouteForForwarding, rerouteNote]);

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

      // Check if this is a clustered report - get all reports in the cluster
      const reportsToAssign = selectedReport.reports && selectedReport.reports.length > 0
        ? selectedReport.reports
        : [selectedReport];

      // If assigning to a station, check if station is busy
      if (assigneeType === 'station') {
        const busyCheck = await checkStationIsBusy(assigneeId);
        
        if (busyCheck.isBusy) {
          // Station is busy - set assignment to pending and show waiting modal
          // Assign ALL reports in the cluster
          const assignments = reportsToAssign.map(report => ({
            report_id: report.id,
            assignee_type: assigneeType,
            assignee_id: assigneeId,
            assigned_at: new Date().toISOString(),
            status: 'pending', // Set to pending for approval
            assignment_source: 'manual', // Admin manually assigned
            note: assignmentNote && assignmentNote.trim() ? assignmentNote.trim() : null
          }));
          
          const { error } = await supabase
            .from('report_assignments')
            .upsert(assignments, { onConflict: 'report_id,assignee_id' });
          
          if (error) {
            // Check if error is due to missing columns (migration not run)
            if (error.message && (error.message.includes('column') && error.message.includes('does not exist'))) {
              console.error('❌ Database migration not run. Please run assignment-status-migration.sql in Supabase SQL Editor.');
              alert('Database migration required! Please run the migration SQL file (assignment-status-migration.sql) in your Supabase SQL Editor first.');
              return;
            }
            throw error;
          }

          // Get station name for modal
          const { data: stationData } = await supabase
            .from('station_users')
            .select('station_name')
            .eq('id', assigneeId)
            .single();

          const pendingAssign = {
            reportId: selectedReport.id,
            stationId: assigneeId,
            stationName: stationData?.station_name || 'Station'
          };
          setPendingAssignment(pendingAssign);
          pendingAssignmentRef.current = pendingAssign;
          setShowWaitingApprovalModal(true);

          // Create notification for the assigned station (use representative report)
          try {
            const representativeReport = selectedReport.representativeReport || selectedReport;
            const locationInfo = representativeReport.address || representativeReport.geotag_location || 'Location unavailable';
            const reporterName = representativeReport.reporter_name || representativeReport.reporter || 'Unknown Reporter';
            const clusterCount = reportsToAssign.length;
            const title = clusterCount > 1 
              ? `🚨 New Fire Report Cluster Assignment - Action Required (${clusterCount} reports)`
              : `🚨 New Fire Report Assignment - Action Required`;
            const message = clusterCount > 1
              ? `Command Center is assigning you a cluster of ${clusterCount} reports for the same incident.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nWill you accept this assignment?`
              : `Command Center is assigning you a report.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nWill you accept this assignment?`;
            
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
            }
          } catch (notifErr) {
            console.error('❌ Failed to create notification:', notifErr);
          }

          // Snapshot report coordinates for all reports in cluster
          try {
            for (const report of reportsToAssign) {
              const lat = parseFloat(report.latitude);
              const lng = parseFloat(report.longitude);
            await supabase
              .from('assigned_report_snapshots')
              .upsert({
                  report_id: String(report.id),
                lat: isNaN(lat) ? null : lat,
                lng: isNaN(lng) ? null : lng,
                  address: report.address || report.geotag_location || null,
                  snapshot_json: report
              }, { onConflict: 'report_id' });
            }
          } catch (snapErr) {
            console.warn('Snapshot upsert failed:', snapErr?.message || snapErr);
          }

          setAssignmentNote('');
          loadAssignmentInfo(selectedReport.id);
          return; // Don't show success alert, modal will handle it
        } else {
          // Station is NOT busy - auto-accept assignment
          // Delete any existing assignments for all reports in cluster
          for (const report of reportsToAssign) {
          await supabase
            .from('report_assignments')
            .delete()
              .eq('report_id', report.id)
            .eq('assignee_type', 'station');
          }
          
          // Assign ALL reports in the cluster
          const assignments = reportsToAssign.map(report => ({
            report_id: report.id,
            assignee_type: assigneeType,
            assignee_id: assigneeId,
            assigned_at: new Date().toISOString(),
            status: 'accepted', // Auto-accept for free stations
            assignment_source: 'manual',
            note: assignmentNote && assignmentNote.trim() ? assignmentNote.trim() : null
          }));
          
          const { error } = await supabase
            .from('report_assignments')
            .insert(assignments);
          
          if (error) {
            // Check if error is due to missing columns (migration not run)
            if (error.message && (error.message.includes('column') && error.message.includes('does not exist'))) {
              console.error('❌ Database migration not run. Please run assignment-status-migration.sql in Supabase SQL Editor.');
              alert('Database migration required! Please run the migration SQL file (assignment-status-migration.sql) in your Supabase SQL Editor first.');
              return;
            }
            throw error;
          }

          // Get station name for success message
          const { data: stationData } = await supabase
            .from('station_users')
            .select('station_name')
            .eq('id', assigneeId)
            .single();

          const stationName = stationData?.station_name || 'Station';
          const clusterCount = reportsToAssign.length;
          
          // Create notification for the assigned station (even though auto-accepted, still notify)
          try {
            const representativeReport = selectedReport.representativeReport || selectedReport;
            const locationInfo = representativeReport.address || representativeReport.geotag_location || 'Location unavailable';
            const reporterName = representativeReport.reporter_name || representativeReport.reporter || 'Unknown Reporter';
            const title = clusterCount > 1 
              ? `🚨 New Fire Report Cluster Assignment (${clusterCount} reports)`
              : `🚨 New Fire Report Assignment`;
            const message = clusterCount > 1
              ? `You have been assigned a cluster of ${clusterCount} reports for the same incident.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}`
              : `You have been assigned a new fire report.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}`;
            
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
            }
          } catch (notifErr) {
            console.error('❌ Failed to create notification:', notifErr);
          }

          // Snapshot report coordinates for all reports in cluster
          try {
            for (const report of reportsToAssign) {
              const lat = parseFloat(report.latitude);
              const lng = parseFloat(report.longitude);
              await supabase
                .from('assigned_report_snapshots')
                .upsert({
                  report_id: String(report.id),
                  lat: isNaN(lat) ? null : lat,
                  lng: isNaN(lng) ? null : lng,
                  address: report.address || report.geotag_location || null,
                  snapshot_json: report
                }, { onConflict: 'report_id' });
            }
          } catch (snapErr) {
            console.warn('Snapshot upsert failed:', snapErr?.message || snapErr);
          }

          setAssignmentNote('');
          loadAssignmentInfo(selectedReport.id);
          alert(`✅ ${clusterCount > 1 ? `Cluster of ${clusterCount} reports` : 'Assignment'} successfully assigned to ${stationName}.`);
          return; // Don't proceed to responder assignment logic
        }
      }

      // Assigning to responder - proceed normally
      const payload = {
        report_id: selectedReport.id,
        assignee_type: assigneeType,
        assignee_id: assigneeId,
        assigned_at: new Date().toISOString(),
        status: 'accepted',
        assignment_source: 'manual'
      };
      
      const { error } = await supabase
        .from('report_assignments')
        .upsert({ ...payload, note: assignmentNote && assignmentNote.trim() ? assignmentNote.trim() : null }, { onConflict: 'report_id,assignee_id' });
      
      if (error) {
        // Check if error is due to missing columns (migration not run)
        if (error.message && (error.message.includes('column') && error.message.includes('does not exist'))) {
          console.error('❌ Database migration not run. Please run assignment-status-migration.sql in Supabase SQL Editor.');
          alert('Database migration required! Please run the migration SQL file (assignment-status-migration.sql) in your Supabase SQL Editor first.');
          return;
        }
        throw error;
      }
      
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
    setClusterIndex(0); // reset pager when selecting a new cluster
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
      {/* Map Container - Always render to prevent white screen */}
      <div style={mapContainerStyle} className="relative bg-gray-100">
        {/* Loading Overlay - Show while map is loading */}
        {!isMapsLoaded && !mapsLoadError && (
          <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading map...</p>
            </div>
        </div>
      )}
      {mapsLoadError && (
          <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">🗺️</div>
            <p className="text-red-600 font-semibold mb-2">Failed to load Google Maps API</p>
              <p className="text-gray-600 mb-4">{mapsLoadError.message || 'Please refresh the page.'}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Refresh Page
              </button>
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

          {/* Fire Report Markers (clustered) */}
          {mapLoaded && clusterReports(fireReports).map((report) => {
            const customIcon = getMarkerIconWithBadge(report);
            const hasBadge = (report.reportStrength || 1) > 1;
            
            return (
              <Marker
                key={`${report.id}-${report.latitude}-${report.longitude}-${report.address || report.geotag_location || 'no-address'}`}
                position={{
                  lat: parseFloat(report.latitude),
                  lng: parseFloat(report.longitude)
                }}
                onClick={() => handleMarkerClick(report)}
                icon={customIcon}
                label={hasBadge ? undefined : {
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
                onClick={async () => {
                  // Fetch full station details from database
                  try {
                    setLoadingResponders(true);
                    const { data: stationData, error } = await supabase
                      .from('station_users')
                      .select('id, station_name, address, lat, lng, email, phone, account_status, num_firetrucks, firetruck_size')
                      .eq('id', s.id)
                      .single();
                    
                    if (!error && stationData) {
                      setSelectedStation({
                        ...stationData,
                        lat: stationData.lat ? parseFloat(stationData.lat) : s.lat,
                        lng: stationData.lng ? parseFloat(stationData.lng) : s.lng
                      });
                      
                      // Fetch responders for this station
                      const stationId = stationData.id || s.id;
                      console.log('🔍 Fetching responders for station ID:', stationId);
                      
                      const { data: respondersData, error: respondersError } = await supabase
                        .from('responders')
                        .select('id, first_name, last_name')
                        .eq('station_id', stationId);
                      
                      if (!respondersError && respondersData) {
                        console.log('✅ Found responders:', respondersData);
                        setStationResponders(respondersData || []);
                      } else {
                        console.error('❌ Error fetching responders:', respondersError);
                        setStationResponders([]);
                      }
                    } else {
                      // Fallback to geocoded data
                      const fullStation = allStations.find(st => String(st.id) === String(s.id));
                      setSelectedStation({
                        id: s.id,
                        station_name: fullStation?.station_name || s.name,
                        address: fullStation?.address || s.address,
                        lat: s.lat,
                        lng: s.lng,
                        email: fullStation?.email,
                        phone: fullStation?.phone,
                        num_firetrucks: fullStation?.num_firetrucks,
                        firetruck_size: fullStation?.firetruck_size
                      });
                      
                      // Still try to fetch responders even in fallback
                      console.log('🔍 Fetching responders for station ID (fallback):', s.id);
                      const { data: respondersData, error: respondersError } = await supabase
                        .from('responders')
                        .select('id, first_name, last_name')
                        .eq('station_id', s.id);
                      
                      if (!respondersError && respondersData) {
                        console.log('✅ Found responders (fallback):', respondersData);
                        setStationResponders(respondersData || []);
                      } else {
                        console.error('❌ Error fetching responders (fallback):', respondersError);
                        setStationResponders([]);
                      }
                    }
                  } catch (err) {
                    console.error('Error fetching station details:', err);
                    // Fallback to geocoded data - still try to fetch responders
                    const fullStation = allStations.find(st => String(st.id) === String(s.id));
                    setSelectedStation({
                      id: s.id,
                      station_name: fullStation?.station_name || s.name,
                      address: fullStation?.address || s.address,
                      lat: s.lat,
                      lng: s.lng,
                      num_firetrucks: fullStation?.num_firetrucks,
                      firetruck_size: fullStation?.firetruck_size
                    });
                    
                    // Still try to fetch responders even in error case
                    try {
                      console.log('🔍 Fetching responders for station ID (error fallback):', s.id);
                      const { data: respondersData, error: respondersError } = await supabase
                        .from('responders')
                        .select('id, first_name, last_name')
                        .eq('station_id', s.id);
                      
                      if (!respondersError && respondersData) {
                        console.log('✅ Found responders (error fallback):', respondersData);
                        setStationResponders(respondersData || []);
                      } else {
                        console.error('❌ Error fetching responders (error fallback):', respondersError);
                        setStationResponders([]);
                      }
                    } catch (responderErr) {
                      console.error('❌ Error in responder fetch:', responderErr);
                      setStationResponders([]);
                    }
                  } finally {
                    setLoadingResponders(false);
                  }
                }}
                cursor="pointer"
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
                  {(() => {
                    const clustered = selectedReport.reports && selectedReport.reports.length > 0;
                    const totalReports = selectedReport.reportStrength || (clustered ? selectedReport.reports.length : 1);
                    const currentReport = clustered
                      ? selectedReport.reports[Math.min(clusterIndex, selectedReport.reports.length - 1)]
                      : selectedReport;
                    const lastUpdated = selectedReport.latestTimestamp
                      ? new Date(selectedReport.latestTimestamp).toLocaleString()
                      : (selectedReport.formatted_timestamp || selectedReport.timestamp || selectedReport.updated_at || selectedReport.created_at || 'Unknown');
                    const likelihoodDisplay = selectedReport.likelihoodScore || selectedReport.likelihood || selectedReport.confidence || 'N/A';

                    return (
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-start space-x-2">
                          <span className="text-gray-500">Report Strength:</span>
                          <span className="font-bold text-red-700">{`${totalReports} user${totalReports === 1 ? '' : 's'}`}</span>
                        </div>
                        {clustered && (
                          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">Viewing report</span>
                              <span className="text-sm font-semibold text-gray-900">{`${clusterIndex + 1} of ${selectedReport.reports.length}`}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                disabled={clusterIndex === 0}
                                onClick={() => setClusterIndex((i) => Math.max(0, i - 1))}
                                className={`px-3 py-1 rounded-full text-sm font-medium ${clusterIndex === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`}
                              >
                                Prev
                              </button>
                              <button
                                disabled={clusterIndex >= selectedReport.reports.length - 1}
                                onClick={() => setClusterIndex((i) => Math.min(selectedReport.reports.length - 1, i + 1))}
                                className={`px-3 py-1 rounded-full text-sm font-medium ${clusterIndex >= selectedReport.reports.length - 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start space-x-2">
                          <span className="text-gray-500">Last Updated:</span>
                          <span className="font-medium text-gray-900">{lastUpdated}</span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <span className="text-gray-500">Likelihood:</span>
                          <span className="font-semibold text-gray-900">{likelihoodDisplay}</span>
                        </div>
                        {clustered && currentReport?.reporter && (
                          <div className="flex items-start space-x-2">
                            <span className="text-gray-500">This report:</span>
                            <span className="font-medium text-gray-900">{currentReport.reporter}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Reporter Info */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">Reporter:</span>
                    <span className="font-medium text-gray-900">
                      {(selectedReport.reports && selectedReport.reports.length > 0
                        ? selectedReport.reports[Math.min(clusterIndex, selectedReport.reports.length - 1)]
                        : selectedReport)?.reporter}
                    </span>
                  </div>

                  {/* Cause */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">Cause:</span>
                    <span className="font-medium text-gray-900">
                      {(selectedReport.reports && selectedReport.reports.length > 0
                        ? selectedReport.reports[Math.min(clusterIndex, selectedReport.reports.length - 1)]
                        : selectedReport)?.cause_of_fire || 'Hayssjshs'}
                    </span>
                  </div>

                  {/* Fire Alarm Level */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">Fire Alarm Level:</span>
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ 
                        backgroundColor: getMarkerColor(selectedReport),
                        color: '#111827' // dark text for readability on light badges
                      }}
                    >
                      {cleanAlarmLevel(resolveAlarmLevel(selectedReport))}
                    </span>
                  </div>

                  {/* AI Fire Analysis */}
                  <div className="flex items-start space-x-2">
                    <span className="text-gray-500">AI Fire Analysis:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedReport.prediction === 'Fire' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      {selectedReport.prediction}{selectedReport.confidence ? ` (${selectedReport.confidence})` : ''}
                    </span>
                  </div>
                  {/* Smoke Analysis (use detection + confidence) */}
                  {(selectedReport.smoke_detection || selectedReport.smoke_confidence) && (
                    <div className="flex items-start space-x-2">
                      <span className="text-gray-500">Smoke Analysis:</span>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold border"
                        style={{
                          backgroundColor: '#e0f2fe', // light blue
                          borderColor: '#bae6fd',
                          color: '#0f172a' // dark text for readability
                        }}
                      >
                        {selectedReport.smoke_detection || 'Smoke'}
                        {selectedReport.smoke_confidence ? ` (${selectedReport.smoke_confidence})` : ''}
                      </span>
                    </div>
                  )}

                  {/* AI Structure Analysis */}
                  {selectedReport.structure && (
                    <div className="flex items-start space-x-2">
                      <span className="text-gray-500">AI Structure Analysis:</span>
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
                    <div className={`mt-4 border-l-4 p-3 rounded ${
                      currentAssignment.status === 'pending' 
                        ? 'bg-amber-50 border-amber-500' 
                        : 'bg-blue-50 border-blue-500'
                    }`}>
                      <div className="flex items-start space-x-2">
                        <span className="text-lg">{currentAssignment.status === 'pending' ? '⏳' : '📍'}</span>
                        <div className="flex-1">
                          <p className={`font-bold text-sm mb-1 ${
                            currentAssignment.status === 'pending' 
                              ? 'text-amber-900' 
                              : 'text-blue-900'
                          }`}>
                            {currentAssignment.status === 'pending' 
                              ? 'Awaiting Station Confirmation' 
                              : 'Currently Assigned To:'}
                          </p>
                          <p className={`font-semibold ${
                            currentAssignment.status === 'pending' 
                              ? 'text-amber-800' 
                              : 'text-blue-800'
                          }`}>
                            {currentAssignment.name}
                          </p>
                          <p className={`text-xs mt-1 ${
                            currentAssignment.status === 'pending' 
                              ? 'text-amber-600' 
                              : 'text-blue-600'
                          }`}>
                            {currentAssignment.status === 'pending' 
                              ? 'Waiting for station to accept or decline...' 
                              : `Assigned: ${new Date(currentAssignment.assigned_at).toLocaleString()}`}
                          </p>
                          {currentAssignment.note && (
                            <p className={`text-xs mt-1 italic ${
                              currentAssignment.status === 'pending' 
                                ? 'text-amber-700' 
                                : 'text-blue-700'
                            }`}>
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

                  {/* Assignment Section - Only show if no station is assigned */}
                  {!currentAssignment && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="font-bold text-gray-900 mb-3">Assign to Station</p>
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
                          Assign Station
                        </button>
                        <p className="text-xs text-gray-500 mt-1">Select a station to assign this report to.</p>
                      </div>
                    </div>
                  )}

                  {/* Redirect/Forward Section - Only show if a station is already assigned */}
                  {currentAssignment && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="font-bold text-gray-900 mb-3">Forward to Station</p>
                      <div className="space-y-2">
                        <button 
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors" 
                          onClick={async () => {
                            // Open reroute modal for forwarding
                            if (!selectedReport) return;
                            
                            setIsRerouteForForwarding(true);
                            setSelectedRerouteStation('');
                            setRerouteNote('');
                            
                            // Set pendingAssignment for forwarding context
                            const pendingAssign = {
                              reportId: selectedReport.id,
                              stationId: currentAssignment.id,
                              stationName: currentAssignment.name
                            };
                            setPendingAssignment(pendingAssign);
                            pendingAssignmentRef.current = pendingAssign;
                            
                            // Fetch nearest stations to the current assignment's station
                            try {
                              const lat = parseFloat(selectedReport.latitude);
                              const lng = parseFloat(selectedReport.longitude);
                              
                              console.log('🔍 Forwarding: Fetching stations for report at:', lat, lng);
                              console.log('🔍 Forwarding: Excluding station:', currentAssignment.id);
                              
                              if (!isNaN(lat) && !isNaN(lng)) {
                                // Find nearest stations to the incident location (active only)
                                const stations = await findNearestStations(
                                  lat,
                                  lng,
                                  currentAssignment.id, // Exclude current station
                                  10, // Get more stations
                                  { lat, lng } // Incident location for distance calculation
                                );
                                
                                console.log('🔍 Forwarding: findNearestStations returned:', stations?.length || 0, 'stations');
                                
                                if (stations && stations.length > 0) {
                                  setNearestStations(stations);
                                } else {
                                  console.log('⚠️ Forwarding: findNearestStations returned empty, trying fallback...');
                                  // Fallback: directly query all stations (less restrictive)
                                  const { data: allStationsData, error: allStationsError } = await supabase
                                    .from('station_users')
                                    .select('id, station_name, lat, lng, status')
                                    .eq('status', 'active')
                                    .neq('id', currentAssignment.id);
                                  
                                  if (allStationsError) {
                                    console.error('❌ Error fetching all stations:', allStationsError);
                                    setNearestStations([]);
                                  } else if (allStationsData && allStationsData.length > 0) {
                                    console.log('✅ Forwarding: Found', allStationsData.length, 'stations in fallback');
                                    const stationsWithDistance = allStationsData
                                      .filter(station => {
                                        const stationLat = parseFloat(station.lat);
                                        const stationLng = parseFloat(station.lng);
                                        return !isNaN(stationLat) && !isNaN(stationLng);
                                      })
                                      .map(station => {
                                        const stationLat = parseFloat(station.lat);
                                        const stationLng = parseFloat(station.lng);
                                        let distanceToIncident = null;
                                        
                                        if (!isNaN(lat) && !isNaN(lng)) {
                                          distanceToIncident = calculateDistance(lat, lng, stationLat, stationLng);
                                        }
                                        
                                        return {
                                          ...station,
                                          distanceToIncident: distanceToIncident,
                                          distanceToIncidentKm: distanceToIncident ? (distanceToIncident / 1000).toFixed(2) : null
                                        };
                                      })
                                      .sort((a, b) => {
                                        if (a.distanceToIncident === null || a.distanceToIncident === Infinity) return 1;
                                        if (b.distanceToIncident === null || b.distanceToIncident === Infinity) return -1;
                                        return a.distanceToIncident - b.distanceToIncident;
                                      });
                                    
                                    setNearestStations(stationsWithDistance);
                                  } else {
                                    console.warn('⚠️ Forwarding: No stations found in fallback');
                                    setNearestStations([]);
                                  }
                                }
                              } else {
                                // No coordinates, get all stations
                                const { data: allStationsData, error: allStationsError } = await supabase
                                  .from('station_users')
                                  .select('id, station_name, lat, lng')
                                  .neq('id', currentAssignment.id);
                                
                                if (allStationsError) {
                                  console.error('❌ Error fetching all stations (no coords):', allStationsError);
                                }
                                
                                if (allStationsData && allStationsData.length > 0) {
                                  setNearestStations(allStationsData.map(s => ({
                                    ...s,
                                    distanceToIncidentKm: null
                                  })));
                                } else {
                                  setNearestStations([]);
                                }
                              }
                            } catch (error) {
                              console.error('Error fetching stations for forwarding:', error);
                              setNearestStations([]);
                            }
                            
                            setShowRerouteModal(true);
                          }}
                        >
                          Forward Station
                        </button>
                        <p className="text-xs text-gray-500 mt-1">Forward this report to another station.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}
      </div>
      
      {/* Legacy Loading Overlay - Keep for mapLoaded state (internal map state) */}
      {!mapLoaded && !mapError && isMapsLoaded && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600 mb-4">Initializing map...</p>
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

      {/* Mini Modal - Active Fire Incidents List (Lower Left) */}
      <div className={`absolute bottom-4 left-4 z-30 w-80 bg-white backdrop-blur-sm bg-opacity-98 rounded-lg shadow-2xl border border-gray-200 flex flex-col transition-all duration-300 ${
        isIncidentsModalMinimized ? 'h-auto' : 'h-[320px]'
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-2.5 rounded-t-lg flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center space-x-2 flex-1">
            <button
              onClick={() => setIsIncidentsModalMinimized(!isIncidentsModalMinimized)}
              className="bg-white/20 p-1.5 rounded-md hover:bg-white/30 transition-colors cursor-pointer"
              title={isIncidentsModalMinimized ? "Expand" : "Minimize"}
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 01.5.866 1 1 0 01-1 1h-4v1a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6a1 1 0 01-1-1 1 1 0 01.5-.866l3.354-1.934L9.033 2.744A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="flex-1">
              <h3 className="font-bold text-white text-sm tracking-wide">Active Incidents</h3>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold text-white drop-shadow-lg">{fireReports.length}</div>
              <p className="text-red-100 text-xs font-medium mt-0.5">active</p>
            </div>
          </div>
        </div>

        {/* Scrollable List */}
        {!isIncidentsModalMinimized && (
        <div className="overflow-y-auto flex-1" style={{ maxHeight: '280px' }}>
          {reportsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
            </div>
          ) : fireReports.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 text-sm">No active incidents</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {[...fireReports]
                .sort((a, b) => {
                  // Sort by newest first (most recent timestamp at top)
                  const getTimestamp = (report) => {
                    // Prefer updated_at if available (status was updated), else use created_at
                    if (report.updated_at) {
                      return new Date(report.updated_at).getTime();
                    }
                    if (report.created_at) {
                      return new Date(report.created_at).getTime();
                    }
                    if (report.timestamp) {
                      return new Date(report.timestamp).getTime();
                    }
                    return 0;
                  };
                  
                  const timeA = getTimestamp(a);
                  const timeB = getTimestamp(b);
                  
                  // Sort descending (newest first)
                  return timeB - timeA;
                })
                .map((report) => {
                const alarmLevel = resolveAlarmLevel(report);
                const alarmColor = getAlarmLevelColor(alarmLevel);
                const status = report.status || 'Unknown';
                const statusLower = status.toLowerCase();
                
                // Get status color
                const getStatusColorClass = (status) => {
                  if (statusLower.includes('on going') || statusLower.includes('ongoing')) {
                    return 'bg-red-100 text-red-800 border-red-200';
                  }
                  if (statusLower.includes('under control')) {
                    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                  }
                  if (statusLower.includes('fire out')) {
                    return 'bg-green-100 text-green-800 border-green-200';
                  }
                  return 'bg-gray-100 text-gray-800 border-gray-200';
                };

                return (
                  <div
                    key={report.id}
                    onClick={() => {
                      setSelectedReport(report);
                      setMapCenter({
                        lat: parseFloat(report.latitude),
                        lng: parseFloat(report.longitude)
                      });
                    }}
                    className={`p-3 bg-gray-50 hover:bg-blue-50 rounded-lg cursor-pointer transition-all duration-200 border border-gray-200 hover:border-blue-300 hover:shadow-md ${
                      selectedReport?.id === report.id ? 'bg-blue-100 border-blue-400 shadow-md' : ''
                    }`}
                  >
                    {/* Location */}
                    <div className="flex items-start space-x-2 mb-2">
                      <svg className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs font-semibold text-gray-900 flex-1 line-clamp-2">
                        {report.address || report.geotag_location || 'Location unavailable'}
                      </p>
                    </div>

                    {/* Status and Alarm Level Row */}
                    <div className="flex items-center space-x-2 mt-2">
                      {/* Status Badge */}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColorClass(status)}`}>
                        {status}
                      </span>
                      
                      {/* Alarm Level Badge (dark text for readability) */}
                      <span
                        className="px-2 py-0.5 rounded text-xs font-bold border"
                        style={{ 
                          backgroundColor: alarmColor,
                          borderColor: alarmColor,
                          color: '#111827'
                        }}
                      >
                        {cleanAlarmLevel(alarmLevel) || 'Unknown'}
                      </span>
                    </div>

                    {/* Time */}
                    {report.formatted_timestamp && (
                      <div className="flex items-center space-x-1 mt-1.5">
                        <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-gray-500">{report.formatted_timestamp}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
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

          <div className="p-3">
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
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#f87171' }}></div>
                      <span className="text-gray-700 font-medium">Fourth Alarm</span>
                    </div>
                    <div className="flex items-center space-x-1.5 p-1.5 bg-white rounded">
                      <div className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: '#ef4444' }}></div>
                      <span className="text-gray-700 font-medium">Fifth Alarm</span>
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

      {/* Waiting for Station Approval Modal */}
      {showWaitingApprovalModal && pendingAssignment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 transform transition-all animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-4 shadow-lg animate-pulse">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">Waiting for Station Approval</h3>
            <p className="text-gray-600 text-center mb-8 leading-relaxed">
              The assignment has been sent to <span className="font-semibold text-gray-900">{pendingAssignment.stationName}</span>. 
              Please wait for their response.
            </p>
            <button
              onClick={() => {
                setShowWaitingApprovalModal(false);
                setPendingAssignment(null);
                pendingAssignmentRef.current = null;
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Reroute Modal - Station Too Busy */}
      {showRerouteModal && pendingAssignment && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRerouteModal(false);
              setSelectedRerouteStation('');
              setRerouteNote('');
              setIsRerouteForForwarding(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 max-h-[80vh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-200 relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowRerouteModal(false);
                setSelectedRerouteStation('');
                setRerouteNote('');
                setIsRerouteForForwarding(false);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-full p-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">
              {isRerouteForForwarding ? 'Forward to Station' : 'Station Declined Assignment'}
            </h3>
            <p className="text-gray-600 text-center mb-4 leading-relaxed">
              {isRerouteForForwarding ? (
                <>
                  Forward this report from <span className="font-semibold text-gray-900">{pendingAssignment.stationName}</span> to one of the nearest stations:
                </>
              ) : (
                <>
                  <span className="font-semibold text-gray-900">{pendingAssignment.stationName}</span> has declined this assignment and is unable to handle this report. 
                  Please reroute the incident to one of the nearest stations:
                </>
              )}
            </p>
            {selectedReport && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mb-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Report Location:</span> {selectedReport.address || selectedReport.geotag_location || 'Location unavailable'}
                </p>
              </div>
            )}
            
            <div className="space-y-3 mb-6">
              {nearestStations.length > 0 ? (
                nearestStations.map((station) => (
                  <label
                    key={station.id}
                    className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedRerouteStation === station.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rerouteStation"
                      value={station.id}
                      checked={selectedRerouteStation === station.id}
                      onChange={(e) => setSelectedRerouteStation(e.target.value)}
                      className="mr-4 w-5 h-5 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-semibold text-gray-900">{station.station_name || 'Station'}</p>
                        {stationActiveCounts[station.id] !== undefined && stationActiveCounts[station.id] > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            Dealing with {stationActiveCounts[station.id]} Active {stationActiveCounts[station.id] === 1 ? 'Report' : 'Reports'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {station.distanceToIncidentKm 
                          ? `${station.distanceToIncidentKm} km from incident` 
                          : station.distanceKm 
                            ? `${station.distanceKm} km away` 
                            : 'Distance unavailable (no coordinates)'}
                      </p>
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No stations available.</p>
              )}
            </div>

            {/* Optional Message Field */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message (optional)
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows="3"
                placeholder="Add a note for the receiving station (optional)"
                value={rerouteNote}
                onChange={(e) => setRerouteNote(e.target.value)}
              ></textarea>
            </div>

            <button
              onClick={handleReroute}
              disabled={!selectedRerouteStation}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
            >
              {isRerouteForForwarding ? 'Forward' : 'Reroute'}
            </button>
          </div>
        </div>
      )}

      {/* Station Details Modal */}
      {selectedStation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-6 transform transition-all animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-full p-3 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Station Details</h3>
                  <p className="text-sm text-gray-500">Fire Station Information</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedStation(null);
                  setStationResponders([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                title="Close"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Two Card Layout */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left Card: Basic Station Information */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Basic Information</h4>
                
                {/* Station Name */}
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Station Name</p>
                  </div>
                  <p className="text-base font-bold text-gray-900">{selectedStation.station_name || 'Unknown Station'}</p>
                </div>

                {/* Address */}
                {selectedStation.address && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Address</p>
                    </div>
                    <p className="text-xs text-gray-800">{selectedStation.address}</p>
                  </div>
                )}

                {/* Coordinates */}
                {(selectedStation.lat && selectedStation.lng) && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Coordinates</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-600 text-xs">Latitude</p>
                        <p className="font-mono font-semibold text-gray-900 text-xs">{selectedStation.lat?.toFixed(6) || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs">Longitude</p>
                        <p className="font-mono font-semibold text-gray-900 text-xs">{selectedStation.lng?.toFixed(6) || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Status</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </p>
                </div>

                {/* Contact Information */}
                <div className="space-y-2">
                  {/* Email */}
                  {selectedStation.email && (
                    <div className="bg-gray-50 border-l-4 border-gray-400 p-2.5 rounded-lg">
                      <div className="flex items-center space-x-2 mb-1">
                        <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</p>
                      </div>
                      <p className="text-xs text-gray-800 break-words">{selectedStation.email}</p>
                    </div>
                  )}
                  
                  {/* Phone */}
                  {selectedStation.phone && (
                    <div className="bg-gray-50 border-l-4 border-gray-400 p-2.5 rounded-lg">
                      <div className="flex items-center space-x-2 mb-1">
                        <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Phone</p>
                      </div>
                      <p className="text-xs text-gray-800">{selectedStation.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Card: Resources (Fire Trucks & Responders) */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Resources</h4>
                
                {/* Fire Trucks */}
                <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Fire Trucks</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-gray-600 text-xs mb-0.5">Number of Trucks</p>
                      <p className="text-base font-bold text-gray-900">
                        {selectedStation.num_firetrucks != null ? selectedStation.num_firetrucks : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs mb-0.5">Truck Size</p>
                      <p className="text-xs font-semibold text-gray-900">
                        {selectedStation.firetruck_size || 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Responders */}
                <div className="bg-indigo-50 border-l-4 border-indigo-500 p-3 rounded-lg flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Responders</p>
                    </div>
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                      {loadingResponders ? '...' : stationResponders.length}
                    </span>
                  </div>
                  
                  {loadingResponders ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : stationResponders.length > 0 ? (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {stationResponders.map((responder) => (
                        <div key={responder.id} className="bg-white p-2.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors">
                          <p className="text-xs font-semibold text-gray-900">
                            {responder.first_name} {responder.last_name}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-3">No responders assigned</p>
                  )}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="mt-6">
              <button
                onClick={() => {
                  setSelectedStation(null);
                  setStationResponders([]);
                }}
                className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Adashboard;