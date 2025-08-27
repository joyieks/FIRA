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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const email = formData.username;
    const password = formData.password;

    console.log('🔍 Login attempt:', { email, password });

    // Hardcoded authentication for test accounts
    if (email === 'admin@gmail.com' && password === 'admin123') {
      console.log('✅ Hardcoded admin login detected');
      // Admin hardcoded login
      const userData = {
        email: 'admin@gmail.com',
        firstName: 'Admin',
        lastName: 'User',
        userType: 'admin'
      };
      
      localStorage.setItem('authToken', 'admin-hardcoded-token');
      localStorage.setItem('userType', 'admin');
      localStorage.setItem('loginTime', Date.now().toString());
      localStorage.setItem('userData', JSON.stringify(userData));
      
      console.log('✅ Admin login successful, navigating to dashboard');
      navigate('/admin-dashboard');
      return;
    }

    try {
      console.log('🔄 Starting authentication process...');
      
      // First, check if user exists in station_users table (no Auth required)
      console.log('🔍 Checking station_users table first...');
      const stationCheck = await checkUserInSupabaseTable(email, 'station_users');
      console.log('📊 Station check result:', stationCheck);
      
      if (stationCheck.exists) {
        console.log('✅ Station user found in station_users table, user data:', stationCheck.data);
        
        // For stations, we'll use a simple token-based auth since they don't have Auth accounts
        const userData = {
          ...stationCheck.data,
          docId: stationCheck.docId,
          userType: 'station'
        };
        
        console.log('🚀 Setting station user data:', userData);
        localStorage.setItem('authToken', `station_${stationCheck.docId}`);
        localStorage.setItem('userType', 'station');
        localStorage.setItem('loginTime', Date.now().toString());
        localStorage.setItem('userData', JSON.stringify(userData));
        
        console.log('🎯 Navigating to station dashboard...');
        navigate('/station-dashboard');
        return;
      }

      // If not a station, try Supabase Auth for admin users
      console.log('🔄 Attempting Supabase authentication for admin...');
      
      // Sign in with Supabase Auth
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

      // Check if user exists in admin_users table
      console.log('🔍 Checking admin_users table...');
      const adminCheck = await checkUserInSupabaseTable(email, 'admin_users');
      console.log('📊 Admin check result:', adminCheck);
      
      if (adminCheck.exists) {
        console.log('✅ Admin user found in admin_users table');
        // User is an admin
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

      // User authenticated but not found in either table
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
    <div className="flex h-screen">
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Welcome Back</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CiUser className="text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="email"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CiLock className="text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700 outline-none transition"
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
                  className="h-4 w-4 text-red-700 focus:ring-red-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="font-medium text-red-700 hover:text-red-700 hover:underline"
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
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Test Account:</p>
            <p className="mt-2">
              <strong>Admin:</strong> admin@gmail.com / admin123<br />
              <strong>Stations:</strong> Must be registered through Admin Panel<br />
              <strong>Note:</strong> Using Supabase Authentication
            </p>
          </div>
        </div>
      </div>

      <div className="hidden md:flex md:w-1/2 bg-red-700 items-center justify-center">
        <div className="text-white text-center p-8 max-w-md">
          <h2 className="text-4xl font-bold mb-4">Project FIRA</h2>
          <p className="text-xl mb-8">Your safety is our top priority!!!</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
