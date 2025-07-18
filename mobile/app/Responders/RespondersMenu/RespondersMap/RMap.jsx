import React from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export default function RMap() {
  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 14.5995, // Manila
          longitude: 120.9842,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        <Marker
          coordinate={{ latitude: 14.5995, longitude: 120.9842 }}
          title="Manila"
          description="Capital of the Philippines"
        />
      </MapView>
    </View>
  );
}
