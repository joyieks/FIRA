import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CiLock, CiUser } from 'react-icons/ci';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');

  // Check for error messages from protected routes
  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
      // Clear the state to prevent showing the error again on refresh
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  // Only redirect if there's an error from protected routes
  // Don't auto-redirect logged-in users to prevent issues with landing page login
  
  // Clear any existing tokens when login page loads (for fresh login)
  useEffect(() => {
    // Only clear if user is coming from landing page (not from protected route error)
    if (!location.state?.error) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userType');
      localStorage.removeItem('loginTime');
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Check for admin credentials
    if (formData.username === 'admin' && formData.password === 'admin') {
      // Admin login successful
      localStorage.setItem('authToken', 'admin-token');
      localStorage.setItem('userType', 'admin');
      localStorage.setItem('loginTime', Date.now().toString());
      navigate('/admin-dashboard');
    } else if (formData.username === 'station' && formData.password === 'station') {
      // Station login successful
      localStorage.setItem('authToken', 'station-token');
      localStorage.setItem('userType', 'station');
      localStorage.setItem('loginTime', Date.now().toString());
      navigate('/station-dashboard');
    } else {
      // Invalid credentials
      setError('Invalid username or password');
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left Side - Login Form */}
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
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CiUser className="text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                  placeholder="Enter your username"
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
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button
                  onClick={() => navigate('/forgot-password')}
                  className="font-medium text-red-700 hover:text-red-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition"
              >
                Sign in
              </button>
            </div>
            <div>
              <button
                type="button"
                className="w-full flex justify-center items-center py-2 px-4 mt-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition"
                // onClick={handleGoogleSignIn} // Uncomment and implement this for real Google sign-in
              >
                {/* You can add a Google icon here if you want */}
                Sign in with Google
              </button>
            </div>
          </form>

          <div className="mt-4 text-center">
            <span className="text-gray-700">No account? </span>
            <button
              className="text-red-600 hover:underline font-medium"
              onClick={() => navigate('/register')}
            >
              Register here
            </button>
          </div>

        </div>
      </div>

      {/* Right Side - Red Background */}
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