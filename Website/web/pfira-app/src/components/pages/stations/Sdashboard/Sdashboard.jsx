import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, Circle, useJsApiLoader } from '@react-google-maps/api';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../../../config/supabase';
import { checkStationIsBusy, handleAssignmentResponse, requestForwarding } from '../../../../utils/assignmentHelpers';

const Sdashboard = () => {
  // Helper function to generate human-readable report ID
  const generateReadableReportId = (uuid) => {
    if (!uuid) return 'Unknown';
    // Take first 8 characters and convert to uppercase for better readability
    const shortId = uuid.substring(0, 8).toUpperCase();
    return `FR-${shortId}`;
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

  // Derive the best fire alarm level using suggested/AI values first, then compute
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
        }
      } else {
        consolidated.push({
          ...report,
          reports: [report],
          reportStrength: 1,
          representativeReport: report,
          latestTimestamp: reportDate
        });
      }
    });

    return consolidated;
  };

  const isNoFireNoSmoke = (report) => {
    const pred = (report?.prediction || '').toLowerCase();
    const smoke = (report?.smoke_detection || '').toLowerCase();
    return pred.includes('no fire') && smoke.includes('no smoke');
  };

  // Safely read outlet context; on hard reload this can be undefined before layout mounts
  const outletContext = (typeof useOutletContext === 'function' ? useOutletContext() : {}) || {};
  const { stationData } = outletContext;
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBX5taF1AgNhicxw5_BXUJDs6ouniAuiQI'; // Make sure this key has Geocoding API enabled
  // For station view we don't want to show the developer/browser geolocation.
  // Keep state vars in case we enable later, but default to disabled.
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const ENABLE_USER_GEO = false;
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [stationLocation, setStationLocation] = useState(null);
  const [geocodingError, setGeocodingError] = useState(null);
  // Strictly rely on the logged-in station identity; avoid fallback switching
  const [fallbackStationData, setFallbackStationData] = useState(null);
  const [showStationInfoWindow, setShowStationInfoWindow] = useState(false);
  const [showCommandCenterInfo, setShowCommandCenterInfo] = useState(false);
  const [jurisdictionRadius, setJurisdictionRadius] = useState(2000); // 2km radius in meters
  const [circleVersion, setCircleVersion] = useState(0); // Increment to force complete circle remount
  const [allStations, setAllStations] = useState([]); // raw stations from DB
  const [geocodedStations, setGeocodedStations] = useState([]); // [{id, name, address, lat, lng}]
  const [currentStationId, setCurrentStationId] = useState(null);
  const [assignedReports, setAssignedReports] = useState([]); // fire reports assigned to this station
  const [selectedAssignedReport, setSelectedAssignedReport] = useState(null);
  const [clusterIndex, setClusterIndex] = useState(0); // For paginating through clustered reports
  const [responders, setResponders] = useState([]); // responders assigned to this station
  const [isNotifying, setIsNotifying] = useState(false);
  const previousReportIdsRef = useRef(new Set());
  const processedNotificationReportIdsRef = useRef(new Set());
  const audioRef = useRef(null);
  const [audioReady, setAudioReady] = useState(false);
  const audioContextRef = useRef(null);
  const lastAlertAtRef = useRef(0);
  const pendingAlertRef = useRef(false);
  const interactionHandlerRegisteredRef = useRef(false);
  const [showSoundPrompt, setShowSoundPrompt] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAcceptanceModal, setShowAcceptanceModal] = useState(false);
  const [showForwardingRequestModal, setShowForwardingRequestModal] = useState(false);
  const [pendingAssignmentData, setPendingAssignmentData] = useState(null); // {reportId, assignmentSource, reportData}
  const [selectedStation, setSelectedStation] = useState(null); // Selected station for details modal
  const [stationResponders, setStationResponders] = useState([]); // Responders for selected station
  const [loadingResponders, setLoadingResponders] = useState(false); // Loading state for responders
  const [isStationInfoMinimized, setIsStationInfoMinimized] = useState(false); // Track if station info card is minimized
  // Load Google Maps API once to avoid duplicate script injection when navigating
  const { isLoaded: isMapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  // Preload alert audio and try to enable on first user interaction
  useEffect(() => {
    try {
      const audio = new Audio('/assets/sounds/fire_alarm_sound.mp3');
      audio.preload = 'auto';
      audio.volume = 1.0;
      audioRef.current = audio;
    } catch (e) {
      console.error('❌ Station: Failed to preload audio', e);
    }

    const enableAudio = async () => {
      try {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        if (audioRef.current) {
          const isLooping = !!audioRef.current.loop && audioRef.current.paused === false;
          if (!isLooping) {
            await audioRef.current.play();
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }
        setAudioReady(true);
        if (pendingAlertRef.current) {
          pendingAlertRef.current = false;
          try {
            if (audioRef.current) {
              const isLooping = !!audioRef.current.loop && audioRef.current.paused === false;
              if (!isLooping) {
                audioRef.current.currentTime = 0;
                audioRef.current.volume = 1.0;
                await audioRef.current.play();
                setTimeout(() => { try { audioRef.current && audioRef.current.pause(); } catch (_) {} }, 2000);
              }
            }
          } catch (_) {}
        }
      } catch (_) {
        // Ignore; will try again later
      }
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      interactionHandlerRegisteredRef.current = false;
    };
    if (!interactionHandlerRegisteredRef.current) {
      document.addEventListener('click', enableAudio);
      document.addEventListener('touchstart', enableAudio);
      document.addEventListener('keydown', enableAudio);
      interactionHandlerRegisteredRef.current = true;
    }
    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      interactionHandlerRegisteredRef.current = false;
    };
  }, []);

  // If user hasn't explicitly enabled audio before, show the enable banner on load
  useEffect(() => {
    try {
      const enabled = localStorage.getItem('stationAudioEnabled') === 'true';
      if (!enabled) setShowSoundPrompt(true);
    } catch (_) {}
  }, []);

  // Play a short beep using WebAudio (works once AudioContext is resumed)
  const playWebAudioBeep = useCallback(async () => {
    try {
      console.log('🔊 Station: Trying WebAudio beep');
      let ctx = audioContextRef.current;
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = ctx;
      }
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.05);
      setTimeout(() => {
        try {
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
          osc.stop(ctx.currentTime + 0.1);
        } catch (_) {}
      }, 900);
      console.log('🔊 Station: WebAudio beep played');
      return true;
    } catch (e) {
      console.warn('🔊 Station: WebAudio beep failed', e);
      return false;
    }
  }, []);

  // Start looping fire alarm sound until cleared
  const startAlarmLoop = useCallback(async () => {
    const now = Date.now();
    if (now - lastAlertAtRef.current < 2000) {
      return; // cooldown to avoid rapid repeats from poll + realtime
    }
    lastAlertAtRef.current = now;
    try {
      console.log('🔊 Station: startAlarmLoop init. audioRef?', !!audioRef.current);
      let audio = audioRef.current;
      if (audio && audio.loop && audio.paused === false) {
        // Already looping and playing; do nothing
        return;
      }
      if (!audio) {
        audio = new Audio('/assets/sounds/fire_alarm_sound.mp3');
        audio.preload = 'auto';
        audio.volume = 1.0;
        audioRef.current = audio;
      }
      try { audio.muted = false; } catch (_) {}
      audio.loop = true;
      audio.currentTime = 0;
      await audio.play();
      console.log('🔊 Station: Alarm loop started');
      try { window.__stationAlarmAudio = audio; } catch (_) {}
    } catch (e) {
      console.warn('🔇 Station: Audio blocked; deferring until user interaction', e);
      setShowSoundPrompt(true);
      pendingAlertRef.current = true;
      const attempt = async () => {
        try {
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
          console.log('🔊 Station: Deferred attempt to start alarm loop');
          let audio = audioRef.current;
          if (audio && audio.loop && audio.paused === false) {
            return;
          }
          if (!audio) {
            audio = new Audio('/assets/sounds/fire_alarm_sound.mp3');
            audio.preload = 'auto';
            audio.volume = 1.0;
            audioRef.current = audio;
          }
          try { audio.muted = false; } catch (_) {}
          audio.loop = true;
          audio.currentTime = 0;
          await audio.play();
          try { window.__stationAlarmAudio = audio; } catch (_) {}
        } catch (_) {}
        pendingAlertRef.current = false;
        document.removeEventListener('click', attempt);
        document.removeEventListener('touchstart', attempt);
        document.removeEventListener('keydown', attempt);
        interactionHandlerRegisteredRef.current = false;
      };
      if (!interactionHandlerRegisteredRef.current) {
        document.addEventListener('click', attempt, { once: true });
        document.addEventListener('touchstart', attempt, { once: true });
        document.addEventListener('keydown', attempt, { once: true });
        interactionHandlerRegisteredRef.current = true;
      }
    }
  }, []);

  const stopAlarmLoop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = false;
      console.log('🔇 Station: Alarm loop stopped');
    } catch (_) {}
  }, []);

  // Poll unread notifications and control alarm loop
  // NOTE: Alarm control is now handled globally in StationLayout
  // This effect only updates the local unreadCount for the alert badge
  useEffect(() => {
    let isMounted = true;
    
    const fetchUnread = async () => {
      try {
        const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
        const stationId = userData?.id;
        if (!stationId) return;
        const { data, error } = await supabase
          .from('notifications')
          .select('id, is_read, type')
          .eq('user_id', stationId)
          .eq('user_type', 'station')
          .eq('is_read', false);
        if (!error && Array.isArray(data) && isMounted) {
          const newCount = data.length;
          setUnreadCount(newCount);
          console.log(`🔔 Sdashboard: Unread count: ${newCount}`);
        }
      } catch (_) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Optionally get browser's current location (disabled by default)
  useEffect(() => {
    if (!ENABLE_USER_GEO) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setLocationError(null);
          console.log('✅ Location detected:', location);
        },
        (error) => {
          console.error('❌ Error getting location:', error);
          setLocationError('Unable to get your location. Please check your browser settings.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } else {
      setLocationError('Geolocation is not supported by this browser.');
    }
  }, []);

  // Remove any auto-switching fallback. If context is not ready, seed from localStorage only
  useEffect(() => {
    if (!stationData || !stationData.address) {
      const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
      if (userData && (userData.address || userData.station_name || userData.email)) {
        setFallbackStationData({
          station_name: userData.station_name,
          email: userData.email,
          address: userData.address
        });
      }
    }
  }, [stationData?.address]);

  // Geocode station address to get coordinates
  useEffect(() => {
    const geocodeStationAddress = async () => {
      // Prefer exact coordinates if available
      const currentStationData = stationData?.lat && stationData?.lng
        ? stationData
        : (stationData && stationData.address && stationData.address !== 'Loading...' && stationData.address !== 'Address not specified'
            ? stationData
            : fallbackStationData);
      
      console.log('🔍 Station data received in Sdashboard:', stationData);
      console.log('🔍 Fallback station data:', fallbackStationData);
      console.log('🔍 Using station data:', currentStationData);
      console.log('🔍 Station address specifically:', currentStationData?.address);
      
      // If lat/lng present, set directly
      if (currentStationData?.lat != null && currentStationData?.lng != null) {
        const latNum = parseFloat(currentStationData.lat);
        const lngNum = parseFloat(currentStationData.lng);
        if (!isNaN(latNum) && !isNaN(lngNum)) {
          setStationLocation({ lat: latNum, lng: lngNum });
          setGeocodingError(null);
          return;
        }
      }

      if (!currentStationData?.address || currentStationData.address === 'Loading...' || currentStationData.address === 'Address not specified') {
        console.log('❌ No valid station address to geocode:', currentStationData?.address);
        return;
      }

      try {
        console.log('🔍 Geocoding station address:', currentStationData.address);
        
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: currentStationData.address }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            const coordinates = {
              lat: location.lat(),
              lng: location.lng()
            };
            setStationLocation(coordinates);
            setGeocodingError(null);
            console.log('✅ Station location geocoded successfully:', coordinates);
          } else {
            console.error('❌ Geocoding failed:', status);
            setGeocodingError(`Failed to geocode address: ${status}`);
          }
        });
      } catch (error) {
        console.error('❌ Error during geocoding:', error);
        setGeocodingError(`Geocoding error: ${error.message}`);
      }
    };

    // Only run geocoding after Google Maps API is loaded
    if (window.google && window.google.maps && (stationData?.address || fallbackStationData?.address)) {
      geocodeStationAddress();
    }
  }, [stationData?.address, fallbackStationData?.address, mapLoaded]);

  // Fetch all stations and geocode their addresses so the current station can see others
  useEffect(() => {
    const init = async () => {
      try {
        const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
        if (userData?.id) {
          setCurrentStationId(userData.id);
        }

        const { data: stations, error } = await supabase
          .from('station_users')
          .select('id, station_name, address, lat, lng');

        if (error) {
          console.error('❌ Error fetching stations list:', error);
          return;
        }

        setAllStations(stations || []);

        if (!mapLoaded || !window.google?.maps) return;

        const geocoder = new window.google.maps.Geocoder();

        const results = await Promise.all(
          (stations || []).map((s) => {
            return new Promise((resolve) => {
              // First, check if lat/lng already exist in the database
              const latNum = s?.lat != null ? parseFloat(s.lat) : NaN;
              const lngNum = s?.lng != null ? parseFloat(s.lng) : NaN;
              
              // If we have valid coordinates, use them directly
              if (!isNaN(latNum) && !isNaN(lngNum)) {
                resolve({ 
                  id: s.id, 
                  name: s.station_name || 'Station',
                  address: s.address, 
                  lat: latNum, 
                  lng: lngNum 
                });
                return;
              }
              
              // Otherwise, fall back to geocoding the address
              if (!s?.address) {
                resolve(null);
                return;
              }
              geocoder.geocode({ address: s.address }, (res, status) => {
                if (status === 'OK' && res[0]) {
                  const loc = res[0].geometry.location;
                  resolve({
                    id: s.id,
                    name: s.station_name || 'Station',
                    address: s.address,
                    lat: loc.lat(),
                    lng: loc.lng()
                  });
                } else {
                  resolve(null);
                }
              });
            });
          })
        );

        // Remove duplicate stations based on both ID and coordinates to avoid overlapping circles
        const validResults = results.filter(Boolean);
        const uniqueStations = [];
        const seenIds = new Set();
        const coordsSet = new Set();
        
        validResults.forEach(station => {
          const stationIdStr = String(station.id);
          const coordKey = `${station.lat.toFixed(6)},${station.lng.toFixed(6)}`;
          
          // Skip if we've already added this station ID or these coordinates
          if (!seenIds.has(stationIdStr) && !coordsSet.has(coordKey)) {
            seenIds.add(stationIdStr);
            coordsSet.add(coordKey);
            uniqueStations.push(station);
          }
        });

        setGeocodedStations(uniqueStations);
      } catch (e) {
        console.error('❌ Error initializing stations map:', e);
      }
    };

    init();
  }, [mapLoaded]);

  // Load assigned fire reports for this station
  useEffect(() => {
    const loadAssignedReports = async () => {
      try {
        const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
        const stationId = userData?.id;
        if (!stationId) return;
        if (!mapLoaded) return;

        // 1) Fetch assignments for this station (exclude declined)
        const { data: assignments, error } = await supabase
          .from('report_assignments')
          .select('id, report_id, note, assigned_at, status, assignment_source')
          .eq('assignee_type', 'station')
          .eq('assignee_id', stationId);

        if (error) {
          console.error('❌ Error fetching report assignments for station:', error);
          return;
        }

        // Filter out declined assignments
        const activeAssignments = (assignments || []).filter(
          a => !a.status || a.status !== 'declined'
        );

        // If there are pending assignments when loading (e.g., user was logged out), trigger acceptance/forwarding modal logic
        const pendingAssignment = activeAssignments.find(a => a.status === 'pending');
        if (pendingAssignment) {
          try {
            // Fetch report data
            const response = await fetch('https://new-fira-backend.onrender.com/get_reports');
            const reports = response.ok ? await response.json() : [];
            const reportData = reports.find(r => String(r.id) === String(pendingAssignment.report_id));

            // Check busy state
            const busyCheck = await checkStationIsBusy(stationId);

            const assignmentSource = pendingAssignment.assignment_source || 'manual';
            const assignmentId = pendingAssignment.id;

            // Always surface the modal on load for pending assignments (no silent auto-accept)
            const baseData = {
              reportId: pendingAssignment.report_id,
              assignmentSource,
              reportData,
              assignmentId,
              busyCount: busyCheck.busyCount
            };

            if (assignmentSource === 'automatic' && busyCheck.isBusy) {
              // Busy + auto assignment -> forwarding modal
              setPendingAssignmentData(baseData);
              setShowForwardingRequestModal(true);
            } else {
              // Manual or not busy -> acceptance modal
              setPendingAssignmentData(baseData);
              setShowAcceptanceModal(true);
            }
          } catch (pendingErr) {
            console.error('❌ Error handling pending assignment on load:', pendingErr);
          }
        }

        // 2) Fetch forwarded reports for this station with notes
        const { data: forwarded, error: forwardError } = await supabase
          .from('report_routes')
          .select('report_id, note, forwarded_at')
          .eq('target', `station:${stationId}`);

        if (forwardError) {
          console.error('❌ Error fetching forwarded reports for station:', forwardError);
        }

        // 3) For forwarded reports, get the original assignee info
        const forwardedReportIds = (forwarded || []).map(f => String(f.report_id));
        let originalAssignees = new Map();
        
        if (forwardedReportIds.length > 0) {
          const { data: assignmentData, error: assignError } = await supabase
            .from('report_assignments')
            .select('report_id, assignee_type, assignee_id')
            .in('report_id', forwardedReportIds);
          
          if (!assignError && assignmentData) {
            // Fetch station names for station assignees
            const stationAssignees = assignmentData.filter(a => a.assignee_type === 'station');
            if (stationAssignees.length > 0) {
              const stationIds = stationAssignees.map(a => a.assignee_id);
              const { data: stationNames, error: stationError } = await supabase
                .from('station_users')
                .select('id, station_name')
                .in('id', stationIds);
              
              if (!stationError && stationNames) {
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

        // Create a map of forwarded report IDs to their metadata (note, forwarded_at, original assignee)
        const forwardedMetadata = new Map();
        (forwarded || []).forEach(f => {
          const originalAssignee = originalAssignees.get(String(f.report_id));
          forwardedMetadata.set(String(f.report_id), {
            note: f.note,
            forwarded_at: f.forwarded_at,
            original_assignee: originalAssignee
          });
        });

        // Combine both assigned and forwarded report IDs (use filtered activeAssignments)
        const assignedIds = new Set((activeAssignments || []).map(a => String(a.report_id)));
        const forwardedIds = new Set((forwarded || []).map(f => String(f.report_id)));
        const allReportIds = new Set([...assignedIds, ...forwardedIds]);

        console.log(`📋 Station has ${assignedIds.size} assigned and ${forwardedIds.size} forwarded reports`);

        if (allReportIds.size === 0) {
          setAssignedReports([]);
          return;
        }

        // Create a map of directly assigned report notes (use filtered activeAssignments)
        const assignmentMeta = new Map();
        (activeAssignments || []).forEach(a => {
          assignmentMeta.set(String(a.report_id), { note: a.note || '', assigned_at: a.assigned_at });
        });

        // 3) Fetch full fire reports from the same API used by admin
        const response = await fetch('https://new-fira-backend.onrender.com/get_reports');
        if (!response.ok) {
          console.error('❌ Failed to fetch fire reports for station view:', response.status);
          return;
        }
        const reports = await response.json();
        let withCoords = (reports || []).filter(r => {
          const rid = r?.id != null ? String(r.id) : '';
          return rid && allReportIds.has(rid) && r.latitude && r.longitude && !isNaN(r.latitude) && !isNaN(r.longitude);
        });

        // Drop invalidated reports and unvalidated no-fire / no-smoke reports from station map view
        withCoords = withCoords.filter((r) => !r.invalidated && (!isNoFireNoSmoke(r) || r.validated));

        // 4) Fallback to snapshot table for any report IDs missing in external API
        const missingIds = Array.from(allReportIds).filter(id => !withCoords.find(r => String(r.id) === id));
        if (missingIds.length > 0) {
          const { data: snaps, error: snapErr } = await supabase
            .from('assigned_report_snapshots')
            .select('report_id, lat, lng, address, snapshot_json')
            .in('report_id', missingIds);
          if (!snapErr && Array.isArray(snaps)) {
            const snapAsReports = snaps
              .filter(s => typeof s.lat === 'number' && typeof s.lng === 'number')
              .map(s => ({
                ...(typeof s.snapshot_json === 'object' && s.snapshot_json !== null ? s.snapshot_json : {}),
                id: s.report_id,
                latitude: s.lat,
                longitude: s.lng,
                address: s.address
              }));
            withCoords = withCoords.concat(snapAsReports);
          }
        }

        // 5) Attach forwarding metadata to each report
        const reportsWithMetadata = withCoords.map(report => {
          const rid = String(report.id);
          const forwardingInfo = forwardedMetadata.get(rid);
          
          if (forwardingInfo) {
            // This report was forwarded
            return {
              ...report,
              is_forwarded: true,
              forwarding_note: forwardingInfo.note,
              forwarded_at: forwardingInfo.forwarded_at,
              original_assignee: forwardingInfo.original_assignee
            };
          }
          
          // This report was directly assigned
          return {
            ...report,
            is_forwarded: false,
            assignment_note: assignmentMeta.get(rid)?.note || '',
            assigned_at: assignmentMeta.get(rid)?.assigned_at || null
          };
        });

        console.log('📌 Directly assigned report IDs:', Array.from(assignedIds));
        console.log('📨 Forwarded report IDs:', Array.from(forwardedIds));
        console.log('📍 Total reports on map (assigned + forwarded):', reportsWithMetadata.map(r => ({ id: r.id, lat: r.latitude, lng: r.longitude, forwarded: r.is_forwarded })));
        
        // Cluster reports before setting them
        const clusteredReports = clusterReports(reportsWithMetadata);
        setAssignedReports(clusteredReports);
        try {
          // Detect new report IDs compared to last refresh and trigger alert/notification
          const currentIds = new Set(reportsWithMetadata.map(r => String(r.id)));
          const previousIds = previousReportIdsRef.current;
          const newIds = Array.from(currentIds).filter(id => !previousIds.has(id));
          // Update ref for next cycle
          previousReportIdsRef.current = currentIds;

          if (newIds.length > 0 && unreadCount > 0) {
            // Only start loop if there are unread notifications
            startAlarmLoop();
          }
        } catch (alertErr) {
          console.error('❌ Station: Error processing station alerts:', alertErr);
        }
      } catch (e) {
        console.error('❌ Error loading assigned reports:', e);
      }
    };

    loadAssignedReports();

    // Periodically refresh to capture new assignments
    const interval = setInterval(() => {
      loadAssignedReports();
    }, 15000);
    return () => clearInterval(interval);
  }, [mapLoaded]);

  // On mount, don't stop the alarm - it's now managed globally by StationLayout
  useEffect(() => {
    console.log('📍 Sdashboard: Component mounted');
    // Alarm is managed globally by StationLayout, so we don't touch it here
  }, []);

  // (Bell dropdown logic moved to StationLayout; no local dropdown here)

  // Real-time: listen for new assignments/forwards to this station and alert immediately
  useEffect(() => {
    let channel = null;
    (async () => {
      try {
        const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
        const stationId = userData?.id;
        if (!stationId) return;

        channel = supabase
          .channel(`station-assignments-${stationId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'report_assignments' }, async (payload) => {
            try {
              const row = payload?.new;
              if (!row) return;
              if (row.assignee_type === 'station' && String(row.assignee_id) === String(stationId)) {
                // Fetch report data
                const response = await fetch('https://new-fira-backend.onrender.com/get_reports');
                const reports = response.ok ? await response.json() : [];
                const reportData = reports.find(r => String(r.id) === String(row.report_id));

                // Check if assignment is pending (needs approval)
                if (row.status === 'pending') {
                  // Check if station is busy
                  const busyCheck = await checkStationIsBusy(stationId);
                  
                  if (!busyCheck.isBusy) {
                    // Station is free - auto-accept regardless of assignment source
                    await handleAssignmentResponse(row.report_id, stationId, 'accepted');
                  } else if (row.assignment_source === 'manual') {
                    // Admin assigned and station is busy - show acceptance modal
                    setPendingAssignmentData({
                      reportId: row.report_id,
                      assignmentSource: 'manual',
                      reportData: reportData,
                      assignmentId: row.id
                    });
                    setShowAcceptanceModal(true);
                  } else if (row.assignment_source === 'automatic') {
                    // Auto-assigned and station is busy - show forwarding request modal
                    setPendingAssignmentData({
                      reportId: row.report_id,
                      assignmentSource: 'automatic',
                      reportData: reportData,
                      assignmentId: row.id,
                      busyCount: busyCheck.busyCount
                    });
                    setShowForwardingRequestModal(true);
                  }
                } else {
                  // Already accepted - just show notification
                  const title = 'New Report Assigned to Your Station';
                  const readableId = generateReadableReportId(row.report_id);
                  const message = `Report ${readableId}${row.note ? ` • Note: ${row.note}` : ''}`;
                  startAlarmLoop();
                  await supabase.from('notifications').insert({ user_id: stationId, user_type: 'station', type: 'assignment', title, message, is_read: false, related_report_id: String(row.report_id) });
                }
                
                // Refresh lists
                setTimeout(() => {
                  // trigger reload via polling function by toggling mapLoaded or directly call load (not in scope here)
                }, 300);
              }
            } catch (e) {
              console.error('❌ Station: RT assignment handler error:', e);
            }
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'report_assignments',
            filter: `assignee_type=eq.station&assignee_id=eq.${stationId}`
          }, async (payload) => {
            try {
              const row = payload?.new;
              const oldRow = payload?.old;
              if (!row) return;
              if (row.assignee_type === 'station' && String(row.assignee_id) === String(stationId)) {
                // Handle assignments that become pending (e.g., rerouted assignments)
                // Check if status changed to pending (was not pending before, or is a new assignment to this station)
                const wasPending = oldRow?.status === 'pending';
                const isNowPending = row.status === 'pending';
                
                if (isNowPending && !wasPending) {
                  // Fetch report data
                  const response = await fetch('https://new-fira-backend.onrender.com/get_reports');
                  const reports = response.ok ? await response.json() : [];
                  const reportData = reports.find(r => String(r.id) === String(row.report_id));

                  // Check if station is busy
                  const busyCheck = await checkStationIsBusy(stationId);
                  
                  if (!busyCheck.isBusy) {
                    // Station is free - auto-accept regardless of assignment source
                    await handleAssignmentResponse(row.report_id, stationId, 'accepted');
                  } else if (row.assignment_source === 'manual') {
                    // Admin assigned (including rerouted) and station is busy - show acceptance modal
                    setPendingAssignmentData({
                      reportId: row.report_id,
                      assignmentSource: 'manual',
                      reportData: reportData,
                      assignmentId: row.id
                    });
                    setShowAcceptanceModal(true);
                  } else if (row.assignment_source === 'automatic') {
                    // Auto-assigned and station is busy - show forwarding request modal
                    setPendingAssignmentData({
                      reportId: row.report_id,
                      assignmentSource: 'automatic',
                      reportData: reportData,
                      assignmentId: row.id,
                      busyCount: busyCheck.busyCount
                    });
                    setShowForwardingRequestModal(true);
                  }
                }
              }
            } catch (e) {
              console.error('❌ Station: RT assignment update handler error:', e);
            }
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'report_routes' }, async (payload) => {
            try {
              const row = payload?.new;
              if (!row) return;
              const expectedTarget = `station:${stationId}`;
              if (row.target === expectedTarget) {
                const title = 'Report Forwarded to Your Station';
                const readableId = generateReadableReportId(row.report_id);
                const message = `Report ${readableId}${row.note ? ` • Note: ${row.note}` : ''}`;
                startAlarmLoop();
                await supabase.from('notifications').insert({ user_id: stationId, user_type: 'station', type: 'assignment', title, message, is_read: false, related_report_id: String(row.report_id) });
              }
            } catch (e) {
              console.error('❌ Station: RT forward handler error:', e);
            }
          })
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'report_assignments',
            filter: `assignee_type=eq.station&assignee_id=eq.${stationId}`
          }, async (payload) => {
            try {
              const row = payload?.new;
              if (!row) return;
              
              // If assignment was declined, remove it from the map immediately
              if (row.status === 'declined' && 
                  row.assignee_type === 'station' && 
                  String(row.assignee_id) === String(stationId)) {
                console.log('🗑️ Assignment declined, removing report from map:', row.report_id);
                setAssignedReports(prev => prev.filter(r => String(r.id) !== String(row.report_id)));
                
                // Stop the alarm when assignment is declined
                stopAlarmLoop();
                
                // Mark the related notification as read to stop global alarm
                try {
                  await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('user_id', stationId)
                    .eq('user_type', 'station')
                    .eq('type', 'assignment')
                    .eq('related_report_id', String(row.report_id))
                    .eq('is_read', false);
                } catch (notifError) {
                  console.error('Error marking notification as read:', notifError);
                }
                
                // Close info window if this report is currently selected
                setSelectedAssignedReport(prev => {
                  if (prev && String(prev.id) === String(row.report_id)) {
                    return null;
                  }
                  return prev;
                });
              }
            } catch (e) {
              console.error('❌ Station: RT assignment update handler error:', e);
            }
          })
          .subscribe((status) => {
            // Optional: log status
          });
      } catch (e) {
        console.error('❌ Station: Failed to set up real-time subscription:', e);
      }
    })();

    return () => {
      try { channel && channel.unsubscribe(); } catch (_) {}
    };
  }, []);

  // Load responders assigned to this station
  useEffect(() => {
    const loadResponders = async () => {
      try {
        const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
        const stationId = userData?.id;
        if (!stationId) return;

        const { data: respondersData, error } = await supabase
          .from('responders')
          .select('id, first_name, last_name, email, phone')
          .eq('station_id', stationId);

        if (error) {
          console.error('❌ Error fetching responders:', error);
          return;
        }

        setResponders(respondersData || []);
        console.log('👥 Loaded responders for station:', respondersData?.length || 0);
      } catch (e) {
        console.error('❌ Error loading responders:', e);
      }
    };

    loadResponders();
  }, [currentStationId]);

  const mapContainerStyle = {
    width: '100%',
    // Fill viewport height minus header + paddings to avoid page scroll
    height: 'calc(100vh - 120px)'
  };

  const center = {
    lat: 14.5995,
    lng: 120.9842
  };

  // State to control map center - prevents auto-recentering
  const [mapCenter, setMapCenter] = useState(center);

  // Only update map center when station location is first loaded
  useEffect(() => {
    if (stationLocation) {
      setMapCenter(stationLocation);
    }
  }, [stationLocation]);

  // Handle station marker click
  const handleStationMarkerClick = () => {
    setShowStationInfoWindow(true);
    // Center map on station
    if (stationLocation) {
      setMapCenter(stationLocation);
    }
  };

  const onLoad = useCallback((map) => {
    console.log('✅ Map loaded successfully');
    setMapLoaded(true);
    setMapError(null);
  }, []);

  const onError = useCallback((error) => {
    console.error('❌ Map error:', error);
    setMapError('Failed to load map. Please refresh the page.');
    setMapLoaded(false);
  }, []);

  // Check for selectedReportId from notification click and zoom to it
  useEffect(() => {
    const selectedReportId = localStorage.getItem('selectedReportId');
    if (selectedReportId && assignedReports.length > 0) {
      console.log('🎯 Zooming to selected report:', selectedReportId);
      const report = assignedReports.find(r => String(r.id) === String(selectedReportId));
      if (report && report.latitude && report.longitude) {
        const lat = typeof report.latitude === 'number' ? report.latitude : parseFloat(report.latitude);
        const lng = typeof report.longitude === 'number' ? report.longitude : parseFloat(report.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          setMapCenter({ lat, lng });
          setSelectedAssignedReport(report);
          // Clear the localStorage item after using it
          localStorage.removeItem('selectedReportId');
        }
      }
    }
  }, [assignedReports]);

  const onUnmount = useCallback(() => {
    console.log('🗺️ Map unmounted');
    setMapLoaded(false);
  }, []);

  // Handle notifying responders about fire report
  const handleNotifyResponders = async (fireReport) => {
    console.log('🚨 Notify Responders clicked:', { fireReport, responders: responders.length, currentStationId });
    
    if (!fireReport || !responders.length) {
      alert('No responders available to notify.');
      return;
    }

    if (isNotifying) return;

    setIsNotifying(true);
    
    try {
      const stationData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
      const stationName = stationData?.station_name || 'Fire Station';
      
      console.log('📊 Station data:', { stationName, currentStationId, respondersCount: responders.length });
      
      // Create comprehensive notification message
      const notificationMessage = `👤 Reporter: ${fireReport.reporter_name || 'Unknown Reporter'}\n` +
        `📍 Location: ${fireReport.address || fireReport.geotag_location || 'Not specified'}\n` +
        `🔥 Fire Alarm Level: ${resolveAlarmLevel(fireReport)}\n` +
        `📊 AI Detection: ${fireReport.prediction || 'Unknown'}\n` +
        `⏰ Reported: ${fireReport.formatted_timestamp || fireReport.timestamp || 'Unknown'}\n` +
        `📝 Cause: ${fireReport.cause_of_fire || fireReport.cause || 'Not specified'}\n` +
        `💨 Smoke Analysis: ${fireReport.smoke_analysis || 'Not analyzed'}\n` +
        `🏠 Structure: ${fireReport.structure_type || 'Unknown'}\n` +
        `🏘️ Structures Affected: ${cleanStructuresValue(fireReport.structures_affected || fireReport.number_of_structures_on_fire) || 'Unknown'}`;

      // Send notifications to all responders using responder_notifications table
      const notificationPromises = responders.map(async (responder) => {
        try {
          const { error: notificationError } = await supabase
            .from('responder_notifications')
            .insert({
              responder_id: responder.id,
              station_id: currentStationId,
              fire_report_id: fireReport.id,
              title: `Fire Alert - ${fireReport.address || 'Location Unknown'}`,
              message: notificationMessage,
              priority: 'high',
              is_read: false
            });

          if (notificationError) {
            console.error(`❌ Error notifying responder ${responder.id}:`, notificationError);
            return false;
          }

          console.log(`✅ Notification sent to responder ${responder.id}`);
          return true;
        } catch (error) {
          console.error(`❌ Error notifying responder ${responder.id}:`, error);
          return false;
        }
      });

      const results = await Promise.all(notificationPromises);
      const successCount = results.filter(Boolean).length;
      
      console.log('📊 Notification results:', { successCount, totalResponders: responders.length, results });
      
      if (successCount > 0) {
        alert(`✅ Successfully notified ${successCount} responder(s) about the fire report.`);
        setSelectedAssignedReport(null); // Close the info window
      } else {
        alert('❌ Failed to notify responders. Please check console for details and try again.');
      }
    } catch (error) {
      console.error('❌ Error notifying responders:', error);
      alert(`❌ Error notifying responders: ${error.message}. Please check console for details.`);
    } finally {
      setIsNotifying(false);
    }
  };

  // Color helpers (mirror admin side)
  const getAlarmLevelColor = (alarmLevel) => {
    if (!alarmLevel) return '#6b7280';
    const level = String(alarmLevel).toLowerCase();
    if (level.includes('1st') || level.includes('first')) return '#fef3c7';
    if (level.includes('2nd') || level.includes('second')) return '#fed7aa';
    if (level.includes('3rd') || level.includes('third')) return '#fecaca';
    if (level.includes('4th') || level.includes('fourth')) return '#f87171';
    if (level.includes('5th') || level.includes('fifth')) return '#ef4444';
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
    const alarm = resolveAlarmLevel(report);
    if (alarm) return getAlarmLevelColor(alarm);
    const pred = report?.prediction;
    if (pred === 'Fire') return '#ef4444';
    if (pred === 'No Fire') return '#93c5fd';
    return '#6b7280';
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

  return (
    <div className="relative">
      {/* Alert Indicator - Shows when there are unread assignment notifications */}
      {unreadCount > 0 && (
        <div 
          onClick={stopAlarmLoop}
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
      
      {/* Render map only when Google Maps API is loaded to prevent duplicate loads */}
      {mapsLoadError && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded mb-3">
          Failed to load Google Maps. Please refresh the page.
        </div>
      )}
      {isMapsLoaded && (
        <GoogleMap
          key={`map-${circleVersion}`}
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={stationLocation ? 15 : (userLocation ? 15 : 12)}
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
          {/* User Location Marker (disabled by default for stations) */}
          {ENABLE_USER_GEO && userLocation && mapLoaded && (
            <Marker
              position={userLocation}
              icon={{
                url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMyNTYzRUIiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+',
                scaledSize: new window.google.maps.Size(24, 24),
                anchor: new window.google.maps.Point(12, 12)
              }}
            />
          )}

          {/* Station Location Marker */}
          {stationLocation && mapLoaded && (
            <Marker
              position={stationLocation}
              title={stationData?.station_name || fallbackStationData?.station_name || 'Fire Station'}
              onClick={handleStationMarkerClick}
              icon={{
                url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iNCIgeT0iMTIiIHdpZHRoPSI0MCIgaGVpZ2h0PSIzMiIgcng9IjIiIGZpbGw9IiNlZjQ0NDQiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+CjxyZWN0IHg9IjgiIHk9IjE2IiB3aWR0aD0iMzIiIGhlaWdodD0iMjQiIGZpbGw9IiNmZmZmZmYiLz4KPHJlY3QgeD0iMTIiIHk9IjIwIiB3aWR0aD0iNiIgaGVpZ2h0PSI4IiBmaWxsPSIjZWY0NDQ0Ii8+CjxyZWN0IHg9IjIyIiB5PSIyMCIgd2lkdGg9IjYiIGhlaWdodD0iOCIgZmlsbD0iI2VmNDQ0NCIvPgo8cmVjdCB4PSIzMiIgeT0iMjAiIHdpZHRoPSI2IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMTIiIHk9IjMyIiB3aWR0aD0iNiIgaGVpZ2h0PSI4IiBmaWxsPSIjZWY0NDQ0Ii8+CjxyZWN0IHg9IjIyIiB5PSIzMiIgd2lkdGg9IjYiIGhlaWdodD0iOCIgZmlsbD0iI2VmNDQ0NCIvPgo8cmVjdCB4PSIzMiIgeT0iMzIiIHdpZHRoPSI2IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMjAiIHk9IjQiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMjIiIHk9IjYiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmZmZmYiLz4KPC9zdmc+',
                scaledSize: new window.google.maps.Size(48, 48),
                anchor: new window.google.maps.Point(24, 24)
              }}
            />
          )}

          {/* Station Jurisdiction Circle */}
          {stationLocation && mapLoaded && (
            <Circle
              center={stationLocation}
              radius={jurisdictionRadius}
              options={{
                fillColor: '#ef4444',
                fillOpacity: 0.05,
                strokeColor: '#ef4444',
                strokeOpacity: 0.6,
                strokeWeight: 1.5,
                clickable: false,
                zIndex: 1
              }}
            />
          )}

          {/* Other stations jurisdiction circles */}
          {mapLoaded && geocodedStations.map((s) => {
            // Use string comparison to ensure ID matching works regardless of type
            const isSelf = currentStationId && String(s.id) === String(currentStationId);
            // skip rendering duplicate of own marker since we already render above from stationLocation
            if (isSelf) return null;
            
            // Additional check: skip if coordinates match stationLocation (extra safety against duplicates)
            if (stationLocation && 
                Math.abs(s.lat - stationLocation.lat) < 0.0001 && 
                Math.abs(s.lng - stationLocation.lng) < 0.0001) {
              return null;
            }
            
            const position = { lat: s.lat, lng: s.lng };
            return (
              <Circle
                key={`circle-${s.id}`}
                center={position}
                radius={jurisdictionRadius}
                options={{
                  fillColor: '#a9bbff',
                  fillOpacity: 0.05,
                  strokeColor: '#6b82ff',
                  strokeOpacity: 0.6,
                  strokeWeight: 1,
                  clickable: false,
                  zIndex: 1
                }}
              />
            );
          })}

          {/* Command Center - BFP Regional Office VII */}
          {mapLoaded && (
            <Marker
              position={{ lat: 10.3157, lng: 123.8854 }}
              title="BFP Regional Office VII - Command Center"
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
              zIndex={3000}
              onClick={() => setShowCommandCenterInfo(true)}
              cursor="pointer"
            />
          )}

          {/* Command Center Info Window */}
          {showCommandCenterInfo && mapLoaded && (
            <InfoWindow
              position={{ lat: 10.3157, lng: 123.8854 }}
              onCloseClick={() => setShowCommandCenterInfo(false)}
            >
              <div className="p-3 max-w-sm">
                <h3 className="font-bold text-lg mb-2 text-blue-600">🏢 BFP Regional Office VII</h3>
                <p className="text-sm text-blue-600 font-medium mb-2">📍 Command Center</p>
                <div className="space-y-1 text-sm text-gray-700">
                  <p><strong>Address:</strong> 6000 Natalio B. Bacalso Ave</p>
                  <p><strong>City:</strong> Cebu City, Cebu 6000</p>
                  <p><strong>Plus Code:</strong> 7VXR+5VG</p>
                  <p><strong>Coordinates:</strong></p>
                  <p className="ml-2">Lat: 10.3157</p>
                  <p className="ml-2">Lng: 123.8854</p>
                  <p><strong>Status:</strong> <span className="text-green-600 font-semibold">Active</span></p>
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Other stations: markers only (circles rendered above) */}
          {mapLoaded && geocodedStations.map((s) => {
            // Use string comparison to ensure ID matching works regardless of type
            const isSelf = currentStationId && String(s.id) === String(currentStationId);
            // skip rendering duplicate of own marker since we already render above from stationLocation
            if (isSelf) return null;
            
            // Additional check: skip if coordinates match stationLocation (extra safety against duplicates)
            if (stationLocation && 
                Math.abs(s.lat - stationLocation.lat) < 0.0001 && 
                Math.abs(s.lng - stationLocation.lng) < 0.0001) {
              return null;
            }
            
            const position = { lat: s.lat, lng: s.lng };
            return (
              <Marker
                key={s.id}
                position={position}
                title={s.name}
                icon={{
                  url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iNCIgeT0iMTIiIHdpZHRoPSI0MCIgaGVpZ2h0PSIzMiIgcng9IjIiIGZpbGw9IiNlZjQ0NDQiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+CjxyZWN0IHg9IjgiIHk9IjE2IiB3aWR0aD0iMzIiIGhlaWdodD0iMjQiIGZpbGw9IiNmZmZmZmYiLz4KPHJlY3QgeD0iMTIiIHk9IjIwIiB3aWR0aD0iNiIgaGVpZ2h0PSI4IiBmaWxsPSIjZWY0NDQ0Ii8+CjxyZWN0IHg9IjIyIiB5PSIyMCIgd2lkdGg9IjYiIGhlaWdodD0iOCIgZmlsbD0iI2VmNDQ0NCIvPgo8cmVjdCB4PSIzMiIgeT0iMjAiIHdpZHRoPSI2IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMTIiIHk9IjMyIiB3aWR0aD0iNiIgaGVpZ2h0PSI4IiBmaWxsPSIjZWY0NDQ0Ii8+CjxyZWN0IHg9IjIyIiB5PSIzMiIgd2lkdGg9IjYiIGhlaWdodD0iOCIgZmlsbD0iI2VmNDQ0NCIvPgo8cmVjdCB4PSIzMiIgeT0iMzIiIHdpZHRoPSI2IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMjAiIHk9IjQiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMjIiIHk9IjYiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmZmZmYiLz4KPC9zdmc+',
                  scaledSize: new window.google.maps.Size(48, 48),
                  anchor: new window.google.maps.Point(24, 24)
                }}
                zIndex={2}
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
            );
          })}

          {/* Assigned fire reports for this station (inside map) */}
          {mapLoaded && assignedReports
            .filter(report => {
              // Hide Fire Out and Cancelled reports from the map
              const status = (report.status || report.progress || '').toString().toLowerCase();
              const isCancelled = status.includes('cancelled') || status.includes('canceled');
              const isFireOut = status.includes('fire out');
              return !isCancelled && !isFireOut;
            })
            .map((report) => {
            const latVal = report.latitude ?? report.lat;
            const lngVal = report.longitude ?? report.lng;
            const lat = parseFloat(latVal);
            const lng = parseFloat(lngVal);
            if (isNaN(lat) || isNaN(lng)) return null;
            const customIcon = getMarkerIconWithBadge(report);
            const hasBadge = (report.reportStrength || 1) > 1;
            
            return (
              <Marker
                key={`assigned-${report.id}`}
                position={{ lat, lng }}
                title={`Assigned: ${report.address || report.geotag_location || 'Fire Report'}`}
                icon={customIcon}
                label={hasBadge ? undefined : { text: '🔥', fontSize: '32px' }}
                zIndex={4000}
                onClick={() => {
                  setSelectedAssignedReport({
                    ...report,
                    latitude: lat,
                    longitude: lng
                  });
                  setClusterIndex(0); // Reset to first report in cluster
                  // Center map on clicked fire report
                  setMapCenter({ lat, lng });
                }}
              />
            );
          })}

          {/* Info window for selected assigned report (matches admin layout) */}
          {selectedAssignedReport && (() => {
            const currentReport = selectedAssignedReport.reports && selectedAssignedReport.reports.length > 0
              ? selectedAssignedReport.reports[clusterIndex] || selectedAssignedReport.reports[0]
              : selectedAssignedReport;
            const reportCount = selectedAssignedReport.reportStrength || 1;
            const hasMultipleReports = reportCount > 1;
            
            return (
            <InfoWindow
              position={{
                lat: parseFloat(selectedAssignedReport.latitude),
                lng: parseFloat(selectedAssignedReport.longitude)
              }}
              onCloseClick={() => {
                setSelectedAssignedReport(null);
                setClusterIndex(0);
              }}
            >
              <div className="p-3 max-w-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg text-red-600">🔥 Fire Report</h3>
                  {hasMultipleReports && (
                    <div className="flex items-center space-x-1 bg-red-50 px-2 py-1 rounded border border-red-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (clusterIndex > 0) setClusterIndex(clusterIndex - 1);
                        }}
                        disabled={clusterIndex === 0}
                        className={`px-1 py-0.5 rounded text-xs font-bold ${
                          clusterIndex === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        ←
                      </button>
                      <span className="text-xs font-semibold text-red-700 px-1">
                        {clusterIndex + 1}/{reportCount}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (clusterIndex < reportCount - 1) setClusterIndex(clusterIndex + 1);
                        }}
                        disabled={clusterIndex >= reportCount - 1}
                        className={`px-1 py-0.5 rounded text-xs font-bold ${
                          clusterIndex >= reportCount - 1
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
                
                {hasMultipleReports && (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                    <p className="text-blue-800 font-semibold">📊 Cluster: {reportCount} reports</p>
                  </div>
                )}
                
                {/* Show forwarding information if this report was forwarded */}
                {currentReport.is_forwarded && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-xs font-semibold text-amber-800 mb-1">📨 Forwarded Report</p>
                    {currentReport.original_assignee && (
                      <p className="text-xs text-amber-700 mb-1">
                        <strong>Originally assigned to:</strong> {currentReport.original_assignee.name}
                      </p>
                    )}
                    {currentReport.forwarding_note && (
                      <p className="text-xs text-amber-700">
                        <strong>Note:</strong> {currentReport.forwarding_note}
                      </p>
                    )}
                    {currentReport.forwarded_at && (
                      <p className="text-xs text-amber-600 mt-1">
                        Forwarded: {new Date(currentReport.forwarded_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
                {/* Show assignment note for directly assigned reports */}
                {!currentReport.is_forwarded && currentReport.assignment_note && (
                  <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded">
                    <p className="text-xs font-semibold text-slate-800 mb-1">📝 Assignment Note</p>
                    <p className="text-xs text-slate-700">{currentReport.assignment_note}</p>
                  </div>
                )}
                
                <div className="space-y-2 text-sm">
                  {currentReport.reporter && (
                    <p><strong>Reporter:</strong> {currentReport.reporter}</p>
                  )}
                  {(currentReport.cause_of_fire || currentReport.cause) && (
                    <p><strong>Cause:</strong> {currentReport.cause_of_fire || currentReport.cause}</p>
                  )}
                <p><strong>Fire Alarm Level:</strong> <span className="ml-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">{resolveAlarmLevel(currentReport)}</span></p>
                  {(currentReport.prediction || currentReport.confidence) && (
                    <p><strong>AI Fire Analysis:</strong> <span className={`ml-1 px-2 py-1 rounded text-xs font-semibold ${currentReport.prediction === 'Fire' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>{currentReport.prediction || 'Unknown'}{currentReport.confidence ? ` (${currentReport.confidence})` : ''}</span></p>
                  )}
                  {(currentReport.smoke_detection || currentReport.smoke_confidence) && (
                    <p>
                      <strong>Smoke Analysis:</strong>{' '}
                      {currentReport.smoke_detection || 'Smoke'}
                      {currentReport.smoke_confidence ? ` (${currentReport.smoke_confidence})` : ''}
                    </p>
                  )}
                  {currentReport.structure && (
                    <p><strong>AI Structure Analysis:</strong> {currentReport.structure}{currentReport.structure_confidence ? ` (${currentReport.structure_confidence})` : ''}</p>
                  )}
                  {(() => {
                    const structures = cleanStructuresValue(currentReport.number_of_structures_on_fire || currentReport.structures_affected);
                    return structures != null ? (
                      <p><strong>Structures Affected:</strong> {structures} structure(s)</p>
                    ) : null;
                  })()}
                  <p><strong>Location:</strong> {currentReport.address || currentReport.geotag_location || 'Not specified'}</p>
                  {(currentReport.formatted_timestamp || currentReport.timestamp) && (
                    <p><strong>Reported:</strong> {currentReport.formatted_timestamp || currentReport.timestamp}</p>
                  )}
                  {currentReport.image_url && (
                    <div className="mt-2">
                      <img src={currentReport.image_url} alt="Fire report" className="w-full h-32 object-cover rounded" />
                    </div>
                  )}
                </div>
              </div>
            </InfoWindow>
            );
          })()}

          {/* Station Info Window */}
          {showStationInfoWindow && stationLocation && (
            <InfoWindow
              position={stationLocation}
              onCloseClick={() => setShowStationInfoWindow(false)}
            >
              <div className="p-2 max-w-xs">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">🏢</span>
                  <h3 className="text-lg font-bold text-red-600">
                    {(stationData?.station_name || fallbackStationData?.station_name) || 'Fire Station'}
                  </h3>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">📍 </span>
                    <span className="text-gray-800">
                      {(stationData?.address || fallbackStationData?.address) || 'Address not specified'}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">📧 </span>
                    <span className="text-gray-800">
                      {(stationData?.email || fallbackStationData?.email) || 'Email not specified'}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">📞 </span>
                    <span className="text-gray-800">
                      {(stationData?.phone || fallbackStationData?.phone) || 'Phone not specified'}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-gray-600">👤 </span>
                    <span className="text-gray-800">
                      {(stationData?.position || fallbackStationData?.position) || 'Position not specified'}
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-600">🗺️ </span>
                    <span className="text-gray-800 text-xs">
                      {stationLocation.lat.toFixed(6)}, {stationLocation.lng.toFixed(6)}
                    </span>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-600">🎯 </span>
                    <span className="text-gray-800 text-xs">
                      Jurisdiction: {(jurisdictionRadius / 1000).toFixed(1)}km radius
                    </span>
                  </div>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}
      
      {/* (Bell moved to top-right StationLayout) */}

      {/* Loading Overlay */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

          {/* Assigned fire reports for this station */}
          {mapLoaded && assignedReports
            .filter(report => {
              // Hide Fire Out and Cancelled reports from the map
              const status = (report.status || report.progress || '').toString().toLowerCase();
              const isCancelled = status.includes('cancelled') || status.includes('canceled');
              const isFireOut = status.includes('fire out');
              return !isCancelled && !isFireOut;
            })
            .map((report) => {
            const latVal = report.latitude ?? report.lat;
            const lngVal = report.longitude ?? report.lng;
            const lat = parseFloat(latVal);
            const lng = parseFloat(lngVal);
            if (isNaN(lat) || isNaN(lng)) return null;
            return (
              <Marker
                key={`assigned-${report.id}`}
                position={{ lat, lng }}
                title={`Assigned: ${report.address || report.geotag_location || 'Fire Report'}`}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: '#dc2626',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  scale: 10
                }}
                zIndex={4000}
              />
            );
          })}

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
      
      {/* Location Status Display */}
      <div className="absolute top-20 left-4 bg-white bg-opacity-90 p-3 rounded-lg shadow-lg z-20">
        {userLocation ? (
          <div className="text-sm">
            <p className="font-semibold text-blue-600 mt-4">📍 Your Location</p>
            <p className="text-gray-700">
              Lat: {userLocation.lat.toFixed(6)}
            </p>
            <p className="text-gray-700">
              Lng: {userLocation.lng.toFixed(6)}
            </p>
          </div>
        ) : locationError ? (
          <div className="text-sm">
            <p className="font-semibold text-red-600">❌ Location Error</p>
            <p className="text-gray-700">{locationError}</p>
          </div>
        ) : (
          <div className="text-sm">
            <p className="font-semibold text-yellow-600">🔄 Detecting Location...</p>
            <p className="text-gray-700">Please allow location access</p>
          </div>
        )}
      </div>

      {/* Jurisdiction Control Panel */}
      <div className="absolute top-20 left-4 bg-white bg-opacity-95 p-4 rounded-lg shadow-lg z-20 max-w-xs">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
          🎯 Jurisdiction Control
        </h4>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-600">Coverage Radius</label>
            <div className="flex items-center space-x-2">
              <input
                type="range"
                min="500"
                max="5000"
                step="250"
                value={jurisdictionRadius}
                onChange={(e) => {
                  setJurisdictionRadius(parseInt(e.target.value));
                  setCircleVersion(v => v + 1);
                }}
                className="flex-1"
              />
              <span className="text-xs text-gray-700 font-medium min-w-[3rem]">
                {(jurisdictionRadius / 1000).toFixed(1)}km
              </span>
            </div>
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => {
                setJurisdictionRadius(1000);
                setCircleVersion(v => v + 1);
              }}
              className={`px-2 py-1 text-xs rounded ${jurisdictionRadius === 1000 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              1km
            </button>
            <button
              onClick={() => {
                setJurisdictionRadius(2000);
                setCircleVersion(v => v + 1);
              }}
              className={`px-2 py-1 text-xs rounded ${jurisdictionRadius === 2000 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              2km
            </button>
            <button
              onClick={() => {
                setJurisdictionRadius(3000);
                setCircleVersion(v => v + 1);
              }}
              className={`px-2 py-1 text-xs rounded ${jurisdictionRadius === 3000 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              3km
            </button>
          </div>
        </div>
      </div>

      {/* Station Location Status Display */}
      <div className="absolute top-20 right-4 bg-white bg-opacity-95 rounded-lg shadow-lg z-20 max-w-xs border-l-4 border-red-500 overflow-hidden transition-all duration-300">
        {/* Header with minimize button */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <p className="font-semibold text-red-600 text-base">
            🏢 {(stationData?.station_name || fallbackStationData?.station_name) || 'Fire Station'}
          </p>
          <button
            onClick={() => setIsStationInfoMinimized(!isStationInfoMinimized)}
            className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded hover:bg-gray-100"
            title={isStationInfoMinimized ? "Expand" : "Minimize"}
          >
            {isStationInfoMinimized ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>

        {/* Content (hidden when minimized) */}
        {!isStationInfoMinimized && (
          <div className="p-4">
            {stationLocation ? (
              <div className="text-sm">
                <p className="text-gray-700 text-xs mt-1">
                  📍 {(stationData?.address || fallbackStationData?.address) || 'Address not specified'}
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  Lat: {stationLocation.lat.toFixed(6)}
                </p>
                <p className="text-gray-500 text-xs">
                  Lng: {stationLocation.lng.toFixed(6)}
                </p>
                <p className="text-green-600 text-xs mt-2 font-medium">
                  ✅ Station Located
                </p>
              </div>
            ) : geocodingError ? (
              <div className="text-sm">
                <p className="font-semibold text-red-600">❌ Station Location Error</p>
                <p className="text-gray-700 text-xs">{geocodingError}</p>
                <p className="text-gray-500 text-xs mt-1">
                  Address: {stationData?.address || 'Not specified'}
                </p>
              </div>
            ) : (stationData?.address || fallbackStationData?.address) && (stationData?.address !== 'Loading...' && stationData?.address !== 'Address not specified') ? (
              <div className="text-sm">
                <p className="font-semibold text-yellow-600">🔄 Locating Station...</p>
                <p className="text-gray-700 text-xs">
                  {(stationData?.address || fallbackStationData?.address)}
                </p>
              </div>
            ) : (
              <div className="text-sm">
                <p className="font-semibold text-gray-600">🏢 Station Info</p>
                <p className="text-gray-700 text-xs">
                  {(stationData?.station_name || fallbackStationData?.station_name) || 'Station Name'}
                </p>
                <p className="text-gray-500 text-xs">
                  No address specified
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assignment Acceptance Modal */}
      {showAcceptanceModal && pendingAssignmentData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 transform transition-all animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-full p-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">Assignment Request</h3>
            <p className="text-gray-600 text-center mb-8 leading-relaxed">
              Command Center is assigning you a report <span className="font-semibold text-gray-900">{pendingAssignmentData.reportData?.address || pendingAssignmentData.reportData?.geotag_location || 'at a location'}</span>. 
              Will you accept this assignment?
            </p>
            <div className="flex space-x-4">
              <button
                onClick={async () => {
                  try {
                    const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
                    const stationId = userData?.id;
                    if (!stationId) {
                      alert('Station ID not found. Please refresh and try again.');
                      return;
                    }

                    const result = await handleAssignmentResponse(
                      pendingAssignmentData.reportId,
                      stationId,
                      'declined'
                    );

                    if (result.success) {
                      // Stop the alarm when declining
                      stopAlarmLoop();
                      
                      // Mark the related notification as read to stop global alarm
                      try {
                        await supabase
                          .from('notifications')
                          .update({ is_read: true })
                          .eq('user_id', stationId)
                          .eq('user_type', 'station')
                          .eq('type', 'assignment')
                          .eq('related_report_id', String(pendingAssignmentData.reportId))
                          .eq('is_read', false);
                      } catch (notifError) {
                        console.error('Error marking notification as read:', notifError);
                      }
                      
                      setShowAcceptanceModal(false);
                      setPendingAssignmentData(null);
                      // Admin will be notified via real-time listener
                    } else {
                      alert(result.error || 'Failed to decline assignment. Please try again.');
                    }
                  } catch (error) {
                    console.error('Error declining assignment:', error);
                    alert('An error occurred. Please try again.');
                  }
                }}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md hover:shadow-lg"
              >
                No
              </button>
              <button
                onClick={async () => {
                  try {
                    const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
                    const stationId = userData?.id;
                    if (!stationId) {
                      alert('Station ID not found. Please refresh and try again.');
                      return;
                    }

                    const result = await handleAssignmentResponse(
                      pendingAssignmentData.reportId,
                      stationId,
                      'accepted'
                    );

                    if (result.success) {
                      setShowAcceptanceModal(false);
                      setPendingAssignmentData(null);
                      alert('✅ Assignment accepted successfully!');
                    } else {
                      alert(result.error || 'Failed to accept assignment. Please try again.');
                    }
                  } catch (error) {
                    console.error('Error accepting assignment:', error);
                    alert('An error occurred. Please try again.');
                  }
                }}
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-md hover:shadow-lg"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forwarding Request Modal */}
      {showForwardingRequestModal && pendingAssignmentData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 transform transition-all animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-full p-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">Request Forwarding?</h3>
            <p className="text-gray-600 text-center mb-8 leading-relaxed">
              You are currently handling <span className="font-semibold text-gray-900">{pendingAssignmentData.busyCount || 0} other incident(s)</span>. 
              Would you like to request admin for forwarding of this report to another station?
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  // Auto-accept if they don't want forwarding
                  (async () => {
                    try {
                      const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
                      const stationId = userData?.id;
                      if (!stationId) return;

                      await handleAssignmentResponse(
                        pendingAssignmentData.reportId,
                        stationId,
                        'accepted'
                      );
                    } catch (error) {
                      console.error('Error accepting assignment:', error);
                    }
                  })();
                  setShowForwardingRequestModal(false);
                  setPendingAssignmentData(null);
                }}
                className="flex-1 bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                No
              </button>
              <button
                onClick={async () => {
                  try {
                    const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
                    const stationId = userData?.id;
                    if (!stationId) {
                      alert('Station ID not found. Please refresh and try again.');
                      return;
                    }

                    // Request forwarding
                    const result = await requestForwarding(pendingAssignmentData.reportId, stationId);
                    
                    if (result.success) {
                      // Decline the assignment
                      const declineResult = await handleAssignmentResponse(
                        pendingAssignmentData.reportId,
                        stationId,
                        'declined'
                      );
                      
                      if (declineResult.success) {
                        // Stop the alarm when declining (via forwarding request)
                        stopAlarmLoop();
                        
                        // Mark the related notification as read to stop global alarm
                        try {
                          await supabase
                            .from('notifications')
                            .update({ is_read: true })
                            .eq('user_id', stationId)
                            .eq('user_type', 'station')
                            .eq('type', 'assignment')
                            .eq('related_report_id', String(pendingAssignmentData.reportId))
                            .eq('is_read', false);
                        } catch (notifError) {
                          console.error('Error marking notification as read:', notifError);
                        }
                        
                        setShowForwardingRequestModal(false);
                        setPendingAssignmentData(null);
                        alert('✅ Forwarding request sent to admin. They will reroute the incident to another station.');
                      } else {
                        alert(declineResult.error || 'Failed to decline assignment. Please try again.');
                      }
                    } else {
                      alert(result.error || 'Failed to send forwarding request. Please try again.');
                    }
                  } catch (error) {
                    console.error('Error requesting forwarding:', error);
                    alert('An error occurred. Please try again.');
                  }
                }}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Yes
              </button>
            </div>
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

export default Sdashboard;