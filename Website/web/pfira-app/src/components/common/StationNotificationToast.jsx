import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiBell, FiX, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { supabase } from '../../config/supabase';
import successSound from '../../../assets/sounds/success_sound_effects.mp3';
import fireAlarmSound from '../../../assets/sounds/fire_alarm_sound.mp3';

const StationNotificationToast = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [toastNotifications, setToastNotifications] = useState([]);
  const [processedIds, setProcessedIds] = useState(new Set());
  const [stationId, setStationId] = useState(null);
  const successAudioRef = useRef(null);
  const fireAlarmRef = useRef(null);

  // Initialize success audio
  useEffect(() => {
    successAudioRef.current = new Audio(successSound);
    successAudioRef.current.volume = 0.5;
  }, []);

  // Initialize fire alarm audio
  useEffect(() => {
    fireAlarmRef.current = new Audio(fireAlarmSound);
    fireAlarmRef.current.loop = true;
    fireAlarmRef.current.volume = 1.0;
  }, []);

  const isFireOut = (notification) => {
    const title = (notification.title || '').toLowerCase();
    const message = (notification.message || '').toLowerCase();
    return title.includes('fire out') || message.includes('fire out') || message.includes('fire is now out');
  };

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

  // Play appropriate sound when notifications appear
  useEffect(() => {
    toastNotifications.forEach(notification => {
      if (isFireOut(notification)) {
        // Fire out: play success sound
        console.log('✅ Station: Fire out notification appeared - playing success sound');
        try {
          if (successAudioRef.current) {
            successAudioRef.current.currentTime = 0;
            successAudioRef.current.play().catch(err => {
              console.log('Success sound autoplay blocked:', err);
            });
          }
        } catch (error) {
          console.error('Error playing success sound:', error);
        }
      } else if (notification.type === 'fire_alert' || notification.type === 'assignment') {
        // New fire report or alarm level change: play fire alarm
        console.log('🔥 Station: Fire alert/assignment notification - playing fire alarm');
        try {
          if (fireAlarmRef.current) {
            fireAlarmRef.current.currentTime = 0;
            fireAlarmRef.current.play().catch(err => {
              console.log('Fire alarm autoplay blocked:', err);
            });
          }
        } catch (error) {
          console.error('Error playing fire alarm:', error);
        }
      }
    });
  }, [toastNotifications]);

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
      // Stop fire alarm ref
      if (fireAlarmRef.current) {
        fireAlarmRef.current.pause();
        fireAlarmRef.current.currentTime = 0;
      }
      // Stop any other playing audio
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
    
    // Check if this is a fire out notification
    const fireOut = isFireOut(notification);
    
    if (fireOut) {
      // Fire out: Play success sound and just dismiss (no map navigation)
      console.log('✅ Fire out notification - playing success sound');
      try {
        if (successAudioRef.current) {
          successAudioRef.current.currentTime = 0;
          successAudioRef.current.play();
        }
      } catch (error) {
        console.error('Error playing success sound:', error);
      }
      
      // Stop alarm
      stopAlarm();
      
      // Mark as read
      if (!notification.is_read) {
        await markAsRead(notification.id);
      }
    } else {
      // Regular notification: Stop alarm and navigate to map
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
    }
  };

  const handleDismissClick = (e, notificationId) => {
    console.log('❌ Station X button clicked:', notificationId);
    e.stopPropagation();
    
    // Dismiss toast
    dismissToast(notificationId);
    
    // Check if fire out to play success sound
    const notification = toastNotifications.find(n => n.id === notificationId);
    if (notification && isFireOut(notification)) {
      try {
        if (successAudioRef.current) {
          successAudioRef.current.currentTime = 0;
          successAudioRef.current.play();
        }
      } catch (error) {
        console.error('Error playing success sound:', error);
      }
    }
    
    // Stop alarm
    stopAlarm();
    
    // Mark as read
    if (notification && !notification.is_read) {
      markAsRead(notificationId);
    }
  };

  const getIcon = (notification) => {
    if (isFireOut(notification)) {
      return <FiCheckCircle className="text-green-600" size={20} />;
    }
    switch (notification.type) {
      case 'fire_alert':
      case 'emergency':
        return <FiBell className="text-red-600" size={20} />;
      case 'assignment':
        return <FiAlertTriangle className="text-orange-600" size={20} />;
      default:
        return <FiBell className="text-blue-600" size={20} />;
    }
  };

  const getPriorityColor = (notification) => {
    if (isFireOut(notification)) {
      return 'border-l-green-600 bg-green-50';
    }
    switch (notification.priority) {
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
          className={`${getPriorityColor(notification)} border-l-4 rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-xl transition-all duration-300 animate-slide-in-right`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(notification)}
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
                {isFireOut(notification) ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-600 text-white">
                    ✅ FIRE OUT
                  </span>
                ) : (
                  <>
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
                  </>
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
