import React, { useState } from 'react';
import { setupAdminUser, setupStationUser } from '../utils/setupUsers';

const SetupUsers = () => {
  const [adminUID, setAdminUID] = useState('');
  const [stationUID, setStationUID] = useState('');
  const [message, setMessage] = useState('');

  const handleSetupAdmin = async () => {
    try {
      const success = await setupAdminUser();
      if (success) {
        setMessage('Admin user set up successfully!');
      } else {
        setMessage('Failed to set up admin user');
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleSetupStation = async () => {
    try {
      const success = await setupStationUser();
      if (success) {
        setMessage('Station user set up successfully!');
      } else {
        setMessage('Failed to set up station user');
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-center">Setup Users</h1>
        
        <div className="space-y-4">
          <div>
            <button
              onClick={handleSetupAdmin}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition"
            >
              Setup Admin User (admin@gmail.com)
            </button>
          </div>

          <div>
            <button
              onClick={handleSetupStation}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition"
            >
              Setup Station User (stations@gmail.com)
            </button>
          </div>

          {message && (
            <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded">
              {message}
            </div>
          )}
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click the buttons above to set up both users in Firestore</li>
            <li>After setup, go to the login page and test the authentication</li>
            <li>Once everything works, you can remove this setup component</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default SetupUsers; 