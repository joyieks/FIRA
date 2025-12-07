import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiBell, FiX, FiAlertTriangle } from 'react-icons/fi';
import { useNotifications } from '../../contexts/NotificationContext';

const NotificationToast = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, markAsRead, stopAlert } = useNotifications();
  const [toastNotifications, setToastNotifications] = useState([]);
  const [processedIds, setProcessedIds] = useState(new Set());

  useEffect(() => {
    // Don't show toasts on the notification page itself
    if (location.pathname === '/admin-dashboard/notification') {
      return;
    }

    // Check for new unread notifications
    const newNotifications = notifications.filter(
      notification => 
        !notification.is_read && 
        !processedIds.has(notification.id)
    );

    if (newNotifications.length > 0) {
      // Add new notifications to toast queue
      setToastNotifications(prev => {
        const uniqueNew = newNotifications.filter(
          newNotif => !prev.some(existing => existing.id === newNotif.id)
        );
        return [...prev, ...uniqueNew];
      });

      // Mark as processed
      setProcessedIds(prev => {
        const newSet = new Set(prev);
        newNotifications.forEach(notif => newSet.add(notif.id));
        return newSet;
      });
    }
  }, [notifications, location.pathname]);

  // Remove toasts that have been marked as read
  useEffect(() => {
    setToastNotifications(prev => 
      prev.filter(toast => {
        const current = notifications.find(n => n.id === toast.id);
        // Keep toast only if notification is still unread
        return current && !current.is_read;
      })
    );
  }, [notifications]);

  const dismissToast = (notificationId) => {
    console.log('🗑️ Dismissing toast:', notificationId);
    setToastNotifications(prev => 
      prev.filter(notif => notif.id !== notificationId)
    );
    // Also mark as processed so it doesn't come back
    setProcessedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(notificationId);
      return newSet;
    });
  };

  const handleToastClick = async (notification) => {
    console.log('🔔 Toast clicked:', notification.id);
    
    // Dismiss the toast immediately
    dismissToast(notification.id);
    
    // Stop alarm immediately
    stopAlert();
    
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    if (notification.related_report_id) {
      // Store the report ID in localStorage for Adashboard to pick up
      localStorage.setItem('selectedReportId', notification.related_report_id);
      // Add timestamp to force reload detection
      localStorage.setItem('lastNotificationClick', JSON.stringify({
        reportId: notification.related_report_id,
        timestamp: Date.now()
      }));
      // Tell the page to stop alarm on load
      localStorage.setItem('stopAlarmOnLoad', 'true');
      
      // Navigate to the map dashboard with a small delay to ensure dismiss happens
      setTimeout(() => {
        if (location.pathname === '/admin-dashboard') {
          window.location.href = '/admin-dashboard';
        } else {
          navigate('/admin-dashboard');
        }
      }, 100);
    }
  };

  const handleDismissClick = (e, notificationId) => {
    console.log('❌ X button clicked:', notificationId);
    e.stopPropagation();
    
    // Dismiss toast
    dismissToast(notificationId);
    
    // Stop alarm
    stopAlert();
    
    // Mark as read
    const notification = toastNotifications.find(n => n.id === notificationId);
    if (notification && !notification.is_read) {
      markAsRead(notificationId);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'fire_alert':
      case 'emergency':
        return <FiBell className="text-red-600" size={20} />;
      case 'assignment':
        return <FiAlertTriangle className="text-orange-600" size={20} />;
      default:
        return <FiBell className="text-blue-600" size={20} />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-600 bg-red-50';
      case 'high':
        return 'border-l-orange-600 bg-orange-50';
      default:
        return 'border-l-blue-600 bg-blue-50';
    }
  };

  if (toastNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3 max-w-md">
      {toastNotifications.map((notification) => (
        <div
          key={notification.id}
          onClick={() => handleToastClick(notification)}
          className={`${getPriorityColor(notification.priority)} border-l-4 rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-xl transition-all duration-300 animate-slide-in-right`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(notification.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold text-gray-900">
                  {notification.title}
                </h4>
                <button
                  onClick={(e) => handleDismissClick(e, notification.id)}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  <FiX size={16} />
                </button>
              </div>
              
              <p className="text-sm text-gray-700 line-clamp-2">
                {notification.message}
              </p>
              
              <div className="mt-2 flex items-center space-x-2">
                {notification.priority === 'urgent' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-600 text-white">
                    URGENT
                  </span>
                )}
                {notification.related_report_id && (
                  <span className="text-xs text-gray-500">
                    Click to view on map
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;
