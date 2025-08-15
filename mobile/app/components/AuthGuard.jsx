import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../config/AuthContext';

export default function AuthGuard({ children }) {
  const { isAuthenticated, userType, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
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
    // Return null while redirecting
    return null;
  }

  return children;
}
