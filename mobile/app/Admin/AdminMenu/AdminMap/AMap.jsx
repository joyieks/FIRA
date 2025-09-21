import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
  Image
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function AMap({ isSidebarOpen = false }) {
  // Location states
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Map states
  const [mapRegion, setMapRegion] = useState({
    latitude: 10.3157, // BFP Regional Office VII
    longitude: 123.8854,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Fire reports states
  const [fireReports, setFireReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Dashboard states
  const [showDashboard, setShowDashboard] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Drawer gesture is disabled for this screen via exported options below.

  // Admin location - Bureau of Fire Protection Regional Office VII
  const adminLocation = {
    latitude: 10.3157,
    longitude: 123.8854,
    title: 'BFP Regional Office VII',
    description: 'Your Admin Location'
  };

  // Get user's current location
  useEffect(() => {
    (async () => {
      try {
        setLocationLoading(true);
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          return;
        }

        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        
        setLocation(location);
        
        // Update map region to user location
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
        
        console.log('✅ Location detected:', location.coords);
      } catch (error) {
        console.error('❌ Error getting location:', error);
        setErrorMsg('Unable to get your location');
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  // Fetch fire reports
  const fetchFireReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const response = await fetch('https://fire-detection-api-production-f543.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Fetched fire reports for mobile admin dashboard:', data.length);
        
        // Filter reports that have valid coordinates AND are not cancelled or fire out
        const reportsWithCoords = data.filter(report => {
          const hasCoords = report.latitude && report.longitude && !isNaN(parseFloat(report.latitude)) && !isNaN(parseFloat(report.longitude));
          const statusText = (report.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          return hasCoords && !isCancelled && !isFireOut;
        });
        
        console.log('🔥 Reports with valid coordinates (excluding cancelled/fire out):', reportsWithCoords.length);
        
        // Log each report's location for debugging
        reportsWithCoords.forEach(report => {
          console.log(`Mobile Admin Report ${report.id}: ${parseFloat(report.latitude).toFixed(6)}, ${parseFloat(report.longitude).toFixed(6)} - ${report.address || report.geotag_location || 'No address'} - Status: ${report.status || 'Unknown'}`);
        });
        
        setFireReports(reportsWithCoords);
        console.log('✅ Valid fire reports (filtered):', reportsWithCoords.length);
      } else {
        console.error('❌ Failed to fetch fire reports:', response.status);
        Alert.alert('Error', 'Failed to fetch fire reports');
      }
    } catch (error) {
      console.error('❌ Error fetching fire reports:', error);
      Alert.alert('Error', 'Network error while fetching fire reports');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  // Load fire reports on component mount
  useEffect(() => {
    fetchFireReports();
  }, [fetchFireReports]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFireReports();
    setRefreshing(false);
  }, [fetchFireReports]);

  // Get alarm level color
  const getAlarmLevelColor = (alarmLevel) => {
    if (!alarmLevel) return '#6b7280';
    
    const level = alarmLevel.toLowerCase();
    
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

  // Get marker color
  const getMarkerColor = (report) => {
    if (report.recommended_alarm_level || report.alarm_level) {
      return getAlarmLevelColor(report.recommended_alarm_level || report.alarm_level);
    }
    
    switch (report.prediction) {
      case 'Fire': return '#ef4444';
      case 'No Fire': return '#93c5fd';
      default: return '#6b7280';
    }
  };

  // Handle marker press
  const handleMarkerPress = (report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get report status
  const getReportStatus = (report) => {
    // Since we're filtering out cancelled and fire out reports,
    // these shouldn't appear in the mobile admin map
    if (report.prediction === 'Fire') return 'Fire Detected';
    if (report.prediction === 'No Fire') return 'No Fire Detected';
    if (report.recommended_alarm_level || report.alarm_level) {
      return report.recommended_alarm_level || report.alarm_level;
    }
    return 'Under Investigation';
  };

  // Format alarm text similar to web (approximate truck counts)
  const formatAlarm = (report) => {
    const level = report.recommended_alarm_level || report.alarm_level || report.final_fire_alarm_level;
    if (!level) return null;
    const l = (level || '').toLowerCase();
    if (l.includes('fifth')) return 'Fifth Alarm - 20 fire trucks';
    if (l.includes('fourth')) return 'Fourth Alarm - 16 fire trucks';
    if (l.includes('third')) return 'Third Alarm - 12 fire trucks';
    if (l.includes('second')) return 'Second Alarm - 8 fire trucks';
    if (l.includes('first')) return 'First Alarm - 4 fire trucks';
    if (l.includes('task force')) return level.toUpperCase();
    return level;
  };

  const formatPredictionBadge = (report) => {
    const pred = report.prediction;
    const conf = report.confidence;
    if (!pred) return null;
    if (conf) return `${pred} (${conf})`;
    return pred;
  };

  const getSafeImageUri = (uri) => {
    if (!uri || typeof uri !== 'string') return null;
    const trimmed = uri.trim().replace(/\?$/, '');
    if (Platform.OS === 'ios' && trimmed.startsWith('http://')) {
      return trimmed.replace('http://', 'https://');
    }
    return trimmed;
  };

  if (errorMsg) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Location Error</Text>
        <Text style={styles.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents={isSidebarOpen ? 'none' : 'auto'}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Full Screen Map Container */}
      <View 
        style={styles.mapContainer}
      >
        <MapView
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          showsCompass={true}
          showsScale={true}
          loadingEnabled={true}
          loadingIndicatorColor="#dc2626"
          loadingBackgroundColor="#ffffff"
          moveOnMarkerPress={false}
          showsPointsOfInterest={false}
          showsBuildings={false}
          showsTraffic={false}
          showsIndoors={false}
          // REMOVED: Redundant event handlers that were conflicting
        >
        {/* Admin Station Marker */}
        <Marker
          coordinate={adminLocation}
          title={adminLocation.title}
          description={adminLocation.description}
          pinColor="blue"
        >
          <Callout>
            <View style={styles.calloutContainer}>
              <Text style={styles.calloutTitle}>🏢 BFP Regional Office VII</Text>
              <Text style={styles.calloutSubtitle}>Your Admin Location</Text>
              <Text style={styles.calloutText}>Address: 6000 Natalio B. Bacalso Ave</Text>
              <Text style={styles.calloutText}>City: Cebu City, Cebu 6000</Text>
              <Text style={styles.calloutText}>Status: Active</Text>
            </View>
          </Callout>
        </Marker>

        {/* User Location Marker */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Your Location"
            description="Current position"
            pinColor="red"
          />
        )}

        {/* Fire Report Markers */}
        {fireReports.map((report, index) => (
          <Marker
            key={`${report.id}-${index}`}
            coordinate={{
              latitude: parseFloat(report.latitude),
              longitude: parseFloat(report.longitude),
            }}
            title={`Fire Report #${report.id}`}
            description={report.address || report.geotag_location || 'No address'}
            onPress={(e) => {
              e.stopPropagation();
              handleMarkerPress(report);
            }}
            tracksViewChanges={false}
          >
            <TouchableOpacity
              style={[styles.fireMarker, { backgroundColor: getMarkerColor(report) }]}
              onPress={(e) => {
                e.stopPropagation();
                handleMarkerPress(report);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.fireMarkerText}>🔥</Text>
            </TouchableOpacity>
          </Marker>
        ))}
        </MapView>
      </View>

      {/* Dashboard Panel */}
      {showDashboard && (
        <View style={styles.dashboardPanel}>
          <ScrollView 
            style={styles.dashboardContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Header */}
            <View style={styles.dashboardHeader}>
              <Text style={styles.dashboardTitle}>Admin Dashboard</Text>
              <TouchableOpacity 
                onPress={() => setShowDashboard(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Active Reports card */}
            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fecaca', marginRight: 8 }} />
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Active Reports</Text>
                    <Text style={{ color: '#94a3b8' }}>Real-time incidents</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#ef4444' }}>{fireReports.length}</Text>
                  <Text style={{ color: '#94a3b8' }}>incidents</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onRefresh} style={{ marginTop: 12, alignSelf: 'stretch', backgroundColor: '#ef4444', paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '800' }}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* Fire Alarm Levels card */}
            {showLegend && (
              <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Fire Alarm Levels</Text>
                    <Text style={{ color: '#94a3b8' }}>Severity indicators</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {[
                    { label: 'Fire Out', color: '#60a5fa' },
                    { label: 'First Alarm', color: '#fde68a' },
                    { label: 'Second Alarm', color: '#fed7aa' },
                    { label: 'Third Alarm', color: '#fecaca' },
                    { label: 'Fifth+ Alarm', color: '#ef4444' },
                    { label: 'General Alarm', color: '#7f1d1d' },
                  ].map((item) => (
                    <View key={item.label} style={{ width: '48%', backgroundColor: '#f8fafc', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 8 }} />
                      <Text style={{ color: '#0f172a', fontWeight: '600' }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Recent Reports */}
            <View style={styles.reportsContainer}>
              <Text style={styles.reportsTitle}>Active Fire Reports</Text>
              {reportsLoading ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : fireReports.length > 0 ? (
                fireReports.slice(0, 5).map((report, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.reportItem}
                    onPress={() => handleMarkerPress(report)}
                  >
                    <View style={[styles.reportStatus, { backgroundColor: getMarkerColor(report) }]} />
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportId}>Report #{report.id}</Text>
                      <Text style={styles.reportStatusText}>{getReportStatus(report)}</Text>
                      <Text style={styles.reportLocation}>
                        {report.address || report.geotag_location || 'No address'}
                      </Text>
                      <Text style={styles.reportTime}>
                        {formatDate(report.created_at || report.timestamp)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noReportsText}>No active fire reports</Text>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowDashboard(!showDashboard)}
        >
          <MaterialIcons 
            name={showDashboard ? "dashboard" : "dashboard"} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowLegend(!showLegend)}
        >
          <MaterialIcons 
            name={showLegend ? "legend-toggle" : "legend-toggle"} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={onRefresh}
        >
          <MaterialIcons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Report Detail Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedReport && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>🔥 Fire Report</Text>
                  <TouchableOpacity
                    onPress={() => setShowReportModal(false)}
                    style={styles.modalCloseButton}
                  >
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
                  {/* Reporter */}
                  {selectedReport.reporter ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Reporter:</Text>
                      <Text style={styles.modalValue}>{selectedReport.reporter}</Text>
                    </View>
                  ) : null}

                  {/* Cause */}
                  {selectedReport.cause_of_fire ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Cause:</Text>
                      <Text style={styles.modalValue}>{selectedReport.cause_of_fire}</Text>
                    </View>
                  ) : null}

                  {/* Alarm Level */}
                  {formatAlarm(selectedReport) ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Alarm Level:</Text>
                      <View style={styles.badge}><Text style={styles.badgeText}>{formatAlarm(selectedReport)}</Text></View>
                    </View>
                  ) : null}

                  {/* AI Fire Detection */}
                  {selectedReport.prediction ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>AI Fire Detection:</Text>
                      <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
                        <Text style={[styles.badgeText, { color: '#991b1b' }]}>{formatPredictionBadge(selectedReport)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Smoke Analysis */}
                  {selectedReport.smoke_intensity ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Smoke Analysis:</Text>
                      <Text style={styles.modalValue}>{selectedReport.smoke_intensity}{selectedReport.smoke_confidence ? ` ${selectedReport.smoke_confidence}` : ''}</Text>
                    </View>
                  ) : null}

                  {/* Structure Analysis */}
                  {selectedReport.structure ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Structure Analysis:</Text>
                      <Text style={styles.modalValue}>{selectedReport.structure}</Text>
                    </View>
                  ) : null}

                  {/* Estimated Structures Affected */}
                  {selectedReport.number_of_structures_on_fire ? (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Estimated Structures Affected:</Text>
                      <Text style={styles.modalValue}>{selectedReport.number_of_structures_on_fire} structure(s)</Text>
                    </View>
                  ) : null}

                  {/* Location */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Location</Text>
                    <Text style={styles.modalText}>
                      {selectedReport.address || selectedReport.geotag_location || 'No address'}
                    </Text>
                    {selectedReport.latitude && selectedReport.longitude ? (
                      <>
                        <Text style={styles.modalCoordinates}>
                          Lat: {parseFloat(selectedReport.latitude).toFixed(6)}
                        </Text>
                        <Text style={styles.modalCoordinates}>
                          Lng: {parseFloat(selectedReport.longitude).toFixed(6)}
                        </Text>
                      </>
                    ) : null}
                  </View>

                  {/* Reported */}
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Reported:</Text>
                    <Text style={styles.modalValue}>{formatDate(selectedReport.created_at || selectedReport.timestamp)}</Text>
                  </View>

                  {/* Image */}
                  {selectedReport.image_url && (
                    <View style={[styles.modalSection, { marginTop: 8 }]}>
                      <Text style={styles.modalLabel}>Photo:</Text>
                      <Image
                        source={{ uri: selectedReport.image_url }}
                        defaultSource={Platform.OS === 'ios' ? require('../../../../assets/images/burnhouse.jpg') : undefined}
                        style={styles.modalImage}
                        resizeMode="cover"
                        onError={(error) => {
                          console.log('Image load error:', error);
                        }}
                        onLoad={() => {
                          console.log('Image loaded successfully:', selectedReport.image_url);
                        }}
                      />
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Disable drawer swipe/gestures for this screen (expo-router / React Navigation)
export const options = {
  swipeEnabled: false,
  gestureEnabled: false,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width,
    height: height,
    zIndex: 1,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dashboardPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 10,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 12,
    maxHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 8000,
  },
  dashboardContent: {
    padding: 16,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dashboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  legendContainer: {
    marginBottom: 16,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  reportsContainer: {
    marginBottom: 16,
  },
  reportsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  reportStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  reportInfo: {
    flex: 1,
  },
  reportId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  reportStatusText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reportLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reportTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  noReportsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    right: 20,
    alignItems: 'center',
    zIndex: 7000,
    elevation: 7,
  },
  fab: {
    backgroundColor: '#dc2626',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutContainer: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 8,
  },
  calloutText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  fireMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  fireMarkerText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: width * 0.9,
    maxHeight: height * 0.9,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalCoordinates: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
});