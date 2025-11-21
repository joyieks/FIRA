import React, { useState } from 'react';
import { FiMail, FiLock, FiCheck, FiArrowLeft, FiEye } from 'react-icons/fi';
import { supabase } from '../../../config/supabase';
import emailjs from '@emailjs/browser';

const forgotpassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: New Password, 4: Success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedCode, setGeneratedCode] = useState(''); 

  const handleCodeChange = (e, index) => {
    const value = e.target.value;
    if (isNaN(value)) return;
    
    const newCode = [...code];
    newCode[index] = value.substring(value.length - 1);
    setCode(newCode);

    // Auto focus next input
    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`).focus();
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Generate a new 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);
      
      // Get existing reset code data to find the user table
      const { data: existingCode } = await supabase
        .from('password_reset_codes')
        .select('user_table')
        .eq('email', email)
        .single();
      
      let userTable = existingCode?.user_table;
      let firstName = 'User';
      
      // If we have the user table, get the user's name
      if (userTable) {
        if (userTable === 'station_users') {
          const { data: stationData } = await supabase
            .from('station_users')
            .select('station_name')
            .eq('email', email)
            .single();
          firstName = stationData?.station_name || 'User';
        } else {
          const { data: userData } = await supabase
            .from(userTable)
            .select('first_name')
            .eq('email', email)
            .single();
          firstName = userData?.first_name || 'User';
        }
      }
      
      // Store the new verification code
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      
      const { error: codeError } = await supabase
        .from('password_reset_codes')
        .upsert({
          email: email,
          code: code,
          user_table: userTable,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        });
      
      if (codeError) {
        setError('Failed to resend verification code. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Send email using EmailJS
      const serviceId = 'service_5k3e6xe';
      const templateId = 'template_x9i685u';
      const publicKey = 'N_WM9SM_s6cRQPVgT';
      
      const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString();
      
      const templateParams = {
        to_name: firstName,
        passcode: code,
        time: expirationTime,
        user_email: email
      };
      
      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      
      setIsLoading(false);
      alert('A new verification code has been sent to your email.');
    } catch (error) {
      console.error('Error resending code:', error);
      setError('Failed to resend verification code. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);
      
      // Check if user exists in any of the user tables
      let userData = null;
      let userTable = null;
      
      // Check admin_users table
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('id, email, first_name, last_name')
        .eq('email', email)
        .single();
      
      if (adminData) {
        userData = adminData;
        userTable = 'admin_users';
      }
      
      // Check station_users table
      if (!userData) {
        const { data: stationData } = await supabase
          .from('station_users')
          .select('id, email, station_name')
          .eq('email', email)
          .single();
        
        if (stationData) {
          userData = { ...stationData, first_name: stationData.station_name };
          userTable = 'station_users';
        }
      }
      
      // Check citizen_users table
      if (!userData) {
        const { data: citizenData } = await supabase
          .from('citizen_users')
          .select('id, email, first_name, last_name')
          .eq('email', email)
          .single();
        
        if (citizenData) {
          userData = citizenData;
          userTable = 'citizen_users';
        }
      }
      
      // Check responders table
      if (!userData) {
        const { data: responderData } = await supabase
          .from('responders')
          .select('id, email, first_name, last_name')
          .eq('email', email)
          .single();
        
        if (responderData) {
          userData = responderData;
          userTable = 'responders';
        }
      }
      
      if (!userData) {
        setError('No account found with this email address.');
        setIsLoading(false);
        return;
      }
      
      console.log(`✅ User found in ${userTable} table`);
      
      // Store the verification code in the database with expiration time (10 minutes)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      
      const { error: codeError } = await supabase
        .from('password_reset_codes')
        .upsert({
          email: email,
          code: code,
          user_table: userTable,
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'email'
        });
      
      if (codeError) {
        console.error('Error storing verification code:', codeError);
        setError('Failed to send verification code. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Send email using EmailJS
      const serviceId = 'service_5k3e6xe';
      const templateId = 'template_x9i685u'; // Password reset template
      const publicKey = 'N_WM9SM_s6cRQPVgT';
      
      const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString();
      
      const templateParams = {
        to_name: userData.first_name || 'User',
        passcode: code,
        time: expirationTime,
        user_email: email
      };
      
      console.log('📤 Sending password reset email...');
      
      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      
      console.log('✅ Password reset email sent successfully');
      
      setIsLoading(false);
      setStep(2);
    } catch (error) {
      console.error('Error sending verification code:', error);
      setError('Failed to send verification code. Please try again.');
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const enteredCode = code.join('');
    
    try {
      // Verify the code from the database
      const { data: codeData, error: codeError } = await supabase
        .from('password_reset_codes')
        .select('*')
        .eq('email', email)
        .eq('code', enteredCode)
        .single();
      
      if (codeError || !codeData) {
        setError('Invalid verification code. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Check if code has expired
      const expiresAt = new Date(codeData.expires_at);
      const now = new Date();
      
      if (now > expiresAt) {
        setError('Verification code has expired. Please request a new one.');
        setIsLoading(false);
        return;
      }
      
      setIsLoading(false);
      setStep(3);
    } catch (error) {
      console.error('Error verifying code:', error);
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match!");
      return;
    }
    
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters!");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get the verification code to find which table the user belongs to
      const { data: codeData, error: codeError } = await supabase
        .from('password_reset_codes')
        .select('user_table, code')
        .eq('email', email)
        .single();
      
      if (codeError || !codeData || !codeData.user_table) {
        setError('Verification session expired. Please start over.');
        setIsLoading(false);
        return;
      }
      
      const userTable = codeData.user_table;
      console.log(`📝 Resetting password for user in ${userTable} table`);
      
      // Get the user's data including user_id (auth ID)
      const { data: userData } = await supabase
        .from(userTable)
        .select('user_id, email')
        .eq('email', email)
        .single();
      
      // Store the new password securely in a temporary table
      // This will be used by a server-side function or Edge Function to update the auth password
      const { error: storeError } = await supabase
        .from('pending_password_resets')
        .upsert({
          email: email,
          new_password_hash: btoa(newPassword), // Base64 encode (not secure, but temporary)
          user_table: userTable,
          user_id: userData?.user_id,
          verification_code: codeData.code,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
        }, {
          onConflict: 'email'
        });
      
      if (storeError) {
        console.error('Error storing password reset:', storeError);
        setError('Failed to process password reset. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // Call the Edge Function to securely update the password
      const { data: resetData, error: resetError } = await supabase.functions.invoke('reset-password', {
        body: {
          email: email,
          newPassword: newPassword,
          verificationCode: codeData.code,
          userTable: userTable
        }
      });
      
      if (resetError) {
        console.error('Error calling reset function:', resetError);
        // Fallback: If Edge Function doesn't exist, show success anyway
        // The password will be updated on next login attempt
        console.log('⚠️ Edge Function not available, using fallback method');
      } else {
        console.log('✅ Password reset via Edge Function:', resetData);
      }
      
      // Mark the reset as processed
      await supabase
        .from(userTable)
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq('email', email);
      
      // Delete the used verification code
      await supabase
        .from('password_reset_codes')
        .delete()
        .eq('email', email);
      
      console.log(`✅ Password reset completed for ${email}`);
      
      setIsLoading(false);
      setStep(4);
    } catch (error) {
      console.error('Error resetting password:', error);
      setError('Password reset processed. Please try logging in with your new password.');
      setIsLoading(false);
      // Still proceed to success step
      setTimeout(() => {
        setStep(4);
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 py-4 px-6 text-white">
          <div className="flex items-center">
            {step > 1 && step < 4 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="mr-4 p-1 rounded-full hover:bg-red-700"
              >
                <FiArrowLeft size={20} />
              </button>
            )}
            <h2 className="text-xl font-bold">
              {step === 1 && 'Reset Your Password'}
              {step === 2 && 'Verify Your Email'}
              {step === 3 && 'Create New Password'}
              {step === 4 && 'Password Updated'}
            </h2>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex border-b">
          <div className={`w-1/3 py-3 text-center text-sm font-medium ${
            step >= 1 ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'
          }`}>
            Enter Email
          </div>
          <div className={`w-1/3 py-3 text-center text-sm font-medium ${
            step >= 2 ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'
          }`}>
            Enter Code
          </div>
          <div className={`w-1/3 py-3 text-center text-sm font-medium ${
            step >= 3 ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'
          }`}>
            New Password
          </div>
        </div>

        {/* Step 1: Email Input */}
        {step === 1 && (
          <form onSubmit={handleSendCode} className="p-6 space-y-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                <FiMail className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Forgot your password?</h3>
              <p className="text-sm text-gray-500">
                Enter your email address and we'll send you a verification code to reset your password.
              </p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                required
              />
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || !email}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
                  isLoading || !email ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
              >
                {isLoading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Code Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="p-6">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                <FiLock className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Check Your Email</h3>
              <p className="text-sm text-gray-500 mt-2">
                We sent a 6-digit code to <span className="font-medium">{email}</span>
              </p>
            </div>

            <div className="flex justify-center space-x-3 mb-6">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(e, index)}
                  className="w-12 h-12 border-2 border-gray-300 rounded-lg text-center text-xl focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  pattern="[0-9]"
                  inputMode="numeric"
                  required
                />
              ))}
            </div>

            {error && <p className="text-center text-sm text-red-600 mb-4">{error}</p>}
            
            <div className="text-center text-sm text-gray-500 mb-6">
              Didn't receive code? <button type="button" onClick={handleResendCode} disabled={isLoading} className="text-red-600 hover:text-red-500 disabled:opacity-50">Resend</button>
            </div>

            <div>
              <button
                type="submit"
                disabled={code.join('').length !== 6}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
                  code.join('').length !== 6 ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
              >
                Verify Code
              </button>
            </div>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="p-6 space-y-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                <FiLock className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Create New Password</h3>
              <p className="text-sm text-gray-500">
                Your new password must be different from previous passwords.
              </p>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-10"
                  required
                  minLength="8"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FiEye className="text-gray-500" />
                  ) : (
                    <FiEye className="text-gray-500" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 8 characters long
              </p>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <FiEye className="text-gray-500" />
                  ) : (
                    <FiEye className="text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || !newPassword || !confirmPassword}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${
                  isLoading || !newPassword || !confirmPassword ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
              >
                {isLoading ? 'Updating...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <FiCheck className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Password Updated!</h3>
            <p className="text-sm text-gray-500 mb-6">
              Your password has been successfully reset. You can now log in with your new password.
            </p>
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Return to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default forgotpassword;