import React, { useState, useEffect, useRef } from 'react';
import { FiMenu, FiX, FiBell, FiUser, FiSettings, FiLogOut, FiUsers, FiMessageCircle } from 'react-icons/fi';
import { GrOverview } from "react-icons/gr";
import { FaMapLocationDot } from "react-icons/fa6";
import { IoIosNotifications } from "react-icons/io";
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { supabase } from '../../../../config/supabase';
import { getProfilePictureUrl } from '../../../../services/profilePictureService';
import StationNotificationToast from '../../../common/StationNotificationToast';

const StationLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stationData, setStationData] = useState({
    station_name: 'Loading...',
    email: 'Loading...',
    address: 'Loading...'
  });
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const location = useLocation();
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);
  const audioRef = useRef(null);
  const previousUnreadCountRef = useRef(0);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleProfile = () => setProfileOpen(!profileOpen);
  const toggleNotifications = () => setNotificationsOpen(!notificationsOpen);

  // Fetch station data from localStorage or Supabase
  const fetchStationData = async () => {
    try {
      // First try to get from localStorage
      const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
      console.log('🔍 UserData from localStorage:', userData);
      
      // Seed synchronously from localStorage so children have data on first paint
      if (userData && (userData.station_name || userData.email || userData.address)) {
        setStationData({
          station_name: userData.station_name || 'Station Name',
          email: userData.email || 'station@email.com',
          address: userData.address || 'Address not specified'
        });
      }

      if (userData.id) {
        console.log('🔍 Looking up station with ID:', userData.id);
        // If we have userData, try to fetch from Supabase for latest info
        const { data: stationInfo, error } = await supabase
          .from('station_users')
          .select('station_name, email, address, lat, lng, profile_picture_url')
          .eq('id', userData.id)
          .single();
        
        console.log('🔍 Supabase query result:', { stationInfo, error });
        
        // Fetch profile picture
        if (stationInfo) {
          let picUrl = stationInfo.profile_picture_url;
          if (!picUrl) {
            picUrl = await getProfilePictureUrl(userData.id, 'station');
          }
          if (picUrl) {
            setProfilePictureUrl(picUrl);
            console.log('✅ Profile picture loaded:', picUrl);
          }
        }
        
        if (error) {
          console.error('Error fetching station data:', error);
          // Try alternative lookup by email
          console.log('🔄 Trying alternative lookup by email:', userData.email);
            const { data: stationByEmail, error: emailError } = await supabase
            .from('station_users')
            .select('station_name, email, address, lat, lng')
            .eq('email', userData.email)
            .single();
          
          console.log('🔍 Email lookup result:', { stationByEmail, emailError });
          
          if (emailError) {
            console.error('Email lookup also failed:', emailError);
            // Fallback to localStorage data
            setStationData({
              station_name: userData.station_name || 'Station Name',
              email: userData.email || 'station@email.com',
              address: userData.address || 'Address not specified'
            });
          } else if (stationByEmail) {
            console.log('✅ Found station by email:', stationByEmail);
            setStationData({
              station_name: stationByEmail.station_name || 'Station Name',
              email: stationByEmail.email || 'station@email.com',
              address: stationByEmail.address || 'Address not specified',
              lat: stationByEmail.lat ?? null,
              lng: stationByEmail.lng ?? null
            });
          }
        } else if (stationInfo) {
          console.log('✅ Found station by ID:', stationInfo);
          setStationData({
            station_name: stationInfo.station_name || 'Station Name',
            email: stationInfo.email || 'station@email.com',
            address: stationInfo.address || 'Address not specified',
            lat: stationInfo.lat ?? null,
            lng: stationInfo.lng ?? null
          });
        }
      } else {
        console.log('❌ No userData.id found, using fallback');
        // Fallback to default values
        setStationData({
          station_name: 'Station Name',
          email: 'station@email.com',
          address: 'Address not specified'
        });
      }
    } catch (error) {
      console.error('Error fetching station data:', error);
      setStationData({
        station_name: 'Station Name',
        email: 'station@email.com',
        address: 'Address not specified'
      });
    }
  };

  const handleLogout = async () => {
    try {
      // Clear all authentication data (both session and local)
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userType');
      sessionStorage.removeItem('loginTime');
      sessionStorage.removeItem('stationNotifications');
      sessionStorage.removeItem('stationUser');
      sessionStorage.removeItem('stationAuth');
      sessionStorage.removeItem('userData');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userType');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('stationNotifications');
      localStorage.removeItem('stationUser');
      localStorage.removeItem('stationAuth');
      localStorage.removeItem('userData');
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error during logout. Please try again.');
    }
  };

  // Load station notifications from Supabase (persistent) with real-time sync
  useEffect(() => {
    let channel = null;
    
    const load = async () => {
      try {
        const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
        const stationId = userData?.id;
        if (!stationId) return;
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', stationId)
          .eq('user_type', 'station')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          setNotifications(data);
          // Only count unread ASSIGNMENT notifications for alarm (same as mobile)
          const newUnreadCount = data.filter(n => !n.is_read && n.type === 'assignment').length;
          setUnreadCount(newUnreadCount);
          console.log('🔔 StationLayout: Loaded notifications, unread assignment count:', newUnreadCount);
        }
      } catch (e) {
        // noop
      }
    };
    
    // Initial load
    load();
    
    // Poll every 4 seconds as backup
    const interval = setInterval(load, 4000);
    
    // Set up real-time subscription for instant updates
    const setupRealtimeSubscription = async () => {
      try {
        const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
        const stationId = userData?.id;
        if (!stationId) return;
        
        console.log('🔔 StationLayout: Setting up real-time subscription for station:', stationId);
        
        channel = supabase
          .channel(`station-notifications-layout:${stationId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${stationId}`
          }, (payload) => {
            console.log('🔔 StationLayout: Real-time INSERT detected:', payload.new);
            if (payload.new?.user_type === 'station') {
              load(); // Reload all notifications
              // If it's an assignment notification, log it
              if (payload.new?.type === 'assignment') {
                console.log('🔥 StationLayout: New assignment notification received');
              }
            }
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${stationId}`
          }, (payload) => {
            console.log('🔔 StationLayout: Real-time UPDATE detected:', payload.new);
            if (payload.new?.user_type === 'station') {
              // Immediately update the notification in state and recalculate unread count
              setNotifications(prev => {
                const updated = prev.map(n => n.id === payload.new.id ? payload.new : n);
                // Only count unread ASSIGNMENT notifications for alarm (same as mobile)
                const newUnreadCount = updated.filter(n => !n.is_read && n.type === 'assignment').length;
                setUnreadCount(newUnreadCount);
                console.log('🔔 StationLayout: Real-time update - new unread assignment count:', newUnreadCount);
                return updated;
              });
            }
          })
          .subscribe((status) => {
            console.log('🔔 StationLayout: Subscription status:', status);
          });
      } catch (error) {
        console.error('🔔 StationLayout: Error setting up real-time subscription:', error);
      }
    };
    
    setupRealtimeSubscription();
    
    return () => {
      clearInterval(interval);
      if (channel) {
        console.log('🔔 StationLayout: Unsubscribing from real-time channel');
        channel.unsubscribe();
      }
    };
  }, []);

  // Global alarm control - manages fire alarm sound based on unread notifications
  useEffect(() => {
    const startAlarm = async () => {
      try {
        if (!audioRef.current) {
          const audio = new Audio('/assets/sounds/fire_alarm_sound.mp3');
          audio.preload = 'auto';
          audio.volume = 1.0;
          audio.loop = true;
          audioRef.current = audio;
          window.__stationAlarmAudio = audio;
        }
        
        const audio = audioRef.current;
        if (audio.paused) {
          audio.currentTime = 0;
          await audio.play();
          console.log('🔊 StationLayout: Alarm started');
        }
      } catch (error) {
        console.warn('🔊 StationLayout: Could not start alarm (may need user interaction):', error);
      }
    };

    const stopAlarm = () => {
      try {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          console.log('🔇 StationLayout: Alarm stopped');
        }
      } catch (error) {
        console.warn('🔇 StationLayout: Error stopping alarm:', error);
      }
    };

    const previousCount = previousUnreadCountRef.current;
    const currentCount = unreadCount;
    previousUnreadCountRef.current = currentCount;

    console.log(`🔔 StationLayout: Unread count changed from ${previousCount} to ${currentCount}`);

    if (currentCount > 0) {
      console.log('🔊 StationLayout: Unread notifications exist, starting alarm...');
      startAlarm();
    } else if (currentCount === 0 && previousCount > 0) {
      console.log('🔇 StationLayout: All notifications marked as read, stopping alarm...');
      stopAlarm();
    }

    // Cleanup on unmount
    return () => {
      // Don't stop alarm on unmount - let it continue playing across pages
    };
  }, [unreadCount]);

  // Debug function to check station_users table
  const debugStationTable = async () => {
    try {
      console.log('🔍 Debugging station_users table...');
      const { data: allStations, error } = await supabase
        .from('station_users')
        .select('*');
      
      if (error) {
        console.error('❌ Error fetching all stations:', error);
      } else {
        console.log('📊 All stations in database:', allStations);
        console.log('📊 Total stations:', allStations.length);
      }
    } catch (error) {
      console.error('❌ Debug error:', error);
    }
  };

  // Fetch station data on component mount
  useEffect(() => {
    fetchStationData();
    debugStationTable(); // Add debug call
  }, []);

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const markNotificationAsRead = (id) => {
    const updatedNotifications = notifications.map(notification =>
      notification.id === id ? { ...notification, is_read: true } : notification
    );
    setNotifications(updatedNotifications);
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (_) {}
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Just now';
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-20'} bg-red-700 text-white transition-all duration-300 ease-in-out shadow-2xl`}>
        <div className="flex items-center justify-between p-6 border-b border-red-800">
          {sidebarOpen ? (
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-white tracking-wide uppercase">
                STATION CONTROL
              </h1>
              <p className="text-xs text-red-100 mt-1 font-medium">
                {stationData.station_name}
              </p>
              <p className="text-xs text-red-200 truncate max-w-48">
                {stationData.email}
              </p>
            </div>
          ) : (
            null
          )}
          <button onClick={toggleSidebar} className="text-white hover:bg-red-800 p-2 rounded-lg transition-colors duration-200">
            {sidebarOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>
        <nav className="mt-8 px-3">
          <SidebarItem icon={<FaMapLocationDot size={20} />} text="Map Dashboard" to="/station-dashboard" active={location.pathname === '/station-dashboard'} collapsed={!sidebarOpen} />
          <SidebarItem icon={<GrOverview size={20} />} text="Overview" to="/station-dashboard/overall" active={location.pathname === '/station-dashboard/overall'} collapsed={!sidebarOpen} />
          <SidebarItem 
            icon={<IoIosNotifications size={20} />} 
            text="Notification" 
            to="/station-dashboard/notification" 
            active={location.pathname === '/station-dashboard/notification'} 
            collapsed={!sidebarOpen}
            badge={unreadCount > 0 ? unreadCount : null}
          />
          <SidebarItem icon={<FiMessageCircle size={20} />} text="FIRA Chat" to="/station-dashboard/fira-chat" active={location.pathname === '/station-dashboard/fira-chat'} collapsed={!sidebarOpen} />
          <SidebarItem icon={<FiUsers size={20} />} text="User Management" to="/station-dashboard/user-management" active={location.pathname === '/station-dashboard/user-management'} collapsed={!sidebarOpen} />
        </nav>
      </div>
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {(() => {
                const path = location.pathname;
                if (path.includes('user-management')) return 'User Management';
                if (path.includes('fira-chat')) return 'FIRA Chat';
                if (path.includes('notification')) return 'Notifications';
                if (path.includes('overall')) return 'Overview Dashboard';
                if (path.includes('station-dashboard') && !path.includes('/')) return 'Map Dashboard';
                return 'Project FIRA';
              })()}
            </h2>
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={toggleNotifications}
                  className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none transition-colors duration-200"
                >
                  <FiBell size={22} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 mt-3 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-20">
                    <div className="px-5 py-4 bg-gradient-to-r from-red-700 to-red-800 border-b border-red-900">
                      <h3 className="text-base font-semibold text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <p className="text-xs text-red-100 mt-0.5">{unreadCount} unread message{unreadCount > 1 ? 's' : ''}</p>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-6 py-12 text-center text-gray-500">
                        <FiBell className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-sm font-medium">No notifications</p>
                        <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {notifications.slice(0, 5).map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-5 py-4 hover:bg-red-50 cursor-pointer transition-colors duration-150 ${
                              !notification.is_read ? 'bg-orange-50 border-l-4 border-l-red-600' : 'border-l-4 border-l-transparent'
                            }`}
                            onClick={() => {
                              setNotificationsOpen(false);
                              // If notification has related_report_id, navigate to map with that report
                              if (notification.related_report_id) {
                                localStorage.setItem('selectedReportId', notification.related_report_id);
                                window.location.href = '/station-dashboard';
                              } else {
                                // Otherwise go to notifications page
                                window.location.href = '/station-dashboard/notification';
                              }
                            }}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 mt-0.5">
                                <span className="text-2xl">🔥</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-600 truncate mt-0.5">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1.5">
                                  {formatDate(notification.created_at)}
                                </p>
                              </div>
                              {!notification.is_read && (
                                <div className="flex-shrink-0">
                                  <div className="h-2.5 w-2.5 bg-red-600 rounded-full shadow-sm"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {notifications.length > 5 && (
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
                        <Link
                          to="/station-dashboard/notification"
                          className="text-sm text-red-600 hover:text-red-800 font-semibold flex items-center justify-center group"
                          onClick={() => setNotificationsOpen(false)}
                        >
                          View all notifications
                          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button 
                  onClick={toggleProfile}
                  className="flex items-center space-x-3 focus:outline-none hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors duration-200"
                >
                  {profilePictureUrl ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden shadow-md ring-2 ring-red-600 hover:ring-red-700 transition-all duration-200">
                      <img 
                        src={profilePictureUrl} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-red-700 rounded-full flex items-center justify-center text-white shadow-md hover:bg-red-800 transition-colors duration-200">
                      <FiUser size={18} />
                    </div>
                  )}
                  {sidebarOpen && <span className="text-gray-800 font-medium truncate max-w-32">{stationData.station_name}</span>}
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-20">
                    <div className="px-4 py-3 bg-gradient-to-r from-red-700 to-red-800 border-b border-red-900">
                      <p className="text-white font-semibold text-sm truncate">{stationData.station_name}</p>
                      <p className="text-red-100 text-xs mt-0.5 truncate">{stationData.email}</p>
                    </div>
                    <div className="py-2">
                      <Link to="/station-dashboard/profile" className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors duration-150 group">
                        <FiUser className="mr-3 text-gray-400 group-hover:text-red-600" size={18} /> 
                        <span className="font-medium">Profile</span>
                      </Link>
                      <Link to="/station-dashboard/settings" className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors duration-150 group">
                        <FiSettings className="mr-3 text-gray-400 group-hover:text-red-600" size={18} /> 
                        <span className="font-medium">Settings</span>
                      </Link>
                    </div>
                    <div className="border-t border-gray-200"></div>
                    <div className="py-2">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 group"
                      >
                        <FiLogOut className="mr-3 group-hover:text-red-700" size={18} /> 
                        <span className="font-medium">Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <Outlet context={{ stationData }} />
        </main>
        
        {/* Station Toast Notifications */}
        <StationNotificationToast />
      </div>
    </div>
  );
};

// Sidebar Item Component
const SidebarItem = ({ icon, text, to = '#', active = false, collapsed, badge = null }) => {
  return (
    <Link 
      to={to}
      className={`flex items-center px-4 py-4 mb-2 rounded-lg group ${active ? 'bg-white text-red-700 shadow-lg' : 'hover:bg-red-800 hover:shadow-md'} transition-all duration-200 relative`}>
      <span className={`${active ? 'text-red-700' : 'text-white group-hover:text-white'}`}>
        {icon}
      </span>
      {!collapsed && <span className="ml-4 font-medium tracking-wide uppercase text-sm">{text}</span>}
      {badge && !collapsed && (
        <span className="ml-auto bg-yellow-400 text-red-900 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-md">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {badge && collapsed && (
        <span className="absolute -top-1 -right-1 bg-yellow-400 text-red-900 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
};

export default StationLayout;