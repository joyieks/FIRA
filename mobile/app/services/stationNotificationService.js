/**
 * Station Notification Service
 * 
 * Creates notifications when fire reports are assigned to stations
 */

import { supabase } from '../config/supabase';

/**
 * Notify a station when a fire report is assigned to them
 */
export async function notifyStationOnAssignment(stationId, reportId, reportData = null) {
  try {
    console.log('🔔 Notifying station of fire report assignment:', { stationId, reportId });

    // Get station details
    const { data: station, error: stationError } = await supabase
      .from('station_users')
      .select('id, station_name')
      .eq('id', stationId)
      .single();

    if (stationError || !station) {
      console.error('❌ Error fetching station details:', stationError);
      return { success: false, error: 'Station not found' };
    }

    // Get report location if available
    let locationInfo = 'Location unavailable';
    let reporterName = 'Unknown Reporter';
    if (reportData) {
      locationInfo = reportData.address || reportData.geotag_location || reportData.location || locationInfo;
      reporterName = reportData.reporter_name || reportData.reporter || reporterName;
    }

    const title = `🚨 New Fire Report - Assigned to Your Station`;
    const message = `A fire incident has been assigned to ${station.station_name}.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}\n\nPlease review the incident details and take appropriate action.`;

    // Create notification in the notifications table (for stations)
    const { data: insertedNotification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: stationId,
        user_type: 'station',
        type: 'assignment',
        related_report_id: String(reportId),
        title: title,
        message: message,
        priority: 'urgent',
        is_read: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating station notification:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Successfully created station notification:', insertedNotification);
    return { 
      success: true, 
      notification: insertedNotification 
    };
  } catch (error) {
    console.error('❌ Error in notifyStationOnAssignment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify station when report is forwarded to them
 */
export async function notifyStationOnForwarding(stationId, reportId, reportData = null, forwardingNote = null) {
  try {
    console.log('🔔 Notifying station of forwarded fire report:', { stationId, reportId });

    // Get station details
    const { data: station, error: stationError } = await supabase
      .from('station_users')
      .select('id, station_name')
      .eq('id', stationId)
      .single();

    if (stationError || !station) {
      console.error('❌ Error fetching station details:', stationError);
      return { success: false, error: 'Station not found' };
    }

    // Get report location if available
    let locationInfo = 'Location unavailable';
    let reporterName = 'Unknown Reporter';
    if (reportData) {
      locationInfo = reportData.address || reportData.geotag_location || reportData.location || locationInfo;
      reporterName = reportData.reporter_name || reportData.reporter || reporterName;
    }

    const noteText = forwardingNote ? `\n\nNote: ${forwardingNote}` : '';
    const title = `📬 Fire Report Forwarded to Your Station`;
    const message = `A fire incident has been forwarded to ${station.station_name}.\n\nLocation: ${locationInfo}\nReporter: ${reporterName}${noteText}\n\nPlease review the incident details.`;

    // Create notification in the notifications table (for stations)
    const { data: insertedNotification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: stationId,
        user_type: 'station',
        type: 'assignment',
        related_report_id: String(reportId),
        title: title,
        message: message,
        priority: 'high',
        is_read: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating forwarding notification:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Successfully created forwarding notification:', insertedNotification);
    return { 
      success: true, 
      notification: insertedNotification 
    };
  } catch (error) {
    console.error('❌ Error in notifyStationOnForwarding:', error);
    return { success: false, error: error.message };
  }
}
