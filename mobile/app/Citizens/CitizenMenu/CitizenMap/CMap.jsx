
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Image, Alert, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../config/supabase';
import { createNearbyIncidentNotifications } from '../../../services/citizenNotificationService';
import AcknowledgmentModal from './AcknowledgmentModal';

export default function CMap({ reportIdToFocus, setReportIdToFocus }) {
  const navigation = useNavigation();
  
  // User location
  const [location, setLocation] = useState(null);
  // Loading state
  const [loading, setLoading] = useState(true);
  // Reports data
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [region, setRegion] = useState(null);
  
  // Nearby incidents notification
  const [nearbyIncidents, setNearbyIncidents] = useState([]);
  const [showNearbyNotification, setShowNearbyNotification] = useState(false);
  const [processedNearbyIds, setProcessedNearbyIds] = useState(new Set());
  
  // Acknowledgment modal
  const [showAcknowledgmentModal, setShowAcknowledgmentModal] = useState(false);
  const [acknowledgmentReportLocation, setAcknowledgmentReportLocation] = useState(null);
  const [processedAcknowledgmentIds, setProcessedAcknowledgmentIds] = useState(new Set());
  
  // Edit/Cancel states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelReasonModal, setShowCancelReasonModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [reportToCancel, setReportToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [editData, setEditData] = useState({
    cause: '',
    numberOfStructures: '',
    image: null,
    latitude: null,
    longitude: null,
    address: ''
  });
  
  // API endpoints
  const GET_REPORTS_URL = 'https://fire-detection-api-production-f55b.up.railway.app/get_reports';
  const UPDATE_REPORT_URL = 'https://fire-detection-api-production-f55b.up.railway.app/update_report';
  const UPDATE_STATUS_URL = 'https://fire-detection-api-production-f55b.up.railway.app/update_report_status';

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    getUser();
  }, []);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      setLoading(false);
    })();
  }, []);

  // Fetch reports from API (debounced/guarded)
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const fetchControllerRef = useRef(null);
  useEffect(() => () => { isMountedRef.current = false; fetchControllerRef.current?.abort?.(); }, []);

  const fetchReports = async () => {
    if (isFetchingRef.current) return; // avoid overlapping fetches
    isFetchingRef.current = true;
    fetchControllerRef.current?.abort?.();
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    try {
      const response = await fetch(GET_REPORTS_URL, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        signal: controller.signal,
      });
      if (!response.ok) return;
      const data = await response.json();
      const reportsWithCoords = data.filter(report => {
        const hasCoords = report.latitude && report.longitude && !isNaN(report.latitude) && !isNaN(report.longitude);
        const statusText = (report.status || '').toString().toLowerCase();
        const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
        const isFireOut = statusText.includes('fire out');
        return hasCoords && !isCancelled && !isFireOut;
      });
      if (isMountedRef.current) setReports(reportsWithCoords);
    } catch (error) {
      // swallow fetch errors to avoid UI lock
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Load reports when component mounts and periodically refresh
  useEffect(() => {
    fetchReports();
    
    // Set up periodic refresh (reduced frequency and guarded)
    const refreshInterval = setInterval(() => {
      fetchReports();
    }, 15000); // Refresh every 15 seconds
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Use focus effect to refresh when screen becomes active
  useFocusEffect(
    React.useCallback(() => {
      console.log('Map screen focused - refreshing reports');
      fetchReports();
    }, [])
  );

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Check for nearby incidents
  const checkNearbyIncidents = () => {
    if (!location || !reports.length) {
      setNearbyIncidents([]);
      setShowNearbyNotification(false);
      return;
    }

    const MIN_DISTANCE_KM = 0.5; // 500 meters - not too close (immediate danger zone)
    const MAX_DISTANCE_KM = 5.0; // 5 kilometers - not too far (still relevant)
    
    const nearby = reports
      .map(report => {
        const reportLat = parseFloat(report.latitude);
        const reportLon = parseFloat(report.longitude);
        
        if (isNaN(reportLat) || isNaN(reportLon)) return null;
        
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          reportLat,
          reportLon
        );
        
        // Only include reports within the reasonable range
        if (distance >= MIN_DISTANCE_KM && distance <= MAX_DISTANCE_KM) {
          return {
            ...report,
            distance: distance,
            distanceText: distance < 1 
              ? `${Math.round(distance * 1000)}m away` 
              : `${distance.toFixed(1)}km away`
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance); // Sort by closest first

    setNearbyIncidents(nearby);

    // Show notification if there are new nearby incidents
    if (nearby.length > 0) {
      const newIncidents = nearby.filter(incident => 
        !processedNearbyIds.has(incident.id)
      );
      
      if (newIncidents.length > 0) {
        // Mark new incidents as processed
        setProcessedNearbyIds(prev => {
          const newSet = new Set(prev);
          newIncidents.forEach(incident => newSet.add(incident.id));
          return newSet;
        });
        
        // Create notifications in Supabase for new nearby incidents
        if (currentUser?.id) {
          createNearbyIncidentNotifications(currentUser.id, newIncidents)
            .then(result => {
              if (result.success) {
                console.log(`✅ Created ${result.count} notification(s) for nearby incidents`);
              } else {
                console.warn('⚠️ Some notifications failed to create:', result.errors);
              }
            })
            .catch(error => {
              console.error('❌ Error creating nearby incident notifications:', error);
            });
        }
        
        // Show notification banner
        setShowNearbyNotification(true);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
          setShowNearbyNotification(false);
        }, 10000);
      }
    } else {
      setShowNearbyNotification(false);
    }
  };

  // Check for nearby incidents when location or reports change
  useEffect(() => {
    checkNearbyIncidents();
  }, [location, reports]);


  // Set initial region for the map
  const initialRegion = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 14.5995,
        longitude: 120.9842,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  // Real-time subscription for acknowledgment notifications
  useEffect(() => {
    if (!currentUser?.id) return;

    console.log('🔔 Setting up acknowledgment notification subscription for citizen:', currentUser.id);

    const channel = supabase
      .channel(`citizen-acknowledgment:${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}&user_type=eq.citizen`
      }, async (payload) => {
        const notification = payload.new;
        console.log('📬 New notification received:', notification);

        // Check if this is an acknowledgment notification
        if (notification.title && notification.title.includes('Acknowledged')) {
          // Avoid showing the same notification multiple times
          if (processedAcknowledgmentIds.has(notification.id)) {
            console.log('⚠️ Already processed this acknowledgment notification');
            return;
          }

          setProcessedAcknowledgmentIds(prev => new Set([...prev, notification.id]));

          // Get report location from notification message or fetch report
          let reportLocation = null;
          if (notification.related_report_id) {
            try {
              const response = await fetch(GET_REPORTS_URL);
              if (response.ok) {
                const allReports = await response.json();
                const report = allReports.find(r => String(r.id) === String(notification.related_report_id));
                if (report) {
                  reportLocation = report.address || report.geotag_location || report.location || 'Location not specified';
                }
              }
            } catch (error) {
              console.error('Error fetching report for acknowledgment:', error);
            }
          }

          // Extract location from message if not found
          if (!reportLocation && notification.message) {
            const locationMatch = notification.message.match(/📍 Location: (.+)/);
            if (locationMatch) {
              reportLocation = locationMatch[1].split('\n')[0];
            }
          }

          setAcknowledgmentReportLocation(reportLocation || 'Your reported location');
          setShowAcknowledgmentModal(true);
          console.log('✅ Showing acknowledgment modal');
        }
      })
      .subscribe((status) => {
        console.log('🔔 Acknowledgment subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser?.id]);

  // Focus on a specific report when reportIdToFocus changes
  useEffect(() => {
    if (!reportIdToFocus) return;

    const focusOnReport = async () => {
      // Try to find the report in current reports first
      let reportToFocus = reports.find(r => String(r.id) === String(reportIdToFocus));
      
      // If not found in current reports, try fetching from API directly
      if (!reportToFocus) {
        try {
          console.log('📋 Report not in current list, fetching from API...');
          const response = await fetch(GET_REPORTS_URL);
          if (response.ok) {
            const allReports = await response.json();
            reportToFocus = allReports.find(r => String(r.id) === String(reportIdToFocus));
            
            // If found, add it to reports if it's not cancelled/fire out
            if (reportToFocus) {
              const statusText = (reportToFocus.status || '').toString().toLowerCase();
              const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
              const isFireOut = statusText.includes('fire out');
              
              if (!isCancelled && !isFireOut && reportToFocus.latitude && reportToFocus.longitude) {
                setReports(prev => {
                  const exists = prev.some(r => String(r.id) === String(reportToFocus.id));
                  return exists ? prev : [...prev, reportToFocus];
                });
              }
            }
          }
        } catch (error) {
          console.error('Error fetching report for focus:', error);
        }
      }
      
      if (reportToFocus) {
        const reportLat = parseFloat(reportToFocus.latitude);
        const reportLon = parseFloat(reportToFocus.longitude);
        
        if (!isNaN(reportLat) && !isNaN(reportLon)) {
          console.log('📍 Focusing map on report:', reportIdToFocus, { reportLat, reportLon });
          
          // Center map on the report
          const focusRegion = {
            latitude: reportLat,
            longitude: reportLon,
            latitudeDelta: 0.005, // Zoom in closer
            longitudeDelta: 0.005,
          };
          setRegion(focusRegion);
          
          // Open the report modal
          setSelectedReport(reportToFocus);
          setShowReportModal(true);
          
          // Clear the focus after handling
          if (setReportIdToFocus) {
            setTimeout(() => {
              setReportIdToFocus(null);
            }, 1000);
          }
        } else {
          console.warn('⚠️ Report coordinates invalid:', reportToFocus);
          if (setReportIdToFocus) setReportIdToFocus(null);
        }
      } else {
        console.warn('⚠️ Report not found:', reportIdToFocus);
        if (setReportIdToFocus) setReportIdToFocus(null);
      }
    };

    focusOnReport();
  }, [reportIdToFocus, reports]);


  // Show loading state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading map...</Text>
      </View>
    );
  }


  // Color mapping based on Philippines Bureau of Fire Protection alarm levels
  const getAlarmLevelColor = (alarmLevel) => {
    if (!alarmLevel) return '#6b7280'; // Gray for unknown
    
    const level = alarmLevel.toLowerCase();
    
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
    // First check for alarm level
    if (report.recommended_alarm_level || report.alarm_level) {
      return getAlarmLevelColor(report.recommended_alarm_level || report.alarm_level);
    }
    
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

  // Handle marker press
  const handleMarkerPress = (report) => {
    // Add distance info if this is a nearby incident
    const nearbyIncident = nearbyIncidents.find(incident => incident.id === report.id);
    const reportWithDistance = nearbyIncident 
      ? { ...report, distanceText: nearbyIncident.distanceText, distance: nearbyIncident.distance }
      : report;
    
    setSelectedReport(reportWithDistance);
    setShowReportModal(true);
  };

  // Check if report belongs to current user
  const isUserReport = (report) => {
    return currentUser && 
           (report.reporterId === currentUser.uid || report.user_id === currentUser.uid);
  };

  // Handle edit report
  const handleEditReport = (report) => {
    setEditingReport(report);
    setEditData({
      cause: report.cause_of_fire || report.cause || '',
      numberOfStructures: report.number_of_structures_on_fire?.toString() || '',
      image: null,
      latitude: report.latitude ? parseFloat(report.latitude) : null,
      longitude: report.longitude ? parseFloat(report.longitude) : null,
      address: report.address || report.geotag_location || ''
    });
    setShowEditModal(true);
  };

  // Handle cancel report
  const handleCancelReport = (report) => {
    setReportToCancel(report);
    setCancelReason('');
    setShowCancelReasonModal(true);
  };

  // Cancel report with reason
  const cancelReport = async (reportId) => {
    if (!reportToCancel || !cancelReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation.');
      return;
    }

    try {
      setIsCancelling(true);
      console.log('Cancelling report:', reportId, 'Reason:', cancelReason);
      
      const response = await fetch(UPDATE_STATUS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          report_id: reportId,
          status: 'Cancelled',
          reason: cancelReason,
          cancelled_by: currentUser?.email || currentUser?.uid || 'Citizen User'
        })
      });

      if (response.ok) {
        // Remove cancelled report from local state
        setReports(prev => prev.filter(report => report.id !== reportId));
        
        Alert.alert('Success', 'Report cancelled successfully.');
        setShowCancelReasonModal(false);
        setShowReportModal(false);
        setCancelReason('');
        setReportToCancel(null);
      } else {
        const errorData = await response.text();
        console.error('Failed to cancel report:', response.status, errorData);
        Alert.alert('Error', `Failed to cancel report: ${errorData || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error cancelling report:', error);
      Alert.alert('Error', `Error cancelling report: ${error.message || 'Please try again.'}`);
    } finally {
      setIsCancelling(false);
    }
  };

  // Update report
  const updateReport = async () => {
    if (!editingReport || !editData.cause.trim()) {
      Alert.alert('Error', 'Please provide a cause for the fire');
      return;
    }

    try {
      setIsUpdating(true);
      console.log('Updating report:', editingReport.id, editData);
      
      const updatePayload = {
        cause_of_fire: editData.cause,
        number_of_structures_on_fire: editData.numberOfStructures ? parseInt(editData.numberOfStructures) : null
      };

      const response = await fetch(`${UPDATE_REPORT_URL}/${editingReport.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload)
      });

      if (response.ok) {
        Alert.alert('Success', 'Report updated successfully.');
        setShowEditModal(false);
        setShowReportModal(false);
        // Refresh reports
        fetchReports();
      } else {
        const errorData = await response.text();
        console.error('Failed to update report:', response.status, errorData);
        Alert.alert('Error', `Failed to update report: ${errorData || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error updating report:', error);
      Alert.alert('Error', `Error updating report: ${error.message || 'Please try again.'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <View className="flex-1">
      {/* Map with report markers */}
      <MapView
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        region={region || initialRegion}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        zoomEnabled
        scrollEnabled
        pitchEnabled
        rotateEnabled
      >
        {/* Report markers with fire icons */}
        {reports.map((report) => {
          console.log(`Rendering marker for report ${report.id} at:`, report.latitude, report.longitude, `Address: ${report.address || report.geotag_location}`);
          const isNearby = nearbyIncidents.some(incident => incident.id === report.id);
          
          return (
            <Marker
              key={`${report.id}-${report.latitude}-${report.longitude}-${report.address || report.geotag_location || 'no-address'}`} // Force re-render on location or address change
              coordinate={{
                latitude: parseFloat(report.latitude),
                longitude: parseFloat(report.longitude),
              }}
              onPress={() => handleMarkerPress(report)}
              title={`Report by ${report.reporter}`}
              description={report.cause_of_fire || 'Emergency report'}
            >
              <View className="items-center">
                {/* Nearby indicator ring */}
                {isNearby && (
                  <View 
                    className="absolute w-12 h-12 rounded-full border-4 border-red-500 opacity-50"
                    style={{
                      animation: 'pulse 2s infinite'
                    }}
                  />
                )}
                <View 
                  className={`w-8 h-8 rounded-full items-center justify-center border-2 ${isNearby ? 'border-red-500' : 'border-white'}`}
                  style={{ 
                    backgroundColor: getMarkerColor(report),
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                    zIndex: isNearby ? 10 : 1
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                </View>
                {/* Nearby badge */}
                {isNearby && (
                  <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 items-center justify-center border border-white">
                    <Text className="text-white text-xs" style={{ fontSize: 8 }}>!</Text>
                  </View>
                )}
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Refresh button */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 48,
          right: 16,
          zIndex: 4,
        }}
        className="bg-blue-500 rounded-full p-3 shadow-lg"
        onPress={() => {
          console.log('Manual refresh triggered');
          fetchReports();
        }}
        activeOpacity={0.8}
      >
        <MaterialIcons name="refresh" size={24} color="white" />
      </TouchableOpacity>

      {/* Nearby Incidents Notification Banner */}
      {showNearbyNotification && nearbyIncidents.length > 0 && (
        <View 
          style={{
            position: 'absolute',
            top: 48,
            left: 16,
            right: 16,
            zIndex: 5,
          }}
          className="bg-red-50 border-2 border-red-500 rounded-lg p-3 shadow-lg"
        >
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center flex-1">
              <MaterialIcons name="warning" size={24} color="#ef4444" />
              <Text className="text-red-800 font-bold text-base ml-2">
                {nearbyIncidents.length} Fire Incident{nearbyIncidents.length > 1 ? 's' : ''} Nearby
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowNearbyNotification(false)}
              className="ml-2"
            >
              <MaterialIcons name="close" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
            {nearbyIncidents.slice(0, 3).map((incident) => (
              <TouchableOpacity
                key={incident.id}
                className="bg-white rounded-lg p-2 mr-2 min-w-[200px] border border-red-200"
                onPress={() => {
                  setSelectedReport(incident);
                  setShowReportModal(true);
                  setShowNearbyNotification(false);
                }}
              >
                <Text className="text-red-800 font-semibold text-sm" numberOfLines={1}>
                  {incident.address || incident.geotag_location || 'Fire Incident'}
                </Text>
                <Text className="text-red-600 text-xs mt-1">
                  {incident.distanceText}
                </Text>
                <Text className="text-gray-600 text-xs mt-1" numberOfLines={1}>
                  {incident.recommended_alarm_level || incident.alarm_level || 'Active'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {nearbyIncidents.length > 3 && (
            <Text className="text-red-600 text-xs mt-2 text-center">
              +{nearbyIncidents.length - 3} more incident{nearbyIncidents.length - 3 > 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}

      {/* Reports count indicator with legend toggle */}
      <TouchableOpacity 
        style={{
          position: 'absolute',
          top: showNearbyNotification ? 200 : 48,
          left: 16,
          zIndex: 4,
        }}
        className="bg-white rounded-lg p-3 shadow-lg"
        onPress={() => setShowLegend(!showLegend)}
        activeOpacity={0.8}
      >
        <Text className="text-sm font-semibold text-gray-800">
          📍 {reports.length} Reports
        </Text>
        {nearbyIncidents.length > 0 && (
          <Text className="text-xs text-red-600 font-semibold mt-1">
            ⚠️ {nearbyIncidents.length} Nearby
          </Text>
        )}
        <Text className="text-xs text-gray-500 mt-1">
          Tap for legend
        </Text>
      </TouchableOpacity>

      {/* Color Legend */}
      {showLegend && (
        <View 
          style={{
            position: 'absolute',
            top: showNearbyNotification ? 280 : 128,
            left: 16,
            zIndex: 4,
          }}
          className="bg-white rounded-lg p-3 shadow-lg max-w-xs"
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-semibold text-gray-800">Fire Alarm Levels</Text>
            <TouchableOpacity onPress={() => setShowLegend(false)}>
              <MaterialIcons name="close" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
          
          <View className="space-y-1">
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#93c5fd' }} />
              <Text className="text-xs text-gray-600">Fire Out</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#fef3c7' }} />
              <Text className="text-xs text-gray-600">First Alarm</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#fed7aa' }} />
              <Text className="text-xs text-gray-600">Second Alarm</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#fecaca' }} />
              <Text className="text-xs text-gray-600">Third Alarm</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#ef4444' }} />
              <Text className="text-xs text-gray-600">Fifth+ Alarm</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: '#450a0a' }} />
              <Text className="text-xs text-gray-600">General Alarm</Text>
            </View>
          </View>
        </View>
      )}

      {/* Report Detail Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View className="flex-1 bg-white">
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-800">Report Details</Text>
            <View className="flex-row items-center space-x-2">
              {/* 3-dot menu - only show for user's own reports */}
              {selectedReport && isUserReport(selectedReport) && 
               !['Cancelled', 'Fire Out'].includes(selectedReport.status || selectedReport.progress) && (
                <TouchableOpacity
                  className="p-2"
                  onPress={() => {
                    Alert.alert(
                      'Report Actions',
                      'What would you like to do with this report?',
                      [
                        {
                          text: 'Edit',
                          onPress: () => {
                            setShowReportModal(false);
                            handleEditReport(selectedReport);
                          },
                          style: 'default'
                        },
                        {
                          text: 'Cancel',
                          onPress: () => {
                            setShowReportModal(false);
                            handleCancelReport(selectedReport);
                          },
                          style: 'destructive'
                        },
                        {
                          text: 'Cancel Action',
                          style: 'cancel'
                        }
                      ]
                    );
                  }}
                >
                  <MaterialIcons name="more-vert" size={24} color="#6b7280" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowReportModal(false)}
                className="p-2"
              >
                <MaterialIcons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          {selectedReport && (
            <>
              <ScrollView className="flex-1 p-4">
                {/* Report Image */}
                {selectedReport.image_url && (
                  <Image
                    source={{ uri: selectedReport.image_url }}
                    className="w-full h-48 rounded-lg mb-4"
                    resizeMode="cover"
                  />
                )}

                {/* Report Info */}
                <View className="space-y-4">
                  <View>
                    <Text className="text-gray-600 text-sm">Reporter</Text>
                    <Text className="text-gray-800 font-semibold text-lg">
                      {selectedReport.reporter || 'Unknown Reporter'}
                    </Text>
                  </View>

                  <View>
                    <Text className="text-gray-600 text-sm">Location</Text>
                    <Text className="text-gray-800 font-semibold">
                      {selectedReport.address || selectedReport.geotag_location || 'Location unavailable'}
                    </Text>
                    {selectedReport.address && selectedReport.geotag_location && (
                      <Text className="text-gray-500 text-xs mt-1">
                        Coordinates: {selectedReport.geotag_location}
                      </Text>
                    )}
                    {selectedReport.distanceText && (
                      <View className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                        <View className="flex-row items-center">
                          <MaterialIcons name="location-on" size={16} color="#ef4444" />
                          <Text className="text-red-800 font-semibold text-sm ml-1">
                            {selectedReport.distanceText} from your location
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  <View>
                    <Text className="text-gray-600 text-sm">Status</Text>
                    <View className="flex-row items-center mt-1">
                      <View 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: getMarkerColor(selectedReport) }}
                      />
                      <Text className="text-gray-800 font-semibold">
                        {selectedReport.recommended_alarm_level || selectedReport.alarm_level ||
                         (selectedReport.prediction === 'Fire' ? 'On Going' : 
                          selectedReport.prediction === 'No Fire' ? 'Under Control' : 'Unknown')}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className="text-gray-600 text-sm">Cause of Fire</Text>
                    <Text className="text-gray-800 font-semibold">
                      {selectedReport.cause_of_fire || 'No cause specified'}
                    </Text>
                  </View>

                  {selectedReport.prediction && (
                    <View>
                      <Text className="text-gray-600 text-sm">AI Fire Detection</Text>
                      <Text className="text-gray-800 font-semibold">
                        Prediction: {selectedReport.prediction}{selectedReport.confidence ? ` (${selectedReport.confidence})` : null}
                      </Text>
                    </View>
                  )}

                  {selectedReport.structure && (
                    <View>
                      <Text className="text-gray-600 text-sm">Structure Type</Text>
                      <Text className="text-gray-800 font-semibold">
                        {selectedReport.structure}
                        {selectedReport.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}
                      </Text>
                    </View>
                  )}

                  {(selectedReport.smoke_intensity || selectedReport.smoke_confidence) && (
                    <View>
                      <Text className="text-gray-600 text-sm">Smoke Analysis</Text>
                      <Text className="text-gray-800 font-semibold">
                        {selectedReport.smoke_intensity ? `Intensity: ${selectedReport.smoke_intensity}` : null}
                        {selectedReport.smoke_confidence ? ` ${selectedReport.smoke_confidence}` : null}
                      </Text>
                    </View>
                  )}

                  {selectedReport.number_of_structures_on_fire && (
                    <View>
                      <Text className="text-gray-600 text-sm">Structures Affected</Text>
                      <Text className="text-gray-800 font-semibold">{selectedReport.number_of_structures_on_fire} structure(s)</Text>
                    </View>
                  )}

                  {(selectedReport.alarm_level || selectedReport.recommended_alarm_level) && (
                    <View>
                      <Text className="text-gray-600 text-sm">Emergency Alert Level</Text>
                      <Text className="text-red-800 font-semibold">{selectedReport.alarm_level || selectedReport.recommended_alarm_level}</Text>
                    </View>
                  )}

                  {selectedReport.formatted_timestamp && (
                    <View>
                      <Text className="text-gray-600 text-sm">Reported</Text>
                      <Text className="text-gray-800 font-semibold">{selectedReport.formatted_timestamp}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>


            </>
          )}
        </View>
      </Modal>

      {/* Edit Report Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 bg-white">
              <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
                <Text className="text-xl font-bold text-gray-800">Edit Report</Text>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  className="p-2"
                >
                  <MaterialIcons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                className="flex-1 p-4"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 100 }}
              >
                {/* Cause of Fire Input */}
                <View className="mb-6">
                  <Text className="text-gray-700 font-medium mb-2">Cause of Fire *</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-4 text-gray-800 min-h-[100px]"
                    placeholder="Describe what caused the fire (electrical, cooking, etc.)..."
                    value={editData.cause}
                    onChangeText={(text) => setEditData({...editData, cause: text})}
                    multiline
                    textAlignVertical="top"
                    returnKeyType="done"
                    blurOnSubmit={true}
                  />
                </View>

                {/* Number of Structures Input */}
                <View className="mb-8">
                  <Text className="text-gray-700 font-medium mb-2">Number of Structures Affected (Optional)</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-4 text-gray-800"
                    placeholder="e.g., 1, 2, 3..."
                    value={editData.numberOfStructures}
                    onChangeText={(text) => setEditData({...editData, numberOfStructures: text})}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>

                {/* Action Buttons */}
                <View className="flex-row space-x-3 pt-4 border-t border-gray-200">
                  <TouchableOpacity
                    className="flex-1 bg-gray-300 rounded-lg p-4"
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text className="text-center font-semibold text-gray-700">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 rounded-lg p-4 ${isUpdating ? 'bg-gray-400' : 'bg-blue-600'}`}
                    onPress={updateReport}
                    disabled={!editData.cause.trim() || isUpdating}
                    style={{
                      opacity: (!editData.cause.trim() || isUpdating) ? 0.6 : 1
                    }}
                  >
                    <Text className="text-center font-semibold text-white">
                      {isUpdating ? 'Updating...' : 'Update Report'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cancel Reason Modal */}
      <Modal
        visible={showCancelReasonModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCancelReasonModal(false);
          setCancelReason('');
          setReportToCancel(null);
        }}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white rounded-t-3xl p-6 max-h-[85%]">
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24 }}
                >
                  <Text className="text-xl font-bold text-gray-800 mb-2">Cancel Report</Text>
                  <Text className="text-sm text-gray-600 mb-4">
                    Please provide a reason for cancelling this report. This helps administrators understand why it was cancelled.
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-4 text-gray-800 min-h-[120px]"
                    placeholder="Enter your reason..."
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    multiline
                    textAlignVertical="top"
                    returnKeyType="done"
                    blurOnSubmit={true}
                  />
                  <View className="flex-row space-x-3 mt-4">
                    <TouchableOpacity
                      className="flex-1 bg-gray-300 rounded-lg p-4"
                      onPress={() => {
                        setShowCancelReasonModal(false);
                        setCancelReason('');
                        setReportToCancel(null);
                      }}
                      disabled={isCancelling}
                    >
                      <Text className="text-center font-semibold text-gray-700">Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 rounded-lg p-4 ${cancelReason.trim() && !isCancelling ? 'bg-red-600' : 'bg-gray-300'}`}
                      onPress={() => {
                        if (!cancelReason.trim() || !reportToCancel) return;
                        cancelReport(reportToCancel.id);
                      }}
                      disabled={!cancelReason.trim() || !reportToCancel || isCancelling}
                    >
                      <Text className={`text-center font-semibold ${cancelReason.trim() && !isCancelling ? 'text-white' : 'text-gray-500'}`}>
                        {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Acknowledgment Modal */}
      <AcknowledgmentModal
        visible={showAcknowledgmentModal}
        onClose={() => setShowAcknowledgmentModal(false)}
        reportLocation={acknowledgmentReportLocation}
      />
    </View>
  );
}

// Hide header for this screen
export const options = {
  headerShown: false,
};
