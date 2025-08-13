import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../../../config/firebase';

const Settings = () => {
  const [locationOn, setLocationOn] = useState(true);
  const [pushOn, setPushOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);

  const handleLogout = async () => {
    try {
      // Sign out from Firebase Auth
      await signOut(auth);
      
      // Clear all authentication data
      localStorage.removeItem('authToken');
      localStorage.removeItem('userType');
      localStorage.removeItem('loginTime');
      localStorage.removeItem('adminNotifications');
      localStorage.removeItem('adminUser');
      localStorage.removeItem('adminAuth');
      localStorage.removeItem('userData');
      
      alert('Log out successfully!');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error during logout. Please try again.');
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen flex flex-col">
      <div className="bg-white p-8 rounded-xl shadow-md max-w-lg w-full self-start">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin Settings</h1>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Location / GPS</span>
            <button
              onClick={() => setLocationOn(v => !v)}
              className={`px-4 py-1 rounded-lg font-medium ${locationOn ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}
            >
              {locationOn ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Push Notifications</span>
            <button
              onClick={() => setPushOn(v => !v)}
              className={`px-4 py-1 rounded-lg font-medium ${pushOn ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}
            >
              {pushOn ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Sounds</span>
            <button
              onClick={() => setSoundOn(v => !v)}
              className={`px-4 py-1 rounded-lg font-medium ${soundOn ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}
            >
              {soundOn ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1" />
      <div className="max-w-lg w-full self-start">
        <button
          onClick={handleLogout}
          className="w-full mt-8 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Log out
        </button>
      </div>
    </div>
  );
};

export default Settings;
