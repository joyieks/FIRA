import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../../../config/supabase';

const Sdashboard = () => {
  const { stationData } = useOutletContext();
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBX5taF1AgNhicxw5_BXUJDs6ouniAuiQI'; // Make sure this key has Geocoding API enabled
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [stationLocation, setStationLocation] = useState(null);
  const [geocodingError, setGeocodingError] = useState(null);
  const [fallbackStationData, setFallbackStationData] = useState(null);
  const [showStationInfoWindow, setShowStationInfoWindow] = useState(false);
  const [jurisdictionRadius, setJurisdictionRadius] = useState(2000); // 2km radius in meters

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

  // Debug: Check what's in the station_users table
  useEffect(() => {
    const checkStationTable = async () => {
      try {
        console.log('🔍 Checking station_users table directly from Sdashboard...');
        const { data: allStations, error } = await supabase
          .from('station_users')
          .select('*');
        
        if (error) {
          console.error('❌ Error fetching stations from Sdashboard:', error);
        } else {
          console.log('📊 All stations from Sdashboard:', allStations);
          console.log('📊 Total stations:', allStations.length);
          
          // Look for Talamban specifically
          const talambanStation = allStations.find(station => 
            station.station_name && station.station_name.toLowerCase().includes('talamban')
          );
          console.log('🏢 Talamban station found:', talambanStation);
          
          // If we found Talamban and don't have station data from context, use it as fallback
          if (talambanStation && (!stationData || !stationData.address || stationData.address === 'Loading...')) {
            console.log('🔄 Using fallback station data for Talamban');
            setFallbackStationData(talambanStation);
          }
        }
      } catch (error) {
        console.error('❌ Error in checkStationTable:', error);
      }
    };
    
    checkStationTable();
  }, []);

  // Geocode station address to get coordinates
  useEffect(() => {
    const geocodeStationAddress = async () => {
      // Use fallback data if context data is not available
      const currentStationData = stationData && stationData.address && stationData.address !== 'Loading...' && stationData.address !== 'Address not specified' 
        ? stationData 
        : fallbackStationData;
      
      console.log('🔍 Station data received in Sdashboard:', stationData);
      console.log('🔍 Fallback station data:', fallbackStationData);
      console.log('🔍 Using station data:', currentStationData);
      console.log('🔍 Station address specifically:', currentStationData?.address);
      
      if (!currentStationData?.address || currentStationData.address === 'Loading...' || currentStationData.address === 'Address not specified') {
        console.log('❌ No valid station address to geocode:', currentStationData?.address);
        console.log('❌ Full station data object:', JSON.stringify(currentStationData, null, 2));
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

  const mapContainerStyle = {
    width: '100vw',
    height: '100vh'
  };

  const center = {
    lat: 14.5995,
    lng: 120.9842
  };

  // Determine map center - prioritize station location over user location
  const mapCenter = stationLocation || userLocation || center;

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