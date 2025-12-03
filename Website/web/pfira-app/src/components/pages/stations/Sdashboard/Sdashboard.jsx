import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow, Circle, useJsApiLoader } from '@react-google-maps/api';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../../../config/supabase';

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
  const [allStations, setAllStations] = useState([]); // raw stations from DB
  const [geocodedStations, setGeocodedStations] = useState([]); // [{id, name, address, lat, lng}]
  const [currentStationId, setCurrentStationId] = useState(null);
  const [assignedReports, setAssignedReports] = useState([]); // fire reports assigned to this station
  const [selectedAssignedReport, setSelectedAssignedReport] = useState(null);
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

        setGeocodedStations(results.filter(Boolean));
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

        // 1) Fetch assignments for this station
        const { data: assignments, error } = await supabase
          .from('report_assignments')
          .select('report_id, note, assigned_at')
          .eq('assignee_type', 'station')
          .eq('assignee_id', stationId);

        if (error) {
          console.error('❌ Error fetching report assignments for station:', error);
          return;
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

        // Combine both assigned and forwarded report IDs
        const assignedIds = new Set((assignments || []).map(a => String(a.report_id)));
        const forwardedIds = new Set((forwarded || []).map(f => String(f.report_id)));
        const allReportIds = new Set([...assignedIds, ...forwardedIds]);

        console.log(`📋 Station has ${assignedIds.size} assigned and ${forwardedIds.size} forwarded reports`);

        if (allReportIds.size === 0) {
          setAssignedReports([]);
          return;
        }

        // Create a map of directly assigned report notes
        const assignmentMeta = new Map();
        (assignments || []).forEach(a => {
          assignmentMeta.set(String(a.report_id), { note: a.note || '', assigned_at: a.assigned_at });
        });

        // 3) Fetch full fire reports from the same API used by admin
        const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
        if (!response.ok) {
          console.error('❌ Failed to fetch fire reports for station view:', response.status);
          return;
        }
        const reports = await response.json();
        let withCoords = (reports || []).filter(r => {
          const rid = r?.id != null ? String(r.id) : '';
          return rid && allReportIds.has(rid) && r.latitude && r.longitude && !isNaN(r.latitude) && !isNaN(r.longitude);
        });

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
        setAssignedReports(reportsWithMetadata);
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
                // Immediate alert and persist notification
                const title = 'New Report Assigned to Your Station';
                const readableId = generateReadableReportId(row.report_id);
                const message = `Report ${readableId}${row.note ? ` • Note: ${row.note}` : ''}`;
                startAlarmLoop();
                await supabase.from('notifications').insert({ user_id: stationId, user_type: 'station', type: 'assignment', title, message, is_read: false, related_report_id: String(row.report_id) });
                // Refresh lists
                setTimeout(() => {
                  // trigger reload via polling function by toggling mapLoaded or directly call load (not in scope here)
                }, 300);
              }
            } catch (e) {
              console.error('❌ Station: RT assignment handler error:', e);
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
        `🔥 Alarm Level: ${fireReport.recommended_alarm_level || fireReport.alarm_level || 'Unknown'}\n` +
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
    if (level.includes('first alarm')) return '#fef3c7';
    if (level.includes('second alarm')) return '#fed7aa';
    if (level.includes('third alarm')) return '#fecaca';
    if (level.includes('fourth alarm')) return '#f87171';
    if (level.includes('fifth alarm')) return '#ef4444';
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
    const alarm = report?.recommended_alarm_level || report?.alarm_level;
    if (alarm) return getAlarmLevelColor(alarm);
    const pred = report?.prediction;
    if (pred === 'Fire') return '#ef4444';
    if (pred === 'No Fire') return '#93c5fd';
    return '#6b7280';
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

          {/* Other stations: markers and jurisdiction circles */}
          {mapLoaded && geocodedStations.map((s) => {
            const isSelf = currentStationId && s.id === currentStationId;
            // skip rendering duplicate of own marker since we already render above from stationLocation
            if (isSelf) return null;
            const position = { lat: s.lat, lng: s.lng };
            return (
              <React.Fragment key={s.id}>
                <Marker
                  position={position}
                  title={s.name}
                  icon={{
                    url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iNCIgeT0iMTIiIHdpZHRoPSI0MCIgaGVpZ2h0PSIzMiIgcng9IjIiIGZpbGw9IiNlZjQ0NDQiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+CjxyZWN0IHg9IjgiIHk9IjE2IiB3aWR0aD0iMzIiIGhlaWdodD0iMjQiIGZpbGw9IiNmZmZmZmYiLz4KPHJlY3QgeD0iMTIiIHk9IjIwIiB3aWR0aD0iNiIgaGVpZ2h0PSI4IiBmaWxsPSIjZWY0NDQ0Ii8+CjxyZWN0IHg9IjIyIiB5PSIyMCIgd2lkdGg9IjYiIGhlaWdodD0iOCIgZmlsbD0iI2VmNDQ0NCIvPgo8cmVjdCB4PSIzMiIgeT0iMjAiIHdpZHRoPSI2IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMTIiIHk9IjMyIiB3aWR0aD0iNiIgaGVpZ2h0PSI4IiBmaWxsPSIjZWY0NDQ0Ii8+CjxyZWN0IHg9IjIyIiB5PSIzMiIgd2lkdGg9IjYiIGhlaWdodD0iOCIgZmlsbD0iI2VmNDQ0NCIvPgo8cmVjdCB4PSIzMiIgeT0iMzIiIHdpZHRoPSI2IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMjAiIHk9IjQiIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNlZjQ0NDQiLz4KPHJlY3QgeD0iMjIiIHk9IjYiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmZmZmYiLz4KPC9zdmc+',
                    scaledSize: new window.google.maps.Size(48, 48),
                    anchor: new window.google.maps.Point(24, 24)
                  }}
                  zIndex={2}
                />
                <Circle
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
              </React.Fragment>
            );
          })}

          {/* Assigned fire reports for this station (inside map) */}
          {mapLoaded && assignedReports.map((report) => {
            const latVal = report.latitude ?? report.lat;
            const lngVal = report.longitude ?? report.lng;
            const lat = parseFloat(latVal);
            const lng = parseFloat(lngVal);
            if (isNaN(lat) || isNaN(lng)) return null;
            const color = getMarkerColor(report);
            return (
              <Marker
                key={`assigned-${report.id}`}
                position={{ lat, lng }}
                title={`Assigned: ${report.address || report.geotag_location || 'Fire Report'}`}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: color,
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 4,
                  scale: 30
                }}
                label={{ text: '🔥', fontSize: '32px' }}
                zIndex={4000}
                onClick={() => {
                  setSelectedAssignedReport({
                    ...report,
                    latitude: lat,
                    longitude: lng
                  });
                  // Center map on clicked fire report
                  setMapCenter({ lat, lng });
                }}
              />
            );
          })}

          {/* Info window for selected assigned report (matches admin layout) */}
          {selectedAssignedReport && (
            <InfoWindow
              position={{
                lat: parseFloat(selectedAssignedReport.latitude),
                lng: parseFloat(selectedAssignedReport.longitude)
              }}
              onCloseClick={() => setSelectedAssignedReport(null)}
            >
              <div className="p-3 max-w-sm">
                <h3 className="font-bold text-lg mb-2 text-red-600">🔥 Fire Report</h3>
                
                {/* Show forwarding information if this report was forwarded */}
                {selectedAssignedReport.is_forwarded && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-xs font-semibold text-amber-800 mb-1">📨 Forwarded Report</p>
                    {selectedAssignedReport.original_assignee && (
                      <p className="text-xs text-amber-700 mb-1">
                        <strong>Originally assigned to:</strong> {selectedAssignedReport.original_assignee.name}
                      </p>
                    )}
                    {selectedAssignedReport.forwarding_note && (
                      <p className="text-xs text-amber-700">
                        <strong>Note:</strong> {selectedAssignedReport.forwarding_note}
                      </p>
                    )}
                    {selectedAssignedReport.forwarded_at && (
                      <p className="text-xs text-amber-600 mt-1">
                        Forwarded: {new Date(selectedAssignedReport.forwarded_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
                {/* Show assignment note for directly assigned reports */}
                {!selectedAssignedReport.is_forwarded && selectedAssignedReport.assignment_note && (
                  <div className="mb-3 p-2 bg-slate-50 border border-slate-200 rounded">
                    <p className="text-xs font-semibold text-slate-800 mb-1">📝 Assignment Note</p>
                    <p className="text-xs text-slate-700">{selectedAssignedReport.assignment_note}</p>
                  </div>
                )}
                
                <div className="space-y-2 text-sm">
                  {selectedAssignedReport.reporter && (
                    <p><strong>Reporter:</strong> {selectedAssignedReport.reporter}</p>
                  )}
                  {(selectedAssignedReport.cause_of_fire || selectedAssignedReport.cause) && (
                    <p><strong>Cause:</strong> {selectedAssignedReport.cause_of_fire || selectedAssignedReport.cause}</p>
                  )}
                  {(selectedAssignedReport.recommended_alarm_level || selectedAssignedReport.alarm_level) && (
                    <p><strong>Alarm Level:</strong> <span className="ml-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">{selectedAssignedReport.recommended_alarm_level || selectedAssignedReport.alarm_level}</span></p>
                  )}
                  {(selectedAssignedReport.prediction || selectedAssignedReport.confidence) && (
                    <p><strong>AI Fire Detection:</strong> <span className={`ml-1 px-2 py-1 rounded text-xs font-semibold ${selectedAssignedReport.prediction === 'Fire' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>{selectedAssignedReport.prediction || 'Unknown'}{selectedAssignedReport.confidence ? ` (${selectedAssignedReport.confidence})` : ''}</span></p>
                  )}
                  {(selectedAssignedReport.smoke_intensity || selectedAssignedReport.smoke_confidence) && (
                    <p><strong>Smoke Analysis:</strong> {selectedAssignedReport.smoke_intensity || '—'} {selectedAssignedReport.smoke_confidence || ''}</p>
                  )}
                  {selectedAssignedReport.structure && (
                    <p><strong>Structure:</strong> {selectedAssignedReport.structure}{selectedAssignedReport.structure_confidence ? ` (${selectedAssignedReport.structure_confidence})` : ''}</p>
                  )}
                  {(() => {
                    const structures = cleanStructuresValue(selectedAssignedReport.number_of_structures_on_fire || selectedAssignedReport.structures_affected);
                    return structures != null ? (
                      <p><strong>Structures Affected:</strong> {structures} structure(s)</p>
                    ) : null;
                  })()}
                  <p><strong>Location:</strong> {selectedAssignedReport.address || selectedAssignedReport.geotag_location || 'Not specified'}</p>
                  {(selectedAssignedReport.formatted_timestamp || selectedAssignedReport.timestamp) && (
                    <p><strong>Reported:</strong> {selectedAssignedReport.formatted_timestamp || selectedAssignedReport.timestamp}</p>
                  )}
                  {selectedAssignedReport.image_url && (
                    <div className="mt-2">
                      <img src={selectedAssignedReport.image_url} alt="Fire report" className="w-full h-32 object-cover rounded" />
                    </div>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}

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
          {mapLoaded && assignedReports.map((report) => {
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
                onChange={(e) => setJurisdictionRadius(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-gray-700 font-medium min-w-[3rem]">
                {(jurisdictionRadius / 1000).toFixed(1)}km
              </span>
            </div>
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => setJurisdictionRadius(1000)}
              className={`px-2 py-1 text-xs rounded ${jurisdictionRadius === 1000 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              1km
            </button>
            <button
              onClick={() => setJurisdictionRadius(2000)}
              className={`px-2 py-1 text-xs rounded ${jurisdictionRadius === 2000 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              2km
            </button>
            <button
              onClick={() => setJurisdictionRadius(3000)}
              className={`px-2 py-1 text-xs rounded ${jurisdictionRadius === 3000 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              3km
            </button>
          </div>
        </div>
      </div>

      {/* Station Location Status Display */}
      <div className="absolute top-20 right-4 bg-white bg-opacity-95 p-4 rounded-lg shadow-lg z-20 max-w-xs border-l-4 border-red-500">
        {stationLocation ? (
          <div className="text-sm">
            <p className="font-semibold text-red-600 text-base">🏢 {(stationData?.station_name || fallbackStationData?.station_name) || 'Fire Station'}</p>
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

    </div>
  );
};

export default Sdashboard;