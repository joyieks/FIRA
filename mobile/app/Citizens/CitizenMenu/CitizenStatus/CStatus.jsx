import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, RefreshControl, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../../../config/supabase';

// API endpoints - make sure these match your deployed API
const API_URL = 'https://fire-predictor-api-production.up.railway.app/predict';
const GET_REPORTS_URL = 'https://fire-predictor-api-production.up.railway.app/get_reports';
const UPDATE_REPORT_URL = 'https://fire-predictor-api-production.up.railway.app/update_report';
const DELETE_REPORT_URL = 'https://fire-predictor-api-production.up.railway.app/delete_report';

const CStatus = () => {
  const [activeTab, setActiveTab] = useState('Your Reports');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Location picker states
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedLocationAddress, setSelectedLocationAddress] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showLocationInfo, setShowLocationInfo] = useState(false);

  // Reports data
  const [yourReports, setYourReports] = useState([]);
  const [nearbyReports, setNearbyReports] = useState([]);

  // Emergency reporting states
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [emergencyData, setEmergencyData] = useState({
    cause: '',
    image: null,
    numberOfStructures: ''
  });

  // Edit/Delete states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [editData, setEditData] = useState({
    cause: '',
    numberOfStructures: '',
    image: null,
    latitude: null,
    longitude: null,
    address: ''
  });
  const [showEditLocationPicker, setShowEditLocationPicker] = useState(false);
  const [editLocationAddress, setEditLocationAddress] = useState('');
  const [isUpdatingReport, setIsUpdatingReport] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState(false);

  // Animation refs for loading spinners
  const spinValue = useRef(new Animated.Value(0)).current;

  // Start spinning animation
  const startSpinning = () => {
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ).start();
  };

  // Stop spinning animation
  const stopSpinning = () => {
    spinValue.stopAnimation();
  };

  // Create spinning interpolation
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Animated Loading Spinner Component
  const LoadingSpinner = ({ size = 24, color = "#ffffff" }) => (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <MaterialIcons name="refresh" size={size} color={color} />
    </Animated.View>
  );

  // Reverse geocoding function to get address from coordinates
  const getAddressFromCoordinates = async (latitude, longitude) => {
    try {
      setIsGeocodingLoading(true);
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (result && result.length > 0) {
        const address = result[0];
        let addressString = '';
        
        if (address.streetNumber && address.street) {
          addressString += `${address.streetNumber} ${address.street}, `;
        } else if (address.street) {
          addressString += `${address.street}, `;
        }
        
        if (address.district || address.subregion) {
          addressString += `${address.district || address.subregion}, `;
        }
        
        if (address.city) {
          addressString += `${address.city}, `;
        }
        
        if (address.region) {
          addressString += `${address.region}, `;
        }
        
        if (address.country) {
          addressString += address.country;
        }

        addressString = addressString.replace(/,\s*$/, '');
        addressString = addressString.replace(/,\s*,/g, ',');
        
        return addressString || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }
      
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.log('Reverse geocoding error:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } finally {
      setIsGeocodingLoading(false);
    }
  };

  // Supabase Auth state listener
  useEffect(() => {
    let isMounted = true;
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && isMounted) {
        const { data: userData, error } = await supabase
          .from('citizen_users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (userData) {
          setCurrentUser({
            uid: user.id,
            email: user.email,
            ...user.user_metadata,
            ...userData,
          });
        } else {
          setCurrentUser({
            uid: user.id,
            email: user.email,
            ...user.user_metadata,
          });
        }
        setIsLoading(false);
      } else if (isMounted) {
        setCurrentUser(null);
        setIsLoading(false);
      }
    };

    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser({
          uid: session.user.id,
          email: session.user.email,
          ...session.user.user_metadata,
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Load user's current location when component mounts
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setMapLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 15000,
          maximumAge: 60000,
        });
        setUserLocation(location.coords);
      }
    } catch (error) {
      console.log('Error getting current location:', error);
    } finally {
      setMapLoading(false);
    }
  };

  // Load reports when user is available - FIXED TO SYNC WITH API
  useEffect(() => {
    if (currentUser?.uid) {
      console.log('Current user available, loading reports...');
      loadReportsFromApi();
    } else if (currentUser === null) {
      console.log('No user authenticated, clearing reports');
      setYourReports([]);
      setNearbyReports([]);
      setIsLoading(false);
    }
  }, [currentUser?.uid]);

  // UPDATED: Load reports directly from your Flask API
  const loadReportsFromApi = async (retryCount = 0) => {
    if (!currentUser?.uid) {
      console.log('No current user UID, skipping reports load');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('Loading reports for user:', currentUser.uid);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      // Use your Flask API's get_reports endpoint
      const response = await fetch(GET_REPORTS_URL, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      clearTimeout(timeoutId);
      console.log('API Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API Response data received, total reports:', data.length);
        
        const processedReports = data.map((report) => {
          // Get display location - use address if available, fallback to coordinates
          const displayLocation = report.address || 
                                 report.geotag_location || 
                                 (report.latitude && report.longitude ? 
                                   `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}` : 
                                   'Location unavailable');
        
          // Use backend status directly instead of computing it
          let progress = report.status || 'Unknown';
          
          // Format timestamp
          let displayTimestamp = 'Unknown time';
          if (report.formatted_timestamp) {
            displayTimestamp = report.formatted_timestamp;
          } else if (report.created_at) {
            try {
              const date = new Date(report.created_at);
              displayTimestamp = date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
            } catch (e) {
              displayTimestamp = report.created_at;
            }
          }
        
          return {
            id: report.id,
            // Image handling - API returns image_url
            image: report.image_url ? { uri: report.image_url } : null,
            image_url: report.image_url,
            // Location data
            location: displayLocation,
            addressString: report.address || displayLocation,
            geotag_location: report.geotag_location,
            latitude: report.latitude,
            longitude: report.longitude,
            coordinates: (report.latitude && report.longitude) ? {
              latitude: report.latitude,
              longitude: report.longitude
            } : null,
            // Status and progress - NOW USING BACKEND STATUS
            progress: progress,
            status: report.status, // Include raw status field
            prediction: report.prediction,
            confidence: report.confidence,
            // Fire details
            cause: report.cause_of_fire || 'No cause specified',
            cause_of_fire: report.cause_of_fire,
            number_of_structures_on_fire: report.number_of_structures_on_fire,
            alarm_level: report.recommended_alarm_level || report.alarm_level,
            recommended_alarm_level: report.recommended_alarm_level,
            // Structure and smoke analysis
            structure: report.structure,
            smoke_intensity: report.smoke_intensity,
            smoke_confidence: report.smoke_confidence,
            // Reporter info
            reporter: report.reporter || 'Unknown Reporter',
            reporterId: report.reporterId,
            user_name: report.reporter,
            user_id: report.reporterId,
            // Timestamp
            timestamp: displayTimestamp,
            created_at: report.created_at,
            formatted_timestamp: report.formatted_timestamp,
            // Description for modal
            description: report.cause_of_fire ? 
              `Emergency reported: ${report.cause_of_fire}${report.prediction ? `\nPrediction: ${report.prediction}` : ''}${report.confidence ? ` (${report.confidence})` : ''}${report.structure ? `\nStructure: ${report.structure}` : ''}${report.smoke_intensity ? `\nSmoke: ${report.smoke_intensity}` : ''}${report.smoke_confidence ? ` (${report.smoke_confidence})` : ''}${report.alarm_level ? `\nAlarm: ${report.alarm_level}` : ''}${report.status ? `\nStatus: ${report.status}` : ''}` :
              'Emergency report submitted',
          };
        });
        
        // Filter reports by current user's UID - check both reporterId and user_id
        const userReports = processedReports.filter(report => {
          const reporterId = report.reporterId || report.user_id;
          console.log('Checking report:', reporterId, 'against user:', currentUser.uid);
          return reporterId === currentUser.uid;
        });
        
        const otherReports = processedReports.filter(report => {
          const reporterId = report.reporterId || report.user_id;
          return reporterId !== currentUser.uid;
        });
        
        console.log('User reports found:', userReports.length);
        console.log('Other reports found:', otherReports.length);
        
        setYourReports(userReports);
        setNearbyReports(otherReports);
      } else {
        throw new Error(`API returned status: ${response.status}`);
      }
    } catch (error) {
      console.log('Error loading reports:', error);
      
      if (retryCount < 3 && error.name !== 'AbortError') {
        console.log(`Retrying... attempt ${retryCount + 1}`);
        setTimeout(() => {
          loadReportsFromApi(retryCount + 1);
        }, 2000 * (retryCount + 1));
        return;
      } else {
        console.log('Failed to load reports after retries');
        setYourReports([]);
        setNearbyReports([]);
        
        if (error.name === 'AbortError') {
          Alert.alert('Timeout', 'Loading reports is taking too long. Please check your internet connection.');
        } else if (retryCount >= 3) {
          Alert.alert('Network Error', 'Failed to load reports. Please try again later.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

// Also update the getProgressColor function to handle the new status values:
const getProgressColor = (progress) => {
  switch (progress) {
    case 'On Going':
      return '#ef4444';
    case 'Under Control':
      return '#f59e0b';
    case 'Fire Out':
      return '#10b981';
    case 'False Alarm':
      return '#6b7280';
    default:
      return '#6b7280';
  }
};
  const handleReportEmergency = () => {
    if (!currentUser?.uid) {
      Alert.alert('Authentication Error', 'Please log in to report an emergency.');
      return;
    }
    setShowInstructions(true);
    setShowLocationInfo(false);
    setShowLocationPicker(true);
  };

  const handleLocationConfirmed = () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please pin a location on the map');
      return;
    }
    setShowLocationPicker(false);
    setShowEmergencyModal(true);
  };

  const handleMapPress = async (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    setShowLocationInfo(true);
    
    if (showInstructions) {
      setTimeout(() => setShowInstructions(false), 1500);
    }
    
    const address = await getAddressFromCoordinates(latitude, longitude);
    setSelectedLocationAddress(address);
  };

  // Separate map press handler for edit location picker
  const handleEditMapPress = async (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    setShowLocationInfo(true);
    
    if (showInstructions) {
      setTimeout(() => setShowInstructions(false), 1500);
    }
    
    const address = await getAddressFromCoordinates(latitude, longitude);
    setSelectedLocationAddress(address);
  };

  const useCurrentLocation = async () => {
    if (userLocation) {
      setSelectedLocation({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
      setShowLocationInfo(true);
      setShowInstructions(false);
      
      const address = await getAddressFromCoordinates(userLocation.latitude, userLocation.longitude);
      setSelectedLocationAddress(address);
    } else {
      try {
        setMapLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeout: 15000,
            maximumAge: 60000,
          });
          const currentCoords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setSelectedLocation(currentCoords);
          setUserLocation(location.coords);
          setShowLocationInfo(true);
          setShowInstructions(false);
          
          const address = await getAddressFromCoordinates(location.coords.latitude, location.coords.longitude);
          setSelectedLocationAddress(address);
        } else {
          Alert.alert('Permission Denied', 'Location permission is required to use current location');
        }
      } catch (error) {
        Alert.alert('Error', 'Unable to get current location');
      } finally {
        setMapLoading(false);
      }
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const handleImagePicker = () => {
    Alert.alert(
      'Upload Picture',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const hasPermission = await requestCameraPermission();
            if (!hasPermission) {
              Alert.alert('Permission Denied', 'Camera permission is required to take a photo');
              return;
            }
            
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              setEmergencyData({
                ...emergencyData,
                image: result.assets[0].uri
              });
            }
          }
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const hasPermission = await requestMediaLibraryPermission();
            if (!hasPermission) {
              Alert.alert('Permission Denied', 'Gallery permission is required to select a photo');
              return;
            }
            
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              setEmergencyData({
                ...emergencyData,
                image: result.assets[0].uri
              });
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  // UPDATED: Submit emergency to match Flask API expected format
  const submitEmergencyToApi = async () => {
    if (!currentUser?.uid) {
      Alert.alert('Authentication Error', 'Please log in to submit a report.');
      return;
    }

    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location first');
      return;
    }

    try {
      setIsSubmittingReport(true);
      console.log('Starting emergency submission for user:', currentUser.uid);
      
      // Format location as coordinates string (matches Flask API expectation)
      const locationString = `${selectedLocation.latitude}, ${selectedLocation.longitude}`;
      console.log('Using selected location:', locationString);

      const formData = new FormData();
      
      // Image upload (matches Flask API 'image' field)
      formData.append('image', {
        uri: emergencyData.image,
        name: 'emergency_report.jpg',
        type: 'image/jpeg',
      });
      
      // Location data (matches Flask API fields)
      formData.append('geotag_location', locationString);
      
      // Cause of fire (matches Flask API field)
      formData.append('cause_of_fire', emergencyData.cause);
      
      // Number of structures (matches Flask API field)
      if (emergencyData.numberOfStructures && emergencyData.numberOfStructures.trim()) {
        formData.append('number_of_structures_on_fire', emergencyData.numberOfStructures);
      }

      // User identification (matches Flask API fields)
      formData.append('user_id', currentUser.uid);
      const userName = (currentUser.firstName && currentUser.lastName) 
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : (currentUser.first_name && currentUser.last_name)
        ? `${currentUser.first_name} ${currentUser.last_name}`
        : currentUser.email?.split('@')[0] || 'Anonymous User';
      formData.append('user_name', userName);
      
      console.log('Sending user data:', { uid: currentUser.uid, name: userName });
      console.log('Submitting to API:', API_URL);
      
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 30000);
      
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        signal: controller2.signal,
      });

      clearTimeout(timeoutId2);
      const data = await response.json();
      console.log('API response:', data);
      
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit emergency');
      }

      // Create optimistic update with API response data
      const newReport = {
        id: Date.now(), // Temporary ID for optimistic update
        image: data.image_url ? { uri: data.image_url } : { uri: emergencyData.image },
        image_url: data.image_url,
        location: data.address || selectedLocationAddress || locationString,
        addressString: data.address || selectedLocationAddress,
        geotag_location: data.geotag_location || locationString,
        latitude: data.latitude || selectedLocation.latitude,
        longitude: data.longitude || selectedLocation.longitude,
        coordinates: {
          latitude: data.latitude || selectedLocation.latitude,
          longitude: data.longitude || selectedLocation.longitude
        },
        progress: data.prediction === 'Fire' ? 'On Going' : 'Under Control',
        prediction: data.prediction,
        confidence: data.confidence,
        cause: data.cause_of_fire || emergencyData.cause,
        cause_of_fire: data.cause_of_fire || emergencyData.cause,
        number_of_structures_on_fire: data.number_of_structures_on_fire,
        alarm_level: data.alarm_level,
        structure: data.structure,
        smoke_intensity: data.smoke_intensity,
        smoke_confidence: data.smoke_confidence,
        reporter: userName,
        reporterId: currentUser.uid,
        user_name: userName,
        user_id: currentUser.uid,
        timestamp: 'Just now',
        created_at: new Date().toISOString(),
        description: `Emergency reported: ${emergencyData.cause}${data.prediction ? `\nPrediction: ${data.prediction}` : ''}${data.confidence ? ` (${data.confidence})` : ''}${data.structure ? `\nStructure: ${data.structure}` : ''}${data.smoke_intensity ? `\nSmoke: ${data.smoke_intensity}` : ''}${data.smoke_confidence ? ` (${data.smoke_confidence})` : ''}${data.alarm_level ? `\nAlarm: ${data.alarm_level}` : ''}`,
      };

      console.log('Created new report:', newReport);

      // Add to local state immediately for better UX
      setYourReports(prevReports => [newReport, ...prevReports]);

      // Clear form and close modals
      setShowEmergencyModal(false);
      setEmergencyData({ cause: '', image: null, numberOfStructures: '' });
      setSelectedLocation(null);
      setSelectedLocationAddress('');
      setActiveTab('Your Reports');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      
      // Refresh reports from API after a short delay to get the actual saved data
      setTimeout(() => {
        loadReportsFromApi();
      }, 2000);
      
    } catch (err) {
      console.log('Submission error:', err);
      if (err.name === 'AbortError') {
        Alert.alert('Timeout', 'Submission is taking too long. Please check your internet connection.');
      } else {
        Alert.alert('Error', err?.message || 'Something went wrong while submitting the report');
      }
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleSubmitEmergency = () => {
    if (!emergencyData.cause.trim()) {
      Alert.alert('Error', 'Please write the cause of fire');
      return;
    }
    if (!emergencyData.image) {
      Alert.alert('Error', 'Please upload a picture');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location');
      return;
    }

    Alert.alert(
      'Confirm Emergency Report',
      `Are you sure you want to report this emergency at ${selectedLocationAddress}? This will immediately notify emergency services.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'destructive',
          onPress: submitEmergencyToApi
        }
      ]
    );
  };

  const openReportModal = (report) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  // UPDATED: Render report card to handle API data structure
  const renderReportCard = (report) => {
    // Handle image sources - prioritize API response format
    const imageSource = report.image_url ? { uri: report.image_url } :
                       report.image?.uri ? report.image : 
                       typeof report.image === 'string' ? { uri: report.image } :
                       require('../../../../assets/images/burnhouse.jpg');
    
    const displayLocation = report.addressString || report.address || report.location || 'Location unavailable';
    const displayReporter = report.reporter || report.user_name || 'Unknown Reporter';
    const displayTimestamp = report.timestamp || report.formatted_timestamp || 'Unknown time';
    const displayCause = report.cause || report.cause_of_fire || 'No cause specified';
    const displayProgress = report.progress || 'Unknown';

    return (
      <TouchableOpacity
        key={report.id || Math.random()}
        className="bg-white rounded-lg p-4 mb-4 shadow-sm"
        onPress={() => openReportModal(report)}
        activeOpacity={0.7}
      >
        <Image
          source={imageSource}
          className="w-full h-44 rounded-lg mb-3"
          resizeMode="cover"
          onError={() => {
            console.log('Image load error for report:', report.id);
          }}
        />
        
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm text-gray-500">{displayReporter}</Text>
          <Text className="text-sm text-gray-500">{displayTimestamp}</Text>
        </View>

        <Text className="text-gray-800 font-semibold text-base mb-2" numberOfLines={2}>
          {displayLocation}
        </Text>

        <View className="flex-row items-center justify-between mb-2">
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: getProgressColor(displayProgress) + '20' }}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: getProgressColor(displayProgress) }}
            >
              {displayProgress}
            </Text>
          </View>
          {report.confidence && (
            <Text className="text-xs text-gray-500">
              {report.confidence} confidence
            </Text>
          )}
        </View>

        <Text className="text-gray-500 text-xs" numberOfLines={1}>
          Cause: {displayCause}
        </Text>
        
        {/* Edit/Delete buttons for user's own reports */}
        {activeTab === 'Your Reports' && currentUser && 
         (report.reporterId === currentUser.uid || report.user_id === currentUser.uid) && (
          <View className="flex-row justify-end mt-3 space-x-2">
            <TouchableOpacity
              className="bg-blue-500 px-3 py-1 rounded-md"
              onPress={(e) => {
                e.stopPropagation();
                handleEditReport(report);
              }}
            >
              <Text className="text-white text-xs font-medium">Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-red-500 px-3 py-1 rounded-md"
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteReport(report);
              }}
              disabled={isDeletingReport}
              style={{ opacity: isDeletingReport ? 0.6 : 1 }}
            >
              {isDeletingReport ? (
                <View className="flex-row items-center">
                  <LoadingSpinner size={12} color="#ffffff" />
                  <Text className="text-white text-xs font-medium ml-1">Deleting...</Text>
                </View>
              ) : (
                <Text className="text-white text-xs font-medium">Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    let reports = [];
    let title = '';

    switch (activeTab) {
      case 'Your Reports':
        reports = [...yourReports];
        title = 'Your Reports';
        break;
      case 'Nearby Reports':
        reports = [...nearbyReports];
        title = 'Nearby Reports';
        break;
      case 'All':
        reports = [...yourReports, ...nearbyReports];
        title = 'All Reports';
        break;
    }

    // Sort reports from most recent to oldest
    reports.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA; // Descending order (newest first)
    });

    return (
      <View className="flex-1">
        <Text className="text-lg font-semibold text-gray-800 mb-4">
          {title} ({reports.length})
        </Text>
        
        {reports.length === 0 ? (
          <View className="flex-1 justify-center items-center py-12">
            <MaterialIcons name="report" size={64} color="#d1d5db" />
            <Text className="text-gray-500 text-lg font-medium mt-4 text-center">
              {activeTab === 'Your Reports' 
                ? 'No reports yet' 
                : activeTab === 'Nearby Reports' 
                ? 'No nearby reports' 
                : 'No reports available'
              }
            </Text>
            <Text className="text-gray-400 text-sm mt-2 text-center">
              {activeTab === 'Your Reports' 
                ? 'Submit your first emergency report using the button above' 
                : 'Check back later for updates'
              }
            </Text>
          </View>
        ) : (
          reports.map(renderReportCard)
        )}
      </View>
    );
  };

  const handleRefresh = () => {
    if (currentUser?.uid) {
      loadReportsFromApi();
    }
  };

  // Handle edit report
  const handleEditReport = async (report) => {
    setEditingReport(report);
    
    // Get address for current location if available
    let currentAddress = report.address || report.geotag_location || '';
    if (!currentAddress && report.latitude && report.longitude) {
      currentAddress = await getAddressFromCoordinates(report.latitude, report.longitude);
    }
    
    setEditData({
      cause: report.cause_of_fire || report.cause || '',
      numberOfStructures: report.number_of_structures_on_fire?.toString() || '',
      image: null,
      latitude: report.latitude,
      longitude: report.longitude,
      address: currentAddress
    });
    setEditLocationAddress(currentAddress);
    setShowEditModal(true);
  };

  // Handle edit location confirmed
  const handleEditLocationConfirmed = () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please pin a location on the map');
      return;
    }
    setEditData({
      ...editData,
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      address: selectedLocationAddress
    });
    setEditLocationAddress(selectedLocationAddress);
    setShowEditLocationPicker(false);
    setSelectedLocation(null);
    setSelectedLocationAddress('');
    
    // Reopen the edit modal after location is confirmed
    setTimeout(() => {
      setShowEditModal(true);
    }, 100);
  };

  // Handle edit location picker opening
  const handleEditLocationPicker = () => {
    console.log('Edit location picker button pressed');
    console.log('Current editData:', editData);
    console.log('showEditLocationPicker state before:', showEditLocationPicker);
    
    // First close the edit modal to avoid conflicts
    setShowEditModal(false);
    
    // Clear any previous selection state
    setSelectedLocation(null);
    setSelectedLocationAddress('');
    setShowLocationInfo(false);
    setShowInstructions(true);
    
    // Open the edit location picker modal
    setTimeout(() => {
      setShowEditLocationPicker(true);
      console.log('Edit location picker modal opened');
      
      // Set current location as selected if available
      if (editData.latitude && editData.longitude) {
        console.log('Setting existing location:', editData.latitude, editData.longitude);
        setTimeout(() => {
          setSelectedLocation({
            latitude: editData.latitude,
            longitude: editData.longitude
          });
          
          const currentAddress = editData.address || editLocationAddress;
          setSelectedLocationAddress(currentAddress);
          setShowLocationInfo(true);
        }, 300);
      }
    }, 100);
  };

  // Handle delete report
  const handleDeleteReport = (report) => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteReport(report.id)
        }
      ]
    );
  };

  // Delete report API call
  const deleteReport = async (reportId) => {
    try {
      setIsDeletingReport(true);
      startSpinning();
      const response = await fetch(`${DELETE_REPORT_URL}/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Remove from local state
        setYourReports(prev => prev.filter(report => report.id !== reportId));
        Alert.alert('Success', 'Report deleted successfully');
      } else {
        throw new Error('Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      Alert.alert('Error', 'Failed to delete report. Please try again.');
    } finally {
      setIsDeletingReport(false);
      stopSpinning();
    }
  };

  // Handle image picker for edit
  const handleEditImagePicker = () => {
    Alert.alert(
      'Update Image',
      'Choose how you want to update the image',
      [
        {
          text: 'Camera',
          onPress: () => pickEditImage('camera')
        },
        {
          text: 'Gallery',
          onPress: () => pickEditImage('gallery')
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const pickEditImage = async (source) => {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery permission is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setEditData({...editData, image: result.assets[0].uri});
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Update report API call
  const updateReport = async () => {
    if (!editingReport || !editData.cause.trim()) {
      Alert.alert('Error', 'Please provide a cause for the fire');
      return;
    }

    console.log('=== UPDATE REPORT DEBUG ===');
    console.log('editData:', editData);
    console.log('editingReport.id:', editingReport.id);

    try {
      setIsUpdatingReport(true);
      startSpinning();
      // If image was updated, use FormData for multipart upload
      if (editData.image) {
        const formData = new FormData();
        
        // Add new image
        formData.append('image', {
          uri: editData.image,
          name: 'updated_report.jpg',
          type: 'image/jpeg',
        });
        
        // Add other fields
        formData.append('cause_of_fire', editData.cause);
        if (editData.numberOfStructures && editData.numberOfStructures.trim()) {
          formData.append('number_of_structures_on_fire', editData.numberOfStructures);
        }
        
        // Add location data if changed
        if (editData.latitude && editData.longitude) {
          console.log('Adding location data to FormData:', {
            latitude: editData.latitude,
            longitude: editData.longitude,
            address: editData.address
          });
          formData.append('geotag_location', `${editData.latitude}, ${editData.longitude}`);
          formData.append('latitude', editData.latitude.toString());
          formData.append('longitude', editData.longitude.toString());
          if (editData.address) {
            formData.append('address', editData.address);
          }
        }

        const response = await fetch(`${UPDATE_REPORT_URL}/${editingReport.id}`, {
          method: 'PUT',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.ok) {
          const updatedReport = await response.json();
          console.log('Updated report received from API:', updatedReport);
          updateLocalReport(updatedReport);
        } else {
          console.error('Failed to update report with image. Status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          throw new Error('Failed to update report with image');
        }
      } else {
        // No image update, use JSON
        const updatePayload = {
          cause_of_fire: editData.cause,
          number_of_structures_on_fire: editData.numberOfStructures ? parseInt(editData.numberOfStructures) : null
        };
        
        // Add location data if changed
        if (editData.latitude && editData.longitude) {
          console.log('Adding location data to JSON payload:', {
            latitude: editData.latitude,
            longitude: editData.longitude,
            address: editData.address
          });
          updatePayload.geotag_location = `${editData.latitude}, ${editData.longitude}`;
          updatePayload.latitude = parseFloat(editData.latitude);
          updatePayload.longitude = parseFloat(editData.longitude);
          if (editData.address) {
            updatePayload.address = editData.address;
          }
        }

        const response = await fetch(`${UPDATE_REPORT_URL}/${editingReport.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload)
        });

        console.log('Sending JSON payload:', JSON.stringify(updatePayload, null, 2));

        if (response.ok) {
          const updatedReport = await response.json();
          console.log('Updated report received from API (JSON):', updatedReport);
          updateLocalReport(updatedReport);
        } else {
          console.error('Failed to update report (JSON). Status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          throw new Error('Failed to update report');
        }
      }
    } catch (error) {
      console.error('Error updating report:', error);
      Alert.alert('Error', 'Failed to update report. Please try again.');
    } finally {
      setIsUpdatingReport(false);
      stopSpinning();
    }
  };

  // Helper function to update local report state
  const updateLocalReport = (updatedReport) => {
    setYourReports(prev => prev.map(report => 
      report.id === editingReport.id ? {
        ...report,
        cause_of_fire: updatedReport.cause_of_fire,
        cause: updatedReport.cause_of_fire,
        number_of_structures_on_fire: updatedReport.number_of_structures_on_fire,
        alarm_level: updatedReport.recommended_alarm_level || updatedReport.alarm_level,
        recommended_alarm_level: updatedReport.recommended_alarm_level,
        image_url: updatedReport.image_url || report.image_url,
        image: updatedReport.image_url ? { uri: updatedReport.image_url } : report.image,
        // Update location data
        latitude: updatedReport.latitude || editData.latitude || report.latitude,
        longitude: updatedReport.longitude || editData.longitude || report.longitude,
        address: updatedReport.address || editData.address || report.address,
        geotag_location: updatedReport.geotag_location || (editData.latitude && editData.longitude ? `${editData.latitude}, ${editData.longitude}` : report.geotag_location),
        location: updatedReport.address || editData.address || report.location,
        addressString: updatedReport.address || editData.address || report.addressString
      } : report
    ));
    
    setShowEditModal(false);
    setEditingReport(null);
    setEditData({ cause: '', numberOfStructures: '', image: null, latitude: null, longitude: null, address: '' });
    setEditLocationAddress('');
    Alert.alert('Success', 'Report updated successfully');
  };

  // Show loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <MaterialIcons name="refresh" size={48} color="#6b7280" />
        <Text className="text-lg text-gray-600 mt-4">Loading reports...</Text>
        <Text className="text-sm text-gray-500 mt-2">Please wait a moment</Text>
        <TouchableOpacity 
          className="mt-4 bg-red-600 px-6 py-2 rounded-lg"
          onPress={handleRefresh}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show authentication required state
  if (!currentUser) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <MaterialIcons name="account-circle" size={64} color="#d1d5db" />
        <Text className="text-lg text-gray-600 mt-4">Authentication Required</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          Please log in to view and report emergencies
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 pt-8">
        {/* Report Emergency Button */}
        <TouchableOpacity
          className="bg-red-600 rounded-lg p-4 mb-6 items-center shadow-sm"
          onPress={handleReportEmergency}
          activeOpacity={0.8}
        >
          <MaterialIcons name="emergency" size={24} color="#ffffff" />
          <Text className="text-white font-semibold text-base mt-2">Report Emergency</Text>
        </TouchableOpacity>

        {/* Tab Buttons */}
        <View className="flex-row mb-4 bg-white rounded-lg p-1 shadow-sm">
          <TouchableOpacity
            className={`flex-1 py-3 px-4 rounded-lg ${activeTab === 'Your Reports' ? 'bg-[#ff512f]' : 'bg-transparent'}`}
            onPress={() => setActiveTab('Your Reports')}
          >
            <Text className={`text-center font-semibold ${activeTab === 'Your Reports' ? 'text-white' : 'text-gray-600'}`}>
              Your Reports ({yourReports.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 px-4 rounded-lg ${activeTab === 'Nearby Reports' ? 'bg-[#ff512f]' : 'bg-transparent'}`}
            onPress={() => setActiveTab('Nearby Reports')}
          >
            <Text className={`text-center font-semibold ${activeTab === 'Nearby Reports' ? 'text-white' : 'text-gray-600'}`}>
              Nearby ({nearbyReports.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 px-4 rounded-lg ${activeTab === 'All' ? 'bg-[#ff512f]' : 'bg-transparent'}`}
            onPress={() => setActiveTab('All')}
          >
            <Text className={`text-center font-semibold ${activeTab === 'All' ? 'text-white' : 'text-gray-600'}`}>
              All ({yourReports.length + nearbyReports.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reports Content */}
      <View className="flex-1 px-4">
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <View className="py-4">
              <TouchableOpacity 
                className="bg-gray-200 rounded-full py-2 px-4 self-center"
                onPress={handleRefresh}
              >
                <Text className="text-gray-700 text-sm">Pull to refresh</Text>
              </TouchableOpacity>
            </View>
          }
        >
          {renderTabContent()}
        </ScrollView>
      </View>

      {/* Enhanced Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        transparent={false}
      >
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="bg-red-600 pt-12 pb-4 px-4">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => {
                  setShowLocationPicker(false);
                  setSelectedLocation(null);
                  setSelectedLocationAddress('');
                }}
                className="p-2"
              >
                <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-semibold">Pin Fire Location</Text>
              <TouchableOpacity
                onPress={useCurrentLocation}
                className="p-2 rounded-full bg-white bg-opacity-20"
              >
                <MaterialIcons name="my-location" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Map */}
          <View className="flex-1">
            {mapLoading ? (
              <View className="flex-1 justify-center items-center">
                <MaterialIcons name="refresh" size={48} color="#6b7280" />
                <Text className="text-lg text-gray-600 mt-4">Loading map...</Text>
              </View>
            ) : (
              <MapView
                style={{ flex: 1 }}
                initialRegion={userLocation ? {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                } : {
                  latitude: 7.0731, // Davao City default
                  longitude: 125.6128,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                onPress={handleMapPress}
                showsUserLocation={true}
                showsMyLocationButton={false}
                showsBuildings={true}
                showsTraffic={false}
                showsIndoors={true}
                zoomEnabled
                scrollEnabled
                pitchEnabled
                rotateEnabled
                mapType="standard"
                toolbarEnabled={false}
              >
                {selectedLocation && (
                  <Marker
                    coordinate={selectedLocation}
                    title="Fire Emergency Location"
                    description={selectedLocationAddress || "Tap to confirm this location"}
                    pinColor="red"
                  >
                    <View className="items-center">
                      <View className="bg-red-600 rounded-full p-2">
                        <MaterialIcons name="local-fire-department" size={20} color="#ffffff" />
                      </View>
                      <View className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-red-600 -mt-1" />
                    </View>
                  </Marker>
                )}
                
                {userLocation && (
                  <Marker
                    coordinate={{
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude,
                    }}
                    title="Your Location"
                    description="Your current position"
                  >
                    <View className="items-center">
                      <View className="bg-blue-500 rounded-full p-2 border-2 border-white">
                        <MaterialIcons name="person-pin" size={16} color="#ffffff" />
                      </View>
                    </View>
                  </Marker>
                )}
              </MapView>
            )}

            {/* Instructions */}
            {showInstructions && (
              <View className="absolute top-4 left-4 right-4 bg-white rounded-lg p-3 shadow-lg border border-gray-100">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <MaterialIcons name="place" size={16} color="#ef4444" />
                    <Text className="text-gray-800 font-medium ml-2 text-sm">Tap to pin location</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowInstructions(false)}
                    className="p-1"
                  >
                    <MaterialIcons name="close" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Current Location Button */}
            <TouchableOpacity
              className="absolute top-20 right-4 bg-blue-500 rounded-full p-3 shadow-lg border-2 border-white"
              onPress={useCurrentLocation}
              disabled={mapLoading}
            >
              <MaterialIcons name="my-location" size={20} color="#ffffff" />
            </TouchableOpacity>

            {/* Map accuracy indicator */}
            <View className="absolute top-20 left-4 bg-white rounded-lg px-3 py-2 shadow-lg">
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <Text className="text-xs text-gray-600">GPS Accurate</Text>
              </View>
            </View>
          </View>

          {/* Bottom Location Info */}
          {selectedLocation && (
            <View className="absolute bottom-16 left-0 right-0">
              <TouchableOpacity
                onPress={() => setShowLocationInfo(!showLocationInfo)}
                className="mx-4 bg-white rounded-t-lg px-4 py-2 shadow-lg border border-gray-200"
                activeOpacity={0.8}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <MaterialIcons name="location-on" size={16} color="#ef4444" />
                    <Text className="text-gray-800 font-medium text-sm ml-1">Selected Location</Text>
                  </View>
                  <MaterialIcons 
                    name={showLocationInfo ? "expand-less" : "expand-more"} 
                    size={20} 
                    color="#6b7280" 
                  />
                </View>
              </TouchableOpacity>
              
              {showLocationInfo && (
                <View className="mx-4 bg-white rounded-b-lg px-4 py-3 shadow-lg border-l border-r border-b border-gray-200">
                  {selectedLocationAddress && !isGeocodingLoading ? (
                    <View>
                      <Text className="text-gray-800 font-semibold text-sm mb-1">
                        {selectedLocationAddress}
                      </Text>
                      <Text className="text-gray-500 text-xs">
                        {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                      </Text>
                    </View>
                  ) : isGeocodingLoading ? (
                    <View className="flex-row items-center">
                      <MaterialIcons name="refresh" size={14} color="#6b7280" />
                      <Text className="text-gray-500 text-xs ml-1">Getting address...</Text>
                    </View>
                  ) : (
                    <Text className="text-gray-800 font-medium text-sm">
                      {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Bottom Action Bar */}
          <View className="bg-white border-t border-gray-200 p-4">
            {selectedLocation && selectedLocationAddress && (
              <View className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <View className="flex-row items-center mb-1">
                  <MaterialIcons name="check-circle" size={16} color="#10b981" />
                  <Text className="text-green-700 font-medium text-sm ml-1">Location Selected</Text>
                </View>
                <Text className="text-green-600 text-xs">{selectedLocationAddress}</Text>
              </View>
            )}
            
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 bg-gray-300 rounded-lg p-4"
                onPress={() => {
                  setShowLocationPicker(false);
                  setSelectedLocation(null);
                  setSelectedLocationAddress('');
                }}
              >
                <Text className="text-center font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-lg p-4 ${selectedLocation ? 'bg-red-600' : 'bg-gray-300'}`}
                onPress={handleLocationConfirmed}
                disabled={!selectedLocation}
              >
                <Text className={`text-center font-semibold ${selectedLocation ? 'text-white' : 'text-gray-500'}`}>
                  {selectedLocation ? 'Confirm Location' : 'Select Location'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Location Picker Modal */}
      <Modal
        visible={showEditLocationPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowEditLocationPicker(false);
          setSelectedLocation(null);
          setSelectedLocationAddress('');
        }}
      >
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="bg-blue-600 pt-12 pb-4 px-4">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => {
                  setShowEditLocationPicker(false);
                  setSelectedLocation(null);
                  setSelectedLocationAddress('');
                }}
                className="p-2"
              >
                <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text className="text-white text-lg font-semibold">Edit Fire Location</Text>
              <TouchableOpacity
                onPress={useCurrentLocation}
                className="p-2 rounded-full bg-white bg-opacity-20"
              >
                <MaterialIcons name="my-location" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Map */}
          <View className="flex-1">
            {mapLoading ? (
              <View className="flex-1 justify-center items-center">
                <MaterialIcons name="refresh" size={48} color="#6b7280" />
                <Text className="text-lg text-gray-600 mt-4">Loading map...</Text>
              </View>
            ) : (
              <MapView
                style={{ flex: 1 }}
                initialRegion={selectedLocation ? {
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                } : userLocation ? {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                } : {
                  latitude: 7.0731, // Davao City default
                  longitude: 125.6128,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                onPress={handleEditMapPress}
                showsUserLocation={true}
                showsMyLocationButton={false}
                showsBuildings={true}
                showsTraffic={false}
                showsIndoors={true}
                zoomEnabled
                scrollEnabled
                pitchEnabled
                rotateEnabled
                mapType="standard"
                toolbarEnabled={false}
              >
                {selectedLocation && (
                  <Marker
                    coordinate={selectedLocation}
                    title="Updated Fire Location"
                    description={selectedLocationAddress || "Tap to confirm this location"}
                    pinColor="blue"
                  >
                    <View className="items-center">
                      <View className="bg-blue-600 rounded-full p-2">
                        <MaterialIcons name="edit-location" size={20} color="#ffffff" />
                      </View>
                      <View className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-blue-600 -mt-1" />
                    </View>
                  </Marker>
                )}
                
                {userLocation && (
                  <Marker
                    coordinate={{
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude,
                    }}
                    title="Your Location"
                    description="Your current position"
                  >
                    <View className="items-center">
                      <View className="bg-green-500 rounded-full p-2 border-2 border-white">
                        <MaterialIcons name="person-pin" size={16} color="#ffffff" />
                      </View>
                    </View>
                  </Marker>
                )}
              </MapView>
            )}

            {/* Instructions */}
            {showInstructions && (
              <View className="absolute top-4 left-4 right-4 bg-white rounded-lg p-3 shadow-lg border border-gray-100">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <MaterialIcons name="edit-location" size={16} color="#3b82f6" />
                    <Text className="text-gray-800 font-medium ml-2 text-sm">Tap to update location</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowInstructions(false)}
                    className="p-1"
                  >
                    <MaterialIcons name="close" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Current Location Button */}
            <TouchableOpacity
              className="absolute top-20 right-4 bg-blue-500 rounded-full p-3 shadow-lg border-2 border-white"
              onPress={useCurrentLocation}
              disabled={mapLoading}
            >
              <MaterialIcons name="my-location" size={20} color="#ffffff" />
            </TouchableOpacity>

            {/* Map accuracy indicator */}
            <View className="absolute top-20 left-4 bg-white rounded-lg px-3 py-2 shadow-lg">
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <Text className="text-xs text-gray-600">GPS Accurate</Text>
              </View>
            </View>
          </View>

          {/* Bottom Location Info */}
          {selectedLocation && (
            <View className="absolute bottom-16 left-0 right-0">
              <TouchableOpacity
                onPress={() => setShowLocationInfo(!showLocationInfo)}
                className="mx-4 bg-white rounded-t-lg px-4 py-2 shadow-lg border border-gray-200"
                activeOpacity={0.8}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <MaterialIcons name="location-on" size={16} color="#3b82f6" />
                    <Text className="text-gray-800 font-medium text-sm ml-1">Updated Location</Text>
                  </View>
                  <MaterialIcons 
                    name={showLocationInfo ? "expand-less" : "expand-more"} 
                    size={20} 
                    color="#6b7280" 
                  />
                </View>
              </TouchableOpacity>
              
              {showLocationInfo && (
                <View className="mx-4 bg-white rounded-b-lg px-4 py-3 shadow-lg border-l border-r border-b border-gray-200">
                  {selectedLocationAddress && !isGeocodingLoading ? (
                    <View>
                      <Text className="text-gray-800 font-semibold text-sm mb-1">
                        {selectedLocationAddress}
                      </Text>
                      <Text className="text-gray-500 text-xs">
                        {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                      </Text>
                    </View>
                  ) : isGeocodingLoading ? (
                    <View className="flex-row items-center">
                      <MaterialIcons name="refresh" size={14} color="#6b7280" />
                      <Text className="text-gray-500 text-xs ml-1">Getting address...</Text>
                    </View>
                  ) : (
                    <Text className="text-gray-800 font-medium text-sm">
                      {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Bottom Action Bar */}
          <View className="bg-white border-t border-gray-200 p-4">
            {selectedLocation && selectedLocationAddress && (
              <View className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <View className="flex-row items-center mb-1">
                  <MaterialIcons name="check-circle" size={16} color="#3b82f6" />
                  <Text className="text-blue-700 font-medium text-sm ml-1">Location Updated</Text>
                </View>
                <Text className="text-blue-600 text-xs">{selectedLocationAddress}</Text>
              </View>
            )}
            
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 bg-gray-300 rounded-lg p-4"
                onPress={() => {
                  setShowEditLocationPicker(false);
                  setSelectedLocation(null);
                  setSelectedLocationAddress('');
                }}
              >
                <Text className="text-center font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-lg p-4 ${selectedLocation ? 'bg-blue-600' : 'bg-gray-300'}`}
                onPress={handleEditLocationConfirmed}
                disabled={!selectedLocation}
              >
                <Text className={`text-center font-semibold ${selectedLocation ? 'text-white' : 'text-gray-500'}`}>
                  {selectedLocation ? 'Confirm Location' : 'Select Location'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Emergency Reporting Modal */}
      <Modal
        visible={showEmergencyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowEmergencyModal(false);
          setSelectedLocation(null);
          setSelectedLocationAddress('');
        }}
      >
        <KeyboardAvoidingView 
          className="flex-1" 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  <View className="items-center mb-6">
                    <View className="w-12 h-1 bg-gray-300 rounded-full mb-4" />
                    <Text className="text-xl font-bold text-gray-800">Report Emergency</Text>
                    {selectedLocation && (
                      <View className="mt-3 bg-red-50 rounded-lg p-3 w-full border border-red-200">
                        <View className="flex-row items-center mb-2">
                          <MaterialIcons name="location-on" size={16} color="#ef4444" />
                          <Text className="text-red-700 text-xs font-medium ml-1">EMERGENCY LOCATION</Text>
                        </View>
                        
                        {selectedLocationAddress ? (
                          <View>
                            <Text className="text-red-800 font-semibold text-sm mb-1">
                              {selectedLocationAddress}
                            </Text>
                            <Text className="text-red-600 text-xs">
                              {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                            </Text>
                          </View>
                        ) : (
                          <Text className="text-red-800 text-sm font-medium">
                            {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Upload Picture Button */}
                  <TouchableOpacity
                    className="bg-red-600 rounded-lg p-4 mb-6 items-center shadow-sm"
                    onPress={handleImagePicker}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="camera-alt" size={24} color="#ffffff" />
                    <Text className="text-white font-semibold text-base mt-2">
                      {emergencyData.image ? 'Change Picture' : 'Upload a Picture'}
                    </Text>
                  </TouchableOpacity>

                  {/* Show Selected Image */}
                  {emergencyData.image && (
                    <View className="mb-6">
                      <Image
                        source={{ uri: emergencyData.image }}
                        className="w-full h-40 rounded-lg"
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        className="absolute top-2 right-2 bg-red-600 rounded-full p-1"
                        onPress={() => setEmergencyData({...emergencyData, image: null})}
                      >
                        <MaterialIcons name="close" size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Cause of Fire Input */}
                  <View className="mb-6">
                    <Text className="text-gray-700 font-medium mb-2">Cause of Fire *</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-4 text-gray-800 min-h-[100px]"
                      placeholder="Describe what caused the fire (electrical, cooking, etc.)..."
                      value={emergencyData.cause}
                      onChangeText={(text) => setEmergencyData({...emergencyData, cause: text})}
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
                      value={emergencyData.numberOfStructures}
                      onChangeText={(text) => setEmergencyData({...emergencyData, numberOfStructures: text})}
                      keyboardType="numeric"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row space-x-3 pt-4 border-t border-gray-200">
                    <TouchableOpacity
                      className="flex-1 bg-gray-300 rounded-lg p-4"
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowEmergencyModal(false);
                        setSelectedLocation(null);
                        setSelectedLocationAddress('');
                      }}
                      disabled={isSubmittingReport}
                    >
                      <Text className="text-center font-semibold text-gray-700">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 bg-red-600 rounded-lg p-4"
                      onPress={() => {
                        Keyboard.dismiss();
                        handleSubmitEmergency();
                      }}
                      disabled={!emergencyData.cause.trim() || isSubmittingReport}
                      style={{
                        opacity: (!emergencyData.cause.trim() || isSubmittingReport) ? 0.6 : 1
                      }}
                    >
                      {isSubmittingReport ? (
                        <View className="flex-row items-center justify-center">
                          <MaterialIcons name="refresh" size={20} color="#ffffff" />
                          <Text className="text-center font-semibold text-white ml-2">Submitting...</Text>
                        </View>
                      ) : (
                        <Text className="text-center font-semibold text-white">Submit Report</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
              
              {/* Loading Overlay */}
              {isSubmittingReport && (
                <View className="absolute inset-0 bg-black/50 justify-center items-center">
                  <View className="bg-white rounded-lg p-6 items-center">
                    <MaterialIcons name="refresh" size={48} color="#ef4444" />
                    <Text className="text-lg font-semibold text-gray-800 mt-4">Submitting Report</Text>
                    <Text className="text-sm text-gray-600 mt-2 text-center">
                      Please wait while we process your emergency report...
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
                {/* Current Image Display */}
                <View className="mb-6">
                  <Text className="text-gray-700 font-medium mb-2">Current Image</Text>
                  <View className="relative">
                    <Image
                      source={editData.image ? { uri: editData.image } : 
                             (editingReport?.image_url ? { uri: editingReport.image_url } : 
                              require('../../../../assets/images/burnhouse.jpg'))}
                      className="w-full h-40 rounded-lg"
                      resizeMode="cover"
                    />
                    {editData.image && (
                      <TouchableOpacity
                        className="absolute top-2 right-2 bg-red-600 rounded-full p-1"
                        onPress={() => setEditData({...editData, image: null})}
                      >
                        <MaterialIcons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {/* Update Image Button */}
                  <TouchableOpacity
                    className="bg-blue-600 rounded-lg p-3 mt-3 items-center"
                    onPress={handleEditImagePicker}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="camera-alt" size={20} color="white" />
                    <Text className="text-white font-semibold text-sm mt-1">
                      {editData.image ? 'Change Image' : 'Update Image'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Cause of Fire Input */}
                <View className="mb-6">
                  <Text className="text-gray-700 font-medium mb-2">Cause of Fire *</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-4 text-gray-800 min-h-[100px]"
                    placeholder="Describe what caused the fire..."
                    value={editData.cause}
                    onChangeText={(text) => setEditData({...editData, cause: text})}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Number of Structures Input */}
                <View className="mb-6">
                  <Text className="text-gray-700 font-medium mb-2">Number of Structures Affected (Optional)</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-4 text-gray-800"
                    placeholder="e.g., 1, 2, 3..."
                    value={editData.numberOfStructures}
                    onChangeText={(text) => setEditData({...editData, numberOfStructures: text})}
                    keyboardType="numeric"
                  />
                </View>

                {/* Location Section */}
                <View className="mb-8">
                  <Text className="text-gray-700 font-medium mb-2">Location</Text>
                  <View className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    {editLocationAddress || editData.address ? (
                      <View>
                        <Text className="text-gray-800 font-semibold text-sm mb-1">
                          {editLocationAddress || editData.address}
                        </Text>
                        {editData.latitude && editData.longitude && (
                          <Text className="text-gray-500 text-xs">
                            {editData.latitude.toFixed(6)}, {editData.longitude.toFixed(6)}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text className="text-gray-500 text-sm">No location set</Text>
                    )}
                  </View>
                  
                  {/* Edit Location Button */}
                  <TouchableOpacity
                    className="bg-green-600 rounded-lg p-3 mt-3 items-center"
                    onPress={() => {
                      console.log('Location button pressed - opening edit location picker');
                      handleEditLocationPicker();
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="edit-location" size={20} color="white" />
                    <Text className="text-white font-semibold text-sm mt-1">
                      {editData.latitude && editData.longitude ? 'Change Location' : 'Set Location'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Action Buttons */}
                <View className="flex-row space-x-3">
                  <TouchableOpacity
                    className="flex-1 bg-gray-300 rounded-lg p-4"
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text className="text-center font-semibold text-gray-700">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-blue-600 rounded-lg p-4"
                    onPress={updateReport}
                    disabled={!editData.cause.trim() || isUpdatingReport}
                    style={{ opacity: (!editData.cause.trim() || isUpdatingReport) ? 0.6 : 1 }}
                  >
                    {isUpdatingReport ? (
                      <View className="flex-row items-center justify-center">
                        <LoadingSpinner size={20} color="#ffffff" />
                        <Text className="text-center font-semibold text-white ml-2">Updating...</Text>
                      </View>
                    ) : (
                      <Text className="text-center font-semibold text-white">Update Report</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
              
              {/* Loading Overlay for Edit Modal */}
              {isUpdatingReport && (
                <View className="absolute inset-0 bg-black/50 justify-center items-center">
                  <View className="bg-white rounded-lg p-6 items-center">
                    <LoadingSpinner size={48} color="#3b82f6" />
                    <Text className="text-lg font-semibold text-gray-800 mt-4">Updating Report</Text>
                    <Text className="text-sm text-gray-600 mt-2 text-center">
                      Please wait while we update your report...
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* UPDATED: Enhanced Report Detail Modal to show API data */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg p-6 w-11/12 max-h-[80%]">
            {selectedReport && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-xl font-bold text-gray-800">Report Details</Text>
                  <TouchableOpacity
                    onPress={() => setShowModal(false)}
                    className="p-2 rounded-full bg-gray-100"
                  >
                    <MaterialIcons name="close" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <Image
                  source={(() => {
                    if (selectedReport.image_url) return { uri: selectedReport.image_url };
                    if (selectedReport.image?.uri) return selectedReport.image;
                    if (typeof selectedReport.image === 'string') return { uri: selectedReport.image };
                    return require('../../../../assets/images/burnhouse.jpg');
                  })()}
                  className="w-full h-56 rounded-lg mb-4"
                  resizeMode="cover"
                />

                <View className="mb-3">
                  <Text className="text-gray-600 text-sm">Reporter</Text>
                  <Text className="text-gray-800 font-semibold">
                    {selectedReport.reporter || selectedReport.user_name || 'Unknown Reporter'}
                  </Text>
                </View>

                <View className="mb-3">
                  <Text className="text-gray-600 text-sm">Location</Text>
                  <View className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    {selectedReport.address || selectedReport.addressString ? (
                      <View>
                        <Text className="text-gray-800 font-semibold text-sm mb-1">
                          {selectedReport.address || selectedReport.addressString}
                        </Text>
                        <Text className="text-gray-500 text-xs">
                          Coordinates: {selectedReport.geotag_location || 
                                      (selectedReport.latitude && selectedReport.longitude ? 
                                        `${selectedReport.latitude.toFixed(6)}, ${selectedReport.longitude.toFixed(6)}` : 
                                        'N/A')}
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-gray-800 font-semibold">
                        {selectedReport.geotag_location || selectedReport.location || 'Location unavailable'}
                      </Text>
                    )}
                  </View>
                </View>

                <View className="mb-3">
                  <Text className="text-gray-600 text-sm">Status</Text>
                  <View
                    className="px-3 py-2 rounded-full self-start mt-1"
                    style={{ backgroundColor: getProgressColor(selectedReport.progress) + '20' }}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{ color: getProgressColor(selectedReport.progress) }}
                    >
                      {selectedReport.progress || 'Unknown'}
                    </Text>
                  </View>
                </View>

                <View className="mb-3">
                  <Text className="text-gray-600 text-sm">Cause of Fire</Text>
                  <Text className="text-gray-800 font-semibold">
                    {selectedReport.cause_of_fire || selectedReport.cause || 'No cause specified'}
                  </Text>
                </View>

                {/* AI Fire Detection Results */}
                {selectedReport.prediction && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">AI Fire Detection</Text>
                    <View className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <Text className="text-blue-800 font-semibold text-sm">
                        Prediction: {selectedReport.prediction}
                      </Text>
                      {selectedReport.confidence && (
                        <Text className="text-blue-600 text-xs mt-1">
                          Confidence: {selectedReport.confidence}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Structure Type */}
                {selectedReport.structure && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">Structure Type</Text>
                    <View className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <Text className="text-purple-800 font-semibold text-sm">{selectedReport.structure}</Text>
                    </View>
                  </View>
                )}

                {/* Smoke Analysis */}
                {selectedReport.smoke_intensity && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">Smoke Analysis</Text>
                    <View className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                      <Text className="text-orange-800 font-semibold text-sm">
                        Intensity: {selectedReport.smoke_intensity}
                      </Text>
                      {selectedReport.smoke_confidence && (
                        <Text className="text-orange-600 text-xs mt-1">
                          Confidence: {selectedReport.smoke_confidence}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Emergency Alert Level */}
                {selectedReport.alarm_level && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">Emergency Alert Level</Text>
                    <View className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <Text className="text-red-800 font-semibold text-sm">{selectedReport.alarm_level}</Text>
                    </View>
                  </View>
                )}

                {/* Number of Structures */}
                {selectedReport.number_of_structures_on_fire && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">Structures Affected</Text>
                    <Text className="text-gray-800 font-semibold">
                      {selectedReport.number_of_structures_on_fire} structure(s)
                    </Text>
                  </View>
                )}

                {/* Timestamp */}
                <View className="mb-6">
                  <Text className="text-gray-600 text-sm">Reported</Text>
                  <Text className="text-gray-800 font-medium">
                    {selectedReport.formatted_timestamp || 
                     selectedReport.timestamp || 
                     (selectedReport.created_at ? 
                       new Date(selectedReport.created_at).toLocaleString('en-US', {
                         year: 'numeric',
                         month: 'short',
                         day: 'numeric',
                         hour: '2-digit',
                         minute: '2-digit',
                         hour12: true
                       }) : 
                       'Unknown time')}
                  </Text>
                </View>

                <TouchableOpacity
                  className="bg-[#ff512f] rounded-lg p-4"
                  onPress={() => setShowModal(false)}
                >
                  <Text className="text-center font-semibold text-white">Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Success Toast */}
      {showSuccessToast && (
        <View className="absolute top-20 left-4 right-4 z-50">
          <View className="bg-green-500 rounded-lg p-4 flex-row items-center shadow-lg">
            <MaterialIcons name="check-circle" size={24} color="#ffffff" />
            <Text className="text-white font-semibold ml-3 flex-1">
              Emergency reported successfully!
            </Text>
          </View>
        </View>
      )}

      {/* Delete Loading Overlay */}
      {isDeletingReport && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center z-50">
          <View className="bg-white rounded-lg p-6 items-center">
            <LoadingSpinner size={48} color="#ef4444" />
            <Text className="text-lg font-semibold text-gray-800 mt-4">Deleting Report</Text>
            <Text className="text-sm text-gray-600 mt-2 text-center">
              Please wait while we delete your report...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default CStatus;

export const options = {
  headerShown: false,
};