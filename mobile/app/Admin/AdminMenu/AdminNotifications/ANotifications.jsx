import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function ANotifications() {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'emergency',
      title: 'Emergency Response Required',
      message: 'Multiple fire incidents reported in District 3. Coordinate with all stations immediately.',
      time: '5 minutes ago',
      read: false,
      priority: 'high'
    },
    {
      id: 2,
      type: 'system',
      title: 'System Maintenance',
      message: 'Scheduled maintenance will begin in 30 minutes. System will be offline for 2 hours.',
      time: '1 hour ago',
      read: false,
      priority: 'high'
    },
    {
      id: 3,
      type: 'user',
      title: 'New User Registration',
      message: '5 new citizen accounts registered in the last hour. Review pending verifications.',
      time: '2 hours ago',
      read: false,
      priority: 'medium'
    },
    {
      id: 4,
      type: 'coordination',
      title: 'Station Status Update',
      message: 'Station 2 is now back online. All units are operational and ready for deployment.',
      time: '3 hours ago',
      read: true,
      priority: 'medium'
    },
    {
      id: 5,
      type: 'report',
      title: 'Monthly Report Ready',
      message: 'Emergency response statistics for March 2024 are ready for review and approval.',
      time: '1 day ago',
      read: true,
      priority: 'low'
    },
    {
      id: 6,
      type: 'alert',
      title: 'Equipment Alert',
      message: 'Fire truck maintenance due for Station 1. Schedule inspection within 48 hours.',
      time: '2 days ago',
      read: true,
      priority: 'medium'
    }
  ]);

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'emergency':
        return { name: 'emergency', color: '#ef4444', bg: '#fef2f2' };
      case 'system':
        return { name: 'build', color: '#3b82f6', bg: '#eff6ff' };
      case 'user':
        return { name: 'people', color: '#8b5cf6', bg: '#f3f4f6' };
      case 'coordination':
        return { name: 'sync', color: '#10b981', bg: '#f0fdf4' };
      case 'report':
        return { name: 'assessment', color: '#f59e0b', bg: '#fffbeb' };
      case 'alert':
        return { name: 'warning', color: '#dc2626', bg: '#fef2f2' };
      default:
        return { name: 'notifications', color: '#6b7280', bg: '#f9fafb' };
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Filter Tabs */}
      <View className="bg-white border-b border-gray-200 pt-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-2">
          <TouchableOpacity className="bg-fire px-4 py-2 rounded-lg mr-2">
            <Text className="text-white font-medium">All</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Emergency</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">System</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Users</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg">
            <Text className="text-gray-700 font-medium">Reports</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Notifications List */}
      <ScrollView className="flex-1 px-4 pt-4">
        {notifications.map((notification) => {
          const icon = getNotificationIcon(notification.type);
          const priorityColor = getPriorityColor(notification.priority);
          
          return (
            <TouchableOpacity
              key={notification.id}
              className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
                notification.read ? 'opacity-75' : ''
              }`}
              style={{ borderLeftColor: priorityColor }}
              onPress={() => markAsRead(notification.id)}
            >
              <View className="flex-row items-start">
                {/* Icon */}
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: icon.bg }}
                >
                  <MaterialIcons name={icon.name} size={24} color={icon.color} />
                </View>

                {/* Content */}
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="font-bold text-gray-800 text-base">
                      {notification.title}
                    </Text>
                    {!notification.read && (
                      <View className="w-2 h-2 bg-fire rounded-full" />
                    )}
                  </View>
                  
                  <Text className="text-gray-600 text-sm mb-2 leading-5">
                    {notification.message}
                  </Text>
                  
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-400 text-xs">
                      {notification.time}
                    </Text>
                    <View className="flex-row items-center">
                      {notification.priority === 'high' && (
                        <View className="bg-red-100 px-2 py-1 rounded mr-2">
                          <Text className="text-red-600 text-xs font-medium">URGENT</Text>
                        </View>
                      )}
                      <MaterialIcons 
                        name="chevron-right" 
                        size={16} 
                        color="#9ca3af" 
                      />
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Empty State */}
      {notifications.length === 0 && (
        <View className="flex-1 items-center justify-center px-8">
          <MaterialIcons name="notifications-off" size={64} color="#9ca3af" />
          <Text className="text-xl font-bold text-gray-600 mt-4 mb-2">
            No Notifications
          </Text>
          <Text className="text-gray-500 text-center">
            All systems are running smoothly. We'll alert you when action is needed.
          </Text>
        </View>
      )}
    </View>
  );
} 