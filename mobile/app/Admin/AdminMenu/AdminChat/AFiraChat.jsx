import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AChatPage from './AChatPage';

export default function AFiraChat({ onContactSelect }) {
  const [message, setMessage] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts] = useState([
    {
      id: 1,
      name: 'Station 1',
      lastMessage: 'We have 3 units available',
      timestamp: '2 min ago',
      unreadCount: 2,
      status: 'online',
      type: 'station'
    },
    {
      id: 2,
      name: 'Responder Team Alpha',
      lastMessage: 'ETA 5 minutes to scene',
      timestamp: '5 min ago',
      unreadCount: 0,
      status: 'online',
      type: 'responder'
    },
    {
      id: 3,
      name: 'Station 2',
      lastMessage: 'Dispatching backup units',
      timestamp: '10 min ago',
      unreadCount: 1,
      status: 'offline',
      type: 'station'
    },
    {
      id: 4,
      name: 'Emergency Dispatch',
      lastMessage: 'New fire reported at 123 Main St',
      timestamp: '15 min ago',
      unreadCount: 0,
      status: 'online',
      type: 'system'
    }
  ]);

  const [messages, setMessages] = useState({
    1: [
      { id: 1, text: 'Station 1 reporting for duty', sender: 'station', timestamp: '10:30 AM', isRead: true },
      { id: 2, text: 'We have 3 units available', sender: 'station', timestamp: '10:32 AM', isRead: true },
      { id: 3, text: 'Perfect, keep them ready', sender: 'admin', timestamp: '10:33 AM', isRead: true },
      { id: 4, text: 'Any emergency calls?', sender: 'station', timestamp: '10:35 AM', isRead: false }
    ],
    2: [
      { id: 1, text: 'Responder Team Alpha ready', sender: 'responder', timestamp: '10:30 AM', isRead: true },
      { id: 2, text: 'ETA 5 minutes to scene', sender: 'responder', timestamp: '10:32 AM', isRead: true },
      { id: 3, text: 'Good, coordinate with Station 1', sender: 'admin', timestamp: '10:33 AM', isRead: true }
    ],
    3: [
      { id: 1, text: 'Station 2 here', sender: 'station', timestamp: '10:30 AM', isRead: true },
      { id: 2, text: 'Dispatching backup units', sender: 'station', timestamp: '10:32 AM', isRead: false }
    ],
    4: [
      { id: 1, text: 'New fire reported at 123 Main St', sender: 'system', timestamp: '10:30 AM', isRead: true },
      { id: 2, text: 'Sending units to location', sender: 'admin', timestamp: '10:31 AM', isRead: true }
    ]
  });

  const sendMessage = () => {
    if (message.trim() && selectedContact) {
      const newMessage = {
        id: messages[selectedContact.id].length + 1,
        text: message.trim(),
        sender: 'admin',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false
      };
      setMessages({
        ...messages,
        [selectedContact.id]: [...messages[selectedContact.id], newMessage]
      });
      setMessage('');
    }
  };

  const getContactIcon = (type) => {
    switch (type) {
      case 'station':
        return 'business';
      case 'responder':
        return 'shield-checkmark';
      case 'system':
        return 'warning';
      default:
        return 'person';
    }
  };

  const getContactColor = (type) => {
    switch (type) {
      case 'station':
        return 'bg-purple-500';
      case 'responder':
        return 'bg-green-500';
      case 'system':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSenderName = (sender) => {
    switch (sender) {
      case 'admin':
        return 'Admin';
      case 'responder':
        return 'Responder';
      case 'station':
        return 'Station';
      case 'system':
        return 'System';
      default:
        return 'Unknown';
    }
  };

  // Contact List View
  if (!selectedContact) {
    return (
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="p-4 pt-16">
          <View className="items-center justify-center">
            <Text className="text-2xl font-bold text-gray-800">FIRA Chat</Text>
          </View>
        </View>

        {/* Contact List */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {contacts.map((contact) => (
            <TouchableOpacity
              key={contact.id}
              className="flex-row items-center px-4 py-3 border-b border-gray-100 active:bg-gray-50"
              onPress={() => {
                setSelectedContact(contact);
                if (onContactSelect) {
                  onContactSelect(contact);
                }
              }}
            >
              {/* Contact Avatar */}
              <View className={`w-12 h-12 rounded-full ${getContactColor(contact.type)} items-center justify-center mr-3`}>
                <Ionicons name={getContactIcon(contact.type)} size={20} color="white" />
              </View>

              {/* Contact Info */}
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-gray-800">{contact.name}</Text>
                  <Text className="text-xs text-gray-500">{contact.timestamp}</Text>
                </View>
                <Text className="text-sm text-gray-600 mt-1" numberOfLines={1}>
                  {contact.lastMessage}
                </Text>
              </View>

              {/* Status Indicators */}
              <View className="items-end">
                {contact.unreadCount > 0 && (
                  <View className="w-5 h-5 bg-red-500 rounded-full items-center justify-center mb-1">
                    <Text className="text-xs text-white font-bold">{contact.unreadCount}</Text>
                  </View>
                )}
                <View className={`w-2 h-2 rounded-full ${contact.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Individual Chat View
  return (
    <AChatPage 
      contact={selectedContact}
      onBack={() => {
        setSelectedContact(null);
        if (onContactSelect) {
          onContactSelect(null);
        }
      }}
    />
  );
} 