import React, { useState, useEffect, useRef } from 'react';
import { FiMenu, FiX, FiBell, FiUser, FiSettings, FiLogOut, FiUsers, FiFileText, FiPieChart, FiShoppingCart } from 'react-icons/fi';
import { GrOverview } from "react-icons/gr";
import { FaMapLocationDot } from "react-icons/fa6";
import { IoIosNotifications } from "react-icons/io";
import { LuMessageCircleMore } from "react-icons/lu";
import { FaUserFriends } from "react-icons/fa";
import { Link, useLocation, Outlet } from 'react-router-dom';

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const location = useLocation();
  const profileRef = useRef(null);
  const notificationsRef = useRef(null);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleProfile = () => setProfileOpen(!profileOpen);
  const toggleNotifications = () => setNotificationsOpen(!notificationsOpen);

  // Load notifications from localStorage
  useEffect(() => {
    const loadNotifications = () => {
      const storedNotifications = JSON.parse(localStorage.getItem('adminNotifications') || '[]');
      setNotifications(storedNotifications);
    };

    loadNotifications();

    // Listen for storage changes (when new notifications are added)
    const handleStorageChange = (e) => {
      if (e.key === 'adminNotifications') {
        loadNotifications();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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

  const unreadCount = notifications.filter(n => !n.read).length;

  const markNotificationAsRead = (id) => {
    const updatedNotifications = notifications.map(notification =>
      notification.id === id ? { ...notification, read: true } : notification
    );
    setNotifications(updatedNotifications);
    localStorage.setItem('adminNotifications', JSON.stringify(updatedNotifications));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userType');
    localStorage.removeItem('loginTime');
    localStorage.removeItem('adminNotifications');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminAuth');
    
    // Show logout message
    alert('Logged out successfully!');
    
    // Redirect to login page
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-red-700 text-white transition-all duration-300 ease-in-out`}>
        <div className="flex items-center justify-between p-4 border-b border-red-800">
          {sidebarOpen ? (
            <h1 className="text-xl font-bold">Command Center</h1>
          ) : (
            null
          )}
          <button onClick={toggleSidebar} className="text-white hover:text-blue-200">
            {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
        
        <nav className="mt-6">
          <SidebarItem icon={<FaMapLocationDot size={20} />} text="Map Dashboard" to="/admin-dashboard" active={location.pathname === '/admin-dashboard'} collapsed={!sidebarOpen} />
          <SidebarItem icon={<GrOverview size={20} />} text="Overview" to="/admin-dashboard/overall" active={location.pathname === '/admin-dashboard/overall'} collapsed={!sidebarOpen} />
          <SidebarItem 
            icon={<IoIosNotifications size={20} />} 
            text="Notification" 
            to="/admin-dashboard/notification" 
            active={location.pathname === '/admin-dashboard/notification'} 
            collapsed={!sidebarOpen}
            badge={unreadCount > 0 ? unreadCount : null}
          />
          <SidebarItem icon={<FaUserFriends size={20} />} text="User Management" to="/admin-dashboard/user-management" active={location.pathname === '/admin-dashboard/user-management'} collapsed={!sidebarOpen} />
          <SidebarItem icon={<LuMessageCircleMore size={20} />} text="FIRA Chat" to="/admin-dashboard/fira-chat" active={location.pathname === '/admin-dashboard/fira-chat'} collapsed={!sidebarOpen} />
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
                  className="relative p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <FiBell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 z-20 max-h-96 overflow-y-auto">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <p className="text-xs text-gray-500">{unreadCount} unread</p>
                      )}
                    </div>
                    
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500">
                        <FiBell className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm">No notifications</p>
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto">
                        {notifications.slice(0, 5).map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                              !notification.read ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => markNotificationAsRead(notification.id)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <FiBell className="h-4 w-4 text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {notification.title}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {formatDate(notification.timestamp)}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="flex-shrink-0">
                                  <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {notifications.length > 5 && (
                      <div className="px-4 py-2 border-t border-gray-200">
                        <Link
                          to="/admin-dashboard/notification"
                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                          onClick={() => setNotificationsOpen(false)}
                        >
                          View all notifications
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
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  <div className="w-8 h-8 bg-red-700 rounded-full flex items-center justify-center text-white">
                    <FiUser size={16} />
                  </div>
                  {sidebarOpen && <span className="text-gray-700">Admin</span>}
                </button>
                
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20">
                    <Link to="/admin-dashboard/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-600 hover:text-amber-50 flex items-center">
                      <FiUser className="mr-2" /> Profile
                    </Link>
                    <Link to="/admin-dashboard/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-600 hover:text-amber-50 flex items-center">
                      <FiSettings className="mr-2" /> Settings
                    </Link>
                    <div className="border-t border-gray-200"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-600 hover:text-amber-50 flex items-center"
                    >
                      <FiLogOut className="mr-2" /> Logout
                    </button>
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
      </div>
    </div>
  );
};

// Sidebar Item Component
const SidebarItem = ({ icon, text, to = '#', active = false, collapsed, badge = null }) => {
  return (
    <Link 
      to={to}
      className={`flex items-center px-4 py-3 ${active ? 'bg-white text-red-700' : 'hover:bg-white hover:text-red-700 '} transition-colors duration-200 relative`}>
      <span className={active ? 'text-red-700' : ' hover:text-red-700'}>
        {icon}
      </span>
      {!collapsed && <span className="ml-3">{text}</span>}
      {badge && !collapsed && (
        <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {badge && collapsed && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
};

export default AdminLayout;