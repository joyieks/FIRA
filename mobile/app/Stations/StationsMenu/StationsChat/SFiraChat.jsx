import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../config/supabase';
import SChatPage from './SChatPage';

export default function SFiraChat({ onContactSelect }) {
  const [selectedContact, setSelectedContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentStationId, setCurrentStationId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const sortContacts = (list) => {
    return [...list].sort((a, b) => {
      const aUnread = a.unreadCount || 0;
      const bUnread = b.unreadCount || 0;
      if (bUnread !== aUnread) return bUnread - aUnread;
      const at = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const bt = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return bt - at;
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('userData');
        const userData = raw ? JSON.parse(raw) : {};
        const id = userData?.id || userData?.uid;
        if (id) setCurrentStationId(id);
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        setIsLoading(true);

        // Admin users (robust with fallback)
        let adminContacts = [];
        try {
          const { data: admins } = await supabase.from('admin_users').select('id, first_name, last_name, email');
          adminContacts = (admins || []).map(a => ({
            id: a.id,
            name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Admin',
            email: a.email,
            type: 'admin',
            avatar: (a.first_name || a.last_name || 'A').slice(0,1).toUpperCase(),
            unreadCount: 0,
          }));
        } catch (e) {
          adminContacts = [{ id: 'fallback-admin', name: 'Command Center', email: 'admin@fira.com', type: 'admin', avatar: 'C', unreadCount: 0 }];
        }

        // Responders for this station (compare as strings to avoid type mismatch)
        let responderContacts = [];
        try {
          const { data: responders } = await supabase.from('responders').select('id, first_name, last_name, email, station_id');
          responderContacts = (responders || [])
            .filter(r => !currentStationId || String(r.station_id) === String(currentStationId))
            .map(r => ({
              id: r.id,
              name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Responder',
              email: r.email,
              type: 'responder',
              avatar: (r.first_name || r.last_name || 'R').slice(0,1).toUpperCase(),
              unreadCount: 0,
            }));
        } catch (e) {}

        // Other stations (exclude current)
        let stationContacts = [];
        try {
          const { data: stations } = await supabase.from('station_users').select('id, station_name, email');
          stationContacts = (stations || [])
            .filter(s => !currentStationId || String(s.id) !== String(currentStationId))
            .map(s => ({ id: s.id, name: s.station_name || 'Station', email: s.email, type: 'station', avatar: (s.station_name || 'S').slice(0,1).toUpperCase(), unreadCount: 0 }));
        } catch (e) {}

        const all = sortContacts([...adminContacts, ...responderContacts, ...stationContacts]);
        setContacts(all);
      } catch (_) {
      } finally {
        setIsLoading(false);
      }
    };
    loadContacts();
  }, [currentStationId]);

  useEffect(() => {
    if (!currentStationId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', currentStationId)
          .eq('is_read', false)
          .order('created_at', { ascending: false });
        const grouped = (data || []).reduce((acc, m) => {
          acc[m.sender_id] = acc[m.sender_id] || { count: 0, lastMessage: m.text || '', lastMessageTime: m.created_at };
          acc[m.sender_id].count += 1;
          return acc;
        }, {});
        setContacts(prev => sortContacts(prev.map(c => ({
          ...c,
          unreadCount: grouped[c.id]?.count || 0,
          lastMessage: grouped[c.id]?.lastMessage || c.lastMessage,
          lastMessageTime: grouped[c.id]?.lastMessageTime || c.lastMessageTime,
        }))));
      } catch (_) {}
    })();
  }, [currentStationId]);

  useEffect(() => {
    if (!currentStationId) return;
    const channel = supabase
      .channel(`station-unread:${currentStationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentStationId}` }, (payload) => {
        const senderId = payload.new.sender_id;
        setContacts(prev => sortContacts(prev.map(c => c.id === senderId ? { ...c, unreadCount: (c.unreadCount || 0) + 1, lastMessage: payload.new.text || c.lastMessage, lastMessageTime: payload.new.created_at } : c)));
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [currentStationId]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [contacts, searchQuery]);

  const sendMessage = () => {
    if (message.trim() && selectedContact) {
      const newMessage = {
        id: messages[selectedContact.id].length + 1,
        text: message.trim(),
        sender: 'station',
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
      case 'admin':
        return 'shield';
      case 'responder':
        return 'shield-checkmark';
      case 'station':
        return 'business';
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
      case 'responder':
        return 'bg-green-500';
      case 'station':
        return 'bg-purple-500';
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
      case 'station':
        return 'Station 1';
      case 'responder':
        return 'Responder';
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

        {/* Search */}
        <View className="px-4 pb-2">
          <View className="flex-row items-center bg-gray-100 rounded-full px-3 py-2">
            <Ionicons name="search" size={18} color="#6B7280" />
            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search users..." className="flex-1 ml-2 text-gray-800" />
          </View>
        </View>

        {/* Contact List */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View className="items-center py-10"><Text className="text-gray-500">Loading contacts...</Text></View>
          ) : filteredContacts.length === 0 ? (
            <View className="items-center py-10"><Text className="text-gray-500">No users found</Text></View>
          ) : filteredContacts.map((contact) => (
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
                  {contact.lastMessageTime && (
                    <Text className="text-xs text-gray-500">{new Date(contact.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  )}
                </View>
                {!!contact.lastMessage && (
                  <Text className="text-sm text-gray-600 mt-1" numberOfLines={1}>
                    {contact.lastMessage}
                  </Text>
                )}
              </View>

              {/* Status Indicators */}
              <View className="items-end">
                {contact.unreadCount > 0 && (
                  <View className="w-5 h-5 bg-red-500 rounded-full items-center justify-center mb-1">
                    <Text className="text-xs text-white font-bold">{contact.unreadCount}</Text>
                  </View>
                )}
                <View className={`w-2 h-2 rounded-full bg-green-500`} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Individual Chat View
  return (
    <SChatPage 
      contact={selectedContact}
      currentStationId={currentStationId}
      onBack={() => {
        setSelectedContact(null);
        if (onContactSelect) {
          onContactSelect(null);
        }
      }}
    />
  );
} 