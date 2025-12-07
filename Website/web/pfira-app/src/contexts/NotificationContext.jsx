import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAdminId, setCurrentAdminId] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    const saved = localStorage.getItem('notificationAudioEnabled');
    return saved === 'true';
  });
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastFireReportCount, setLastFireReportCount] = useState(0);
  const isInitializedRef = useRef(false);
  const isAlertingRef = useRef(false);
  const processedReportIdsRef = useRef(new Set());
  const processedNotificationIdsRef = useRef(new Set()); // Track which notifications have already triggered alarms

  // Preload fire alarm sound
  useEffect(() => {
    const loadAudio = async () => {
      try {
        const audio = new Audio('/assets/sounds/fire_alarm_sound.mp3');
        audio.preload = 'auto';
        audio.volume = 1.0;
        audioRef.current = audio;
        console.log('🔊 Global notification audio preloaded successfully');
        
        // Try to enable audio context on first user interaction
        const enableAudio = async () => {
          if (audioRef.current) {
            try {
              // If alarm is already playing, don't pause/stop it on click
              if (audioRef.current.paused === false) {
                setAudioEnabled(true);
                setAudioBlocked(false);
                try { localStorage.setItem('notificationAudioEnabled', 'true'); } catch (_) {}
                console.log('🔊 Global audio already playing; preserved on interaction');
              } else {
                await audioRef.current.play();
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                setAudioEnabled(true);
                setAudioBlocked(false);
                try { localStorage.setItem('notificationAudioEnabled', 'true'); } catch (_) {}
                console.log('🔊 Global audio context enabled successfully');
              }
            } catch (error) {
              console.log('🔊 Global audio play failed - user interaction required');
            }
          }
          document.removeEventListener('click', enableAudio);
          document.removeEventListener('touchstart', enableAudio);
        };
        
        document.addEventListener('click', enableAudio);
        document.addEventListener('touchstart', enableAudio);
      } catch (error) {
        console.error('❌ Error loading global notification audio:', error);
      }
    };
    loadAudio();
  }, []);

  // Check if we need to stop alarm on page load (from notification click)
  useEffect(() => {
    const shouldStopAlarm = localStorage.getItem('stopAlarmOnLoad');
    if (shouldStopAlarm === 'true') {
      console.log('🔇 Global: Stopping alarm on page load as requested');
      // Remove the flag
      localStorage.removeItem('stopAlarmOnLoad');
      // Stop any playing audio immediately
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      // Also try to stop fallback audio
      try {
        if (typeof window !== 'undefined' && window.__adminFallbackAudio) {
          window.__adminFallbackAudio.pause();
          window.__adminFallbackAudio.currentTime = 0;
        }
      } catch (_) {}
    }
  }, []);

  // Fallback: resolve admin ID from Supabase auth if not found in storage
  useEffect(() => {
    (async () => {
      try {
        if (currentAdminId) return;
        console.log('🔍 Global: Trying Supabase auth to resolve admin ID…');
        const { data: userData, error } = await supabase.auth.getUser();
        if (error) {
          console.warn('⚠️ Global: supabase.auth.getUser error:', error.message);
          return;
        }
        const authUser = userData?.user;
        if (!authUser) {
          console.log('❌ Global: No authenticated user');
          return;
        }
        const authId = authUser.id;
        const authEmail = authUser.email || authUser.user_metadata?.email;
        // Auth user found

        // Try primary key match first
        let adminId = null;
        if (authId) {
          const { data: byId } = await supabase
            .from('admin_users')
            .select('id')
            .eq('id', authId)
            .maybeSingle();
          if (byId?.id) adminId = byId.id;
        }
        // Fallback: match by email
        if (!adminId && authEmail) {
          const { data: byEmail } = await supabase
            .from('admin_users')
            .select('id')
            .eq('email', authEmail)
            .maybeSingle();
          if (byEmail?.id) adminId = byEmail.id;
        }

        if (adminId) {
          setCurrentAdminId(adminId);
          // Resolved admin ID
          try {
            const cache = JSON.stringify({ id: adminId, email: authEmail });
            localStorage.setItem('userData', cache);
          } catch (_) {}
        } else {
          console.warn('⚠️ Global: Could not resolve admin ID from auth');
        }
      } catch (e) {
        console.error('❌ Global: Error resolving admin ID from auth:', e);
      }
    })();
  }, [currentAdminId]);

  // Stop alert sound
  const stopAlert = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        console.log('🔇 Global: Fire alarm sound stopped');
      }
      // Also try to stop any fallback/new audio instances kept on window for safety
      try {
        if (typeof window !== 'undefined') {
          if (window.__adminFallbackAudio && typeof window.__adminFallbackAudio.pause === 'function') {
            window.__adminFallbackAudio.pause();
            window.__adminFallbackAudio.currentTime = 0;
          }
        }
      } catch (_) {}
    } catch (error) {
      console.error('🔇 Global: Error stopping fire alarm sound:', error);
    }
  };

  // Play alert sound for fire alerts
  const playAlert = async () => {
    try {
      if (audioRef.current) {
        console.log('🔊 Global: Attempting to play fire alarm sound...', 'Audio enabled:', audioEnabled);
        
        // Stop any currently playing sound first
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 1.0;
        audioRef.current.loop = true; // Loop the alarm until stopped
        
        // Always try to enable audio context first
        if (!audioEnabled) {
          try {
            await audioRef.current.play();
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setAudioEnabled(true);
            setAudioBlocked(false);
            localStorage.setItem('notificationAudioEnabled', 'true');
            console.log('🔊 Global: Audio context enabled during play attempt');
          } catch (enableError) {
            if (enableError.name === 'NotAllowedError') {
              console.log('🔊 Global: Audio blocked by browser - trying alternative approach');
              // Try to create a new audio instance and play it
              try {
            const newAudio = new Audio('/assets/sounds/fire_alarm_sound.mp3');
                newAudio.volume = 1.0;
                newAudio.loop = true;
                await newAudio.play();
                console.log('🔊 Global: New audio instance played successfully');
                setAudioEnabled(true);
                setAudioBlocked(false);
            try { if (typeof window !== 'undefined') window.__adminFallbackAudio = newAudio; } catch (_) {}
                return;
              } catch (newAudioError) {
                console.log('🔊 Global: New audio instance also blocked');
                setAudioBlocked(true);
                return;
              }
            }
          }
        }
        
        // Try to play the main audio
        try {
          await audioRef.current.play();
          console.log('🔊 Global: Fire alarm sound playing (looping until stopped)');
          setAudioBlocked(false);
        } catch (playError) {
          if (playError.name === 'NotAllowedError') {
            console.log('🔊 Global: Main audio blocked, trying fallback');
            // Try fallback audio
            const fallbackAudio = new Audio('/assets/sounds/fire_alarm_sound.mp3');
            fallbackAudio.volume = 1.0;
            fallbackAudio.loop = true;
            await fallbackAudio.play();
            console.log('🔊 Global: Fallback audio played successfully');
            try { if (typeof window !== 'undefined') window.__adminFallbackAudio = fallbackAudio; } catch (_) {}
          } else {
            throw playError;
          }
        }
      } else {
        console.warn('🔊 Global: Audio not loaded yet, trying direct creation');
        // Try to create audio directly
        try {
          const directAudio = new Audio('/assets/sounds/fire_alarm_sound.mp3');
          directAudio.volume = 1.0;
          directAudio.loop = true;
          await directAudio.play();
          console.log('🔊 Global: Direct audio creation played successfully');
          try { if (typeof window !== 'undefined') window.__adminFallbackAudio = directAudio; } catch (_) {}
        } catch (directError) {
          console.error('🔊 Global: Direct audio creation failed:', directError);
          if (directError.name === 'NotAllowedError') {
            setAudioBlocked(true);
          }
        }
      }
    } catch (error) {
      console.error('🔊 Global: Error playing fire alarm sound:', error);
      
      if (error.name === 'NotAllowedError') {
        console.log('🔊 Global: Audio blocked by browser autoplay policy');
        setAudioBlocked(true);
        return;
      }
    }
  };

  // Get current admin user ID from storage (try multiple keys/locations)
  useEffect(() => {
    const getFirst = (...vals) => vals.find(Boolean);
    const raw = getFirst(
      localStorage.getItem('userData'),
      sessionStorage.getItem('userData'),
      localStorage.getItem('adminUser'),
      sessionStorage.getItem('adminUser')
    );
    console.log('🔍 Global: Raw userData (any storage):', raw);
    if (raw) {
      try {
        const userData = JSON.parse(raw);
        console.log('🔍 Global: Parsed userData:', userData);
        const adminId = userData?.id || userData?.uid || userData?.user_id;
        console.log('🔍 Global: Extracted admin ID:', adminId);
        if (adminId) {
          setCurrentAdminId(adminId);
          // Admin ID set
        } else {
          console.error('❌ Global: No valid admin ID found in userData');
        }
      } catch (err) {
        console.error('❌ Global: Error parsing userData:', err);
      }
    } else {
      console.error('❌ Global: No userData found in storage');
    }
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!currentAdminId) {
      console.log('❌ Global: No currentAdminId, skipping notification load');
      return;
    }
    
    try {
      // Loading notifications
      setLoading(true);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentAdminId)
        .eq('user_type', 'admin')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Global: Error fetching notifications:', error);
        return;
      }

      // Notifications loaded
      
      // Check for new unread fire alerts that we haven't already triggered an alarm for
      const newFireAlerts = data?.filter(notification => 
        notification.type === 'fire_alert' && 
        !notification.is_read &&
        !processedNotificationIdsRef.current.has(notification.id) // Check if we've already alerted for this notification
      ) || [];
      
      if (newFireAlerts.length > 0) {
        console.log('🔥 Global: Found new unread fire alerts during loadNotifications:', newFireAlerts.length);
        console.log('🔥 Global: New fire alert IDs:', newFireAlerts.map(n => n.id));
        
        // Mark these notifications as processed (for alarm purposes)
        newFireAlerts.forEach(notification => {
          processedNotificationIdsRef.current.add(notification.id);
        });
        
        // Play sound for new fire alerts (guarded) – mirror station behavior by attempting regardless,
        // browser will block until user interacts, after which our click listener enables it.
        const audioEnabledSetting = localStorage.getItem('notificationAudioEnabled');
        if (audioEnabledSetting !== 'false') {
          if (!isAlertingRef.current) {
            console.log('🔊 Global: Playing alarm for new notification(s)');
            playAlert();
            isAlertingRef.current = true;
            setTimeout(() => { isAlertingRef.current = false; }, 2000);
          }
        }
      }
      
      setNotifications(data || []);
      const unread = data?.filter(n => !n.is_read) || [];
      setUnreadCount(unread.length);

      // If there are no unread fire alerts, ensure alarm is stopped
      const hasUnreadFire = (data || []).some(n => n.type === 'fire_alert' && !n.is_read);
      if (!hasUnreadFire) {
        stopAlert();
      }
    } catch (err) {
      console.error('❌ Global: Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [currentAdminId]);

  // Check for new fire reports directly from the API (like the map dashboard)
  const checkForNewFireReports = useCallback(async () => {
    try {
      const timestamp = new Date().toLocaleTimeString();
      
      if (!currentAdminId) {
        console.warn('⚠️ Global: No currentAdminId available, skipping fire report check');
        return;
      }
      
      const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
      
      if (response.ok) {
        const data = await response.json();
        // Fire Detection API check
        
        // Filter reports that have valid coordinates AND are not cancelled or fire out
        const activeReports = data.filter(report => {
          const hasCoords = report.latitude && report.longitude && !isNaN(report.latitude) && !isNaN(report.longitude);
          const statusText = (report.status || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          const isFireOut = statusText.includes('fire out');
          return hasCoords && !isCancelled && !isFireOut;
        });
        
        // Active fire reports check
        
        // Only check for new reports if we've been initialized (not on first load)
        if (isInitializedRef.current) {
          // Find truly new reports (not yet processed) - use 'id' field, not 'report_id'
          const newReports = activeReports.filter(report => 
            !processedReportIdsRef.current.has(report.id)
          );
          
          // Log current state for debugging
          // Tracking report IDs
          
          if (newReports.length > 0) {
            console.log('🔥 Global: NEW FIRE REPORTS DETECTED!', newReports.length, 'new reports');
            console.log('🔥 Global: New report IDs:', newReports.map(r => r.id));
            console.log('🔥 Global: isAlertingRef.current:', isAlertingRef.current);
            
            // Update the count immediately
            setLastFireReportCount(activeReports.length);
            
            // Play alert sound (only if not currently alerting)
            if (!isAlertingRef.current) {
              console.log('🔊 Global: Playing alert sound...');
              playAlert();
              
              // Set alerting flag to prevent sound spam
              isAlertingRef.current = true;
              
              // Reset alerting flag after a short delay (just to prevent sound spam)
              setTimeout(() => {
                isAlertingRef.current = false;
                console.log('🔊 Global: Alert cooldown finished, ready for next alert');
              }, 2000); // Short 2 second cooldown for sound only
            } else {
              console.log('⏭️ Global: Skipping sound (in cooldown), but processing notifications...');
            }
            
            // Mark reports as processed (no need to create notification - mobile app already does this)
            // We only play the sound alarm here for the command center
            try {
              for (const report of newReports) {
                console.log('📝 Global: Marking report as processed (alarm already played):', report.id);
                // Mark as processed so we don't alert again for the same report
                processedReportIdsRef.current.add(report.id);
                console.log('✅ Global: Total processed reports now:', processedReportIdsRef.current.size);
              }
              
              // Reload notifications to show any new ones created by mobile app
              console.log('🔄 Global: Reloading notifications...');
              setTimeout(() => {
                loadNotifications();
              }, 500);
              
            } catch (err) {
              console.error('❌ Global: Error processing reports:', err);
            }
          } else {
            // No new reports detected
            if (activeReports.length !== lastFireReportCount) {
              // Report count changed
              setLastFireReportCount(activeReports.length);
            } else {
              // Count is stable, no need to log
            }
          }
        } else {
          // Initializing fire report tracking
          isInitializedRef.current = true;
          setLastFireReportCount(activeReports.length);
          
          // Add all existing reports to processed set (don't notify for existing reports on page load)
          activeReports.forEach(report => {
            processedReportIdsRef.current.add(report.id);
          });
          // Initialized with existing reports
        }
      } else {
        console.error('❌ Global: Failed to fetch fire reports from API:', response.status);
      }
    } catch (error) {
      console.error('❌ Global: Error checking fire reports:', error);
    }
  }, [lastFireReportCount, playAlert, currentAdminId, loadNotifications]);

  // Load notifications when admin ID is available
  useEffect(() => {
    if (currentAdminId) {
      // Starting notification system
      loadNotifications();
      
      // Reset initialization state for new admin (only when admin changes)
      if (isInitializedRef.current) {
        console.log('🔄 Global: Admin changed, resetting initialization state');
        isInitializedRef.current = false;
        setLastFireReportCount(0);
        processedReportIdsRef.current.clear();
      }
      
      // Initialize fire report count
      // Initial fire report check
      checkForNewFireReports();
      
      // Set up fast polling to check for new fire reports (sync with map dashboard)
      // Starting polling interval for fire reports
      const fastRefreshInterval = setInterval(() => {
        const intervalTimestamp = new Date().toLocaleTimeString();
        // Fast refresh polling cycle
        checkForNewFireReports();
      }, 1000); // Check every 1 second for new fire reports (very fast detection)
      
      // Also poll notifications every 5 seconds to catch any that were created by mobile app
      // Starting polling interval for notifications
      const notificationRefreshInterval = setInterval(() => {
        loadNotifications();
      }, 5000);
      
      // Polling intervals started
      
      return () => {
        clearInterval(fastRefreshInterval);
        clearInterval(notificationRefreshInterval);
      };
    }
  }, [currentAdminId]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!currentAdminId) {
      // No currentAdminId, skipping subscription
      return;
    }

    // Setting up real-time subscription
    const channel = supabase
      .channel(`global-notifications:admin:${currentAdminId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        console.log('🔔 Global: Real-time notification received (ALL):', payload);
        console.log('🔔 Global: Notification data:', payload.new);
        console.log('🔔 Global: Notification user_id:', payload.new?.user_id);
        console.log('🔔 Global: Current admin ID:', currentAdminId);
        console.log('🔔 Global: User type:', payload.new?.user_type);
        console.log('🔔 Global: Notification type:', payload.new?.type);
        
        // Filter for this admin's notifications
        const isForCurrentAdmin = payload.new?.user_id === currentAdminId && payload.new?.user_type === 'admin';
        console.log('🔔 Global: Admin ID comparison:', {
          notification_user_id: payload.new?.user_id,
          current_admin_id: currentAdminId,
          user_type: payload.new?.user_type,
          is_match: isForCurrentAdmin,
          user_id_match: payload.new?.user_id === currentAdminId,
          user_type_match: payload.new?.user_type === 'admin'
        });
        
        if (isForCurrentAdmin) {
          console.log('✅ Global: This notification is for the current admin');
          
          // Add the new notification to the beginning of the list
          setNotifications(prev => {
            const exists = prev.some(n => n.id === payload.new.id);
            if (exists) {
              console.log('🔔 Global: Notification already exists, skipping duplicate');
              return prev;
            }
            console.log('🔔 Global: Adding new notification to list');
            return [payload.new, ...prev];
          });
          
          // Update unread count
          setUnreadCount(prev => prev + 1);
          
          // Play sound for fire_alert notifications, but NOT for status change notifications
          if (payload?.new?.type === 'fire_alert') {
            // Check if this is a status change notification (title contains "Status Changed")
            const isStatusChange = payload?.new?.title?.includes('Status Changed') || 
                                   payload?.new?.title?.includes('status') ||
                                   payload?.new?.message?.includes('Status changed from');
            
            if (!isStatusChange) {
              console.log('🔥 Global: Fire alert notification received via real-time subscription - attempting to play sound');
              if (!isAlertingRef.current) {
                playAlert();
                isAlertingRef.current = true;
                setTimeout(() => { isAlertingRef.current = false; }, 2000);
              }
            } else {
              console.log('📢 Global: Status change notification - NOT playing sound');
            }
          } else {
            console.log('📢 Global: Non-fire alert notification:', payload?.new?.type);
          }
        } else {
          console.log('❌ Global: This notification is not for the current admin');
          console.log('❌ Global: Expected user_id:', currentAdminId, 'Got:', payload.new?.user_id);
          console.log('❌ Global: Expected user_type: admin, Got:', payload.new?.user_type);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        console.log('📝 Global: Notification updated (ALL):', payload);
        
        if (payload.new?.user_id === currentAdminId && payload.new?.user_type === 'admin') {
          console.log('✅ Global: This notification update is for the current admin');
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === payload.new.id ? payload.new : notification
            )
          );
          
          // Update unread count
          setUnreadCount(prev => {
            const updatedNotification = payload.new;
            const wasRead = notifications.find(n => n.id === updatedNotification.id)?.is_read || false;
            const isNowRead = updatedNotification.is_read;
            
            if (!wasRead && isNowRead) {
              return prev - 1; // Decrease count
            } else if (wasRead && !isNowRead) {
              return prev + 1; // Increase count
            }
            return prev; // No change
          });

          // If this update marks a fire alert as read, check if we should stop the alarm
          try {
            if (payload.new?.is_read && payload.new?.type === 'fire_alert') {
              console.log('✅ Global: Fire alert marked as read, checking all notifications...');
              
              // Check if there are ANY other unread fire alerts
              // We need to check the updated notifications list
              setNotifications(prevNotifications => {
                const hasOtherUnreadFireAlerts = prevNotifications.some(n => 
                  n.type === 'fire_alert' && 
                  !n.is_read && 
                  n.id !== payload.new.id // Exclude the one just marked as read
                );
                
                if (!hasOtherUnreadFireAlerts) {
                  console.log('🔇 Global: No more unread fire alerts, stopping alarm...');
                  stopAlert();
                } else {
                  console.log('🔊 Global: Other unread fire alerts exist, keeping alarm active');
                }
                
                return prevNotifications;
              });
            }
          } catch (_) {}
        } else {
          console.log('❌ Global: This notification update is not for the current admin');
        }
      })
      .subscribe((status) => {
        // Real-time subscription status tracking
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Global: Channel subscription error');
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Global: Subscription timed out');
        }
      });

    return () => {
      console.log('🧹 Global: Cleaning up real-time subscription');
      channel.unsubscribe();
    };
  }, [currentAdminId]);

  // Mark notification as read
  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) {
        console.error('❌ Global: Error marking notification as read:', error);
        return;
      }

      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id 
            ? { ...notification, is_read: true }
            : notification
        )
      );
      
      setUnreadCount(prev => prev - 1);
    } catch (err) {
      console.error('❌ Global: Error marking notification as read:', err);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!currentAdminId) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentAdminId)
        .eq('user_type', 'admin')
        .eq('is_read', false);

      if (error) {
        console.error('❌ Global: Error marking all notifications as read:', error);
        return;
      }

      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );
      
      setUnreadCount(0);
      
      // Stop alarm since all notifications are now read
      console.log('🔇 Global: All notifications marked as read, stopping alarm...');
      stopAlert();
    } catch (err) {
      console.error('❌ Global: Error marking all notifications as read:', err);
    }
  };

  // Delete notification
  const deleteNotification = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Global: Error deleting notification:', error);
        return;
      }

      const notificationToDelete = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(notification => notification.id !== id));
      
      if (notificationToDelete && !notificationToDelete.is_read) {
        setUnreadCount(prev => prev - 1);
      }
    } catch (err) {
      console.error('❌ Global: Error deleting notification:', err);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    if (!window.confirm('Are you sure you want to clear all notifications?')) return;
    if (!currentAdminId) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', currentAdminId)
        .eq('user_type', 'admin');

      if (error) {
        console.error('❌ Global: Error clearing all notifications:', error);
        return;
      }

      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('❌ Global: Error clearing all notifications:', err);
    }
  };

  // Reset fire report monitoring (useful for debugging)
  const resetFireReportMonitoring = () => {
    console.log('🔄 Global: Resetting fire report monitoring...');
    isInitializedRef.current = false;
    setLastFireReportCount(0);
    processedReportIdsRef.current.clear();
    processedNotificationIdsRef.current.clear();
    console.log('🔄 Global: Cleared all processed report and notification IDs');
  };

  const value = {
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
    checkForNewFireReports, // Add this for manual testing
    resetFireReportMonitoring // Add this for debugging
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
