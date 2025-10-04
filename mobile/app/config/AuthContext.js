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
      console.log('🔍 Checking auth status...');
      const authToken = await AsyncStorage.getItem('authToken');
      const storedUserType = await AsyncStorage.getItem('userType');
      const storedUserData = await AsyncStorage.getItem('userData');

      console.log('📱 Stored auth data:', { authToken: !!authToken, storedUserType, storedUserData: !!storedUserData });

      if (authToken && storedUserType) {
        console.log('✅ Valid auth data found, setting authenticated state');
        setIsAuthenticated(true);
        setUserType(storedUserType);
        if (storedUserData) {
          setUserData(JSON.parse(storedUserData));
        }
      } else {
        console.log('❌ No valid auth data found, setting unauthenticated state');
        setIsAuthenticated(false);
        setUserType(null);
        setUserData(null);
      }
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      setIsAuthenticated(false);
      setUserType(null);
      setUserData(null);
    } finally {
      console.log('🏁 Auth status check completed, setting isLoading to false');
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      let userType = null;
      let userData = null;

      // Check for specific hardcoded credentials (station only)
      if (email === 'stations@gmail.com' && password === 'stations') {
        userType = 'station';
        userData = { email, userType };
      } else {
        // For admin, citizen, and responder users, they'll be authenticated through database lookup
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
      console.error('Login error:', error);
      throw error;
    }
  };

  // Add a method to handle admin login
  const loginAdmin = async (userData) => {
    try {
      const userType = 'admin';
      const authData = { ...userData, userType };

      console.log('🔐 loginAdmin called with:', { userType, userData });

      // Store authentication data first
      await AsyncStorage.setItem('authToken', 'admin-token');
      await AsyncStorage.setItem('userType', userType);
      await AsyncStorage.setItem('userData', JSON.stringify(authData));
      await AsyncStorage.setItem('loginTime', Date.now().toString());

      // Update state in a single batch to prevent multiple re-renders
      setIsAuthenticated(true);
      setUserType(userType);
      setUserData(authData);

      console.log('✅ Admin authentication set:', { isAuthenticated: true, userType, userData: authData });

      return { success: true, userType };
    } catch (error) {
      console.error('❌ Admin login error:', error);
      throw error;
    }
  };

  // Add a method to handle citizen login
  const loginCitizen = async (userData) => {
    try {
      const userType = 'citizen';
      const authData = { ...userData, userType };

      console.log('🔐 loginCitizen called with:', { userType, userData });

      // Store authentication data first
      await AsyncStorage.setItem('authToken', 'citizen-token');
      await AsyncStorage.setItem('userType', userType);
      await AsyncStorage.setItem('userData', JSON.stringify(authData));
      await AsyncStorage.setItem('loginTime', Date.now().toString());

      // Update state in a single batch to prevent multiple re-renders
      setIsAuthenticated(true);
      setUserType(userType);
      setUserData(authData);

      console.log('✅ Citizen authentication set:', { isAuthenticated: true, userType, userData: authData });

      return { success: true, userType };
    } catch (error) {
      console.error('❌ Citizen login error:', error);
      throw error;
    }
  };

  // Add a method to handle station login
  const loginStation = async (userData) => {
    try {
      const userType = 'station';
      const authData = { ...userData, userType };

      console.log('🔐 loginStation called with:', { userType, userData });

      // Store authentication data first
      await AsyncStorage.setItem('authToken', 'station-token');
      await AsyncStorage.setItem('userType', userType);
      await AsyncStorage.setItem('userData', JSON.stringify(authData));
      await AsyncStorage.setItem('loginTime', Date.now().toString());

      // Update state in a single batch to prevent multiple re-renders
      setIsAuthenticated(true);
      setUserType(userType);
      setUserData(authData);

      console.log('✅ Station authentication set:', { isAuthenticated: true, userType, userData: authData });

      return { success: true, userType };
    } catch (error) {
      console.error('❌ Station login error:', error);
      throw error;
    }
  };

  // Add a method to handle responder login
  const loginResponder = async (userData) => {
    try {
      const userType = 'responder';
      const authData = { ...userData, userType };

      console.log('🔐 loginResponder called with:', { userType, userData });

      // Store authentication data first
      await AsyncStorage.setItem('authToken', 'responder-token');
      await AsyncStorage.setItem('userType', userType);
      await AsyncStorage.setItem('userData', JSON.stringify(authData));
      await AsyncStorage.setItem('loginTime', Date.now().toString());

      // Update state in a single batch to prevent multiple re-renders
      setIsAuthenticated(true);
      setUserType(userType);
      setUserData(authData);

      console.log('✅ Responder authentication set:', { isAuthenticated: true, userType, userData: authData });

      return { success: true, userType };
    } catch (error) {
      console.error('❌ Responder login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out user...');
      
      // Clear all stored data
      await AsyncStorage.multiRemove([
        'authToken',
        'userType',
        'userData',
        'loginTime'
      ]);

      console.log('🗑️ AsyncStorage cleared');

      // Clear authentication state
      setIsAuthenticated(false);
      setUserType(null);
      setUserData(null);
      
      console.log('✅ Logout completed successfully, state cleared:', { 
        isAuthenticated: false, 
        userType: null, 
        userData: null 
      });
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  };

  const resetLoading = () => {
    console.log('🔄 Manually resetting loading state');
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
