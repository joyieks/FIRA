import React, { useState } from 'react';
import { FiLock, FiEye, FiEyeOff, FiCheck, FiArrowLeft } from 'react-icons/fi';

const PasswordChangeFlow = () => {
  const [step, setStep] = useState(1); // 1: Change password, 2: OTP verification
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOtpChange = (e, index) => {
    const value = e.target.value;
    if (isNaN(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleSubmitPassword = (e) => {
    e.preventDefault();
    // Validate passwords
    if (formData.newPassword !== formData.confirmPassword) {
      alert("New passwords don't match!");
      return;
    }
    if (formData.newPassword.length < 8) {
      alert("Password must be at least 8 characters!");
      return;
    }
    
    // In a real app, you would send a request to your backend here
    // to initiate the password change and request OTP
    
    setStep(2); // Move to OTP verification step
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const enteredOtp = otp.join('');
    
    // In a real app, you would verify this OTP with your backend
    if (enteredOtp.length === 6) {
      alert('Password changed successfully!');
      // Reset form and go back to profile
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setOtp(['', '', '', '', '', '']);
      setStep(1);
    } else {
      alert('Please enter a complete 6-digit OTP');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 py-4 px-6 text-white">
          <div className="flex items-center">
            {step === 2 && (
              <button 
                onClick={() => setStep(1)}
                className="mr-4 p-1 rounded-full hover:bg-red-700"
              >
                <FiArrowLeft size={20} />
              </button>
            )}
            <h2 className="text-xl font-bold">
              {step === 1 ? 'Change Password' : 'Verify OTP'}
            </h2>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex border-b">
          <div className={`w-1/2 py-3 text-center font-medium ${step >= 1 ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>
            Change Password
          </div>
          <div className={`w-1/2 py-3 text-center font-medium ${step === 2 ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>
            Verify OTP
          </div>
        </div>

        {/* Step 1: Change Password Form */}
        {step === 1 && (
          <form onSubmit={handleSubmitPassword} className="p-6 space-y-6">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  id="currentPassword"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <FiEyeOff className="text-gray-500" /> : <FiEye className="text-gray-500" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <FiEyeOff className="text-gray-500" /> : <FiEye className="text-gray-500" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 8 characters long
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 pr-10"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FiEyeOff className="text-gray-500" /> : <FiEye className="text-gray-500" />}
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Continue to Verification
              </button>
            </div>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="p-6">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <FiLock className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mt-3 text-lg font-medium text-gray-900">Verify Your Identity</h3>
              <p className="mt-2 text-sm text-gray-500">
                We've sent a 6-digit verification code to your registered email/phone
              </p>
            </div>

            <div className="flex justify-center space-x-3 mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleOtpChange(e, index)}
                  className="w-12 h-12 border-2 border-gray-300 rounded-lg text-center text-xl focus:border-red-500 focus:ring-2 focus:ring-red-200"
                  pattern="[0-9]"
                  inputMode="numeric"
                />
              ))}
            </div>

            <div className="text-center text-sm text-gray-500 mb-6">
              Didn't receive code? <button type="button" className="text-red-600 hover:text-red-500">Resend</button>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Verify and Change Password
              </button>
            </div>
          </form>
        )}

        {/* Success Message (would appear after successful verification) */}
        {/* <div className="bg-green-50 border-l-4 border-green-400 p-4 m-6 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiCheck className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                Your password has been changed successfully!
              </p>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default PasswordChangeFlow;