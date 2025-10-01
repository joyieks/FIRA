import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, TextInput, RefreshControl } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../../../config/AuthContext';

// Fire Detection API base
const API_URL = 'https://fire-detection-api-production-f8a3.up.railway.app/predict';
const API_BASE = 'https://fire-detection-api-production-f8a3.up.railway.app';

const CStatus = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { isAuthenticated, userData } = useAuth();

  // Sample data for reports
  const [yourReports, setYourReports] = useState([]);
  const [nearbyReports, setNearbyReports] = useState([]);
  const [addressCache, setAddressCache] = useState({});

  // Use Supabase auth context instead of Firebase auth
  useEffect(() => {
    console.log('CitizenStatus: auth context changed', { isAuthenticated, hasUserData: !!userData });
    if (isAuthenticated && userData?.uid) {
      setCurrentUser({
        uid: userData.uid,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
      });
    } else {
      setCurrentUser(null);
    }
  }, [isAuthenticated, userData?.uid]);

  // Load reports when user is available
  useEffect(() => {
    if (currentUser?.uid) {
      console.log('Current user available, loading reports...');
      loadReportsFromFirebase();
    } else if (currentUser === null) {
      // User is explicitly null (not authenticated)
      console.log('No user authenticated, clearing reports');
      setYourReports([]);
      setNearbyReports([]);
      setIsLoading(false);
    }
  }, [currentUser?.uid]);

  const loadReportsFromFirebase = async (retryCount = 0) => {
    if (!currentUser?.uid) {
      console.log('No current user UID, skipping reports load');
      setIsLoading(false);
      return;
    }

    try {
      const useLoadingUI = !showEmergencyModal && !showLocationPicker && !showModal;
      if (useLoadingUI) setIsLoading(true);
      console.log('Loading reports for user:', currentUser.uid);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch('https://fire-detection-api-production-f8a3.up.railway.app/get_reports', {
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
        
        // Filter reports by current user's UID
        const userReportsRaw = data.filter(report => {
          const reporterId = report.reporterId || report.user_id;
          console.log('Checking report:', reporterId, 'against user:', currentUser.uid);
          return reporterId === currentUser.uid;
        });
        
        const otherReportsRaw = data.filter(report => {
          const reporterId = report.reporterId || report.user_id;
          return reporterId !== currentUser.uid;
        });
        
        // Exclude cancelled and fire out to match admin and map
        const isActiveReport = (r) => {
          const statusText = (r.status || r.progress || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          return !isCancelled && !isFireOut;
        };

        const userReports = userReportsRaw.filter(isActiveReport);
        const otherReports = otherReportsRaw.filter(isActiveReport);

        console.log('Active user reports:', userReports.length);
        console.log('Active other reports:', otherReports.length);
        
        // Enrich with readable addresses best-effort
        const enrichAddresses = async (reports, cap = 8) => {
          const results = [...reports];
          let resolved = 0;
          for (let i = 0; i < results.length && resolved < cap; i++) {
            const r = results[i];
            if (r.address || r.resolved_address) continue;
            const loc = (r.geotag_location || '').toString();
            const match = loc.match(/-?\d+\.?\d*\s*,\s*-?\d+\.?\d*/);
            if (!match) continue;
            const key = match[0];
            if (addressCache[key]) { results[i] = { ...r, resolved_address: addressCache[key] }; continue; }
            try {
              const [lat, lon] = key.split(',').map(s => parseFloat(s.trim()));
              const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
              if (rev && rev[0]) {
                const rr = rev[0];
                const label = [rr.name, rr.street, rr.subregion, rr.city || rr.region, rr.postalCode, rr.country].filter(Boolean).join(', ');
                setAddressCache(prev => ({ ...prev, [key]: label }));
                results[i] = { ...r, resolved_address: label };
                resolved++;
              }
            } catch {}
          }
          return results;
        };

        const [enrichedUser, enrichedOther] = await Promise.all([
          enrichAddresses(userReports, 10),
          enrichAddresses(otherReports, 6),
        ]);

        setYourReports(enrichedUser);
        setNearbyReports(enrichedOther);
      } else {
        throw new Error(`API returned status: ${response.status}`);
      }
    } catch (error) {
      console.log('Error loading reports:', error);
      
      // Retry logic for network issues (silent)
      if (retryCount < 3 && error.name !== 'AbortError') {
        console.log(`Retrying... attempt ${retryCount + 1}`);
        setTimeout(() => {
          loadReportsFromFirebase(retryCount + 1);
        }, 2000 * (retryCount + 1));
        return;
      } else {
        // Final fallback without user-facing alerts
        console.log('Failed to load reports after retries');
        setYourReports([]);
        setNearbyReports([]);
      }
    } finally {
      const useLoadingUI = !showEmergencyModal && !showLocationPicker && !showModal;
      if (useLoadingUI) setIsLoading(false);
    }
  };

  const getProgressColor = (progress) => {
    switch (progress) {
      case 'On Going':
        return '#ef4444';
      case 'Under Control':
        return '#f59e0b';
      case 'Fire Out':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [emergencyData, setEmergencyData] = useState({
    cause: '',
    image: null,
    numberOfStructures: ''
  });
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickedLocation, setPickedLocation] = useState(null); // { latitude, longitude }
  const [tempPickedLocation, setTempPickedLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [pickedAddress, setPickedAddress] = useState('');
  const [tempPickedAddress, setTempPickedAddress] = useState('');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const mapRef = useRef(null);

  // Edit state
  const [editData, setEditData] = useState({
    cause: '',
    numberOfStructures: '',
    imageUri: null,
    latitude: null,
    longitude: null,
    address: '',
  });
  const [showEditLocationPicker, setShowEditLocationPicker] = useState(false);
  const [editTempLocation, setEditTempLocation] = useState(null);
  const [editTempAddress, setEditTempAddress] = useState('');
  const [editMapRegion, setEditMapRegion] = useState(null);
  const [isGettingEditLocation, setIsGettingEditLocation] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleReportEmergency = () => {
    if (!currentUser?.uid) {
      Alert.alert('Authentication Error', 'Please log in to report an emergency.');
      return;
    }
    setShowEmergencyModal(true);
  };

  const openLocationPicker = async () => {
    setIsGettingLocation(true);
    setShowLocationPicker(true);
    setShowEmergencyModal(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
        });
        const region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setMapRegion(region);
        // Default pin to current location if none picked yet
        setTempPickedLocation((prev) => prev || { latitude: region.latitude, longitude: region.longitude });
        // Animate map to user's current region when available
        if (mapRef.current) {
          try { mapRef.current.animateToRegion(region, 500); } catch {}
        }
        try {
          setIsResolvingAddress(true);
          const results = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
          if (results && results[0]) {
            const r = results[0];
            const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country].filter(Boolean).join(', ');
            setTempPickedAddress(label);
          }
        } catch (e) {
          // ignore reverse geocode failure
        } finally {
          setIsResolvingAddress(false);
        }
      }
    } catch (e) {
      // keep defaults
    } finally {
      setIsGettingLocation(false);
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

  const submitEmergencyToApi = async () => {
    if (!currentUser?.uid) {
      Alert.alert('Authentication Error', 'Please log in to submit a report.');
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('Starting emergency submission for user:', currentUser.uid);
      
      // Determine location: prioritize manually picked location
      let currentLocation = 'Location unavailable';
      if (pickedLocation?.latitude && pickedLocation?.longitude) {
        currentLocation = `${pickedLocation.latitude}, ${pickedLocation.longitude}`;
        console.log('Using picked location:', currentLocation);
      } else {
        // Fallback: try device location
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              timeout: 10000,
            });
            currentLocation = `${location.coords.latitude}, ${location.coords.longitude}`;
            console.log('Location captured:', currentLocation);
          }
        } catch (locationError) {
          console.log('Location error:', locationError);
          currentLocation = 'Location unavailable';
        }
      }

      const formData = new FormData();
      formData.append('image', {
        uri: emergencyData.image,
        name: 'report.jpg',
        type: 'image/jpeg',
      });
      
      // Add real geotag location
      formData.append('geotag_location', currentLocation);
      
      // Add cause of fire
      formData.append('cause_of_fire', emergencyData.cause);
      
      // Add number of structures on fire
      if (emergencyData.numberOfStructures) {
        formData.append('number_of_structures_on_fire', emergencyData.numberOfStructures);
      }

      // Add human-readable address if user picked a location
      if (pickedAddress) {
        formData.append('address', pickedAddress);
      }

      // Add user ID for persistent identification
      formData.append('user_id', currentUser.uid);
      const userName = currentUser.firstName && currentUser.lastName 
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : 'Anonymous User';
      formData.append('user_name', userName);
      
      console.log('Sending user data:', { uid: currentUser.uid, name: userName });

      console.log('Submitting to API:', API_URL);
      
      // Add timeout for submission as well
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for upload
      
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();
      console.log('API response:', data);
      
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit emergency');
      }

      const newReport = {
        id: Date.now(),
        image: data?.image_url ? { uri: data.image_url } : data?.photo_url ? { uri: data.photo_url } : { uri: emergencyData.image },
        location: data?.geotag_location || currentLocation,
        progress: data?.prediction === 'Fire' ? 'On Going' : 'Under Control',
        description: `Emergency reported: ${emergencyData.cause}\nPrediction: ${data?.prediction} (${data?.confidence})\nStructure: ${data?.structure}\nSmoke: ${data?.smoke_intensity} (${data?.smoke_confidence})\nAlarm: ${data?.alarm_level}`,
        reporter: userName,
        reporterId: currentUser.uid,
        timestamp: 'Just now',
        cause: emergencyData.cause,
      };

      console.log('Created new report:', newReport);

      // Add to local state immediately for better UX
      setYourReports(prevReports => [newReport, ...prevReports]);

      setShowEmergencyModal(false);
      setShowLocationPicker(false);
      setPickedLocation(null);
      setEmergencyData({ cause: '', image: null, numberOfStructures: '' });
      setActiveTab('Your Reports');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      
      // Refresh reports from API to ensure consistency
      setTimeout(() => {
        loadReportsFromFirebase();
      }, 2000);
      
    } catch (err) {
      console.log('Submission error:', err);
      if (err.name === 'AbortError') {
        Alert.alert('Timeout', 'Submission is taking too long. Please check your internet connection.');
      } else {
        Alert.alert('Error', err?.message || 'Something went wrong while submitting the report');
      }
    } finally {
      setIsSubmitting(false);
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

    Alert.alert(
      'Confirm Emergency Report',
      'Are you sure you want to report this emergency? This will immediately notify emergency services.',
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

  const openEditFromReport = (report) => {
    const lat = report.latitude ? parseFloat(report.latitude) : null;
    const lon = report.longitude ? parseFloat(report.longitude) : null;
    setEditData({
      cause: report.cause_of_fire || report.cause || '',
      numberOfStructures: report.number_of_structures_on_fire ? String(report.number_of_structures_on_fire) : '',
      imageUri: report.image_url || report.photo_url || report.image?.uri || null,
      latitude: lat,
      longitude: lon,
      address: report.address || report.resolved_address || '',
    });
    setShowModal(false);
    setTimeout(() => setShowEditModal(true), 200);
  };

  const renderReportCard = (report) => {
    // Handle different image source formats (API response vs local state)
    const imageSource = (() => {
      // Prefer Supabase 'image_url' if present
      if (report.image_url) return { uri: report.image_url };
      if (report.photo_url) return { uri: report.photo_url };
      if (report.image?.uri) return report.image;
      if (typeof report.image === 'string') return { uri: report.image };
      return require('../../../../assets/images/burnhouse.jpg');
    })();
    
    // Map API fields to display fields
    const displayLocation = report.resolved_address || report.address || report.location || report.geotag_location || 'Location unavailable';
    const displayReporter = report.reporter || report.user_name || 'Unknown Reporter';
    const displayTimestamp = report.formatted_timestamp || report.created_at || report.timestamp || 'Unknown time';
    const displayCause = report.cause || report.cause_of_fire || 'No cause specified';
    
    // Determine progress based on prediction
    const displayProgress = report.progress || 
                           (report.prediction === 'Fire' ? 'On Going' : 'Under Control') ||
                           'Unknown';

    return (
      <TouchableOpacity
        key={report.id || report._id || Math.random()}
        className="bg-white rounded-lg p-4 mb-4 shadow-sm"
        onPress={() => openReportModal(report)}
        activeOpacity={0.7}
      >
        <Image
          source={imageSource}
          className="w-full h-44 rounded-lg mb-3"
          resizeMode="contain"
        />
        
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm text-gray-500">{displayReporter}</Text>
          <Text className="text-sm text-gray-500">
            {(() => {
              // Format timestamp to be more readable
              const timestamp = displayTimestamp;
              if (!timestamp) return 'Unknown time';
              
              // If it's "Just now", keep it
              if (timestamp === 'Just now') return timestamp;
              
              try {
                const date = new Date(timestamp);
                if (isNaN(date.getTime())) return String(timestamp);
                return date.toLocaleString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true
                });
              } catch {
                return String(timestamp);
              }
            })()}
          </Text>
        </View>

        <Text className="text-gray-800 font-semibold text-base mb-2">
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
        </View>

        <Text className="text-gray-500 text-xs">
          Cause: {displayCause}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    let reports = [];
    let title = '';

    switch (activeTab) {
      case 'Your Reports':
        reports = yourReports;
        title = 'Your Reports';
        break;
      case 'Nearby Reports':
        reports = nearbyReports;
        title = 'Nearby Reports';
        break;
      case 'All':
        reports = [...yourReports, ...nearbyReports];
        title = 'All Reports';
        break;
    }

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

  // Add pull to refresh functionality
  const handleRefresh = () => {
    if (currentUser?.uid) {
      loadReportsFromFirebase();
    }
  };

  // Show loading state (but never interrupt modals)
  if (isLoading && !showEmergencyModal && !showLocationPicker && !showModal) {
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
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
        >
          {renderTabContent()}
        </ScrollView>
      </View>

      {/* Emergency Reporting Modal */}
      <Modal
        visible={showEmergencyModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg w-11/12 max-h-[80%]">
            <View className="items-center px-6 pt-6 pb-2">
              <Text className="text-xl font-bold text-gray-800">Report Emergency</Text>
            </View>
            <ScrollView className="px-6 pb-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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

            {/* Choose Location Button */}
            <TouchableOpacity
              className="bg-gray-800 rounded-lg p-4 mb-6 items-center shadow-sm"
              onPress={openLocationPicker}
              activeOpacity={0.8}
            >
              <MaterialIcons name="place" size={24} color="#ffffff" />
              <Text className="text-white font-semibold text-base mt-2">
                {pickedLocation ? 'Change Location' : 'Choose Location on Map'}
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
              <TextInput
                className="border border-gray-300 rounded-lg p-4 text-gray-800"
                placeholder="Write cause of fire..."
                value={emergencyData.cause}
                onChangeText={(text) => setEmergencyData({...emergencyData, cause: text})}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Selected Location Preview */}
            {pickedLocation && (
              <View className="mb-6">
                <Text className="text-gray-600 text-sm mb-1">Selected Location</Text>
                <Text className="text-gray-800 font-semibold">
                  {pickedAddress || `${pickedLocation.latitude.toFixed(6)}, ${pickedLocation.longitude.toFixed(6)}`}
                </Text>
              </View>
            )}

            {/* Number of Structures on Fire Input */}
            <View className="mb-6">
              <TextInput
                className="border border-gray-300 rounded-lg p-4 text-gray-800"
                placeholder="Number of structures on fire (optional)"
                value={emergencyData.numberOfStructures}
                onChangeText={(text) => setEmergencyData({...emergencyData, numberOfStructures: text})}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>

            {/* Action Buttons */}
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 bg-gray-300 rounded-lg p-3"
                onPress={() => setShowEmergencyModal(false)}
              >
                <Text className="text-center font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-lg p-3 ${isSubmitting ? 'bg-gray-400' : 'bg-red-600'}`}
                onPress={handleSubmitEmergency}
                disabled={isSubmitting}
              >
                <Text className="text-center font-semibold text-white">
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View className="flex-1 bg-white">
          <View className="h-16 flex-row items-center justify-between px-4 border-b border-gray-200 bg-white">
            <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
              <Text className="text-red-600 font-semibold">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-gray-800 font-bold">Pick Location</Text>
            <TouchableOpacity
              onPress={async () => {
                if (tempPickedLocation?.latitude && tempPickedLocation?.longitude) {
                  try {
                    setIsResolvingAddress(true);
                    if (!tempPickedAddress) {
                      const res = await Location.reverseGeocodeAsync(tempPickedLocation);
                      if (res && res[0]) {
                        const r = res[0];
                        const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country].filter(Boolean).join(', ');
                        setTempPickedAddress(label);
                      }
                    }
                  } catch (e) {
                  } finally {
                    setIsResolvingAddress(false);
                  }
                  setPickedLocation(tempPickedLocation);
                  setPickedAddress(tempPickedAddress || pickedAddress || '');
                  setShowLocationPicker(false);
                  setTimeout(() => setShowEmergencyModal(true), 200);
                } else {
                  Alert.alert('Select a location', 'Tap on the map to place a pin.');
                }
              }}
            >
              <Text className="text-green-600 font-semibold">Use</Text>
            </TouchableOpacity>
          </View>
          {isGettingLocation && (
            <View className="absolute top-16 left-0 right-0 z-10 items-center p-2">
              <View className="bg-black/60 px-3 py-1 rounded-full">
                <Text className="text-white text-xs">Getting current location…</Text>
              </View>
            </View>
          )}
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={mapRegion}
            ref={mapRef}
            showsUserLocation={true}
            showsMyLocationButton={true}
            toolbarEnabled={true}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setTempPickedLocation({ latitude, longitude });
              // Reverse-geocode tapped location so the preview shows the correct place name
              (async () => {
                try {
                  setIsResolvingAddress(true);
                  const res = await Location.reverseGeocodeAsync({ latitude, longitude });
                  if (res && res[0]) {
                    const r = res[0];
                    const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country]
                      .filter(Boolean)
                      .join(', ');
                    setTempPickedAddress(label);
                  } else {
                    setTempPickedAddress('');
                  }
                } catch (err) {
                  setTempPickedAddress('');
                } finally {
                  setIsResolvingAddress(false);
                }
              })();
            }}
            key={`picker-${showLocationPicker}-${mapRegion.latitude}-${mapRegion.longitude}`}
          >
            {tempPickedLocation?.latitude && (
              <Marker coordinate={tempPickedLocation} />
            )}
          </MapView>
          <View className="p-4 border-t border-gray-200">
            <Text className="text-gray-600 text-sm">
              {tempPickedLocation
                ? `${tempPickedAddress ? tempPickedAddress + ' • ' : ''}${tempPickedLocation.latitude.toFixed(6)}, ${tempPickedLocation.longitude.toFixed(6)}`
                : 'Tap anywhere on the map to place a pin'}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Report Detail Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg p-6 w-11/12 max-h-[80%]">
            {selectedReport && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-xl font-bold text-gray-800">Report Details</Text>
                  <TouchableOpacity
                    onPress={() => setShowModal(false)}
                    className="p-2"
                  >
                    <Text className="text-2xl font-bold text-gray-500">×</Text>
                  </TouchableOpacity>
                </View>

                <Image
                  source={(() => {
                    // Prefer URLs coming from DB/API
                    if (selectedReport.image_url) return { uri: selectedReport.image_url };
                    if (selectedReport.photo_url) return { uri: selectedReport.photo_url };
                    if (selectedReport.image?.uri) return selectedReport.image;
                    if (typeof selectedReport.image === 'string') return { uri: selectedReport.image };
                    return require('../../../../assets/images/burnhouse.jpg');
                  })()}
                  className="w-full h-56 rounded-lg mb-4"
                  resizeMode="contain"
                />

                <View className="mb-3">
                  <Text className="text-gray-600 text-sm">Reporter</Text>
                  <Text className="text-gray-800 font-semibold">
                    {selectedReport.reporter || selectedReport.user_name || 'Unknown Reporter'}
                  </Text>
                </View>

                <View className="mb-3">
                  <Text className="text-gray-600 text-sm">Location</Text>
                  <Text className="text-gray-800 font-semibold">
                    {selectedReport.resolved_address || selectedReport.address || selectedReport.location || selectedReport.geotag_location || 'Location unavailable'}
                  </Text>
                </View>

                <View className="mb-3">
                  <Text className="text-gray-600 text-sm">Status</Text>
                  {(() => {
                    const progress = selectedReport.progress ||
                      (selectedReport.prediction === 'Fire' ? 'On Going' : 'Under Control') ||
                      'Unknown';
                    const color = getProgressColor(progress);
                    return (
                      <View
                        className="px-3 py-1 rounded-full self-start mt-1"
                        style={{ backgroundColor: color + '20' }}
                      >
                        <Text
                          className="text-sm font-medium"
                          style={{ color }}
                        >
                          {progress}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                <View className="mb-3">
                  <Text className="text-gray-600 text-sm">Cause of Fire</Text>
                  <Text className="text-gray-800 font-semibold">
                    {selectedReport.cause || selectedReport.cause_of_fire || 'No cause specified'}
                  </Text>
                </View>

                {/* CNN Model Results */}
                {selectedReport.prediction && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">AI Prediction</Text>
                    <Text className="text-gray-800 font-semibold">
                      {selectedReport.prediction} ({selectedReport.confidence || 'N/A'})
                    </Text>
                  </View>
                )}

                {selectedReport.structure && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">Structure Type</Text>
                    <Text className="text-gray-800 font-semibold">{selectedReport.structure}</Text>
                  </View>
                )}

                {selectedReport.smoke_intensity && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">Smoke Intensity</Text>
                    <Text className="text-gray-800 font-semibold">
                      {selectedReport.smoke_intensity} ({selectedReport.smoke_confidence || 'N/A'})
                    </Text>
                  </View>
                )}

                {selectedReport.alarm_level && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">Alarm Level</Text>
                    <Text className="text-gray-800 font-semibold">{selectedReport.alarm_level}</Text>
                  </View>
                )}

                {selectedReport.number_of_structures_on_fire && (
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">Estimated Structures Affected</Text>
                    <Text className="text-gray-800 font-semibold">{selectedReport.number_of_structures_on_fire} structure(s)</Text>
                  </View>
                )}

                <View className="mb-4">
                  <Text className="text-gray-600 text-sm">Description</Text>
                  <Text className="text-gray-800">
                    {selectedReport.description || 'Emergency report submitted'}
                  </Text>
                </View>

                <View className="mb-4">
                  <Text className="text-gray-600 text-sm">Reported</Text>
                  <Text className="text-gray-800">
                    {(() => {
                      // Format timestamp to be more readable
                      const timestamp = selectedReport.formatted_timestamp || selectedReport.created_at || selectedReport.timestamp;
                      if (!timestamp) return 'Unknown time';
                      
                      // If it's "Just now", keep it
                      if (timestamp === 'Just now') return timestamp;
                      try {
                        const date = new Date(timestamp);
                        if (isNaN(date.getTime())) return String(timestamp);
                        return date.toLocaleString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        });
                      } catch {
                        return String(timestamp);
                      }
                    })()}
                  </Text>
                </View>

                {/* Action Buttons: Edit and Cancel */}
                {selectedReport && (
                  <View className="flex-row space-x-3 mt-3">
                    <TouchableOpacity
                      className="flex-1 bg-blue-600 rounded-lg p-3"
                      onPress={() => openEditFromReport(selectedReport)}
                    >
                      <Text className="text-center font-semibold text-white">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 bg-red-600 rounded-lg p-3"
                      onPress={() => {
                        setShowModal(false);
                        setCancelReason('');
                        setShowCancelModal(true);
                      }}
                    >
                      <Text className="text-center font-semibold text-white">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Cancel Reason Modal */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg w-11/12 p-6">
            <Text className="text-xl font-bold text-gray-800 mb-2">Cancel Report</Text>
            <Text className="text-gray-600 mb-4">Please provide a reason for cancelling this report.</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-4 text-gray-800 min-h-[100px]"
              placeholder="Enter your reason..."
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              textAlignVertical="top"
              returnKeyType="done"
            />
            <View className="flex-row space-x-3 mt-4">
              <TouchableOpacity
                className="flex-1 bg-gray-300 rounded-lg p-3"
                onPress={() => setShowCancelModal(false)}
              >
                <Text className="text-center font-semibold text-gray-700">Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-lg p-3 ${cancelReason.trim() ? 'bg-red-600' : 'bg-gray-300'}`}
                disabled={!cancelReason.trim()}
                onPress={async () => {
                  try {
                    if (!selectedReport?.id) throw new Error('Missing report id');
                    // Generate client-side timestamp as fallback (server also sets one)
                    const now = new Date();
                    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
                    const localTs = now.toLocaleString('en-US', options).replace('AM', 'am').replace('PM', 'pm');

                    // Prefer the same endpoint used by admin to ensure fields populate
                    let res = await fetch(`${API_BASE}/update_report_status`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                      body: JSON.stringify({
                        report_id: selectedReport.id,
                        status: 'Cancelled',
                        reason: cancelReason,
                        cancelled_by: currentUser?.email || [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || currentUser?.uid || 'Citizen User',
                        cancelled_by_role: 'citizen',
                      })
                    });
                    let data;
                    try { data = await res.clone().json(); } catch { data = await res.text(); }
                    if (!res.ok) {
                      // Fallback to dedicated cancel endpoint for older backends
                      res = await fetch(`${API_BASE}/cancel_report/${selectedReport.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          reason: cancelReason,
                          cancellation_reason: cancelReason,
                          cancelled_by: currentUser?.email || currentUser?.uid || 'Citizen User',
                          cancelled_by_role: 'citizen',
                          cancellation_timestamp: localTs,
                        })
                      });
                      try { data = await res.clone().json(); } catch { data = await res.text(); }
                      if (!res.ok) throw new Error(typeof data === 'string' ? data : (data?.error || 'Failed to cancel'));
                    }
                    setShowCancelModal(false);
                    setTimeout(() => loadReportsFromFirebase(), 300);
                  } catch (e) {
                    Alert.alert('Cancel Failed', e?.message || 'Please try again later');
                  }
                }}
              >
                <Text className={`text-center font-semibold ${cancelReason.trim() ? 'text-white' : 'text-gray-500'}`}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Report Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg w-11/12 max-h-[85%]">
            <View className="items-center px-6 pt-6 pb-2">
              <Text className="text-xl font-bold text-gray-800">Edit Report</Text>
            </View>
            <ScrollView className="px-6 pb-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Preview Image */}
              {editData.imageUri && (
                <Image source={{ uri: editData.imageUri }} className="w-full h-40 rounded-lg mb-3" resizeMode="cover" />
              )}
              <View className="flex-row space-x-3 mb-6">
                <TouchableOpacity
                  className="flex-1 bg-gray-800 rounded-lg p-3 items-center"
                  onPress={async () => {
                    const hasPermission = await requestMediaLibraryPermission();
                    if (!hasPermission) return Alert.alert('Permission Denied', 'Gallery permission is required');
                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4,3], quality: 0.8 });
                    if (!result.canceled && result.assets[0]) {
                      setEditData({ ...editData, imageUri: result.assets[0].uri });
                    }
                  }}
                >
                  <Text className="text-white font-semibold">Change Picture</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-gray-800 rounded-lg p-3 items-center"
                  onPress={async () => {
                    // Close edit modal so the map is visible on top
                    setShowEditModal(false);
                    setShowEditLocationPicker(true);
                    setIsGettingEditLocation(true);
                    try {
                      const { status } = await Location.requestForegroundPermissionsAsync();
                      if (status === 'granted') {
                        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 10000 });
                        const region = {
                          latitude: editData.latitude || loc.coords.latitude,
                          longitude: editData.longitude || loc.coords.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        };
                        setEditMapRegion(region);
                        setEditTempLocation({ latitude: region.latitude, longitude: region.longitude });
                        try {
                          const res = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
                          if (res && res[0]) {
                            const r = res[0];
                            const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country].filter(Boolean).join(', ');
                            setEditTempAddress(label);
                          }
                        } catch {}
                      }
                    } catch {}
                    finally { setIsGettingEditLocation(false); }
                  }}
                >
                  <Text className="text-white font-semibold">Change Location</Text>
                </TouchableOpacity>
              </View>

              {/* Cause of Fire */}
              <View className="mb-4">
                <TextInput
                  className="border border-gray-300 rounded-lg p-4 text-gray-800"
                  placeholder="Cause of fire"
                  value={editData.cause}
                  onChangeText={(t) => setEditData({ ...editData, cause: t })}
                  multiline
                />
              </View>

              {/* Number of Structures */}
              <View className="mb-6">
                <TextInput
                  className="border border-gray-300 rounded-lg p-4 text-gray-800"
                  placeholder="Number of structures affected"
                  value={editData.numberOfStructures}
                  onChangeText={(t) => setEditData({ ...editData, numberOfStructures: t })}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>

              {/* Selected Location */}
              {(editData.latitude && editData.longitude) || editData.address ? (
                <View className="mb-6">
                  <Text className="text-gray-600 text-sm mb-1">Selected Location</Text>
                  <Text className="text-gray-800 font-semibold">{editData.address || `${editData.latitude?.toFixed(6)}, ${editData.longitude?.toFixed(6)}`}</Text>
                </View>
              ) : null}

              {/* Save/Close */}
              <View className="flex-row space-x-3">
                <TouchableOpacity className="flex-1 bg-gray-300 rounded-lg p-3" onPress={() => setShowEditModal(false)}>
                  <Text className="text-center font-semibold text-gray-700">Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 rounded-lg p-3 ${isEditing ? 'bg-gray-400' : 'bg-blue-600'}`}
                  onPress={async () => {
                    try {
                      setIsEditing(true);
                      if (!selectedReport?.id) throw new Error('Missing report id');
                      // Build multipart ONLY if we changed image; location change can go JSON too
                      const changedImage = !!editData.imageUri && !(selectedReport.image_url === editData.imageUri || selectedReport.photo_url === editData.imageUri);
                      if (changedImage) {
                        const fd = new FormData();
                        if (changedImage) {
                          fd.append('image', { uri: editData.imageUri, name: 'update.jpg', type: 'image/jpeg' });
                        }
                        if (editData.cause) fd.append('cause_of_fire', editData.cause);
                        if (editData.numberOfStructures) fd.append('number_of_structures_on_fire', editData.numberOfStructures);
                        if (editData.latitude && editData.longitude) {
                          fd.append('geotag_location', `${editData.latitude}, ${editData.longitude}`);
                          fd.append('latitude', String(editData.latitude));
                          fd.append('longitude', String(editData.longitude));
                          if (editData.address) fd.append('address', editData.address);
                        }
                        const res = await fetch(`${API_BASE}/update_report/${selectedReport.id}`, { method: 'PUT', body: fd });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data?.error || 'Failed to update');
                      } else {
                        const payload = {
                          cause_of_fire: editData.cause,
                          number_of_structures_on_fire: editData.numberOfStructures ? parseInt(editData.numberOfStructures) : null,
                          address: editData.address || undefined,
                          geotag_location: (editData.latitude && editData.longitude) ? `${editData.latitude}, ${editData.longitude}` : undefined,
                          latitude: editData.latitude || undefined,
                          longitude: editData.longitude || undefined,
                        };
                        const res = await fetch(`${API_BASE}/update_report/${selectedReport.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data?.error || 'Failed to update');
                      }
                      setShowEditModal(false);
                      setTimeout(() => loadReportsFromFirebase(), 300);
                    } catch (e) {
                      Alert.alert('Save Failed', e?.message || 'Please try again later');
                    } finally {
                      setIsEditing(false);
                    }
                  }}
                  disabled={isEditing}
                >
                  <Text className="text-center font-semibold text-white">
                    {isEditing ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Location Picker */}
      <Modal
        visible={showEditLocationPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowEditLocationPicker(false)}
      >
        <View className="flex-1 bg-white">
          <View className="h-16 flex-row items-center justify-between px-4 border-b border-gray-200 bg-white">
            <TouchableOpacity onPress={() => setShowEditLocationPicker(false)}>
              <Text className="text-red-600 font-semibold">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-gray-800 font-bold">Pick New Location</Text>
            <TouchableOpacity
              onPress={() => {
                if (editTempLocation?.latitude && editTempLocation?.longitude) {
                  setEditData({
                    ...editData,
                    latitude: editTempLocation.latitude,
                    longitude: editTempLocation.longitude,
                    address: editTempAddress || editData.address,
                  });
                  setShowEditLocationPicker(false);
                  // Reopen the edit modal so the user can finish editing
                  setTimeout(() => setShowEditModal(true), 200);
                } else {
                  Alert.alert('Select a location', 'Tap on the map to place a pin.');
                }
              }}
            >
              <Text className="text-green-600 font-semibold">Use</Text>
            </TouchableOpacity>
          </View>
          {isGettingEditLocation && (
            <View className="absolute top-16 left-0 right-0 z-10 items-center p-2">
              <View className="bg-black/60 px-3 py-1 rounded-full"><Text className="text-white text-xs">Getting location…</Text></View>
            </View>
          )}
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            initialRegion={editMapRegion || mapRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            toolbarEnabled={true}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setEditTempLocation({ latitude, longitude });
              (async () => {
                try {
                  const res = await Location.reverseGeocodeAsync({ latitude, longitude });
                  if (res && res[0]) {
                    const r = res[0];
                    const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country].filter(Boolean).join(', ');
                    setEditTempAddress(label);
                  } else { setEditTempAddress(''); }
                } catch { setEditTempAddress(''); }
              })();
            }}
          >
            {editTempLocation?.latitude && <Marker coordinate={editTempLocation} />}
          </MapView>
          <View className="p-4 border-t border-gray-200">
            <Text className="text-gray-600 text-sm">
              {editTempLocation ? `${editTempAddress ? editTempAddress + ' • ' : ''}${editTempLocation.latitude.toFixed(6)}, ${editTempLocation.longitude.toFixed(6)}` : 'Tap anywhere on the map to place a pin'}
            </Text>
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
    </View>
  );
};

export default CStatus;

export const options = {
  headerShown: false,
};