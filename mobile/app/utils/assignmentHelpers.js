/**
 * Assignment Helper Functions (Mobile)
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
 */
export const checkStationIsBusy = async (stationId) => {
  try {
    // Get all assignments for this station
    const { data: assignments, error: assignError } = await supabase
      .from('report_assignments')
      .select('report_id, status')
      .eq('assignee_type', 'station')
      .eq('assignee_id', stationId)
      .in('status', ['pending', 'accepted']);

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
 */
export const findNearestStations = async (lat, lng, excludeStationId = null, limit = 5) => {
  try {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      console.error('❌ Invalid coordinates for findNearestStations');
      return [];
    }

    // Fetch all stations
    const { data: stations, error } = await supabase
      .from('station_users')
      .select('id, station_name, lat, lng, address')
      .eq('account_status', 'active')
      .or('status.eq.active,status.is.null');

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
        if (excludeStationId && String(station.id) === String(excludeStationId)) {
          return false;
        }
        const stationLat = parseFloat(station.lat);
        const stationLng = parseFloat(station.lng);
        return !isNaN(stationLat) && !isNaN(stationLng);
      })
      .map(station => {
        const stationLat = parseFloat(station.lat);
        const stationLng = parseFloat(station.lng);
        const distance = calculateDistance(lat, lng, stationLat, stationLng);
        return {
          ...station,
          distance: distance,
          distanceKm: (distance / 1000).toFixed(2)
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return stationsWithDistance;
  } catch (error) {
    console.error('❌ Error in findNearestStations:', error);
    return [];
  }
};

/**
 * Handle assignment response (accept or decline)
 */
export const handleAssignmentResponse = async (reportId, stationId, response) => {
  try {
    if (!['accepted', 'declined'].includes(response)) {
      return { success: false, error: 'Invalid response. Must be "accepted" or "declined"' };
    }

    const { error } = await supabase
      .from('report_assignments')
      .update({ 
        status: response,
        updated_at: new Date().toISOString()
      })
      .eq('report_id', String(reportId))
      .eq('assignee_type', 'station')
      .eq('assignee_id', stationId);

    if (error) {
      console.error('❌ Error updating assignment response:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error in handleAssignmentResponse:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Request forwarding of a report
 */
export const requestForwarding = async (reportId, stationId) => {
  try {
    const { data: reportData } = await supabase
      .from('assigned_report_snapshots')
      .select('snapshot_json')
      .eq('report_id', String(reportId))
      .single();

    const report = reportData?.snapshot_json || {};
    const locationInfo = report.address || report.geotag_location || 'Location unavailable';

    const { data: stationData } = await supabase
      .from('station_users')
      .select('station_name')
      .eq('id', stationId)
      .single();

    const stationName = stationData?.station_name || 'Unknown Station';

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


