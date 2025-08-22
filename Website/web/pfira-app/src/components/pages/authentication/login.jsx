import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CiLock, CiUser } from 'react-icons/ci';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../../config/firebase';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (!location.state?.error) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userType');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('userData');
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const checkUserInCollection = async (email, collectionName) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      console.log(`Checking ${collectionName} collection for email: ${cleanEmail}`);
      
      // First, let's get all documents in the collection to see what's there
      const allDocs = await getDocs(collection(db, collectionName));
      console.log(`All documents in ${collectionName}:`, allDocs.docs.map(doc => ({ id: doc.id, data: doc.data() })));
      
      // Now try the exact query
      const q = query(collection(db, collectionName), where('email', '==', cleanEmail));
      const querySnapshot = await getDocs(q);
      
      console.log(`${collectionName} query result:`, querySnapshot.size, 'documents found');
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        console.log(`${collectionName} user found:`, userDoc.data());
        return {
          exists: true,
          data: userDoc.data(),
          docId: userDoc.id
        };
      }
      
      // If exact match fails, try case-insensitive search by checking all documents
      const matchingDoc = allDocs.docs.find(doc => {
        const docEmail = doc.data().email;
        return docEmail && docEmail.toLowerCase() === cleanEmail;
      });
      
      if (matchingDoc) {
        console.log(`${collectionName} user found via case-insensitive search:`, matchingDoc.data());
        return {
          exists: true,
          data: matchingDoc.data(),
          docId: matchingDoc.id
        };
      }
      
      return { exists: false };
    } catch (error) {
      console.error(`Error checking ${collectionName}:`, error);
      return { exists: false, error };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const email = formData.username;
    const password = formData.password;

    console.log('🔍 Login attempt:', { email, password });

    // Hardcoded authentication for test accounts
    if (email === 'admin@gmail.com' && password === 'admin123') {
      console.log('✅ Hardcoded admin login detected');
      // Admin hardcoded login
      const userData = {
        email: 'admin@gmail.com',
        firstName: 'Admin',
        lastName: 'User',
        userType: 'admin'
      };
      
      localStorage.setItem('authToken', 'admin-hardcoded-token');
      localStorage.setItem('userType', 'admin');
      localStorage.setItem('loginTime', Date.now().toString());
      localStorage.setItem('userData', JSON.stringify(userData));
      
      console.log('✅ Admin login successful, navigating to dashboard');
      navigate('/admin-dashboard');
      return;
    } else {
      console.log('❌ Hardcoded admin credentials do not match');
    }

    try {
      console.log('🔄 Attempting Firebase authentication...');
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('✅ Firebase Auth successful:', user.uid);

      // Check if user exists in adminUser collection
      console.log('🔍 Checking adminUser collection...');
      const adminCheck = await checkUserInCollection(email, 'adminUser');
      console.log('📊 Admin check result:', adminCheck);
      
      if (adminCheck.exists) {
        console.log('✅ Admin user found in adminUser collection');
        // User is an admin
        const userData = {
          ...adminCheck.data,
          docId: adminCheck.docId,
          userType: 'admin'
        };
        
        localStorage.setItem('authToken', user.uid);
        localStorage.setItem('userType', 'admin');
        localStorage.setItem('loginTime', Date.now().toString());
        localStorage.setItem('userData', JSON.stringify(userData));
        
        console.log('✅ Admin login successful, navigating to dashboard');
        navigate('/admin-dashboard');
        return;
      }

      // Check if user exists in stationUsers collection
      console.log('🔍 Checking stationUsers collection...');
      const stationCheck = await checkUserInCollection(email, 'stationUsers');
      console.log('📊 Station check result:', stationCheck);
      
      if (stationCheck.exists) {
        console.log('✅ Station user found, user data:', stationCheck.data);
        // User is a station user
        const userData = {
          ...stationCheck.data,
          docId: stationCheck.docId,
          userType: 'station'
        };
        
        console.log('🚀 Setting station user data:', userData);
        localStorage.setItem('authToken', user.uid);
        localStorage.setItem('userType', 'station');
        localStorage.setItem('loginTime', Date.now().toString());
        localStorage.setItem('userData', JSON.stringify(userData));
        
        console.log('🎯 Navigating to station dashboard...');
        navigate('/station-dashboard');
        return;
      }

      // User authenticated but not found in either collection
      console.log('❌ User authenticated but not found in authorized collections');
      setError('User not found in authorized collections. Please contact administrator.');
      
    } catch (error) {
      console.error('❌ Login error:', error);
      
      // Handle specific Firebase Auth errors
      switch (error.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address.');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address.');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        default:
          setError('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Welcome Back</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CiUser className="text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="email"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CiLock className="text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700 outline-none transition"
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-red-700 focus:ring-red-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="font-medium text-red-700 hover:text-red-700 hover:underline"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Test Account:</p>
            <p className="mt-2">
              <strong>Admin:</strong> admin@gmail.com / admin123<br />
              <strong>Stations:</strong> Must be registered through Admin Panel
            </p>
          </div>
        </div>
      </div>

      <div className="hidden md:flex md:w-1/2 bg-red-700 items-center justify-center">
        <div className="text-white text-center p-8 max-w-md">
          <h2 className="text-4xl font-bold mb-4">Project FIRA</h2>
          <p className="text-xl mb-8">Your safety is our top priority!!!</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
