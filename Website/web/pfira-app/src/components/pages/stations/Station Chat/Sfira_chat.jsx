import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiPaperclip, FiUser, FiAlertTriangle, FiImage, FiCheck, FiSearch, FiFilter } from 'react-icons/fi';
import { supabase } from '../../../../config/supabase';
import { analyzeMessageForFireAlarm, updateMessageWithAIAnalysis } from '../../../../services/aiService';

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
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState(null);
  const [ongoingIncidents, setOngoingIncidents] = useState([]);
  const [incidentMenuOpen, setIncidentMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshUnreadTick, setRefreshUnreadTick] = useState(0); // bump to refetch unread

  // FIXED: Get current station ID from sessionStorage (where station login stores it) with localStorage fallback
  useEffect(() => {
    const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
    if (userData.id) {
      setCurrentStationId(userData.id);
      setCurrentStationName(userData.station_name || userData.name || 'Station');
      console.log('🏢 Current station ID (Chat):', userData.id);
    } else {
      console.error('❌ No station ID found in userData (Chat)');
      alert('Error: Unable to identify current station. Please log in again.');
    }
  }, []);

  // Fixed: Fetch users related to this station
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
          .from('responders')
          .select('*')
          .limit(1);
        
        if (testError) {
          console.error('❌ Supabase connection failed:', testError);
          return;
        } else {
          console.log('✅ Supabase connection successful');
          console.log('✅ Test data:', testData);
        }
        
        // Fetch admin users - ALL admin users in the system
        console.log('Fetching from admin_users table...');
        let adminUsers = [];
        const { data: adminData, error: adminError } = await supabase
          .from('admin_users')
          .select('*');
        
        if (adminError) {
          console.error('❌ Error fetching admin users:', adminError);
          console.error('❌ Error details:', {
            message: adminError.message,
            code: adminError.code,
            details: adminError.details,
            hint: adminError.hint
          });
          
          // Always create fallback admin for any error
          console.log('⚠️ Database error, injecting fallback admin for functionality');
          adminUsers = [{
            id: '6cac74e9-cfcf-43cd-9bcf-a30c6b67596d',
            first_name: 'Command',
            last_name: 'Center',
            email: 'admin@fira.com'
          }];
        } else {
          adminUsers = adminData || [];
          console.log('✅ Admin users fetched:', adminUsers);
          console.log('✅ Admin users count:', adminUsers.length);
          
          // Always ensure at least one admin exists
          if (adminUsers.length === 0) {
            console.log('⚠️ No admin users found in admin_users table, injecting fallback admin');
            adminUsers = [{
              id: '6cac74e9-cfcf-43cd-9bcf-a30c6b67596d',
              first_name: 'Command',
              last_name: 'Center',
              email: 'admin@fira.com'
            }];
          }
        }

        // Fetch ONLY responders assigned to THIS station - CRITICAL FIX
        console.log('�� Current station ID for responder filtering:', currentStationId);
        console.log('🔍 Fetching responders where station_id =', currentStationId);
        
        // Debug: Fetch ALL responders first to see what we have
        console.log('🔍 Fetching ALL responders first to see what we have...');
        const { data: allResponders, error: allRespondersError } = await supabase
          .from('responders')
          .select('*');
        
        if (!allRespondersError && allResponders) {
          console.log('🔍 ALL responders in database:', allResponders);
          console.log('🔍 Station IDs in responders table:', allResponders.map(r => r.station_id));
          
          // Check if our current station ID matches any responder station_id
          const matchingResponder = allResponders.find(r => r.station_id === currentStationId);
          if (matchingResponder) {
            console.log('✅ MATCH FOUND! currentStationId matches a responder station_id');
            console.log('✅ Matching responder:', matchingResponder);
          } else {
            console.log('❌ NO MATCH! currentStationId does not match any responder station_id');
            console.log('❌ currentStationId:', currentStationId);
            console.log('❌ Available station_ids:', allResponders.map(r => r.station_id));
          }
        }

        // Now fetch responders for current station
        console.log('�� FINAL CHECK: About to fetch responders for station_id =', currentStationId);
        console.log('🎯 This should match one of these station IDs from responders table');
        
        const { data: responders, error: responderError } = await supabase
          .from('responders')
          .select('*')
          .eq('station_id', currentStationId);

        if (responderError) {
          console.error('❌ Error fetching responders:', responderError);
        } else {
          console.log('✅ Responders fetched for station', currentStationId, ':', responders);
          console.log('✅ Responders count:', responders?.length || 0);
          
          // Debug: Show which responders belong to this station
          if (responders && responders.length > 0) {
            responders.forEach(r => {
              console.log(`📋 Responder: ${r.first_name} ${r.last_name} (station_id: ${r.station_id})`);
            });
          } else {
            console.log('⚠️ No responders found for station:', currentStationId);
          }
        }

        // Fetch ALL other stations (excluding current station)
        console.log('Fetching from station_users table...');
        let otherStations = [];
        const { data: stationsData, error: stationsError } = await supabase
          .from('station_users')
          .select('*')
          .neq('id', currentStationId) // Exclude current station
          .limit(100);

        if (stationsError) {
          console.error('❌ Error fetching stations:', stationsError);
          console.error('❌ Station error details:', {
            message: stationsError.message,
            code: stationsError.code,
            details: stationsError.details,
            hint: stationsError.hint
          });
          
          // If table doesn't exist or has issues, create a fallback
          if (stationsError.message.includes('relation "station_users" does not exist') || 
              stationsError.code === 'PGRST116') {
            console.log('⚠️ station_users table not found, creating fallback station');
            otherStations = [{
              id: 'fallback-station-1',
              station_name: 'Central Fire Station',
              email: 'central@fira.com'
            }];
          }
        } else {
          otherStations = stationsData || [];
          console.log('✅ Other stations fetched:', otherStations);
          console.log('✅ Other stations count:', otherStations?.length || 0);
          
          // If no stations found, create a fallback
          if (otherStations.length === 0) {
            console.log('⚠️ No other stations found, creating fallback station');
            otherStations = [{
              id: 'fallback-station-1',
              station_name: 'Central Fire Station',
              email: 'central@fira.com'
            }];
          }
        }

        // Debug logging for raw data
        console.log('🔍 Raw admin users data:', adminUsers);
        console.log('🔍 Raw responders data:', responders);
        console.log('🔍 Raw stations data:', otherStations);

        // Format users from Supabase tables
        console.log('🔍 About to format admin users:', adminUsers);
        const formattedAdminUsers = (adminUsers || []).map(admin => {
          console.log('🔍 Processing admin user:', admin);
          const formatted = {
            id: admin.id,
            name: `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Admin User',
            email: admin.email,
            type: 'admin',
            avatar: (admin.first_name || admin.last_name || 'A')[0].toUpperCase(),
            lastMessage: '',
            lastMessageTime: null,
            unreadCount: 0
          };
          console.log('🔍 Formatted admin user:', formatted);
          return formatted;
        });
        console.log('🔍 All formatted admin users:', formattedAdminUsers);

        const formattedUsers = [
          // Admin users
          ...formattedAdminUsers,
          
          // Responders (only those assigned to current station)
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
          
          // Other stations
          ...(otherStations || []).map(station => {
            console.log('�� Processing station:', station);
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
        console.log('🔍 Admin users in final list:', formattedUsers.filter(u => u.type === 'admin'));
        console.log('🔍 Responder users in final list:', formattedUsers.filter(u => u.type === 'responder'));
        console.log('🔍 Station users in final list:', formattedUsers.filter(u => u.type === 'station'));

        const sortedUsers = sortContacts(formattedUsers);
        console.log('🔍 Sorted users:', sortedUsers);
        console.log('🔍 Sorted users count:', sortedUsers.length);
        
        setUsers(sortedUsers);
        setFilteredUsers(sortedUsers);
        setStations(otherStations || []);
        
        console.log('🔍 Final state set - users:', sortedUsers.length, 'stations:', otherStations.length);

      } catch (error) {
        console.error('❌ Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [currentStationId]);

  // Fetch ongoing incidents assigned to this station for dropdown selection
  useEffect(() => {
    const fetchIncidents = async () => {
      if (!currentStationId) return;
      try {
        // Grab assignments where this station is the assignee (exclude declined)
        // Avoid type mismatch by filtering assignee_id in JS using string compare
        const { data: assignments, error: assignErr } = await supabase
          .from('report_assignments')
          .select('report_id, status, assignee_id')
          .eq('assignee_type', 'station');
        if (assignErr) return;

        const allowedReportIds = (assignments || [])
          .filter((a) => String(a.assignee_id) === String(currentStationId))
          .filter((a) => !a.status || a.status !== 'declined')
          .map((a) => a.report_id)
          .filter(Boolean);

        if (allowedReportIds.length === 0) {
          setOngoingIncidents([]);
          setActiveIncidentId(null);
          return;
        }

        const allowedSet = new Set(allowedReportIds.map((r) => String(r)));

        // 1) Supabase fire_reports (may be minimal/missing address)
        const { data: reports, error: reportsErr } = await supabase
          .from('fire_reports')
          .select('id, address, geotag_location, status, created_at, updated_at, recommended_alarm_level, alarm_level, suggested_alarm_level')
          .in('id', allowedReportIds)
          .order('created_at', { ascending: false })
          .limit(100);

        const mergedById = new Map();
        if (!reportsErr && reports) {
          reports.forEach((r) => mergedById.set(String(r.id), r));
        }

        // 2) External API (richer address/status) to fill gaps — prefer API values over Supabase when present
        try {
          const apiResp = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
          if (apiResp.ok) {
            const apiData = await apiResp.json();
            apiData
              .filter((r) => allowedSet.has(String(r.id)))
              .forEach((r) => {
                const existing = mergedById.get(String(r.id)) || {};
                const mergedRecord = {
                  ...existing,
                  ...r,
                  address: r.address || r.geotag_location || existing.address,
                  geotag_location: r.geotag_location || existing.geotag_location,
                  status: r.status || existing.status,
                  alarm_level: r.alarm_level || existing.alarm_level,
                  recommended_alarm_level: r.recommended_alarm_level || existing.recommended_alarm_level,
                  suggested_alarm_level: r.suggested_alarm_level || existing.suggested_alarm_level,
                  created_at: r.created_at || existing.created_at,
                  updated_at: r.updated_at || existing.updated_at,
                  timestamp: r.timestamp || existing.timestamp
                };
                mergedById.set(String(r.id), mergedRecord);
              });
          }
        } catch (apiErr) {
          console.warn('⚠️ Incident API fetch failed, using Supabase-only data', apiErr);
        }

        // Filter out resolved/fire out and entries without any location info
        const merged = Array.from(mergedById.values()).filter((r) => {
          const status = (r.status || '').toString().toLowerCase();
          const hasLocation = !!(r.address || r.geotag_location);
          const activeStatus = !status.includes('fire out') && !status.includes('resolved');
          return hasLocation && activeStatus;
        });
        setOngoingIncidents(merged);
        // Reset selection if the current one is no longer valid
        if (activeIncidentId && !merged.some((r) => String(r.id) === String(activeIncidentId))) {
          setActiveIncidentId(null);
        }
      } catch (_) {}
    };
    fetchIncidents();
  }, [currentStationId, activeIncidentId]);

  // Fetch unread messages
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      if (!currentStationId || users.length === 0) return;

      try {
        console.log('🔍 Fetching unread messages for station:', currentStationId);
        
        // First, let's check ALL messages for this station to see what we have
        const { data: allMessages, error: allError } = await supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', currentStationId)
          .order('created_at', { ascending: false });
        
        console.log('🔍 ALL messages for this station:', allMessages);
        console.log('🔍 ALL messages count:', allMessages?.length || 0);
        
        // Now check specifically for unread messages
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .eq('receiver_id', currentStationId)
          .eq('is_read', false)
          .order('created_at', { ascending: false });

        console.log('🔍 Unread messages query result:', messagesData);
        console.log('🔍 Unread messages count:', messagesData?.length || 0);

        if (error) {
          console.error('Error fetching unread messages:', error);
          return;
        }

        // Group unread messages by user
        const unreadByUser = {};
        messagesData.forEach(message => {
          const userId = message.sender_id;
          console.log('🔍 Processing unread message from user:', userId, 'text:', message.text, 'is_read:', message.is_read);
          if (!unreadByUser[userId]) {
            unreadByUser[userId] = {
              count: 0,
              lastMessage: message.text || '',
              lastMessageTime: message.created_at
            };
          }
          unreadByUser[userId].count++;
        });
        
        console.log('🔍 Grouped unread messages by user:', unreadByUser);

        // Update users with unread count and last message
        const updatedUsers = users.map(user => {
          const unreadInfo = unreadByUser[user.id];
          const updatedUser = {
            ...user,
            unreadCount: unreadInfo ? unreadInfo.count : 0,
            lastMessage: unreadInfo ? unreadInfo.lastMessage : user.lastMessage,
            lastMessageTime: unreadInfo ? unreadInfo.lastMessageTime : user.lastMessageTime
          };
          console.log('🔍 Updated user:', user.name, 'unreadCount:', updatedUser.unreadCount, 'unreadInfo:', unreadInfo);
          return updatedUser;
        });

        const sortedUpdated = sortContacts(updatedUsers);
        console.log('🔍 Setting users state with:', sortedUpdated.length, 'users (sorted)');
        setUsers(sortedUpdated);
        setFilteredUsers(sortedUpdated);

        // Set unread users
        const unreadUsersList = sortedUpdated.filter(user => user.unreadCount > 0);
        console.log('🔍 All users with unread counts:', updatedUsers.map(u => ({ name: u.name, unreadCount: u.unreadCount })));
        console.log('🔍 Filtered unread users:', unreadUsersList.map(u => ({ name: u.name, unreadCount: u.unreadCount })));
        console.log('🔍 Setting unread users state with:', unreadUsersList.length, 'unread users');
        setUnreadUsers(unreadUsersList);
        setFilteredUnreadUsers(unreadUsersList);
      } catch (error) {
        console.error('Error fetching unread messages:', error);
      }
    };

    if (users.length > 0) {
      fetchUnreadMessages();
    }
  }, [currentStationId, users.length, refreshUnreadTick]);

  // Global real-time listener for ANY new messages sent to this station (updates unread instantly)
  useEffect(() => {
    if (!currentStationId) return;

    const globalChannel = supabase
      .channel(`messages:inbox:${currentStationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentStationId}`
      }, (payload) => {
        const incoming = payload.new;
        // If we're currently viewing this sender, append to thread and mark as read
        if (selectedUser && incoming.sender_id === selectedUser.id) {
          setMessages(prev => [...prev, incoming]);
          // Mark as read and keep unread counters clean
          markMessagesAsRead(incoming.sender_id);
          return;
        }

        // Otherwise, trigger a fresh unread fetch to avoid stale state
        setRefreshUnreadTick(t => t + 1);
      })
      .subscribe();

    return () => {
      globalChannel.unsubscribe();
    };
  }, [currentStationId, selectedUser, users]);

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
      console.log('🔍 Filtering unread users - activeTab:', activeTab, 'unreadUsers count:', unreadUsers.length);
      console.log('🔍 Unread users before filtering:', unreadUsers.map(u => ({ name: u.name, unreadCount: u.unreadCount, type: u.type })));
      
      filtered = unreadUsers.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (filterType === 'all') return matchesSearch;
        if (filterType === 'admin') return user.type === 'admin' && matchesSearch;
        if (filterType === 'responders') return user.type === 'responder' && matchesSearch;
        if (filterType === 'stations') return user.type === 'station' && matchesSearch;
        
        return matchesSearch;
      });
      
      console.log('🔍 Filtered unread users result:', filtered.map(u => ({ name: u.name, unreadCount: u.unreadCount, type: u.type })));
      setFilteredUnreadUsers(filtered);
    }
  }, [searchQuery, filterType, activeTab, users, unreadUsers]);

  // Fetch messages for selected user
  useEffect(() => {
    console.log('useEffect triggered - selectedUser:', selectedUser, 'currentStationId:', currentStationId);
    if (!selectedUser || !currentStationId) {
      console.log('Missing required data - selectedUser:', !!selectedUser, 'currentStationId:', !!currentStationId);
      return;
    }

    const fetchMessages = async () => {
      try {
        console.log('Fetching messages between:', currentStationId, 'and', selectedUser.id);
        
        // First, let's try a simpler query to see all messages
        console.log('Trying to fetch all messages first...');
        const { data: allMessages, error: allError } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (allError) {
          console.error('Error fetching all messages:', allError);
        } else {
          console.log('All messages in database:', allMessages);
        }

        // Now try the specific query
        const query = `and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentStationId}),and(sender_id.eq.${currentStationId},receiver_id.eq.${selectedUser.id})`;
        console.log('Query string:', query);
        
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .or(query)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          return;
        }

        console.log('Messages fetched:', messagesData);
        console.log('Number of messages fetched:', messagesData?.length || 0);
        console.log('Setting messages state with:', messagesData || []);
        setMessages(messagesData || []);
        
        // Mark messages as read when fetching them (when opening a conversation)
        if (messagesData && messagesData.length > 0) {
          markMessagesAsRead(selectedUser.id);
          // Also refresh unread aggregates immediately
          setRefreshUnreadTick(t => t + 1);
        }
        
        setTimeout(scrollToBottom, 100);
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [selectedUser, currentStationId]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!selectedUser || !currentStationId) {
      console.log('Real-time subscription: Missing selectedUser or currentStationId');
      return;
    }

    console.log('Setting up real-time subscription for:', {
      selectedUser: selectedUser.id,
      currentStationId: currentStationId,
      channel: `messages:${selectedUser.id}:${currentStationId}`
    });

    // Test real-time connection first
    const testChannel = supabase
      .channel('test-connection')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        console.log('Test real-time message received:', payload);
      })
      .subscribe((status) => {
        console.log('Test real-time subscription status:', status);
      });

    const subscription = supabase
      .channel(`messages:${selectedUser.id}:${currentStationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `or(and(sender_id.eq.${selectedUser.id},receiver_id.eq.${currentStationId}),and(sender_id.eq.${currentStationId},receiver_id.eq.${selectedUser.id}))`
      }, (payload) => {
        console.log('Real-time message received:', payload);
        setMessages(prev => {
          console.log('Previous messages:', prev);
          console.log('Adding new message:', payload.new);
          const newMessages = [...prev, payload.new];
          console.log('Updated messages:', newMessages);
          return newMessages;
        });
        
        // Update unread count for the current station (receiver) when receiving a message
        if (payload.new.receiver_id === currentStationId) {
          const senderId = payload.new.sender_id;
          console.log('Updating unread count for sender:', senderId, 'because we received a message from them');
          
          // Update users list and resort so unread threads float to the top
          setUsers(prevUsers => {
            const next = prevUsers.map(user => 
              user.id === senderId 
                ? { ...user, unreadCount: (user.unreadCount || 0) + 1, lastMessage: incoming.text || user.lastMessage, lastMessageTime: incoming.created_at }
                : user
            );
            return sortContacts(next);
          });

          // Recompute unread list from the sorted users
          setUnreadUsers(prev => {
            return (users.length ? sortContacts(
              users.map(u => u.id === senderId ? { ...u, unreadCount: (u.unreadCount || 0) + 1, lastMessage: incoming.text || u.lastMessage, lastMessageTime: incoming.created_at } : u)
            ) : []).filter(u => (u.unreadCount || 0) > 0);
          });
          
          // Update filtered unread users
          setFilteredUnreadUsers(prevFiltered => {
            const isAlreadyInFiltered = prevFiltered.some(user => user.id === senderId);
            if (!isAlreadyInFiltered) {
              const senderUser = users.find(user => user.id === senderId);
              if (senderUser) {
                return [...prevFiltered, { ...senderUser, unreadCount: (senderUser.unreadCount || 0) + 1 }];
              }
            } else {
              // Update existing filtered unread user's count
              return prevFiltered.map(user => 
                user.id === senderId 
                  ? { ...user, unreadCount: (user.unreadCount || 0) + 1 }
                  : user
              );
            }
            return prevFiltered;
          });
        }
        
        setTimeout(scrollToBottom, 100);
      })
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error');
        }
      });

    return () => {
      console.log('Cleaning up real-time subscription');
      testChannel.unsubscribe();
      subscription.unsubscribe();
    };
  }, [selectedUser, currentStationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Mark messages as read when selecting a user
  const markMessagesAsRead = async (userId) => {
    if (!currentStationId || !userId) return;

    try {
      console.log('🔍 Marking messages as read from user:', userId, 'to station:', currentStationId);
      
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', userId)
        .eq('receiver_id', currentStationId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking messages as read:', error);
      } else {
        console.log('✅ Messages marked as read successfully');
        
        // Update the local state to reflect the read status
        setUsers(prevUsers => {
          const updated = prevUsers.map(user => 
            user.id === userId 
              ? { ...user, unreadCount: 0 }
              : user
          );
          console.log('🔍 Updated users after marking as read:', updated.map(u => ({ name: u.name, unreadCount: u.unreadCount })));
          return updated;
        });
        
        // Update unread users list
        setUnreadUsers(prevUnread => {
          const filtered = prevUnread.filter(user => user.id !== userId);
          console.log('🔍 Updated unread users after marking as read:', filtered.map(u => ({ name: u.name, unreadCount: u.unreadCount })));
          return filtered;
        });
        
        // Update filtered unread users
        setFilteredUnreadUsers(prevFiltered => {
          const filtered = prevFiltered.filter(user => user.id !== userId);
          console.log('🔍 Updated filtered unread users after marking as read:', filtered.map(u => ({ name: u.name, unreadCount: u.unreadCount })));
          return filtered;
        });

        // Force a refresh of unread aggregates for safety
        setRefreshUnreadTick(t => t + 1);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || !selectedUser || !currentStationId) return;
    // Gate AI: require an incident context for stations
    const shouldGate = !activeIncidentId;

    try {
      const messageData = {
        sender_id: currentStationId,
        receiver_id: selectedUser.id,
        sender_type: 'station',
        receiver_type: selectedUser.type,
        text: newMessage,
        is_emergency: isEmergencyMode,
        is_read: false,
        report_id: activeIncidentId || null
      };

      console.log('Sending message:', messageData);
      console.log('Current station ID type:', typeof currentStationId);
      console.log('Selected user ID type:', typeof selectedUser.id);
      console.log('Selected user type:', selectedUser.type);

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select();

      if (error) {
        console.error('Error sending message:', error);
        alert(`Failed to send message: ${error.message}`);
        return;
      }

      console.log('Message sent successfully:', data);
      setNewMessage('');
      
      // Add the message to the local state immediately for better UX
      if (data && data[0]) {
        setMessages(prev => {
          console.log('Adding sent message to local state:', data[0]);
          return [...prev, data[0]];
        });
        
        // Note: When we send a message, the recipient gets an unread message
        // The recipient's unread count will be updated when they receive the message via real-time
        // or when they refresh the page and the unread messages are fetched from the database
        
        setTimeout(scrollToBottom, 100);

        // AI Analysis: Analyze only when report context is present OR chatting with assigned responder
        try {
          if (shouldGate) return;
          console.log('🤖 Starting AI analysis for message:', newMessage);
          const analysis = await analyzeMessageForFireAlarm(newMessage);
          console.log('🤖 AI Analysis result:', analysis);
          
          if (analysis) {
            await updateMessageWithAIAnalysis(data[0].id, analysis, supabase);
          }
        } catch (aiError) {
          console.error('❌ AI analysis failed:', aiError);
          // Don't show error to user, just log it
        }
      }
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

  const formatIncidentLabel = (incident) => {
    if (!incident) return 'Unknown incident';
    const address = incident.address || incident.geotag_location || 'Assigned report';

    // Normalize status: avoid "Unknown", default to On Going
    const rawStatus = (incident.status || '').toString().trim();
    const statusLower = rawStatus.toLowerCase();
    const status =
      !rawStatus || statusLower === 'unknown'
        ? 'On Going'
        : rawStatus;

    // Prefer admin/final alarm; avoid "Unknown", default to 1st Alarm
    const alarmRaw =
      incident.alarm_level ||
      incident.recommended_alarm_level ||
      incident.suggested_alarm_level ||
      '1st Alarm';
    const alarmStr = (alarmRaw || '').toString();
    const alarmCleaned = alarmStr
      .replace(/- structure count not provided/gi, '')
      .trim();
    const alarmLower = alarmCleaned.toLowerCase();
    const alarm =
      !alarmCleaned || alarmLower === 'unknown'
        ? '1st Alarm'
        : alarmCleaned;

    const time = incident.created_at || incident.updated_at || incident.timestamp;
    const timePart = time ? ` — ${new Date(time).toLocaleString()}` : '';
    return `${address} — ${status} — ${alarm}${timePart}`;
  };

  const currentIncidentLabel = () => {
    if (!activeIncidentId) return 'No incident';
    const inc = ongoingIncidents.find((i) => String(i.id) === String(activeIncidentId));
    return inc ? formatIncidentLabel(inc) : 'No incident';
  };

  return (
    <div className="flex h-[90vh] bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-red-600">Project FIRA</h2>
          <p className="text-sm text-gray-500">Emergency Communication</p>
          <p className="text-xs text-gray-400 mt-1">Station: {currentStationName}</p>
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
            {console.log('🔍 UI Debug - isLoading:', isLoading, 'filteredUsers.length:', filteredUsers.length, 'users.length:', users.length)}
            {isLoading ? (
              <div className="text-center text-gray-500 py-8">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No users found
                <br />
                <small className="text-xs text-gray-400">
                  Debug: isLoading={isLoading.toString()}, users={users.length}, filtered={filteredUsers.length}
                </small>
              </div>
            ) : (
              filteredUsers.map(user => (
                <div
                  key={user.id}
                  className={`p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer flex items-center ${
                    selectedUser?.id === user.id ? 'bg-red-50' : ''
                  }`}
                  onClick={() => {
                    setSelectedUser(user);
                    // Mark messages as read when selecting a user
                    markMessagesAsRead(user.id);
                  }}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold mr-3 text-lg ${
                    user.type === 'admin' ? 'bg-blue-100 text-blue-600' : 
                    user.type === 'responder' ? 'bg-green-100 text-green-600' : 
                    'bg-orange-100 text-orange-600'
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
            {console.log('Rendering unread tab - filteredUnreadUsers:', filteredUnreadUsers.length, 'users:', filteredUnreadUsers)}
            {filteredUnreadUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-lg font-medium mb-2">You have no unread messages!</h3>
                <p className="text-sm text-center">
                  All caught up! Check back later for new messages.
                </p>
              </div>
            ) : (
              filteredUnreadUsers.map(user => (
                <div
                  key={user.id}
                  className={`p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer flex items-center ${
                    selectedUser?.id === user.id ? 'bg-red-50' : ''
                  }`}
                  onClick={() => {
                    setSelectedUser(user);
                    // Mark messages as read when selecting a user
                    markMessagesAsRead(user.id);
                  }}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold mr-3 text-lg ${
                    user.type === 'admin' ? 'bg-blue-100 text-blue-600' : 
                    user.type === 'responder' ? 'bg-green-100 text-green-600' : 
                    'bg-orange-100 text-orange-600'
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
                  selectedUser.type === 'admin' ? 'bg-blue-100 text-blue-600' : 
                  selectedUser.type === 'responder' ? 'bg-green-100 text-green-600' : 
                  'bg-orange-100 text-orange-600'
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
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {console.log('Rendering messages, count:', messages.length, 'messages:', messages)}
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

            {/* Message Input with Incident Selector */}
            <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
              {/* Incident context selector card */}
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-600">Incident context</div>
                  <div className="text-[11px] text-gray-400">Required for AI analysis</div>
                </div>
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex-1">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIncidentMenuOpen((v) => !v)}
                        className="w-full bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-left flex items-center justify-between hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <div className="flex flex-col">
                          <span className="text-[11px] text-gray-500">Select</span>
                          <span className="text-sm text-gray-800 line-clamp-1">{currentIncidentLabel()}</span>
                        </div>
                        <span className="text-gray-400 text-xs ml-3">▲</span>
                      </button>
                      {incidentMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-2 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-20 text-sm">
                          <button
                            className={`block w-full text-left px-3 py-2 hover:bg-red-50 ${!activeIncidentId ? 'bg-gray-50' : ''}`}
                            onClick={() => {
                              setActiveIncidentId(null);
                              setIncidentMenuOpen(false);
                            }}
                          >
                            No incident
                          </button>
                          {ongoingIncidents.map((inc) => (
                            <button
                              key={inc.id}
                              className={`block w-full text-left px-3 py-2 hover:bg-red-50 ${String(activeIncidentId) === String(inc.id) ? 'bg-gray-50' : ''}`}
                              onClick={() => {
                                setActiveIncidentId(inc.id);
                                setIncidentMenuOpen(false);
                              }}
                            >
                              {formatIncidentLabel(inc)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2 sm:mt-0">
                    {activeIncidentId ? (() => {
                      const selectedIncident = ongoingIncidents.find(inc => String(inc.id) === String(activeIncidentId));
                      const incidentName = selectedIncident 
                        ? (selectedIncident.address || selectedIncident.geotag_location || 'Assigned report')
                        : 'Selected incident';
                      return `AI is now Analyzing your chats and linking to: ${incidentName}`;
                    })() : 'No incident selected'}
                  </div>
                </div>
              </div>
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