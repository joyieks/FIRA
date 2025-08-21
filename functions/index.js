const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configure email transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: functions.config().email?.user || 'your-email@gmail.com',
    pass: functions.config().email?.pass || 'your-app-password'
  }
});

// Generate a random 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification code (simplified version without email for now)
exports.sendVerificationCode = functions.https.onCall(async (data, context) => {
  try {
    const { email } = data;

    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }

    // Check if user exists in Firebase Auth
    try {
      await admin.auth().getUserByEmail(email);
    } catch (error) {
      throw new functions.https.HttpsError('not-found', 'No account found with this email address');
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    
    // Store code in Firestore with expiration (1 minute)
    const expirationTime = new Date(Date.now() + 60000); // 1 minute from now
    
    await admin.firestore().collection('passwordResetCodes').add({
      email: email,
      code: verificationCode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expirationTime,
      used: false
    });

    // For now, just return the code in the response (for testing)
    // In production, you would send this via email
    return {
      success: true,
      message: 'Verification code generated successfully',
      code: verificationCode // Remove this in production
    };

  } catch (error) {
    console.error('Error sending verification code:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send verification code');
  }
});

// Verify code and reset password
exports.verifyCodeAndResetPassword = functions.https.onCall(async (data, context) => {
  try {
    const { email, code, newPassword } = data;

    if (!email || !code || !newPassword) {
      throw new functions.https.HttpsError('invalid-argument', 'Email, code, and new password are required');
    }

    // Check if code exists and is valid
    const snapshot = await admin.firestore()
      .collection('passwordResetCodes')
      .where('email', '==', email)
      .where('code', '==', code)
      .where('used', '==', false)
      .get();

    if (snapshot.empty) {
      throw new functions.https.HttpsError('not-found', 'Invalid or expired verification code');
    }

    const codeDoc = snapshot.docs[0];
    const codeData = codeDoc.data();

    // Check if code has expired
    if (new Date() > codeData.expiresAt.toDate()) {
      // Delete expired code
      await codeDoc.ref.delete();
      throw new functions.https.HttpsError('deadline-exceeded', 'Verification code has expired');
    }

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Update password
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword
    });

    // Mark code as used
    await codeDoc.ref.delete();

    return {
      success: true,
      message: 'Password reset successfully'
    };

  } catch (error) {
    console.error('Error resetting password:', error);
    throw new functions.https.HttpsError('internal', 'Failed to reset password');
  }
});

// Clean up expired codes (runs every hour)
exports.cleanupExpiredCodes = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  try {
    const now = new Date();
    const snapshot = await admin.firestore()
      .collection('passwordResetCodes')
      .where('expiresAt', '<', now)
      .get();

    const batch = admin.firestore().batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleaned up ${snapshot.docs.length} expired verification codes`);
    
    return null;
  } catch (error) {
    console.error('Error cleaning up expired codes:', error);
    return null;
  }
});

// Send welcome email to new citizen (NOT for station users)
exports.sendWelcomeEmail = functions.https.onCall(async (data, context) => {
  try {
    const { email, firstName, password } = data;

    if (!email || !firstName || !password) {
      throw new functions.https.HttpsError('invalid-argument', 'Email, firstName, and password are required');
    }

    const mailOptions = {
      from: functions.config().email?.user || 'your-email@gmail.com',
      to: email,
      subject: 'Welcome to Project FIRA - Your Account Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff512f 0%, #dd2476 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to Project FIRA</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Your safety is our top priority!</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${firstName},</h2>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
              Welcome to Project FIRA! Your account has been successfully created by an administrator.
              You can now access the FIRA mobile application to report emergencies and stay informed about fire incidents in your area.
            </p>
            
            <div style="background: white; border: 2px solid #ff512f; border-radius: 10px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #ff512f; margin-top: 0;">Your Login Credentials:</h3>
              <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 10px 0;"><strong>Password:</strong> ${password}</p>
              <p style="color: #ff512f; font-weight: bold; margin-top: 15px;">
                Please change your password after your first login for security.
              </p>
            </div>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
              <strong>What you can do with Project FIRA:</strong>
            </p>
            <ul style="color: #555; line-height: 1.6;">
              <li>Report fire emergencies in real-time</li>
              <li>View nearby fire incidents on the map</li>
              <li>Receive emergency notifications</li>
              <li>Track the status of your reports</li>
              <li>Access fire safety information</li>
            </ul>
            
            <p style="color: #555; line-height: 1.6; margin-top: 20px;">
              If you have any questions or need assistance, please contact our support team.
            </p>
            
            <p style="color: #555; line-height: 1.6;">
              Stay safe!<br>
              <strong>The Project FIRA Team</strong>
            </p>
          </div>
          
          <div style="background: #333; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">© 2024 Project FIRA. All rights reserved.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: 'Welcome email sent successfully'
    };

  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send welcome email');
  }
});

// Send welcome email to new station user (Template ID: template_p7tkyfi)
exports.sendStationUserWelcomeEmail = functions.https.onCall(async (data, context) => {
  try {
    const { email, stationName, address, number, position, password } = data;

    if (!email || !stationName || !address || !number || !position || !password) {
      throw new functions.https.HttpsError('invalid-argument', 'All fields are required');
    }

    console.log(`📧 Sending station user welcome email to: ${email} (Template: template_p7tkyfi)`);

    const mailOptions = {
      from: functions.config().email?.user || 'your-email@gmail.com',
      to: email,
      subject: 'Welcome to Project FIRA - Station User Account Created',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff512f 0%, #dd2476 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to Project FIRA</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Station User Account Created Successfully!</p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Template: template_p7tkyfi</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${stationName},</h2>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
              Welcome to Project FIRA! Your <strong>station user account</strong> has been successfully created by a station administrator.
              You can now access the FIRA mobile application to respond to emergencies and manage fire incidents in your assigned area.
            </p>
            
            <div style="background: white; border: 2px solid #ff512f; border-radius: 10px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #ff512f; margin-top: 0;">Your Station User Account Details:</h3>
              <p style="margin: 10px 0;"><strong>Station Name:</strong> ${stationName}</p>
              <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 10px 0;"><strong>Address:</strong> ${address}</p>
              <p style="margin: 10px 0;"><strong>Number:</strong> ${number}</p>
              <p style="margin: 10px 0;"><strong>Position:</strong> ${position}</p>
              <p style="margin: 10px 0;"><strong>Password:</strong> ${password}</p>
              <p style="margin: 10px 0;"><strong>Role:</strong> Station User (Responder)</p>
              <p style="color: #ff512f; font-weight: bold; margin-top: 15px;">
                Please change your password after your first login for security.
              </p>
            </div>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">
              <strong>What you can do as a Station User:</strong>
            </p>
            <ul style="color: #555; line-height: 1.6;">
              <li>Respond to fire emergency reports</li>
              <li>Update incident status and progress</li>
              <li>View emergency locations on the map</li>
              <li>Communicate with citizens and other responders</li>
              <li>Manage emergency response operations</li>
              <li>Access station resources and equipment</li>
            </ul>
            
            <p style="color: #555; line-height: 1.6; margin-top: 20px;">
              If you have any questions or need assistance, please contact your station administrator.
            </p>
            
            <p style="color: #555; line-height: 1.6;">
              Stay safe and thank you for your service!<br>
              <strong>The Project FIRA Team</strong>
            </p>
          </div>
          
          <div style="background: #333; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">© 2024 Project FIRA. All rights reserved.</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;">Station User Registration - Template: template_p7tkyfi</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Station user welcome email sent successfully to: ${email}`);

    return {
      success: true,
      message: 'Station user welcome email sent successfully'
    };

  } catch (error) {
    console.error('❌ Error sending station user welcome email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send welcome email');
  }
});

// Test function for station user email (for debugging)
exports.testStationUserEmail = functions.https.onCall(async (data, context) => {
  try {
    console.log('🧪 Testing station user email function...');
    
    const testData = {
      email: data.email || 'test@example.com',
      stationName: data.stationName || 'Test Station',
      address: data.address || 'Lahug',
      number: data.number || '1234567890',
      position: data.position || 'Fire Captain',
      password: data.password || 'testpassword123'
    };
    
    console.log('📧 Test data:', testData);
    
    // Test the email function directly
    const result = await exports.sendStationUserWelcomeEmail(testData);
    
    console.log('✅ Test email sent successfully:', result);
    
    return {
      success: true,
      message: 'Test email sent successfully',
      testData: testData,
      result: result
    };
    
  } catch (error) {
    console.error('❌ Test email failed:', error);
    throw new functions.https.HttpsError('internal', `Test email failed: ${error.message}`);
  }
});

// Create station user account
exports.createStationUser = functions.https.onCall(async (data, context) => {
  try {
    const { email, stationName, address, number, position, password } = data;

    console.log('🚀 Creating station user:', { email, stationName, address, number, position });

    if (!email || !stationName || !address || !number || !position || !password) {
      throw new functions.https.HttpsError('invalid-argument', 'All fields are required');
    }

    // Check if user already exists
    try {
      const existingUser = await admin.auth().getUserByEmail(email);
      throw new functions.https.HttpsError('already-exists', 'User with this email already exists');
    } catch (error) {
      if (error.code === 'user-not-found') {
        console.log('✅ User does not exist, proceeding with creation');
      } else {
        throw error;
      }
    }

    // Create user in Firebase Auth
    console.log('🔐 Creating Firebase Auth user...');
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: stationName,
      emailVerified: false
    });
    console.log('✅ Firebase Auth user created:', userRecord.uid);

    // Store user data in Firestore
    console.log('💾 Storing user data in Firestore...');
    await admin.firestore().collection('stationUsers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      stationName: stationName,
      address: address,
      number: number,
      position: position,
      role: 'stationUser',
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ User data stored in Firestore');

    // Send welcome email using the station user email function
    console.log('📧 Sending station user welcome email...');
    await exports.sendStationUserWelcomeEmail({
      email,
      stationName,
      address,
      number,
      position,
      password
    });
    console.log('✅ Station user welcome email sent successfully');

    return {
      success: true,
      message: 'Station user created successfully',
      uid: userRecord.uid
    };

  } catch (error) {
    console.error('❌ Error creating station user:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create station user');
  }
});
