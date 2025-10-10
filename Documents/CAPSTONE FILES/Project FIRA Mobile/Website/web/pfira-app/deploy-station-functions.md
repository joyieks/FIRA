# Deploy Station User Management Functions

## Quick Deployment Steps

### 1. Navigate to Functions Directory
```bash
cd "C:\Users\HP\Documents\CAPSTONE FILES\Project FIRA Mobile\functions"
```

### 2. Install Dependencies (if not already done)
```bash
npm install
```

### 3. Deploy Functions
```bash
npm run deploy
```

### 4. Configure Email Settings
After deployment, set up your Gmail credentials:
```bash
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.pass="your-app-password"
```

**Note**: You'll need to create an App Password in your Google Account settings, not your regular password.

### 5. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

## Testing the Functions

### 1. Test Locally (Optional)
```bash
npm run serve
```

### 2. Test in Production
- Navigate to your web app
- Go to Station User Management
- Try creating a new station user
- Check if welcome email is received

## Function URLs (After Deployment)

Your functions will be available at:
- `https://us-central1-project-fira-9b6d9.cloudfunctions.net/createStationUser`
- `https://us-central1-project-fira-9b6d9.cloudfunctions.net/sendStationUserWelcomeEmail`

## Troubleshooting Deployment

### Common Issues:
1. **Permission Denied**: Ensure you're logged into Firebase CLI
2. **Build Errors**: Check Node.js version (should be 18+)
3. **Email Config**: Verify Gmail app password is correct
4. **Function Timeout**: Functions may take a few minutes to deploy

### Check Deployment Status:
```bash
firebase functions:list
```

### View Logs:
```bash
firebase functions:log
```

## Security Notes

- The functions are secured with Firebase Auth
- Only authenticated users can call these functions
- Email credentials are encrypted in Firebase config
- Firestore rules protect the `stationUsers` collection
