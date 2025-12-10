/**
 * Assignment Helper Functions
 * Utilities for checking station busy status, finding nearest stations, and handling assignment responses
 */

import { supabase } from '../config/supabase';

/**
 * Calculate distance between two coordinates using Haversine formula (returns distance in meters)
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

/**
 * Check if a station is busy (has reports with status "On Going" or "Under Control")
 * @param {string} stationId - The station ID to check
 * @returns {Promise<{isBusy: boolean, busyCount: number, busyReports: Array}>}
 */
export const checkStationIsBusy = async (stationId) => {
  try {
    // Get all assignments for this station
    const { data: assignments, error: assignError } = await supabase
      .from('report_assignments')
      .select('report_id, status')
      .eq('assignee_type', 'station')
      .eq('assignee_id', stationId)
      .in('status', ['pending', 'accepted']); // Only count pending or accepted assignments

    if (assignError) {
      console.error('❌ Error checking station assignments:', assignError);
      return { isBusy: false, busyCount: 0, busyReports: [] };
    }

    if (!assignments || assignments.length === 0) {
      return { isBusy: false, busyCount: 0, busyReports: [] };
    }

    const reportIds = assignments.map(a => String(a.report_id));

    // Fetch fire reports from API to check their status
    const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
    if (!response.ok) {
      console.error('❌ Failed to fetch fire reports for busy check');
      return { isBusy: false, busyCount: 0, busyReports: [] };
    }

    const allReports = await response.json();
    const stationReports = allReports.filter(report => 
      reportIds.includes(String(report.id))
    );

    // Check status of each report
    const busyReports = stationReports.filter(report => {
      const status = (report.status || '').toString().toLowerCase();
      const isOnGoing = status.includes('on going') || status.includes('ongoing');
      const isUnderControl = status.includes('under control');
      const isFireOut = status.includes('fire out');
      const isCancelled = status.includes('cancelled') || status.includes('canceled');
      
      // Station is busy if report is "On Going" or "Under Control"
      // Not busy if "Fire Out" or "Cancelled"
      return (isOnGoing || isUnderControl) && !isFireOut && !isCancelled;
    });

    return {
      isBusy: busyReports.length > 0,
      busyCount: busyReports.length,
      busyReports: busyReports
    };
  } catch (error) {
    console.error('❌ Error in checkStationIsBusy:', error);
    return { isBusy: false, busyCount: 0, busyReports: [] };
  }
};

/**
 * Find the nearest N stations to a given location
 * @param {number} lat - Latitude of the location
 * @param {number} lng - Longitude of the location
 * @param {string} excludeStationId - Station ID to exclude from results
 * @param {number} limit - Maximum number of stations to return (default: 5)
 * @param {Object} incidentLocation - Optional: {lat, lng} to calculate distance from station to incident
 * @returns {Promise<Array>} Array of nearest stations with distance
 */
export const findNearestStations = async (lat, lng, excludeStationId = null, limit = 5, incidentLocation = null) => {
  try {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.error('❌ Invalid coordinates for findNearestStations');
      return [];
    }

    // Fetch all stations
    const { data: stations, error } = await supabase
      .from('station_users')
      .select('id, station_name, lat, lng, address, status')
      .eq('account_status', 'active')
      .eq('status', 'active');

    if (error) {
      console.error('❌ Error fetching stations:', error);
      return [];
    }

    if (!stations || stations.length === 0) {
      return [];
    }

    // Calculate distance to each station
    const stationsWithDistance = stations
      .filter(station => {
        // Exclude the specified station
        if (excludeStationId && String(station.id) === String(excludeStationId)) {
          return false;
        }
        // Only include stations with valid coordinates
        const stationLat = parseFloat(station.lat);
        const stationLng = parseFloat(station.lng);
        return !isNaN(stationLat) && !isNaN(stationLng);
      })
      .map(station => {
        const stationLat = parseFloat(station.lat);
        const stationLng = parseFloat(station.lng);
        const distance = calculateDistance(lat, lng, stationLat, stationLng);
        
        // If incident location is provided, also calculate distance from station to incident
        let distanceToIncident = null;
        if (incidentLocation && incidentLocation.lat && incidentLocation.lng) {
          distanceToIncident = calculateDistance(
            stationLat, 
            stationLng, 
            parseFloat(incidentLocation.lat), 
            parseFloat(incidentLocation.lng)
          );
        }
        
        return {
          ...station,
          distance: distance, // Distance from reference point (report or declined station) to this station
          distanceKm: (distance / 1000).toFixed(2),
          distanceToIncident: distanceToIncident, // Distance from this station to the incident
          distanceToIncidentKm: distanceToIncident ? (distanceToIncident / 1000).toFixed(2) : null
        };
      })
      .sort((a, b) => a.distance - b.distance) // Sort by distance
      .slice(0, limit); // Take only the nearest N stations

    return stationsWithDistance;
  } catch (error) {
    console.error('❌ Error in findNearestStations:', error);
    return [];
  }
};

/**
 * Find the nearest N stations to a given station (by station ID)
 * @param {string} stationId - The station ID to find nearest stations to
 * @param {string} excludeStationId - Station ID to exclude from results (can be same as stationId)
 * @param {number} limit - Maximum number of stations to return (default: 5)
 * @param {Object} incidentLocation - Optional: {lat, lng} to calculate distance from station to incident
 * @returns {Promise<Array>} Array of nearest stations with distance
 */
export const findNearestStationsToStation = async (stationId, excludeStationId = null, limit = 5, incidentLocation = null) => {
  try {
    // First, get the declined station's location
    const { data: declinedStation, error: stationError } = await supabase
      .from('station_users')
      .select('id, station_name, lat, lng')
      .eq('id', stationId)
      .single();

    if (stationError || !declinedStation) {
      console.error('❌ Error fetching declined station:', stationError);
      return [];
    }

    const stationLat = parseFloat(declinedStation.lat);
    const stationLng = parseFloat(declinedStation.lng);

    if (isNaN(stationLat) || isNaN(stationLng)) {
      console.error('❌ Declined station has invalid coordinates');
      return [];
    }

    // Use the existing findNearestStations function with the station's location
    return await findNearestStations(
      stationLat, 
      stationLng, 
      excludeStationId || stationId, 
      limit, 
      incidentLocation
    );
  } catch (error) {
    console.error('❌ Error in findNearestStationsToStation:', error);
    return [];
  }
};

/**
 * Handle assignment response (accept or decline)
 * @param {string} reportId - The fire report ID
 * @param {string} stationId - The station ID
 * @param {string} response - 'accepted' or 'declined'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const handleAssignmentResponse = async (reportId, stationId, response) => {
  try {
    if (!['accepted', 'declined'].includes(response)) {
      return { success: false, error: 'Invalid response. Must be "accepted" or "declined"' };
    }

    // Update assignment status
    // Build update payload - only include fields that exist
    const updatePayload = { 
      status: response
    };
    
    // Only add updated_at if the column exists (it might not if migration wasn't run)
    // We'll try without it first, and if that fails, we know the status column doesn't exist either
    
    const { error } = await supabase
      .from('report_assignments')
      .update(updatePayload)
      .eq('report_id', String(reportId))
      .eq('assignee_type', 'station')
      .eq('assignee_id', stationId);

    if (error) {
      console.error('❌ Error updating assignment response:', error);
      // Check if error is due to missing status column (migration not run)
      if (error.message && (error.message.includes('column') && error.message.includes('does not exist'))) {
        if (error.message.includes('status')) {
          return { 
            success: false, 
            error: 'Database migration required! Please run assignment-status-migration.sql in Supabase SQL Editor first.' 
          };
        }
        // If it's updated_at column, that's okay - we can continue without it
        if (error.message.includes('updated_at')) {
          // Try again without updated_at
          const { error: retryError } = await supabase
            .from('report_assignments')
            .update({ status: response })
            .eq('report_id', String(reportId))
            .eq('assignee_type', 'station')
            .eq('assignee_id', stationId);
          
          if (retryError) {
            return { success: false, error: retryError.message };
          }
          return { success: true };
        }
      }
      return { success: false, error: error.message };
    }

    // NOTE: Responders are NOT automatically assigned when a station accepts an assignment.
    // Stations must manually assign responders via checkboxes in the Station Overall page.
    // Removed automatic responder notification/assignment on station acceptance.

    // If declined, we might want to notify admin (handled in component)
    return { success: true };
  } catch (error) {
    console.error('❌ Error in handleAssignmentResponse:', error);
    return { success: false, error: error.message };
  }
};

// -------- Web-side responder acceptance notifier (avoid importing mobile bundle) --------
const notifyRespondersOnStationAcceptanceWeb = async (stationId, reportId) => {
  try {
    if (!stationId || !reportId) return;

    // Get responders for the station
    const { data: responders, error: responderErr } = await supabase
      .from('responders')
      .select('id')
      .eq('station_id', stationId);

    if (responderErr) {
      console.error('❌ Error fetching responders for acceptance notify:', responderErr);
      return;
    }
    if (!responders || responders.length === 0) return;

    // Update any existing notifications for this report to accepted
    await supabase
      .from('responder_notifications')
      .update({ status: 'accepted' })
      .eq('fire_report_id', String(reportId))
      .eq('station_id', stationId);

    const readableId = `FR-${String(reportId).substring(0, 8).toUpperCase()}`;
    const title = `✅ Station Accepted Report ${readableId}`;
    const message = `Your station accepted report ${readableId}. Please proceed.`;

    const rows = responders.map(r => ({
      responder_id: r.id,
      station_id: stationId,
      fire_report_id: String(reportId),
      title,
      message,
      priority: 'high',
      status: 'accepted',
      is_read: false
    }));

    await supabase.from('responder_notifications').insert(rows);
  } catch (err) {
    console.error('❌ notifyRespondersOnStationAcceptanceWeb error:', err);
  }
};

/**
 * Request forwarding of a report (when station is busy and wants to forward)
 * @param {string} reportId - The fire report ID
 * @param {string} stationId - The station ID requesting forwarding
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const requestForwarding = async (reportId, stationId) => {
  try {
    // Create a notification for admin about forwarding request
    // We'll use a special notification type or add to the notification message
    const { data: reportData } = await supabase
      .from('assigned_report_snapshots')
      .select('snapshot_json')
      .eq('report_id', String(reportId))
      .single();

    const report = reportData?.snapshot_json || {};
    const locationInfo = report.address || report.geotag_location || 'Location unavailable';

    // Get station name
    const { data: stationData } = await supabase
      .from('station_users')
      .select('station_name')
      .eq('id', stationId)
      .single();

    const stationName = stationData?.station_name || 'Unknown Station';

    // Create notification for all admins
    const { data: admins } = await supabase
      .from('admin_users')
      .select('id')
      .eq('status', 'active')
      .or('active.eq.true,active.is.null');

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        user_type: 'admin',
        type: 'assignment',
        title: '🚨 Station Requesting Forwarding',
        message: `${stationName} is requesting forwarding of report ${reportId.substring(0, 8).toUpperCase()}.\n\nLocation: ${locationInfo}\n\nThe station is already too busy to deal with this report. Please reroute to another station.`,
        priority: 'urgent',
        is_read: false,
        related_report_id: String(reportId)
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('❌ Error creating forwarding request notifications:', notifError);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error in requestForwarding:', error);
    return { success: false, error: error.message };
  }
};

