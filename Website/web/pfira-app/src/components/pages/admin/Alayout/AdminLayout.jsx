import React, { useState, useEffect, useRef } from 'react';
import { FiMenu, FiX, FiBell, FiUser, FiSettings, FiLogOut, FiUsers, FiFileText, FiPieChart, FiShoppingCart } from 'react-icons/fi';
import { GrOverview } from "react-icons/gr";
import { FaMapLocationDot } from "react-icons/fa6";
import { IoIosNotifications } from "react-icons/io";
import { LuMessageCircleMore } from "react-icons/lu";
import { FaUserFriends } from "react-icons/fa";
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useNotifications } from '../../../../contexts/NotificationContext';
import NotificationToast from '../../../common/NotificationToast';

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);
  
  // Use global notification context
  const { notifications, unreadCount, markAsRead } = useNotifications();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleProfile = () => setProfileOpen(!profileOpen);
  const toggleNotifications = () => setNotificationsOpen(!notificationsOpen);


  // Handle clicks outside dropdowns
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

  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Just now';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin} min${diffMin !== 1 ? 's' : ''} ago`;
    if (diffHrs < 24) return `${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleLogout = async () => {
    try {
      // Clear all authentication data (both session and local)
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('userType');
      sessionStorage.removeItem('loginTime');
      sessionStorage.removeItem('adminNotifications');
      sessionStorage.removeItem('adminUser');
      sessionStorage.removeItem('adminAuth');
      sessionStorage.removeItem('userData');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userType');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('adminNotifications');
      localStorage.removeItem('adminUser');
      localStorage.removeItem('adminAuth');
      localStorage.removeItem('userData');
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error during logout. Please try again.');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-20'} bg-red-700 text-white transition-all duration-300 ease-in-out shadow-2xl`}>
        <div className="flex items-center justify-between p-6 border-b-2 border-red-800">
          {sidebarOpen ? (
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Command Center</h1>
              <p className="text-xs text-red-200 mt-1 font-medium">Admin Control Panel</p>
            </div>
          ) : (
            null
          )}
          <button onClick={toggleSidebar} className="text-white hover:bg-red-800 p-2 rounded-lg transition-all">
            {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
        
        <nav className="mt-8 px-3">
          <SidebarItem icon={<FaMapLocationDot size={22} />} text="Map Dashboard" to="/admin-dashboard" active={location.pathname === '/admin-dashboard'} collapsed={!sidebarOpen} />
          <SidebarItem icon={<GrOverview size={22} />} text="Overview" to="/admin-dashboard/overall" active={location.pathname === '/admin-dashboard/overall'} collapsed={!sidebarOpen} />
          <SidebarItem 
            icon={<IoIosNotifications size={22} />} 
            text="Notification" 
            to="/admin-dashboard/notification" 
            active={location.pathname === '/admin-dashboard/notification'} 
            collapsed={!sidebarOpen}
            badge={unreadCount > 0 ? unreadCount : null}
          />
          <SidebarItem icon={<FaUserFriends size={22} />} text="User Management" to="/admin-dashboard/user-management" active={location.pathname === '/admin-dashboard/user-management'} collapsed={!sidebarOpen} />
          <SidebarItem icon={<LuMessageCircleMore size={22} />} text="FIRA Chat" to="/admin-dashboard/fira-chat" active={location.pathname === '/admin-dashboard/fira-chat'} collapsed={!sidebarOpen} />
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
                if (path.includes('overall')) return 'Overview';
                if (path.includes('map')) return 'Map Dashboard';
                if (path.includes('admin-dashboard')) return 'Map Dashboard';
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
                        {console.log('🔔 Rendering notifications dropdown, count:', notifications.length)}
                        {console.log('🔔 First 5 notifications:', notifications.slice(0, 5))}
                        {notifications.slice(0, 5).map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-5 py-4 hover:bg-red-50 cursor-pointer transition-colors duration-150 ${
                              !notification.is_read ? 'bg-orange-50 border-l-4 border-l-red-600' : 'border-l-4 border-l-transparent'
                            }`}
                            onClick={() => {
                              // Store debug info before page reloads
                              const debugInfo = {
                                notificationId: notification.id,
                                relatedReportId: notification.related_report_id,
                                hasRelatedId: !!notification.related_report_id,
                                timestamp: Date.now()
                              };
                              localStorage.setItem('lastNotificationClick', JSON.stringify(debugInfo));
                              
                              // DON'T mark as read here - only mark as read when user clicks checkmark on notification page
                              // This keeps the alarm sounding until explicitly dismissed
                              
                              // If notification has related_report_id, navigate to map with that report
                              if (notification.related_report_id) {
                                localStorage.setItem('selectedReportId', notification.related_report_id);
                                
                                // If already on admin-dashboard, trigger reload to pick up the new selectedReportId
                                if (location.pathname === '/admin-dashboard') {
                                  window.location.reload();
                                } else {
                                  navigate('/admin-dashboard');
                                }
                              } else {
                                navigate('/admin-dashboard/notification');
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
                          to="/admin-dashboard/notification"
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
                  <div className="w-10 h-10 bg-red-700 rounded-full flex items-center justify-center text-white shadow-md hover:bg-red-800 transition-colors duration-200">
                    <FiUser size={18} />
                  </div>
                  {sidebarOpen && <span className="text-gray-800 font-medium">Admin</span>}
                </button>
                
                {profileOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-20">
                    <div className="px-4 py-3 bg-gradient-to-r from-red-700 to-red-800 border-b border-red-900">
                      <p className="text-white font-semibold text-sm">Admin Account</p>
                      <p className="text-red-100 text-xs mt-0.5">System Administrator</p>
                    </div>
                    <div className="py-2">
                      <Link to="/admin-dashboard/profile" className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors duration-150 group">
                        <FiUser className="mr-3 text-gray-400 group-hover:text-red-600" size={18} /> 
                        <span className="font-medium">Profile</span>
                      </Link>
                      <Link to="/admin-dashboard/settings" className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors duration-150 group">
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
          <Outlet />
        </main>
        
        {/* Toast Notifications */}
        <NotificationToast />
      </div>
    </div>
  );
};

// Sidebar Item Component
const SidebarItem = ({ icon, text, to = '#', active = false, collapsed, badge = null }) => {
  return (
    <Link 
      to={to}
      className={`flex items-center px-4 py-4 mb-2 rounded-lg font-semibold text-sm ${
        active 
          ? 'bg-white text-red-700 shadow-lg' 
          : 'text-white hover:bg-red-800 hover:shadow-md'
      } transition-all duration-200 relative group`}>
      <span className={`${active ? 'text-red-700' : 'text-white group-hover:text-white'} transition-colors`}>
        {icon}
      </span>
      {!collapsed && <span className="ml-4 uppercase tracking-wide text-xs font-bold">{text}</span>}
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

export default AdminLayout;