/**
 * Profile Picture Service
 * Handles uploading and retrieving profile pictures from Supabase Storage
 */

import { supabase } from '../config/supabase';
import * as FileSystem from 'expo-file-system';

const BUCKET_NAME = 'profile-pictures';

/**
 * Upload a profile picture to Supabase Storage
 * @param {string} imageUri - Local URI of the image to upload
 * @param {string} userId - User ID (from responders, citizen_users, station_users, or admin_users)
 * @param {string} userType - Type of user: 'responder', 'citizen', 'station', or 'admin'
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadProfilePicture(imageUri, userId, userType) {
  try {
    console.log('📸 Starting profile picture upload...', { userId, userType, imageUri });

    // Validate inputs
    if (!imageUri || !userId || !userType) {
      throw new Error('Missing required parameters: imageUri, userId, or userType');
    }

    // Generate unique filename: userType_userId_timestamp.jpg
    const timestamp = Date.now();
    const fileExt = imageUri.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `${userType}_${userId}_${timestamp}.${fileExt}`;
    const filePath = `${userType}/${fileName}`;

    console.log('📤 Uploading to:', filePath);

    // Determine content type
    const contentType = fileExt.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
    
    // Use FormData for React Native - this works better with file URIs
    const formData = new FormData();
    formData.append('', {
      uri: imageUri,
      type: contentType,
      name: fileName,
    });

    // Supabase Storage API endpoint
    const supabaseUrl = 'https://wedqhsgrxnvbhklzhnet.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZHFoc2dyeG52YmhrbHpobmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzYzNzcsImV4cCI6MjA3MTg1MjM3N30.MimeT7vfd8M5mLByJqSRBFby_OpyODfegoMouIlf7mU';

    // Upload using fetch and FormData directly to Supabase Storage API
    console.log('📤 Uploading to Supabase Storage API...');
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET_NAME}/${filePath}`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: formData,
    });

    console.log('📊 Upload response status:', uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ Upload failed:', errorText);
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload successful:', uploadResult);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;
    console.log('🔗 Public URL:', publicUrl);

    return {
      success: true,
      url: publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('❌ Error uploading profile picture:', error);
    console.error('❌ Error stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Failed to upload profile picture',
    };
  }
}

/**
 * Get profile picture URL from Supabase Storage
 * @param {string} userId - User ID
 * @param {string} userType - Type of user: 'responder', 'citizen', 'station', or 'admin'
 * @returns {Promise<string|null>} Public URL of the profile picture or null if not found
 */
export async function getProfilePictureUrl(userId, userType) {
  try {
    if (!userId || !userType) {
      return null;
    }

    // List files in the user's folder
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${userType}/`, {
        limit: 1,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('❌ Error listing files:', error);
      return null;
    }

    // Find the most recent file for this user
    const userFile = data?.find((file) => file.name.startsWith(`${userType}_${userId}_`));

    if (!userFile) {
      console.log('ℹ️ No profile picture found for user:', userId);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`${userType}/${userFile.name}`);

    return urlData?.publicUrl || null;
  } catch (error) {
    console.error('❌ Error getting profile picture URL:', error);
    return null;
  }
}

/**
 * Delete a profile picture from Supabase Storage
 * @param {string} userId - User ID
 * @param {string} userType - Type of user
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteProfilePicture(userId, userType) {
  try {
    if (!userId || !userType) {
      return { success: false, error: 'Missing userId or userType' };
    }

    // List files in the user's folder
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${userType}/`);

    if (error) {
      console.error('❌ Error listing files for deletion:', error);
      return { success: false, error: error.message };
    }

    // Find all files for this user
    const userFiles = data?.filter((file) => file.name.startsWith(`${userType}_${userId}_`));

    if (!userFiles || userFiles.length === 0) {
      return { success: true, message: 'No files to delete' };
    }

    // Delete all files for this user
    const filePaths = userFiles.map((file) => `${userType}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error('❌ Error deleting files:', deleteError);
      return { success: false, error: deleteError.message };
    }

    console.log('✅ Deleted profile pictures:', filePaths.length);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting profile picture:', error);
    return { success: false, error: error.message };
  }
}

