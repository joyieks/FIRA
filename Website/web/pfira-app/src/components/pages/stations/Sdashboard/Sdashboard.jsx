import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const Sdashboard = () => {
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBX5taF1AgNhicxw5_BXUJDs6ouniAuiQI';
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);

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

  const mapContainerStyle = {
    width: '100vw',
    height: '100vh'
  };

  const center = {
    lat: 14.5995,
    lng: 120.9842
  };

  return (
    <div className="relative">
      <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={userLocation || center}
          zoom={userLocation ? 15 : 12}
        >
          {/* User Location Marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMyNTYzRUIiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+',
                scaledSize: new window.google.maps.Size(24, 24),
                anchor: new window.google.maps.Point(12, 12)
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>
      
      {/* Location Status Display */}
      <div className="absolute top-20 left-4 bg-white bg-opacity-90 p-3 rounded-lg shadow-lg">
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
    </div>
  );
};

export default Sdashboard;