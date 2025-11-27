/**
 * Test Notification Service
 * 
 * Use this to manually test notification creation for debugging
 */

import { supabase } from '../config/supabase';
import { notifyRespondersOnStatusChange, notifyRespondersOnAlarmChange } from './responderNotificationService';
import { notifyRespondersOnBulkAssignment } from './responderAssignmentNotification';

/**
 * Test function to create a notification for a specific responder
 * Call this from console or add a test button
 */
export async function testCreateNotification(responderId, reportId = 'test-report-123') {
  try {
    console.log('🧪 TEST: Creating test notification...');
    console.log('🧪 Responder ID:', responderId);
    console.log('🧪 Report ID:', reportId);

    // Get responder details first
    const { data: responder, error: responderError } = await supabase
      .from('responders')
      .select('id, first_name, last_name, email, station_id')
      .eq('id', responderId)
      .single();

    if (responderError || !responder) {
      console.error('❌ TEST: Responder not found:', responderError);
      return { success: false, error: 'Responder not found' };
    }

    console.log('✅ TEST: Responder found:', responder);

    // Create test notification
    const { data: notification, error } = await supabase
      .from('responder_notifications')
      .insert({
        responder_id: responder.id,
        station_id: responder.station_id,
        fire_report_id: reportId,
        title: '🧪 TEST: Test Notification',
        message: 'This is a test notification to verify the notification system is working correctly.',
        priority: 'high',
        is_read: false
      })
      .select()
      .single();

    if (error) {
      console.error('❌ TEST: Error creating notification:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ TEST: Notification created successfully:', notification);
    return { success: true, notification };
  } catch (error) {
    console.error('❌ TEST: Error in test function:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test status change notification
 */
export async function testStatusChangeNotification(reportId, newStatus = 'Under Control') {
  try {
    console.log('🧪 TEST: Testing status change notification...');
    const result = await notifyRespondersOnStatusChange(
      reportId,
      newStatus,
      'On Going',
      { address: 'Test Location', latitude: 10.3157, longitude: 123.8854 }
    );
    console.log('🧪 TEST: Status change result:', result);
    return result;
  } catch (error) {
    console.error('❌ TEST: Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test alarm level change notification
 */
export async function testAlarmChangeNotification(reportId, newAlarmLevel = '2nd Alarm') {
  try {
    console.log('🧪 TEST: Testing alarm level change notification...');
    const result = await notifyRespondersOnAlarmChange(
      reportId,
      newAlarmLevel,
      '1st Alarm',
      { address: 'Test Location', latitude: 10.3157, longitude: 123.8854 }
    );
    console.log('🧪 TEST: Alarm change result:', result);
    return result;
  } catch (error) {
    console.error('❌ TEST: Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all notifications for a responder (for debugging)
 */
export async function getResponderNotifications(responderId) {
  try {
    const { data, error } = await supabase
      .from('responder_notifications')
      .select('*')
      .eq('responder_id', responderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Found ${data?.length || 0} notifications for responder ${responderId}`);
    return { success: true, notifications: data || [] };
  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
}

// Make functions available globally for console testing
if (typeof global !== 'undefined') {
  global.testCreateNotification = testCreateNotification;
  global.testStatusChangeNotification = testStatusChangeNotification;
  global.testAlarmChangeNotification = testAlarmChangeNotification;
  global.getResponderNotifications = getResponderNotifications;
}

