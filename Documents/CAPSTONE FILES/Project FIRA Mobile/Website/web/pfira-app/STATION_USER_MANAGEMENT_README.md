# Station User Management System

## Overview
The Station User Management system allows station administrators to create, manage, and monitor station users (responders) within the Project FIRA platform. When a new station user is registered, the system automatically sends a welcome email and stores their information in the Firebase `stationUsers` collection.

## Features

### 1. User Registration
- **Form Fields**: First Name, Last Name, Email, Password, Position, Location
- **Automatic Email**: Welcome email sent automatically upon successful registration
- **Database Storage**: User data stored in Firebase `stationUsers` collection
- **Firebase Auth**: User account created in Firebase Authentication

### 2. User Management
- **View Users**: Display all station users in a table format
- **Edit Users**: Modify existing user information (except password)
- **Enable/Disable**: Toggle user account status
- **Delete Users**: Remove users from the system
- **Search**: Filter users by name, email, position, or location

### 3. Email Integration
- **Welcome Email**: Professional HTML email template
- **Account Details**: Includes login credentials and user information
- **Role Information**: Explains station user capabilities
- **Security Notice**: Prompts password change on first login

## Technical Implementation

### Firebase Functions
- `createStationUser`: Creates new station user accounts
- `sendStationUserWelcomeEmail`: Sends welcome emails to new users

### Database Structure
```javascript
// stationUsers collection document structure
{
  uid: "firebase_auth_uid",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  fullName: "John Doe",
  position: "Firefighter",
  location: "Lahug",
  role: "stationUser",
  active: true,
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

### Frontend Components
- **Suser_Management.jsx**: Main component for station user management
- **Real-time Updates**: Automatic refresh after user creation
- **Error Handling**: Comprehensive error messages and validation
- **Loading States**: Visual feedback during operations

## Setup Instructions

### 1. Deploy Firebase Functions
```bash
cd functions
npm run deploy
```

### 2. Configure Email Settings
Set up Gmail credentials in Firebase Functions config:
```bash
firebase functions:config:set email.user="your-email@gmail.com" email.pass="your-app-password"
```

### 3. Update Firestore Rules
Ensure `stationUsers` collection has proper access rules.

### 4. Test the System
1. Navigate to Station User Management page
2. Click "Add User" button
3. Fill in user details
4. Submit the form
5. Verify user appears in the table
6. Check email inbox for welcome message

## Usage Guide

### Adding a New User
1. Click the "Add User" button
2. Fill in all required fields:
   - **First Name**: User's first name
   - **Last Name**: User's last name
   - **Email**: User's email address (must be unique)
   - **Password**: Initial password for the account
   - **Position**: User's role/position (e.g., Firefighter, Officer)
   - **Location**: Geographic location in Cebu City
3. Click "Add User" to submit
4. System will create account and send welcome email

### Editing a User
1. Click the edit icon (pencil) next to the user
2. Modify the desired fields
3. Click "Save Changes"
4. Password field is not available for editing

### Managing User Status
- **Enable/Disable**: Click the status toggle button
- **Delete**: Click the delete button (requires confirmation)

### Searching Users
Use the search bar to filter users by:
- Name (first or last)
- Email address
- Position
- Location

## Security Features

- **Password Validation**: Ensures strong passwords
- **Email Uniqueness**: Prevents duplicate accounts
- **Role-based Access**: Station users have limited permissions
- **Audit Trail**: Tracks creation and modification timestamps

## Email Template

The welcome email includes:
- Project FIRA branding and styling
- Personalized greeting with user's name
- Complete account details
- Security recommendations
- Role-specific information
- Contact information for support

## Troubleshooting

### Common Issues

1. **Email Not Sent**
   - Check Firebase Functions logs
   - Verify email configuration
   - Ensure Gmail app password is correct

2. **User Creation Fails**
   - Check for duplicate email addresses
   - Verify all required fields are filled
   - Check Firebase Authentication limits

3. **Database Errors**
   - Verify Firestore rules
   - Check network connectivity
   - Review Firebase console for errors

### Error Messages
- **"User with this email already exists"**: Email address is already registered
- **"Failed to create station user"**: System error, check logs
- **"Failed to send welcome email"**: Email service issue

## Support

For technical support or questions about the Station User Management system, please contact the development team or refer to the Firebase console logs for detailed error information.

## Future Enhancements

- **Bulk User Import**: CSV file upload for multiple users
- **User Groups**: Organize users by teams or departments
- **Advanced Permissions**: Granular access control
- **Audit Reports**: Detailed user activity logs
- **Integration**: Connect with external HR systems
