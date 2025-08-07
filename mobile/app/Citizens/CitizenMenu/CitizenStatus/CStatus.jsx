import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const CStatus = () => {
  const [activeTab, setActiveTab] = useState('Your Reports');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Sample data for reports
  const [yourReports, setYourReports] = useState([
    {
      id: 1,
      image: require('../../../../assets/images/burnhouse.jpg'),
      location: '123 Main Street, Barangay Guadalupe',
      progress: 'Under Control',
      description: 'Electrical fire caused by faulty wiring in the kitchen. Fire started around 2 PM and was reported immediately.',
      reporter: 'You',
      timestamp: '2 hours ago',
      cause: 'Electrical fault in kitchen wiring'
    },
    {
      id: 2,
      image: require('../../../../assets/images/burnhouse.jpg'),
      location: '456 Oak Avenue, Barangay Poblacion',
      progress: 'Fire Out',
      description: 'Kitchen fire caused by unattended cooking. Fire was extinguished by local firefighters.',
      reporter: 'You',
      timestamp: '1 day ago',
      cause: 'Unattended cooking'
    }
  ]);

  const nearbyReports = [
    {
      id: 3,
      image: require('../../../../assets/images/burnhouse.jpg'),
      location: '789 Pine Road, Barangay San Antonio',
      progress: 'On Going',
      description: 'Large fire in residential building. Multiple units affected. Firefighters are on scene.',
      reporter: 'John Smith',
      timestamp: '30 minutes ago',
      cause: 'Gas leak explosion'
    },
    {
      id: 4,
      image: require('../../../../assets/images/burnhouse.jpg'),
      location: '321 Elm Street, Barangay San Jose',
      progress: 'Under Control',
      description: 'Small fire in garage. Firefighters have contained the situation.',
      reporter: 'Maria Garcia',
      timestamp: '1 hour ago',
      cause: 'Spontaneous combustion of stored materials'
    }
  ];

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
  const [emergencyData, setEmergencyData] = useState({
    cause: '',
    image: null
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

  const handleSubmitEmergency = () => {
    if (!emergencyData.cause) {
      Alert.alert('Error', 'Please write the cause of fire');
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
                     onPress: () => {
             // Simulate API call to report emergency
             setTimeout(() => {
               // Create new report
               const newReport = {
                 id: Date.now(), // Use timestamp as unique ID
                 image: emergencyData.image ? { uri: emergencyData.image } : require('../../../../assets/images/burnhouse.jpg'),
                 location: 'Current Location', // You can integrate with GPS later
                 progress: 'On Going',
                 description: `Emergency reported: ${emergencyData.cause}`,
                 reporter: 'You',
                 timestamp: 'Just now',
                 cause: emergencyData.cause
               };

               // Add to Your Reports
               setYourReports(prevReports => [newReport, ...prevReports]);

               Alert.alert(
                 'Emergency Reported Successfully!',
                 'Emergency services have been notified. Help is on the way. Please stay safe and follow instructions from emergency personnel.',
                 [
                   {
                     text: 'OK',
                     onPress: () => {
                       setShowEmergencyModal(false);
                       setEmergencyData({
                         cause: '',
                         image: null
                       });
                       // Switch to Your Reports tab to show the new report
                       setActiveTab('Your Reports');
                     }
                   }
                 ]
               );
             }, 1000);
           }
        }
      ]
    );
  };

  const openReportModal = (report) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const renderReportCard = (report) => (
    <TouchableOpacity
      key={report.id}
      className="bg-white rounded-lg p-4 mb-4 shadow-sm"
      onPress={() => openReportModal(report)}
      activeOpacity={0.7}
    >
      <Image
        source={report.image}
        className="w-full h-40 rounded-lg mb-3"
        resizeMode="cover"
      />
      
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm text-gray-500">{report.reporter}</Text>
        <Text className="text-sm text-gray-500">{report.timestamp}</Text>
      </View>

      <Text className="text-gray-800 font-semibold text-base mb-2">
        {report.location}
      </Text>

      <View className="flex-row items-center justify-between mb-2">
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: getProgressColor(report.progress) + '20' }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: getProgressColor(report.progress) }}
          >
            {report.progress}
          </Text>
        </View>
      </View>

      <Text className="text-gray-600 text-sm mb-2" numberOfLines={2}>
        {report.description}
      </Text>

      <Text className="text-gray-500 text-xs">
        Cause: {report.cause}
      </Text>
    </TouchableOpacity>
  );

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
        {reports.map(renderReportCard)}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 pt-32">
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
           <View className="bg-white rounded-lg p-6 w-11/12 max-h-96">
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
                   source={selectedReport.image}
                   className="w-full h-48 rounded-lg mb-4"
                   resizeMode="cover"
                 />

                 <View className="mb-3">
                   <Text className="text-gray-600 text-sm">Reporter</Text>
                   <Text className="text-gray-800 font-semibold">{selectedReport.reporter}</Text>
                 </View>

                 <View className="mb-3">
                   <Text className="text-gray-600 text-sm">Location</Text>
                   <Text className="text-gray-800 font-semibold">{selectedReport.location}</Text>
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
                       {selectedReport.progress}
                     </Text>
                   </View>
                 </View>

                 <View className="mb-3">
                   <Text className="text-gray-600 text-sm">Cause of Fire</Text>
                   <Text className="text-gray-800 font-semibold">{selectedReport.cause}</Text>
                 </View>

                 <View className="mb-4">
                   <Text className="text-gray-600 text-sm">Description</Text>
                   <Text className="text-gray-800">{selectedReport.description}</Text>
                 </View>

                 <View className="mb-4">
                   <Text className="text-gray-600 text-sm">Reported</Text>
                   <Text className="text-gray-800">{selectedReport.timestamp}</Text>
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
    </View>
  );
};

export default CStatus;

export const options = {
  headerShown: false,
};
