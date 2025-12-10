import { supabase } from '../config/supabase';

const BUCKET_NAME = 'profile-pictures';

/**
 * Upload a profile picture to Supabase Storage
 * @param {File} file - The image file to upload
 * @param {string} userId - The user's ID
 * @param {string} userType - Type of user ('station', 'admin', 'citizen', 'responder')
 * @returns {Promise<{success: boolean, url?: string, path?: string, error?: string}>}
 */
export async function uploadProfilePicture(file, userId, userType) {
  try {
    console.log('📸 Starting profile picture upload...', { userId, userType, fileName: file.name });

    if (!file || !userId || !userType) {
      throw new Error('Missing required parameters: file, userId, or userType');
    }

    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${userType}_${userId}_${timestamp}.${fileExt}`;
    const filePath = `${userType}/${fileName}`;

    console.log('📤 Uploading to:', filePath);

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });

    if (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }

    console.log('✅ Upload successful:', data);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    console.log('🔗 Public URL:', publicUrl);

    return {
      success: true,
      url: publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('❌ Error uploading profile picture:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload profile picture',
    };
  }
}

/**
 * Get the profile picture URL for a user
 * @param {string} userId - The user's ID
 * @param {string} userType - Type of user ('station', 'admin', 'citizen', 'responder')
 * @returns {Promise<string|null>}
 */
export async function getProfilePictureUrl(userId, userType) {
  try {
    console.log('🔍 Getting profile picture for:', { userId, userType });

    // List files in the user's folder
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${userType}`, {
        search: `${userType}_${userId}`,
      });

    if (error) {
      console.error('❌ Error listing files:', error);
      return null;
    }

    if (!files || files.length === 0) {
      console.log('📭 No profile picture found');
      return null;
    }

    // Get the most recent file
    const sortedFiles = files.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    const latestFile = sortedFiles[0];
    const filePath = `${userType}/${latestFile.name}`;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    console.log('✅ Profile picture URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ Error getting profile picture URL:', error);
    return null;
  }
}

/**
 * Delete a profile picture from Supabase Storage
 * @param {string} filePath - The file path in storage
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteProfilePicture(filePath) {
  try {
    console.log('🗑️ Deleting profile picture:', filePath);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('❌ Delete failed:', error);
      throw error;
    }

    console.log('✅ Profile picture deleted');
    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error deleting profile picture:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete profile picture',
    };
  }
}

