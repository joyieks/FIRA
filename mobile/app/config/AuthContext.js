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
      } else {
        setIsAuthenticated(false);
        setUserType(null);
        setUserData(null);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUserType(null);
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      let userType = null;
      let userData = null;

      // Check for specific hardcoded credentials (station and responder only)
      if (email === 'stations@gmail.com' && password === 'stations') {
        userType = 'station';
        userData = { email, userType };
      } else if (email === 'responder@gmail.com' && password === 'responder') {
        userType = 'responder';
        userData = { email, userType };
      } else {
        // For admin and citizen users, they'll be authenticated through Supabase Auth
        // and handled in the login component
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
      throw error;
    }
  };

  // Add a method to handle admin login
  const loginAdmin = async (userData) => {
    try {
      const userType = 'admin';
      const authData = { ...userData, userType };

      // Store authentication data first
      await AsyncStorage.setItem('authToken', 'admin-token');
      await AsyncStorage.setItem('userType', userType);
      await AsyncStorage.setItem('userData', JSON.stringify(authData));
      await AsyncStorage.setItem('loginTime', Date.now().toString());

      // Update state in a single batch to prevent multiple re-renders
      setIsAuthenticated(true);
      setUserType(userType);
      setUserData(authData);

      return { success: true, userType };
    } catch (error) {
      throw error;
    }
  };

  // Add a method to handle citizen login
  const loginCitizen = async (userData) => {
    try {
      const userType = 'citizen';
      const authData = { ...userData, userType };

      // Store authentication data first
      await AsyncStorage.setItem('authToken', 'citizen-token');
      await AsyncStorage.setItem('userType', userType);
      await AsyncStorage.setItem('userData', JSON.stringify(authData));
      await AsyncStorage.setItem('loginTime', Date.now().toString());

      // Update state in a single batch to prevent multiple re-renders
      setIsAuthenticated(true);
      setUserType(userType);
      setUserData(authData);

      return { success: true, userType };
    } catch (error) {
      throw error;
    }
  };

  // Add a method to handle station login
  const loginStation = async (userData) => {
    try {
      const userType = 'station';
      const authData = { ...userData, userType };

      // Store authentication data first
      await AsyncStorage.setItem('authToken', 'station-token');
      await AsyncStorage.setItem('userType', userType);
      await AsyncStorage.setItem('userData', JSON.stringify(authData));
      await AsyncStorage.setItem('loginTime', Date.now().toString());

      // Update state in a single batch to prevent multiple re-renders
      setIsAuthenticated(true);
      setUserType(userType);
      setUserData(authData);

      return { success: true, userType };
    } catch (error) {
      throw error;
    }
  };

  // Add a method to handle responder login
  const loginResponder = async (userData) => {
    try {
      const userType = 'responder';
      const authData = { ...userData, userType };

      // Store authentication data first
      await AsyncStorage.setItem('authToken', 'responder-token');
      await AsyncStorage.setItem('userType', userType);
      await AsyncStorage.setItem('userData', JSON.stringify(authData));
      await AsyncStorage.setItem('loginTime', Date.now().toString());

      // Update state in a single batch to prevent multiple re-renders
      setIsAuthenticated(true);
      setUserType(userType);
      setUserData(authData);

      return { success: true, userType };
    } catch (error) {
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

      // Clear authentication state
      setIsAuthenticated(false);
      setUserType(null);
      setUserData(null);
    } catch (error) {
      throw error;
    }
  };

  const resetLoading = () => {
    setIsLoading(false);
  };

  const value = {
    isAuthenticated,
    userType,
    userData,
    isLoading,
    login,
    loginAdmin,
    loginCitizen,
    loginStation,
    loginResponder,
    logout,
    checkAuthStatus,
    resetLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
