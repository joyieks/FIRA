import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { auth, db } from '../../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

// TODO: Replace with your deployed API endpoint
const API_URL = 'https://fire-predictor-api-production.up.railway.app/predict';

const CStatus = () => {
  const [activeTab, setActiveTab] = useState('Your Reports');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Sample data for reports
  const [yourReports, setYourReports] = useState([]);
  const [nearbyReports, setNearbyReports] = useState([]);

  // Get current user info when component mounts
  useEffect(() => {
    getCurrentUserInfo();
  }, []);

  // Load reports from Firebase when component mounts and user is available
  useEffect(() => {
    if (currentUser) {
      loadReportsFromFirebase();
    }
  }, [currentUser]);

  const getCurrentUserInfo = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'citizenUsers', user.uid));
        if (userDoc.exists()) {
          setCurrentUser(userDoc.data());
        }
      }
    } catch (error) {
      console.log('Error getting user info:', error);
    }
  };

  const loadReportsFromFirebase = async () => {
    try {
      setIsLoading(true);
      console.log('Loading reports for user:', currentUser?.uid);
      
      const response = await fetch('https://fire-predictor-api-production.up.railway.app/get_reports');
      console.log('API Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API Response data:', data);
        console.log('Total reports received:', data.length);
        
        // Filter reports by current user's UID
        const userReports = data.filter(report => {
          console.log('Checking report:', report.reporterId, 'against user:', currentUser?.uid);
          return report.reporterId === currentUser?.uid;
        });
        
        const otherReports = data.filter(report => report.reporterId !== currentUser?.uid);
        
        console.log('User reports found:', userReports.length);
        console.log('Other reports found:', otherReports.length);
        
        setYourReports(userReports);
        setNearbyReports(otherReports);
      } else {
        console.log('API returned error status:', response.status);
        const errorData = await response.text();
        console.log('Error response:', errorData);
        setYourReports([]);
        setNearbyReports([]);
      }
    } catch (error) {
      console.log('Error loading reports:', error);
      setYourReports([]);
      setNearbyReports([]);
    } finally {
      setIsLoading(false);
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
    numberOfStructures: ''  // NEW FIELD
  });

  const handleReportEmergency = () => {
    setShowEmergencyModal(true);
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
    try {
      console.log('Starting emergency submission for user:', currentUser?.uid);
      
      // Get current location first
      let currentLocation = 'Location unavailable';
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          currentLocation = `${location.coords.latitude}, ${location.coords.longitude}`;
          console.log('Location captured:', currentLocation);
        }
      } catch (locationError) {
        console.log('Location error:', locationError);
        currentLocation = 'Location unavailable';
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

      // Add user ID for persistent identification - ensure field names match your API
      if (currentUser?.uid) {
        formData.append('user_id', currentUser.uid);
        formData.append('user_name', `${currentUser.firstName} ${currentUser.lastName}`);
        console.log('Sending user data:', { uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName}` });
      }

      console.log('Submitting to API:', API_URL);
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('API response:', data);
      
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit emergency');
      }

      const newReport = {
        id: Date.now(),
        image: data?.photo_url ? { uri: data.photo_url } : { uri: emergencyData.image },
        location: data?.geotag_location || currentLocation,
        progress: data?.prediction === 'Fire' ? 'On Going' : 'Under Control',
        description: `Emergency reported: ${emergencyData.cause}\nPrediction: ${data?.prediction} (${data?.confidence})\nStructure: ${data?.structure}\nSmoke: ${data?.smoke_intensity} (${data?.smoke_confidence})\nAlarm: ${data?.alarm_level}`,
        reporter: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'You',
        reporterId: currentUser?.uid || 'unknown', // This should match the field name in your API response
        timestamp: 'Just now',
        cause: emergencyData.cause,
      };

      console.log('Created new report:', newReport);

      // Add to local state
      setYourReports(prevReports => [newReport, ...prevReports]);

      setShowEmergencyModal(false);
      setEmergencyData({ cause: '', image: null, numberOfStructures: '' });
      setActiveTab('Your Reports');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2000);
      
      // Refresh reports from API to ensure consistency
      setTimeout(() => {
        loadReportsFromFirebase();
      }, 1000);
    } catch (err) {
      console.log('Submission error:', err);
      Alert.alert('Error', err?.message || 'Something went wrong while submitting the report');
    }
  };

  const handleSubmitEmergency = () => {
    if (!emergencyData.cause) {
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

  const renderReportCard = (report) => {
    // Handle different image source formats (API response vs local state)
    const imageSource = report.image?.uri ? report.image : 
                       typeof report.image === 'string' ? { uri: report.image } : 
                       report.photo_url ? { uri: report.photo_url } : 
                       require('../../../../assets/images/burnhouse.jpg');
    
    // Map API fields to display fields
    const displayLocation = report.location || report.geotag_location || 'Location unavailable';
    const displayReporter = report.reporter || 'Unknown Reporter';
    const displayTimestamp = report.timestamp || 'Unknown time';
    const displayCause = report.cause || report.cause_of_fire || 'No cause specified';
    
    // Determine progress based on prediction
    const displayProgress = report.progress || 
                           (report.prediction === 'Fire' ? 'On Going' : 'Under Control') ||
                           'Unknown';

    return (
      <TouchableOpacity
        key={report.id}
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
              
              // If it's an ISO string, format it nicely
              if (typeof timestamp === 'string' && timestamp.includes('T')) {
                try {
                  const date = new Date(timestamp);
                  return date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  });
                } catch (e) {
                  return timestamp;
                }
              }
              
              return timestamp;
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

  // Show loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <Text className="text-lg text-gray-600">Loading reports...</Text>
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
        <ScrollView showsVerticalScrollIndicator={false}>
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
           <View className="bg-white rounded-lg p-6 w-11/12">
             <View className="items-center mb-6">
               <Text className="text-xl font-bold text-gray-800">Report Emergency</Text>
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
                 className="flex-1 bg-red-600 rounded-lg p-3"
                 onPress={handleSubmitEmergency}
               >
                 <Text className="text-center font-semibold text-white">Submit</Text>
               </TouchableOpacity>
             </View>
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
                     className="p-2 rounded-full bg-gray-100"
                   >
                     <MaterialIcons name="close" size={20} color="#6b7280" />
                   </TouchableOpacity>
                 </View>

                                   <Image
                    source={(() => {
                      // Handle different image source formats for the modal
                      if (selectedReport.image?.uri) return selectedReport.image;
                      if (typeof selectedReport.image === 'string') return { uri: selectedReport.image };
                      if (selectedReport.photo_url) return { uri: selectedReport.photo_url };
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
                      {selectedReport.location || selectedReport.geotag_location || 'Location unavailable'}
                    </Text>
                  </View>

                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm">Status</Text>
                    <View
                      className="px-3 py-1 rounded-full self-start mt-1"
                      style={{ backgroundColor: getProgressColor(selectedReport.progress) + '20' }}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{ color: getProgressColor(selectedReport.progress) }}
                      >
                        {selectedReport.progress || 
                         (selectedReport.prediction === 'Fire' ? 'On Going' : 'Under Control') ||
                         'Unknown'}
                      </Text>
                    </View>
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
                        const timestamp = selectedReport.timestamp;
                        if (!timestamp) return 'Unknown time';
                        
                        // If it's "Just now", keep it
                        if (timestamp === 'Just now') return timestamp;
                        
                        // If it's an ISO string, format it nicely
                        if (typeof timestamp === 'string' && timestamp.includes('T')) {
                          try {
                            const date = new Date(timestamp);
                            return date.toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            });
                          } catch (e) {
                            return timestamp;
                          }
                        }
                        
                        return timestamp;
                      })()}
                    </Text>
                  </View>

                 <TouchableOpacity
                   className="bg-[#ff512f] rounded-lg p-3"
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
     </View>
   );
 };

export default CStatus;

export const options = {
  headerShown: false,
};
