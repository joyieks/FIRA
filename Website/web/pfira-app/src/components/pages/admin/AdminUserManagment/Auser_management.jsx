import React, { useState, useEffect } from 'react';
import { FiUsers, FiHome, FiUserCheck, FiUserX, FiEdit2, FiTrash2, FiSearch, FiChevronDown, FiEye, FiFileText, FiX, FiPlus, FiClock, FiUser, FiLoader } from 'react-icons/fi';
import { db } from '../../../../config/firebase';
import { collection, getDocs, addDoc, doc, setDoc, query, where } from "firebase/firestore";
import { supabase } from '../../../../config/supabase';
import emailjs from '@emailjs/browser';


const Auser_management = () => {
  // Initialize EmailJS
  useEffect(() => {
    emailjs.init('hDU2Ar_g1pr7Cpg-S');
    console.log('EmailJS initialized with key:', 'hDU2Ar_g1pr7Cpg-S');
  }, []);

  const [activeTab, setActiveTab] = useState('citizens');
  const [editUser, setEditUser] = useState(null);
  const [showAddStationModal, setShowAddStationModal] = useState(false);
  const [showCitizenProfileModal, setShowCitizenProfileModal] = useState(false);
  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [activeProfileSection, setActiveProfileSection] = useState('profile'); // 'profile', 'reports', 'edit'
  const [editFormData, setEditFormData] = useState({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRespondersModal, setShowRespondersModal] = useState(false);
  const [showResponderProfileModal, setShowResponderProfileModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [stationResponders, setStationResponders] = useState([]);
  const [loadingResponders, setLoadingResponders] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedResponder, setSelectedResponder] = useState(null);
  const [newStation, setNewStation] = useState({
    name: '',
    stationId: '',
    location: '',
    email: '',
    phone: '',
    position: '',
    password: ''
  });



  // Sample data matching the mobile interface
  const [users, setUsers] = useState({ stations: [], citizens: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // Fetch citizens
        const citizenSnapshot = await getDocs(collection(db, "citizenUsers"));
        const citizens = citizenSnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Citizen data from Firebase:', data); // Debug log
          
          // Construct full name from firstName and lastName
          let fullName = 'Unknown User';
          if (data.firstName && data.lastName) {
            fullName = `${data.firstName} ${data.lastName}`;
          } else if (data.firstName) {
            fullName = data.firstName;
          } else if (data.lastName) {
            fullName = data.lastName;
          } else if (data.displayName) {
            fullName = data.displayName;
          } else if (data.email) {
            // Extract name from email as fallback
            const emailName = data.email.split('@')[0];
            fullName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
          }
          
          return {
            id: doc.id,
            ...data,
            name: fullName,
            // Add default values for missing fields
            lastActivity: data.lastActivity || data.createdAt ? 'Recently active' : 'Unknown',
            reports: data.reports || 0,
            status: data.status || 'active',
            phone: data.phone || data.phoneNumber || 'No phone'
          };
        });

        // Fetch stations from Supabase
        const { data: stationsData, error: stationsError } = await supabase
          .from('station_users')
          .select('*');

        if (stationsError) {
          console.error('Error fetching stations from Supabase:', stationsError);
          throw new Error(`Supabase error: ${stationsError.message}`);
        }

        const stations = stationsData.map(data => {
          console.log('🔍 Station data from Supabase:', { id: data.id, ...data }); // Debug log
          
          return {
            id: data.id,
            ...data,
            // Add default values for missing fields
            name: data.station_name || 'Unnamed Station',
            stationName: data.station_name || 'Unnamed Station',
            address: data.address || 'Address not specified',
            number: data.phone || 'No number',
            location: data.address || 'Address not specified',
            lastUpdate: data.updated_at ? 'Recently updated' : 'Unknown',
            responders: 0, // Will be updated below
            status: data.status || 'active',
            phone: data.phone || 'No number',
            isOnline: data.is_online || false
          };
        });

        // Fetch responder counts for each station
        const responderSnapshot = await getDocs(collection(db, "responderUsers"));
        const responderCounts = {};
        
        responderSnapshot.docs.forEach(doc => {
          const responderData = doc.data();
          if (responderData.stationName) {
            responderCounts[responderData.stationName] = (responderCounts[responderData.stationName] || 0) + 1;
          }
        });

        // Update stations with responder counts
        stations.forEach(station => {
          station.responders = responderCounts[station.stationName] || 0;
        });
        
        console.log('📊 Processed stations data:', stations);

        setUsers({ citizens, stations });
      } catch (error) {
        console.error("Error fetching users:", error);
      }
      setLoading(false);
    };

    fetchUsers();
  }, []);

  const toggleStatus = (type, id) => {
    setUsers(prev => ({
      ...prev,
      [type]: prev[type].map(user => 
        user.id === id ? { ...user, status: user.status === 'active' ? 'inactive' : 'active' } : user
      )
    }));
  };

  const handleDelete = (type, id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      setUsers(prev => ({
        ...prev,
        [type]: prev[type].filter(user => user.id !== id)
      }));
    }
  };

  const handleViewCitizenProfile = (citizen) => {
    setSelectedCitizen(citizen);
    setShowCitizenProfileModal(true);
    setActiveProfileSection('profile');
    setEditFormData({
      firstName: citizen.firstName || '',
      lastName: citizen.lastName || '',
      email: citizen.email || '',
      phone: citizen.phone || citizen.phoneNumber || ''
    });
  };

  const handleViewStationProfile = (station) => {
    setSelectedCitizen(station); // Reuse the same modal state
    setShowCitizenProfileModal(true);
    setActiveProfileSection('profile');
    setEditFormData({
      stationName: station.stationName || station.name || '',
      address: station.address || station.location || '',
      number: station.number || station.phone || '',
      position: station.position || station.role || '',
      email: station.email || ''
    });
  };

  const handleEditProfile = (user) => {
    setSelectedUser(user);
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    try {
      console.log('Saving profile:', editFormData);
      
      if (activeTab === 'citizens') {
        // Update citizen profile
        setUsers(prev => ({
          ...prev,
          citizens: prev.citizens.map(citizen => 
            citizen.id === selectedCitizen.id 
              ? { 
                  ...citizen, 
                  ...editFormData,
                  name: `${editFormData.firstName} ${editFormData.lastName}`.trim()
                }
              : citizen
          )
        }));
      } else {
        // Update station profile
        setUsers(prev => ({
          ...prev,
          stations: prev.stations.map(station => 
            station.id === selectedCitizen.id 
              ? { 
                  ...station, 
                  stationName: editFormData.stationName,
                  address: editFormData.address,
                  number: editFormData.number,
                  position: editFormData.position,
                  email: editFormData.email
                }
              : station
          )
        }));
      }
      
      setActiveProfileSection('profile');
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setActiveProfileSection('profile');
    if (activeTab === 'citizens') {
      setEditFormData({
        firstName: selectedCitizen.firstName || '',
        lastName: selectedCitizen.lastName || '',
        email: selectedCitizen.email || '',
        phone: selectedCitizen.phone || selectedCitizen.phoneNumber || ''
      });
    } else {
      // Station data
      setEditFormData({
        stationName: selectedCitizen.stationName || selectedCitizen.name || '',
        address: selectedCitizen.address || selectedCitizen.location || '',
        number: selectedCitizen.number || selectedCitizen.phone || '',
        position: selectedCitizen.position || selectedCitizen.role || '',
        email: selectedCitizen.email || ''
      });
    }
  };

  const handleViewHistory = (user) => {
    setSelectedUser(user);
    setShowHistoryModal(true);
  };

  const handleViewResponders = async (station) => {
    setSelectedStation(station);
    setLoadingResponders(true);
    setShowRespondersModal(true);
    
    try {
      // Fetch responders for this specific station
      const responderQuery = query(
        collection(db, "responderUsers"), 
        where("stationName", "==", station.stationName)
      );
      const responderSnapshot = await getDocs(responderQuery);
      
      const responders = responderSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setStationResponders(responders);
      
      // Update the responder count in the stations list
      setUsers(prev => ({
        ...prev,
        stations: prev.stations.map(s => 
          s.id === station.id 
            ? { ...s, responders: responders.length }
            : s
        )
      }));
    } catch (error) {
      console.error('Error fetching station responders:', error);
      alert('Error fetching responders for this station');
    } finally {
      setLoadingResponders(false);
    }
  };

  const handleToggleStatus = (type, id) => {
    const action = users[type].find(user => user.id === id)?.status === 'active' ? 'disable' : 'enable';
    if (window.confirm(`Are you sure you want to ${action} this ${type === 'citizens' ? 'citizen' : 'station'}?`)) {
      toggleStatus(type, id);
    }
  };

  const handleViewResponderProfile = (responderIndex) => {
    setSelectedResponder({
      id: responderIndex + 1,
      name: `Responder ${responderIndex + 1}`,
      position: 'Firefighter',
      address: '123 Fire Station St, City',
      phone: `+1-555-012${responderIndex + 1}`,
      status: 'Active',
      experience: '5 years',
      specializations: ['Fire Suppression', 'Rescue Operations', 'Hazmat'],
      email: `responder${responderIndex + 1}@fira.com`
    });
    setShowResponderProfileModal(true);
  };



  const handleDisableResponder = (responderIndex) => {
    if (window.confirm(`Are you sure you want to disable Responder ${responderIndex + 1}?`)) {
      alert(`Responder ${responderIndex + 1} has been disabled successfully!`);
    }
  };

  const handleAddStation = async () => {
    if (!newStation.name || !newStation.location || !newStation.email || !newStation.password) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Check if email already exists in Supabase
      const { data: existingStations, error: checkError } = await supabase
        .from('station_users')
        .select('email')
        .eq('email', newStation.email.toLowerCase());

      if (checkError) {
        console.error('Error checking email:', checkError);
        throw new Error(`Error checking email: ${checkError.message}`);
      }

      if (existingStations && existingStations.length > 0) {
        alert('A station with this email already exists. Please use a different email address.');
        return;
      }

      // Create station data for Supabase
      const supabaseData = {
        station_name: newStation.name,
        email: newStation.email.toLowerCase(),
        address: newStation.location,
        phone: newStation.phone || '',
        position: newStation.position || '',
        role: 'stationUser',
        active: true,
        status: 'active',
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add to Supabase
      console.log('💾 Storing station data in Supabase...');
      console.log('📋 Station data to insert:', supabaseData);
      
      let insertedData;
      try {
        const { data, error } = await supabase
          .from('station_users')
          .insert([supabaseData])
          .select();

        if (error) {
          console.error('❌ Supabase error details:', error);
          throw new Error(`Supabase error: ${error.message} (Code: ${error.code})`);
        }

        console.log('✅ Station data stored in Supabase:', data[0]);
        insertedData = data[0];
      } catch (networkError) {
        console.error('❌ Network error:', networkError);
        throw new Error(`Network error: ${networkError.message}. Please check your internet connection and try again.`);
      }
      
      // Create the station object for local state
      const station = {
        id: insertedData.id,
        name: newStation.name,
        stationName: newStation.name,
        address: newStation.location,
        number: newStation.phone || '',
        position: newStation.position || '',
        email: newStation.email,
        lastUpdate: 'Recently updated',
        responders: 0,
        status: 'active',
        isOnline: false,
        createdAt: supabaseData.created_at
      };
      
      // Update local state
      setUsers(prev => ({
        ...prev,
        stations: [...prev.stations, station]
      }));
      
      // Send email with credentials
      await sendWelcomeEmail(newStation.email, newStation.name, newStation.password);
      
      // Clear form
      setNewStation({
        name: '',
        stationId: '',
        location: '',
        email: '',
        phone: '',
        position: '',
        password: ''
      });
      
      setShowAddStationModal(false);
      alert('Station added successfully!');
      
    } catch (error) {
      console.error('Error adding station:', error);
      
      // Check if it's a duplicate email error
      if (error.message.includes('duplicate key value violates unique constraint "station_users_email_key"')) {
        alert('A station with this email already exists. Please use a different email address.');
      } else {
        alert(`Error adding station: ${error.message}`);
      }
    }
  };

  const sendWelcomeEmail = async (email, stationName, password) => {
    try {
      console.log('🚀 Starting email send process for station...');
      console.log('📧 EmailJS configuration:', {
        serviceId: 'service_717ciwa',
        templateId: 'template_vfzvmj2',
        publicKey: 'hDU2Ar_g1pr7Cpg-S'
      });
      
      // EmailJS configuration
      const serviceId = 'service_717ciwa'; // Your EmailJS service ID
      const templateId = 'template_vfzvmj2'; // Your EmailJS template ID
      const publicKey = 'hDU2Ar_g1pr7Cpg-S'; // Your EmailJS public key
      
      const templateParams = {
        to_name: stationName,
        user_email: email,
        user_password: password
      };

      console.log('📋 Template parameters:', templateParams);
      console.log('📤 Attempting to send email...');

      const result = await emailjs.send(serviceId, templateId, templateParams, publicKey);
      console.log('✅ Welcome email sent successfully:', result);
      console.log('📬 EmailJS response:', result);
      
    } catch (error) {
      console.error('❌ Error sending welcome email:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      // Don't throw error here as the station was still created successfully
      // Email failed but station was created - no user notification
    }
  };

  // Refresh responder counts for all stations
  const refreshResponderCounts = async () => {
    try {
      console.log('🔄 Refreshing responder counts...');
      
      // Fetch all responders
      const responderSnapshot = await getDocs(collection(db, "responderUsers"));
      const responderCounts = {};
      
      responderSnapshot.docs.forEach(doc => {
        const responderData = doc.data();
        if (responderData.stationName) {
          responderCounts[responderData.stationName] = (responderCounts[responderData.stationName] || 0) + 1;
        }
      });

      // Update stations with new responder counts
      setUsers(prev => ({
        ...prev,
        stations: prev.stations.map(station => ({
          ...station,
          responders: responderCounts[station.stationName] || 0
        }))
      }));
      
      console.log('✅ Responder counts refreshed');
    } catch (error) {
      console.error('❌ Error refreshing responder counts:', error);
    }
  };

  // Calculate statistics
  const totalUsers = users.citizens.length + users.stations.length;

  const activeUsers = users.citizens.filter(u => u.status === 'active').length + 
                     users.stations.filter(u => u.status === 'active').length;

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <FiUsers className="w-6 h-6 text-blue-600" />
                </div>
              </div>
        </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-3xl font-bold text-green-600">{activeUsers}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <FiUserCheck className="w-6 h-6 text-green-600" />
                </div>
                </div>
              </div>
            </div>
            
          {/* Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex border-b">
                        <button
              onClick={() => setActiveTab('citizens')}
              className={`flex-1 py-4 px-6 text-center font-medium text-sm ${
                activeTab === 'citizens' 
                  ? 'text-red-600 border-b-2 border-red-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Citizens ({users.citizens.length})
                        </button>
                        <button
              onClick={() => setActiveTab('stations')}
              className={`flex-1 py-4 px-6 text-center font-medium text-sm ${
                activeTab === 'stations' 
                  ? 'text-red-600 border-b-2 border-red-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Stations ({users.stations.length})
                        </button>
            </div>
          </div>



          

          {/* Search and Add Button */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="relative flex-1 max-w-lg">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'citizens' ? 'Search citizens...' : 'Search stations...'}
                  className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div className="flex gap-2">
                {activeTab === 'stations' && (
                  <>
                    <button
                      onClick={refreshResponderCounts}
                      className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FiLoader className="mr-2" />
                      Refresh Counts
                    </button>
                    <button
                      onClick={() => setShowAddStationModal(true)}
                      className="flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <FiPlus className="mr-2" />
                      Add New Station
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
            
          {/* Users List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {activeTab === 'citizens' ? 'Citizens' : 'Stations'} ({users[activeTab].length})
              </h2>
            </div>
            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {users[activeTab].map(user => (
                  <div key={user.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <FiUser className="w-6 h-6 text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {activeTab === 'citizens' ? user.name : user.stationName || user.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {activeTab === 'citizens' ? user.email : user.location || user.address || 'Location not specified'}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-sm text-gray-500">
                              {activeTab === 'citizens' ? `Last activity: ${user.lastActivity}` : `Last update: ${user.lastUpdate}`}
                            </span>
                            <span className="text-sm text-blue-600">
                              {activeTab === 'citizens' ? (
                                `Reports: ${user.reports}`
                              ) : (
                                <button 
                                  onClick={() => handleViewResponders(user)}
                                  className="hover:underline cursor-pointer"
                                  title="Click to view responders"
                                >
                                  Responders: {user.responders}
                                </button>
                              )}
                            </span>
                            {activeTab === 'stations' && (
                              <span className={`text-sm px-2 py-1 rounded-full ${
                                user.isOnline 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {user.isOnline ? '🟢 Online' : '🔴 Offline'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => activeTab === 'citizens' ? handleViewCitizenProfile(user) : handleViewStationProfile(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                            title={activeTab === 'citizens' ? 'View Citizen Profile' : 'View Station Profile'}
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedCitizen(user);
                              setShowCitizenProfileModal(true);
                              setActiveProfileSection('reports');
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-full"
                            title="View Reports History"
                          >
                            <FiClock className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedCitizen(user);
                              setShowCitizenProfileModal(true);
                              setActiveProfileSection('edit');
                            }}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-full"
                            title="Edit Profile"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(activeTab, user.id)}
                            className={`p-2 rounded-full ${
                              user.status === 'active' 
                                ? 'text-red-600 hover:bg-red-50' 
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={user.status === 'active' ? 'Disable' : 'Enable'}
                          >
                            {user.status === 'active' ? <FiUserX className="w-4 h-4" /> : <FiUserCheck className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
                    {/* Citizen Profile Modal */}
          {showCitizenProfileModal && selectedCitizen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm"
              onClick={() => setShowCitizenProfileModal(false)}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-5xl w-full mx-4 h-[85vh] flex flex-col border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {activeTab === 'citizens' ? 
                        (activeProfileSection === 'profile' ? 'Citizen Profile' : 
                         activeProfileSection === 'edit' ? 'Citizen Edit Profile' : 
                         activeProfileSection === 'reports' ? 'Citizen Reports History' : 'Citizen Profile') 
                        : 'Station Profile'}
                    </h2>
                    <p className="text-gray-600">
                      {activeProfileSection === 'profile' ? 'View and manage user information' :
                       activeProfileSection === 'edit' ? 'Update user information and details' :
                       activeProfileSection === 'reports' ? '' : 
                       'View and manage user information'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCitizenProfileModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                                   {/* Navigation Tabs */}
                  <div className="flex border-b border-gray-200 mb-8 flex-shrink-0 bg-gray-50 rounded-lg p-1">
                    <button
                      onClick={() => setActiveProfileSection('profile')}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                        activeProfileSection === 'profile'
                          ? 'text-white bg-gradient-to-r from-red-600 to-red-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center">
                        <FiUser className="w-4 h-4 mr-2" />
                        Profile
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveProfileSection('edit')}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                        activeProfileSection === 'edit'
                          ? 'text-white bg-gradient-to-r from-red-600 to-red-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center">
                        <FiEdit2 className="w-4 h-4 mr-2" />
                        Edit Profile
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveProfileSection('reports')}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                        activeProfileSection === 'reports'
                          ? 'text-white bg-gradient-to-r from-red-600 to-red-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center">
                        <FiFileText className="w-4 h-4 mr-2" />
                        Reports History
                      </span>
                    </button>
                  </div>

                  {/* Scrollable Content Area */}
                  <div className={`flex-1 ${activeProfileSection === 'reports' ? 'overflow-y-auto' : ''}`}>

                                   {/* Profile Section */}
                  {activeProfileSection === 'profile' && (
                    <div className="space-y-8">
                      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border border-red-100">
                        <div className="flex items-center space-x-6">
                          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                            <FiUser className="w-10 h-10 text-white" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedCitizen.name}</h3>
                            <p className="text-gray-600 mb-1">{selectedCitizen.email}</p>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              selectedCitizen.status === 'active' 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {selectedCitizen.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <FiUser className="w-5 h-5 mr-2 text-red-600" />
                            Personal Information
                          </h4>
                          <div className="space-y-4">
                                                         <div>
                               <span className="text-sm font-medium text-gray-500 block mb-1">Phone Number</span>
                               <p className="text-gray-900">{selectedCitizen.phone || selectedCitizen.phoneNumber || 'Not provided'}</p>
                             </div>
                             {selectedCitizen.firstName && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">First Name</span>
                                 <p className="text-gray-900">{selectedCitizen.firstName}</p>
                               </div>
                             )}
                             {selectedCitizen.lastName && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">Last Name</span>
                                 <p className="text-gray-900">{selectedCitizen.lastName}</p>
                               </div>
                             )}
                           </div>
                         </div>

                         <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                           <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                             <FiClock className="w-5 h-5 mr-2 text-red-600" />
                             Activity Information
                           </h4>
                           <div className="space-y-4">
                             <div>
                               <span className="text-sm font-medium text-gray-500 block mb-1">Status</span>
                               <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                 selectedCitizen.status === 'active' 
                                   ? 'bg-green-100 text-green-800 border border-green-200' 
                                   : 'bg-red-100 text-red-800 border border-red-200'
                               }`}>
                                 {selectedCitizen.status === 'active' ? 'Active' : 'Inactive'}
                               </span>
                             </div>
                             <div>
                               <span className="text-sm font-medium text-gray-500 block mb-1">Last Activity</span>
                               <p className="text-gray-900">{selectedCitizen.lastActivity}</p>
                             </div>
                             {activeTab === 'citizens' && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">Total Reports</span>
                                 <p className="text-gray-900">{selectedCitizen.reports}</p>
                               </div>
                             )}
                             {activeTab === 'stations' && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">Responders</span>
                                 <p className="text-gray-900">{selectedCitizen.responders}</p>
                               </div>
                             )}
                             {selectedCitizen.createdAt && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">Created Date</span>
                                 <p className="text-gray-900">{new Date(selectedCitizen.createdAt).toLocaleDateString()}</p>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     </div>
                   )}

                                    {/* Reports History Section */}
                   {activeProfileSection === 'reports' && (
                     <div className="space-y-6">
                       
                       
                       <div className="space-y-4">
                         {/* Sample reports - you can replace this with real data */}
                         <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                           <div className="flex justify-between items-start">
                             <div className="flex-1">
                               <div className="flex items-center mb-2">
                                 <h4 className="text-lg font-semibold text-gray-900">Fire Emergency Report</h4>
                                 <span className="ml-3 px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full border border-red-200">Emergency</span>
                               </div>
                               <p className="text-gray-600 mb-2">Location: 123 Main Street, City</p>
                               <p className="text-sm text-gray-500">Reported on: {new Date().toLocaleDateString()}</p>
                             </div>
                             <div className="ml-4">
                               <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                 <FiEye className="w-4 h-4" />
                               </button>
                             </div>
                           </div>
                         </div>
                         
                         <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                           <div className="flex justify-between items-start">
                             <div className="flex-1">
                               <div className="flex items-center mb-2">
                                 <h4 className="text-lg font-semibold text-gray-900">Suspicious Activity</h4>
                                 <span className="ml-3 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full border border-yellow-200">Warning</span>
                               </div>
                               <p className="text-gray-600 mb-2">Location: 456 Oak Avenue</p>
                               <p className="text-sm text-gray-500">Reported on: {new Date(Date.now() - 86400000).toLocaleDateString()}</p>
                             </div>
                             <div className="ml-4">
                               <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                 <FiEye className="w-4 h-4" />
                               </button>
                             </div>
                           </div>
                         </div>
                         
                         <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                           <div className="flex justify-between items-start">
                             <div className="flex-1">
                               <div className="flex items-center mb-2">
                                 <h4 className="text-lg font-semibold text-gray-900">Fire Safety Concern</h4>
                                 <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full border border-blue-200">Info</span>
                               </div>
                               <p className="text-gray-600 mb-2">Location: 789 Pine Road</p>
                               <p className="text-sm text-gray-500">Reported on: {new Date(Date.now() - 172800000).toLocaleDateString()}</p>
                             </div>
                             <div className="ml-4">
                               <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                 <FiEye className="w-4 h-4" />
                               </button>
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}

                                    {/* Edit Profile Section */}
                   {activeProfileSection === 'edit' && (
                     <div className="space-y-6">
                       
                       
                       <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {activeTab === 'citizens' ? (
                             // Citizen fields
                             <>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                                 <input
                                   type="text"
                                   value={editFormData.firstName || ''}
                                   onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter first name"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                                 <input
                                   type="text"
                                   value={editFormData.lastName || ''}
                                   onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter last name"
                                 />
                               </div>
                             </>
                           ) : (
                             // Station fields
                             <>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Station Name</label>
                                 <input
                                   type="text"
                                   value={editFormData.stationName || ''}
                                   onChange={(e) => setEditFormData({...editFormData, stationName: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter station name"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                                 <input
                                   type="text"
                                   value={editFormData.address || ''}
                                   onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter station address"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Number</label>
                                 <input
                                   type="tel"
                                   value={editFormData.number || ''}
                                   onChange={(e) => setEditFormData({...editFormData, number: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter phone number"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                                 <input
                                   type="text"
                                   value={editFormData.position || ''}
                                   onChange={(e) => setEditFormData({...editFormData, position: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter position/role"
                                 />
                               </div>
                             </>
                           )}
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                             <input
                               type="email"
                               value={editFormData.email || ''}
                               onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                               className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                               placeholder="Enter email address"
                             />
                           </div>
                           {activeTab === 'citizens' && (
                             <div>
                               <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                               <input
                                 type="tel"
                                 value={editFormData.phone || ''}
                                 onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                                 className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                 placeholder="Enter phone number"
                               />
                             </div>
                           )}
                         </div>
                         <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 mt-6">
                           <button
                             onClick={handleCancelEdit}
                             className="px-6 py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                           >
                             Cancel
                           </button>
                           <button
                             onClick={handleSaveProfile}
                             className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                           >
                             Save Changes
                           </button>
                         </div>
                       </div>
                     </div>
                   )}

                                   {/* Bottom Actions */}
                  <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200 flex-shrink-0">
                    {/* Close button removed as requested */}
                  </div>
                </div>
              </div>
            </div>
          )}
          







          {/* Add Station Modal */}
          {showAddStationModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowAddStationModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Add New Station</h2>
                    <p className="text-gray-600">Create a new station account</p>
                  </div>
                  <button
                    onClick={() => setShowAddStationModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleAddStation(); }} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Station Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newStation.name}
                        onChange={(e) => setNewStation({...newStation, name: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter station name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newStation.location}
                        onChange={(e) => setNewStation({...newStation, location: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter station location"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={newStation.email}
                        onChange={(e) => setNewStation({...newStation, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter email address"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={newStation.phone}
                        onChange={(e) => setNewStation({...newStation, phone: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter phone number (optional)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Position <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newStation.position || ''}
                        onChange={(e) => setNewStation({...newStation, position: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter position/role (e.g., Fire Captain, Firefighter)"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={newStation.password}
                        onChange={(e) => setNewStation({...newStation, password: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter password for the station"
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <FiUser className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">Station Account Creation</h3>
                        <p className="text-sm text-blue-700 mt-1">
                          The password you enter will be sent to the station's email address along with their login credentials. 
                          The station will be able to log in to the FIRA mobile application with these credentials.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowAddStationModal(false)}
                      className="px-6 py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                    >
                      Create Station
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Responders Modal */}
          {showRespondersModal && selectedStation && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm"
              onClick={() => setShowRespondersModal(false)}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-6xl w-full mx-4 h-[85vh] flex flex-col border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Responders - {selectedStation.stationName}
                    </h2>
                    <p className="text-gray-600">
                      {stationResponders.length} responders registered
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRespondersModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                {loadingResponders ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading responders...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    {stationResponders.length === 0 ? (
                      <div className="text-center py-12">
                        <FiUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Responders Found</h3>
                        <p className="text-gray-600">This station hasn't registered any responders yet.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {stationResponders.map((responder) => (
                          <div key={responder.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                                  <FiUser className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {responder.firstName} {responder.lastName}
                                  </h3>
                                  <p className="text-sm text-gray-600">{responder.email}</p>
                                  <div className="flex items-center space-x-4 mt-1">
                                    <span className="text-sm text-gray-500">
                                      Position: {responder.position}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Phone: {responder.phoneNumber}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Address: {responder.address}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  responder.active !== false 
                                    ? 'bg-green-100 text-green-800 border border-green-200' 
                                    : 'bg-red-100 text-red-800 border border-red-200'
                                }`}>
                                  {responder.active !== false ? 'Active' : 'Inactive'}
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedResponder(responder);
                                    setShowResponderProfileModal(true);
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                  title="View Profile"
                                >
                                  <FiEye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Responder Profile Modal */}
          {showResponderProfileModal && selectedResponder && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm"
              onClick={() => setShowResponderProfileModal(false)}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4 border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Responder Profile
                    </h2>
                    <p className="text-gray-600">View responder details</p>
                  </div>
                  <button
                    onClick={() => setShowResponderProfileModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border border-red-100">
                    <div className="flex items-center space-x-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                        <FiUser className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          {selectedResponder.firstName} {selectedResponder.lastName}
                        </h3>
                        <p className="text-gray-600 mb-1">{selectedResponder.email}</p>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          selectedResponder.active !== false 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {selectedResponder.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <FiUser className="w-5 h-5 mr-2 text-red-600" />
                        Personal Information
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Position</span>
                          <p className="text-gray-900">{selectedResponder.position}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Phone Number</span>
                          <p className="text-gray-900">{selectedResponder.phoneNumber}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Address</span>
                          <p className="text-gray-900">{selectedResponder.address}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <FiClock className="w-5 h-5 mr-2 text-red-600" />
                        Station Information
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Station</span>
                          <p className="text-gray-900">{selectedResponder.stationName}</p>
                        </div>
                        {selectedResponder.createdAt && (
                          <div>
                            <span className="text-sm font-medium text-gray-500 block mb-1">Registered Date</span>
                            <p className="text-gray-900">{new Date(selectedResponder.createdAt).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Profile Modal */}
          {/* History Modal */}
        </div>
      </div>
    </>
  );
};

export default Auser_management;