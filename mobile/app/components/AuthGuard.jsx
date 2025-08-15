import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../config/AuthContext';

export default function AuthGuard({ children }) {
  const { isAuthenticated, userType, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('🔄 AuthGuard useEffect triggered:', { isAuthenticated, userType, isLoading });
    
    if (!isLoading && isAuthenticated) {
      console.log('🎯 AuthGuard: User is authenticated, redirecting to:', userType);
      
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
            console.log('⚠️ AuthGuard: Unknown userType:', userType);
            // If userType is not recognized, redirect to get-started
            router.replace('/get-started/getstarted');
        }
      }, 100); // Small delay to prevent glitching

      return () => clearTimeout(navigationTimeout);
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
