/**
 * Citizen Notification Service
 * 
 * Creates notifications for citizens when nearby fire incidents are detected
 */

import { supabase } from '../config/supabase';
import { sendPushNotification } from './pushNotificationService';

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

    let insertedNotification = null;
    let shouldCreateNotification = true;

    // Check if notification already exists
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
          console.log('ℹ️ Recent notification exists for this incident, will still send push notification');
          shouldCreateNotification = false;
          insertedNotification = existingNotif; // Use existing notification
        }
      }
    }

    // Create the notification if it doesn't exist or is old
    if (shouldCreateNotification) {
      const { data: newNotification, error } = await supabase
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
        // Still try to send push notification even if DB insert fails
      } else {
        insertedNotification = newNotification;
        console.log('✅ Nearby incident notification created:', insertedNotification.id);
      }
    }
    
    // Only send push notification if this is a NEW notification (not a duplicate)
    // If notification already exists and was created recently, skip push notification to avoid duplicates
    if (shouldCreateNotification || !insertedNotification) {
      // This is a new notification, send push notification
      console.log('📱 About to send push notification for NEW nearby incident...');
      try {
        // Get a shorter location string for push notification
        const shortLocation = location.length > 50 
          ? location.substring(0, 47) + '...' 
          : location;
        
        const pushTitle = `🔥 Nearby Fire - ${incident.distanceText || 'Close to you'}`;
        const pushBody = `Fire incident reported ${incident.distanceText || 'near you'}. Location: ${shortLocation}`;
        
        console.log('📱 Sending push notification for nearby incident:');
        console.log('   Title:', pushTitle);
        console.log('   Body:', pushBody);
        console.log('   Incident ID:', incident.id);
        console.log('   Distance:', incident.distanceText);
        
        const pushResult = await sendPushNotification(
          pushTitle,
          pushBody,
          {
            type: 'nearby_incident',
            notificationId: insertedNotification?.id || 'new',
            reportId: String(incident.id),
            priority: priority,
            distance: incident.distance,
            distanceText: incident.distanceText,
            location: location,
            alarmLevel: alarmLevel,
          }
        );
        
        console.log('📱 Push notification result:', pushResult);
        if (pushResult) {
          console.log('✅ Push notification sent successfully for nearby incident');
        } else {
          console.warn('⚠️ Push notification returned false - may not have been sent');
        }
      } catch (pushError) {
        console.error('❌ Error sending push notification for nearby incident:', pushError);
        console.error('❌ Push error details:', JSON.stringify(pushError, null, 2));
        console.error('❌ Push error stack:', pushError.stack);
        // Don't fail the notification creation if push fails
      }
    } else {
      console.log('ℹ️ Push notification already sent recently for this incident, skipping to avoid duplicate');
    }
    
    return { success: true, notification: insertedNotification || { id: 'push_only' } };
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

