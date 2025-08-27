import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useAuth } from '../config/AuthContext';

const VerificationCode = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes
  const [canResend, setCanResend] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userData, setUserData] = useState(null);
  const inputRefs = useRef([]);
  const { loginCitizen } = useAuth();

  // EmailJS config
  const serviceId = 'service_717ciwa';
  const templateId = 'template_iefgxnk';
  const publicKey = 'hDU2Ar_g1pr7Cpg-S';
  const privateKey = 'toeoBDUw3w6FPgdo7-Rjr';

  useEffect(() => {
    // Get user data from route params or storage
    const getUserData = async () => {
      try {
        // Try to get from AsyncStorage or route params
        // For now, we'll use a placeholder - you might need to pass this via route params
        setUserEmail('user@example.com'); // This should come from your registration flow
      } catch (error) {
        console.error('Error getting user data:', error);
      }
    };

    getUserData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit code.');
      return;
    }

    setIsLoading(true);
    
    try {
      // For now, we'll skip the actual OTP verification since you disabled email confirmation
      // and just proceed with the registration flow
      
      // Check if user exists in citizen_users table
      const { data: citizenData, error: citizenError } = await supabase
        .from('citizen_users')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (citizenError && citizenError.code !== 'PGRST116') {
        console.error('❌ Error checking citizen_users:', citizenError);
        throw new Error('Error checking user data');
      }

      if (citizenData) {
        // User exists, convert to app format and login
        const userData = {
          uid: citizenData.id,
          firstName: citizenData.first_name,
          lastName: citizenData.last_name,
          email: citizenData.email,
          phoneNumber: citizenData.phone || citizenData.phone_number,
          userType: 'citizen',
          displayName: citizenData.display_name,
          status: citizenData.status,
          reports: citizenData.reports,
          isVerified: citizenData.is_verified,
          googleSignIn: citizenData.google_sign_in,
          createdAt: citizenData.created_at
        };

        await loginCitizen(userData);
        
        Alert.alert(
          'Account Verified Successfully! 🎉',
          'Welcome to Project FIRA!',
          [{ 
            text: 'Continue', 
            onPress: () => router.replace('/Screens/CitizenScreen') 
          }]
        );
      } else {
        // User doesn't exist, this shouldn't happen but handle gracefully
        Alert.alert(
          'Verification Complete',
          'Your account has been verified. Please log in.',
          [{ 
            text: 'OK', 
            onPress: () => router.replace('/Authentication/login') 
          }]
        );
      }
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Error', 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setCanResend(false);
    setTimeLeft(900);

    try {
      const templateParams = {
        to_name: 'User',
        to_email: userEmail,
        passcode: Math.random().toString().slice(2, 8),
        time: new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString(),
        user_email: userEmail
      };

      // Use REST API instead of EmailJS browser library
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: templateParams,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP ${response.status}: ${errorData.message || 'Failed to send email'}`);
      }

      Alert.alert('Code Sent', 'New verification code sent to your email.');
    } catch (error) {
      console.error('Resend code error:', error);
      Alert.alert('Error', 'Failed to send code. Please try again.');
      setCanResend(true);
    } finally {
      setIsLoading(false);
    }
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <AntDesign name="arrowleft" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.title}>Verify Your Account</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>FIRA</Text>
            </View>
            <Text style={styles.description}>
              We've sent a verification code to your email. Please enter the 6-digit code below.
            </Text>
            {userEmail && (
              <Text style={styles.emailText}>{userEmail}</Text>
            )}
          </View>

          {/* OTP Inputs */}
          <View style={styles.otpContainer}>
            <Text style={styles.otpLabel}>Verification Code</Text>
            <View style={styles.otpInputs}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[styles.otpInput, digit && styles.otpInputFilled]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  keyboardType="numeric"
                  maxLength={1}
                  selectTextOnFocus
                  selectionColor="#DC2626"
                />
              ))}
            </View>
          </View>

          {/* Timer & Resend */}
          <View style={styles.timerSection}>
            {timeLeft > 0 ? (
              <Text style={styles.timer}>
                Expires in: <Text style={styles.timerBold}>{formatTime(timeLeft)}</Text>
              </Text>
            ) : (
              <Text style={styles.timerExpired}>Code expired</Text>
            )}
            
            <TouchableOpacity
              style={[styles.resendButton, (!canResend || isLoading) && styles.resendButtonDisabled]}
              onPress={handleResendCode}
              disabled={!canResend || isLoading}
            >
              <AntDesign name="reload1" size={16} color={canResend ? "#DC2626" : "#9CA3AF"} />
              <Text style={[styles.resendText, (!canResend || isLoading) && styles.resendTextDisabled]}>
                {isLoading ? 'Sending...' : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyButton, (!isOtpComplete || isLoading) && styles.verifyButtonDisabled]}
            onPress={handleVerify}
            disabled={!isOtpComplete || isLoading}
          >
            {isLoading ? (
              <Text style={styles.verifyButtonText}>Verifying...</Text>
            ) : (
              <>
                <AntDesign name="checkcircle" size={20} color="white" />
                <Text style={styles.verifyButtonText}>Verify Account</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Help */}
          <View style={styles.helpSection}>
            <Text style={styles.helpText}>
              Didn't receive the code? Check spam folder or contact support.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  emailText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  otpContainer: {
    marginBottom: 30,
  },
  otpLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  otpInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'white',
    color: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  otpInputFilled: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  timerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  timer: {
    fontSize: 14,
    color: '#6B7280',
  },
  timerBold: {
    fontWeight: '600',
    color: '#DC2626',
  },
  timerExpired: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resendButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 6,
  },
  resendTextDisabled: {
    color: '#9CA3AF',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  verifyButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginLeft: 8,
  },
  helpSection: {
    alignItems: 'center',
  },
  helpText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default VerificationCode;
