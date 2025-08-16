import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function SNotifications() {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'emergency',
      title: 'Emergency Call Received',
      message: 'Fire incident reported at 456 Oak Avenue. Dispatch units immediately. Priority 1 response.',
      time: '2 minutes ago',
      read: false,
      priority: 'high'
    },
    {
      id: 2,
      type: 'equipment',
      title: 'Equipment Maintenance Due',
      message: 'Fire truck #3 requires scheduled maintenance. Schedule service within 24 hours.',
      time: '30 minutes ago',
      read: false,
      priority: 'medium'
    },
    {
      id: 3,
      type: 'personnel',
      title: 'Staff Schedule Update',
      message: 'Officer Johnson called in sick. Adjust shift assignments for today.',
      time: '1 hour ago',
      read: false,
      priority: 'medium'
    },
    {
      id: 4,
      type: 'inventory',
      title: 'Inventory Alert',
      message: 'Low stock alert: Fire extinguishers running low. Reorder supplies needed.',
      time: '3 hours ago',
      read: true,
      priority: 'medium'
    },
    {
      id: 5,
      type: 'training',
      title: 'Training Session',
      message: 'Monthly safety training scheduled for tomorrow. All station personnel must attend.',
      time: '5 hours ago',
      read: true,
      priority: 'low'
    },
    {
      id: 6,
      type: 'coordination',
      title: 'Inter-Station Coordination',
      message: 'Meeting with Station 2 tomorrow at 10:00 AM to discuss response protocols.',
      time: '1 day ago',
      read: true,
      priority: 'low'
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
      case 'equipment':
        return { name: 'local-fire-department', color: '#dc2626', bg: '#fef2f2' };
      case 'personnel':
        return { name: 'people', color: '#8b5cf6', bg: '#f3f4f6' };
      case 'inventory':
        return { name: 'inventory', color: '#3b82f6', bg: '#eff6ff' };
      case 'training':
        return { name: 'school', color: '#10b981', bg: '#f0fdf4' };
      case 'coordination':
        return { name: 'sync', color: '#f59e0b', bg: '#fffbeb' };
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
            <Text className="text-gray-700 font-medium">Equipment</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg mr-2">
            <Text className="text-gray-700 font-medium">Personnel</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-gray-200 px-4 py-2 rounded-lg">
            <Text className="text-gray-700 font-medium">Operations</Text>
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
            Station operations are running smoothly. We'll alert you when action is needed.
          </Text>
        </View>
      )}
    </View>
  );
} 