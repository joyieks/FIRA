
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Image, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
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
  const [currentUser, setCurrentUser] = useState(null);
  
  // API endpoint
  const GET_REPORTS_URL = 'https://fire-predictor-api-production.up.railway.app/get_reports';

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

  // Fetch reports from API
  const fetchReports = async () => {
    try {
      console.log('Fetching reports from API...');
      const response = await fetch(GET_REPORTS_URL, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched reports for map:', data.length);
        
        // Filter reports that have valid coordinates
        const reportsWithCoords = data.filter(report => 
          report.latitude && report.longitude && 
          !isNaN(report.latitude) && !isNaN(report.longitude)
        );
        
        console.log('Reports with valid coordinates:', reportsWithCoords.length);
        
        // Log each report's location for debugging
        reportsWithCoords.forEach(report => {
          console.log(`Report ${report.id}: ${report.latitude}, ${report.longitude} - ${report.address || report.geotag_location}`);
        });
        
        setReports(reportsWithCoords);
      } else {
        console.error('Failed to fetch reports:', response.status);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  // Load reports when component mounts and periodically refresh
  useEffect(() => {
    fetchReports();
    
    // Set up periodic refresh to catch updates from other screens
    const refreshInterval = setInterval(() => {
      console.log('Periodic refresh triggered');
      fetchReports();
    }, 5000); // Refresh every 5 seconds for faster updates
    
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


  // Get marker color based on report status
  const getMarkerColor = (prediction) => {
    switch (prediction) {
      case 'Fire': return '#ef4444'; // Red for active fire
      case 'No Fire': return '#22c55e'; // Green for no fire
      default: return '#6b7280'; // Gray for unknown
    }
  };

  // Handle marker press
  const handleMarkerPress = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
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
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{ backgroundColor: getMarkerColor(report.prediction) }}
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

      {/* Reports count indicator */}
      <View className="absolute top-12 left-4 bg-white rounded-lg p-3 shadow-lg">
        <Text className="text-sm font-semibold text-gray-800">
          📍 {reports.length} Reports
        </Text>
      </View>

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
            <TouchableOpacity
              onPress={() => setShowReportModal(false)}
              className="p-2"
            >
              <MaterialIcons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {selectedReport && (
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
                      style={{ backgroundColor: getMarkerColor(selectedReport.prediction) }}
                    />
                    <Text className="text-gray-800 font-semibold">
                      {selectedReport.prediction === 'Fire' ? 'On Going' : 
                       selectedReport.prediction === 'No Fire' ? 'Under Control' : 'Unknown'}
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
                    <Text className="text-gray-600 text-sm">AI Prediction</Text>
                    <Text className="text-gray-800 font-semibold">
                      {selectedReport.prediction} ({selectedReport.confidence})
                    </Text>
                  </View>
                )}

                {selectedReport.structure && (
                  <View>
                    <Text className="text-gray-600 text-sm">Structure Type</Text>
                    <Text className="text-gray-800 font-semibold">{selectedReport.structure}</Text>
                  </View>
                )}

                {selectedReport.recommended_alarm_level && (
                  <View>
                    <Text className="text-gray-600 text-sm">Recommended Alarm Level</Text>
                    <Text className="text-red-800 font-semibold">{selectedReport.recommended_alarm_level}</Text>
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
          )}
        </View>
      </Modal>
    </View>
  );
}

// Hide header for this screen
export const options = {
  headerShown: false,
};
