/**
 * Responder Notification Service
 * 
 * This service handles creating notifications for responders when:
 * 1. Fire report status changes (On Going → Under Control → Fire Out)
 * 2. Alarm level changes (e.g., 1st Alarm → 2nd Alarm)
 * 
 * Notifications are sent to all responders of the station that has jurisdiction over the report.
 */

import { supabase } from '../config/supabase';

/**
 * Determines which station has jurisdiction over a report
 * Priority: 1. Direct assignment, 2. Forwarded to station, 3. Location-based proximity
 */
export async function getStationWithJurisdiction(reportId, reportLocation = null) {
  try {
    // 1. Check for direct assignment to a station
    const { data: assignments, error: assignError } = await supabase
      .from('report_assignments')
      .select('assignee_id, assignee_name')
      .eq('report_id', String(reportId))
      .eq('assignee_type', 'station')
      .order('assigned_at', { ascending: false })
      .limit(1);

    if (!assignError && assignments && assignments.length > 0) {
      console.log('✅ Found station assignment:', assignments[0]);
      return {
        stationId: assignments[0].assignee_id,
        stationName: assignments[0].assignee_name || 'Station',
        method: 'assignment'
      };
    }

    // 2. Check for forwarded reports (most recent forward)
    const { data: forwarded, error: forwardError } = await supabase
      .from('report_routes')
      .select('target')
      .eq('report_id', String(reportId))
      .like('target', 'station:%')
      .order('forwarded_at', { ascending: false })
      .limit(1);

    if (!forwardError && forwarded && forwarded.length > 0) {
      const target = forwarded[0].target;
      const stationId = target.replace('station:', '');
      console.log('✅ Found forwarded station:', stationId);
      
      // Get station name
      const { data: stationData } = await supabase
        .from('station_users')
        .select('id, station_name')
        .eq('id', stationId)
        .single();

      return {
        stationId: stationId,
        stationName: stationData?.station_name || 'Station',
        method: 'forwarded'
      };
    }

    // 3. Location-based proximity (if report location provided)
    if (reportLocation && reportLocation.latitude && reportLocation.longitude) {
      console.log('📍 Checking location-based jurisdiction...');
      const { data: stations, error: stationsError } = await supabase
        .from('station_users')
        .select('id, station_name, lat, lng, latitude, longitude')
        .eq('active', true)
        .eq('status', 'active');

      if (!stationsError && stations && stations.length > 0) {
        // Find closest station
        let closestStation = null;
        let minDistance = Infinity;

        stations.forEach(station => {
          const stationLat = parseFloat(station.lat || station.latitude);
          const stationLng = parseFloat(station.lng || station.longitude);
          
          if (isNaN(stationLat) || isNaN(stationLng)) return;

          const distance = calculateDistance(
            reportLocation.latitude,
            reportLocation.longitude,
            stationLat,
            stationLng
          );

          if (distance < minDistance) {
            minDistance = distance;
            closestStation = {
              stationId: station.id,
              stationName: station.station_name || 'Station',
              distance: distance
            };
          }
        });

        if (closestStation && minDistance < 50000) { // Within 50km
          console.log('✅ Found closest station by location:', closestStation);
          return {
            ...closestStation,
            method: 'proximity'
          };
        }
      }
    }

    console.log('⚠️ No station jurisdiction found for report:', reportId);
    return null;
  } catch (error) {
    console.error('❌ Error determining station jurisdiction:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get all active responders for a station
 * Uses the EXACT same pattern as the working assignment notification code
 */
async function getStationResponders(stationId) {
  try {
    console.log('👥 Fetching responders for station:', stationId);
    const { data: respondersData, error } = await supabase
      .from('responders')
      .select('id, first_name, last_name, email, phone, station_id')
      .eq('station_id', stationId);

    if (error) {
      console.error('❌ Error fetching responders:', error);
      return [];
    }

    const responders = respondersData || [];
    console.log(`✅ Found ${responders.length} responders for station ${stationId}`);
    return responders;
  } catch (error) {
    console.error('❌ Error getting station responders:', error);
    return [];
  }
}

/**
 * Get directly assigned responders for a report
 */
async function getDirectlyAssignedResponders(reportId) {
  try {
    const { data: assignments, error } = await supabase
      .from('report_assignments')
      .select('assignee_id')
      .eq('report_id', String(reportId))
      .eq('assignee_type', 'responder');

    if (error) {
      console.error('❌ Error fetching direct responder assignments:', error);
      return [];
    }

    if (!assignments || assignments.length === 0) {
      return [];
    }

    // Get responder details
    const responderIds = assignments.map(a => a.assignee_id);
    const { data: responders, error: responderError } = await supabase
      .from('responders')
      .select('id, first_name, last_name, email, station_id')
      .in('id', responderIds)
      .eq('active', true)
      .eq('status', 'active');

    if (responderError) {
      console.error('❌ Error fetching responder details:', responderError);
      return [];
    }

    console.log(`✅ Found ${responders?.length || 0} directly assigned active responders`);
    return responders || [];
  } catch (error) {
    console.error('❌ Error getting directly assigned responders:', error);
    return [];
  }
}

/**
 * Create notifications for responders
 * Uses the EXACT same pattern as the working assignment notification code in SMap.jsx
 */
async function createResponderNotifications(stationId, reportId, title, message, priority = 'high', includeDirectAssignments = true) {
  try {
    if (!stationId) {
      console.log('⚠️ No station ID provided');
      return { success: false, message: 'No station ID provided' };
    }

    // 1. Get all responders for the station (EXACT same query as working code)
    const responders = await getStationResponders(stationId);
    
    if (!responders || responders.length === 0) {
      console.log('⚠️ No responders found for station:', stationId);
      return { success: false, message: 'No responders found' };
    }

    // 2. Get directly assigned responders if enabled
    let allResponders = [...responders];
    if (includeDirectAssignments) {
      const directResponders = await getDirectlyAssignedResponders(reportId);
      // Merge and deduplicate by responder ID
      const responderMap = new Map();
      responders.forEach(r => responderMap.set(r.id, r));
      directResponders.forEach(r => responderMap.set(r.id, r));
      allResponders = Array.from(responderMap.values());
      console.log(`📋 Total responders (station + direct): ${allResponders.length}`);
    }

    // 3. Create notifications using EXACT same pattern as working code
    console.log(`📝 Creating notifications for ${allResponders.length} responder(s)...`);
    
    const notificationPromises = allResponders.map(async (responder) => {
      try {
        const { error: notificationError } = await supabase
          .from('responder_notifications')
          .insert({
            responder_id: responder.id,
            station_id: responder.station_id || stationId,
            fire_report_id: String(reportId),
            title: title,
            message: message,
            priority: priority,
            is_read: false
          });

        if (notificationError) {
          console.error(`❌ Error notifying responder ${responder.id}:`, notificationError);
          return false;
        }

        console.log(`✅ Notification sent to responder ${responder.id}`);
        return true;
      } catch (error) {
        console.error(`❌ Error notifying responder ${responder.id}:`, error);
        return false;
      }
    });

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(Boolean).length;
    
    console.log('📊 Notification results:', { successCount, totalResponders: allResponders.length });
    
    if (successCount > 0) {
      return { 
        success: true, 
        count: successCount,
        total: allResponders.length
      };
    } else {
      return { success: false, message: 'Failed to create any notifications' };
    }
  } catch (error) {
    console.error('❌ Error in createResponderNotifications:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify responders when report status changes
 * Uses the EXACT same pattern as working assignment notifications
 * 
 * @param {string} reportId - The fire report ID
 * @param {string} oldStatus - Previous status (optional, for comparison)
 * @param {string} newStatus - New status
 * @param {object} reportData - Full report data (optional, for location)
 */
export async function notifyRespondersOnStatusChange(reportId, newStatus, oldStatus = null, reportData = null) {
  try {
    console.log('🔔 Notifying responders of status change:', { reportId, oldStatus, newStatus });

    // Only notify for meaningful status changes
    const statusTransitions = [
      { from: 'On Going', to: 'Under Control' },
      { from: 'Under Control', to: 'Fire Out' },
      { from: 'On Going', to: 'Fire Out' }
    ];

    const isSignificantChange = !oldStatus || statusTransitions.some(
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

    // Determine which station has jurisdiction
    const station = await getStationWithJurisdiction(reportId, reportLocation);
    
    if (!station || !station.stationId) {
      console.log('⚠️ No station jurisdiction found, cannot notify responders');
      return { success: false, message: 'No station jurisdiction found' };
    }

    console.log('✅ Station with jurisdiction:', station);

    // Get all responders for this station (EXACT same query as working code)
    const responders = await getStationResponders(station.stationId);
    
    if (!responders || responders.length === 0) {
      console.log('⚠️ No responders found for station:', station.stationId);
      return { success: false, message: 'No responders found' };
    }

    console.log(`📋 Found ${responders.length} responders for station ${station.stationId}`);

    // Helper function to format values (matching SMap.jsx pattern)
    const toStr = (val, def = 'Not specified') => val || def;
    const formatAlarm = (report) => {
      return report.final_alarm_level || report.recommended_alarm_level || report.alarm_level || 'Unknown';
    };
    const formatPrediction = (report) => {
      return report.prediction || report.ai_detection || 'Not analyzed';
    };

    // Create notification message matching the working assignment format
    const locationInfo = toStr(reportData?.address || reportData?.geotag_location || reportData?.location, 'Location not specified');
    const alarmLevel = formatAlarm(reportData || {});
    const aiDetection = formatPrediction(reportData || {});
    const reporter = toStr(reportData?.reporter_name || reportData?.reporter || reportData?.reported_by, 'Unknown Reporter');
    const cause = toStr(reportData?.cause || reportData?.possible_cause || reportData?.fire_cause, 'Under investigation');
    const structure = toStr(reportData?.structure || reportData?.building_type, 'Not specified');
    const structuresAffected = reportData?.number_of_structures_on_fire != null ? String(reportData.number_of_structures_on_fire) : 'Unknown';
    const timestamp = toStr(reportData?.formatted_timestamp || reportData?.timestamp, 'Time not specified');
    
    const notificationMessage = `🔥 STATUS UPDATE: ${newStatus} 🔥
📍 Location: ${locationInfo}
🔥 Alarm Level: ${toStr(alarmLevel, 'Not specified')}
📊 AI Detection: ${toStr(aiDetection, 'Not analyzed')}
👤 Reporter: ${reporter}
📝 Cause: ${cause}
💨 Smoke Analysis: ${reportData?.smoke_intensity ? toStr(`${reportData.smoke_intensity}${reportData.smoke_confidence ? ` ${reportData.smoke_confidence}` : ''}`) : 'Not analyzed'}
🏠 Structure: ${structure}
🏘️ Structures Affected: ${structuresAffected}
⏰ Reported: ${timestamp}

Status changed from "${oldStatus || 'Unknown'}" to "${newStatus}".`;

    // Create distinct title for status changes
    const title = `Fire Report Status Changed to ${newStatus}`;

    // Create notifications using EXACT same pattern as working code
    console.log(`📝 Creating notifications for ${responders.length} responder(s)...`);
    
    const notificationPromises = responders.map(async (responder) => {
      try {
        const { error: notificationError } = await supabase
          .from('responder_notifications')
          .insert({
            responder_id: responder.id,
            station_id: responder.station_id || station.stationId,
            fire_report_id: String(reportId),
            title: title,
            message: notificationMessage,
            priority: 'high', // Always high priority so RAlertsWorker triggers alarm
            is_read: false
          });

        if (notificationError) {
          console.error(`❌ Error notifying responder ${responder.id}:`, notificationError);
          return false;
        }

        console.log(`✅ Notification sent to responder ${responder.id}`);
        return true;
      } catch (error) {
        console.error(`❌ Error notifying responder ${responder.id}:`, error);
        return false;
      }
    });

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(Boolean).length;
    
    console.log('📊 Notification results:', { successCount, totalResponders: responders.length });
    
    if (successCount > 0) {
      console.log(`✅ Successfully notified ${successCount} responders of status change`);
      return { 
        success: true, 
        count: successCount,
        total: responders.length
      };
    } else {
      console.error('❌ Failed to create any notifications');
      return { success: false, message: 'Failed to create any notifications' };
    }
  } catch (error) {
    console.error('❌ Error notifying responders on status change:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify responders when alarm level changes
 * Uses the EXACT same pattern as working assignment notifications
 * 
 * @param {string} reportId - The fire report ID
 * @param {string} oldAlarmLevel - Previous alarm level (optional)
 * @param {string} newAlarmLevel - New alarm level
 * @param {object} reportData - Full report data (optional, for location)
 */
export async function notifyRespondersOnAlarmChange(reportId, newAlarmLevel, oldAlarmLevel = null, reportData = null) {
  try {
    console.log('🔔 Notifying responders of alarm level change:', { reportId, oldAlarmLevel, newAlarmLevel });

    // Normalize alarm levels for comparison (case-insensitive, handle variations)
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

    // Determine which station has jurisdiction
    const station = await getStationWithJurisdiction(reportId, reportLocation);
    
    if (!station || !station.stationId) {
      console.log('⚠️ No station jurisdiction found, cannot notify responders');
      return { success: false, message: 'No station jurisdiction found' };
    }

    console.log('✅ Station with jurisdiction:', station);

    // Get all responders for this station (EXACT same query as working code)
    const responders = await getStationResponders(station.stationId);
    
    if (!responders || responders.length === 0) {
      console.log('⚠️ No responders found for station:', station.stationId);
      return { success: false, message: 'No responders found' };
    }

    console.log(`📋 Found ${responders.length} responders for station ${station.stationId}`);

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

    // Helper function to format values (matching SMap.jsx pattern)
    const toStr = (val, def = 'Not specified') => val || def;
    const formatAlarm = (report) => {
      return report.final_alarm_level || report.recommended_alarm_level || report.alarm_level || 'Unknown';
    };
    const formatPrediction = (report) => {
      return report.prediction || report.ai_detection || 'Not analyzed';
    };

    // Create notification message matching the working assignment format
    const locationInfo = toStr(reportData?.address || reportData?.geotag_location || reportData?.location, 'Location not specified');
    const aiDetection = formatPrediction(reportData || {});
    const reporter = toStr(reportData?.reporter_name || reportData?.reporter || reportData?.reported_by, 'Unknown Reporter');
    const cause = toStr(reportData?.cause || reportData?.possible_cause || reportData?.fire_cause, 'Under investigation');
    const structure = toStr(reportData?.structure || reportData?.building_type, 'Not specified');
    const structuresAffected = reportData?.number_of_structures_on_fire != null ? String(reportData.number_of_structures_on_fire) : 'Unknown';
    const timestamp = toStr(reportData?.formatted_timestamp || reportData?.timestamp, 'Time not specified');
    
    const changeText = oldAlarmLevel 
      ? `changed from "${oldAlarmLevel}" to "${newAlarmLevel}"`
      : `set to "${newAlarmLevel}"`;
    
    const notificationMessage = `🚨 ALARM LEVEL UPDATE: ${newAlarmLevel} 🚨
📍 Location: ${locationInfo}
🔥 Alarm Level: ${newAlarmLevel} ${oldAlarmLevel ? `(was: ${oldAlarmLevel})` : ''}
📊 AI Detection: ${toStr(aiDetection, 'Not analyzed')}
👤 Reporter: ${reporter}
📝 Cause: ${cause}
💨 Smoke Analysis: ${reportData?.smoke_intensity ? toStr(`${reportData.smoke_intensity}${reportData.smoke_confidence ? ` ${reportData.smoke_confidence}` : ''}`) : 'Not analyzed'}
🏠 Structure: ${structure}
🏘️ Structures Affected: ${structuresAffected}
⏰ Reported: ${timestamp}

Alarm level has been ${changeText}. Please review the incident and respond accordingly.`;

    // Create distinct title for alarm level changes
    const title = `Fire Alarm Level Changed to ${newAlarmLevel}`;

    // Create notifications using EXACT same pattern as working code
    console.log(`📝 Creating notifications for ${responders.length} responder(s)...`);
    
    const notificationPromises = responders.map(async (responder) => {
      try {
        const { error: notificationError } = await supabase
          .from('responder_notifications')
          .insert({
            responder_id: responder.id,
            station_id: responder.station_id || station.stationId,
            fire_report_id: String(reportId),
            title: title,
            message: notificationMessage,
            priority: priority,
            is_read: false
          });

        if (notificationError) {
          console.error(`❌ Error notifying responder ${responder.id}:`, notificationError);
          return false;
        }

        console.log(`✅ Notification sent to responder ${responder.id}`);
        return true;
      } catch (error) {
        console.error(`❌ Error notifying responder ${responder.id}:`, error);
        return false;
      }
    });

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(Boolean).length;
    
    console.log('📊 Notification results:', { successCount, totalResponders: responders.length });
    
    if (successCount > 0) {
      console.log(`✅ Successfully notified ${successCount} responders of alarm level change`);
      return { 
        success: true, 
        count: successCount,
        total: responders.length
      };
    } else {
      console.error('❌ Failed to create any notifications');
      return { success: false, message: 'Failed to create any notifications' };
    }
  } catch (error) {
    console.error('❌ Error notifying responders on alarm change:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to fetch report data from API
 */
export async function fetchReportData(reportId) {
  try {
    const API_URL = 'https://fire-detection-api-production-f55b.up.railway.app';
    const response = await fetch(`${API_URL}/get_reports`);
    
    if (!response.ok) {
      console.error('❌ Failed to fetch reports:', response.status);
      return null;
    }

    const reports = await response.json();
    const report = Array.isArray(reports) 
      ? reports.find(r => String(r.id) === String(reportId))
      : null;

    return report || null;
  } catch (error) {
    console.error('❌ Error fetching report data:', error);
    return null;
  }
}

