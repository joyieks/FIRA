/**
 * Citizen Notification Service
 * 
 * Creates notifications for citizens when nearby fire incidents are detected
 */

import { supabase } from '../config/supabase';

/**
 * Create a notification for a nearby fire incident
 * @param {string} userId - Citizen user ID
 * @param {object} incident - Fire incident report with distance info
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function createNearbyIncidentNotification(userId, incident) {
  try {
    if (!userId || !incident || !incident.id) {
      console.log('⚠️ Invalid parameters for notification creation');
      return { success: false, error: 'Invalid parameters' };
    }

    console.log('🔔 Creating nearby incident notification:', { userId, incidentId: incident.id });

    // Format the notification message
    const location = incident.address || incident.geotag_location || 'Location unavailable';
    const alarmLevel = incident.recommended_alarm_level || incident.alarm_level || 'Active';
    const cause = incident.cause_of_fire || incident.cause || 'Under investigation';
    const reporter = incident.reporter || 'Unknown Reporter';
    
    const title = `🔥 Fire Incident Nearby - ${incident.distanceText || 'Close to you'}`;
    const message = `A fire incident has been reported ${incident.distanceText || 'near your location'}.\n\n📍 Location: ${location}\n🔥 Alarm Level: ${alarmLevel}\n📝 Cause: ${cause}\n👤 Reported by: ${reporter}\n\nPlease stay alert and follow safety guidelines.`;

    // Determine priority based on alarm level and distance
    let priority = 'high';
    const alarmLevelStr = String(alarmLevel).toLowerCase();
    const distance = incident.distance || 999;
    
    if (alarmLevelStr.includes('second alarm') || alarmLevelStr.includes('2nd') || 
        alarmLevelStr.includes('third alarm') || alarmLevelStr.includes('3rd') ||
        distance < 1.0) {
      priority = 'urgent';
    } else if (alarmLevelStr.includes('first alarm') || alarmLevelStr.includes('1st') ||
               distance < 2.0) {
      priority = 'high';
    } else {
      priority = 'normal';
    }

    // Check if notification already exists for this incident and user
    const { data: existing, error: checkError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('user_type', 'citizen')
      .eq('related_report_id', String(incident.id))
      .eq('type', 'fire_alert')
      .order('created_at', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking existing notification:', checkError);
    }

    // Only create if notification doesn't exist or is older than 1 hour
    if (existing && existing.length > 0) {
      const existingNotif = existing[0];
      const { data: notifDetails } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('id', existingNotif.id)
        .single();

      if (notifDetails) {
        const createdAt = new Date(notifDetails.created_at);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        if (createdAt > oneHourAgo) {
          console.log('ℹ️ Recent notification exists for this incident, skipping');
          return { success: false, message: 'Notification already exists' };
        }
      }
    }

    // Create the notification
    const { data: insertedNotification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        user_type: 'citizen',
        title: title,
        message: message,
        type: 'fire_alert',
        priority: priority,
        is_read: false,
        related_report_id: String(incident.id)
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating nearby incident notification:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Nearby incident notification created:', insertedNotification.id);
    return { success: true, notification: insertedNotification };
  } catch (error) {
    console.error('❌ Error in createNearbyIncidentNotification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create notifications for multiple nearby incidents
 * @param {string} userId - Citizen user ID
 * @param {Array} incidents - Array of nearby fire incidents
 * @returns {Promise<{success: boolean, count: number, errors?: Array}>}
 */
export async function createNearbyIncidentNotifications(userId, incidents) {
  try {
    if (!userId || !incidents || incidents.length === 0) {
      return { success: false, message: 'No incidents to notify about' };
    }

    console.log(`🔔 Creating notifications for ${incidents.length} nearby incident(s)`);

    const results = await Promise.allSettled(
      incidents.map(incident => createNearbyIncidentNotification(userId, incident))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const errors = results
      .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
      .map(r => r.status === 'rejected' ? r.reason : r.value.error);

    console.log(`✅ Created ${successful} notification(s) out of ${incidents.length}`);

    return {
      success: successful > 0,
      count: successful,
      total: incidents.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('❌ Error in createNearbyIncidentNotifications:', error);
    return { success: false, error: error.message };
  }
}

