import React, { useState } from 'react';
import { FiBell, FiX, FiUser, FiFileText, FiCheck, FiClock, FiTrash2 } from 'react-icons/fi';
import { useNotifications } from '../../../../contexts/NotificationContext';

const Notification = () => {
  const [filter, setFilter] = useState('all'); // all, unread, read
  const {
    notifications,
    loading,
    unreadCount,
    audioEnabled,
    audioBlocked,
    playAlert,
    stopAlert,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    setAudioEnabled,
    setAudioBlocked,
    checkForNewFireReports,
    resetFireReportMonitoring
  } = useNotifications();

  // Do NOT stop alarm just by opening the page; only stop on mark-as-read


  const getNotificationIcon = (type) => {
    switch (type) {
      case 'fire_alert':
      case 'emergency':
        return <FiBell className="text-red-600" />;
      case 'assignment':
        return <FiFileText className="text-blue-600" />;
      case 'user_action':
      case 'new_registration':
        return <FiUser className="text-purple-600" />;
      case 'system':
      case 'info':
        return <FiClock className="text-gray-600" />;
      default:
        return <FiBell className="text-gray-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'fire_alert':
      case 'emergency':
        return 'bg-red-50 border-red-200';
      case 'assignment':
        return 'bg-blue-50 border-blue-200';
      case 'user_action':
      case 'new_registration':
        return 'bg-purple-50 border-purple-200';
      case 'system':
      case 'info':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.is_read;
    if (filter === 'read') return notification.is_read;
    return true;
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* Filters and Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
            <div className="flex space-x-2">
              <button
                onClick={loadNotifications}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'all' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'unread' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-4 py-2 rounded-lg font-medium ${
                filter === 'read' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Read ({notifications.length - unreadCount})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <FiBell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">No notifications found</p>
              <p className="text-gray-400 text-sm mt-1">
                {filter === 'all' ? 'You\'re all caught up!' : 
                 filter === 'unread' ? 'No unread notifications' : 'No read notifications'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm border-l-4 ${
                  notification.priority === 'urgent' ? 'border-l-red-600' : 
                  notification.priority === 'high' ? 'border-l-orange-600' : 
                  'border-l-blue-600'
                } p-4 ${
                  !notification.is_read ? 'ring-2 ring-red-100' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            New
                          </span>
                        )}
                        {notification.priority === 'urgent' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white">
                            URGENT
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <FiClock className="mr-1" />
                          {formatDate(notification.created_at)}
                        </span>
                        <span className="flex items-center capitalize">
                          {notification.type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {!notification.is_read && (
                      <button
                        onClick={() => {
                          markAsRead(notification.id);
                          stopAlert();
                        }}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Mark as read"
                      >
                        <FiCheck size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete notification"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Notification;