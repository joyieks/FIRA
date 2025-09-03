import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiPaperclip, FiUser, FiAlertTriangle, FiImage, FiCheck, FiSearch, FiFilter } from 'react-icons/fi';
import { supabase } from '../../../../config/supabase';

const Sfira_chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [users, setUsers] = useState([]); // Users related to this station
  const [unreadUsers, setUnreadUsers] = useState([]); // Users with unread messages
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, admin, responders, stations
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [filteredUnreadUsers, setFilteredUnreadUsers] = useState([]);
  const [currentStationId, setCurrentStationId] = useState(null);
  const [currentStationName, setCurrentStationName] = useState('');
  const [stations, setStations] = useState([]); // Other stations for communication
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get current station user info
  useEffect(() => {
    const getCurrentStation = async () => {
      try {
        console.log('🔍 getCurrentStation called');
        
        // Get current user from localStorage or session
        const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        console.log('🔍 currentUser from localStorage:', currentUser);
        console.log('🔍 currentUser.id:', currentUser.id);
        console.log('🔍 currentUser.station_name:', currentUser.station_name);
        console.log('🔍 currentUser.name:', currentUser.name);
        console.log('🔍 currentUser.email:', currentUser.email);
        
        let stationIdToUse = null;
        let stationNameToUse = 'Station';
        
        if (currentUser.id) {
          console.log('✅ Found currentUser.id in localStorage:', currentUser.id);
          
          // --- Attempt 1: Find station by email from localStorage ---
          if (currentUser.email) {
            console.log('🔍 Attempting to find station by email:', currentUser.email);
            const { data: stationByEmail, error: emailError } = await supabase
              .from('station_users')
              .select('id, station_name')
              .eq('email', currentUser.email)
              .single();
            
            if (stationByEmail && !emailError) {
              stationIdToUse = stationByEmail.id;
              stationNameToUse = stationByEmail.station_name || 'Station';
              console.log('✅ Found station by email:', stationByEmail);
            } else {
              console.log('⚠️ Could not find station by email or error:', emailError);
            }
          }
          
          // --- Attempt 2: If not found by email, try by ID from localStorage ---
          if (!stationIdToUse) {
            console.log('🔍 Attempting to find station by ID from localStorage:', currentUser.id);
            const { data: stationById, error: idError } = await supabase
              .from('station_users')
              .select('id, station_name')
              .eq('id', currentUser.id)
              .single();
            
            if (stationById && !idError) {
              stationIdToUse = stationById.id;
              stationNameToUse = stationById.station_name || 'Station';
              console.log('✅ Found station by ID from database:', stationById);
            } else {
              console.log('⚠️ Could not find station by ID or error:', idError);
            }
          }
          
          if (stationIdToUse) {
            setCurrentStationId(stationIdToUse);
            setCurrentStationName(stationNameToUse);
            console.log('✅ Set currentStationId to:', stationIdToUse, 'from localStorage/database lookup');
          } else {
            console.log('❌ No matching station found for currentUser.id or email. Falling back to first available.');
            await getFirstAvailableStation();
          }
          
        } else {
          console.log('❌ No current user found in localStorage. Falling back to first available station from database.');
          await getFirstAvailableStation();
        }
      } catch (error) {
        console.error('❌ Error in getCurrentStation:', error);
        console.log('🔄 Using fallback station ID due to error in getCurrentStation');
        setCurrentStationId('default-station-123');
        setCurrentStationName('Default Station');
      }
    };

    getCurrentStation();
  }, []);

  // Helper function to get first available station
  const getFirstAvailableStation = async () => {
    try {
      console.log('🔄 Getting first available station from database...');
      const { data: firstStation, error } = await supabase
        .from('station_users')
        .select('*')
        .limit(1)
        .single();
      
      if (firstStation && !error) {
        console.log('✅ Found first available station:', firstStation);
        setCurrentStationId(firstStation.id);
        setCurrentStationName(firstStation.station_name || 'Station');
        console.log('✅ Set currentStationId to:', firstStation.id);
      } else {
        console.error('❌ No stations found in database or error:', error);
        // Fallback: use a default station ID for testing
        console.log('🔄 Using fallback station ID for testing');
        setCurrentStationId('default-station-123');
        setCurrentStationName('Default Station');
      }
    } catch (error) {
      console.error('❌ Error fetching first available station:', error);
      // Fallback: use a default station ID for testing
      console.log('🔄 Using fallback station ID due to error');
      setCurrentStationId('default-station-123');
      setCurrentStationName('Default Station');
    }
  };

  // Monitor currentStationId changes
  useEffect(() => {
    console.log('🔍 currentStationId changed to:', currentStationId);
  }, [currentStationId]);

  // Fetch users related to this station
  useEffect(() => {
    console.log('🔍 fetchUsers useEffect triggered, currentStationId:', currentStationId);
    
    const fetchUsers = async () => {
      if (!currentStationId) {
        console.log('❌ No currentStationId, cannot fetch users');
        return;
      }

      try {
        setIsLoading(true);
        console.log('🚀 Starting to fetch users for station:', currentStationId);
        
        // Test Supabase connection first
        console.log('🔌 Testing Supabase connection...');
        const { data: testData, error: testError } = await supabase
          .from('station_users')
          .select('*')
          .limit(1);
        
        if (testError) {
          console.error('❌ Supabase connection failed:', testError);
          console.error('❌ Error details:', testError.message, testError.details, testError.hint);
          return;
        } else {
          console.log('✅ Supabase connection successful');
          console.log('✅ Test data:', testData);
        }
        
        // Fetch admin users - ALL admin users in the system
        console.log('Fetching from admin_users table...');
        const { data: adminUsers, error: adminError } = await supabase
          .from('admin_users')
          .select('*')
          .limit(100);
        
        // If admin_users table doesn't exist, create a mock admin
        if (adminError && adminError.message.includes('relation "admin_users" does not exist')) {
          console.log('⚠️ admin_users table not found, using mock admin');
          const mockAdmin = [{
            id: 'mock-admin-1',
            first_name: 'Command',
            last_name: 'Center',
            email: 'admin@fira.com'
          }];
          setAdminUsers(mockAdmin);
        }

        if (adminError) {
          console.error('❌ Error fetching admin users:', adminError);
        } else {
          console.log('✅ Admin users fetched:', adminUsers);
          console.log('✅ Admin users count:', adminUsers?.length || 0);
          if (!adminUsers || adminUsers.length === 0) {
            console.log('⚠️ No admin users found in admin_users table');
          }
        }

        // Fetch ONLY responders assigned to THIS station
        console.log('🔍 Current station ID for responder filtering:', currentStationId);
        console.log('🔍 Fetching responders where station_id =', currentStationId);
        
        // First, let's see ALL responders to debug
        console.log('🔍 Fetching ALL responders first to see what we have...');
        const { data: allResponders, error: allResponderError } = await supabase
          .from('responders')
          .select('*')
          .limit(100);
        
        if (allResponderError) {
          console.error('❌ Error fetching all responders:', allResponderError);
        } else {
          console.log('🔍 ALL responders in database:', allResponders);
          console.log('🔍 Station IDs in responders table:', allResponders?.map(r => r.station_id) || []);
          
          // Check if currentStationId matches any of these
          const matchingStation = allResponders?.find(r => r.station_id === currentStationId);
          if (matchingStation) {
            console.log('✅ MATCH FOUND! currentStationId matches a responder station_id');
            console.log('✅ Matching responder:', matchingStation);
          } else {
            console.log('❌ NO MATCH! currentStationId does NOT match any responder station_id');
            console.log('❌ currentStationId:', currentStationId);
            console.log('❌ Available station_ids:', allResponders?.map(r => r.station_id) || []);
          }
        }
        
        // Now fetch responders for current station
        console.log('🎯 FINAL CHECK: About to fetch responders for station_id =', currentStationId);
        console.log('🎯 This should match one of these station IDs from responders table');
        
        const { data: responders, error: responderError } = await supabase
          .from('responders')
          .select('*')
          .eq('station_id', currentStationId)
          .limit(100);

        if (responderError) {
          console.error('❌ Error fetching responders:', responderError);
        } else {
          console.log('✅ Responders fetched for station', currentStationId, ':', responders);
          console.log('✅ Responders count:', responders?.length || 0);
          if (!responders || responders.length === 0) {
            console.log('⚠️ No responders found for station ID:', currentStationId);
            console.log('⚠️ This means no responders are assigned to this station');
          }
        }

        // Fetch ALL other stations (excluding current station)
        console.log('Fetching from station_users table...');
        const { data: otherStations, error: stationsError } = await supabase
          .from('station_users')
          .select('*')
          .limit(100);

        if (stationsError) {
          console.error('❌ Error fetching stations:', stationsError);
        } else {
          console.log('✅ Other stations fetched:', otherStations);
          console.log('✅ Other stations count:', otherStations?.length || 0);
          if (!otherStations || otherStations.length === 0) {
            console.log('⚠️ No stations found in station_users table');
          }
        }

                // Format REAL users from Supabase tables
        console.log('🔍 Raw admin users data:', adminUsers);
        console.log('🔍 Raw responders data:', responders);
        console.log('🔍 Raw stations data:', otherStations);
        
        const formattedUsers = [
          ...(adminUsers || []).map(admin => {
            console.log('🔍 Processing admin:', admin);
            return {
              id: admin.id,
              name: `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Admin User',
              email: admin.email,
              type: 'admin',
              avatar: (admin.first_name || admin.last_name || 'A')[0].toUpperCase(),
              lastMessage: '',
              lastMessageTime: null,
              unreadCount: 0
            };
          }),
          ...(responders || []).map(responder => {
            console.log('🔍 Processing responder:', responder);
            return {
              id: responder.id,
              name: `${responder.first_name || ''} ${responder.last_name || ''}`.trim() || 'Responder',
              email: responder.email,
              type: 'responder',
              avatar: (responder.first_name || responder.last_name || 'R')[0].toUpperCase(),
              lastMessage: '',
              lastMessageTime: null,
              unreadCount: 0
            };
          }),
          ...(otherStations || []).map(station => {
            console.log('🔍 Processing station:', station);
            return {
              id: station.id,
              name: station.station_name || station.name || 'Unnamed Station',
              email: station.email,
              type: 'station',
              avatar: (station.station_name || station.name || 'S')[0].toUpperCase(),
              lastMessage: '',
              lastMessageTime: null,
              unreadCount: 0
            };
          })
        ];

        console.log('Total formatted users:', formattedUsers);
        console.log('Current station ID:', currentStationId);
        setUsers(formattedUsers);
        setFilteredUsers(formattedUsers);
        setStations(otherStations || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [currentStationId]);

  // Fetch unread messages
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      if (!currentStationId || users.length === 0) return;

      try {
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', currentStationId)
          .eq('is_read', false)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching unread messages:', error);
        return;
      }

        // Group unread messages by user
        const unreadByUser = {};
        messagesData.forEach(message => {
          const userId = message.sender_id;
          if (!unreadByUser[userId]) {
            unreadByUser[userId] = {
              count: 0,
              lastMessage: message.text || '',
              lastMessageTime: message.created_at
            };
          }
          unreadByUser[userId].count++;
        });

        // Update users with unread count and last message
        const updatedUsers = users.map(user => {
          const unreadInfo = unreadByUser[user.id];
        return {
            ...user,
            unreadCount: unreadInfo ? unreadInfo.count : 0,
            lastMessage: unreadInfo ? unreadInfo.lastMessage : user.lastMessage,
            lastMessageTime: unreadInfo ? unreadInfo.lastMessageTime : user.lastMessageTime
        };
      });

        setUsers(updatedUsers);
        setFilteredUsers(updatedUsers);

        // Set unread users
        const unreadUsersList = updatedUsers.filter(user => user.unreadCount > 0);
        setUnreadUsers(unreadUsersList);
        setFilteredUnreadUsers(unreadUsersList);
      } catch (error) {
        console.error('Error fetching unread messages:', error);
      }
    };

    if (users.length > 0) {
      fetchUnreadMessages();
    }
  }, [currentStationId, users.length]);

  // Filter users based on search query and filter type
  useEffect(() => {
    let filtered = [];
    
    if (activeTab === 'chat') {
      filtered = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (filterType === 'all') return matchesSearch;
        if (filterType === 'admin') return user.type === 'admin' && matchesSearch;
        if (filterType === 'responders') return user.type === 'responder' && matchesSearch;
        if (filterType === 'stations') return user.type === 'station' && matchesSearch;
        
        return matchesSearch;
      });
      setFilteredUsers(filtered);
    } else {
      filtered = unreadUsers.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (filterType === 'all') return matchesSearch;
        if (filterType === 'admin') return user.type === 'admin' && matchesSearch;
        if (filterType === 'responders') return user.type === 'responder' && matchesSearch;
        if (filterType === 'stations') return user.type === 'station' && matchesSearch;
        
        return matchesSearch;
      });
      setFilteredUnreadUsers(filtered);
    }
  }, [searchQuery, filterType, activeTab, users, unreadUsers]);

  // Fetch messages for selected user
  useEffect(() => {
    if (!selectedUser || !currentStationId) return;

    const fetchMessages = async () => {
      try {
        console.log('Fetching messages between:', currentStationId, 'and', selectedUser.id);
        
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentStationId}),and(sender_id.eq.${currentStationId},receiver_id.eq.${selectedUser.id})`)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          return;
        }

        console.log('Messages fetched:', messagesData);
        setMessages(messagesData || []);
        setTimeout(scrollToBottom, 100);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [selectedUser, currentStationId]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!selectedUser || !currentStationId) return;

    const subscription = supabase
      .channel(`messages:${selectedUser.id}:${currentStationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `or(and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentStationId}),and(sender_id.eq.${currentStationId},receiver_id.eq.${selectedUser.id}))`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(scrollToBottom, 100);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedUser, currentStationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || !selectedUser || !currentStationId) return;

    try {
      console.log('Sending message:', {
        sender_id: currentStationId,
        receiver_id: selectedUser.id,
        sender_type: 'station',
        receiver_type: selectedUser.type,
        text: newMessage,
        is_emergency: isEmergencyMode,
        is_read: false
      });

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentStationId,
          receiver_id: selectedUser.id,
          sender_type: 'station',
          receiver_type: selectedUser.type,
          text: newMessage,
          is_emergency: isEmergencyMode,
          is_read: false
        })
        .select();

      if (error) {
        console.error('Error sending message:', error);
        alert(`Failed to send message: ${error.message}`);
        return;
      }

      console.log('Message sent successfully:', data);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert(`Failed to send message: ${error.message}`);
    }
  };

  const handleSelectImage = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file || !selectedUser || !currentStationId) return;

    setIsUploadingImage(true);
    try {
      // For now, we'll just send a text message indicating image upload
      // In a full implementation, you'd upload to Supabase Storage
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentStationId,
          receiver_id: selectedUser.id,
          sender_type: 'station',
          receiver_type: selectedUser.type,
          text: `[Image: ${file.name}]`,
          is_emergency: isEmergencyMode,
          is_read: false
        });

      if (error) {
        console.error('Error sending image message:', error);
        alert('Failed to send image message');
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

  const getFilterButtonClass = (type) => {
    return `px-3 py-1 rounded-full text-xs font-medium ${
      filterType === type
        ? 'bg-red-600 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`;
  };

  return (
    <div className="flex h-[90vh] bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-red-600">Project FIRA</h2>
          <p className="text-sm text-gray-500">Emergency Communication</p>
          
        </div>
        
        {/* Search Bar */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'chat' ? 'users' : 'unread messages'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex space-x-2">
            <button
              onClick={() => setFilterType('all')}
              className={getFilterButtonClass('all')}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('admin')}
              className={getFilterButtonClass('admin')}
            >
              Admin Chat
            </button>
            <button
              onClick={() => setFilterType('responders')}
              className={getFilterButtonClass('responders')}
            >
              Responders
            </button>
            <button
              onClick={() => setFilterType('stations')}
              className={getFilterButtonClass('stations')}
            >
              Stations
            </button>
          </div>
        </div>

        <div className="flex border-b">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'chat' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
          >
            Chats
          </button>
          <button 
            onClick={() => setActiveTab('unread')}
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'unread' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
          >
            Unread Messages
          </button>
        </div>

        {activeTab === 'chat' ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="text-center text-gray-500 py-8">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No users found</div>
            ) : (
              filteredUsers.map(user => (
              <div
                key={user.id}
                  className={`p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer flex items-center ${
                    selectedUser?.id === user.id ? 'bg-red-50' : ''
                  }`}
                onClick={() => setSelectedUser(user)}
              >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold mr-3 text-lg ${
                    user.type === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{user.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    <p className="text-xs text-gray-400 truncate mt-1">
                      {user.type === 'admin' ? 'Admin' : user.type === 'responder' ? 'Responder' : 'Station'}
                    </p>
                    {user.lastMessage && (
                      <div className="text-xs text-gray-400 truncate mt-1">
                        {formatLastMessage(user.lastMessage)}
                      </div>
                    )}
                </div>
                  {user.unreadCount > 0 && (
                    <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {user.unreadCount}
                </div>
                  )}
              </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredUnreadUsers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No unread messages</div>
            ) : (
              filteredUnreadUsers.map(user => (
                <div
                  key={user.id}
                  className={`p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer flex items-center ${
                    selectedUser?.id === user.id ? 'bg-red-50' : ''
                  }`}
                  onClick={() => setSelectedUser(user)}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold mr-3 text-lg ${
                    user.type === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{user.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    <p className="text-xs text-gray-400 truncate mt-1">
                      {user.type === 'admin' ? 'Admin' : user.type === 'responder' ? 'Responder' : 'Station'}
                    </p>
                    {user.lastMessage && (
                      <div className="text-xs text-gray-400 truncate mt-1">
                        {formatLastMessage(user.lastMessage)}
                      </div>
                    )}
                </div>
                  <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                    {user.unreadCount}
                </div>
              </div>
              ))
            )}
          </div>
        )}

        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <button 
            onClick={() => setIsEmergencyMode(!isEmergencyMode)}
            className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center ${
              isEmergencyMode 
                ? 'bg-red-700 text-white hover:bg-red-800' 
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            <FiAlertTriangle className="mr-2" />
            {isEmergencyMode ? 'Exit Emergency Mode' : 'Emergency Alert'}
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-[90vh]">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className={`p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 ${
              isEmergencyMode ? 'bg-red-50' : 'bg-white'
            }`}>
              <div className="flex items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold mr-3 text-lg ${
                  selectedUser.type === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                }`}>
                  {selectedUser.avatar}
                </div>
                <div>
                  <h3 className="font-medium text-lg">{selectedUser.name}</h3>
                  <p className="text-sm text-gray-500">
                    {isEmergencyMode ? (
                      <span className="text-red-600 flex items-center">
                        <FiAlertTriangle className="mr-1" /> Emergency Response
                      </span>
                    ) : (
                      `${selectedUser.type === 'admin' ? 'Admin' : selectedUser.type === 'responder' ? 'Responder' : 'Station'} - Online`
                    )}
                  </p>
                </div>
              </div>
            </div>

                         {/* Messages */}
             <div className="h-170 overflow-y-auto p-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-lg font-medium mb-2">No messages yet</h3>
                  <p className="text-sm text-center">
                    Start a conversation with {selectedUser.name}
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.sender_id === currentStationId;
                return (
                  <div 
                    key={message.id} 
                    className={`mb-4 flex ${isMine ? 'justify-end' : 'justify-start'} items-center`}
                  >
                    <div className={`max-w-xs md:max-w-md ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-lg px-4 py-2 ${
                        isMine
                          ? isEmergencyMode 
                            ? 'bg-red-600 text-white' 
                            : 'bg-blue-600 text-white'
                            : message.is_emergency
                            ? 'bg-red-100 border border-red-200'
                            : 'bg-white border border-gray-200'
                      }`}>
                        {!isMine && (
                            <div className={`text-xs font-medium mb-1 ${
                              message.is_emergency ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              {message.sender_name || selectedUser.name}
                          </div>
                        )}
                        {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                          <div className={`text-xs mt-2 text-right ${
                          isMine 
                            ? 'text-white text-opacity-80' 
                              : message.is_emergency 
                              ? 'text-red-500' 
                              : 'text-gray-500'
                        }`}>
                            {formatTime(message.created_at)}
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
              {isEmergencyMode && (
                <div className="bg-red-50 border-l-4 border-red-400 p-3 mb-3 rounded-r-lg">
                  <div className="flex items-center text-red-800">
                    <FiAlertTriangle className="mr-2 flex-shrink-0" />
                    <p className="text-sm">You are in emergency mode. All messages are prioritized.</p>
                  </div>
                </div>
              )}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingImage || !selectedUser}
                  className={`p-2 mr-2 rounded-full ${
                    isUploadingImage ? 'opacity-50 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Send image"
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
                    placeholder={isEmergencyMode ? "Describe your emergency..." : "Type a message..."}
                    className="w-full border border-gray-300 rounded-lg pl-4 pr-12 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                    rows="1"
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className={`ml-3 p-2 rounded-full ${
                    isEmergencyMode
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } ${!newMessage.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <FiSend size={20} />
                </button>
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <div>
                  {isEmergencyMode ? (
                    <span className="text-red-600 flex items-center">
                      <FiAlertTriangle className="mr-1" /> Emergency communication
                    </span>
                  ) : 'Standard message'}
                </div>
                <div>
                  <button 
                    onClick={() => setIsEmergencyMode(!isEmergencyMode)}
                    className="text-red-600 hover:underline"
                  >
                    {isEmergencyMode ? 'Exit emergency mode' : 'Switch to emergency mode'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">
            Select a user to start chatting.
          </div>
        )}
      </div>
    </div>
  );
};

export default Sfira_chat;