
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Image, Alert } from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';


export default function CMap() {
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  // Image state
  const [image, setImage] = useState(null);
  // Cause of fire input
  const [cause, setCause] = useState('');
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


  // Pick image from gallery
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert('Gallery permission is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };


  // Take photo using camera
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      alert('Camera permission is required!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };


  // Show upload options
  const handleUploadPicture = () => {
    Alert.alert(
      'Upload a Picture',
      'Choose an option',
      [
        { text: 'Take a Picture', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };


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

      {/* Emergency Button layered on top of the map */}
      <TouchableOpacity
        className="absolute bottom-10 self-center bg-fire px-8 py-4 rounded-full shadow-lg"
        onPress={() => setModalVisible(true)}
      >
        <Text className="text-white font-bold text-lg">Report Emergency</Text>
      </TouchableOpacity>

      {/* Modal for reporting emergency */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-center items-center bg-black/40">
          <View className="bg-white rounded-2xl p-6 w-80 items-center">
            <Text className="text-lg font-bold mb-4">Report Emergency</Text>
            <TouchableOpacity
              className="flex-row items-center justify-center bg-fire px-6 py-2 rounded-xl mb-2"
              onPress={handleUploadPicture}
            >
              <MaterialIcons name="photo-camera" size={22} color="#fff" />
              <Text className="text-white font-semibold ml-2">Upload a Picture</Text>
            </TouchableOpacity>
            {image && (
              <Image
                source={{ uri: image }}
                className="w-48 h-36 rounded-lg my-2"
              />
            )}
            <TextInput
              className="border border-gray-300 rounded-lg w-full min-h-[60px] px-3 py-2 mt-2 text-base bg-gray-50"
              placeholder="Write cause of fire..."
              value={cause}
              onChangeText={setCause}
              multiline
              placeholderTextColor="#bbb"
            />
            <View className="flex-row w-full mt-4">
              <TouchableOpacity
                className="flex-1 bg-fire py-2 px-4 rounded-xl items-center mr-2"
                onPress={() => {
                  // Handle submit here
                  setModalVisible(false);
                  setImage(null);
                  setCause('');
                }}
              >
                <Text className="text-white font-semibold">Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-gray-200 py-2 px-4 rounded-xl items-center ml-2"
                onPress={() => setModalVisible(false)}
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


// Hide header for this screen
export const options = {
  headerShown: false,
};
