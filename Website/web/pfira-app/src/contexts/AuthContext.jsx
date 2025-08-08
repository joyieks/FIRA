import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sign in function
  const signIn = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Check if user exists in adminUser collection
      const adminDoc = await getDoc(doc(db, 'adminUser', user.uid));
      if (adminDoc.exists()) {
        setUserType('admin');
        return { success: true, userType: 'admin', userData: adminDoc.data() };
      }
      
      // Check if user exists in stationUsers collection
      const stationDoc = await getDoc(doc(db, 'stationUsers', user.uid));
      if (stationDoc.exists()) {
        setUserType('station');
        return { success: true, userType: 'station', userData: stationDoc.data() };
      }
      
      // If user exists in Auth but not in either collection, sign them out
      await signOut(auth);
      throw new Error('User not found in authorized collections');
      
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  // Sign out function
  const logout = async () => {
    try {
      await signOut(auth);
      setUserType(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Create user function (for registration)
  const signUp = async (email, password, userData, userType) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Store user data in appropriate collection
      const collectionName = userType === 'admin' ? 'adminUser' : 'stationUsers';
      await setDoc(doc(db, collectionName, user.uid), {
        ...userData,
        email: user.email,
        createdAt: new Date().toISOString()
      });
      
      return { success: true, user };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Check user type from Firestore
        try {
          const adminDoc = await getDoc(doc(db, 'adminUser', user.uid));
          if (adminDoc.exists()) {
            setUserType('admin');
          } else {
            const stationDoc = await getDoc(doc(db, 'stationUsers', user.uid));
            if (stationDoc.exists()) {
              setUserType('station');
            } else {
              // User exists in Auth but not in collections, sign them out
              await signOut(auth);
              setUserType(null);
            }
          }
        } catch (error) {
          console.error('Error checking user type:', error);
          setUserType(null);
        }
      } else {
        setCurrentUser(null);
        setUserType(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userType,
    signIn,
    signUp,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 