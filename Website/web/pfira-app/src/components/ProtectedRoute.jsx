import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredUserType = null }) => {
  const { currentUser, userType, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-700"></div>
      </div>
    );
  }

  // If user is not authenticated, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a specific user type is required and user doesn't match
  if (requiredUserType && userType !== requiredUserType) {
    // Redirect to appropriate dashboard based on user type
    if (userType === 'admin') {
      return <Navigate to="/admin-dashboard" replace />;
    } else if (userType === 'station') {
      return <Navigate to="/station-dashboard" replace />;
    } else {
      // If user type is unknown, redirect to login
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute; 