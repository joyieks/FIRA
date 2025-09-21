import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../config/AuthContext';

export default function AuthGuard({ children }) {
  const { isAuthenticated, userType, isLoading, resetLoading } = useAuth();
  const router = useRouter();

  // Add a safety timeout to prevent infinite loading
  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        resetLoading();
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(loadingTimeout);
  }, [isLoading, resetLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // Add a small delay to ensure smooth navigation and prevent glitching
        const navigationTimeout = setTimeout(() => {
          // Redirect authenticated users to their appropriate screen
          switch (userType) {
            case 'admin':
              router.replace('/Screens/AdminScreen');
              break;
            case 'station':
              router.replace('/Screens/StationScreen');
              break;
            case 'responder':
              router.replace('/Screens/RespondersScreen');
              break;
            case 'citizen':
              router.replace('/Screens/CitizenScreen');
              break;
            default:
              // If userType is not recognized, redirect to get-started
              router.replace('/get-started/getstarted');
          }
        }, 100); // Small delay to prevent glitching

        return () => clearTimeout(navigationTimeout);
      } else {
        // For unauthenticated users, just render the children (login screen)
        // No need to redirect as they should already be on the login screen
      }
    }
  }, [isAuthenticated, userType, isLoading, router]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#ff512f" />
      </View>
    );
  }

  if (isAuthenticated) {
    // Return null while redirecting authenticated users
    return null;
  }

  // For unauthenticated users, show the login screen
  return children;
}
