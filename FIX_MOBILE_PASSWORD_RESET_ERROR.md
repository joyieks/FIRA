# 🔧 Fix Mobile Password Reset Error

## The Problem

You're getting two errors when trying to reset password in the mobile app:

1. **`InternalBytecode.js` error**: This is a Metro bundler stack trace error (not the root cause)
2. **`Edge Function returned a non-2xx status code`**: This is the real issue - the `reset-password` Edge Function is not deployed

## The Solution

You need to **deploy the `reset-password` Edge Function** to your Supabase project.

---

## 🚀 Method 1: Deploy via Supabase CLI (Recommended)

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window. Login with your Supabase account credentials.

### Step 3: Link Your Project

First, get your project reference:
- Go to https://supabase.com/dashboard
- Open your project
- The URL will look like: `https://supabase.com/dashboard/project/YOUR-PROJECT-REF`
- Copy the `YOUR-PROJECT-REF` part

Then run:

```bash
supabase link --project-ref YOUR-PROJECT-REF
```

### Step 4: Deploy the Edge Function

```bash
cd Website/web/pfira-app
supabase functions deploy reset-password
```

Wait for deployment to complete. You should see:
```
Deployed Function reset-password with version XXXXXX
```

### Step 5: Verify Deployment

```bash
supabase functions list
```

You should see `reset-password` in the list with status `ACTIVE`.

---

## 🖥️ Method 2: Deploy via Supabase Dashboard (Manual)

If the CLI doesn't work, you can deploy manually:

### Step 1: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Edge Functions** in the left sidebar

### Step 2: Create New Function

1. Click **"New Function"** or **"+ Create Function"**
2. Name it exactly: `reset-password`
3. Click **Create**

### Step 3: Copy Function Code

1. Open `Website/web/pfira-app/supabase/functions/reset-password/index.ts`
2. Copy the entire file content
3. Paste it into the function editor in Supabase Dashboard

### Step 4: Deploy

1. Click **"Deploy"** or **"Save & Deploy"**
2. Wait for deployment to complete (status should show "Active")

---

## 🧪 Test the Function

After deployment, test it:

### Option A: Test in Browser Console

1. Go to your website
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run:

```javascript
const { data, error } = await supabase.functions.invoke('reset-password', {
  body: {
    email: 'your-test-email@example.com',
    newPassword: 'testpassword123',
    verificationCode: '123456', // Use a real code from password_reset_codes table
    userTable: 'citizen_users'
  }
});

console.log('Result:', data);
console.log('Error:', error);
```

### Option B: Test Password Reset Flow

1. Open your mobile app
2. Go to Forgot Password
3. Enter an email
4. Check email for code
5. Enter the code
6. Try setting a new password
7. It should work now! ✅

---

## 🐛 Troubleshooting

### Error: "Function not found"

**Solution:** Make sure you're deploying to the correct project. Run:

```bash
supabase projects list
```

Verify the project ref and re-link if needed.

### Error: "Deployment failed"

**Solutions:**
1. Update Supabase CLI: `npm install -g supabase@latest`
2. Check your internet connection
3. Try Method 2 (manual deployment via dashboard)

### Error: "Permission denied"

**Solution:** Make sure you're logged in:

```bash
supabase logout
supabase login
```

---

## 📋 What Changed in Mobile App

I've updated the mobile forgot password to show a clearer error message when the Edge Function is not deployed. After deploying the function, the password reset will work properly.

---

## ✅ Verification Checklist

After deployment:
- [ ] Edge Function shows as "Active" in Supabase Dashboard
- [ ] Test function invocation returns success
- [ ] Mobile password reset completes without errors
- [ ] User can login with new password

---

## 📚 Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)

---

## Need Help?

If you're still having issues:
1. Check the Edge Function logs in Supabase Dashboard → Edge Functions → reset-password → Logs
2. Look for any error messages
3. Make sure the `password_reset_codes` table exists in your database
4. Verify your Supabase project has the correct user tables (admin_users, station_users, citizen_users, responders)

---

Good luck! The password reset should work perfectly after deploying the Edge Function. 🎉



