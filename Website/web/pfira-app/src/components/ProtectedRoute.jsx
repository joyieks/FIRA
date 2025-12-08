import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem('authToken');
      const userType = localStorage.getItem('userType');
      const loginTime = localStorage.getItem('loginTime');

      console.log('🔒 RBAC Check:', { authToken: !!authToken, userType, allowedRoles, path: location.pathname });

      // Check if user is authenticated
      if (!authToken || !userType || !loginTime) {
        console.log('❌ RBAC: No authentication found');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userType');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('userData');
        navigate('/login', { 
          state: { 
            error: 'Please log in to access this page',
            from: location.pathname 
          },
          replace: true
        });
        return;
      }

      // Check if login time is within 24 hours (session timeout)
      const loginTimestamp = parseInt(loginTime);
      const currentTime = Date.now();
      const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (currentTime - loginTimestamp > sessionTimeout) {
        console.log('❌ RBAC: Session expired');
        localStorage.removeItem('authToken');
        localStorage.removeItem('userType');
        localStorage.removeItem('loginTime');
        localStorage.removeItem('userData');
        navigate('/login', { 
          state: { 
            error: 'Session expired. Please log in again.',
            from: location.pathname 
          },
          replace: true
        });
        return;
      }

      // Check if user role is allowed for this route
      if (allowedRoles.length > 0 && !allowedRoles.includes(userType)) {
        console.log(`❌ RBAC: Access Denied - User type "${userType}" not in allowed roles:`, allowedRoles);
        navigate('/login', { 
          state: { 
            error: `Access Denied: You are logged in as "${userType}". This page requires "${allowedRoles.join(' or ')}" role. Please log in with the correct account.`,
            from: location.pathname 
          },
          replace: true
        });
        return;
      }

      // Authentication and authorization successful
      console.log(`✅ RBAC: Access Granted - User "${userType}" authorized`);
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