import React, { useState } from 'react';
import { FiMail, FiLock, FiCheck, FiArrowLeft, FiEye } from 'react-icons/fi';

const forgotpassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: New Password, 4: Success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // This would come from your backend in a real app
  // For testing purposes, we'll show the code in an alert
  const [generatedCode] = useState('123456'); 

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

  const handleSendCode = (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call to send code
    setTimeout(() => {
      setIsLoading(false);
      setStep(2);
      alert(`A verification code has been sent to ${email}\n\nFor testing purposes, the code is: ${generatedCode}`);
    }, 1500);
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    const enteredCode = code.join('');
    
    if (enteredCode === generatedCode) {
      setStep(3);
    } else {
      alert('Invalid verification code. Please try again.');
    }
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    
    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters!");
      return;
    }
    
    // Simulate API call to reset password
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep(4);
    }, 1500);
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

            <div className="text-center text-sm text-gray-500 mb-6">
              Didn't receive code? <button type="button" className="text-red-600 hover:text-red-500">Resend</button>
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