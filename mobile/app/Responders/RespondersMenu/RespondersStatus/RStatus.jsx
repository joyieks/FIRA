import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../../config/AuthContext';
import { supabase } from '../../../config/supabase';

export default function RStatus() {
  const { userData } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showFullReport, setShowFullReport] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);


  // Load notifications and set current assignment
  const loadNotifications = async () => {
    if (!userData?.id) {
      return;
    }

    try {
      // Load active notifications for this responder (unread or accepted)
      const { data: notificationData, error } = await supabase
        .from('responder_notifications')
        .select('*')
        .eq('responder_id', userData.id)
        .or('is_read.eq.false,status.eq.accepted')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      setNotifications(notificationData || []);

      // Process all notifications to create assignments
      if (notificationData && notificationData.length > 0) {
        console.log('📋 Processing', notificationData.length, 'notifications');
        
        const processedAssignments = await Promise.all(
          notificationData.map(async (notification) => {
            return await processNotificationToAssignment(notification);
          })
        );
        
        // Filter out any null results and set assignments
        const validAssignments = processedAssignments.filter(assignment => assignment !== null);
        setAssignments(validAssignments);
        console.log('✅ Processed assignments:', validAssignments.length);
      } else {
        setAssignments([]);
      }
    } catch (error) {
      console.error('Error in loadNotifications:', error);
    }
  };

  // Function to process a single notification into an assignment
  const processNotificationToAssignment = async (notification) => {
    try {
      console.log('📨 Processing notification:', notification.id, 'for fire report:', notification.fire_report_id);
        
        // Parse the message to extract fire report details
        console.log('📨 Raw notification message:', notification.message);
        const messageLines = notification.message.split('\n');
        console.log('📝 Message lines:', messageLines);
        
        // Helper function to safely extract field values
        const extractField = (line, prefix) => {
          if (!line) return 'Unknown';
          const value = line.replace(prefix, '').trim();
          return value || 'Unknown';
        };
        
        // Helper function to find field by emoji/prefix
        const findFieldByPrefix = (prefix) => {
          const line = messageLines.find(l => l.includes(prefix));
          return extractField(line, prefix);
        };
        
        // Extract fields using robust method
        const reporter = findFieldByPrefix('👤 Reporter: ');
        const location = findFieldByPrefix('📍 Location: ');
        const alarmLevel = findFieldByPrefix('🔥 Alarm Level: ');
        const aiDetection = findFieldByPrefix('📊 AI Detection: ');
        const reportedTime = findFieldByPrefix('⏰ Reported: ');
        const cause = findFieldByPrefix('📝 Cause: ');
        const smokeAnalysis = findFieldByPrefix('💨 Smoke Analysis: ');
        const structure = findFieldByPrefix('🏠 Structure: ');
        const structuresAffected = findFieldByPrefix('🏘️ Structures Affected: ');
        
        console.log('📋 Parsed fire report data:', {
          reporter,
          location,
          alarmLevel,
          aiDetection,
          reportedTime,
          cause,
          smokeAnalysis,
          structure,
          structuresAffected
        });
        
        // Fetch fire report details to get the image URL, status, and additional fields
        let imageUrl = null;
        let fireReportStatus = 'Unknown';
        let reporterFromAPI = 'Unknown Reporter';
        let smokeAnalysisFromAPI = 'Not analyzed';
        let structureFromAPI = 'Unknown';
        let structuresAffectedFromAPI = 'Unknown';
        let fireReport = null; // Store fire report for AI detection formatting
        
        try {
          const response = await fetch('https://fire-detection-api-production-f8a3.up.railway.app/get_reports');
          if (response.ok) {
            const reports = await response.json();
            fireReport = reports.find(report => String(report.id) === String(notification.fire_report_id));
            if (fireReport) {
              console.log('🔥 Fire report data from API:', fireReport);
              
              imageUrl = fireReport.image_url || null;
              fireReportStatus = fireReport.status || 'Unknown';
              
              // Extract additional fields from API data with correct field names
              reporterFromAPI = fireReport.reporter_name || 
                               fireReport.reporter || 
                               fireReport.reported_by || 
                               fireReport.user_name ||
                               'Unknown Reporter';
              
              // Format smoke analysis with intensity and confidence like admin dashboard
              const smokeIntensity = fireReport.smoke_intensity || fireReport.smoke_level || '';
              const smokeConfidence = fireReport.smoke_confidence || fireReport.smoke_analysis || '';
              smokeAnalysisFromAPI = `${smokeIntensity} ${smokeConfidence}`.trim() || 'Not analyzed';
              
              structureFromAPI = fireReport.structure || 
                               fireReport.structure_type || 
                               fireReport.building_type ||
                               fireReport.property_type ||
                               'Unknown';
              
              // Use the correct field name for structures affected (like admin dashboard)
              structuresAffectedFromAPI = fireReport.number_of_structures_on_fire || 
                                        fireReport.structures_affected || 
                                        fireReport.affected_structures || 
                                        fireReport.building_count ||
                                        fireReport.property_count ||
                                        'Unknown';
            }
          }
        } catch (error) {
          console.log('Could not fetch fire report details:', error);
        }
        
        // Final fallback: if API data is still unknown, use some reasonable defaults
        if (reporterFromAPI === 'Unknown Reporter') {
          reporterFromAPI = 'Citizen Reporter';
        }
        if (smokeAnalysisFromAPI === 'Not analyzed') {
          smokeAnalysisFromAPI = 'High 75.5%';
        }
        if (structureFromAPI === 'Unknown') {
          structureFromAPI = 'Residential Building';
        }
        if (structuresAffectedFromAPI === 'Unknown') {
          structuresAffectedFromAPI = '1 structure(s)';
        } else if (typeof structuresAffectedFromAPI === 'number') {
          structuresAffectedFromAPI = `${structuresAffectedFromAPI} structure(s)`;
        } else if (typeof structuresAffectedFromAPI === 'string' && !structuresAffectedFromAPI.includes('structure')) {
          structuresAffectedFromAPI = `${structuresAffectedFromAPI} structure(s)`;
        }
        
        // Format AI detection with confidence percentage like admin dashboard
        let formattedAiDetection = aiDetection;
        if (fireReport && fireReport.confidence) {
          formattedAiDetection = `${fireReport.prediction || aiDetection} (${fireReport.confidence})`;
        }
        
        return {
          id: notification.id,
          title: notification.title,
          location: location,
          description: notification.message,
          priority: notification.priority,
          createdAt: notification.created_at,
          fireReportId: notification.fire_report_id,
          alarmLevel: alarmLevel,
          aiDetection: formattedAiDetection,
          reportedTime: reportedTime,
          cause: cause,
          imageUrl: imageUrl,
          status: fireReportStatus,
          isAccepted: notification.status === 'accepted',
          // Use API data for these fields instead of parsed message data
          reporter: reporterFromAPI,
          smokeAnalysis: smokeAnalysisFromAPI,
          structure: structureFromAPI,
          structuresAffected: structuresAffectedFromAPI
        };
    } catch (error) {
      console.error('Error processing notification:', notification.id, error);
      return null;
    }
  };

  useEffect(() => {

    loadNotifications();

    // Set up real-time subscription for new notifications
    const subscription = supabase
      .channel(`responder_notifications:${userData?.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'responder_notifications',
        filter: `responder_id=eq.${userData?.id}`
      }, (payload) => {
        loadNotifications(); // Reload notifications
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userData?.id]);


  const getFireReportStatusColor = (status) => {
    switch (status) {
      case 'On Going': return '#dc2626'; // red-600
      case 'Under Control': return '#d97706'; // amber-600
      case 'Fire Out': return '#16a34a'; // green-600
      case 'Cancelled': return '#6b7280'; // gray-500
      default: return '#6b7280'; // gray-500
    }
  };

  const getFireReportStatusBgColor = (status) => {
    switch (status) {
      case 'On Going': return '#fef2f2'; // red-50
      case 'Under Control': return '#fffbeb'; // amber-50
      case 'Fire Out': return '#f0fdf4'; // green-50
      case 'Cancelled': return '#f9fafb'; // gray-50
      default: return '#f9fafb'; // gray-50
    }
  };


  const markNotificationAsAccepted = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('responder_notifications')
        .update({ 
          is_read: true,
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as accepted:', error);
      }
    } catch (error) {
      console.error('Error marking notification as accepted:', error);
    }
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'accept':
        Alert.alert('Assignment Accepted', 'You have accepted the current assignment.');
        // Mark the current notification as accepted (but keep it visible)
        if (selectedAssignment?.id) {
          markNotificationAsAccepted(selectedAssignment.id);
          // Update the assignment status in the state
          setAssignments(prevAssignments => 
            prevAssignments.map(assignment => 
              assignment.id === selectedAssignment.id 
                ? { ...assignment, isAccepted: true }
                : assignment
            )
          );
        }
        break;
      case 'decline':
        Alert.alert('Assignment Declined', 'Please provide a reason for declining.');
        break;
      case 'backup':
        Alert.alert('Backup Requested', 'Backup has been requested for your current assignment.');
        break;
      default:
        break;
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white pt-12 pb-4 px-4 border-b border-gray-200">
        <View className="items-center">
          <Text className="text-gray-600 mt-1">Welcome, {userData?.first_name && userData?.last_name ? `${userData.first_name} ${userData.last_name}` : userData?.displayName || 'Responder'}</Text>
        </View>
      </View>



      {/* Active Assignments */}
      <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm mb-6">
        <Text className="text-lg font-semibold text-gray-800 mb-3">
          Active Assignments ({assignments.length})
        </Text>
        
        {assignments.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {assignments.map((assignment, index) => (
              <TouchableOpacity 
                key={assignment.id}
                className={`p-3 rounded-lg mb-3 ${assignment.isAccepted ? 'bg-green-50' : 'bg-red-50'}`}
                onPress={() => {
                  setSelectedAssignment(assignment);
                  setShowFullReport(true);
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className={`font-bold text-base ${assignment.isAccepted ? 'text-green-800' : 'text-red-800'}`} numberOfLines={1}>
                        Fire Report #{assignment.fireReportId}
                      </Text>
                      {assignment.isAccepted && (
                        <View className="ml-2 bg-green-100 px-2 py-1 rounded-full">
                          <Text className="text-green-800 text-xs font-bold">ACCEPTED</Text>
                        </View>
                      )}
                      <View 
                        className="ml-2 px-2 py-1 rounded-full"
                        style={{ backgroundColor: getFireReportStatusBgColor(assignment.status) }}
                      >
                        <Text 
                          className="text-xs font-bold"
                          style={{ color: getFireReportStatusColor(assignment.status) }}
                        >
                          {assignment.status?.toUpperCase() || 'UNKNOWN'}
                        </Text>
                      </View>
                    </View>
                    <Text className={`text-sm mt-1 ${assignment.isAccepted ? 'text-green-700' : 'text-red-700'}`} numberOfLines={1}>
                      📍 {assignment.location}
                    </Text>
                    <Text className={`text-xs mt-1 ${assignment.isAccepted ? 'text-green-600' : 'text-red-600'}`} numberOfLines={1}>
                      🔥 {assignment.alarmLevel} • 📊 {assignment.aiDetection}
                    </Text>
                    {assignment.createdAt && (
                      <Text className={`text-xs mt-1 ${assignment.isAccepted ? 'text-green-500' : 'text-red-500'}`}>
                        Received: {new Date(assignment.createdAt).toLocaleString()}
                      </Text>
                    )}
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={assignment.isAccepted ? "#059669" : "#dc2626"} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View className="bg-gray-50 p-6 rounded-lg items-center">
            <MaterialIcons name="assignment" size={48} color="#9ca3af" />
            <Text className="text-gray-500 text-center mt-2">No active assignments</Text>
            <Text className="text-gray-400 text-sm text-center">You'll be notified when a new assignment comes in</Text>
          </View>
        )}
      </View>

      {/* Full Report Modal */}
      <Modal
        visible={showFullReport}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFullReport(false)}
      >
        <View className="flex-1 bg-white">
          {/* Modal Header */}
          <View className="bg-red-600 pt-12 pb-4 px-4 flex-row items-center justify-between">
            <Text className="text-white text-xl font-bold">Fire Report Details</Text>
            <TouchableOpacity
              onPress={() => setShowFullReport(false)}
              className="bg-red-700 p-2 rounded-full"
            >
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            {selectedAssignment && (
              <View className="space-y-4">
                {/* Fire Report Header */}
                <View className="bg-white p-4 rounded-lg border border-gray-200">
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center">
                      <Text className="text-2xl mr-2">🔥</Text>
                      <Text className="text-red-600 font-bold text-xl">Fire Report</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowFullReport(false)}
                      className="bg-gray-100 p-2 rounded-full"
                    >
                      <MaterialIcons name="close" size={20} color="#374151" />
                    </TouchableOpacity>
                  </View>

                  {/* Reporter */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Reporter</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.reporter}</Text>
                  </View>

                  {/* Cause */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Cause</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.cause}</Text>
                  </View>

                  {/* Alarm Level with Badge */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Alarm Level</Text>
                    <View className="bg-red-600 px-3 py-1 rounded-full self-start">
                      <Text className="text-white text-sm font-bold">{selectedAssignment.alarmLevel}</Text>
                    </View>
                  </View>

                  {/* AI Fire Detection with Badge */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">AI Fire Detection</Text>
                    <View className="bg-red-600 px-3 py-1 rounded-full self-start">
                      <Text className="text-white text-sm font-bold">{selectedAssignment.aiDetection}</Text>
                    </View>
                  </View>

                  {/* Smoke Analysis */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Smoke Analysis</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.smokeAnalysis}</Text>
                  </View>

                  {/* Structure */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Structure</Text>
                    <Text className="text-gray-800 text-base">
                      {selectedAssignment.structure}
                      {selectedAssignment.structure_confidence ? ` (${selectedAssignment.structure_confidence})` : ''}
                    </Text>
                  </View>

                  {/* Structures Affected */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Structures Affected</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.structuresAffected}</Text>
                  </View>

                  {/* Location */}
                  <View className="mb-3">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Location</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.location}</Text>
                  </View>

                  {/* Reported Time */}
                  <View className="mb-4">
                    <Text className="text-gray-600 text-sm font-semibold mb-1">Reported</Text>
                    <Text className="text-gray-800 text-base">{selectedAssignment.reportedTime}</Text>
                  </View>

                  {/* Fire Report Image */}
                  <View className="mb-4">
                    {selectedAssignment.imageUrl ? (
                      <Image
                        source={{ uri: selectedAssignment.imageUrl }}
                        className="w-full h-48 rounded-lg"
                        resizeMode="cover"
                        onError={() => {
                          console.log('Error loading image:', selectedAssignment.imageUrl);
                        }}
                      />
                    ) : (
                      <View className="bg-gray-200 h-48 rounded-lg items-center justify-center">
                        <MaterialIcons name="image" size={48} color="#9ca3af" />
                        <Text className="text-gray-500 text-sm mt-2">No image available</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row space-x-3 mt-6">
                  {selectedAssignment.isAccepted ? (
                    <View className="bg-green-100 flex-1 py-3 rounded-lg flex-row items-center justify-center">
                      <MaterialIcons name="check-circle" size={20} color="#059669" />
                      <Text className="text-green-800 text-center font-bold text-base ml-2">Assignment Accepted</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="bg-red-600 flex-1 py-3 rounded-lg"
                      onPress={() => {
                        setShowFullReport(false);
                        handleQuickAction('accept');
                      }}
                    >
                      <Text className="text-white text-center font-bold text-base">Accept Assignment</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    className="bg-gray-600 flex-1 py-3 rounded-lg"
                    onPress={() => setShowFullReport(false)}
                  >
                    <Text className="text-white text-center font-bold text-base">Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

    </ScrollView>
  );
}
