import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredUserType = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem('authToken');
      const userType = localStorage.getItem('userType');
      const loginTime = localStorage.getItem('loginTime');

      // Check if user is authenticated
      if (!authToken || !userType || !loginTime) {
        // No authentication data found
        localStorage.clear(); // Clear any remaining data
        navigate('/login', { 
          state: { 
            error: 'Please log in to access this page',
            from: location.pathname 
          } 
        });
        return;
      }

      // Check if login time is within 24 hours (optional session timeout)
      const loginTimestamp = parseInt(loginTime);
      const currentTime = Date.now();
      const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (currentTime - loginTimestamp > sessionTimeout) {
        // Session expired
        localStorage.clear();
        navigate('/login', { 
          state: { 
            error: 'Session expired. Please log in again.',
            from: location.pathname 
          } 
        });
        return;
      }

      // Check if user type matches required type (if specified)
      if (requiredUserType && userType !== requiredUserType) {
        // User type doesn't match required type
        localStorage.clear();
        navigate('/login', { 
          state: { 
            error: 'Access denied. You do not have permission to access this page.',
            from: location.pathname 
          } 
        });
        return;
      }

      // Authentication successful
      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();

    // Listen for storage changes (logout from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'authToken' && !e.newValue) {
        // Auth token was removed (logout)
        navigate('/login', { 
          state: { 
            error: 'You have been logged out.',
            from: location.pathname 
          } 
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate, location, requiredUserType]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show error page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You need to be logged in to access this page.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute; 