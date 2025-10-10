import React, { useEffect } from 'react';
import { BackHandler, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../config/AuthContext';

export default function BackButtonHandler() {
  const router = useRouter();
  const { isAuthenticated, userType } = useAuth();

  useEffect(() => {
    const backAction = () => {
      // Get current route
      const currentRoute = router.canGoBack();
      
      if (currentRoute) {
        // If we can go back in the navigation stack, do so
        router.back();
        return true; // Prevent default behavior
      } else {
        // If we're at the root and authenticated, prevent exit
        if (isAuthenticated) {
          Alert.alert(
            'Exit App',
            'To exit the app, please use the logout button in the menu.',
            [
              {
                text: 'OK',
                style: 'default',
              }
            ]
          );
          return true; // Prevent default behavior
        }
        // If not authenticated, allow exit
        return false; // Allow default behavior (exit app)
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [router, isAuthenticated, userType]);

  return null; // This component doesn't render anything
}
