import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiPaperclip, FiMic, FiPhone, FiVideo, FiUser, FiMapPin, FiAlertTriangle, FiImage, FiCheck, FiSearch } from 'react-icons/fi';
import { supabase } from '../../../../config/supabase';
import { analyzeMessageForFireAlarm, updateMessageWithAIAnalysis } from '../../../../services/openaiService';

const Afira_chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [stations, setStations] = useState([]); // All stations in the system
  const [unreadStations, setUnreadStations] = useState([]); // Stations with unread messages
  const [selectedStation, setSelectedStation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredStations, setFilteredStations] = useState([]);
  const [filteredUnreadStations, setFilteredUnreadStations] = useState([]);
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [currentAdminName, setCurrentAdminName] = useState('Admin');
  const [currentAdminId, setCurrentAdminId] = useState(null);
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

  // Fetch all stations from Supabase
  useEffect(() => {
    const fetchStations = async () => {
      try {
        setIsLoading(true);
        const { data: stationsData, error } = await supabase
          .from('station_users')
          .select('*')
          .eq('active', true)
          .order('station_name', { ascending: true });

        if (error) {
          console.error('Error fetching stations:', error);
          return;
        }

        const formattedStations = stationsData.map(station => ({
          id: station.id,
          name: station.station_name || station.name || 'Unnamed Station',
          email: station.email,
          avatar: (station.station_name || station.name || 'U')[0].toUpperCase(),
          lastMessage: '',
          lastMessageTime: null,
          unreadCount: 0
        }));

        const sorted = sortContacts(formattedStations);
        setStations(sorted);
        setFilteredStations(sorted);
      } catch (error) {
        console.error('Error fetching stations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStations();
  }, []);

  // Load current admin identity (mirrors how stations load their IDs in Sfira_chat.jsx)
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData?.id) {
      setCurrentAdminId(userData.id);
      setCurrentAdminName(userData.first_name || userData.email || 'Admin');
      console.log('👤 Current admin ID (Chat):', userData.id);
    } else {
      // Fallback: use the known admin id provided, if present
      const fallbackAdminId = '6cac74e9-cfcf-43cd-9bcf-a30c6b67596d';
      setCurrentAdminId(fallbackAdminId);
      console.warn('⚠️ No admin ID found in localStorage; using fallback admin id');
    }
  }, []);

  // Fetch unread messages for stations
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      try {
        if (!currentAdminId) return;
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', currentAdminId)
          .eq('is_read', false)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching unread messages:', error);
          return;
        }

        // Group unread messages by station
        const unreadByStation = {};
        messagesData.forEach(message => {
          const stationId = message.sender_id;
          if (!unreadByStation[stationId]) {
            unreadByStation[stationId] = {
              count: 0,
              lastMessage: message.text || '',
              lastMessageTime: message.created_at
            };
          }
          unreadByStation[stationId].count++;
        });

        // Update stations with unread count and last message
        const updatedStations = stations.map(station => {
          const unreadInfo = unreadByStation[station.id];
          return {
            ...station,
            unreadCount: unreadInfo ? unreadInfo.count : 0,
            lastMessage: unreadInfo ? unreadInfo.lastMessage : station.lastMessage,
            lastMessageTime: unreadInfo ? unreadInfo.lastMessageTime : station.lastMessageTime
          };
        });

        const sortedUpdated = sortContacts(updatedStations);
        setStations(sortedUpdated);
        setFilteredStations(sortedUpdated);

        // Set unread stations
        const unreadStationsList = sortedUpdated.filter(station => station.unreadCount > 0);
        setUnreadStations(unreadStationsList);
        setFilteredUnreadStations(unreadStationsList);
      } catch (error) {
        console.error('Error fetching unread messages:', error);
      }
    };

    if (stations.length > 0 && currentAdminId) {
      fetchUnreadMessages();
    }
  }, [stations.length, currentAdminId]);

  // Filter stations based on search query
  useEffect(() => {
    if (activeTab === 'chat') {
      const filtered = stations.filter(station =>
        station.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStations(filtered);
    } else {
      const filtered = unreadStations.filter(station =>
        station.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUnreadStations(filtered);
    }
  }, [searchQuery, activeTab, stations, unreadStations]);

  // Fetch messages for selected station
  useEffect(() => {
    if (!selectedStation || !currentAdminId) return;

    const fetchMessages = async () => {
      try {
        // Debug: fetch all messages to verify presence and ids
        const { data: allMsgs, error: allErr } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: true });
        if (allErr) {
          console.warn('Debug: error fetching all messages', allErr);
        } else {
          console.log('Debug: total messages in DB:', allMsgs?.length || 0);
          console.log('Debug: sample messages:', (allMsgs || []).slice(0, 5));
        }

        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${selectedStation.id},receiver_id.eq.${currentAdminId}),and(sender_id.eq.${currentAdminId},receiver_id.eq.${selectedStation.id})`)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          return;
        }

        setMessages(messagesData || []);
        setTimeout(scrollToBottom, 100);

        // Mark as read any messages sent by the station to the admin in this thread
        try {
          const { error: readErr } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('sender_id', selectedStation.id)
            .eq('receiver_id', currentAdminId)
            .eq('is_read', false);
          if (readErr) {
            console.warn('Warning: failed to mark messages as read', readErr);
          } else {
            // refresh unread counters after marking read
            // lightweight refetch
            const refreshUnread = async () => {
              const { data: unreadAfter, error: unreadErr } = await supabase
                .from('messages')
                .select('sender_id')
                .eq('receiver_id', currentAdminId)
                .eq('is_read', false);
              if (!unreadErr) {
                const counts = unreadAfter.reduce((acc, m) => {
                  acc[m.sender_id] = (acc[m.sender_id] || 0) + 1;
                  return acc;
                }, {});
                const updated = stations.map((s) => ({
                  ...s,
                  unreadCount: counts[s.id] || 0
                }));
                setStations(updated);
                setFilteredStations(updated);
                const list = updated.filter((s) => s.unreadCount > 0);
                setUnreadStations(list);
                setFilteredUnreadStations(list);
              }
            };
            refreshUnread();
          }
        } catch (e) {
          console.warn('Warning: mark-as-read threw', e);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [selectedStation, currentAdminId]);

  // Realtime subscription for unread counters (messages to admin)
  useEffect(() => {
    if (!currentAdminId) return;
    const channel = supabase
      .channel(`unread:admin:${currentAdminId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentAdminId}`
      }, (payload) => {
        // increment unread badge for that station
        const stationId = payload.new.sender_id;
        const applyAndSort = (arr) => sortContacts(arr.map((s) => s.id === stationId ? { ...s, unreadCount: (s.unreadCount || 0) + 1, lastMessage: payload.new.text || s.lastMessage, lastMessageTime: payload.new.created_at } : s));
        setStations((prev) => applyAndSort(prev));
        setFilteredStations((prev) => applyAndSort(prev));
        setUnreadStations((prev) => {
          const exists = prev.find((s) => s.id === stationId);
          const updatedStation = (stations.find((s) => s.id === stationId) || {}).id ? (stations.find((s) => s.id === stationId)) : null;
          if (!updatedStation) return prev;
          const withIncrement = { ...updatedStation, unreadCount: (updatedStation.unreadCount || 0) + 1 };
          const others = prev.filter((s) => s.id !== stationId);
          return [withIncrement, ...others];
        });
        setFilteredUnreadStations((prev) => prev.length ? prev : stations.filter((s) => (s.unreadCount || 0) > 0));
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentAdminId, stations]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!selectedStation || !currentAdminId) return;

    const subscription = supabase
      .channel(`messages:${selectedStation.id}:${currentAdminId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `or(and(sender_id.eq.${selectedStation.id},receiver_id.eq.${currentAdminId}),and(sender_id.eq.${currentAdminId},receiver_id.eq.${selectedStation.id}))`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(scrollToBottom, 100);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedStation, currentAdminId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || !selectedStation || !currentAdminId) {
      console.warn('✋ Cannot send. Checks -> text:', !!newMessage.trim(), 'station:', !!selectedStation, 'adminId:', !!currentAdminId);
      return;
    }

    try {
      const payload = {
        sender_id: currentAdminId,
        receiver_id: selectedStation.id,
        sender_type: 'admin',
        receiver_type: 'station',
        text: newMessage,
        is_emergency: isEmergencyMode,
        is_read: false
      };

      console.log('📤 Sending admin message payload:', payload);

      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select();

      if (error) {
        console.error('❌ Error sending message:', error);
        alert('Failed to send message');
        return;
      }

      console.log('✅ Inserted message:', data);
      setNewMessage('');

      // Optimistic UI update
      if (data && data[0]) {
        setMessages(prev => [...prev, data[0]]);
        setTimeout(scrollToBottom, 100);
      }

      // AI Analysis: Analyze the message for fire alarm level
      if (data && data[0]) {
        try {
          console.log('🤖 Starting AI analysis for admin message:', newMessage);
          const analysis = await analyzeMessageForFireAlarm(newMessage);
          console.log('🤖 AI Analysis result:', analysis);
          
          if (analysis.suggested_alarm) {
            // Update the message with AI analysis
            await updateMessageWithAIAnalysis(data[0].id, analysis, supabase);
            console.log('✅ Admin message updated with AI suggested alarm:', analysis.suggested_alarm);
          } else {
            console.log('ℹ️ No fire-related content detected in admin message');
          }
        } catch (aiError) {
          console.error('❌ AI analysis failed for admin message:', aiError);
          // Don't show error to user, just log it
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  };

  const handleSelectImage = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file || !selectedStation || !currentAdminId) return;

    setIsUploadingImage(true);
    try {
      // For now, we'll just send a text message indicating image upload
      // In a full implementation, you'd upload to Supabase Storage
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentAdminId,
          receiver_id: selectedStation.id,
          sender_type: 'admin',
          receiver_type: 'station',
          text: `[Image: ${file.name}]`,
          is_emergency: isEmergencyMode,
          is_read: false
        })
        .select();

      if (error) {
        console.error('Error sending image message:', error);
        alert('Failed to send image message');
      } else if (data && data[0]) {
        // Optimistic append
        setMessages(prev => [...prev, data[0]]);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Error sending image message:', error);
      alert('Failed to send image message');
    } finally {
      setIsUploadingImage(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastMessage = (message) => {
    if (!message) return 'No messages yet';
    if (message.length > 50) {
      return message.substring(0, 50) + '...';
    }
    return message;
  };

  return (
    <div className="flex h-[90vh] overflow-hidden">
      {/* Sidebar */}
      <div className="w-1/4 bg-white border-r flex flex-col h-[90vh]">
        <div className="p-2 border-b border-gray-300">
          <h2 className="text-lg font-bold text-red-600">Project FIRA</h2>
          <p className="text-sm text-gray-500">Emergency Communication</p>
        </div>
        
        {/* Search Bar */}
        <div className="p-2 border-b border-gray-300">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'chat' ? 'stations' : 'unread messages'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        <div className="flex border-b border-gray-300">
          <button
            className={`flex-1 py-2 text-center font-medium ${activeTab === 'chat' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('chat')}
          >
            Chats
          </button>
          <button
            className={`flex-1 py-2 text-center font-medium ${activeTab === 'unread' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('unread')}
          >
            Unread Messages
          </button>
        </div>

        {activeTab === 'chat' && (
          <div className="overflow-y-auto h-[calc(100vh-12rem)] p-4 space-y-2">
            {isLoading ? (
              <div className="text-center text-gray-500">Loading stations...</div>
            ) : filteredStations.length === 0 ? (
              <div className="text-center text-gray-500">No stations found</div>
            ) : (
              filteredStations.map(station => (
                <div 
                  key={station.id} 
                  onClick={() => setSelectedStation(station)}
                  className={`cursor-pointer p-3 hover:bg-gray-100 rounded-lg flex items-center space-x-3 ${
                    selectedStation?.id === station.id ? 'bg-gray-200' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold bg-green-100 text-green-600 text-lg">
                    {station.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{station.name}</div>
                    <div className="text-sm text-gray-500 truncate">{station.email}</div>
                    {station.lastMessage && (
                      <div className="text-xs text-gray-400 truncate mt-1">
                        {formatLastMessage(station.lastMessage)}
                      </div>
                    )}
                  </div>
                  {station.unreadCount > 0 && (
                    <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {station.unreadCount}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'unread' && (
          <div className="overflow-y-auto h-[calc(100vh-12rem)] p-4 space-y-2">
            {filteredUnreadStations.length === 0 ? (
              <div className="text-center text-gray-500">No unread messages</div>
            ) : (
              filteredUnreadStations.map(station => (
                <div 
                  key={station.id} 
                  onClick={() => setSelectedStation(station)}
                  className={`cursor-pointer p-3 hover:bg-gray-100 rounded-lg flex items-center space-x-3 ${
                    selectedStation?.id === station.id ? 'bg-gray-200' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold bg-green-100 text-green-600 text-lg">
                    {station.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{station.name}</div>
                    <div className="text-sm text-gray-500 truncate">{station.email}</div>
                    {station.lastMessage && (
                      <div className="text-xs text-gray-400 truncate mt-1">
                        {formatLastMessage(station.lastMessage)}
                      </div>
                    )}
                  </div>
                  <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                    {station.unreadCount}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-[90vh] overflow-hidden">
        {selectedStation ? (
          <>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-lg mr-3">
                  {selectedStation.avatar}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedStation.name}</h3>
                  <p className="text-sm text-gray-500">{selectedStation.email}</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 pb-16 bg-gray-50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-lg font-medium mb-2">No messages yet</h3>
                  <p className="text-sm text-center">
                    Start a conversation with {selectedStation.name}
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`mb-4 flex ${message.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-xs md:max-w-md">
                      <div className={`rounded-lg px-4 py-2 ${
                        message.sender_type === 'admin' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white border border-gray-200'
                      }`}>
                        {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                        <div className="text-xs mt-2 text-right opacity-70">
                          {formatTime(message.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center">
                <button 
                  type="button" 
                  onClick={() => imageInputRef.current?.click()} 
                  disabled={isUploadingImage || !selectedStation}
                  className="p-2 mr-2 rounded-full text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  <FiImage size={20} />
                </button>
                <input 
                  ref={imageInputRef} 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleSelectImage} 
                />
                <div className="flex-1 relative">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message..."
                    className="w-full border border-gray-300 rounded-lg pl-4 pr-12 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                    rows="1"
                  />
                </div>
                <button 
                  onClick={handleSendMessage} 
                  disabled={!newMessage.trim()}
                  className="ml-3 p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <FiSend size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">
            Select a station to start chatting.
          </div>
        )}
      </div>
    </div>
  );
};

export default Afira_chat;
