/**
 * Responder Assignment Notification Service
 * 
 * Creates notifications when responders are directly assigned to fire reports
 */

import { supabase } from '../config/supabase';

/**
 * Notify a responder when they are directly assigned to a report
 */
export async function notifyResponderOnAssignment(responderId, reportId, reportData = null) {
  try {
    console.log('🔔 Notifying responder of direct assignment:', { responderId, reportId });

    // Get responder details to find their station
    const { data: responder, error: responderError } = await supabase
      .from('responders')
      .select('id, first_name, last_name, station_id')
      .eq('id', responderId)
      .single();

    if (responderError || !responder) {
      console.error('❌ Error fetching responder details:', responderError);
      return { success: false, error: 'Responder not found' };
    }

    const stationId = responder.station_id;
    if (!stationId) {
      console.log('⚠️ Responder has no station_id, cannot create notification');
      return { success: false, error: 'Responder has no station' };
    }

    // Get report location if available
    let locationInfo = 'Location unavailable';
    if (reportData) {
      locationInfo = reportData.address || reportData.geotag_location || reportData.location || locationInfo;
    }

    const title = `🔥 Fire Report Assignment`;
    const message = `You have been assigned to a fire incident.\n\nLocation: ${locationInfo}\nReport ID: ${reportId}\n\nPlease review the incident details and respond accordingly.`;

    // Create notification
    const { data: insertedNotification, error } = await supabase
      .from('responder_notifications')
      .insert({
        responder_id: responderId,
        station_id: stationId,
        fire_report_id: String(reportId),
        title: title,
        message: message,
        priority: 'high',
        status: 'pending',
        is_read: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating assignment notification:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Successfully created assignment notification:', insertedNotification);
    return { 
      success: true, 
      notification: insertedNotification 
    };
  } catch (error) {
    console.error('❌ Error in notifyResponderOnAssignment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify multiple responders when they are assigned to a report
 */
export async function notifyRespondersOnBulkAssignment(responderIds, reportId, reportData = null) {
  try {
    console.log('🔔 Notifying multiple responders of assignment:', { responderIds, reportId });

    if (!responderIds || responderIds.length === 0) {
      return { success: false, message: 'No responder IDs provided' };
    }

    // Get all responder details
    const { data: responders, error: responderError } = await supabase
      .from('responders')
      .select('id, first_name, last_name, station_id')
      .in('id', responderIds);

    if (responderError) {
      console.error('❌ Error fetching responder details:', responderError);
      return { success: false, error: responderError.message };
    }

    if (!responders || responders.length === 0) {
      console.log('⚠️ No responders found with provided IDs');
      return { success: false, message: 'No responders found' };
    }

    // Get report location if available
    let locationInfo = 'Location unavailable';
    if (reportData) {
      locationInfo = reportData.address || reportData.geotag_location || reportData.location || locationInfo;
    }

    const title = `🔥 Fire Report Assignment`;
    const message = `You have been assigned to a fire incident.\n\nLocation: ${locationInfo}\nReport ID: ${reportId}\n\nPlease review the incident details and respond accordingly.`;

    // Create notifications for all responders
    const notifications = responders
      .filter(r => r.station_id) // Only notify responders with a station
      .map(responder => ({
        responder_id: responder.id,
        station_id: responder.station_id,
        fire_report_id: String(reportId),
        title: title,
        message: message,
        priority: 'high',
        status: 'pending',
        is_read: false
      }));

    if (notifications.length === 0) {
      console.log('⚠️ No responders with stations found');
      return { success: false, message: 'No responders with stations' };
    }

    console.log(`📝 Creating ${notifications.length} assignment notifications...`);

    const { data: insertedNotifications, error } = await supabase
      .from('responder_notifications')
      .insert(notifications)
      .select();

    if (error) {
      console.error('❌ Error creating assignment notifications:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Successfully created ${insertedNotifications?.length || 0} assignment notifications`);
    return { 
      success: true, 
      count: insertedNotifications?.length || 0,
      notifications: insertedNotifications 
    };
  } catch (error) {
    console.error('❌ Error in notifyRespondersOnBulkAssignment:', error);
    return { success: false, error: error.message };
  }
}

