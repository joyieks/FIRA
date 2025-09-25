import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Image, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../../config/AuthContext';
import { supabase } from '../../../config/supabase';

export default function RStatus() {
  const { userData } = useAuth();
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showFullReport, setShowFullReport] = useState(false);


  // Load notifications and set current assignment
  const loadNotifications = async () => {
    if (!userData?.id) {
      return;
    }

    try {
      // Load unread notifications for this responder
      const { data: notificationData, error } = await supabase
        .from('responder_notifications')
        .select('*')
        .eq('responder_id', userData.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading notifications:', error);
        return;
      }

      setNotifications(notificationData || []);

      // Set the most recent notification as current assignment
      if (notificationData && notificationData.length > 0) {
        const latestNotification = notificationData[0];
        
        // Parse the message to extract fire report details
        const messageLines = latestNotification.message.split('\n');
        const location = messageLines[1]?.replace('📍 Location: ', '') || 'Location Unknown';
        const alarmLevel = messageLines[2]?.replace('🔥 Alarm Level: ', '') || 'Unknown';
        const aiDetection = messageLines[3]?.replace('📊 AI Detection: ', '') || 'Unknown';
        const reportedTime = messageLines[4]?.replace('⏰ Reported: ', '') || 'Unknown';
        const cause = messageLines[5]?.replace('📝 Cause: ', '') || 'Not specified';
        
        // Fetch fire report details to get the image URL and status
        let imageUrl = null;
        let fireReportStatus = 'Unknown';
        try {
          const response = await fetch('https://fire-detection-api-production-f543.up.railway.app/get_reports');
          if (response.ok) {
            const reports = await response.json();
            const fireReport = reports.find(report => String(report.id) === String(latestNotification.fire_report_id));
            if (fireReport) {
              imageUrl = fireReport.image_url || null;
              fireReportStatus = fireReport.status || 'Unknown';
            }
          }
        } catch (error) {
          console.log('Could not fetch fire report details:', error);
        }
        
        setCurrentAssignment({
          id: latestNotification.id,
          title: latestNotification.title,
          location: location,
          description: latestNotification.message,
          priority: latestNotification.priority,
          createdAt: latestNotification.created_at,
          fireReportId: latestNotification.fire_report_id,
          alarmLevel: alarmLevel,
          aiDetection: aiDetection,
          reportedTime: reportedTime,
          cause: cause,
          imageUrl: imageUrl,
          status: fireReportStatus
        });
      } else {
        setCurrentAssignment(null);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
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


  const markNotificationAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('responder_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'accept':
        Alert.alert('Assignment Accepted', 'You have accepted the current assignment.');
        // Mark the current notification as read
        if (currentAssignment?.id) {
          markNotificationAsRead(currentAssignment.id);
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



      {/* Current Assignment */}
      {currentAssignment ? (
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm mb-6">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-lg font-semibold text-gray-800">Current Assignment</Text>
                    <View 
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: getFireReportStatusBgColor(currentAssignment.status) }}
                    >
                      <Text 
                        className="text-xs font-bold"
                        style={{ color: getFireReportStatusColor(currentAssignment.status) }}
                      >
                        {currentAssignment.status?.toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  </View>
          
          {/* Compact Assignment Card */}
          <TouchableOpacity 
            className="bg-red-50 p-3 rounded-lg"
            onPress={() => setShowFullReport(true)}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-red-800 font-bold text-base" numberOfLines={1}>
                  {currentAssignment.title}
                </Text>
                <Text className="text-red-700 text-sm mt-1" numberOfLines={1}>
                  📍 {currentAssignment.location}
                </Text>
                <Text className="text-red-600 text-xs mt-1" numberOfLines={1}>
                  🔥 {currentAssignment.alarmLevel} • 📊 {currentAssignment.aiDetection}
                </Text>
                {currentAssignment.createdAt && (
                  <Text className="text-red-500 text-xs mt-1">
                    Received: {new Date(currentAssignment.createdAt).toLocaleString()}
                  </Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#dc2626" />
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm mb-6">
          <Text className="text-lg font-semibold text-gray-800 mb-3">Current Assignment</Text>
          <View className="bg-gray-50 p-6 rounded-lg items-center">
            <MaterialIcons name="assignment" size={48} color="#9ca3af" />
            <Text className="text-gray-500 text-center mt-2">No active assignments</Text>
            <Text className="text-gray-400 text-sm text-center">You'll be notified when a new assignment comes in</Text>
          </View>
        </View>
      )}

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
            {currentAssignment && (
              <View className="space-y-4">
                        {/* Report Title */}
                        <View className="bg-red-50 p-4 rounded-lg">
                          <Text className="text-red-800 font-bold text-xl mb-2">
                            {currentAssignment.title}
                          </Text>
                          <View 
                            className="px-3 py-1 rounded-full self-start mb-2"
                            style={{ backgroundColor: getFireReportStatusBgColor(currentAssignment.status) }}
                          >
                            <Text 
                              className="text-sm font-bold"
                              style={{ color: getFireReportStatusColor(currentAssignment.status) }}
                            >
                              STATUS: {currentAssignment.status?.toUpperCase() || 'UNKNOWN'}
                            </Text>
                          </View>
                        </View>

                {/* Location */}
                <View className="bg-gray-50 p-4 rounded-lg">
                  <Text className="text-gray-600 text-sm font-semibold mb-1">📍 Location</Text>
                  <Text className="text-gray-800 text-base">{currentAssignment.location}</Text>
                </View>

                {/* Alarm Level */}
                <View className="bg-orange-50 p-4 rounded-lg">
                  <Text className="text-orange-600 text-sm font-semibold mb-1">🔥 Alarm Level</Text>
                  <Text className="text-orange-800 text-base font-medium">{currentAssignment.alarmLevel}</Text>
                </View>

                {/* AI Detection */}
                <View className="bg-blue-50 p-4 rounded-lg">
                  <Text className="text-blue-600 text-sm font-semibold mb-1">📊 AI Detection</Text>
                  <Text className="text-blue-800 text-base font-medium">{currentAssignment.aiDetection}</Text>
                </View>

                {/* Cause */}
                <View className="bg-gray-50 p-4 rounded-lg">
                  <Text className="text-gray-600 text-sm font-semibold mb-1">📝 Cause</Text>
                  <Text className="text-gray-800 text-base">{currentAssignment.cause}</Text>
                </View>

                {/* Reported Time */}
                <View className="bg-gray-50 p-4 rounded-lg">
                  <Text className="text-gray-600 text-sm font-semibold mb-1">⏰ Reported</Text>
                  <Text className="text-gray-800 text-base">{currentAssignment.reportedTime}</Text>
                </View>

                {/* Received Time */}
                <View className="bg-gray-50 p-4 rounded-lg">
                  <Text className="text-gray-600 text-sm font-semibold mb-1">📨 Received</Text>
                  <Text className="text-gray-800 text-base">
                    {new Date(currentAssignment.createdAt).toLocaleString()}
                  </Text>
                </View>

                {/* Fire Report Image */}
                <View className="bg-gray-50 p-4 rounded-lg">
                  <Text className="text-gray-600 text-sm font-semibold mb-2">📷 Fire Report Image</Text>
                  {currentAssignment.imageUrl ? (
                    <Image
                      source={{ uri: currentAssignment.imageUrl }}
                      className="w-full h-48 rounded-lg"
                      resizeMode="cover"
                      onError={() => {
                        console.log('Error loading image:', currentAssignment.imageUrl);
                      }}
                    />
                  ) : (
                    <View className="bg-gray-200 h-48 rounded-lg items-center justify-center">
                      <MaterialIcons name="image" size={48} color="#9ca3af" />
                      <Text className="text-gray-500 text-sm mt-2">No image available</Text>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View className="flex-row space-x-3 mt-6">
                  <TouchableOpacity
                    className="bg-red-600 flex-1 py-3 rounded-lg"
                    onPress={() => {
                      setShowFullReport(false);
                      handleQuickAction('accept');
                    }}
                  >
                    <Text className="text-white text-center font-bold text-base">Accept Assignment</Text>
                  </TouchableOpacity>
                  
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
