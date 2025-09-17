import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';
import { useAuth } from '../../../config/AuthContext';
import RChatPage from './RChatPage';

export default function RFiraChat() {
  const { userData } = useAuth();
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [unreadContacts, setUnreadContacts] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [currentResponderId, setCurrentResponderId] = useState(null);
  const [currentStationId, setCurrentStationId] = useState(null);

  // Get current responder data
  useEffect(() => {
    if (userData) {
      setCurrentResponderId(userData.uid);
      setCurrentStationId(userData.stationId);
      console.log('🔍 Current responder data:', userData);
    }
  }, [userData]);

  // Fetch contacts (admin, station, other responders)
  useEffect(() => {
    const fetchContacts = async () => {
      if (!currentResponderId || !currentStationId) return;

      try {
        setIsLoading(true);
        console.log('🔍 Fetching contacts for responder:', currentResponderId);

        // Fetch admin users
        const { data: adminUsers, error: adminError } = await supabase
          .from('admin_users')
          .select('*');

        // Fetch station users (current station)
        const { data: stationUsers, error: stationError } = await supabase
          .from('station_users')
          .select('*')
          .eq('id', currentStationId);

        // Fetch other responders from the same station
        const { data: responderUsers, error: responderError } = await supabase
          .from('responders')
          .select('*')
          .eq('station_id', currentStationId)
          .neq('id', currentResponderId); // Exclude self

        const allContactsList = [];

        // Add admin users
        if (adminUsers && !adminError) {
          adminUsers.forEach(admin => {
            allContactsList.push({
              id: admin.id,
              name: `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Admin',
              email: admin.email,
              type: 'admin',
              avatar: (admin.first_name || admin.last_name || 'A')[0].toUpperCase(),
              lastMessage: '',
              lastMessageTime: null,
              unreadCount: 0,
              status: 'online'
            });
          });
        }

        // Add station users
        if (stationUsers && !stationError) {
          stationUsers.forEach(station => {
            allContactsList.push({
              id: station.id,
              name: station.station_name || station.name || 'Station',
              email: station.email,
              type: 'station',
              avatar: (station.station_name || station.name || 'S')[0].toUpperCase(),
              lastMessage: '',
              lastMessageTime: null,
              unreadCount: 0,
              status: 'online'
            });
          });
        }

        // Add other responders
        if (responderUsers && !responderError) {
          responderUsers.forEach(responder => {
            allContactsList.push({
              id: responder.id,
              name: `${responder.first_name || ''} ${responder.last_name || ''}`.trim() || 'Responder',
              email: responder.email,
              type: 'responder',
              avatar: (responder.first_name || responder.last_name || 'R')[0].toUpperCase(),
              lastMessage: '',
              lastMessageTime: null,
              unreadCount: 0,
              status: 'online'
            });
          });
        }

        console.log('✅ Contacts fetched:', allContactsList);
        setAllContacts(allContactsList);
        setContacts(allContactsList);
        setFilteredContacts(allContactsList);

      } catch (error) {
        console.error('❌ Error fetching contacts:', error);
        Alert.alert('Error', 'Failed to load contacts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContacts();
  }, [currentResponderId, currentStationId]);

  // Fetch messages when contacts are loaded
  useEffect(() => {
    if (allContacts.length > 0) {
      fetchMessages();
    }
  }, [currentResponderId, allContacts.length]);

  // Real-time listener for new messages and updates
  useEffect(() => {
    if (!currentResponderId) return;

    const channel = supabase
      .channel(`responder-messages:${currentResponderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentResponderId}`
      }, (payload) => {
        console.log('🔔 New message received:', payload);
        // Refresh messages
        fetchMessages();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentResponderId}`
      }, (payload) => {
        console.log('🔔 Message updated:', payload);
        // Refresh messages when read status changes
        fetchMessages();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentResponderId]);

  // Function to refresh messages (moved outside useEffect for reuse)
  const fetchMessages = async () => {
    if (!currentResponderId || allContacts.length === 0) return;

    try {
      console.log('🔍 Fetching messages for responder:', currentResponderId);
      
      // Fetch unread messages
      const { data: unreadMessages, error: unreadError } = await supabase
        .from('messages')
        .select('*')
        .eq('receiver_id', currentResponderId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (unreadError) {
        console.error('Error fetching unread messages:', unreadError);
      }

      // Fetch last messages for each contact
      const lastMessages = {};
      for (const contact of allContacts) {
        const { data: lastMessage, error: lastError } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${currentResponderId},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${currentResponderId})`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!lastError && lastMessage && lastMessage.length > 0) {
          lastMessages[contact.id] = lastMessage[0];
        }
      }

      // Group unread messages by sender
      const unreadBySender = {};
      if (unreadMessages) {
        unreadMessages.forEach(message => {
          const senderId = message.sender_id;
          if (!unreadBySender[senderId]) {
            unreadBySender[senderId] = {
              count: 0,
              lastMessage: message.text || '',
              lastMessageTime: message.created_at
            };
          }
          unreadBySender[senderId].count++;
        });
      }

      // Update contacts with unread count and last message
      const updatedContacts = allContacts.map(contact => {
        const unreadInfo = unreadBySender[contact.id];
        const lastMessage = lastMessages[contact.id];
        
        let displayMessage = 'No messages yet';
        let messageTime = null;
        
        if (lastMessage) {
          messageTime = lastMessage.created_at;
          if (lastMessage.sender_id === currentResponderId) {
            displayMessage = `You: ${lastMessage.text}`;
          } else {
            displayMessage = lastMessage.text;
          }
        }

        return {
          ...contact,
          unreadCount: unreadInfo ? unreadInfo.count : 0,
          lastMessage: displayMessage,
          lastMessageTime: messageTime || contact.lastMessageTime
        };
      });

      // Sort contacts: unread messages first, then by last message time
      const sortedContacts = updatedContacts.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
        }
        return 0;
      });

      setContacts(sortedContacts);
      setFilteredContacts(sortedContacts);
      
      // Set unread contacts
      const unreadList = sortedContacts.filter(contact => contact.unreadCount > 0);
      setUnreadContacts(unreadList);

    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Filter contacts based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const getContactIcon = (type) => {
    switch (type) {
      case 'admin':
        return 'shield';
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
      case 'admin':
        return 'bg-blue-500';
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
        return 'You';
      case 'station':
        return 'Station';
      case 'system':
        return 'System';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const formatLastMessage = (message) => {
    if (!message) return 'No messages yet';
    if (message.length > 50) {
      return message.substring(0, 50) + '...';
    }
    return message;
  };

  // Contact List View
  if (!selectedContact) {
    return (
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="p-4 pt-16">
          <View className="items-center justify-center">
            <Text className="text-2xl font-bold text-gray-800">FIRA Chat</Text>
            <Text className="text-sm text-gray-500 mt-1">Emergency Communication</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="px-4 pb-3">
          <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search contacts..."
              className="flex-1 ml-2 text-base text-gray-800"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Contact List */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View className="flex-1 items-center justify-center py-8">
              <Text className="text-gray-500">Loading contacts...</Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View className="flex-1 items-center justify-center py-8">
              <Text className="text-gray-500">No contacts found</Text>
            </View>
          ) : (
            filteredContacts.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                className={`flex-row items-center px-4 py-3 border-b border-gray-100 active:bg-gray-50 ${
                  contact.unreadCount > 0 ? 'bg-red-50' : ''
                }`}
                onPress={() => setSelectedContact(contact)}
              >
                {/* Contact Avatar */}
                <View className={`w-12 h-12 rounded-full ${getContactColor(contact.type)} items-center justify-center mr-3`}>
                  <Ionicons name={getContactIcon(contact.type)} size={20} color="white" />
                </View>

                {/* Contact Info */}
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className={`font-semibold ${contact.unreadCount > 0 ? 'text-gray-900' : 'text-gray-800'}`}>
                      {contact.name}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {formatTime(contact.lastMessageTime)}
                    </Text>
                  </View>
                  <Text className={`text-sm mt-1 ${contact.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-600'}`} numberOfLines={1}>
                    {formatLastMessage(contact.lastMessage)}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-1">
                    {contact.type === 'admin' ? 'Admin' : contact.type === 'responder' ? 'Responder' : 'Station'}
                  </Text>
                </View>

                {/* Status Indicators */}
                <View className="items-end">
                  {contact.unreadCount > 0 && (
                    <View className="w-6 h-6 bg-red-500 rounded-full items-center justify-center mb-1">
                      <Text className="text-xs text-white font-bold">
                        {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                      </Text>
                    </View>
                  )}
                  <View className={`w-2 h-2 rounded-full ${contact.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // Individual Chat View
  return (
    <RChatPage 
      contact={selectedContact}
      onBack={() => {
        setSelectedContact(null);
        // Refresh messages to update unread counts
        fetchMessages();
      }}
    />
  );
}
