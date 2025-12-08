import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, TextInput, RefreshControl, Animated, Platform, Linking } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../config/AuthContext';
import { supabase } from '../../../config/supabase';
import { sendPushNotification } from '../../../services/pushNotificationService';
import { createNearbyIncidentNotifications } from '../../../services/citizenNotificationService';

// Fire Detection API base
const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app/predict';
const API_BASE = 'https://fire-detection-api-production-f55b.up.railway.app';

const CStatus = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { isAuthenticated, userData } = useAuth();

  // Sample data for reports
  const [yourReports, setYourReports] = useState([]);
  const [nearbyReports, setNearbyReports] = useState([]);
  const [allReports, setAllReports] = useState([]); // TEMPORARY: Store all reports for debugging
  const [addressCache, setAddressCache] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [processedNearbyIds, setProcessedNearbyIds] = useState(new Set());
  const [lastReportCheckTime, setLastReportCheckTime] = useState(Date.now());

  // Use Supabase auth context
  useEffect(() => {
    console.log('CitizenStatus: auth context changed', { isAuthenticated, hasUserData: !!userData });
    if (isAuthenticated && userData?.uid) {
      setCurrentUser({
        uid: userData.uid,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
      });
    } else {
      setCurrentUser(null);
    }
  }, [isAuthenticated, userData?.uid]);

  // Check for Fire Out reports and show Thank You modal
  const checkForFireOutReports = async (reports) => {
    if (!reports || reports.length === 0 || !modalKeysLoaded) return;
    
    // Find the most recent Fire Out report that hasn't been shown yet
    const fireOutReport = reports.find(report => {
      const status = (report.status || report.progress || '').toString();
      const isFireOut = status === 'Fire Out';
      const reportId = String(report.id || report._id);
      const modalKey = `${reportId}:Fire Out`;
      const alreadyShown = shownModalKeys.has(modalKey);
      console.log(`🔍 Checking Fire Out: ${reportId}, status: ${status}, already shown: ${alreadyShown}`);
      return isFireOut && !alreadyShown;
    });
    
    if (fireOutReport) {
      const reportId = String(fireOutReport.id || fireOutReport._id);
      const modalKey = `${reportId}:Fire Out`;
      
      // Get report location for notification
      const location = fireOutReport.resolved_address || 
                       fireOutReport.address || 
                       fireOutReport.geotag_location || 
                       'your reported location';
      
      // Update the report in all lists immediately to reflect Fire Out status
      const updatedReport = { ...fireOutReport, status: 'Fire Out', progress: 'Fire Out' };
      
      // Update yourReports list
      setYourReports(prev => {
        const updated = prev.map(report => 
          String(report.id) === String(reportId) 
            ? updatedReport
            : report
        );
        return sortReportsByDate(updated);
      });
      
      // Update allReports list
      setAllReports(prev => {
        const updated = prev.map(report => 
          String(report.id) === String(reportId) 
            ? updatedReport
            : report
        );
        return sortReportsByDate(updated);
      });
      
      // Update nearbyReports list if this report is there
      setNearbyReports(prev => {
        const updated = prev.map(report => 
          String(report.id) === String(reportId) 
            ? updatedReport
            : report
        );
        return sortReportsByDate(updated);
      });
      
      // Send push notification for Fire Out status
      try {
        const shortLocation = location.length > 50 
          ? location.substring(0, 47) + '...' 
          : location;
        
        const pushTitle = '✅ Fire Out - Report Resolved';
        const pushBody = `Great news! The fire at ${shortLocation} has been extinguished. Thank you for your report!`;
        
        console.log('📱 Sending push notification for Fire Out status:');
        console.log('   Title:', pushTitle);
        console.log('   Body:', pushBody);
        console.log('   Report ID:', reportId);
        console.log('   Location:', location);
        
        const pushResult = await sendPushNotification(
          pushTitle,
          pushBody,
          {
            type: 'fire_out',
            reportId: reportId,
            status: 'Fire Out',
            location: location,
          }
        );
        
        if (pushResult) {
          console.log('✅ Push notification sent successfully for Fire Out status');
        } else {
          console.warn('⚠️ Push notification returned false for Fire Out status');
        }
      } catch (pushError) {
        console.error('❌ Error sending push notification for Fire Out status:', pushError);
        console.error('❌ Push error details:', JSON.stringify(pushError, null, 2));
        // Don't fail the modal display if push fails
      }
      
      setFireOutReport(updatedReport);
      setShowThankYouModal(true);
      // Mark this report:status combination as shown
      setShownModalKeys(prev => new Set([...prev, modalKey]));
      console.log('🎊 Showing Fire Out modal for report:', reportId);
      console.log('✅ Report status updated to Fire Out in all lists automatically');
    }
  };

  // Get user location on mount and periodically update
  useEffect(() => {
    const getUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 10000,
          });
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setUserLocation(newLocation);
          console.log('✅ User location obtained:', newLocation.latitude, newLocation.longitude);
          
          // Request notification permissions when location is obtained
          try {
            const { registerForPushNotificationsAsync } = await import('../../../services/pushNotificationService');
            await registerForPushNotificationsAsync();
            console.log('✅ Notification permissions requested');
          } catch (notifError) {
            console.error('❌ Error requesting notification permissions:', notifError);
          }
        } else {
          console.warn('⚠️ Location permission not granted');
        }
      } catch (error) {
        console.error('❌ Error getting user location:', error);
      }
    };
    getUserLocation();
    
    // Update location every 30 seconds
    const locationInterval = setInterval(getUserLocation, 30000);
    return () => clearInterval(locationInterval);
  }, []);

  // Check for nearby incidents when location or reports change
  useEffect(() => {
    if (userLocation && allReports.length > 0 && currentUser?.uid) {
      console.log('🔄 Checking for nearby incidents (location or reports changed)');
      checkForNearbyIncidents(allReports);
    }
  }, [userLocation, allReports, currentUser?.uid]);

  // Periodic check for nearby incidents (every 10 seconds) and auto-refresh reports
  useEffect(() => {
    if (!userLocation || !currentUser?.uid) return;

    const interval = setInterval(async () => {
      // Auto-refresh reports to get new ones
      console.log('🔄 Auto-refreshing reports to check for new nearby incidents...');
      const checkStartTime = Date.now();
      
      try {
        const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports', {
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          const isActiveReport = (r) => {
            const statusText = (r.status || r.progress || '').toString().toLowerCase();
            return !statusText.includes('cancelled') && !statusText.includes('canceled');
          };
          const activeReports = data.filter(isActiveReport);
          
          // Use the same sorting logic as loadReportsFromAPI
          const getTimestampValue = (report) => {
            const timestamp = report.formatted_timestamp || report.created_at || report.timestamp || report.time;
            if (!timestamp) return 0;
            if (timestamp === 'Just now') return new Date().getTime();
            try {
              return new Date(timestamp).getTime();
            } catch {
              return 0;
            }
          };
          const sortedReports = [...activeReports].sort((a, b) => getTimestampValue(b) - getTimestampValue(a));
          
          // Find NEW reports (created after last check)
          const newReports = sortedReports.filter(report => {
            const reportTime = getTimestampValue(report);
            return reportTime > lastReportCheckTime;
          });
          
          if (newReports.length > 0) {
            console.log(`🆕 Found ${newReports.length} NEW report(s) since last check!`);
            setLastReportCheckTime(checkStartTime);
          }
          
          setAllReports(sortedReports);
          
          // Update YOUR reports list automatically (user's own reports)
          const userOwnReports = sortedReports.filter(report => {
            const reporterId = report.reporterId || report.user_id;
            return reporterId === currentUser.uid;
          });
          const sortedUserReports = userOwnReports.sort((a, b) => {
            return getTimestampValue(b) - getTimestampValue(a);
          });
          console.log('🔄 Auto-updating YOUR reports:', sortedUserReports.length, 'reports');
          setYourReports(sortedUserReports);
          
          // Check for Fire Out status in user's reports
          for (const report of sortedUserReports) {
            const status = (report.status || report.progress || '').toString();
            if (status === 'Fire Out') {
              const reportId = String(report.id);
              const modalKey = `${reportId}:Fire Out`;
              
              console.log('🔍 10-SEC: Checking Fire Out report:', reportId, 'Modal key:', modalKey);
              console.log('🔍 10-SEC: Already shown?', shownModalKeys.has(modalKey));
              console.log('🔍 10-SEC: Current shown keys:', Array.from(shownModalKeys));
              
              // Check if already shown
              if (!shownModalKeys.has(modalKey)) {
                console.log('🔥 10-SEC INTERVAL: Fire Out detected for report:', reportId);
                console.log('🎊 10-SEC INTERVAL: Triggering Fire Out modal and notification');
                
                const updatedReport = { ...report, status: 'Fire Out', progress: 'Fire Out' };
                const location = report.resolved_address || report.address || report.geotag_location || 'your reported location';
                const shortLocation = location.length > 50 ? location.substring(0, 47) + '...' : location;
                
                // Send push notification
                console.log('📱 10-SEC: Sending push notification');
                sendPushNotification(
                  '✅ Fire Out - Report Resolved',
                  `Great news! The fire at ${shortLocation} has been extinguished. Thank you for your report!`,
                  {
                    type: 'fire_out',
                    reportId: reportId,
                    status: 'Fire Out',
                    location: location,
                  }
                ).then(result => {
                  console.log('✅ 10-SEC: Push notification sent:', result);
                }).catch(err => {
                  console.error('❌ 10-SEC: Push notification error:', err);
                });
                
                // Show modal
                console.log('🚀 10-SEC: Setting modal state');
                setFireOutReport(updatedReport);
                setShowThankYouModal(true);
                
                // Add to shown keys and save to storage
                setShownModalKeys(prev => {
                  const newKeys = new Set([...prev, modalKey]);
                  console.log('✅ 10-SEC: Added modal key:', modalKey);
                  console.log('✅ 10-SEC: Total shown keys now:', Array.from(newKeys));
                  return newKeys;
                });
                
                console.log('✅ 10-SEC: Fire Out modal triggered - WILL ONLY SHOW ONCE');
              } else {
                console.log('⏭️ 10-SEC: Skipping - Fire Out modal already shown for report:', reportId);
              }
            }
          }
          
          // Update nearby reports list automatically
          const otherUsersReports = sortedReports.filter(report => {
            const reporterId = report.reporterId || report.user_id;
            return reporterId !== currentUser.uid;
          });
          const sortedOtherReports = otherUsersReports.sort((a, b) => {
            return getTimestampValue(b) - getTimestampValue(a);
          });
          console.log('🔄 Auto-updating NEARBY reports:', sortedOtherReports.length, 'reports');
          setNearbyReports(sortedOtherReports);
          
          // Check for nearby incidents with updated reports (excluding own reports)
          if (otherUsersReports.length > 0) {
            console.log('🔄 Checking for nearby incidents with refreshed reports');
            // Pass new reports flag to prioritize checking new ones
            const hasNewReports = newReports.length > 0;
            if (hasNewReports) {
              console.log(`🚨 ${newReports.length} new report(s) detected - checking for nearby incidents immediately!`);
            }
            await checkForNearbyIncidents(otherUsersReports, hasNewReports);
          }
        }
      } catch (error) {
        console.error('❌ Error auto-refreshing reports:', error);
      }
    }, 10000); // Check every 10 seconds (reduced from 15 for faster detection)

    return () => clearInterval(interval);
  }, [userLocation, currentUser?.uid, lastReportCheckTime]);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Check for nearby incidents and create notifications
  const checkForNearbyIncidents = async (reports, hasNewReports = false) => {
    console.log('🔍 checkForNearbyIncidents called:', {
      hasUserLocation: !!userLocation,
      reportsCount: reports?.length || 0,
      hasCurrentUser: !!currentUser?.uid,
      userLocation: userLocation
    });

    if (!userLocation) {
      console.warn('⚠️ No user location available, skipping nearby check');
      return;
    }

    if (!reports || reports.length === 0) {
      console.warn('⚠️ No reports available, skipping nearby check');
      return;
    }

    if (!currentUser?.uid) {
      console.warn('⚠️ No current user, skipping nearby check');
      return;
    }

    // Temporarily increase range for testing - you can reduce this later
    const MIN_DISTANCE_KM = 0.0; // Start from 0km for testing (was 0.5)
    const MAX_DISTANCE_KM = 10.0; // Increase to 10km for testing (was 5.0)
    
    console.log(`🔍 Checking ${reports.length} reports for nearby incidents...`);
    
    // Filter out user's own reports - don't notify them about their own reports
    const otherReports = reports.filter(report => {
      const reporterId = report.reporterId || report.user_id;
      const isOwnReport = reporterId === currentUser.uid;
      if (isOwnReport) {
        console.log(`ℹ️ Skipping own report ${report.id} from nearby check`);
      }
      return !isOwnReport;
    });
    
    console.log(`🔍 Filtered to ${otherReports.length} other users' reports (excluding own reports)`);
    
    const nearby = otherReports
      .map(report => {
        // Try to get coordinates from various fields
        let reportLat, reportLon;
        
        if (report.latitude && report.longitude) {
          reportLat = parseFloat(report.latitude);
          reportLon = parseFloat(report.longitude);
        } else if (report.geotag_location) {
          const match = report.geotag_location.toString().match(/-?\d+\.?\d*\s*,\s*-?\d+\.?\d*/);
          if (match) {
            const [lat, lon] = match[0].split(',').map(s => parseFloat(s.trim()));
            reportLat = lat;
            reportLon = lon;
          }
        }
        
        if (isNaN(reportLat) || isNaN(reportLon)) {
          console.log(`⚠️ Report ${report.id} has invalid coordinates:`, { 
            latitude: report.latitude, 
            longitude: report.longitude, 
            geotag_location: report.geotag_location 
          });
          return null;
        }
        
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          reportLat,
          reportLon
        );
        
        console.log(`📍 Report ${report.id} distance: ${distance.toFixed(2)}km`);
        
        // Only include reports within the reasonable range
        if (distance >= MIN_DISTANCE_KM && distance <= MAX_DISTANCE_KM) {
          return {
            ...report,
            latitude: reportLat,
            longitude: reportLon,
            distance: distance,
            distanceText: distance < 1 
              ? `${Math.round(distance * 1000)}m away` 
              : `${distance.toFixed(1)}km away`
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance); // Sort by closest first

    console.log(`🔍 Found ${nearby.length} nearby incident(s) within ${MIN_DISTANCE_KM}-${MAX_DISTANCE_KM}km range`);

    // Check for new nearby incidents
    if (nearby.length > 0) {
      const newIncidents = nearby.filter(incident => 
        !processedNearbyIds.has(incident.id)
      );
      
      console.log(`🔍 Found ${newIncidents.length} new nearby incident(s) (not yet processed)`);
      
      if (newIncidents.length > 0) {
        // Mark new incidents as processed IMMEDIATELY to prevent duplicate processing
        // This must happen BEFORE creating notifications to avoid race conditions
        setProcessedNearbyIds(prev => {
          const newSet = new Set(prev);
          newIncidents.forEach(incident => {
            newSet.add(incident.id);
            console.log(`✅ Marked incident ${incident.id} as processed`);
          });
          return newSet;
        });
        
        // Create notifications in Supabase for new nearby incidents
        console.log(`🔔 Creating notifications for ${newIncidents.length} new nearby incident(s)`);
        console.log('📋 New incidents details:', newIncidents.map(i => ({ 
          id: i.id, 
          distance: i.distanceText,
          location: i.address || i.resolved_address || i.geotag_location,
          reporterId: i.reporterId || i.user_id
        })));
        try {
          const result = await createNearbyIncidentNotifications(currentUser.uid, newIncidents);
          console.log('📊 Notification creation result:', result);
          if (result.success) {
            console.log(`✅ Created ${result.count} notification(s) for nearby incidents`);
            console.log('✅ Push notifications sent - check your device!');
            console.log('📱 Nearby users should now receive push notifications on their devices');
          } else {
            console.warn('⚠️ Some notifications failed to create:', result.errors);
            console.warn('⚠️ Result details:', JSON.stringify(result, null, 2));
          }
        } catch (error) {
          console.error('❌ Error creating nearby incident notifications:', error);
          console.error('❌ Error stack:', error.stack);
        }
      } else {
        console.log('ℹ️ All nearby incidents have already been processed');
      }
    } else {
      console.log('ℹ️ No nearby incidents found within range');
    }
  };

  // Check for "Under Control" reports and show Acknowledgment modal
  const checkForAcknowledgedReports = (reports) => {
    if (!reports || reports.length === 0 || !modalKeysLoaded) return;
    
    // Find the most recent "Under Control" report that hasn't been shown yet
    const acknowledgedReport = reports.find(report => {
      const status = (report.status || report.progress || '').toString();
      const isUnderControl = status === 'Under Control';
      const reportId = String(report.id || report._id);
      const modalKey = `${reportId}:Under Control`;
      const alreadyShown = shownModalKeys.has(modalKey);
      console.log(`🔍 Checking Under Control: ${reportId}, status: ${status}, already shown: ${alreadyShown}`);
      return isUnderControl && !alreadyShown;
    });
    
    if (acknowledgedReport) {
      const reportId = String(acknowledgedReport.id || acknowledgedReport._id);
      const modalKey = `${reportId}:Under Control`;
      setAcknowledgedReport(acknowledgedReport);
      setShowAcknowledgmentModal(true);
      // Mark this report:status combination as shown
      setShownModalKeys(prev => new Set([...prev, modalKey]));
      console.log('🎉 Showing Acknowledgment modal for report:', reportId);
    }
  };

  // Load reports when user is available
  useEffect(() => {
    if (currentUser?.uid) {
      console.log('Current user available, loading reports...');
      loadReportsFromAPI();
    } else if (currentUser === null) {
      // User is explicitly null (not authenticated)
      console.log('No user authenticated, clearing reports');
      setYourReports([]);
      setNearbyReports([]);
      setIsLoading(false);
    }
  }, [currentUser?.uid]);

  // Real-time listener for status changes - DUAL APPROACH for reliability
  useEffect(() => {
    if (!currentUser?.uid) return;

    console.log('📡 Setting up DUAL real-time listeners for user:', currentUser.uid);
    
    // Approach 1: Listen to notifications table
    const notifChannel = supabase
      .channel(`citizen-notifications:${currentUser.uid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.uid}`
      }, async (payload) => {
        const notification = payload.new;
        console.log('📱 NEW NOTIFICATION RECEIVED:', {
          title: notification.title,
          type: notification.type,
          user_type: notification.user_type,
          related_report_id: notification.related_report_id,
          message: notification.message
        });
        
        // Check if this is a status change notification (check both title and type)
        const isAcknowledgment = notification.title && (
          notification.title.includes('Acknowledged') || 
          notification.title.includes('Under Control') ||
          notification.title.toLowerCase().includes('under control')
        );
        const isFireOut = notification.title && (
          notification.title.includes('Resolved') ||
          notification.title.includes('Fire Out') ||
          notification.title.includes('fire out') ||
          notification.title.includes('Fire Resolved') ||
          notification.title.includes('All Clear') ||
          notification.title.toLowerCase().includes('fire out') ||
          notification.title.toLowerCase().includes('fire resolved') ||
          notification.message?.includes('Fire Out') ||
          notification.message?.includes('fire out') ||
          notification.message?.includes('Status: Fire Out')
        );
        // Include 'user_action' type as web app uses this for Fire Out notifications
        const isStatusChange = notification.type === 'status_change' || 
                               notification.type === 'fire_alert' || 
                               notification.type === 'user_action';
        
        console.log('🔍 Notification check:', {
          title: notification.title,
          type: notification.type,
          isAcknowledgment,
          isFireOut,
          isStatusChange,
          message: notification.message?.substring(0, 50)
        });
        
        if ((isAcknowledgment || isFireOut || isStatusChange) && notification.related_report_id) {
          console.log('✅ STATUS CHANGE DETECTED for report:', notification.related_report_id);
          console.log('🔥 Fire Out detected:', isFireOut, 'Type:', notification.type);
          
          // IMMEDIATELY refresh reports from API to get latest status
          console.log('🔄 IMMEDIATELY fetching updated report from API...');
          
          // Also trigger a full report refresh
          loadReportsFromAPI();
          
          // Fetch the updated report from API
          try {
            const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports', {
              headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
              const allReports = await response.json();
              const updatedReport = allReports.find(r => String(r.id) === String(notification.related_report_id));
              
              if (updatedReport) {
                console.log('✅ Found updated report:', {
                  id: updatedReport.id,
                  status: updatedReport.status,
                  user_id: updatedReport.user_id,
                  currentUserId: currentUser.uid
                });
                
                // Check if this report belongs to current user
                if (updatedReport.user_id === currentUser.uid) {
                  const newStatus = updatedReport.status || updatedReport.progress;
                  console.log('💫 Updating local state with new status:', newStatus);
                  
                  // Update local state immediately with proper sorting
                  setYourReports(prev => {
                    const updated = prev.map(report => 
                      String(report.id) === String(updatedReport.id) 
                        ? { ...report, status: newStatus, progress: newStatus, ...updatedReport }
                        : report
                    );
                    
                    // If report not found, add it
                    if (!updated.find(r => String(r.id) === String(updatedReport.id))) {
                      updated.unshift(updatedReport);
                    }
                    
                    console.log('✅ Local state updated, sorting reports...');
                    // Sort reports by date after update
                    return sortReportsByDate(updated);
                  });
                  
                  // Update all reports list too with proper sorting
                  setAllReports(prev => {
                    const updated = prev.map(report => 
                      String(report.id) === String(updatedReport.id) 
                        ? { ...report, status: newStatus, progress: newStatus, ...updatedReport }
                        : report
                    );
                    // Sort reports by date after update
                    return sortReportsByDate(updated);
                  });
                  
                  // Also update nearby reports if this report is in that list
                  setNearbyReports(prev => {
                    const updated = prev.map(report => 
                      String(report.id) === String(updatedReport.id) 
                        ? { ...report, status: newStatus, progress: newStatus, ...updatedReport }
                        : report
                    );
                    // Sort reports by date after update
                    return sortReportsByDate(updated);
                  });
                  
                  // Show appropriate modal based on status
                  const reportId = String(updatedReport.id);
                  
                  if (newStatus === 'Under Control') {
                    const modalKey = `${reportId}:Under Control`;
                    console.log('🎯 Checking modal key:', modalKey, 'Already shown?', shownModalKeys.has(modalKey));
                    
                    if (!shownModalKeys.has(modalKey)) {
                      console.log('🎉 SHOWING ACKNOWLEDGMENT MODAL NOW!');
                      setAcknowledgedReport(updatedReport);
                      setShowAcknowledgmentModal(true);
                      setShownModalKeys(prev => new Set([...prev, modalKey]));
                    }
                  } else if (newStatus === 'Fire Out') {
                    const modalKey = `${reportId}:Fire Out`;
                    console.log('🎯 Checking modal key:', modalKey, 'Already shown?', shownModalKeys.has(modalKey));
                    
                    if (!shownModalKeys.has(modalKey)) {
                      console.log('🎊 SHOWING FIRE OUT MODAL NOW! (via real-time notification)');
                      console.log('🎊 Modal state about to be set:', {
                        reportId,
                        modalKey,
                        currentShowThankYouModal: showThankYouModal,
                        updatedReport: updatedReport.id
                      });
                      
                      // Send push notification for Fire Out status
                      const location = updatedReport.resolved_address || 
                                       updatedReport.address || 
                                       updatedReport.geotag_location || 
                                       'your reported location';
                      
                      const shortLocation = location.length > 50 
                        ? location.substring(0, 47) + '...' 
                        : location;
                      
                      const pushTitle = '✅ Fire Out - Report Resolved';
                      const pushBody = `Great news! The fire at ${shortLocation} has been extinguished. Thank you for your report!`;
                      
                      console.log('📱 Sending push notification for Fire Out status (real-time):');
                      console.log('   Title:', pushTitle);
                      console.log('   Body:', pushBody);
                      console.log('   Report ID:', reportId);
                      
                      sendPushNotification(
                        pushTitle,
                        pushBody,
                        {
                          type: 'fire_out',
                          reportId: reportId,
                          status: 'Fire Out',
                          location: location,
                        }
                      ).then(pushResult => {
                        if (pushResult) {
                          console.log('✅ Push notification sent successfully for Fire Out status (real-time)');
                        } else {
                          console.warn('⚠️ Push notification returned false for Fire Out status (real-time)');
                        }
                      }).catch(pushError => {
                        console.error('❌ Error sending push notification for Fire Out status (real-time):', pushError);
                      });
                      
                      // CRITICAL: Set modal state
                      console.log('🚀 Setting fireOutReport and showThankYouModal to true...');
                      setFireOutReport(updatedReport);
                      setShowThankYouModal(true);
                      setShownModalKeys(prev => new Set([...prev, modalKey]));
                      console.log('✅ Modal state set! Fire Out modal should appear now.');
                    } else {
                      console.log('ℹ️ Modal already shown for this report:', modalKey);
                    }
                  }
                } else {
                  console.log('⚠️ Report does not belong to current user');
                }
              } else {
                console.log('⚠️ Report not found in API response');
              }
            } else {
              console.error('❌ API response not OK:', response.status);
            }
          } catch (error) {
            console.error('❌ Error fetching updated report:', error);
          }
        } else {
          console.log('ℹ️ Not a status change notification');
        }
      })
      .subscribe((status) => {
        console.log('📡 Notification channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to real-time notifications - ready to receive Fire Out updates!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to real-time notifications');
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Real-time subscription timed out - will rely on polling');
        }
      });

    // Approach 2: Periodic polling as fallback (every 5 seconds)
    console.log('⏰ Setting up polling fallback (5s interval)');
    let lastCheckTime = Date.now();
    let lastReportCheckTime = Date.now();
    
    const pollInterval = setInterval(async () => {
      try {
        // Method 1: Check for new notifications since last check
        // Include 'user_action' type as web app uses this when Fire Out is confirmed
        const { data: newNotifications } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUser.uid)
          .eq('user_type', 'citizen')
          .in('type', ['status_change', 'fire_alert', 'user_action'])
          .gt('created_at', new Date(lastCheckTime).toISOString())
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (newNotifications && newNotifications.length > 0) {
          console.log('🔄 Polling found new notifications:', newNotifications.length);
          lastCheckTime = Date.now();
          
          // Process each new notification
          for (const notification of newNotifications) {
            // Check if it's a Fire Out notification (matches web app notification format)
            const isFireOutNotif = notification.title && (
              notification.title.includes('Resolved') ||
              notification.title.includes('Fire Out') ||
              notification.title.includes('Fire Resolved') ||
              notification.title.includes('All Clear') ||
              notification.title.includes('fire out') ||
              notification.title.toLowerCase().includes('fire resolved') ||
              notification.message?.includes('Fire Out') ||
              notification.message?.includes('Status: Fire Out')
            );
            
            if (notification.related_report_id) {
              console.log('⚡ Processing polled notification for report:', notification.related_report_id, 'isFireOut:', isFireOutNotif);
              console.log('📋 Notification details:', {
                title: notification.title,
                type: notification.type,
                message: notification.message?.substring(0, 100)
              });
              
              // IMMEDIATELY trigger full report refresh
              if (isFireOutNotif) {
                console.log('🔥 Fire Out notification detected - triggering immediate refresh!');
                loadReportsFromAPI();
              }
              
              // Fetch updated report
              const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
              if (response.ok) {
                const allReports = await response.json();
                const updatedReport = allReports.find(r => String(r.id) === String(notification.related_report_id));
                
                if (updatedReport && updatedReport.user_id === currentUser.uid) {
                  const newStatus = updatedReport.status || updatedReport.progress;
                  
                  // Update local state
                  setYourReports(prev => {
                    const updated = prev.map(report => 
                      String(report.id) === String(updatedReport.id) 
                        ? { ...report, status: newStatus, progress: newStatus, ...updatedReport }
                        : report
                    );
                    
                    if (!updated.find(r => String(r.id) === String(updatedReport.id))) {
                      updated.unshift(updatedReport);
                    }
                    
                    return updated;
                  });
                  
                  // Show modal
                  const reportId = String(updatedReport.id);
                  
                  if (newStatus === 'Under Control') {
                    const modalKey = `${reportId}:Under Control`;
                    if (!shownModalKeys.has(modalKey)) {
                      console.log('🎉 SHOWING ACKNOWLEDGMENT MODAL (via polling)');
                      setAcknowledgedReport(updatedReport);
                      setShowAcknowledgmentModal(true);
                      setShownModalKeys(prev => new Set([...prev, modalKey]));
                    }
                  } else if (newStatus === 'Fire Out') {
                    const modalKey = `${reportId}:Fire Out`;
                    if (!shownModalKeys.has(modalKey)) {
                      console.log('🎊 SHOWING FIRE OUT MODAL (via polling)');
                      
                      // Send push notification for Fire Out status
                      const location = updatedReport.resolved_address || 
                                       updatedReport.address || 
                                       updatedReport.geotag_location || 
                                       'your reported location';
                      
                      const shortLocation = location.length > 50 
                        ? location.substring(0, 47) + '...' 
                        : location;
                      
                      const pushTitle = '✅ Fire Out - Report Resolved';
                      const pushBody = `Great news! The fire at ${shortLocation} has been extinguished. Thank you for your report!`;
                      
                      console.log('📱 Sending push notification for Fire Out status (polling):');
                      console.log('   Title:', pushTitle);
                      console.log('   Body:', pushBody);
                      console.log('   Report ID:', reportId);
                      
                      sendPushNotification(
                        pushTitle,
                        pushBody,
                        {
                          type: 'fire_out',
                          reportId: reportId,
                          status: 'Fire Out',
                          location: location,
                        }
                      ).then(pushResult => {
                        if (pushResult) {
                          console.log('✅ Push notification sent successfully for Fire Out status (polling)');
                        } else {
                          console.warn('⚠️ Push notification returned false for Fire Out status (polling)');
                        }
                      }).catch(pushError => {
                        console.error('❌ Error sending push notification for Fire Out status (polling):', pushError);
                      });
                      
                      setFireOutReport(updatedReport);
                      setShowThankYouModal(true);
                      setShownModalKeys(prev => new Set([...prev, modalKey]));
                    }
                  }
                }
              }
            }
          }
        }
        
        // Method 2: Directly check reports for status changes (every 5 seconds for faster Fire Out detection)
        const now = Date.now();
        if (now - lastReportCheckTime > 5000) {
          console.log('🔄 Directly checking reports for status changes...');
          lastReportCheckTime = now;
          
          try {
            const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports', {
              headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
              const allReports = await response.json();
              
              // Get current user's reports from state - use a function to get latest state
              setYourReports(currentReports => {
                // Check each current report for status changes
                for (const currentReport of currentReports) {
                  const updatedReport = allReports.find(r => 
                    String(r.id) === String(currentReport.id) && 
                    r.user_id === currentUser.uid
                  );
                  
                  if (updatedReport) {
                    const currentStatus = (currentReport.status || currentReport.progress || '').toString();
                    const newStatus = (updatedReport.status || updatedReport.progress || '').toString();
                    
                    // Check if status changed to Fire Out
                    if (newStatus === 'Fire Out' && currentStatus !== 'Fire Out') {
                      console.log(`🔥 STATUS CHANGE DETECTED via direct check: Report ${updatedReport.id} changed to Fire Out!`);
                      
                      // Update all lists immediately
                      const updatedReportData = { ...updatedReport, status: 'Fire Out', progress: 'Fire Out' };
                      
                      setYourReports(prev => {
                        const updated = prev.map(report => 
                          String(report.id) === String(updatedReport.id) 
                            ? updatedReportData
                            : report
                        );
                        return sortReportsByDate(updated);
                      });
                      
                      setAllReports(prev => {
                        const updated = prev.map(report => 
                          String(report.id) === String(updatedReport.id) 
                            ? updatedReportData
                            : report
                        );
                        return sortReportsByDate(updated);
                      });
                      
                      setNearbyReports(prev => {
                        const updated = prev.map(report => 
                          String(report.id) === String(updatedReport.id) 
                            ? updatedReportData
                            : report
                        );
                        return sortReportsByDate(updated);
                      });
                      
                      // Check and show Fire Out modal
                      const reportId = String(updatedReport.id);
                      const modalKey = `${reportId}:Fire Out`;
                      
                      // Use a function to check shownModalKeys
                      setShownModalKeys(prevKeys => {
                        if (!prevKeys.has(modalKey)) {
                          console.log('🎊 SHOWING FIRE OUT MODAL (via direct report check)!');
                          
                          // Send push notification
                          const location = updatedReport.resolved_address || 
                                           updatedReport.address || 
                                           updatedReport.geotag_location || 
                                           'your reported location';
                          
                          const shortLocation = location.length > 50 
                            ? location.substring(0, 47) + '...' 
                            : location;
                          
                          const pushTitle = '✅ Fire Out - Report Resolved';
                          const pushBody = `Great news! The fire at ${shortLocation} has been extinguished. Thank you for your report!`;
                          
                          sendPushNotification(
                            pushTitle,
                            pushBody,
                            {
                              type: 'fire_out',
                              reportId: reportId,
                              status: 'Fire Out',
                              location: location,
                            }
                          ).then(pushResult => {
                            if (pushResult) {
                              console.log('✅ Push notification sent successfully for Fire Out status (direct check)');
                            }
                          }).catch(pushError => {
                            console.error('❌ Error sending push notification:', pushError);
                          });
                          
                          setFireOutReport(updatedReportData);
                          setShowThankYouModal(true);
                          
                          return new Set([...prevKeys, modalKey]);
                        }
                        return prevKeys;
                      });
                    }
                  }
                }
                
                // Return unchanged if no updates needed
                return currentReports;
              });
            }
          } catch (directCheckError) {
            console.error('❌ Error in direct report check:', directCheckError);
          }
        }
      } catch (pollError) {
        console.error('❌ Polling error:', pollError);
      }
    }, 5000); // Poll every 5 seconds - matches web app Fire Out confirmation timing

    return () => {
      console.log('🔌 Unsubscribing from real-time channels and stopping polling');
      notifChannel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [currentUser?.uid]);

  // Additional aggressive real-time listener specifically for Fire Out status changes
  useEffect(() => {
    if (!currentUser?.uid) return;

    console.log('🔥 Setting up AGGRESSIVE Fire Out real-time listener for user:', currentUser.uid);
    
    // Create a faster polling interval (every 2 seconds) just for Fire Out detection
    const fireOutCheckInterval = setInterval(async () => {
      try {
        // Fetch latest reports
        const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports', {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) return;
        
        const allReports = await response.json();
        const userReports = allReports.filter(r => r.user_id === currentUser.uid);
        
        console.log('🔍 AGGRESSIVE: Checking', userReports.length, 'user reports for Fire Out status...');
        
        // Check each user report for Fire Out status
        for (const report of userReports) {
          const reportId = String(report.id);
          const status = (report.status || report.progress || '').toString();
          
          console.log('📊 AGGRESSIVE: Report', reportId, 'status:', status);
          
          if (status === 'Fire Out') {
            console.log('🔥🔥🔥 FIRE OUT STATUS DETECTED for report:', reportId);
            
            // Update all report lists immediately - ALWAYS update to ensure UI refresh
            const updatedReport = { ...report, status: 'Fire Out', progress: 'Fire Out' };
            
            console.log('🔥 AGGRESSIVE: Force updating yourReports list...');
            setYourReports(prev => {
              const existing = prev.find(r => String(r.id) === reportId);
              console.log('   Existing report in yourReports:', existing ? `Found (status: ${existing.status})` : 'Not found');
              
              // Always update the report to trigger re-render
              const updated = prev.map(r => 
                String(r.id) === reportId ? updatedReport : r
              );
              
              // If report not found, add it
              if (!existing) {
                console.log('   Adding report to yourReports');
                updated.unshift(updatedReport);
              }
              
              console.log('   ✅ yourReports updated, total reports:', updated.length);
              return sortReportsByDate(updated);
            });
            
            console.log('🔥 AGGRESSIVE: Force updating allReports list...');
            setAllReports(prev => {
              const updated = prev.map(r => 
                String(r.id) === reportId ? updatedReport : r
              );
              
              const existing = prev.find(r => String(r.id) === reportId);
              if (!existing) {
                updated.unshift(updatedReport);
              }
              
              return sortReportsByDate(updated);
            });
            
            console.log('🔥 AGGRESSIVE: Force updating nearbyReports list...');
            setNearbyReports(prev => {
              const updated = prev.map(r => 
                String(r.id) === reportId ? updatedReport : r
              );
              return sortReportsByDate(updated);
            });
            
            // Check if modal already shown using state updater
            const modalKey = `${reportId}:Fire Out`;
            
            setShownModalKeys(prevKeys => {
              const alreadyShown = prevKeys.has(modalKey);
              console.log('🔍 AGGRESSIVE: Checking modal key:', modalKey);
              console.log('🔍 AGGRESSIVE: Already shown?', alreadyShown);
              console.log('🔍 AGGRESSIVE: Current shown keys:', Array.from(prevKeys));
              
              if (alreadyShown) {
                console.log('⏭️ AGGRESSIVE: Skipping - Fire Out modal already shown for report:', reportId);
                return prevKeys;
              }
              
              console.log('🎊🎊🎊 AGGRESSIVE: SHOWING FIRE OUT MODAL AND NOTIFICATION NOW!');
              console.log('🎊 AGGRESSIVE: This modal will ONLY show once for this report');
              
              const location = report.resolved_address || 
                             report.address || 
                             report.geotag_location || 
                             'your reported location';
              
              const shortLocation = location.length > 50 
                ? location.substring(0, 47) + '...' 
                : location;
              
              // Send push notification FIRST
              console.log('📱 AGGRESSIVE: Sending push notification for Fire Out');
              console.log('📱 Title: ✅ Fire Out - Report Resolved');
              console.log('📱 Body:', `Great news! The fire at ${shortLocation} has been extinguished.`);
              
              sendPushNotification(
                '✅ Fire Out - Report Resolved',
                `Great news! The fire at ${shortLocation} has been extinguished. Thank you for your report!`,
                {
                  type: 'fire_out',
                  reportId: reportId,
                  status: 'Fire Out',
                  location: location,
                }
              ).then(result => {
                console.log('✅ AGGRESSIVE: Push notification sent successfully:', result);
              }).catch(err => {
                console.error('❌ AGGRESSIVE: Push notification error:', err);
                console.error('❌ Error details:', JSON.stringify(err, null, 2));
              });
              
              // Show modal SECOND
              console.log('🚀 AGGRESSIVE: Setting Fire Out modal state...');
              console.log('🚀 fireOutReport will be set to:', updatedReport.id);
              console.log('🚀 showThankYouModal will be set to: true');
              
              setFireOutReport(updatedReport);
              setShowThankYouModal(true);
              
              console.log('✅ AGGRESSIVE: Modal and notification triggered!');
              console.log('✅ Marking modal as shown (will be saved to storage):', modalKey);
              
              // TRIGGER FULL REFRESH to update all UI elements
              console.log('🔄 AGGRESSIVE: Triggering full report refresh...');
              setTimeout(() => loadReportsFromAPI(), 500);
              
              // Return new Set with this modal key added
              const newKeys = new Set([...prevKeys, modalKey]);
              console.log('✅ AGGRESSIVE: Total shown keys now:', Array.from(newKeys));
              return newKeys;
            });
          }
        }
      } catch (error) {
        console.error('❌ AGGRESSIVE: Error in Fire Out check:', error);
      }
    }, 2000); // Check every 2 seconds for faster detection
    
    return () => {
      console.log('🔌 Stopping aggressive Fire Out checker');
      clearInterval(fireOutCheckInterval);
    };
  }, [currentUser?.uid]);

  const loadReportsFromAPI = async (retryCount = 0) => {
    if (!currentUser?.uid) {
      console.log('No current user UID, skipping reports load');
      setIsLoading(false);
      return;
    }

    try {
      const useLoadingUI = !showEmergencyModal && !showLocationPicker && !showModal;
      if (useLoadingUI) setIsLoading(true);
      console.log('Loading reports for user:', currentUser.uid);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports', {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      clearTimeout(timeoutId);
      console.log('API Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API Response data received, total reports:', data.length);
        
        // Debug: Log sample report structure
        if (data.length > 0) {
          console.log('Sample report structure:', JSON.stringify(data[0], null, 2));
        }
        
        // Debug: Log current user info
        console.log('Current user info:', {
          uid: currentUser.uid,
          email: currentUser.email,
          firstName: currentUser.firstName
        });
        
        // Filter reports by current user's UID
        const userReportsRaw = data.filter(report => {
          const reporterId = report.reporterId || report.user_id;
          console.log('Checking report ID:', report.id, 'reporterId:', reporterId, 'against user:', currentUser.uid);
          return reporterId === currentUser.uid;
        });
        
        const otherReportsRaw = data.filter(report => {
          const reporterId = report.reporterId || report.user_id;
          return reporterId !== currentUser.uid;
        });
        
        // Only exclude cancelled reports - keep Fire Out so citizens can see resolution
        const isActiveReport = (r) => {
          const statusText = (r.status || r.progress || '').toString().toLowerCase();
          const isCancelled = statusText.includes('cancelled') || statusText.includes('canceled');
          return !isCancelled;
        };

        const userReports = userReportsRaw.filter(isActiveReport);
        const otherReports = otherReportsRaw.filter(isActiveReport);

        console.log('Raw user reports (before active filter):', userReportsRaw.length);
        console.log('Raw other reports (before active filter):', otherReportsRaw.length);
        console.log('Active user reports (after filter):', userReports.length);
        console.log('Active other reports (after filter):', otherReports.length);
        
        // Debug: Log sample of filtered reports
        if (userReports.length > 0) {
          console.log('Sample user report:', JSON.stringify(userReports[0], null, 2));
        }
        if (otherReports.length > 0) {
          console.log('Sample other report:', JSON.stringify(otherReports[0], null, 2));
        }
        
        // Debug: Log sample report data to understand timestamp structure
        if (userReports.length > 0) {
          console.log('Sample user report data:', JSON.stringify(userReports[0], null, 2));
        }
        if (otherReports.length > 0) {
          console.log('Sample other report data:', JSON.stringify(otherReports[0], null, 2));
        }
        
        // Enrich with readable addresses best-effort
        const enrichAddresses = async (reports, cap = 8) => {
          const results = [...reports];
          let resolved = 0;
          for (let i = 0; i < results.length && resolved < cap; i++) {
            const r = results[i];
            if (r.address || r.resolved_address) continue;
            const loc = (r.geotag_location || '').toString();
            const match = loc.match(/-?\d+\.?\d*\s*,\s*-?\d+\.?\d*/);
            if (!match) continue;
            const key = match[0];
            if (addressCache[key]) { results[i] = { ...r, resolved_address: addressCache[key] }; continue; }
            try {
              const [lat, lon] = key.split(',').map(s => parseFloat(s.trim()));
              const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
              if (rev && rev[0]) {
                const rr = rev[0];
                const label = [rr.name, rr.street, rr.subregion, rr.city || rr.region, rr.postalCode, rr.country].filter(Boolean).join(', ');
                setAddressCache(prev => ({ ...prev, [key]: label }));
                results[i] = { ...r, resolved_address: label };
                resolved++;
              }
            } catch {}
          }
          return results;
        };

        const [enrichedUser, enrichedOther] = await Promise.all([
          enrichAddresses(userReports, 10),
          enrichAddresses(otherReports, 6),
        ]);

        // Sort reports by date (most recent first) before setting state
        const sortedUserReports = sortReportsByDate(enrichedUser);
        const sortedOtherReports = sortReportsByDate(enrichedOther);
        
        setYourReports(sortedUserReports);
        setNearbyReports(sortedOtherReports);
        
        // TEMPORARY: Store all active reports for debugging
        const allActiveReports = data.filter(isActiveReport);
        setAllReports(sortReportsByDate(allActiveReports));
        console.log('All active reports stored:', allActiveReports.length);
        
        // Check for Fire Out reports to show Thank You modal
        checkForFireOutReports(sortedUserReports);
        
        // Check for acknowledged (Under Control) reports to show Acknowledgment modal
        checkForAcknowledgedReports(sortedUserReports);
        
        // Check for nearby incidents and create notifications
        // Filter out user's own reports before checking nearby incidents
        const otherUsersReports = allActiveReports.filter(report => {
          const reporterId = report.reporterId || report.user_id;
          return reporterId !== currentUser.uid;
        });
        checkForNearbyIncidents(otherUsersReports);
      } else {
        throw new Error(`API returned status: ${response.status}`);
      }
    } catch (error) {
      console.log('Error loading reports:', error);
      
      // Retry logic for network issues (silent)
      if (retryCount < 3 && error.name !== 'AbortError') {
        console.log(`Retrying... attempt ${retryCount + 1}`);
        setTimeout(() => {
          loadReportsFromAPI(retryCount + 1);
        }, 2000 * (retryCount + 1));
        return;
      } else {
        // Final fallback without user-facing alerts
        console.log('Failed to load reports after retries');
        setYourReports([]);
        setNearbyReports([]);
        setAllReports([]);
      }
    } finally {
      const useLoadingUI = !showEmergencyModal && !showLocationPicker && !showModal;
      if (useLoadingUI) setIsLoading(false);
    }
  };

  // Helper function to get timestamp value for sorting
  const getTimestampValue = (report) => {
    // Check all possible timestamp fields in order of preference
    const timestamp = report.formatted_timestamp || report.created_at || report.timestamp || report.time;
    
    if (!timestamp) return 0;
    
    // Handle "Just now" case - treat as most recent
    if (timestamp === 'Just now') {
      return new Date().getTime();
    }
    
    // Try to parse the timestamp with multiple strategies
    try {
      // Strategy 1: Direct Date constructor (handles ISO strings, standard formats)
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
      
      // Strategy 2: Handle readable formats like "October 2, 2025 5:30 pm"
      if (typeof timestamp === 'string') {
        const monthNames = {
          'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
          'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
        };
        
        // Match pattern: "Month Day, Year Hour:Minute am/pm"
        const match = timestamp.match(/(\w+)\s+(\d+),\s+(\d{4})\s+(\d+):(\d+)\s+(am|pm)/i);
        if (match) {
          const [, monthName, day, year, hour, minute, ampm] = match;
          const month = monthNames[monthName];
          if (month !== undefined) {
            let hour24 = parseInt(hour);
            if (ampm.toLowerCase() === 'pm' && hour24 !== 12) {
              hour24 += 12;
            } else if (ampm.toLowerCase() === 'am' && hour24 === 12) {
              hour24 = 0;
            }
            
            const parsedDate = new Date(parseInt(year), month, parseInt(day), hour24, parseInt(minute));
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate.getTime();
            }
          }
        }
        
        // Strategy 3: Try parsing with Date.parse (handles more formats)
        const parsed = Date.parse(timestamp);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      // Continue to fallback
    }
    
    // If all parsing fails, return 0 (will be sorted to bottom)
    return 0;
  };

  // Helper function to sort reports by timestamp (most recent first)
  const sortReportsByDate = (reports) => {
    return [...reports].sort((a, b) => {
      const timestampA = getTimestampValue(a);
      const timestampB = getTimestampValue(b);
      // Sort in descending order (newest first) - larger timestamp values come first
      return timestampB - timestampA;
    });
  };

  const getProgressColor = (progress) => {
    switch (progress) {
      case 'On Going':
        return '#ef4444';
      case 'Under Control':
        return '#f59e0b';
      case 'Fire Out':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    // If it's "Just now", keep it
    if (timestamp === 'Just now') return timestamp;
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return String(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch {
      return String(timestamp);
    }
  };

  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [fireOutReport, setFireOutReport] = useState(null);
  
  // Debug effect to monitor showThankYouModal state changes
  useEffect(() => {
    console.log('🔔 showThankYouModal state changed:', showThankYouModal);
    console.log('🔔 fireOutReport:', fireOutReport ? fireOutReport.id : 'null');
  }, [showThankYouModal, fireOutReport]);
  
  // Acknowledgment modal for "Under Control" status
  const [showAcknowledgmentModal, setShowAcknowledgmentModal] = useState(false);
  const [acknowledgedReport, setAcknowledgedReport] = useState(null);
  
  // Track shown modals by "reportId:status" to show once per status change
  const [shownModalKeys, setShownModalKeys] = useState(new Set());
  const [modalKeysLoaded, setModalKeysLoaded] = useState(false);
  
  // Load shown modal keys from AsyncStorage on mount
  useEffect(() => {
    const loadShownModals = async () => {
      try {
        const stored = await AsyncStorage.getItem('shownModalKeys');
        if (stored) {
          const parsed = JSON.parse(stored);
          setShownModalKeys(new Set(parsed));
          console.log('📦 Loaded shown modals from storage:', parsed.length, 'keys:', parsed);
        } else {
          console.log('📦 No stored modal keys found');
        }
      } catch (error) {
        console.error('Error loading shown modals:', error);
      } finally {
        setModalKeysLoaded(true);
      }
    };
    loadShownModals();
  }, []);
  
  // Save shown modal keys to AsyncStorage whenever it changes
  useEffect(() => {
    const saveShownModals = async () => {
      try {
        const array = Array.from(shownModalKeys);
        await AsyncStorage.setItem('shownModalKeys', JSON.stringify(array));
        console.log('💾 Saved shown modals to storage:', array.length);
      } catch (error) {
        console.error('Error saving shown modals:', error);
      }
    };
    if (shownModalKeys.size > 0) {
      saveShownModals();
    }
  }, [shownModalKeys]);
  
  const [emergencyData, setEmergencyData] = useState({
    cause: '',
    image: null,
    numberOfStructures: ''
  });
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalConfig, setErrorModalConfig] = useState({ title: '', message: '' });
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState(false);
  const [showWaitModal, setShowWaitModal] = useState(false);
  const [waitModalConfig, setWaitModalConfig] = useState({ title: '', message: '' });
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isLocationPickerForEdit, setIsLocationPickerForEdit] = useState(false);
  const [pickedLocation, setPickedLocation] = useState(null); // { latitude, longitude }
  const [tempPickedLocation, setTempPickedLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.002, // More zoomed in (smaller value = more zoom)
    longitudeDelta: 0.002,
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [pickedAddress, setPickedAddress] = useState('');
  const [tempPickedAddress, setTempPickedAddress] = useState('');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [isDraggingMarker, setIsDraggingMarker] = useState(false);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const mapRef = useRef(null);
  const buttonSlideAnim = useRef(new Animated.Value(0)).current;

  // Animate buttons when interacting with map
  useEffect(() => {
    const shouldHide = isDraggingMarker || isMapInteracting;
    Animated.timing(buttonSlideAnim, {
      toValue: shouldHide ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isDraggingMarker, isMapInteracting, buttonSlideAnim]);

  // Edit state
  const [editData, setEditData] = useState({
    cause: '',
    numberOfStructures: '',
    imageUri: null,
    latitude: null,
    longitude: null,
    address: '',
  });
  const [cancelReason, setCancelReason] = useState('');

  const handleReportEmergency = () => {
    if (!currentUser?.uid) {
      Alert.alert('Authentication Error', 'Please log in to report an emergency.');
      return;
    }
    setShowEmergencyModal(true);
  };

  const openLocationPicker = async () => {
    setIsGettingLocation(true);
    setIsLocationPickerForEdit(false); // Reset edit flag for emergency modal
    setShowEmergencyModal(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 10000,
        });
        const region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.003, // Balanced zoom level
          longitudeDelta: 0.003,
        };
        setMapRegion(region);
        // Reset temp location to current location
        setTempPickedLocation({ latitude: region.latitude, longitude: region.longitude });
        setTempPickedAddress(''); // Reset address to get fresh one
        // Open picker after region is set
        setShowLocationPicker(true);
        // Animate map to user's current region after a small delay to ensure map is mounted
        setTimeout(() => {
          if (mapRef.current) {
            try { 
              mapRef.current.animateToRegion(region, 500); 
            } catch (e) {
              console.log('Map animation error:', e);
            }
          }
        }, 100);
        try {
          setIsResolvingAddress(true);
          const results = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
          if (results && results[0]) {
            const r = results[0];
            const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country].filter(Boolean).join(', ');
            setTempPickedAddress(label);
          }
        } catch (e) {
          // Silently ignore reverse geocode failure - not critical
        } finally {
          setIsResolvingAddress(false);
        }
      } else {
        // If permission denied, show helpful message
        Alert.alert(
          '📍 Location Permission',
          'Location access was denied. You can still manually select a location on the map.',
          [{ text: 'OK' }]
        );
        setShowLocationPicker(true);
      }
    } catch (e) {
      // If location fails, still open picker
      setShowLocationPicker(true);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const handleImagePicker = async () => {
    // Check if permissions are already granted on iOS
    if (Platform.OS === 'ios') {
      const cameraStatus = await ImagePicker.getCameraPermissionsAsync();
      const mediaStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      // If neither permission is granted, request them
      if (cameraStatus.status !== 'granted' && mediaStatus.status !== 'granted') {
        const cameraRequest = await ImagePicker.requestCameraPermissionsAsync();
        const mediaRequest = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (cameraRequest.status !== 'granted' && mediaRequest.status !== 'granted') {
          Alert.alert(
            'Permissions Required',
            'Please enable camera or photo library access in Settings to upload images.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
          return;
        }
      }
    }
    setShowImagePickerModal(true);
  };

  const handleCameraOption = async () => {
    setShowImagePickerModal(false);
    setTimeout(async () => {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Camera permission is required to take a photo');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEmergencyData({
          ...emergencyData,
          image: result.assets[0].uri
        });
      }
    }, 300);
  };

  const handleGalleryOption = async () => {
    setShowImagePickerModal(false);
    setTimeout(async () => {
      const hasPermission = await requestMediaLibraryPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Gallery permission is required to select a photo');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setEmergencyData({
          ...emergencyData,
          image: result.assets[0].uri
        });
      }
    }, 300);
  };

  const submitEmergencyToApi = async () => {
    if (!currentUser?.uid) {
      Alert.alert('Authentication Error', 'Please log in to submit a report.');
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('Starting emergency submission for user:', currentUser.uid);
      
      // 🚫 SPAM PREVENTION: Check local cache first (immediate), then database
      try {
        // Get local submission cache
        const cacheKey = `reportSubmissions_${currentUser.uid}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);
        let localSubmissions = cachedData ? JSON.parse(cachedData) : [];
        
        // Clean up old entries (older than 24 hours)
        const now = Date.now();
        localSubmissions = localSubmissions.filter(timestamp => now - timestamp < 24 * 60 * 60 * 1000);
        
        // 🚫 RATE LIMITING - COMMENTED OUT FOR TESTING
        // Uncomment the code below when ready to enable rate limiting
        
        // // Check local cache limits (IMMEDIATE CHECK)
        // const last5Minutes = now - 5 * 60 * 1000;
        // const recentSubmissions = localSubmissions.filter(timestamp => timestamp > last5Minutes);
        // 
        // if (recentSubmissions.length >= 1) {
        //   const lastSubmission = Math.max(...recentSubmissions);
        //   const minutesLeft = Math.ceil((lastSubmission + 5 * 60 * 1000 - now) / 60000);
        //   setIsSubmitting(false);
        //   setWaitModalConfig({
        //     title: 'Please Wait',
        //     message: `You just submitted a report ${Math.floor((now - lastSubmission) / 1000)} seconds ago.\n\nPlease wait ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} before submitting another report. This helps prevent duplicate reports.`
        //   });
        //   setShowWaitModal(true);
        //   return;
        // }
        // 
        // // Check hour limit
        // const lastHour = now - 60 * 60 * 1000;
        // const submissionsLastHour = localSubmissions.filter(timestamp => timestamp > lastHour);
        // 
        // if (submissionsLastHour.length >= 2) {
        //   const oldestInHour = Math.min(...submissionsLastHour);
        //   const minutesLeft = Math.ceil((oldestInHour + 60 * 60 * 1000 - now) / 60000);
        //   setIsSubmitting(false);
        //   setWaitModalConfig({
        //     title: 'Report Limit Reached',
        //     message: `You have submitted 2 reports in the last hour.\n\nPlease wait ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} before submitting another report.`
        //   });
        //   setShowWaitModal(true);
        //   return;
        // }
        // 
        // // Check 24 hour limit
        // if (localSubmissions.length >= 5) {
        //   const oldestSubmission = Math.min(...localSubmissions);
        //   const hoursLeft = Math.ceil((oldestSubmission + 24 * 60 * 60 * 1000 - now) / (60 * 60 * 1000));
        //   setIsSubmitting(false);
        //   setWaitModalConfig({
        //     title: 'Daily Limit Reached',
        //     message: `You have reached the maximum of 5 reports per 24 hours.\n\nPlease wait ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''} before submitting another report.\n\nThis limit helps prevent spam and ensures quality reports.`
        //   });
        //   setShowWaitModal(true);
        //   return;
        // }
        // 
        // // Also check database as backup (check both reporterId and user_id fields)
        // const { data: recentReports, error: checkError } = await supabase
        //   .from('fire_reports')
        //   .select('id, created_at')
        //   .or(`reporterId.eq.${currentUser.uid},user_id.eq.${currentUser.uid}`)
        //   .order('created_at', { ascending: false })
        //   .limit(10);
        // 
        // if (!checkError && recentReports && recentReports.length > 0) {
        //   const last5MinutesDate = new Date(now - 5 * 60 * 1000);
        //   const dbReportsLast5Min = recentReports.filter(r => new Date(r.created_at) > last5MinutesDate);
        //   
        //   if (dbReportsLast5Min.length >= 1) {
        //     const lastReportTime = new Date(dbReportsLast5Min[0].created_at).getTime();
        //     const minutesLeft = Math.ceil((lastReportTime + 5 * 60 * 1000 - now) / 60000);
        //     setIsSubmitting(false);
        //     setWaitModalConfig({
        //       title: 'Please Wait',
        //       message: `Please wait ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} before submitting another report.`
        //     });
        //     setShowWaitModal(true);
        //     return;
        //   }
        // }
        
        // Record this submission attempt in local cache
        localSubmissions.push(now);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(localSubmissions));
        
      } catch (spamCheckError) {
        console.error('❌ Error checking spam limit:', spamCheckError);
        // Continue with submission if check fails (don't block legitimate emergencies)
      }
      
      // Determine location: prioritize manually picked location
      let currentLocation = 'Location unavailable';
      if (pickedLocation?.latitude && pickedLocation?.longitude) {
        currentLocation = `${pickedLocation.latitude}, ${pickedLocation.longitude}`;
        console.log('Using picked location:', currentLocation);
      } else {
        // Fallback: try device location
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              timeout: 10000,
            });
            currentLocation = `${location.coords.latitude}, ${location.coords.longitude}`;
            console.log('Location captured:', currentLocation);
          }
        } catch (locationError) {
          console.log('Location error:', locationError);
          currentLocation = 'Location unavailable';
        }
      }

      const formData = new FormData();
      formData.append('image', {
        uri: emergencyData.image,
        name: 'report.jpg',
        type: 'image/jpeg',
      });
      
      // Add real geotag location
      formData.append('geotag_location', currentLocation);
      
      // Add cause of fire
      formData.append('cause_of_fire', emergencyData.cause);
      
      // Add number of structures on fire
      if (emergencyData.numberOfStructures) {
        formData.append('number_of_structures_on_fire', emergencyData.numberOfStructures);
      }

      // Add human-readable address if user picked a location
      if (pickedAddress) {
        formData.append('address', pickedAddress);
      }

      // Add user ID for persistent identification
      formData.append('user_id', currentUser.uid);
      const userName = currentUser.firstName && currentUser.lastName 
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : 'Anonymous User';
      formData.append('user_name', userName);
      
      console.log('Sending user data:', { uid: currentUser.uid, name: userName });

      console.log('Submitting to API:', API_URL);
      
      // Retry logic with exponential backoff (Railway API may be sleeping)
      let response = null;
      let data = null;
      let lastError = null;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Attempt ${attempt}/${maxRetries} - Calling Fire Detection API...`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 40000); // 40 second timeout
          
          response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          
          // If we got a response (even if error), try to parse it
          if (response) {
            try {
              data = await response.json();
              console.log('API response:', data);
            } catch (parseError) {
              console.log('Could not parse response as JSON');
              data = null;
            }
            
            // If response is OK, break out of retry loop
            if (response.ok && data) {
              console.log('✅ API call successful!');
              break;
            }
            
            // If 404 or 500 and we have retries left, wait and retry (API might be waking up)
            if ((response.status === 404 || response.status === 500 || response.status === 503) && attempt < maxRetries) {
              const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff: 1s, 2s, 4s (max 5s)
              console.log(`⏳ API returned ${response.status}, waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue; // Try again
            }
            
            // For other errors or last attempt, throw
            throw new Error(data?.error || `API returned status ${response.status}`);
          }
        } catch (error) {
          lastError = error;
          console.log(`❌ Attempt ${attempt} failed:`, error.message);
          
          // If this is not the last attempt and it's a network error, wait and retry
          if (attempt < maxRetries && (error.message.includes('Network') || error.message.includes('Failed to fetch') || error.message.includes('aborted'))) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`⏳ Network error, waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Try again
          }
          
          // If this is the last attempt or a different error, break
          if (attempt === maxRetries) {
            throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
          }
        }
      }
      
      // If we got here without valid data, throw error
      if (!response || !response.ok || !data) {
        throw new Error(lastError?.message || 'Failed to submit emergency after multiple attempts');
      }

      const newReport = {
        id: Date.now(),
        image: data?.image_url ? { uri: data.image_url } : data?.photo_url ? { uri: data.photo_url } : { uri: emergencyData.image },
        location: data?.geotag_location || currentLocation,
        progress: data?.prediction === 'Fire' ? 'On Going' : 'Under Control',
        description: `Emergency reported: ${emergencyData.cause}\nPrediction: ${data?.prediction} (${data?.confidence})\nStructure: ${data?.structure} (${data?.structure_confidence || 'N/A'})\nSmoke: ${data?.smoke_detection} (${data?.smoke_confidence})\nAlarm: ${data?.alarm_level}`,
        reporter: userName,
        reporterId: currentUser.uid,
        timestamp: 'Just now',
        cause: emergencyData.cause,
      };

      console.log('Created new report:', newReport);

      // ✅ Create notifications for all admin users
      try {
        console.log('🔔 Starting notification creation...');
        console.log('🔍 Current user context:', {
          uid: currentUser?.uid,
          email: currentUser?.email,
          isAuthenticated: isAuthenticated
        });
        
        // Test Supabase connection first
        console.log('🔍 Testing Supabase connection...');
        const { data: testData, error: testError } = await supabase
          .from('admin_users')
          .select('count')
          .limit(1);
        
        console.log('🔍 Supabase connection test:', { testData, testError });
        
        // Get all admin users
        console.log('🔍 Fetching admin users...');
        const { data: adminUsers, error: adminError } = await supabase
          .from('admin_users')
          .select('id, email, first_name, last_name, status, role');
        
        console.log('📊 Admin users query result:', { 
          adminUsers, 
          adminError, 
          count: adminUsers?.length,
          errorDetails: adminError ? {
            message: adminError.message,
            details: adminError.details,
            hint: adminError.hint,
            code: adminError.code
          } : null
        });
        
        if (adminError) {
          console.error('❌ Error fetching admin users:', adminError);
          console.error('❌ This might be an RLS policy issue. Check your Supabase RLS policies.');
          throw adminError;
        }
        
        if (!adminUsers || adminUsers.length === 0) {
          console.warn('⚠️ No admin users found in database!');
          console.warn('Please ensure admin_users table has at least one user');
          return;
        }
        
        console.log(`✅ Found ${adminUsers.length} admin user(s), creating notifications...`);
        
        const notifications = adminUsers.map(admin => ({
          user_id: admin.id,
          user_type: 'admin',
          title: '🔥 New Fire Report Submitted',
          message: `${userName} reported a fire: ${emergencyData.cause}. Location: ${pickedAddress || currentLocation}. Prediction: ${data?.prediction || 'Unknown'} (Confidence: ${data?.confidence || 'N/A'})`,
          type: 'fire_alert',
          priority: data?.prediction === 'Fire' ? 'urgent' : 'high',
          is_read: false,
          related_report_id: data?.id || String(newReport.id),
        }));
        
        console.log('📝 Notifications to insert:', JSON.stringify(notifications, null, 2));
        
        const { data: insertedData, error: notifError } = await supabase
          .from('notifications')
          .insert(notifications)
          .select();
        
        if (notifError) {
          console.error('❌ Error creating notifications:', notifError);
          console.error('❌ Notification error details:', {
            message: notifError.message,
            details: notifError.details,
            hint: notifError.hint,
            code: notifError.code
          });
          throw notifError;
        } else {
          console.log('✅ Successfully created notifications:', insertedData);
          console.log(`✅ Created ${insertedData?.length || 0} notification(s) for ${adminUsers.length} admin user(s)`);
        }
      } catch (notifErr) {
        console.error('❌ Notification creation failed:', notifErr);
        console.error('❌ Error details:', JSON.stringify(notifErr, null, 2));
        console.error('❌ This is likely an RLS policy issue. Please check your Supabase policies.');
        // Don't fail the report submission if notification creation fails
      }

      // ✅ Create notification for the citizen who submitted the report
      try {
        console.log('🔔 Creating notification for citizen who submitted report...');
        const citizenNotification = {
          user_id: currentUser.uid,
          user_type: 'citizen',
          title: 'Your report has been submitted!',
          message: `AI has analyzed your report to have ${data?.confidence || 'N/A'}% fire confidence`,
          type: 'user_action',
          priority: 'high',
          related_report_id: data?.id || String(newReport.id),
          is_read: false,
        };

        const { data: citizenNotifData, error: citizenNotifError } = await supabase
          .from('notifications')
          .insert(citizenNotification)
          .select();

        if (citizenNotifError) {
          console.error('❌ Error creating citizen notification:', citizenNotifError);
        } else {
          console.log('✅ Successfully created citizen notification:', citizenNotifData);
          
          // Send push notification to the device
          await sendPushNotification(
            'Your report has been submitted!',
            `AI has analyzed your report to have ${data?.confidence || 'N/A'}% fire confidence`,
            {
              type: 'report_submitted',
              reportId: data?.id || String(newReport.id),
              confidence: data?.confidence,
              address: pickedAddress || currentLocation,
            }
          );
        }
      } catch (citizenNotifErr) {
        console.error('❌ Error creating citizen notification:', citizenNotifErr);
        // Don't fail the report submission if notification creation fails
      }

      // ✅ Automatically notify nearby stations based on location
      try {
        console.log('🔔 Finding nearby stations for automatic notification...');
        
        // Get report coordinates
        const reportLat = parseFloat(data?.latitude || pickedLocation?.latitude);
        const reportLng = parseFloat(data?.longitude || pickedLocation?.longitude);
        
        if (!reportLat || !reportLng) {
          console.warn('⚠️ Report location not available, skipping station notification');
        } else {
          console.log('📍 Report location:', { reportLat, reportLng });
          
          // Get all stations with their coverage areas
          const { data: stations, error: stationsError } = await supabase
            .from('station_users')
            .select('id, station_name, latitude, longitude, coverage_radius')
            .eq('account_status', 'active');
          
          if (stationsError) {
            console.error('❌ Error fetching stations:', stationsError);
          } else if (stations && stations.length > 0) {
            console.log(`📊 Found ${stations.length} active station(s)`);
            
            // Calculate distance to each station and find those within coverage
            const nearbyStations = stations.filter(station => {
              if (!station.latitude || !station.longitude || !station.coverage_radius) {
                return false;
              }
              
              // Calculate distance using Haversine formula
              const R = 6371; // Earth's radius in km
              const dLat = (station.latitude - reportLat) * Math.PI / 180;
              const dLon = (station.longitude - reportLng) * Math.PI / 180;
              const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(reportLat * Math.PI / 180) * Math.cos(station.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              const distance = R * c; // Distance in km
              
              const isWithinCoverage = distance <= (station.coverage_radius / 1000); // Convert radius to km
              
              console.log(`📏 Station ${station.station_name}: ${distance.toFixed(2)}km away, coverage: ${(station.coverage_radius / 1000).toFixed(2)}km, within range: ${isWithinCoverage}`);
              
              return isWithinCoverage;
            });
            
            if (nearbyStations.length > 0) {
              console.log(`✅ Found ${nearbyStations.length} station(s) within coverage area`);
              
              // Create notifications for nearby stations
              const stationNotifications = nearbyStations.map(station => ({
                user_id: station.id,
                user_type: 'station',
                type: 'fire_alert',
                related_report_id: String(data?.id || newReport.id),
                title: `🚨 New Fire Report in Your Area`,
                message: `A fire has been reported at ${pickedAddress || 'an unknown location'}.\n\nConfidence: ${data?.confidence || 'N/A'}%\nCause: ${emergencyData.cause || 'Not specified'}\n\nThis report is within your station's coverage area. Please review and respond.`,
                priority: 'urgent',
                is_read: false
              }));
              
              const { data: stationNotifData, error: stationNotifError } = await supabase
                .from('notifications')
                .insert(stationNotifications)
                .select();
              
              if (stationNotifError) {
                console.error('❌ Error creating station notifications:', stationNotifError);
              } else {
                console.log(`✅ Successfully notified ${nearbyStations.length} station(s):`, 
                  nearbyStations.map(s => s.station_name).join(', '));
              }
            } else {
              console.log('ℹ️ No stations found within coverage area of this report');
            }
          }
        }
      } catch (stationNotifErr) {
        console.error('❌ Error notifying nearby stations:', stationNotifErr);
        // Don't fail the report submission if notification creation fails
      }

      // Add to local state immediately for better UX, then sort
      setYourReports(prevReports => sortReportsByDate([newReport, ...prevReports]));

      setShowEmergencyModal(false);
      setShowLocationPicker(false);
      setPickedLocation(null);
      setEmergencyData({ cause: '', image: null, numberOfStructures: '' });
      setActiveTab('Your Reports');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      
      // Refresh reports from API to ensure consistency
      setTimeout(() => {
        loadReportsFromAPI();
      }, 2000);
      
    } catch (err) {
      console.log('Submission error:', err);
      
      // Provide helpful error messages based on error type
      let errorTitle = 'Error';
      let errorMessage = 'Something went wrong while submitting the report';
      
      if (err.name === 'AbortError') {
        errorTitle = 'Request Timeout';
        errorMessage = 'The submission is taking too long. The Fire Detection API might be starting up. Please try again in 30 seconds.';
      } else if (err.message.includes('Network') || err.message.includes('Failed to fetch')) {
        errorTitle = 'Network Error';
        errorMessage = 'Cannot connect to the Fire Detection service. Please check your internet connection and try again.\n\nIf the problem persists, the API server may be sleeping (Railway free tier). Please wait 30 seconds and try again.';
      } else if (err.message.includes('404')) {
        errorTitle = 'Service Unavailable';
        errorMessage = 'The Fire Detection API is currently unavailable (possibly sleeping). Please wait 30 seconds and try again.';
      } else if (err.message.includes('500') || err.message.includes('503')) {
        errorTitle = 'Server Error';
        errorMessage = 'The Fire Detection service encountered an error. Please try again in a moment.';
      } else if (err.message.includes('after 3 attempts')) {
        errorTitle = 'Connection Failed';
        errorMessage = 'Could not connect to Fire Detection service after multiple attempts. The service may be starting up. Please wait 1 minute and try again.';
      } else {
        errorMessage = err?.message || errorMessage;
      }
      
      Alert.alert(errorTitle, errorMessage, [
        { text: 'OK', style: 'default' }
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEmergency = () => {
    if (!emergencyData.cause.trim()) {
      setErrorModalConfig({ title: 'Error', message: 'Please write the cause of fire' });
      setShowErrorModal(true);
      return;
    }
    if (!emergencyData.image) {
      setErrorModalConfig({ title: 'Error', message: 'Please upload a picture' });
      setShowErrorModal(true);
      return;
    }

    setShowConfirmSubmitModal(true);
  };

  const openReportModal = (report) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const openEditFromReport = (report) => {
    const lat = report.latitude ? parseFloat(report.latitude) : null;
    const lon = report.longitude ? parseFloat(report.longitude) : null;
    setEditData({
      cause: report.cause_of_fire || report.cause || '',
      numberOfStructures: report.number_of_structures_on_fire ? String(report.number_of_structures_on_fire) : '',
      imageUri: report.image_url || report.photo_url || report.image?.uri || null,
      latitude: lat,
      longitude: lon,
      address: report.address || report.resolved_address || '',
    });
    setShowModal(false);
    setTimeout(() => setShowEditModal(true), 200);
  };

  const renderReportCard = (report) => {
    // Handle different image source formats (API response vs local state)
    const imageSource = (() => {
      // Prefer Supabase 'image_url' if present
      if (report.image_url) return { uri: report.image_url };
      if (report.photo_url) return { uri: report.photo_url };
      if (report.image?.uri) return report.image;
      if (typeof report.image === 'string') return { uri: report.image };
      return require('../../../../assets/images/burnhouse.jpg');
    })();
    
    // Map API fields to display fields
    const displayLocation = report.resolved_address || report.address || report.location || report.geotag_location || 'Location unavailable';
    const displayReporter = report.reporter || report.user_name || 'Unknown Reporter';
    const displayTimestamp = report.formatted_timestamp || report.created_at || report.timestamp || 'Unknown time';
    const displayCause = report.cause || report.cause_of_fire || 'No cause specified';
    
    // Determine progress - FIXED: Check 'status' field first (Railway API uses this), then 'progress' as fallback
    const displayProgress = report.status || report.progress || 
                           (report.prediction === 'Fire' ? 'On Going' : 'Under Control') ||
                           'Unknown';

    return (
      <TouchableOpacity
        key={report.id || report._id || Math.random()}
        className="bg-white rounded-lg p-4 mb-4 shadow-sm"
        onPress={() => openReportModal(report)}
        activeOpacity={0.7}
      >
        <Image
          source={imageSource}
          className="w-full h-44 rounded-lg mb-3"
          resizeMode="contain"
        />
        
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm text-gray-500">{displayReporter}</Text>
          <Text className="text-sm text-gray-500">
            {formatTimestamp(displayTimestamp)}
          </Text>
        </View>

        <Text className="text-gray-800 font-semibold text-base mb-2">
          {displayLocation}
        </Text>

        <View className="flex-row items-center justify-between mb-2">
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: getProgressColor(displayProgress) + '20' }}
          >
            <Text
              className="text-xs font-medium"
              style={{ color: getProgressColor(displayProgress) }}
            >
              {displayProgress}
            </Text>
          </View>
        </View>

        <Text className="text-gray-500 text-xs">
          Cause: {displayCause}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    let reports = [];
    let title = '';

    switch (activeTab) {
      case 'Your Reports':
        reports = yourReports;
        title = 'Your Reports';
        break;
      case 'Nearby Reports':
        reports = nearbyReports;
        title = 'Nearby Reports';
        break;
      case 'All':
        // TEMPORARY: Show all reports from API for debugging
        // TODO: Remove this temporary fix once we identify the issue
        reports = allReports;
        title = 'All Reports';
        break;
    }

    // Sort reports by timestamp (most recent first)
    const sortedReports = sortReportsByDate(reports);


    return (
      <View className="flex-1">
        <Text className="text-lg font-semibold text-gray-800 mb-4">
          {title} ({sortedReports.length})
        </Text>
        
        {sortedReports.length === 0 ? (
          <View className="flex-1 justify-center items-center py-12">
            <MaterialIcons name="report" size={64} color="#d1d5db" />
            <Text className="text-gray-500 text-lg font-medium mt-4 text-center">
              {activeTab === 'Your Reports' 
                ? 'No reports yet' 
                : activeTab === 'Nearby Reports' 
                ? 'No nearby reports' 
                : 'No reports available'
              }
            </Text>
            <Text className="text-gray-400 text-sm mt-2 text-center">
              {activeTab === 'Your Reports' 
                ? 'Submit your first emergency report using the button above' 
                : 'Check back later for updates'
              }
            </Text>
          </View>
        ) : (
          sortedReports.map(renderReportCard)
        )}
      </View>
    );
  };

  // Add pull to refresh functionality
  const handleRefresh = () => {
    if (currentUser?.uid) {
      loadReportsFromAPI();
    }
  };

  // Show loading state (but never interrupt modals)
  if (isLoading && !showEmergencyModal && !showLocationPicker && !showModal) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <MaterialIcons name="refresh" size={48} color="#6b7280" />
        <Text className="text-lg text-gray-600 mt-4">Loading reports...</Text>
        <Text className="text-sm text-gray-500 mt-2">Please wait a moment</Text>
        <TouchableOpacity 
          className="mt-4 bg-red-600 px-6 py-2 rounded-lg"
          onPress={handleRefresh}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show authentication required state
  if (!currentUser) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <MaterialIcons name="account-circle" size={64} color="#d1d5db" />
        <Text className="text-lg text-gray-600 mt-4">Authentication Required</Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          Please log in to view and report emergencies
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 pt-12">
        {/* Report Emergency Button */}
        <TouchableOpacity
          className="bg-red-600 rounded-lg p-4 mb-6 items-center shadow-sm"
          onPress={handleReportEmergency}
          activeOpacity={0.8}
        >
          <MaterialIcons name="emergency" size={24} color="#ffffff" />
          <Text className="text-white font-semibold text-base mt-2">Report Emergency</Text>
        </TouchableOpacity>

        {/* Clean Modern Tab Buttons */}
        <View className="flex-row mb-4 gap-2">
          <TouchableOpacity
            className={`flex-1 py-3.5 px-4 rounded-xl ${activeTab === 'Your Reports' ? 'bg-[#ff512f]' : 'bg-white'}`}
            onPress={() => setActiveTab('Your Reports')}
            activeOpacity={0.7}
            style={{
              shadowColor: activeTab === 'Your Reports' ? '#ff512f' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: activeTab === 'Your Reports' ? 0.3 : 0.08,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className={`text-center font-bold text-sm ${activeTab === 'Your Reports' ? 'text-white' : 'text-gray-700'}`}>
              Your Reports
            </Text>
            <Text className={`text-center font-bold text-xs mt-0.5 ${activeTab === 'Your Reports' ? 'text-white/80' : 'text-gray-500'}`}>
              ({yourReports.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className={`flex-1 py-3.5 px-4 rounded-xl ${activeTab === 'Nearby Reports' ? 'bg-[#ff512f]' : 'bg-white'}`}
            onPress={() => setActiveTab('Nearby Reports')}
            activeOpacity={0.7}
            style={{
              shadowColor: activeTab === 'Nearby Reports' ? '#ff512f' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: activeTab === 'Nearby Reports' ? 0.3 : 0.08,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className={`text-center font-bold text-sm ${activeTab === 'Nearby Reports' ? 'text-white' : 'text-gray-700'}`}>
              Nearby
            </Text>
            <Text className={`text-center font-bold text-xs mt-0.5 ${activeTab === 'Nearby Reports' ? 'text-white/80' : 'text-gray-500'}`}>
              ({nearbyReports.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className={`flex-1 py-3.5 px-4 rounded-xl ${activeTab === 'All' ? 'bg-[#ff512f]' : 'bg-white'}`}
            onPress={() => setActiveTab('All')}
            activeOpacity={0.7}
            style={{
              shadowColor: activeTab === 'All' ? '#ff512f' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: activeTab === 'All' ? 0.3 : 0.08,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className={`text-center font-bold text-sm ${activeTab === 'All' ? 'text-white' : 'text-gray-700'}`}>
              All
            </Text>
            <Text className={`text-center font-bold text-xs mt-0.5 ${activeTab === 'All' ? 'text-white/80' : 'text-gray-500'}`}>
              ({allReports.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Reports Content */}
      <View className="flex-1 px-4">
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
        >
          {renderTabContent()}
        </ScrollView>
      </View>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-4">
          <View className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 15,
          }}>
            {/* Header */}
            <LinearGradient
              colors={['#ff6b35', '#ff512f', '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingTop: 24,
                paddingBottom: 24,
                paddingHorizontal: 20,
                alignItems: 'center',
              }}
            >
              <View className="bg-white/20 rounded-full p-3 mb-3" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 4,
              }}>
                <MaterialIcons name="add-a-photo" size={32} color="#ffffff" />
              </View>
              <Text className="text-white text-2xl font-bold mb-1" style={{
                textShadowColor: 'rgba(0, 0, 0, 0.2)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}>Upload Picture</Text>
              <Text className="text-sm text-center" style={{ 
                color: 'rgba(255, 255, 255, 0.95)',
                textShadowColor: 'rgba(0, 0, 0, 0.15)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}>Choose an option to add your photo</Text>
            </LinearGradient>

            {/* Options */}
            <View className="p-5">
              <TouchableOpacity
                className="bg-blue-500 rounded-2xl p-5 mb-3 items-center shadow-lg flex-row"
                onPress={handleCameraOption}
                activeOpacity={0.85}
                style={{
                  shadowColor: '#3b82f6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <View className="bg-white/20 rounded-full p-2 mr-3">
                  <MaterialIcons name="camera-alt" size={24} color="#ffffff" />
                </View>
                <Text className="text-white font-bold text-lg flex-1">Take Photo</Text>
                <MaterialIcons name="chevron-right" size={24} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-purple-500 rounded-2xl p-5 mb-3 items-center shadow-lg flex-row"
                onPress={handleGalleryOption}
                activeOpacity={0.85}
                style={{
                  shadowColor: '#a855f7',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <View className="bg-white/20 rounded-full p-2 mr-3">
                  <MaterialIcons name="photo-library" size={24} color="#ffffff" />
                </View>
                <Text className="text-white font-bold text-lg flex-1">Choose from Gallery</Text>
                <MaterialIcons name="chevron-right" size={24} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-gray-100 rounded-2xl p-4 items-center border-2 border-gray-200"
                onPress={() => setShowImagePickerModal(false)}
                activeOpacity={0.7}
              >
                <Text className="text-gray-700 font-bold text-base">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-4">
          <View className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 15,
          }}>
            {/* Error Icon and Title */}
            <View className="p-6 items-center">
              <View className="bg-red-100 rounded-full p-4 mb-4">
                <MaterialIcons name="error-outline" size={48} color="#ef4444" />
              </View>
              <Text className="text-2xl font-bold text-gray-800 mb-2">{errorModalConfig.title}</Text>
              <Text className="text-gray-600 text-center text-base leading-6">{errorModalConfig.message}</Text>
            </View>
            
            {/* OK Button */}
            <View className="px-6 pb-6">
              <TouchableOpacity
                className="bg-red-500 rounded-2xl py-4 items-center shadow-lg"
                onPress={() => setShowErrorModal(false)}
                activeOpacity={0.85}
                style={{
                  shadowColor: '#ef4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text className="text-white font-bold text-lg">OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Submit Modal */}
      <Modal
        visible={showConfirmSubmitModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowConfirmSubmitModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-4">
          <View className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 15,
          }}>
            {/* Warning Icon and Title */}
            <View className="p-6 items-center">
              <View className="bg-orange-100 rounded-full p-4 mb-4">
                <MaterialIcons name="warning" size={48} color="#f59e0b" />
              </View>
              <Text className="text-2xl font-bold text-gray-800 mb-2">Confirm Emergency Report</Text>
              <Text className="text-gray-600 text-center text-base leading-6">
                Are you sure you want to report this emergency? This will immediately notify emergency services.
              </Text>
            </View>
            
            {/* Action Buttons */}
            <View className="px-6 pb-6 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-100 rounded-2xl py-4 items-center border-2 border-gray-200"
                onPress={() => setShowConfirmSubmitModal(false)}
                activeOpacity={0.7}
              >
                <Text className="text-gray-700 font-bold text-base">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-red-500 rounded-2xl py-4 items-center shadow-lg"
                onPress={() => {
                  setShowConfirmSubmitModal(false);
                  submitEmergencyToApi();
                }}
                activeOpacity={0.85}
                style={{
                  shadowColor: '#ef4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text className="text-white font-bold text-base">Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wait/Rate Limit Modal */}
      <Modal
        visible={showWaitModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowWaitModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-4">
          <View className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 15,
          }}>
            {/* Warning Icon and Title */}
            <View className="p-6 items-center">
              <View className="bg-amber-100 rounded-full p-4 mb-4">
                <MaterialIcons name="schedule" size={48} color="#f59e0b" />
              </View>
              <Text className="text-2xl font-bold text-gray-800 mb-2">{waitModalConfig.title}</Text>
              <Text className="text-gray-600 text-center text-base leading-6">{waitModalConfig.message}</Text>
            </View>
            
            {/* OK Button */}
            <View className="px-6 pb-6">
              <TouchableOpacity
                className="bg-amber-500 rounded-2xl py-4 items-center shadow-lg"
                onPress={() => setShowWaitModal(false)}
                activeOpacity={0.85}
                style={{
                  shadowColor: '#f59e0b',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text className="text-white font-bold text-base">OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Emergency Reporting Modal */}
      <Modal
        visible={showEmergencyModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/60 justify-center items-center">
          <View className="bg-white rounded-3xl w-11/12 max-h-[85%] shadow-2xl overflow-hidden" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 15,
          }}>
            {/* Enhanced Header with Gradient */}
            <LinearGradient
              colors={['#ff6b35', '#ff512f', '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 24,
                paddingTop: 32,
                paddingBottom: 24,
                alignItems: 'center',
              }}
            >
              <View className="bg-white/20 rounded-full p-3 mb-3" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 4,
              }}>
                <MaterialIcons name="emergency" size={32} color="#ffffff" />
              </View>
              <Text className="text-white text-2xl font-bold mb-1" style={{
                textShadowColor: 'rgba(0, 0, 0, 0.2)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}>Report Emergency</Text>
              <Text className="text-sm" style={{ 
                color: 'rgba(255, 255, 255, 0.95)',
                textShadowColor: 'rgba(0, 0, 0, 0.15)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}>Please provide details about the incident</Text>
            </LinearGradient>
            <ScrollView className="px-6 pb-6 pt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Enhanced Upload Picture Button */}
            <TouchableOpacity
              className="bg-[#ff512f] rounded-2xl p-5 mb-4 items-center shadow-lg"
              onPress={handleImagePicker}
              activeOpacity={0.85}
              style={{
                shadowColor: '#ff512f',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
                borderWidth: 2,
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <View className="rounded-full p-2 mb-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                <MaterialIcons name="camera-alt" size={28} color="#ffffff" />
              </View>
              <Text className="text-white font-bold text-base">
                {emergencyData.image ? 'Change Picture' : 'Upload a Picture'}
              </Text>
              {emergencyData.image && (
                <Text className="text-xs mt-1" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Tap to change</Text>
              )}
            </TouchableOpacity>

            {/* Enhanced Choose Location Button */}
            <TouchableOpacity
              className="bg-gray-800 rounded-2xl p-5 mb-6 items-center shadow-lg"
              onPress={openLocationPicker}
              activeOpacity={0.85}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
                borderWidth: 2,
                borderColor: 'rgba(55, 65, 81, 0.3)',
              }}
            >
              <View className="rounded-full p-2 mb-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                <MaterialIcons name="place" size={28} color="#ffffff" />
              </View>
              <Text className="text-white font-bold text-base">
                {pickedLocation ? 'Change Location' : 'Choose Location on Map'}
              </Text>
              {pickedLocation && (
                <Text className="text-xs mt-1" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Tap to change</Text>
              )}
            </TouchableOpacity>

            {/* Enhanced Selected Image */}
            {emergencyData.image && (
              <View className="mb-6 relative">
                <Image
                  source={{ uri: emergencyData.image }}
                  className="w-full h-48 rounded-2xl"
                  resizeMode="cover"
                />
                <View className="absolute inset-0 rounded-2xl" style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }} />
                <TouchableOpacity
                  className="absolute top-3 right-3 bg-red-600 rounded-full p-2 shadow-lg"
                  onPress={() => setEmergencyData({...emergencyData, image: null})}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 5,
                  }}
                >
                  <MaterialIcons name="close" size={20} color="#ffffff" />
                </TouchableOpacity>
                <View className="absolute bottom-3 left-3 rounded-lg px-3 py-1" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
                  <Text className="text-gray-800 text-xs font-semibold">Image Selected</Text>
                </View>
              </View>
            )}

            {/* Enhanced Selected Location Preview */}
            {pickedLocation && (
              <View className="mb-6 bg-blue-50 rounded-2xl p-4 border-2 border-blue-200">
                <View className="flex-row items-center mb-2">
                  <MaterialIcons name="place" size={20} color="#3b82f6" />
                  <Text className="text-blue-700 font-semibold text-sm ml-2">Selected Location</Text>
                </View>
                <Text className="text-gray-800 font-medium text-base">
                  {pickedAddress || `${pickedLocation.latitude.toFixed(6)}, ${pickedLocation.longitude.toFixed(6)}`}
                </Text>
              </View>
            )}

            {/* Enhanced Cause of Fire Input */}
            <View className="mb-4">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="description" size={20} color="#6b7280" />
                <Text className="text-gray-700 font-semibold text-sm ml-2">Cause of Fire</Text>
              </View>
              <TextInput
                className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-gray-800 text-base"
                placeholder="Write cause of fire..."
                placeholderTextColor="#9ca3af"
                value={emergencyData.cause}
                onChangeText={(text) => setEmergencyData({...emergencyData, cause: text})}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  minHeight: 100,
                }}
              />
            </View>

            {/* Enhanced Number of Structures Input */}
            <View className="mb-6">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="business" size={20} color="#6b7280" />
                <Text className="text-gray-700 font-semibold text-sm ml-2">Number of Structures (Optional)</Text>
              </View>
              <TextInput
                className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-gray-800 text-base"
                placeholder="Enter number of structures..."
                placeholderTextColor="#9ca3af"
                value={emergencyData.numberOfStructures}
                onChangeText={(text) => setEmergencyData({...emergencyData, numberOfStructures: text})}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>

            {/* Enhanced Action Buttons */}
            <View className="flex-row gap-4 mt-4 mb-6">
              <TouchableOpacity
                className="flex-1 bg-gray-100 rounded-2xl py-4 px-4 border-2 border-gray-200 shadow-md"
                onPress={() => setShowEmergencyModal(false)}
                activeOpacity={0.7}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="close" size={20} color="#6b7280" />
                  <Text className="text-center font-bold text-gray-700 text-base ml-2">Cancel</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-2xl py-4 px-4 shadow-xl ${isSubmitting ? 'bg-gray-400' : 'bg-[#ff512f]'}`}
                onPress={handleSubmitEmergency}
                disabled={isSubmitting}
                activeOpacity={0.85}
                style={{
                  shadowColor: isSubmitting ? '#000' : '#ff512f',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  elevation: 8,
                }}
              >
                <View className="flex-row items-center justify-center">
                  {isSubmitting ? (
                    <>
                      <MaterialIcons name="hourglass-empty" size={20} color="#ffffff" />
                      <Text className="text-center font-bold text-white text-base ml-2">Submitting...</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="send" size={20} color="#ffffff" />
                      <Text className="text-center font-bold text-white text-base ml-2">Submit</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View className="flex-1 bg-white">
          {/* Compact Header */}
          <LinearGradient
            colors={['#ff6b35', '#ff512f', '#dc2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingTop: 48,
              paddingBottom: 8,
              paddingHorizontal: 16,
              alignItems: 'center',
            }}
          >
            <View className="flex-row items-center justify-center mb-1">
              <MaterialIcons name="place" size={18} color="#ffffff" />
              <Text className="text-white text-base font-bold ml-2" style={{
                textShadowColor: 'rgba(0, 0, 0, 0.2)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}>Pick Location</Text>
            </View>
            <Text className="text-white/90 text-xs" style={{
              textShadowColor: 'rgba(0, 0, 0, 0.15)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}>Tap on the map or drag the pin to select</Text>
          </LinearGradient>
          {isGettingLocation && (
            <View className="absolute top-20 left-0 right-0 z-10 items-center p-2">
              <View className="bg-black/80 px-4 py-2 rounded-full flex-row items-center" style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}>
                <MaterialIcons name="my-location" size={16} color="#ffffff" />
                <Text className="text-white text-xs ml-2 font-semibold">Getting current location…</Text>
              </View>
            </View>
          )}
          {isResolvingAddress && (
            <View className="absolute top-20 left-0 right-0 z-10 items-center p-2">
              <View className="bg-blue-600/90 px-4 py-2 rounded-full flex-row items-center" style={{
                shadowColor: '#3b82f6',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}>
                <MaterialIcons name="search" size={16} color="#ffffff" />
                <Text className="text-white text-xs ml-2 font-semibold">Resolving address…</Text>
              </View>
            </View>
          )}

          {/* Animated Location Info Card - Below Header */}
          {tempPickedLocation && (
            <Animated.View
              className="absolute left-4 right-4 z-10"
              style={{
                top: 90, // Below header (48 paddingTop + 8 paddingBottom + ~34 for content)
                transform: [{
                  translateY: buttonSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -70], // Slide up into header
                  }),
                }],
                opacity: buttonSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
              }}
            >
              <View className="bg-white/95 rounded-2xl p-3 border-2 border-white/50" style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
              }}>
                <View className="flex-row items-start">
                  <View className="bg-[#ff512f] rounded-full p-2 mr-3" style={{
                    shadowColor: '#ff512f',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 4,
                  }}>
                    <MaterialIcons name="place" size={18} color="#ffffff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-800 font-bold text-sm mb-1" numberOfLines={2}>
                      {tempPickedAddress || 'Location selected'}
                    </Text>
                    <Text className="text-gray-500 text-xs">
                      {tempPickedLocation.latitude.toFixed(6)}, {tempPickedLocation.longitude.toFixed(6)}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
          <MapView
            style={{ flex: 1 }}
            provider={PROVIDER_GOOGLE}
            region={mapRegion}
            ref={mapRef}
            showsUserLocation={true}
            showsMyLocationButton={true}
            toolbarEnabled={true}
            scrollEnabled={true}
            zoomEnabled={true}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setTempPickedLocation({ latitude, longitude });
              // Reverse-geocode tapped location so the preview shows the correct place name
              (async () => {
                try {
                  setIsResolvingAddress(true);
                  const res = await Location.reverseGeocodeAsync({ latitude, longitude });
                  if (res && res[0]) {
                    const r = res[0];
                    const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country]
                      .filter(Boolean)
                      .join(', ');
                    setTempPickedAddress(label);
                  } else {
                    setTempPickedAddress('');
                  }
                } catch (err) {
                  setTempPickedAddress('');
                } finally {
                  setIsResolvingAddress(false);
                }
              })();
            }}
            onRegionChangeStart={() => setIsMapInteracting(true)}
            onRegionChangeComplete={() => setIsMapInteracting(false)}
            onPanDrag={() => setIsMapInteracting(true)}
            key={`picker-${showLocationPicker}-${mapRegion.latitude}-${mapRegion.longitude}`}
          >
            {tempPickedLocation?.latitude && (
              <Marker
                coordinate={tempPickedLocation}
                draggable={true}
                onDragStart={() => {
                  setIsDraggingMarker(true);
                  setIsMapInteracting(true);
                }}
                onDrag={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setTempPickedLocation({ latitude, longitude });
                  
                  // Smooth edge panning - pure pan without zoom changes
                  if (mapRef.current) {
                    mapRef.current.getCamera().then((camera) => {
                      const centerLat = camera.center.latitude;
                      const centerLng = camera.center.longitude;
                      const zoom = camera.zoom || 15;
                      
                      // Calculate visible area based on zoom (for threshold only)
                      const latDelta = 180 / Math.pow(2, zoom);
                      const lngDelta = 360 / Math.pow(2, zoom);
                      
                      // Threshold: trigger when 25% from edge
                      const latThreshold = latDelta * 0.25;
                      const lngThreshold = lngDelta * 0.25;
                      
                      // Check distance from center to marker
                      const distTop = latitude - centerLat;
                      const distBottom = centerLat - latitude;
                      const distRight = longitude - centerLng;
                      const distLeft = centerLng - longitude;
                      
                      // Determine pan direction - pan 40% of visible area
                      let panLat = 0;
                      let panLng = 0;
                      
                      if (distTop > latThreshold) panLat = latDelta * 0.4;
                      if (distBottom > latThreshold) panLat = -latDelta * 0.4;
                      if (distRight > lngThreshold) panLng = lngDelta * 0.4;
                      if (distLeft > lngThreshold) panLng = -lngDelta * 0.4;
                      
                      // Use animateCamera to pan without any zoom changes
                      if (panLat !== 0 || panLng !== 0) {
                        mapRef.current.animateCamera({
                          center: {
                            latitude: centerLat + panLat,
                            longitude: centerLng + panLng,
                          },
                        }, { duration: 100 });
                      }
                    }).catch(() => {});
                  }
                }}
                onDragEnd={(e) => {
                  setIsDraggingMarker(false);
                  setIsMapInteracting(false);
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setTempPickedLocation({ latitude, longitude });
                  // Don't adjust map after drag - keep user's zoom level
                  // Reverse-geocode dragged location
                  (async () => {
                    try {
                      setIsResolvingAddress(true);
                      const res = await Location.reverseGeocodeAsync({ latitude, longitude });
                      if (res && res[0]) {
                        const r = res[0];
                        const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country]
                          .filter(Boolean)
                          .join(', ');
                        setTempPickedAddress(label);
                      } else {
                        setTempPickedAddress('');
                      }
                    } catch (err) {
                      setTempPickedAddress('');
                    } finally {
                      setIsResolvingAddress(false);
                    }
                  })();
                }}
              />
            )}
          </MapView>

          {/* Animated Bottom Buttons */}
          <Animated.View
            className="absolute bottom-0 left-0 right-0"
            style={{
              transform: [{
                translateY: buttonSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 120],
                }),
              }],
              opacity: buttonSlideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
              paddingBottom: 20,
              paddingTop: 12,
              paddingHorizontal: 16,
              backgroundColor: 'transparent',
            }}
          >
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-100 rounded-2xl py-4 px-4 border-2 border-gray-200"
                onPress={() => {
                  if (isLocationPickerForEdit) {
                    setIsLocationPickerForEdit(false);
                    setTimeout(() => setShowEditModal(true), 200);
                  }
                  setShowLocationPicker(false);
                }}
                activeOpacity={0.7}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="close" size={20} color="#6b7280" />
                  <Text className="text-center font-bold text-gray-700 text-base ml-2">Cancel</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-2xl py-4 px-4 ${tempPickedLocation?.latitude ? 'bg-[#ff512f]' : 'bg-gray-300'}`}
                onPress={async () => {
                  if (tempPickedLocation?.latitude && tempPickedLocation?.longitude) {
                    try {
                      setIsResolvingAddress(true);
                      let finalAddress = tempPickedAddress;
                      if (!finalAddress) {
                        const res = await Location.reverseGeocodeAsync(tempPickedLocation);
                        if (res && res[0]) {
                          const r = res[0];
                          const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country].filter(Boolean).join(', ');
                          finalAddress = label;
                        }
                      }
                      
                      if (isLocationPickerForEdit) {
                        // Update edit data
                        setEditData({
                          ...editData,
                          latitude: tempPickedLocation.latitude,
                          longitude: tempPickedLocation.longitude,
                          address: finalAddress || editData.address || '',
                        });
                        setIsLocationPickerForEdit(false);
                        setShowLocationPicker(false);
                        // Reopen edit modal
                        setTimeout(() => setShowEditModal(true), 200);
                      } else {
                        // Update emergency data (original behavior)
                        setPickedLocation(tempPickedLocation);
                        setPickedAddress(finalAddress || pickedAddress || '');
                        setShowLocationPicker(false);
                        setTimeout(() => setShowEmergencyModal(true), 200);
                      }
                    } catch (e) {
                    } finally {
                      setIsResolvingAddress(false);
                    }
                  } else {
                    Alert.alert('Select a location', 'Tap on the map to place a pin, then drag it to adjust.');
                  }
                }}
                disabled={!tempPickedLocation?.latitude}
                activeOpacity={0.85}
                style={{
                  shadowColor: tempPickedLocation?.latitude ? '#ff512f' : '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="check-circle" size={20} color="#ffffff" />
                  <Text className="text-center font-bold text-white text-base ml-2">Use Location</Text>
                </View>
              </TouchableOpacity>
            </View>
            {!tempPickedLocation && (
              <Text className="text-center text-gray-500 text-xs mt-2">
                Tap anywhere on the map to place a pin
              </Text>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Report Detail Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/60 justify-center items-center">
          <View className="bg-white rounded-3xl w-11/12 max-h-[85%] overflow-hidden" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 15,
          }}>
            {selectedReport && (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {/* Enhanced Header */}
                <LinearGradient
                  colors={['#ff6b35', '#ff512f', '#dc2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingTop: 16,
                    paddingBottom: 16,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View className="flex-row items-center">
                    <MaterialIcons name="description" size={24} color="#ffffff" />
                    <Text className="text-white text-xl font-bold ml-2" style={{
                      textShadowColor: 'rgba(0, 0, 0, 0.2)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 3,
                    }}>Report Details</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowModal(false)}
                    className="bg-white/20 rounded-full p-2"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    <MaterialIcons name="close" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </LinearGradient>

                <View className="px-5 pt-5 pb-16">
                  {/* Fire Image */}
                  <View className="mb-5">
                    <Image
                      source={(() => {
                        if (selectedReport.image_url) return { uri: selectedReport.image_url };
                        if (selectedReport.photo_url) return { uri: selectedReport.photo_url };
                        if (selectedReport.image?.uri) return selectedReport.image;
                        if (typeof selectedReport.image === 'string') return { uri: selectedReport.image };
                        return require('../../../../assets/images/burnhouse.jpg');
                      })()}
                      className="w-full h-64 rounded-2xl"
                      resizeMode="cover"
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        elevation: 8,
                      }}
                    />
                  </View>

                  {/* Status Badge - Prominent */}
                  {(() => {
                    const progress = selectedReport.status || selectedReport.progress ||
                      (selectedReport.prediction === 'Fire' ? 'On Going' : 'Under Control') ||
                      'Unknown';
                    const color = getProgressColor(progress);
                    return (
                      <View className="mb-5 items-center">
                        <View
                          className="px-5 py-2 rounded-full"
                          style={{ 
                            backgroundColor: color + '20',
                            borderWidth: 2,
                            borderColor: color,
                          }}
                        >
                          <Text
                            className="text-base font-bold"
                            style={{ color }}
                          >
                            {progress}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Basic Information Section */}
                  <View className="mb-5">
                    <Text className="text-gray-500 text-xs font-semibold uppercase mb-3 tracking-wider">Basic Information</Text>
                    <View className="bg-gray-50 rounded-2xl p-4">
                      <View className="flex-row items-start mb-3">
                        <MaterialIcons name="person" size={18} color="#6b7280" />
                        <View className="flex-1 ml-3">
                          <Text className="text-gray-500 text-xs mb-1">Reporter</Text>
                          <Text className="text-gray-800 font-semibold text-base">
                            {selectedReport.reporter || selectedReport.user_name || 'Unknown Reporter'}
                          </Text>
                        </View>
                      </View>
                      <View className="h-px bg-gray-200 mb-3" />
                      <View className="flex-row items-start mb-3">
                        <MaterialIcons name="place" size={18} color="#6b7280" />
                        <View className="flex-1 ml-3">
                          <Text className="text-gray-500 text-xs mb-1">Location</Text>
                          <Text className="text-gray-800 font-semibold text-base">
                            {selectedReport.resolved_address || selectedReport.address || selectedReport.location || selectedReport.geotag_location || 'Location unavailable'}
                          </Text>
                        </View>
                      </View>
                      <View className="h-px bg-gray-200 mb-3" />
                      <View className="flex-row items-start">
                        <MaterialIcons name="schedule" size={18} color="#6b7280" />
                        <View className="flex-1 ml-3">
                          <Text className="text-gray-500 text-xs mb-1">Reported</Text>
                          <Text className="text-gray-800 font-semibold text-base">
                            {formatTimestamp(selectedReport.formatted_timestamp || selectedReport.created_at || selectedReport.timestamp)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Fire Details Section */}
                  {(selectedReport.cause || selectedReport.cause_of_fire || selectedReport.number_of_structures_on_fire) && (
                    <View className="mb-5">
                      <Text className="text-gray-500 text-xs font-semibold uppercase mb-3 tracking-wider">Fire Details</Text>
                      <View className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255, 81, 47, 0.05)' }}>
                        {selectedReport.cause || selectedReport.cause_of_fire ? (
                          <>
                            <View className="flex-row items-start mb-3">
                              <MaterialIcons name="warning" size={18} color="#ff512f" />
                              <View className="flex-1 ml-3">
                                <Text className="text-gray-500 text-xs mb-1">Cause of Fire</Text>
                                <Text className="text-gray-800 font-semibold text-base">
                                  {selectedReport.cause || selectedReport.cause_of_fire || 'No cause specified'}
                                </Text>
                              </View>
                            </View>
                            {selectedReport.number_of_structures_on_fire && <View className="h-px mb-3" style={{ backgroundColor: 'rgba(255, 81, 47, 0.2)' }} />}
                          </>
                        ) : null}
                        {selectedReport.number_of_structures_on_fire && (
                          <View className="flex-row items-start">
                            <MaterialIcons name="business" size={18} color="#ff512f" />
                            <View className="flex-1 ml-3">
                              <Text className="text-gray-500 text-xs mb-1">Structures Affected</Text>
                              <Text className="text-gray-800 font-semibold text-base">
                                {selectedReport.number_of_structures_on_fire} structure(s)
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* AI Analysis Section */}
                  {(selectedReport.prediction || selectedReport.structure || selectedReport.smoke_detection || selectedReport.alarm_level) && (
                    <View className="mb-5">
                      <Text className="text-gray-500 text-xs font-semibold uppercase mb-3 tracking-wider">AI Analysis</Text>
                      <View className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                        {selectedReport.prediction && (
                          <>
                            <View className="flex-row items-start mb-3">
                              <MaterialIcons name="psychology" size={18} color="#3b82f6" />
                              <View className="flex-1 ml-3">
                                <Text className="text-gray-500 text-xs mb-1">AI Confidence</Text>
                                <Text className="text-gray-800 font-semibold text-base">
                                  {selectedReport.prediction} {selectedReport.confidence ? `(${selectedReport.confidence})` : ''}
                                </Text>
                              </View>
                            </View>
                            {(selectedReport.structure || selectedReport.smoke_detection || selectedReport.alarm_level) && <View className="h-px mb-3" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }} />}
                          </>
                        )}
                        {selectedReport.structure && (
                          <>
                            <View className="flex-row items-start mb-3">
                              <MaterialIcons name="domain" size={18} color="#3b82f6" />
                              <View className="flex-1 ml-3">
                                <Text className="text-gray-500 text-xs mb-1">Structure Type</Text>
                                <Text className="text-gray-800 font-semibold text-base">
                                  {selectedReport.structure}
                                  {selectedReport.structure_confidence ? ` (${selectedReport.structure_confidence})` : ''}
                                </Text>
                              </View>
                            </View>
                            {(selectedReport.smoke_intensity || selectedReport.alarm_level) && <View className="h-px mb-3" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }} />}
                          </>
                        )}
                        {selectedReport.smoke_intensity && (
                          <>
                            <View className="flex-row items-start mb-3">
                              <MaterialIcons name="cloud" size={18} color="#3b82f6" />
                              <View className="flex-1 ml-3">
                                <Text className="text-gray-500 text-xs mb-1">Smoke Intensity</Text>
                                <Text className="text-gray-800 font-semibold text-base">
                                  {selectedReport.smoke_detection} {selectedReport.smoke_confidence ? `(${selectedReport.smoke_confidence})` : ''}
                                </Text>
                              </View>
                            </View>
                            {selectedReport.alarm_level && <View className="h-px mb-3" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }} />}
                          </>
                        )}
                        {selectedReport.alarm_level && (
                          <View className="flex-row items-start">
                            <MaterialIcons name="notifications-active" size={18} color="#3b82f6" />
                            <View className="flex-1 ml-3">
                              <Text className="text-gray-500 text-xs mb-1">Alarm Level</Text>
                              <Text className="text-gray-800 font-semibold text-base">
                                {selectedReport.alarm_level}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Description Section */}
                  {selectedReport.description && selectedReport.description !== 'Emergency report submitted' && (
                    <View className="mb-5">
                      <Text className="text-gray-500 text-xs font-semibold uppercase mb-3 tracking-wider">Description</Text>
                      <View className="bg-gray-50 rounded-2xl p-4">
                        <Text className="text-gray-800 text-base leading-6">
                          {selectedReport.description}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Action Buttons */}
                  {selectedReport && (
                    <View className="flex-row gap-3 mt-2 mb-6">
                      <TouchableOpacity
                        className="flex-1 bg-gray-100 rounded-2xl py-4 px-4 border-2 border-gray-200"
                        onPress={() => openEditFromReport(selectedReport)}
                        activeOpacity={0.7}
                        style={{
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 3,
                        }}
                      >
                        <View className="flex-row items-center justify-center">
                          <MaterialIcons name="edit" size={20} color="#6b7280" />
                          <Text className="text-center font-bold text-gray-700 text-base ml-2">Edit Report</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 bg-[#ff512f] rounded-2xl py-4 px-4"
                        onPress={() => {
                          setShowModal(false);
                          setCancelReason('');
                          setShowCancelModal(true);
                        }}
                        activeOpacity={0.85}
                        style={{
                          shadowColor: '#ff512f',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 8,
                          elevation: 6,
                        }}
                      >
                        <View className="flex-row items-center justify-center">
                          <MaterialIcons name="cancel" size={20} color="#ffffff" />
                          <Text className="text-center font-bold text-white text-base ml-2">Cancel Report</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Cancel Reason Modal */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg w-11/12 p-6">
            <Text className="text-xl font-bold text-gray-800 mb-2">Cancel Report</Text>
            <Text className="text-gray-600 mb-4">Please provide a reason for cancelling this report.</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-4 text-gray-800 min-h-[100px]"
              placeholder="Enter your reason..."
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              textAlignVertical="top"
              returnKeyType="done"
            />
            <View className="flex-row mt-4 gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-300 rounded-lg p-3"
                onPress={() => setShowCancelModal(false)}
              >
                <Text className="text-center font-semibold text-gray-700">Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-lg p-3 ${cancelReason.trim() ? 'bg-red-600' : 'bg-gray-300'}`}
                disabled={!cancelReason.trim()}
                onPress={async () => {
                  try {
                    if (!selectedReport?.id) throw new Error('Missing report id');
                    // Generate client-side timestamp as fallback (server also sets one)
                    const now = new Date();
                    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
                    const localTs = now.toLocaleString('en-US', options).replace('AM', 'am').replace('PM', 'pm');

                    // Prefer the same endpoint used by admin to ensure fields populate
                    let res = await fetch(`${API_BASE}/update_report_status`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                      body: JSON.stringify({
                        report_id: selectedReport.id,
                        status: 'Cancelled',
                        reason: cancelReason,
                        cancelled_by: currentUser?.email || [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || currentUser?.uid || 'Citizen User',
                        cancelled_by_role: 'citizen',
                      })
                    });
                    let data;
                    try { data = await res.clone().json(); } catch { data = await res.text(); }
                    if (!res.ok) {
                      // Fallback to dedicated cancel endpoint for older backends
                      res = await fetch(`${API_BASE}/cancel_report/${selectedReport.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          reason: cancelReason,
                          cancellation_reason: cancelReason,
                          cancelled_by: currentUser?.email || currentUser?.uid || 'Citizen User',
                          cancelled_by_role: 'citizen',
                          cancellation_timestamp: localTs,
                        })
                      });
                      try { data = await res.clone().json(); } catch { data = await res.text(); }
                      if (!res.ok) throw new Error(typeof data === 'string' ? data : (data?.error || 'Failed to cancel'));
                    }
                    setShowCancelModal(false);
                    setTimeout(() => loadReportsFromAPI(), 300);
                  } catch (e) {
                    Alert.alert('Cancel Failed', e?.message || 'Please try again later');
                  }
                }}
              >
                <Text className={`text-center font-semibold ${cancelReason.trim() ? 'text-white' : 'text-gray-500'}`}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Report Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center">
          <View className="bg-white rounded-3xl w-11/12 max-h-[85%] overflow-hidden" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 15,
          }}>
            {/* Enhanced Header */}
            <LinearGradient
              colors={['#ff6b35', '#ff512f', '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingTop: 16,
                paddingBottom: 16,
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View className="flex-row items-center">
                <MaterialIcons name="edit" size={24} color="#ffffff" />
                <Text className="text-white text-xl font-bold ml-2" style={{
                  textShadowColor: 'rgba(0, 0, 0, 0.2)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }}>Edit Report</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                className="bg-white/20 rounded-full p-2"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }}
              >
                <MaterialIcons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView className="px-5 pt-5 pb-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Preview Image */}
              {editData.imageUri && (
                <View className="mb-5">
                  <Image 
                    source={{ uri: editData.imageUri }} 
                    className="w-full h-64 rounded-2xl" 
                    resizeMode="cover"
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      elevation: 8,
                    }}
                  />
                  <TouchableOpacity
                    className="absolute top-3 right-3 bg-red-600 rounded-full p-2"
                    onPress={() => setEditData({...editData, imageUri: null})}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 5,
                    }}
                  >
                    <MaterialIcons name="close" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Enhanced Action Buttons */}
              <View className="flex-row gap-4 mb-6">
                <TouchableOpacity
                  className="flex-1 bg-[#ff512f] rounded-2xl p-5 items-center shadow-lg"
                  onPress={() => {
                    Alert.alert(
                      'Change Picture',
                      'Choose an option',
                      [
                        {
                          text: 'Camera',
                          onPress: async () => {
                            const hasPermission = await requestCameraPermission();
                            if (!hasPermission) {
                              Alert.alert('Permission Denied', 'Camera permission is required to take a photo');
                              return;
                            }
                            
                            const result = await ImagePicker.launchCameraAsync({
                              mediaTypes: ImagePicker.MediaTypeOptions.Images,
                              allowsEditing: true,
                              aspect: [4, 3],
                              quality: 0.8,
                            });

                            if (!result.canceled && result.assets[0]) {
                              setEditData({
                                ...editData,
                                imageUri: result.assets[0].uri
                              });
                            }
                          }
                        },
                        {
                          text: 'Gallery',
                          onPress: async () => {
                            const hasPermission = await requestMediaLibraryPermission();
                            if (!hasPermission) {
                              Alert.alert('Permission Denied', 'Gallery permission is required to select a photo');
                              return;
                            }
                            
                            const result = await ImagePicker.launchImageLibraryAsync({
                              mediaTypes: ImagePicker.MediaTypeOptions.Images,
                              allowsEditing: true,
                              aspect: [4, 3],
                              quality: 0.8,
                            });

                            if (!result.canceled && result.assets[0]) {
                              setEditData({
                                ...editData,
                                imageUri: result.assets[0].uri
                              });
                            }
                          }
                        },
                        {
                          text: 'Cancel',
                          style: 'cancel'
                        }
                      ]
                    );
                  }}
                  activeOpacity={0.85}
                  style={{
                    shadowColor: '#ff512f',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                    borderWidth: 2,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <View className="rounded-full p-2 mb-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <MaterialIcons name="camera-alt" size={24} color="#ffffff" />
                  </View>
                  <Text className="text-white font-bold text-base text-center">Change Picture</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-gray-800 rounded-2xl p-5 items-center shadow-lg"
                  onPress={async () => {
                    // Set current edit location as temp location for the picker
                    if (editData.latitude && editData.longitude) {
                      setTempPickedLocation({ latitude: editData.latitude, longitude: editData.longitude });
                      setTempPickedAddress(editData.address || '');
                      // Set map region to current edit location
                      setMapRegion({
                        latitude: editData.latitude,
                        longitude: editData.longitude,
                        latitudeDelta: 0.003,
                        longitudeDelta: 0.003,
                      });
                    } else {
                      // If no current location, get user's current location
                      try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status === 'granted') {
                          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 10000 });
                          setTempPickedLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                          setMapRegion({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            latitudeDelta: 0.003,
                            longitudeDelta: 0.003,
                          });
                          try {
                            const res = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                            if (res && res[0]) {
                              const r = res[0];
                              const label = [r.name, r.street, r.subregion, r.city || r.region, r.postalCode, r.country].filter(Boolean).join(', ');
                              setTempPickedAddress(label);
                            }
                          } catch {}
                        }
                      } catch {}
                    }
                    setIsLocationPickerForEdit(true);
                    setShowEditModal(false);
                    // Use the same location picker we improved
                    setTimeout(() => setShowLocationPicker(true), 200);
                  }}
                  activeOpacity={0.85}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                    borderWidth: 2,
                    borderColor: 'rgba(55, 65, 81, 0.3)',
                  }}
                >
                  <View className="rounded-full p-2 mb-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                    <MaterialIcons name="place" size={24} color="#ffffff" />
                  </View>
                  <Text className="text-white font-bold text-base text-center">Change Location</Text>
                </TouchableOpacity>
              </View>

              {/* Enhanced Input Fields */}
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <MaterialIcons name="description" size={18} color="#6b7280" />
                  <Text className="text-gray-700 font-semibold text-sm ml-2">Cause of Fire</Text>
                </View>
                <TextInput
                  className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-gray-800 text-base"
                  placeholder="Cause of fire"
                  placeholderTextColor="#9ca3af"
                  value={editData.cause}
                  onChangeText={(t) => setEditData({ ...editData, cause: t })}
                  multiline
                  style={{
                    minHeight: 80,
                  }}
                />
              </View>

              <View className="mb-5">
                <View className="flex-row items-center mb-2">
                  <MaterialIcons name="business" size={18} color="#6b7280" />
                  <Text className="text-gray-700 font-semibold text-sm ml-2">Number of Structures (Optional)</Text>
                </View>
                <TextInput
                  className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-gray-800 text-base"
                  placeholder="Number of structures affected"
                  placeholderTextColor="#9ca3af"
                  value={editData.numberOfStructures}
                  onChangeText={(t) => setEditData({ ...editData, numberOfStructures: t })}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>

              {/* Enhanced Selected Location Display */}
              {(editData.latitude && editData.longitude) || editData.address ? (
                <View className="mb-6 bg-blue-50 rounded-2xl p-4 border-2 border-blue-200" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                  <View className="flex-row items-start">
                    <MaterialIcons name="place" size={20} color="#3b82f6" />
                    <View className="flex-1 ml-3">
                      <Text className="text-blue-700 font-semibold text-sm mb-1">Selected Location</Text>
                      <Text className="text-gray-800 font-medium text-base">
                        {editData.address || `${editData.latitude?.toFixed(6)}, ${editData.longitude?.toFixed(6)}`}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Enhanced Action Buttons */}
              <View className="flex-row gap-4 mt-4 mb-6">
                <TouchableOpacity 
                  className="flex-1 bg-gray-100 rounded-2xl py-4 px-4 border-2 border-gray-200"
                  onPress={() => setShowEditModal(false)}
                  activeOpacity={0.7}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <View className="flex-row items-center justify-center">
                    <MaterialIcons name="close" size={20} color="#6b7280" />
                    <Text className="text-center font-bold text-gray-700 text-base ml-2">Close</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 rounded-2xl py-4 px-4 ${isEditing ? 'bg-gray-400' : 'bg-[#ff512f]'}`}
                  onPress={async () => {
                    try {
                      setIsEditing(true);
                      if (!selectedReport?.id) throw new Error('Missing report id');
                      // Build multipart ONLY if we changed image; location change can go JSON too
                      const changedImage = !!editData.imageUri && !(selectedReport.image_url === editData.imageUri || selectedReport.photo_url === editData.imageUri);
                      if (changedImage) {
                        const fd = new FormData();
                        if (changedImage) {
                          fd.append('image', { uri: editData.imageUri, name: 'update.jpg', type: 'image/jpeg' });
                        }
                        if (editData.cause) fd.append('cause_of_fire', editData.cause);
                        if (editData.numberOfStructures) fd.append('number_of_structures_on_fire', editData.numberOfStructures);
                        if (editData.latitude && editData.longitude) {
                          fd.append('geotag_location', `${editData.latitude}, ${editData.longitude}`);
                          fd.append('latitude', String(editData.latitude));
                          fd.append('longitude', String(editData.longitude));
                          if (editData.address) fd.append('address', editData.address);
                        }
                        const res = await fetch(`${API_BASE}/update_report/${selectedReport.id}`, { method: 'PUT', body: fd });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data?.error || 'Failed to update');
                      } else {
                        const payload = {
                          cause_of_fire: editData.cause,
                          number_of_structures_on_fire: editData.numberOfStructures ? parseInt(editData.numberOfStructures) : null,
                          address: editData.address || undefined,
                          geotag_location: (editData.latitude && editData.longitude) ? `${editData.latitude}, ${editData.longitude}` : undefined,
                          latitude: editData.latitude || undefined,
                          longitude: editData.longitude || undefined,
                        };
                        const res = await fetch(`${API_BASE}/update_report/${selectedReport.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data?.error || 'Failed to update');
                      }
                      setShowEditModal(false);
                      setTimeout(() => loadReportsFromAPI(), 300);
                    } catch (e) {
                      Alert.alert('Save Failed', e?.message || 'Please try again later');
                    } finally {
                      setIsEditing(false);
                    }
                  }}
                  disabled={isEditing}
                  activeOpacity={0.85}
                  style={{
                    shadowColor: isEditing ? '#000' : '#ff512f',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                >
                  <View className="flex-row items-center justify-center">
                    {isEditing ? (
                      <>
                        <MaterialIcons name="hourglass-empty" size={20} color="#ffffff" />
                        <Text className="text-center font-bold text-white text-base ml-2">Saving...</Text>
                      </>
                    ) : (
                      <>
                        <MaterialIcons name="save" size={20} color="#ffffff" />
                        <Text className="text-center font-bold text-white text-base ml-2">Save</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* Success Toast */}
      {showSuccessToast && (
        <View className="absolute top-20 left-4 right-4 z-50">
          <View className="bg-green-500 rounded-lg p-4 flex-row items-center shadow-lg">
            <MaterialIcons name="check-circle" size={24} color="#ffffff" />
            <Text className="text-white font-semibold ml-3 flex-1">
              Emergency reported successfully!
            </Text>
          </View>
        </View>
      )}

      {/* Fire Out Modal - Stylish Success Design */}
      <Modal
        visible={showThankYouModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowThankYouModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-4">
          <View className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            {/* Green Gradient Header with Icon */}
            <View className="p-5 items-center" style={{ backgroundColor: '#10b981', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <View className="bg-white/20 rounded-full p-3 mb-2">
                <MaterialIcons name="check-circle" size={48} color="#ffffff" />
              </View>
              <Text className="text-2xl font-bold text-white text-center mb-1">
                Fire Resolved!
              </Text>
              <Text className="text-green-50 text-center text-sm">
                Your report has been successfully resolved
              </Text>
            </View>
            
            {/* Content */}
            <View className="p-4">
              {/* Status Badge */}
              <View className="bg-green-50 border-2 border-green-500 rounded-lg p-3 mb-3 items-center">
                <View className="flex-row items-center mb-1">
                  <MaterialIcons name="done-all" size={20} color="#10b981" />
                  <Text className="text-green-600 font-bold text-base ml-2">Fire Out</Text>
                </View>
                <Text className="text-green-700 text-xs text-center">
                  The emergency has been successfully contained
                </Text>
              </View>

              {/* Thank You Message */}
              <Text className="text-gray-700 text-center mb-3 text-sm leading-5">
                Thank you for your quick action in reporting this emergency! Your vigilance helped emergency responders act swiftly and keep our community safe.
              </Text>
              
              {/* Report Details */}
              {fireOutReport && (
                <View className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                  <View className="flex-row items-start mb-2">
                    <MaterialIcons name="location-on" size={16} color="#6b7280" />
                    <View className="flex-1 ml-2">
                      <Text className="text-[10px] text-gray-500 mb-0.5">Location:</Text>
                      <Text className="text-xs font-semibold text-gray-800">
                        {fireOutReport.resolved_address || fireOutReport.address || fireOutReport.location || fireOutReport.geotag_location || 'Location unavailable'}
                      </Text>
                    </View>
                  </View>
                  {fireOutReport.alarm_level && (
                    <View className="flex-row items-center">
                      <MaterialIcons name="local-fire-department" size={16} color="#6b7280" />
                      <View className="flex-1 ml-2">
                        <Text className="text-[10px] text-gray-500 mb-0.5">Alarm Level:</Text>
                        <Text className="text-xs font-semibold text-gray-800">
                          {fireOutReport.alarm_level}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Appreciation Box */}
              <View className="bg-green-50 rounded-lg p-2 mb-4 flex-row items-start">
                <MaterialIcons name="emoji-events" size={16} color="#10b981" />
                <Text className="text-green-700 text-[10px] flex-1 ml-2 leading-4">
                  Community heroes like you make a difference! Stay alert and continue keeping our neighborhood safe.
                </Text>
              </View>
              
              {/* Close Button */}
              <TouchableOpacity
                className="rounded-lg py-3 w-full items-center shadow-lg"
                onPress={() => {
                  // Ensure the modal key is marked as shown
                  if (fireOutReport) {
                    const reportId = String(fireOutReport.id || fireOutReport._id);
                    const modalKey = `${reportId}:Fire Out`;
                    setShownModalKeys(prev => new Set([...prev, modalKey]));
                  }
                  setShowThankYouModal(false);
                  setFireOutReport(null);
                }}
                activeOpacity={0.8}
                style={{ backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
              >
                <Text className="text-white font-bold text-base">
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Acknowledgment Modal for "Under Control" Status */}
      <Modal
        visible={showAcknowledgmentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAcknowledgmentModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-4">
          <View className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            {/* Red to Orange Gradient Header with Icon */}
            <View className="p-5 items-center" style={{ backgroundColor: '#ef4444', background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)' }}>
              <View className="bg-white/20 rounded-full p-3 mb-2">
                <MaterialIcons name="verified" size={48} color="#ffffff" />
              </View>
              <Text className="text-2xl font-bold text-white text-center mb-1">
                Report Acknowledged!
              </Text>
              <Text className="text-red-50 text-center text-sm">
                Your report is now under control
              </Text>
            </View>
            
            {/* Content */}
            <View className="p-4">
              {/* Status Badge */}
              <View className="bg-orange-50 border-2 border-orange-500 rounded-lg p-3 mb-3 items-center">
                <View className="flex-row items-center mb-1">
                  <MaterialIcons name="local-fire-department" size={20} color="#f59e0b" />
                  <Text className="text-orange-600 font-bold text-base ml-2">Under Control</Text>
                </View>
                <Text className="text-orange-700 text-xs text-center">
                  Emergency response teams are managing the situation
                </Text>
              </View>

              {/* Message */}
              <Text className="text-gray-700 text-center mb-3 text-sm leading-5">
                Great news! Your fire report has been acknowledged by the command center. Emergency responders are actively working to contain the fire.
              </Text>
              
              {/* Report Details */}
              {acknowledgedReport && (
                <View className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                  <View className="flex-row items-start mb-2">
                    <MaterialIcons name="location-on" size={16} color="#6b7280" />
                    <View className="flex-1 ml-2">
                      <Text className="text-[10px] text-gray-500 mb-0.5">Location:</Text>
                      <Text className="text-xs font-semibold text-gray-800">
                        {acknowledgedReport.resolved_address || acknowledgedReport.address || acknowledgedReport.location || acknowledgedReport.geotag_location || 'Location unavailable'}
                      </Text>
                    </View>
                  </View>
                  {acknowledgedReport.alarm_level && (
                    <View className="flex-row items-center">
                      <MaterialIcons name="warning" size={16} color="#6b7280" />
                      <View className="flex-1 ml-2">
                        <Text className="text-[10px] text-gray-500 mb-0.5">Alarm Level:</Text>
                        <Text className="text-xs font-semibold text-gray-800">
                          {acknowledgedReport.alarm_level}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Info Box */}
              <View className="bg-blue-50 rounded-lg p-2 mb-4 flex-row items-start">
                <MaterialIcons name="info" size={16} color="#3b82f6" />
                <Text className="text-blue-700 text-[10px] flex-1 ml-2 leading-4">
                  You'll receive updates as the situation progresses. Stay safe and follow local emergency protocols.
                </Text>
              </View>
              
              {/* Close Button */}
              <TouchableOpacity
                className="rounded-lg py-3 w-full items-center shadow-lg"
                onPress={() => {
                  // Ensure the modal key is marked as shown
                  if (acknowledgedReport) {
                    const reportId = String(acknowledgedReport.id || acknowledgedReport._id);
                    const modalKey = `${reportId}:Under Control`;
                    setShownModalKeys(prev => new Set([...prev, modalKey]));
                  }
                  setShowAcknowledgmentModal(false);
                  setAcknowledgedReport(null);
                }}
                activeOpacity={0.8}
                style={{ backgroundColor: '#ef4444', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
              >
                <Text className="text-white font-bold text-base">
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CStatus;

export const options = {
  headerShown: false,
};