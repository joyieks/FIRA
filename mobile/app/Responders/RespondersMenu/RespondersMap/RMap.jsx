import React, { useState, useEffect } from 'react';
import { View, Alert, Text, ActivityIndicator, Modal, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import MapView, { Marker, Circle, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../../../config/supabase';
import { useAuth } from '../../../config/AuthContext';
import { GOOGLE_MAPS_API_KEY, MAP_CONFIG, DIRECTIONS_API } from '../../../config/map';

export default function RMap() {
  const { userData } = useAuth();
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assignedReports, setAssignedReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [region, setRegion] = useState(null);
  const [stationInfo, setStationInfo] = useState(null);
  const [jurisdiction, setJurisdiction] = useState(null);
  const [acceptedAssignment, setAcceptedAssignment] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null); // { duration, distance, status }
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Helper functions
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
    // First check for alarm level
    if (report?.recommended_alarm_level || report?.alarm_level) {
      return getAlarmLevelColor(report.recommended_alarm_level || report.alarm_level);
    }
    
    // Fallback to prediction-based colors
    switch (report?.prediction) {
      case 'Fire': return '#ef4444'; // Red for active fire
      case 'No Fire': return '#93c5fd'; // Light blue for no fire
      default: return '#6b7280'; // Gray for unknown
    }
  };

  const formatAlarm = (report) => {
    return report?.recommended_alarm_level || report?.alarm_level || report?.status || 'Unknown';
  };

  const formatPrediction = (report) => {
    return report?.prediction || report?.ai_detection || 'Unknown';
  };

  const toStr = (val, fallback = 'Not specified') => {
    if (val === null || val === undefined || val === '') return fallback;
    return String(val);
  };

  // Function to center map on user's location
  const centerOnUserLocation = async () => {
    if (!location) return;
    
    const userRegion = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };
    setRegion(userRegion);
  };

  // Function to center map on station location
  const centerOnStationLocation = () => {
    if (!stationInfo || (!stationInfo.lat && !stationInfo.latitude) || (!stationInfo.lng && !stationInfo.longitude)) return;
    
    const stationRegion = {
      latitude: parseFloat(stationInfo.lat || stationInfo.latitude),
      longitude: parseFloat(stationInfo.lng || stationInfo.longitude),
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(stationRegion);
  };

  // Function to calculate route between current location and fire report using Google Directions API
  const calculateRoute = async (destinationLat, destinationLng, userLocation = null) => {
    const currentLocation = userLocation || location;
    
    if (!currentLocation?.coords) {
      console.log('❌ Cannot calculate route: user location not available');
      setRouteInfo({ status: 'error', message: 'Location not available' });
      return false;
    }

    if (!destinationLat || !destinationLng || isNaN(destinationLat) || isNaN(destinationLng)) {
      console.log('❌ Cannot calculate route: invalid destination coordinates', { destinationLat, destinationLng });
      setRouteInfo({ status: 'error', message: 'Invalid destination coordinates' });
      return false;
    }

    // Additional validation for reasonable coordinates (Philippines bounds)
    if (destinationLat < 4.0 || destinationLat > 21.0 || destinationLng < 116.0 || destinationLng > 127.0) {
      console.log('❌ Destination coordinates outside Philippines bounds:', { destinationLat, destinationLng });
      setRouteInfo({ status: 'error', message: 'Destination coordinates appear to be invalid (outside Philippines)' });
      return false;
    }

    // Check if user location is reasonable
    if (currentLocation.coords.latitude < 4.0 || currentLocation.coords.latitude > 21.0 || 
        currentLocation.coords.longitude < 116.0 || currentLocation.coords.longitude > 127.0) {
      console.log('❌ User location outside Philippines bounds:', currentLocation.coords);
      setRouteInfo({ status: 'error', message: 'Your location appears to be invalid (outside Philippines)' });
      return false;
    }

    try {
      setIsCalculatingRoute(true);
      setRouteInfo({ status: 'calculating', message: 'Calculating route...' });
      
      console.log('🗺️ Calculating route using Google Directions API...');
      console.log('📍 From:', currentLocation.coords.latitude, currentLocation.coords.longitude);
      console.log('📍 To:', destinationLat, destinationLng);
      
      const origin = `${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;
      const destination = `${destinationLat},${destinationLng}`;
      
      // Enhanced Google Directions API with traffic and alternative routes
      const directionsUrl = `${DIRECTIONS_API.BASE_URL}?origin=${origin}&destination=${destination}&mode=${DIRECTIONS_API.TRAVEL_MODE}&avoid=${DIRECTIONS_API.AVOID}&departure_time=now&traffic_model=best_guess&alternatives=false&key=${GOOGLE_MAPS_API_KEY}`;
      console.log('🌐 Directions API URL:', directionsUrl);
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(directionsUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Directions API HTTP error: ${response.status} - ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📡 Google Directions API response status:', data.status);
      console.log('📡 Google Directions API full response:', JSON.stringify(data, null, 2));
      
      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        const points = route.overview_polyline.points;
        
        // Decode polyline points
        console.log('📦 Raw polyline data:', points);
        const decodedPoints = decodePolyline(points);
        console.log('📍 First few decoded points:', decodedPoints.slice(0, 3));
        console.log('📍 Last few decoded points:', decodedPoints.slice(-3));
        
        // Validate that decoded points are reasonable
        const validPoints = decodedPoints.filter(point => 
          point.latitude >= 4.0 && point.latitude <= 21.0 && 
          point.longitude >= 116.0 && point.longitude <= 127.0
        );
        
        if (validPoints.length !== decodedPoints.length) {
          console.log('⚠️ Some decoded points are outside Philippines bounds');
          console.log('📊 Valid points:', validPoints.length, 'Total points:', decodedPoints.length);
        }
        
        setRouteCoordinates(decodedPoints);
        
        // Store route information
        const routeData = {
          status: 'success',
          duration: leg?.duration?.text || 'Unknown',
          durationValue: leg?.duration?.value || 0, // in seconds
          distance: leg?.distance?.text || 'Unknown',
          distanceValue: leg?.distance?.value || 0, // in meters
          durationInTraffic: leg?.duration_in_traffic?.text || null,
          message: 'Route calculated successfully'
        };
        
        setRouteInfo(routeData);
        
        console.log('✅ Google Directions route calculated successfully:');
        console.log('📍 Route duration:', routeData.duration);
        console.log('📍 Route distance:', routeData.distance);
        console.log('📍 Duration in traffic:', routeData.durationInTraffic);
        console.log('📍 Points:', decodedPoints.length);
        
        return true; // Success
      } else {
        console.log('⚠️ No route found from Google Directions. Status:', data.status);
        console.log('⚠️ Error message:', data.error_message);
        
        // Handle specific API errors
        let errorMessage = 'Route calculation failed';
        switch (data.status) {
          case 'NOT_FOUND':
            errorMessage = 'Route not found - location may be inaccessible';
            break;
          case 'ZERO_RESULTS':
            errorMessage = 'No route available between these locations';
            break;
          case 'OVER_QUERY_LIMIT':
            errorMessage = 'API quota exceeded - please try again later';
            break;
          case 'REQUEST_DENIED':
            errorMessage = 'API access denied - check configuration';
            break;
          case 'INVALID_REQUEST':
            errorMessage = 'Invalid route request';
            break;
          default:
            errorMessage = data.error_message || 'Unknown routing error';
        }
        
        // Fallback: create a simple straight line with estimated info
        createStraightLineRoute(destinationLat, destinationLng, errorMessage, currentLocation);
        return false; // Fallback used
      }
    } catch (error) {
      console.error('❌ Error calculating route with Google Directions:', error);
      
      let errorMessage = 'Network error during route calculation';
      if (error.name === 'AbortError') {
        errorMessage = 'Route calculation timed out';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network connection error';
      }
      
      // Fallback: create a simple straight line
      createStraightLineRoute(destinationLat, destinationLng, errorMessage, currentLocation);
      return false; // Fallback used
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Helper function to create straight line fallback route with estimated info
  const createStraightLineRoute = (destinationLat, destinationLng, errorMessage = 'Using straight-line route', userLocation = null) => {
    const currentLocation = userLocation || location;
    
    if (!currentLocation?.coords) {
      console.log('❌ Cannot create straight line route: no location available');
      return;
    }
    
    console.log('⚠️ Using straight line fallback from:', currentLocation.coords, 'to:', { destinationLat, destinationLng });
    console.log('📏 Creating straight line route with error message:', errorMessage);
    
    const straightLineRoute = [
      {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      },
      {
        latitude: destinationLat,
        longitude: destinationLng,
      }
    ];
    
    // Calculate straight-line distance using Haversine formula
    const earthRadius = 6371; // Earth's radius in kilometers
    const lat1Rad = (currentLocation.coords.latitude * Math.PI) / 180;
    const lat2Rad = (destinationLat * Math.PI) / 180;
    const deltaLatRad = ((destinationLat - currentLocation.coords.latitude) * Math.PI) / 180;
    const deltaLngRad = ((destinationLng - currentLocation.coords.longitude) * Math.PI) / 180;
    
    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = earthRadius * c;
    
    console.log('📏 Calculated straight-line distance:', distanceKm.toFixed(2), 'km');
    
    // Validate distance is reasonable (within Philippines, max ~1000km)
    if (distanceKm > 1000) {
      console.log('⚠️ WARNING: Distance seems too large for Philippines:', distanceKm, 'km');
      console.log('⚠️ This suggests coordinate issues. Rechecking coordinates...');
      console.log('📍 Your location:', location.coords);
      console.log('📍 Destination:', { destinationLat, destinationLng });
    }
    
    // Estimate driving time (assuming average speed of 30 km/h in city)
    const estimatedTimeMinutes = Math.round((distanceKm / 30) * 60);
    
    const routeData = {
      status: 'fallback',
      distance: `${distanceKm.toFixed(1)} km`,
      distanceValue: Math.round(distanceKm * 1000), // in meters
      duration: `~${estimatedTimeMinutes} min`,
      durationValue: estimatedTimeMinutes * 60, // in seconds
      durationInTraffic: null,
      message: errorMessage,
      isStraightLine: true
    };
    
    setRouteInfo(routeData);
    setRouteCoordinates(straightLineRoute);
    
    console.log('📍 Straight line route created:');
    console.log('📍 Estimated distance:', routeData.distance);
    console.log('📍 Estimated duration:', routeData.duration);
  };

  // Function to decode Google polyline points
  const decodePolyline = (encoded) => {
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    console.log('🔍 Decoded polyline points:', points.length, 'points');
    return points;
  };

  // Function to get current location with retries
  const getCurrentLocationWithRetry = async (maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`📍 Location attempt ${attempt}/${maxRetries}...`);
      
      try {
        // Check permission first
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('❌ Location permission not granted');
          return null;
        }

        // Try to get location with progressive accuracy
        const accuracyLevels = [
          { accuracy: Location.Accuracy.High, timeout: 8000 },
          { accuracy: Location.Accuracy.Balanced, timeout: 5000 },
          { accuracy: Location.Accuracy.Low, timeout: 3000 }
        ];

        for (const config of accuracyLevels) {
          try {
            console.log(`📍 Trying accuracy level: ${config.accuracy}`);
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: config.accuracy,
              maximumAge: 30000,
              timeout: config.timeout,
            });
            
            console.log('✅ Location obtained:', {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              accuracy: currentLocation.coords.accuracy,
              attempt: attempt,
              accuracyLevel: config.accuracy
            });
            
            return currentLocation;
          } catch (accuracyError) {
            console.log(`⚠️ Accuracy level ${config.accuracy} failed:`, accuracyError.message);
            continue;
          }
        }
        
      } catch (error) {
        console.log(`❌ Location attempt ${attempt} failed:`, error.message);
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting 1 second before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log('❌ All location attempts failed');
    return null;
  };

  // Function to handle assignment acceptance
  const handleAcceptAssignment = async (report) => {
    try {
      console.log('✅ Assignment accepted for report:', report.id);
      
      if (!userData?.id) {
        Alert.alert('Error', 'User not found. Please log in again.');
        return;
      }

      // Find and update the notification status to 'accepted'
      try {
        const { error: updateError } = await supabase
          .from('responder_notifications')
          .update({ 
            is_read: true,
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('responder_id', userData.id)
          .eq('fire_report_id', String(report.id));

        if (updateError) {
          console.error('Error updating notification status:', updateError);
        } else {
          console.log('✅ Notification marked as accepted');
        }
      } catch (notificationError) {
        console.error('Error updating notification:', notificationError);
      }

      // Update the report to show it's accepted
      const updatedReport = { ...report, isAccepted: true };
      setAcceptedAssignment(updatedReport);
      
      // Update the report in the assigned reports list
      setAssignedReports(prevReports => 
        prevReports.map(r => r.id === report.id ? updatedReport : r)
      );
      
      // Calculate route to the fire report
      console.log('🔍 Raw fire report data:', report);
      console.log('🔍 Available coordinate fields:', {
        latitude: report.latitude,
        longitude: report.longitude,
        lat: report.lat,
        lng: report.lng
      });
      
      const lat = parseFloat(report.latitude || report.lat);
      const lng = parseFloat(report.longitude || report.lng);
      
      console.log('📍 Parsed coordinates:', { lat, lng, isValidLat: !isNaN(lat), isValidLng: !isNaN(lng) });
      console.log('📍 Current user location:', location?.coords);
      
      // Validate coordinates are reasonable (Philippines area)
      const isValidPhilippinesLat = lat >= 4.0 && lat <= 21.0;
      const isValidPhilippinesLng = lng >= 116.0 && lng <= 127.0;
      console.log('📍 Philippines coordinate validation:', { isValidPhilippinesLat, isValidPhilippinesLng });
      
      if (!isNaN(lat) && !isNaN(lng)) {
        // Try to use existing location first, then fetch fresh location if needed
        let currentLocationData = location;
        
        if (!currentLocationData?.coords) {
          console.log('📍 No existing location available, attempting to get fresh location...');
          setIsGettingLocation(true);
          
          try {
            currentLocationData = await getCurrentLocationWithRetry(3);
            
            if (currentLocationData) {
              // Update the main location state with fresh data
              setLocation(currentLocationData);
              console.log('✅ Fresh location obtained and stored');
            }
          } finally {
            setIsGettingLocation(false);
          }
        } else {
          console.log('✅ Using existing location data');
        }
        
        if (currentLocationData?.coords) {
          console.log('🗺️ Calling calculateRoute with current location...');
          console.log('📍 Using location:', currentLocationData.coords);
          
          // Update location state and pass current location directly to avoid race condition
          setLocation(currentLocationData);
          
          const routeSuccess = await calculateRoute(lat, lng, currentLocationData);
          
          // Center map on the route
          const routeRegion = {
            latitude: (currentLocationData.coords.latitude + lat) / 2,
            longitude: (currentLocationData.coords.longitude + lng) / 2,
            latitudeDelta: Math.abs(currentLocationData.coords.latitude - lat) * 1.5 + 0.01,
            longitudeDelta: Math.abs(currentLocationData.coords.longitude - lng) * 1.5 + 0.01,
          };
          setRegion(routeRegion);
          
          if (routeSuccess) {
            Alert.alert('Assignment Accepted', 'Route to fire report has been calculated using Google Directions API.');
          } else {
            Alert.alert('Assignment Accepted', 'Assignment accepted. Showing straight-line route (Google Directions unavailable).');
          }
        } else {
          console.log('⚠️ No location available, creating straight line route');
          // Still create a fallback route even without current location
          const fallbackLocation = {
            latitude: 10.3157, // Cebu area fallback
            longitude: 123.8854
          };
          const straightLineRoute = [
            fallbackLocation,
            { latitude: lat, longitude: lng }
          ];
          setRouteCoordinates(straightLineRoute);
          
          // Center on destination
          setRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
          
          Alert.alert('Assignment Accepted', 'Assignment accepted. Could not access your location - please check location permissions and try again.');
        }
      } else {
        console.error('❌ Invalid coordinates for fire report:', { lat, lng, report });
        Alert.alert('Assignment Accepted', 'Assignment accepted. Invalid location coordinates for routing.');
      }
      
    } catch (error) {
      console.error('Error accepting assignment:', error);
      Alert.alert('Error', `Failed to accept assignment: ${error.message}`);
    }
  };

  // Fetch station information and jurisdiction
  const fetchStationInfo = async () => {
    const stationId = userData?.stationId || userData?.station_id;
    if (!stationId) {
      console.log('❌ No stationId found in userData:', userData);
      return;
    }

    try {
      console.log('🏢 Fetching station info for stationId:', stationId);
      console.log('👤 Current user data:', userData);
      
      // Fetch station details using the station ID from responder's station_id field
      const { data: stationData, error: stationError } = await supabase
        .from('station_users')
        .select('*')
        .eq('id', stationId)
        .single();

      if (stationError) {
        console.error('❌ Error fetching station data:', stationError);
        
        // Try alternative query in case the ID format is different
        console.log('🔄 Trying alternative station lookup...');
        const { data: altStationData, error: altError } = await supabase
          .from('station_users')
          .select('*')
          .eq('station_id', stationId)
          .single();
          
        if (altError) {
          console.error('❌ Alternative station lookup also failed:', altError);
          return;
        } else if (altStationData) {
          console.log('✅ Station found with alternative lookup:', altStationData);
          setStationInfo(altStationData);
          const altJurisdiction = altStationData.jurisdiction || 
                                altStationData.area_of_coverage || 
                                altStationData.coverage_area ||
                                altStationData.address ||
                                'Station Jurisdiction';
          setJurisdiction(altJurisdiction);
          return;
        }
        return;
      }

      if (stationData) {
        console.log('✅ Station data fetched successfully:', stationData);
        console.log('📍 Station coordinates available:', {
          lat: stationData.lat,
          lng: stationData.lng,
          latitude: stationData.latitude,
          longitude: stationData.longitude
        });
        
        setStationInfo(stationData);
        
        // Set jurisdiction based on station data
        const stationJurisdiction = stationData.jurisdiction || 
                                  stationData.area_of_coverage || 
                                  stationData.coverage_area ||
                                  stationData.address ||
                                  stationData.station_name ||
                                  'Station Jurisdiction';
        setJurisdiction(stationJurisdiction);
        
        console.log('🏛️ Station jurisdiction set to:', stationJurisdiction);
        
        // Check if station has coordinates (try both field name formats)
        const hasLatLng = (stationData.lat && stationData.lng) || (stationData.latitude && stationData.longitude);
        if (!hasLatLng) {
          console.log('⚠️ Station does not have coordinates - fire station marker will not be displayed');
          console.log('💡 Available station fields:', Object.keys(stationData));
        } else {
          const lat = parseFloat(stationData.lat || stationData.latitude);
          const lng = parseFloat(stationData.lng || stationData.longitude);
          console.log('✅ Station coordinates found - fire station marker and jurisdiction will be displayed at:', { lat, lng });
        }
      } else {
        console.log('❌ No station data found for stationId:', stationId);
        console.log('💡 This means the station may not exist in station_users table');
      }
    } catch (error) {
      console.error('❌ Unexpected error fetching station info:', error);
    }
  };

  // Fetch assigned fire reports
  const fetchAssignedReports = async () => {
    if (!userData?.id) return;

    try {
      console.log('🔍 Fetching assigned reports for responder:', userData.id);
      
      // Get fire report IDs from responder notifications (unread or accepted)
      const { data: notifications, error: notificationError } = await supabase
        .from('responder_notifications')
        .select('fire_report_id, status, message')
        .eq('responder_id', userData.id)
        .or('is_read.eq.false,status.eq.accepted');

      if (notificationError) {
        console.error('Error fetching notifications:', notificationError);
        return;
      }

      if (!notifications || notifications.length === 0) {
        console.log('No assigned reports found');
        setAssignedReports([]);
        return;
      }

      const reportIds = notifications.map(n => n.fire_report_id).filter(Boolean);
      console.log('📋 Fire report IDs from notifications:', reportIds);

      if (reportIds.length === 0) {
        setAssignedReports([]);
        return;
      }

      // Fetch fire reports from API
      const response = await fetch('https://fire-detection-api-production-f8a3.up.railway.app/get_reports');
      if (!response.ok) {
        console.error('Failed to fetch fire reports from API');
        return;
      }

      const allReports = await response.json();
      console.log('🔥 All reports from API:', allReports);
      
      const assignedFireReports = allReports.filter(report => 
        reportIds.includes(String(report.id)) && 
        report.latitude && 
        report.longitude
      ).map(report => {
        // Check if this report is accepted
        const notification = notifications.find(n => n.fire_report_id === String(report.id));
        
        // Log the report data to see what fields are available
        console.log('📋 Report data for ID', report.id, ':', report);
        console.log('📝 Cause fields in report:', {
          cause: report.cause,
          possible_cause: report.possible_cause,
          fire_cause: report.fire_cause,
          cause_of_fire: report.cause_of_fire,
          fire_cause_description: report.fire_cause_description,
          incident_cause: report.incident_cause
        });
        
        // Extract cause from notification message as fallback
        let causeFromNotification = null;
        if (notification?.message) {
          const messageLines = notification.message.split('\n');
          const causeLine = messageLines.find(line => line.includes('📝 Cause: '));
          if (causeLine) {
            causeFromNotification = causeLine.replace('📝 Cause: ', '').trim();
            console.log('📝 Cause from notification:', causeFromNotification);
          }
        }
        
        return {
          ...report,
          isAccepted: notification?.status === 'accepted',
          // Add cause from notification as fallback
          cause: report.cause || 
                 report.possible_cause || 
                 report.fire_cause || 
                 report.cause_of_fire ||
                 causeFromNotification ||
                 'Not specified'
        };
      });

      console.log('✅ Assigned fire reports found:', assignedFireReports.length);
      setAssignedReports(assignedFireReports);

      // If there's an accepted assignment, calculate route automatically
      const acceptedReport = assignedFireReports.find(report => report.isAccepted);
      if (acceptedReport && location) {
        console.log('🗺️ Found accepted assignment, calculating route automatically');
        setAcceptedAssignment(acceptedReport);
        await calculateRoute(parseFloat(acceptedReport.latitude), parseFloat(acceptedReport.longitude), location);
      }

    } catch (error) {
      console.error('Error fetching assigned reports:', error);
    }
  };

  // Get current location and fetch assigned reports
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        console.log('🔍 Starting location setup...');
        
        // Set a fallback region first (Cebu area based on your logs)
        const fallbackRegion = {
          latitude: 10.3157,
          longitude: 123.8854,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setRegion(fallbackRegion);
        console.log('🗺️ Set fallback region:', fallbackRegion);
        
        // Request location permission
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('⚠️ Location permission denied, using fallback region');
          setErrorMsg('Location permission denied - using default view');
          // Continue with fallback region
        } else {
          console.log('✅ Location permission granted');

          // Get current location with progressive accuracy
          console.log('📍 Getting current location...');
          let currentLocation;
          
          try {
            // Try best accuracy first
            currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.BestForNavigation,
              maximumAge: 10000,
              timeout: 10000,
            });
          } catch (error) {
            console.log('⚠️ Best accuracy failed, trying high accuracy...');
            try {
              // Fallback to high accuracy
              currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                maximumAge: 30000,
                timeout: 8000,
              });
            } catch (error2) {
              console.log('⚠️ High accuracy failed, trying balanced...');
              try {
                // Final fallback to balanced
                currentLocation = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                  maximumAge: 60000,
                  timeout: 5000,
                });
              } catch (error3) {
                console.log('⚠️ All location attempts failed, using fallback region');
                // Use fallback region if all location attempts fail
                currentLocation = null;
              }
            }
          }
          
          if (currentLocation) {
            console.log('📍 Location obtained:', {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              accuracy: currentLocation.coords.accuracy
            });

            setLocation(currentLocation);

            // Update region with user's actual location
            const userRegion = {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            };
            
            console.log('🗺️ Updating map region to user location:', userRegion);
            setRegion(userRegion);
          } else {
            console.log('⚠️ Using fallback region - no location obtained');
          }
        }

        // Fetch assigned reports and station info (regardless of location success)
        await Promise.all([
          fetchAssignedReports(),
          fetchStationInfo()
        ]);

      } catch (error) {
        console.error('❌ Error in location/assigned reports setup:', error);
        setErrorMsg(`Failed to load map: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Fetch assigned reports and station info when userData changes
  useEffect(() => {
    if (userData?.id) {
      fetchAssignedReports();
    }
    if (userData?.stationId || userData?.station_id) {
      fetchStationInfo();
    }
  }, [userData?.id, userData?.stationId, userData?.station_id]);

  // Always render the map instantly; show a lightweight overlay while loading

  if (errorMsg) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', textAlign: 'center', marginBottom: 20 }}>{errorMsg}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setErrorMsg(null);
            setIsLoading(true);
            // Retry location setup
            (async () => {
              try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

                let currentLocation = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                  maximumAge: 30000,
                  timeout: 10000,
                });
                
                setLocation(currentLocation);
                setRegion({
                  latitude: currentLocation.coords.latitude,
                  longitude: currentLocation.coords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
                
                await fetchAssignedReports();
              } catch (error) {
                setErrorMsg(`Failed to load location: ${error.message}`);
              } finally {
                setIsLoading(false);
              }
    })();
          }}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={{ color: 'white', marginLeft: 8, fontWeight: 'bold' }}>Retry Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If no region is set, show a simple loading
  if (!region) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ff512f" />
        <Text style={{ marginTop: 10, color: 'gray' }}>Initializing map...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Loading overlay (non-blocking) */}
      {isLoading && (
        <View style={{ position: 'absolute', top: 12, right: 12, zIndex: 2000, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#ff512f" />
          <Text style={{ marginLeft: 8, color: '#374151', fontSize: 12 }}>Loading data…</Text>
        </View>
      )}


      <MapView
        style={{ flex: 1 }}
        initialRegion={region || {
          latitude: 10.3157,
          longitude: 123.8854,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        region={region || undefined}
        showsUserLocation={true}
        showsMyLocationButton={true}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
        followsUserLocation={true}
        onRegionChangeComplete={setRegion}
      >
        {/* Current responder location */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Your Location"
            description="Responder Position"
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#3b82f6',
              borderWidth: 3,
              borderColor: '#fff',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>🚑</Text>
            </View>
          </Marker>
        )}

        {/* Station location marker */}
        {stationInfo && ((stationInfo.lat && stationInfo.lng) || (stationInfo.latitude && stationInfo.longitude)) && (
          <Marker
            coordinate={{
              latitude: parseFloat(stationInfo.lat || stationInfo.latitude),
              longitude: parseFloat(stationInfo.lng || stationInfo.longitude),
            }}
            title={stationInfo.station_name || 'Your Station'}
            description={`Jurisdiction: ${jurisdiction || 'Not specified'}`}
          >
            <View style={{
              width: 48,
              height: 48,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 6,
            }}>
              {/* Custom Fire Station Icon - matches web version */}
              <View style={{
                width: 40,
                height: 32,
                backgroundColor: '#ef4444', // Red building
                borderRadius: 2,
                borderWidth: 3,
                borderColor: '#ffffff',
                position: 'relative',
              }}>
                {/* Building base */}
                <View style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  right: 4,
                  bottom: 4,
                  backgroundColor: '#ffffff',
                  borderRadius: 1,
                }} />
                
                {/* Windows - 3 columns, 2 rows */}
                <View style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  right: 8,
                  bottom: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}>
                  {/* Left column windows */}
                  <View style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View style={{ width: 6, height: 8, backgroundColor: '#ef4444' }} />
                    <View style={{ width: 6, height: 8, backgroundColor: '#ef4444' }} />
                  </View>
                  
                  {/* Middle column windows */}
                  <View style={{ flex: 1, justifyContent: 'space-between', marginHorizontal: 2 }}>
                    <View style={{ width: 6, height: 8, backgroundColor: '#ef4444' }} />
                    <View style={{ width: 6, height: 8, backgroundColor: '#ef4444' }} />
                  </View>
                  
                  {/* Right column windows */}
                  <View style={{ flex: 1, justifyContent: 'space-between' }}>
                    <View style={{ width: 6, height: 8, backgroundColor: '#ef4444' }} />
                    <View style={{ width: 6, height: 8, backgroundColor: '#ef4444' }} />
                  </View>
                </View>
                
                {/* Roof */}
                <View style={{
                  position: 'absolute',
                  top: -8,
                  left: 16,
                  width: 8,
                  height: 8,
                  backgroundColor: '#ef4444',
                  borderRadius: 1,
                }}>
                  <View style={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    width: 4,
                    height: 4,
                    backgroundColor: '#ffffff',
                    borderRadius: 1,
                  }} />
                </View>
              </View>
            </View>
          </Marker>
        )}

        {/* Station jurisdiction circle */}
        {stationInfo && ((stationInfo.lat && stationInfo.lng) || (stationInfo.latitude && stationInfo.longitude)) && (
          <Circle
            center={{
              latitude: parseFloat(stationInfo.lat || stationInfo.latitude),
              longitude: parseFloat(stationInfo.lng || stationInfo.longitude),
            }}
            radius={MAP_CONFIG.JURISDICTION_RADIUS}
            strokeColor={MAP_CONFIG.JURISDICTION_STROKE_COLOR}
            fillColor={MAP_CONFIG.JURISDICTION_FILL_COLOR}
            strokeWidth={MAP_CONFIG.JURISDICTION_STROKE_WIDTH}
          />
        )}

        {/* Route polyline for accepted assignment */}
        {routeCoordinates.length > 0 && (
          <>
            {/* White outline for better visibility */}
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#ffffff"
              strokeWidth={MAP_CONFIG.ROUTE_STROKE_WIDTH + 2}
            />
            {/* Main route line */}
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={MAP_CONFIG.ROUTE_STROKE_COLOR}
              strokeWidth={MAP_CONFIG.ROUTE_STROKE_WIDTH}
            />
          </>
        )}

        {/* Assigned fire reports markers */}
        {assignedReports.map(report => {
          const latNum = typeof report?.latitude === 'number' ? report.latitude : parseFloat(report?.latitude);
          const lngNum = typeof report?.longitude === 'number' ? report.longitude : parseFloat(report?.longitude);
          
          if (isNaN(latNum) || isNaN(lngNum)) return null;

          const color = getMarkerColor(report);
          const alarmText = toStr(formatAlarm(report));
          const aiText = toStr(formatPrediction(report));
          const locText = toStr(report?.address || report?.geotag_location || 'Not specified', 'Not specified');
          const isAccepted = report.isAccepted || acceptedAssignment?.id === report.id;

          return (
            <Marker
              key={`assigned-${report.id}`}
              coordinate={{ latitude: latNum, longitude: lngNum }}
              title="🔥 Assigned Fire Report"
              description={`${alarmText} - ${locText}`}
              onPress={() => {
                console.log('📍 Fire report marker pressed:', report);
                console.log('🔍 Available fields in selectedReport:', Object.keys(report || {}));
                console.log('📝 Cause fields:', {
                  cause: report?.cause,
                  possible_cause: report?.possible_cause,
                  fire_cause: report?.fire_cause,
                  cause_of_fire: report?.cause_of_fire,
                  fire_cause_description: report?.fire_cause_description,
                  incident_cause: report?.incident_cause
                });
                setSelectedReport(report);
                setShowReportModal(true);
              }}
            >
              <View style={{
                width: MAP_CONFIG.MARKER_SIZE.SMALL,
                height: MAP_CONFIG.MARKER_SIZE.SMALL,
                borderRadius: MAP_CONFIG.MARKER_SIZE.SMALL / 2,
                backgroundColor: color, // Use alarm level/prediction color consistently
                borderWidth: isAccepted ? 4 : 3,
                borderColor: isAccepted ? '#10b981' : '#fff', // Green border for accepted
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                  🔥
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Route Information Panel - Only shown when route is active */}
      {routeInfo && routeInfo.status !== 'calculating' && routeCoordinates.length > 0 && (
        <View style={styles.routeInfoPanel}>
          <View style={styles.routeInfoHeader}>
            <View style={[styles.routeInfoIcon, { 
              backgroundColor: routeInfo.status === 'success' ? '#10b981' : 
                              routeInfo.status === 'fallback' ? '#f59e0b' : '#ef4444'
            }]}>
              <Text style={styles.routeInfoIconText}>
                {routeInfo.status === 'success' ? '🗺️' : 
                 routeInfo.status === 'fallback' ? '📏' : '❌'}
              </Text>
            </View>
            <View style={styles.routeInfoDetails}>
              <Text style={styles.routeInfoTitle}>
                {routeInfo.status === 'success' ? 'Route to Fire Report' : 
                 routeInfo.status === 'fallback' ? 'Estimated Route' : 'Route Error'}
              </Text>
              <View style={styles.routeInfoMetrics}>
                <Text style={styles.routeInfoMetric}>
                  🕒 {routeInfo.duration || 'Unknown'}
                  {routeInfo.durationInTraffic && ` (${routeInfo.durationInTraffic} in traffic)`}
                </Text>
                <Text style={styles.routeInfoMetric}>
                  📍 {routeInfo.distance || 'Unknown'}
                </Text>
              </View>
              {routeInfo.isStraightLine && (
                <Text style={styles.routeInfoWarning}>
                  ⚠️ Straight-line estimate only
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.routeInfoClose}
              onPress={() => {
                setRouteCoordinates([]);
                setRouteInfo(null);
                setAcceptedAssignment(null);
              }}
            >
              <Ionicons name="close" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
          {routeInfo.message && (
            <Text style={[styles.routeInfoMessage, {
              color: routeInfo.status === 'success' ? '#10b981' : 
                     routeInfo.status === 'fallback' ? '#f59e0b' : '#ef4444'
            }]}>
              {routeInfo.message}
            </Text>
          )}
        </View>
      )}

      {/* Location Getting Loading */}
      {isGettingLocation && (
        <View style={styles.routeLoadingOverlay}>
          <View style={styles.routeLoadingContent}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.routeLoadingText}>Getting your location...</Text>
          </View>
        </View>
      )}

      {/* Route Calculation Loading */}
      {isCalculatingRoute && !isGettingLocation && (
        <View style={styles.routeLoadingOverlay}>
          <View style={styles.routeLoadingContent}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.routeLoadingText}>Calculating route...</Text>
          </View>
        </View>
      )}

      {/* Map Control Buttons */}
      <View style={styles.mapControls}>
        {/* Recenter to User Location */}
        {location && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={centerOnUserLocation}
          >
            <Ionicons name="locate" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        
        {/* Center on Station */}
        {stationInfo && ((stationInfo.lat && stationInfo.lng) || (stationInfo.latitude && stationInfo.longitude)) && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#8b5cf6' }]}
            onPress={centerOnStationLocation}
          >
            <Ionicons name="business" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Clear Route */}
        {routeCoordinates.length > 0 && (
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#ef4444' }]}
            onPress={() => {
              setRouteCoordinates([]);
              setRouteInfo(null);
              setAcceptedAssignment(null);
              console.log('🗑️ Route cleared');
            }}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Fire Report Detail Modal */}
      <Modal
        visible={!!showReportModal && !!selectedReport}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header with Close Button */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔥 Assigned Fire Report</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowReportModal(false)}
              >
                <Ionicons name="close" size={20} color="#374151" />
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.modalScroll}>
              
              {/* Reporter */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>Reporter</Text>
                <Text style={styles.modalFieldValue}>
                  {toStr(selectedReport?.reporter_name || selectedReport?.reporter || selectedReport?.reported_by || 'Unknown Reporter')}
                </Text>
              </View>
              
              {/* Cause */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>Cause</Text>
                <Text style={styles.modalFieldValue}>
                  {toStr(selectedReport?.cause || 'Not specified')}
                </Text>
              </View>
              
              {/* Alarm Level with Badge */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>Alarm Level</Text>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>{toStr(formatAlarm(selectedReport))}</Text>
                </View>
              </View>
              
              {/* AI Detection with Badge */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>AI Fire Detection</Text>
                <View style={styles.modalBadge}>
                  <Text style={styles.modalBadgeText}>
                    {toStr(selectedReport?.prediction || 'Unknown')}
                    {selectedReport?.confidence ? ` (${selectedReport.confidence})` : ''}
                  </Text>
                </View>
              </View>
              
              {/* Smoke Analysis */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>Smoke Analysis</Text>
                <Text style={styles.modalFieldValue}>
                  {toStr(selectedReport?.smoke_intensity || '')} {toStr(selectedReport?.smoke_confidence || '')}
                  {!selectedReport?.smoke_intensity && !selectedReport?.smoke_confidence && 'Not analyzed'}
                </Text>
              </View>
              
              {/* Structure */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>Structure</Text>
                <Text style={styles.modalFieldValue}>
                  {toStr(selectedReport?.structure || selectedReport?.structure_type || 'Unknown')}
                  {selectedReport?.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}
                </Text>
              </View>
              
              {/* Structures Affected */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>Structures Affected</Text>
                <Text style={styles.modalFieldValue}>
                  {toStr(selectedReport?.number_of_structures_on_fire || selectedReport?.structures_affected || 'Unknown')}
                  {selectedReport?.number_of_structures_on_fire && !selectedReport?.number_of_structures_on_fire.toString().includes('structure') && ' structure(s)'}
                </Text>
              </View>
              
              {/* Location */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>Location</Text>
                <Text style={styles.modalFieldValue}>
                  {toStr(selectedReport?.address || selectedReport?.geotag_location || selectedReport?.location || 'Not specified')}
                </Text>
              </View>
              
              {/* Reported Time */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>Reported</Text>
                <Text style={styles.modalFieldValue}>
                  {toStr(selectedReport?.formatted_timestamp || selectedReport?.timestamp || 'Unknown')}
                </Text>
              </View>
              
              {/* Status */}
              <View style={styles.modalFieldContainer}>
                <Text style={styles.modalFieldLabel}>Status</Text>
                <Text style={styles.modalFieldValue}>
                  {toStr(selectedReport?.status || 'Active')}
                </Text>
              </View>
              
              {/* Fire Report Image */}
              {selectedReport?.image_url && (
                <View style={styles.modalFieldContainer}>
                  <Text style={styles.modalFieldLabel}>Fire Report Image</Text>
                  <Image
                    source={{ uri: selectedReport.image_url }}
                    style={styles.modalImage}
                    resizeMode="cover"
                    onError={() => {
                      console.log('Error loading image:', selectedReport.image_url);
                    }}
                  />
                </View>
              )}

                        {/* Action buttons */}
                        <View style={styles.actionButtons}>
                          {acceptedAssignment?.id === selectedReport?.id ? (
                            <View style={styles.acceptedButton}>
                              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                              <Text style={styles.acceptedButtonText}>Assignment Accepted</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.acceptButton}
                              onPress={() => {
                                handleAcceptAssignment(selectedReport);
                                setShowReportModal(false);
                              }}
                            >
                              <Ionicons name="checkmark" size={20} color="#fff" />
                              <Text style={styles.acceptButtonText}>Accept Assignment</Text>
                            </TouchableOpacity>
                          )}
                        </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
  },
  modalScroll: {
    padding: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    flex: 1,
  },
  modalCloseButton: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalText: {
    fontSize: 14,
    marginBottom: 8,
    color: '#374151',
  },
  modalFieldContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalFieldValue: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 22,
  },
  modalBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  modalBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  closeButton: {
    backgroundColor: '#dc2626',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mapControls: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    flexDirection: 'column',
    gap: 10,
  },
  controlButton: {
    backgroundColor: '#3b82f6',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  retryButton: {
    backgroundColor: '#ff512f',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionButtons: {
    marginTop: 20,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  acceptedButton: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  acceptedButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  routeLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  routeLoadingContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  routeLoadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  routeInfoPanel: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 100,
  },
  routeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  routeInfoIconText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  routeInfoDetails: {
    flex: 1,
  },
  routeInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  routeInfoMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  routeInfoMetric: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  routeInfoWarning: {
    fontSize: 12,
    color: '#f59e0b',
    fontStyle: 'italic',
    marginTop: 2,
  },
  routeInfoClose: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  routeInfoMessage: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
});
