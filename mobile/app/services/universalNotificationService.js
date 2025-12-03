/**
 * Universal Notification Service
 * 
 * This service handles creating notifications for ALL user types (admin, station, responder, citizen)
 * when fire report status or alarm level changes.
 * 
 * Notifications are sent to:
 * - Admin: All admins (command center - they see all reports)
 * - Station: Station with jurisdiction over the report
 * - Responder: Already handled by responderNotificationService.js
 * - Citizen: The citizen who created/reported the fire incident
 */

import { supabase } from '../config/supabase';
import { getStationWithJurisdiction } from './responderNotificationService';

/**
 * Get all admin users
 */
async function getAllAdmins() {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, first_name, last_name, email')
      .eq('active', true);

    if (error) {
      console.error('❌ Error fetching admins:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error getting all admins:', error);
    return [];
  }
}

/**
 * Get station users for a specific station
 */
async function getStationUsers(stationId) {
  try {
    const { data, error } = await supabase
      .from('station_users')
      .select('id, station_name, email')
      .eq('id', stationId)
      .eq('active', true);

    if (error) {
      console.error('❌ Error fetching station users:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error getting station users:', error);
    return [];
  }
}

/**
 * Get citizen user who created the report
 */
async function getReportCreator(reportData) {
  try {
    console.log('🔍 Getting report creator from reportData:', {
      user_id: reportData?.user_id,
      reporter_id: reportData?.reporter_id,
      reporter: reportData?.reporter,
      reporter_name: reportData?.reporter_name
    });
    
    // Check if report has reporter_id or user_id (this is typically the auth user ID)
    const reporterId = reportData?.user_id || reportData?.reporter_id || reportData?.reported_by_id;
    
    if (!reporterId) {
      console.log('⚠️ No reporter ID found, trying to find by reporter name/email');
      
      // Try to find by reporter name/email in citizens/citizen_users table
      const reporterName = reportData?.reporter_name || reportData?.reporter || reportData?.reported_by;
      const reporterEmail = reportData?.reporter_email || reportData?.email;
      
      if (reporterEmail) {
        // Try citizens table first
        const { data: citizens } = await supabase
          .from('citizens')
          .select('id, first_name, last_name, email')
          .eq('email', reporterEmail)
          .eq('active', true)
          .limit(1);
        
        if (citizens && citizens.length > 0) {
          console.log('✅ Found citizen by email in citizens table:', citizens[0].id);
          return citizens[0];
        }
        
        // Try citizen_users table as fallback
        const { data: citizenUsers } = await supabase
          .from('citizen_users')
          .select('id, first_name, last_name, email')
          .eq('email', reporterEmail)
          .eq('status', 'active')
          .limit(1);
        
        if (citizenUsers && citizenUsers.length > 0) {
          console.log('✅ Found citizen by email in citizen_users table:', citizenUsers[0].id);
          return citizenUsers[0];
        }
      }
      
      console.log('⚠️ Could not find citizen by email, checking auth.users');
      
      // As a last resort, check auth.users by matching the reporter name
      if (reporterName) {
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const matchingUser = authUsers?.users?.find(u => {
          const userEmail = u.email;
          const fullName = `${u.user_metadata?.first_name || ''} ${u.user_metadata?.last_name || ''}`.trim();
          return fullName === reporterName || userEmail === reporterEmail;
        });
        
        if (matchingUser) {
          console.log('✅ Found user in auth.users:', matchingUser.id);
          return {
            id: matchingUser.id,
            email: matchingUser.email,
            first_name: matchingUser.user_metadata?.first_name,
            last_name: matchingUser.user_metadata?.last_name
          };
        }
      }
      
      console.log('❌ Could not find citizen by any method');
      return null;
    }

    console.log('🔍 Found reporter ID:', reporterId);

    // Try to fetch from citizens table first (by ID - which should match auth user ID)
    let { data, error } = await supabase
      .from('citizens')
      .select('id, first_name, last_name, email')
      .eq('id', reporterId)
      .eq('active', true)
      .single();

    if (!error && data) {
      console.log('✅ Found citizen in citizens table:', data.id);
      return data;
    }

    // If not found in citizens, try citizen_users table
    const { data: citizenUserData, error: citizenUserError } = await supabase
      .from('citizen_users')
      .select('id, first_name, last_name, email')
      .eq('id', reporterId)
      .eq('status', 'active')
      .single();
    
    if (!citizenUserError && citizenUserData) {
      console.log('✅ Found citizen in citizen_users table:', citizenUserData.id);
      return citizenUserData;
    }
    
    // Try auth.users as final fallback
    console.log('🔍 Trying auth.users table with ID:', reporterId);
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(reporterId);
    
    if (!authError && authUser) {
      console.log('✅ Found user in auth.users:', authUser.user.id);
      return {
        id: authUser.user.id,
        email: authUser.user.email,
        first_name: authUser.user.user_metadata?.first_name,
        last_name: authUser.user.user_metadata?.last_name
      };
    }

    console.log('❌ Could not find citizen in any table');
    return null;
  } catch (error) {
    console.error('❌ Error getting report creator:', error);
    return null;
  }
}

/**
 * Create notification in the notifications table
 */
async function createNotification(userId, userType, title, message, type, priority, relatedReportId = null) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        user_type: userType,
        title: title,
        message: message,
        type: type,
        priority: priority,
        related_report_id: relatedReportId ? String(relatedReportId) : null,
        is_read: false
      });

    if (error) {
      console.error(`❌ Error creating notification for ${userType} ${userId}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`❌ Error creating notification for ${userType} ${userId}:`, error);
    return false;
  }
}

/**
 * Helper function to format report details for notification message
 */
function formatReportDetails(reportData, changeType, oldValue, newValue) {
  const toStr = (val, def = 'Not specified') => val || def;
  
  const locationInfo = toStr(reportData?.address || reportData?.geotag_location || reportData?.location, 'Location not specified');
  const alarmLevel = reportData?.final_alarm_level || reportData?.recommended_alarm_level || reportData?.alarm_level || 'Unknown';
  const reporter = toStr(reportData?.reporter_name || reportData?.reporter || reportData?.reported_by, 'Unknown Reporter');
  const cause = toStr(reportData?.cause || reportData?.possible_cause || reportData?.fire_cause, 'Under investigation');
  const timestamp = toStr(reportData?.formatted_timestamp || reportData?.timestamp, 'Time not specified');
  
  let changeText = '';
  if (changeType === 'status') {
    changeText = oldValue ? `Status changed from "${oldValue}" to "${newValue}"` : `Status set to "${newValue}"`;
  } else if (changeType === 'alarm') {
    changeText = oldValue ? `Alarm level changed from "${oldValue}" to "${newValue}"` : `Alarm level set to "${newValue}"`;
  }
  
  return `📍 Location: ${locationInfo}
🔥 Alarm Level: ${alarmLevel}
👤 Reporter: ${reporter}
📝 Cause: ${cause}
⏰ Reported: ${timestamp}

${changeText}`;
}

/**
 * Notify all relevant users when report status changes
 * 
 * @param {string} reportId - The fire report ID
 * @param {string} newStatus - New status
 * @param {string} oldStatus - Previous status (optional)
 * @param {object} reportData - Full report data
 */
export async function notifyAllUsersOnStatusChange(reportId, newStatus, oldStatus = null, reportData = null) {
  try {
    console.log('🔔 Notifying all users of status change:', { reportId, oldStatus, newStatus });

    // Only notify for meaningful status changes
    const statusTransitions = [
      { from: 'On Going', to: 'Under Control' },
      { from: 'Under Control', to: 'Fire Out' },
      { from: 'On Going', to: 'Fire Out' }
    ];

    // Always notify if status changes to "Fire Out" (important milestone)
    const isFireOutStatus = newStatus === 'Fire Out' || newStatus === 'fire out' || newStatus.toLowerCase().includes('fire out');
    
    const isSignificantChange = !oldStatus || isFireOutStatus || statusTransitions.some(
      transition => transition.from === oldStatus && transition.to === newStatus
    );

    if (!isSignificantChange && oldStatus) {
      console.log('ℹ️ Status change not significant, skipping notification');
      return { success: false, message: 'Not a significant status change' };
    }

    // Get report location if available
    let reportLocation = null;
    if (reportData) {
      const lat = parseFloat(reportData.latitude || reportData.lat);
      const lng = parseFloat(reportData.longitude || reportData.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        reportLocation = { latitude: lat, longitude: lng };
      }
    }

    const title = `Report Status Changed to ${newStatus}`;
    const message = formatReportDetails(reportData || {}, 'status', oldStatus, newStatus);
    const notificationType = 'fire_alert';
    const priority = 'high';

    const results = {
      admin: { success: 0, total: 0 },
      station: { success: 0, total: 0 },
      citizen: { success: 0, total: 0 }
    };

    // 1. Notify all admins (command center sees all reports)
    console.log('📧 Notifying all admins...');
    const admins = await getAllAdmins();
    results.admin.total = admins.length;
    
    for (const admin of admins) {
      const success = await createNotification(
        admin.id,
        'admin',
        title,
        message,
        notificationType,
        priority,
        reportId
      );
      if (success) results.admin.success++;
    }
    console.log(`✅ Notified ${results.admin.success}/${results.admin.total} admins`);

    // 2. Notify station with jurisdiction
    console.log('📧 Notifying station with jurisdiction...');
    const station = await getStationWithJurisdiction(reportId, reportLocation);
    
    if (station && station.stationId) {
      const stationUsers = await getStationUsers(station.stationId);
      results.station.total = stationUsers.length;
      
      for (const stationUser of stationUsers) {
        const success = await createNotification(
          stationUser.id,
          'station',
          title,
          message,
          notificationType,
          priority,
          reportId
        );
        if (success) results.station.success++;
      }
      console.log(`✅ Notified ${results.station.success}/${results.station.total} station users`);
    } else {
      console.log('⚠️ No station jurisdiction found');
    }

    // 3. Notify citizen who created the report
    console.log('📧 Notifying report creator...');
    const citizen = await getReportCreator(reportData);
    
    if (citizen) {
      results.citizen.total = 1;
      
      // Special handling for citizen's own reports
      let citizenTitle = title;
      let citizenMessage = message;
      let citizenType = notificationType;
      
      // For "Under Control" status - special acknowledgment notification
      if (newStatus === 'Under Control') {
        citizenTitle = 'Your Report Has Been Acknowledged! 🎉';
        citizenMessage = `Great news! Your fire report has been acknowledged and is now Under Control.\n\n${message}`;
        citizenType = 'user_action'; // Use user_action type for acknowledgment
      }
      // For "Fire Out" status - completion notification
      else if (newStatus === 'Fire Out') {
        citizenTitle = 'Fire Incident Resolved ✅';
        citizenMessage = `Your fire report has been successfully resolved. The fire is now out.\n\n${message}`;
        citizenType = 'fire_alert';
      }
      
      const success = await createNotification(
        citizen.id,
        'citizen',
        citizenTitle,
        citizenMessage,
        citizenType,
        priority,
        reportId
      );
      if (success) results.citizen.success++;
      console.log(`✅ Notified citizen ${citizen.id}`);
    } else {
      console.log('⚠️ No citizen creator found for report');
    }

    // Note: Responders are notified separately via responderNotificationService.js

    const totalSuccess = results.admin.success + results.station.success + results.citizen.success;
    const totalUsers = results.admin.total + results.station.total + results.citizen.total;

    console.log('📊 Notification results:', results);
    
    return {
      success: totalSuccess > 0,
      results: results,
      total: totalUsers,
      count: totalSuccess
    };
  } catch (error) {
    console.error('❌ Error notifying all users on status change:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify all relevant users when alarm level changes
 * 
 * @param {string} reportId - The fire report ID
 * @param {string} newAlarmLevel - New alarm level
 * @param {string} oldAlarmLevel - Previous alarm level (optional)
 * @param {object} reportData - Full report data
 */
export async function notifyAllUsersOnAlarmChange(reportId, newAlarmLevel, oldAlarmLevel = null, reportData = null) {
  try {
    console.log('🔔 Notifying all users of alarm level change:', { reportId, oldAlarmLevel, newAlarmLevel });

    // Normalize alarm levels for comparison
    const normalizeAlarmLevel = (level) => {
      if (!level || level === 'Unknown') return null;
      return String(level).toLowerCase().trim();
    };

    const normalizedOld = normalizeAlarmLevel(oldAlarmLevel);
    const normalizedNew = normalizeAlarmLevel(newAlarmLevel);

    // Only skip if alarm level is actually the same (and both are valid)
    if (normalizedOld && normalizedNew && normalizedOld === normalizedNew) {
      console.log('ℹ️ Alarm level unchanged, skipping notification');
      return { success: false, message: 'Alarm level unchanged' };
    }

    // Always notify if we have a new alarm level, even if old is unknown
    if (!normalizedNew) {
      console.log('⚠️ Invalid new alarm level, skipping notification');
      return { success: false, message: 'Invalid new alarm level' };
    }

    // Get report location if available
    let reportLocation = null;
    if (reportData) {
      const lat = parseFloat(reportData.latitude || reportData.lat);
      const lng = parseFloat(reportData.longitude || reportData.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        reportLocation = { latitude: lat, longitude: lng };
      }
    }

    // Determine priority based on alarm level
    const alarmLevelStr = String(newAlarmLevel).toLowerCase();
    let priority = 'high';
    if (alarmLevelStr.includes('second alarm') || alarmLevelStr.includes('2nd')) {
      priority = 'urgent';
    } else if (alarmLevelStr.includes('third alarm') || alarmLevelStr.includes('3rd') || 
               alarmLevelStr.includes('fourth alarm') || alarmLevelStr.includes('4th') ||
               alarmLevelStr.includes('fifth alarm') || alarmLevelStr.includes('5th')) {
      priority = 'urgent';
    } else if (alarmLevelStr.includes('task force') || alarmLevelStr.includes('general alarm')) {
      priority = 'urgent';
    }

    const title = `Fire Alarm Level Changed to ${newAlarmLevel}`;
    const message = formatReportDetails(reportData || {}, 'alarm', oldAlarmLevel, newAlarmLevel);
    const notificationType = 'fire_alert';

    const results = {
      admin: { success: 0, total: 0 },
      station: { success: 0, total: 0 },
      citizen: { success: 0, total: 0 }
    };

    // 1. Notify all admins (command center sees all reports)
    console.log('📧 Notifying all admins...');
    const admins = await getAllAdmins();
    results.admin.total = admins.length;
    
    for (const admin of admins) {
      const success = await createNotification(
        admin.id,
        'admin',
        title,
        message,
        notificationType,
        priority,
        reportId
      );
      if (success) results.admin.success++;
    }
    console.log(`✅ Notified ${results.admin.success}/${results.admin.total} admins`);

    // 2. Notify station with jurisdiction
    console.log('📧 Notifying station with jurisdiction...');
    const station = await getStationWithJurisdiction(reportId, reportLocation);
    
    if (station && station.stationId) {
      const stationUsers = await getStationUsers(station.stationId);
      results.station.total = stationUsers.length;
      
      for (const stationUser of stationUsers) {
        const success = await createNotification(
          stationUser.id,
          'station',
          title,
          message,
          notificationType,
          priority,
          reportId
        );
        if (success) results.station.success++;
      }
      console.log(`✅ Notified ${results.station.success}/${results.station.total} station users`);
    } else {
      console.log('⚠️ No station jurisdiction found');
    }

    // 3. Notify citizen who created the report
    console.log('📧 Notifying report creator...');
    const citizen = await getReportCreator(reportData);
    
    if (citizen) {
      results.citizen.total = 1;
      
      // Special handling for citizen's own reports - alarm level changes
      const citizenTitle = `Your Report's Alarm Level Updated: ${newAlarmLevel}`;
      const citizenMessage = `Your fire report's alarm level has been updated.\n\n${message}`;
      
      const success = await createNotification(
        citizen.id,
        'citizen',
        citizenTitle,
        citizenMessage,
        notificationType,
        priority,
        reportId
      );
      if (success) results.citizen.success++;
      console.log(`✅ Notified citizen ${citizen.id}`);
    } else {
      console.log('⚠️ No citizen creator found for report');
    }

    // Note: Responders are notified separately via responderNotificationService.js

    const totalSuccess = results.admin.success + results.station.success + results.citizen.success;
    const totalUsers = results.admin.total + results.station.total + results.citizen.total;

    console.log('📊 Notification results:', results);
    
    return {
      success: totalSuccess > 0,
      results: results,
      total: totalUsers,
      count: totalSuccess
    };
  } catch (error) {
    console.error('❌ Error notifying all users on alarm change:', error);
    return { success: false, error: error.message };
  }
}

