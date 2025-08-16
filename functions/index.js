const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

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
