import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../../../config/supabase';

const Sdashboard = () => {
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
  const [jurisdictionRadius, setJurisdictionRadius] = useState(2000); // 2km radius in meters
  const [allStations, setAllStations] = useState([]); // raw stations from DB
  const [geocodedStations, setGeocodedStations] = useState([]); // [{id, name, address, lat, lng}]
  const [currentStationId, setCurrentStationId] = useState(null);
  const [assignedReports, setAssignedReports] = useState([]); // fire reports assigned to this station
  const [selectedAssignedReport, setSelectedAssignedReport] = useState(null);
  const [responders, setResponders] = useState([]); // responders assigned to this station
  const [isNotifying, setIsNotifying] = useState(false);

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
          .select('id, station_name, address');

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
          .select('report_id')
          .eq('assignee_type', 'station')
          .eq('assignee_id', stationId);

        if (error) {
          console.error('❌ Error fetching report assignments for station:', error);
          return;
        }

        // Normalize IDs to strings to avoid numeric vs string mismatch
        const assignedIds = new Set((assignments || []).map(a => String(a.report_id)));
        if (assignedIds.size === 0) {
          setAssignedReports([]);
          return;
        }

        // 2) Fetch full fire reports from the same API used by admin
        const response = await fetch('https://fire-detection-api-production-f543.up.railway.app/get_reports');
        if (!response.ok) {
          console.error('❌ Failed to fetch fire reports for station view:', response.status);
          return;
        }
        const reports = await response.json();
        let withCoords = (reports || []).filter(r => {
          const rid = r?.id != null ? String(r.id) : '';
          return rid && assignedIds.has(rid) && r.latitude && r.longitude && !isNaN(r.latitude) && !isNaN(r.longitude);
        });

        // 3) Fallback to snapshot table for any assigned IDs missing in external API
        const missingIds = Array.from(assignedIds).filter(id => !withCoords.find(r => String(r.id) === id));
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

        console.log('📌 Assigned report IDs:', Array.from(assignedIds));
        console.log('📌 Assigned reports (withCoords from API + snapshots):', withCoords.map(r => ({ id: r.id, lat: r.latitude, lng: r.longitude })));
        setAssignedReports(withCoords);
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
    width: '100vw',
    height: '100vh'
  };

  const center = {
    lat: 14.5995,
    lng: 120.9842
  };

  // Determine map center - prioritize first assigned report then station
  const firstAssigned = assignedReports[0];
  const firstAssignedCenter = firstAssigned ? {
    lat: parseFloat(firstAssigned.latitude ?? firstAssigned.lat),
    lng: parseFloat(firstAssigned.longitude ?? firstAssigned.lng)
  } : null;
  const mapCenter = (firstAssignedCenter && !isNaN(firstAssignedCenter.lat) && !isNaN(firstAssignedCenter.lng))
    ? firstAssignedCenter
    : (stationLocation || userLocation || center);

  // Handle station marker click
  const handleStationMarkerClick = () => {
    setShowStationInfoWindow(true);
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
        `🏘️ Structures Affected: ${fireReport.structures_affected || 'Unknown'}`;

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
      <LoadScript 
        googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        onLoad={() => console.log('✅ Google Maps API loaded')}
        onError={(error) => console.error('❌ Google Maps API error:', error)}
      >
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
                  strokeWeight: 2,
                  scale: 12
                }}
                label={{ text: '🔥', fontSize: '14px' }}
                zIndex={4000}
                onClick={() => setSelectedAssignedReport({
                  ...report,
                  latitude: lat,
                  longitude: lng
                })}
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
                    <p><strong>Structure:</strong> {selectedAssignedReport.structure}</p>
                  )}
                  {selectedAssignedReport.number_of_structures_on_fire != null && (
                    <p><strong>Structures Affected:</strong> {selectedAssignedReport.number_of_structures_on_fire} structure(s)</p>
                  )}
                  <p><strong>Location:</strong> {selectedAssignedReport.address || selectedAssignedReport.geotag_location || 'Not specified'}</p>
                  {(selectedAssignedReport.formatted_timestamp || selectedAssignedReport.timestamp) && (
                    <p><strong>Reported:</strong> {selectedAssignedReport.formatted_timestamp || selectedAssignedReport.timestamp}</p>
                  )}
                  {selectedAssignedReport.image_url && (
                    <div className="mt-2">
                      <img src={selectedAssignedReport.image_url} alt="Fire report" className="w-full h-32 object-cover rounded" />
                    </div>
                  )}
                  
                  {/* Notify Responders Button */}
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleNotifyResponders(selectedAssignedReport)}
                      disabled={isNotifying || !responders.length}
                      className={`w-full px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 ${
                        isNotifying || !responders.length
                          ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {isNotifying ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Notifying...</span>
                        </>
                      ) : (
                        <>
                          <span>🚨</span>
                          <span>Notify Responders ({responders.length})</span>
                        </>
                      )}
                    </button>
                    {!responders.length && (
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        No responders assigned to this station
                      </p>
                    )}
                  </div>
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
      </LoadScript>
      
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