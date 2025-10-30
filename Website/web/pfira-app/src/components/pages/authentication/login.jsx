import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CiLock, CiUser } from 'react-icons/ci';
import { supabase } from '../../../config/supabase';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (!location.state?.error) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userType');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('userData');
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const checkUserInSupabaseTable = async (email, tableName) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      console.log(`Checking ${tableName} table for email: ${cleanEmail}`);

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('email', cleanEmail)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error(`Error checking ${tableName}:`, error);
        return { exists: false, error };
      }

      if (data) {
        console.log(`${tableName} user found:`, data);
        return {
          exists: true,
          data: data,
          docId: data.id
        };
      }

      return { exists: false };
    } catch (error) {
      console.error(`Error checking ${tableName}:`, error);
      return { exists: false, error };
    }
  };

  // Password verification utility for web
  const verifyPassword = (password, hashedPassword) => {
    if (!password || !hashedPassword) return false;
    // Simple verification for demo - use proper hashing in production
    const hashedInput = btoa(password + 'project_fira_salt_2024');
    return hashedInput === hashedPassword;
  };

  const checkUserInSupabaseTableByUserId = async (userId, tableName) => {
    try {
      console.log(`Checking ${tableName} table for user_id: ${userId}`);

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error(`Error checking ${tableName}:`, error);
        return { exists: false, error };
      }

      if (data) {
        console.log(`${tableName} user found:`, data);
        return {
          exists: true,
          data: data,
          docId: data.id
        };
      }

      return { exists: false };
    } catch (error) {
      console.error(`Error checking ${tableName}:`, error);
      return { exists: false, error };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const email = formData.username;
    const password = formData.password;

    console.log('🔍 Login attempt:', { email, password });

    try {
      console.log('🔐 Attempting Supabase Auth...');

      // Sign in with Supabase Auth first
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (authError) {
        console.error('❌ Supabase Auth error:', authError);
        throw authError;
      }

      const user = authData.user;
      console.log('✅ Supabase Auth successful:', user.id);

      // Check if this authenticated user exists in our custom tables
      console.log('🔍 Checking user tables for authenticated user...');

      // Check if user exists in station_users table (by user_id)
      const stationCheck = await checkUserInSupabaseTableByUserId(user.id, 'station_users');
      if (stationCheck.exists) {
        console.log('✅ Authenticated user found in station_users table');

        const userData = {
          ...stationCheck.data,
          docId: stationCheck.docId,
          userType: 'station'
        };

        sessionStorage.setItem('authToken', `station_${stationCheck.docId}`);
        sessionStorage.setItem('userType', 'station');
        sessionStorage.setItem('loginTime', Date.now().toString());
        sessionStorage.setItem('userData', JSON.stringify(userData));

        console.log('🎯 Navigating to station dashboard...');
        navigate('/station-dashboard');
        return;
      }

      // Check if user exists in responders table (by user_id)
      const responderCheck = await checkUserInSupabaseTableByUserId(user.id, 'responders');
      if (responderCheck.exists) {
        console.log('✅ Authenticated user found in responders table');

        const userData = {
          ...responderCheck.data,
          docId: responderCheck.docId,
          userType: 'responder'
        };

        sessionStorage.setItem('authToken', `responder_${responderCheck.docId}`);
        sessionStorage.setItem('userType', 'responder');
        sessionStorage.setItem('loginTime', Date.now().toString());
        sessionStorage.setItem('userData', JSON.stringify(userData));

        console.log('🎯 Navigating to responder dashboard...');
        navigate('/responder-dashboard');
        return;
      }

      // Check if user exists in admin_users table
      const adminCheck = await checkUserInSupabaseTable(email, 'admin_users');
      if (adminCheck.exists) {
        console.log('✅ Admin user found in admin_users table');

        const userData = {
          ...adminCheck.data,
          docId: adminCheck.docId,
          userType: 'admin'
        };

        localStorage.setItem('authToken', user.id);
        localStorage.setItem('userType', 'admin');
        localStorage.setItem('loginTime', Date.now().toString());
        localStorage.setItem('userData', JSON.stringify(userData));

        console.log('✅ Admin login successful, navigating to dashboard');
        navigate('/admin-dashboard');
        return;
      }

      // User authenticated but not found in any table
      console.log('❌ User authenticated but not found in authorized tables');
      setError('User not found in authorized tables. Please contact administrator to register your account.');

    } catch (error) {
      console.error('❌ Login error:', error);

      // Handle specific Supabase Auth errors
      switch (error.message) {
        case 'Invalid login credentials':
          setError('Invalid email or password.');
          break;
        case 'Email not confirmed':
          setError('Please confirm your email address before logging in.');
          break;
        case 'Too many requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        default:
          setError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left side - Login Form */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Logo and Welcome Section */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to access your dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <CiUser className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="email"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="pl-12 w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm hover:border-gray-400"
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <CiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-12 w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm hover:border-gray-400"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded cursor-pointer"
                  disabled={isLoading}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="font-semibold text-red-600 hover:text-red-700 hover:underline transition-colors"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-base font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
        <img 
          src="/loginpic.jpg" 
          alt="Project FIRA" 
          className="w-full h-full object-cover"
        />
        {/* Optional: Overlay with branding */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/70 flex items-center justify-center">
          <div className="text-white text-center p-12 w-full max-w-2xl">
            <h2 className="text-6xl font-bold mb-6 drop-shadow-2xl animate-fade-in-up">
              <span className="inline-block animate-slide-in-right">Project FIRA</span>
            </h2>
            <p className="text-2xl font-light drop-shadow-lg mb-8 animate-fade-in-up animation-delay-300">
              Your safety is our top priority
            </p>
            <div className="mt-6 flex items-center justify-center space-x-2 animate-fade-in-up animation-delay-500">
              <div className="h-1.5 w-24 bg-red-500 animate-grow-width"></div>
              <div className="h-1.5 w-12 bg-white/50 animate-pulse-slow"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
