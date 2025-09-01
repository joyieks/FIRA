import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';

const Adashboard = () => {
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBX5taF1AgNhicxw5_BXUJDs6ouniAuiQI';
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [fireReports, setFireReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Get user's current location
  useEffect(() => {
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

  // Fetch fire reports from the API
  const fetchFireReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const response = await fetch('https://fire-predictor-api-production.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Fetched fire reports for admin dashboard:', data.length);
        
        // Filter reports that have valid coordinates
        const reportsWithCoords = data.filter(report => 
          report.latitude && report.longitude && 
          !isNaN(report.latitude) && !isNaN(report.longitude)
        );
        
        console.log('🔥 Reports with valid coordinates:', reportsWithCoords.length);
        
        // Log each report's location for debugging (same as CMap.jsx)
        reportsWithCoords.forEach(report => {
          console.log(`Admin Dashboard Report ${report.id}: ${report.latitude}, ${report.longitude} - ${report.address || report.geotag_location}`);
        });
        
        setFireReports(reportsWithCoords);
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
    
    // Set up periodic refresh to get new reports
    const refreshInterval = setInterval(() => {
      console.log('🔄 Refreshing fire reports...');
      fetchFireReports();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [fetchFireReports]);

  // Get marker color based on prediction/severity
  const getMarkerColor = (prediction) => {
    switch (prediction?.toLowerCase()) {
      case 'fire':
        return '#DC2626'; // Red
      case 'smoke':
        return '#F59E0B'; // Orange
      default:
        return '#EF4444'; // Default red
    }
  };

  const mapContainerStyle = {
    width: '100vw',
    height: '100vh'
  };

  const center = {
    lat: 14.5995,
    lng: 120.9842
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

  return (
    <div className="relative">
      <LoadScript 
        googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        onLoad={() => console.log('✅ Google Maps API loaded')}
        onError={(error) => console.error('❌ Google Maps API error:', error)}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={userLocation || center}
          zoom={userLocation ? 15 : 12}
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
          {/* User Location Marker */}
          {userLocation && mapLoaded && (
            <Marker
              position={userLocation}
              icon={{
                url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMyNTYzRUIiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+',
                scaledSize: new window.google.maps.Size(24, 24),
                anchor: new window.google.maps.Point(12, 12)
              }}
            />
          )}

          {/* Fire Report Markers */}
          {mapLoaded && fireReports.map((report) => {
            console.log(`Rendering admin marker for report ${report.id} at:`, report.latitude, report.longitude);
            return (
              <Marker
                key={`${report.id}-${report.latitude}-${report.longitude}-${report.address || report.geotag_location || 'no-address'}`}
                position={{
                  lat: parseFloat(report.latitude),
                  lng: parseFloat(report.longitude)
                }}
                onClick={() => setSelectedReport(report)}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: '#FF0000',
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3,
                  scale: 20,
                }}
                label={{
                  text: 'F',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
                zIndex={1000}
              />
            );
          })}

          {/* Info Window for Selected Report */}
          {selectedReport && (
            <InfoWindow
              position={{
                lat: parseFloat(selectedReport.latitude),
                lng: parseFloat(selectedReport.longitude)
              }}
              onCloseClick={() => setSelectedReport(null)}
            >
              <div className="p-3 max-w-sm">
                <h3 className="font-bold text-lg mb-2 text-red-600">🔥 Fire Report</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Reporter:</strong> {selectedReport.reporter}</p>
                  <p><strong>Cause:</strong> {selectedReport.cause_of_fire || 'Not specified'}</p>
                  <p><strong>Prediction:</strong> 
                    <span className={`ml-1 px-2 py-1 rounded text-xs font-semibold ${
                      selectedReport.prediction === 'Fire' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {selectedReport.prediction} ({selectedReport.confidence})
                    </span>
                  </p>
                  <p><strong>Structures:</strong> {selectedReport.number_of_structures_on_fire || 'Unknown'}</p>
                  <p><strong>Alarm Level:</strong> {selectedReport.recommended_alarm_level}</p>
                  <p><strong>Location:</strong> {selectedReport.address || selectedReport.geotag_location}</p>
                  <p><strong>Reported:</strong> {selectedReport.formatted_timestamp}</p>
                  {selectedReport.image_url && (
                    <div className="mt-2">
                      <img 
                        src={selectedReport.image_url} 
                        alt="Fire report" 
                        className="w-full h-32 object-cover rounded"
                      />
                    </div>
                  )}
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
      
      {/* Fire Reports Status Panel */}
      <div className="absolute top-4 left-4 bg-white bg-opacity-95 p-4 rounded-lg shadow-lg z-20 min-w-64">
        <div className="text-sm space-y-2">
          <h3 className="font-bold text-red-600 text-lg">🔥 Fire Reports Dashboard</h3>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Active Reports:</span>
            <span className="font-semibold text-red-600">{fireReports.length}</span>
          </div>
          
          {reportsLoading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
              <span className="text-gray-600">Loading reports...</span>
            </div>
          )}
          
          <button 
            onClick={fetchFireReports}
            className="w-full bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            disabled={reportsLoading}
          >
            🔄 Refresh Reports
          </button>
          
          <div className="border-t pt-2 mt-2">
            <p className="font-semibold text-blue-600">📍 Your Location</p>
            {userLocation ? (
              <div className="text-xs text-gray-600">
                <p>Lat: {userLocation.lat.toFixed(6)}</p>
                <p>Lng: {userLocation.lng.toFixed(6)}</p>
              </div>
            ) : locationError ? (
              <p className="text-xs text-red-600">{locationError}</p>
            ) : (
              <p className="text-xs text-yellow-600">Detecting location...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Adashboard;
