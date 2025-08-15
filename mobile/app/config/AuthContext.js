import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing authentication on app start
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      const storedUserType = await AsyncStorage.getItem('userType');
      const storedUserData = await AsyncStorage.getItem('userData');

      if (authToken && storedUserType) {
        setIsAuthenticated(true);
        setUserType(storedUserType);
        if (storedUserData) {
          setUserData(JSON.parse(storedUserData));
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      let userType = null;
      let userData = null;

      // Check for specific credentials
      if (email === 'stations@gmail.com' && password === 'stations') {
        userType = 'station';
        userData = { email, userType };
      } else if (email === 'admin@gmail.com' && password === 'admin') {
        userType = 'admin';
        userData = { email, userType };
      } else if (email === 'responder@gmail.com' && password === 'responder') {
        userType = 'responder';
        userData = { email, userType };
      } else {
        // For other users, you can add more logic here
        throw new Error('Invalid credentials');
      }

      // Store authentication data
      await AsyncStorage.setItem('authToken', 'dummy-token');
      await AsyncStorage.setItem('userType', userType);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      await AsyncStorage.setItem('loginTime', Date.now().toString());

      setIsAuthenticated(true);
      setUserType(userType);
      setUserData(userData);

      return { success: true, userType };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear all stored data
      await AsyncStorage.multiRemove([
        'authToken',
        'userType',
        'userData',
        'loginTime'
      ]);

      setIsAuthenticated(false);
      setUserType(null);
      setUserData(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    isAuthenticated,
    userType,
    userData,
    isLoading,
    login,
    logout,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
