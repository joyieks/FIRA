# Profile Picture Setup Guide

## 📦 Supabase Storage Bucket Setup

### 1. Create the Storage Bucket

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Name: `profile-pictures`
5. **Make it PUBLIC** (uncheck "Private bucket") so profile pictures can be accessed
6. Click **"Create bucket"**

### 2. Set Bucket Policies (Optional but Recommended)

Go to **Storage** → **Policies** → `profile-pictures` and add:

**Policy 1: Allow authenticated users to upload**
```sql
CREATE POLICY "Users can upload their own profile pictures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures');
```

**Policy 2: Allow public read access**
```sql
CREATE POLICY "Public can view profile pictures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');
```

**Policy 3: Allow users to update their own pictures**
```sql
CREATE POLICY "Users can update their own profile pictures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures');
```

**Policy 4: Allow users to delete their own pictures**
```sql
CREATE POLICY "Users can delete their own profile pictures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-pictures');
```

## 🗄️ Database Schema Updates

### Add `profile_picture_url` Column to User Tables

Run this SQL script in your Supabase SQL Editor:

```sql
-- Add profile_picture_url column to responders table
ALTER TABLE responders 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add profile_picture_url column to citizen_users table
ALTER TABLE citizen_users 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add profile_picture_url column to station_users table
ALTER TABLE station_users 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add profile_picture_url column to admin_users table
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create indexes for better performance (optional)
CREATE INDEX IF NOT EXISTS idx_responders_profile_picture_url 
ON responders(profile_picture_url) WHERE profile_picture_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_citizen_users_profile_picture_url 
ON citizen_users(profile_picture_url) WHERE profile_picture_url IS NOT NULL;
```

## 📱 Mobile App Implementation

The profile picture functionality has been implemented for:

### ✅ Responders
- **Edit Profile** (`REdit_Profile.jsx`): Upload and save profile pictures
- **Profile View** (`RProfile.jsx`): Display profile pictures from Supabase Storage

### 🔄 To Implement for Other User Types

1. **Citizens**: Update `CEdit_Profile.jsx` and `CProfile.jsx` (similar to responders)
2. **Stations**: Update station profile components
3. **Admin**: Update admin profile components

## 🔧 How It Works

1. **Upload Flow**:
   - User selects image from gallery
   - Image is uploaded to Supabase Storage bucket `profile-pictures`
   - File path: `{userType}/{userType}_{userId}_{timestamp}.jpg`
   - Public URL is stored in `profile_picture_url` column

2. **Display Flow**:
   - First checks `profile_picture_url` column in database
   - If not found, searches Supabase Storage for user's latest picture
   - Falls back to initials avatar if no picture exists

## 📝 File Structure

```
mobile/app/
├── services/
│   └── profilePictureService.js    # Upload/get/delete functions
├── Responders/
│   └── RespondersProfile/
│       ├── REdit_Profile.jsx        # ✅ Updated with upload
│       └── RProfile.jsx            # ✅ Updated with display
└── Citizens/
    └── CitizenMenu/
        └── CitizenProfile/
            ├── CEdit_Profile.jsx   # ⏳ To be updated
            └── CProfile.jsx        # ⏳ To be updated
```

## 🎯 Bucket Name

**Recommended bucket name**: `profile-pictures`

This is already configured in `mobile/app/services/profilePictureService.js`.

## ⚠️ Important Notes

1. **Bucket must be PUBLIC** for profile pictures to be accessible
2. **File naming convention**: `{userType}/{userType}_{userId}_{timestamp}.{ext}`
3. **Old files are automatically replaced** when uploading (upsert: true)
4. **Maximum file size**: Supabase free tier allows up to 50MB per file
5. **Supported formats**: JPEG, PNG (handled by ImagePicker)

## 🧪 Testing

1. Create the bucket in Supabase Dashboard
2. Run the SQL script to add columns
3. Test in mobile app:
   - Go to Responder Profile → Edit Profile
   - Click camera icon
   - Select an image
   - Save changes
   - Verify image appears in Profile view

