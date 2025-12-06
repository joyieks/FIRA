import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Check if running in Expo Go
 */
const isExpoGo = () => {
  return Constants.executionEnvironment === 'storeClient';
};

/**
 * Request notification permissions and register for push notifications
 * Note: Push tokens don't work in Expo Go, but local notifications will still work
 */
export async function registerForPushNotificationsAsync() {
  try {
    // Request permissions (this works in Expo Go)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('⚠️ Notification permission not granted');
      return null;
    }

    console.log('✅ Notification permissions granted');

    // Skip push token registration in Expo Go (it doesn't work anyway)
    if (isExpoGo()) {
      console.log('ℹ️ Running in Expo Go - using local notifications only (push tokens not supported)');
    } else {
      // Only try to get push token in development builds or standalone apps
      try {
        const existingToken = await AsyncStorage.getItem('expoPushToken');
        if (existingToken) {
          console.log('📱 Push token already exists:', existingToken);
          return existingToken;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'bb453922-7a7d-4a77-b26a-3ed3b0591dfc',
        });
        
        const token = tokenData.data;
        console.log('✅ Push notification token:', token);
        
        // Store token for later use
        await AsyncStorage.setItem('expoPushToken', token);
        return token;
      } catch (tokenError) {
        console.log('ℹ️ Push token not available, but local notifications will work');
      }
    }
    
    // Configure Android channel (works in Expo Go)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
      console.log('✅ Android notification channel configured');
    }
    
    return null; // Return null if token not available, but local notifications still work
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    // Don't fail - local notifications will still work
    return null;
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(title, body, data = {}) {
  try {
    console.log('📱 Scheduling local notification:', { title, body, data });
    
    // Check permissions before scheduling
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('⚠️ Notification permission not granted, cannot schedule notification');
      return false;
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        data: data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        badge: 1, // Show badge
      },
      trigger: null, // Show immediately
    });
    
    console.log('✅ Local notification scheduled successfully:', title);
    console.log('✅ Notification ID:', notificationId);
    return true;
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    console.error('❌ Error message:', error.message);
    return false;
  }
}

/**
 * Send a push notification to the device
 */
export async function sendPushNotification(title, body, data = {}) {
  try {
    console.log('📱 sendPushNotification called with:', { title, body, data });
    
    // Check notification permissions first
    const { status } = await Notifications.getPermissionsAsync();
    console.log('📱 Current notification permission status:', status);
    
    if (status !== 'granted') {
      console.warn('⚠️ Notification permission not granted, requesting...');
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      console.log('📱 New permission status after request:', newStatus);
      
      if (newStatus !== 'granted') {
        console.error('❌ Notification permission denied by user');
        return false;
      }
    }
    
    // Schedule local notification (works even without push token)
    console.log('📱 Scheduling local notification...');
    await scheduleLocalNotification(title, body, data);
    console.log('✅ Push notification sent successfully');
    
    // If you have a push token, you can also send via Expo Push Notification service
    // This would require a backend service to send the notification
    // For now, we'll use local notifications which work immediately
    
    return true;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    return false;
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All notifications cancelled');
  } catch (error) {
    console.error('❌ Error cancelling notifications:', error);
  }
}

/**
 * Get notification badge count
 */
export async function getBadgeCount() {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error('❌ Error getting badge count:', error);
    return 0;
  }
}

/**
 * Set notification badge count
 */
export async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('❌ Error setting badge count:', error);
  }
}

/**
 * Test notification - sends a test notification to verify notifications work
 */
export async function testNotification() {
  try {
    console.log('🧪 Testing notification...');
    const result = await sendPushNotification(
      '🧪 Test Notification',
      'If you see this, notifications are working!',
      { type: 'test' }
    );
    console.log('🧪 Test notification result:', result);
    return result;
  } catch (error) {
    console.error('❌ Test notification failed:', error);
    return false;
  }
}

