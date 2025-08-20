import React, { useState, useEffect } from 'react';
import { FiUsers, FiHome, FiUserCheck, FiUserX, FiEdit2, FiTrash2, FiSearch, FiChevronDown, FiEye, FiFileText, FiX, FiPlus, FiClock, FiUser } from 'react-icons/fi';
import { db } from '../../../../config/firebase';
import { collection, getDocs } from "firebase/firestore";

const Auser_management = () => {
  const [activeTab, setActiveTab] = useState('citizens');
  const [editUser, setEditUser] = useState(null);
  const [showAddStationModal, setShowAddStationModal] = useState(false);
  const [showAddCitizenModal, setShowAddCitizenModal] = useState(false);
  const [showCitizenProfileModal, setShowCitizenProfileModal] = useState(false);
  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRespondersModal, setShowRespondersModal] = useState(false);
  const [showResponderProfileModal, setShowResponderProfileModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedResponder, setSelectedResponder] = useState(null);
  const [newStation, setNewStation] = useState({
    name: '',
    stationId: '',
    email: '',
    phone: ''
  });
  const [newCitizen, setNewCitizen] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
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
        const citizens = citizenSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Fetch stations
        const stationSnapshot = await getDocs(collection(db, "StationUsers"));
        const stations = stationSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

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
  };

  const handleViewStationProfile = (station) => {
    setSelectedCitizen(station); // Reuse the same modal state
    setShowCitizenProfileModal(true);
  };

  const handleEditProfile = (user) => {
    setSelectedUser(user);
    setShowEditProfileModal(true);
  };

  const handleViewHistory = (user) => {
    setSelectedUser(user);
    setShowHistoryModal(true);
  };

  const handleViewResponders = (station) => {
    setSelectedUser(station);
    setShowRespondersModal(true);
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

  const handleAddStation = () => {
    if (newStation.name && newStation.stationId && newStation.email) {
      const station = {
        id: Date.now(),
        name: newStation.name,
        stationId: newStation.stationId,
        email: newStation.email,
        phone: newStation.phone,
        lastUpdate: 'Just now',
        responders: 0,
        status: 'active'
      };
      
      setUsers(prev => ({
        ...prev,
        stations: [...prev.stations, station]
      }));
      
      setNewStation({
        name: '',
        stationId: '',
        email: '',
        phone: ''
      });
      
      setShowAddStationModal(false);
    }
  };

  const handleAddCitizen = () => {
    if (newCitizen.firstName && newCitizen.lastName && newCitizen.email) {
      const citizen = {
        id: Date.now(),
        name: `${newCitizen.firstName} ${newCitizen.lastName}`,
        email: newCitizen.email,
        phone: newCitizen.phone,
        lastActivity: 'Just now',
        reports: 0,
        status: 'active'
      };
      
      setUsers(prev => ({
        ...prev,
        citizens: [...prev.citizens, citizen]
      }));
      
      setNewCitizen({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      });
      
      setShowAddCitizenModal(false);
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
              <button
                onClick={() => activeTab === 'citizens' ? setShowAddCitizenModal(true) : setShowAddStationModal(true)}
                className="flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FiPlus className="mr-2" />
                Add New {activeTab === 'citizens' ? 'Citizen' : 'Station'}
              </button>
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
                          <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                          <p className="text-sm text-gray-600">{user.email}</p>
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
                            onClick={() => handleViewHistory(user)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-full"
                            title="View History"
                          >
                            <FiClock className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditProfile(user)}
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
          {/* Add Citizen Modal */}
          {/* Add Station Modal */}
          {/* Citizen Profile Modal */}
          {/* Edit Profile Modal */}
          {/* History Modal */}
          {/* Responders Modal */}
          {/* Responder Profile Modal */}
        </div>
      </div>
    </>
  );
};

export default Auser_management;