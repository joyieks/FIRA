import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiBell, FiX, FiAlertTriangle } from 'react-icons/fi';
import { supabase } from '../../config/supabase';

const StationNotificationToast = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [toastNotifications, setToastNotifications] = useState([]);
  const [processedIds, setProcessedIds] = useState(new Set());
  const [stationId, setStationId] = useState(null);

  // Get station ID
  useEffect(() => {
    const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
    setStationId(userData?.id);
  }, []);

  // Load notifications
  useEffect(() => {
    if (!stationId) return;

    const loadNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', stationId)
          .eq('user_type', 'station')
          .order('created_at', { ascending: false });
        
        if (!error && Array.isArray(data)) {
          setNotifications(data);
        }
      } catch (_) {}
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 4000);
    return () => clearInterval(interval);
  }, [stationId]);

  useEffect(() => {
    // Don't show toasts on the notification page itself
    if (location.pathname === '/station-dashboard/notification') {
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
  }, [notifications, location.pathname, processedIds]);

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
    console.log('🗑️ Dismissing station toast:', notificationId);
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

  const stopAlarm = () => {
    try {
      // Stop any playing audio
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      console.log('🔇 Station: Fire alarm sound stopped');
    } catch (error) {
      console.error('🔇 Station: Error stopping alarm:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (!error) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
      }
    } catch (_) {}
  };

  const handleToastClick = async (notification) => {
    console.log('🔔 Station toast clicked:', notification.id);
    
    // Dismiss the toast immediately
    dismissToast(notification.id);
    
    // Stop alarm immediately
    stopAlarm();
    
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    if (notification.related_report_id) {
      // Store the report ID in localStorage for Sdashboard to pick up
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
        if (location.pathname === '/station-dashboard') {
          window.location.href = '/station-dashboard';
        } else {
          navigate('/station-dashboard');
        }
      }, 100);
    }
  };

  const handleDismissClick = (e, notificationId) => {
    console.log('❌ Station X button clicked:', notificationId);
    e.stopPropagation();
    
    // Dismiss toast
    dismissToast(notificationId);
    
    // Stop alarm
    stopAlarm();
    
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

export default StationNotificationToast;
