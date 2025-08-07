
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';

export default function CMap() {
  // User location
  const [location, setLocation] = useState(null);
  // Loading state
  const [loading, setLoading] = useState(true);

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


  return (
    <View className="flex-1">
      {/* Google Map always visible and interactive */}
      <MapView
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        showsUserLocation={true}
        zoomEnabled
        scrollEnabled
        pitchEnabled
        rotateEnabled
      />
    </View>
  );
}


// Hide header for this screen
export const options = {
  headerShown: false,
};
