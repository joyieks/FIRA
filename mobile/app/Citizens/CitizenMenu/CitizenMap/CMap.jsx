
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Image, Alert, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../config/supabase';

export default function CMap() {
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
  const GET_REPORTS_URL = 'https://fire-detection-api-production-f8a3.up.railway.app/get_reports';
  const UPDATE_REPORT_URL = 'https://fire-detection-api-production-f8a3.up.railway.app/update_report';
  const UPDATE_STATUS_URL = 'https://fire-detection-api-production-f8a3.up.railway.app/update_report_status';

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
    setSelectedReport(report);
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
        showsUserLocation={true}
        zoomEnabled
        scrollEnabled
        pitchEnabled
        rotateEnabled
      >
        {/* Report markers with fire icons */}
        {reports.map((report) => {
          console.log(`Rendering marker for report ${report.id} at:`, report.latitude, report.longitude, `Address: ${report.address || report.geotag_location}`);
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
                <View 
                  className="w-8 h-8 rounded-full items-center justify-center border-2 border-white"
                  style={{ 
                    backgroundColor: getMarkerColor(report),
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Refresh button */}
      <TouchableOpacity
        className="absolute top-12 right-4 bg-blue-500 rounded-full p-3 shadow-lg"
        onPress={() => {
          console.log('Manual refresh triggered');
          fetchReports();
        }}
        activeOpacity={0.8}
      >
        <MaterialIcons name="refresh" size={24} color="white" />
      </TouchableOpacity>

      {/* Reports count indicator with legend toggle */}
      <TouchableOpacity 
        className="absolute top-12 left-4 bg-white rounded-lg p-3 shadow-lg"
        onPress={() => setShowLegend(!showLegend)}
        activeOpacity={0.8}
      >
        <Text className="text-sm font-semibold text-gray-800">
          📍 {reports.length} Reports
        </Text>
        <Text className="text-xs text-gray-500 mt-1">
          Tap for legend
        </Text>
      </TouchableOpacity>

      {/* Color Legend */}
      {showLegend && (
        <View className="absolute top-32 left-4 bg-white rounded-lg p-3 shadow-lg max-w-xs">
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
    </View>
  );
}

// Hide header for this screen
export const options = {
  headerShown: false,
};
