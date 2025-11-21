# 🚀 Deploy Password Reset Edge Function

## Quick Deployment Guide

### Method 1: Using Supabase CLI (Recommended)

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login to Supabase
supabase login

# 3. Link your project (get project ref from Supabase dashboard URL)
supabase link --project-ref your-project-ref-here

# 4. Deploy the function
cd Website/web/pfira-app
supabase functions deploy reset-password

# 5. Verify deployment
supabase functions list
```

### Method 2: Using Supabase Dashboard (Manual)

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** in the left sidebar
3. Click **"New Function"** or **"Create Function"**
4. Name it: `reset-password`
5. Copy the entire content from `supabase/functions/reset-password/index.ts`
6. Paste it into the function editor
7. Click **"Deploy"** or **"Save"**
8. Wait for deployment to complete
9. Test the function

### Method 3: Using Supabase API

```bash
curl -X POST 'https://api.supabase.com/v1/projects/{project-ref}/functions' \
  -H "Authorization: Bearer {your-access-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "reset-password",
    "body": "... function code ..."
  }'
```

---

## 📝 Environment Variables

The Edge Function needs access to these (automatically available):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (admin access)

These are automatically injected by Supabase, no manual setup needed!

---

## 🧪 Testing the Edge Function

### Test from command line:

```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/reset-password' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "newPassword": "newpassword123",
    "verificationCode": "123456",
    "userTable": "station_users"
  }'
```

### Test from browser console:

```javascript
const { data, error } = await supabase.functions.invoke('reset-password', {
  body: {
    email: 'test@example.com',
    newPassword: 'newpassword123',
    verificationCode: '123456',
    userTable: 'station_users'
  }
});

console.log('Result:', data, error);
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Function appears in Supabase Dashboard under Edge Functions
- [ ] Function status shows as "Active" or "Deployed"
- [ ] Test invocation returns 200 status (with valid data)
- [ ] Check function logs for any errors
- [ ] Test password reset flow end-to-end

---

## 🐛 Common Issues

### Issue: "Function not found"
**Solution:** Make sure you deployed to the correct project. Check `supabase link` output.

### Issue: "Service role key not found"
**Solution:** This should be automatic. If not, check your project settings in Supabase Dashboard.

### Issue: "CORS error"
**Solution:** The function includes CORS headers. Make sure you're calling from the correct origin.

### Issue: "Deployment failed"
**Solution:** 
1. Check function syntax
2. Ensure all imports are valid
3. Check Supabase CLI version: `supabase --version`
4. Update CLI if needed: `npm install -g supabase@latest`

---

## 📊 Monitoring

View function logs in Supabase Dashboard:
1. Go to **Edge Functions**
2. Click on **reset-password**
3. Click **"Logs"** tab
4. Monitor invocations and errors

---

## 🔄 Updating the Function

To update after making changes:

```bash
# Make your changes to index.ts
# Then redeploy:
supabase functions deploy reset-password

# Or use --no-verify-jwt for testing:
supabase functions deploy reset-password --no-verify-jwt
```

---

## 💡 Alternative If Edge Function Fails

If you can't get the Edge Function working, you can use Supabase's built-in password reset:

Update `forgotpassword.jsx` to use:

```javascript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
});
```

This sends a magic link instead of a 6-digit code, but it's more secure and doesn't require an Edge Function!

---

**Need Help?** Check the Supabase Edge Functions documentation:
https://supabase.com/docs/guides/functions

