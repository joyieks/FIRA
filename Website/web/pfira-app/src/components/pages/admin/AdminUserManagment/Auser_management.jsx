import React, { useState, useEffect } from 'react';
import { FiUsers, FiHome, FiUserCheck, FiUserX, FiEdit2, FiTrash2, FiSearch, FiChevronDown, FiEye, FiFileText, FiX, FiPlus, FiClock, FiUser } from 'react-icons/fi';

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
  const [users, setUsers] = useState({
    stations: [
      { 
        id: 1, 
        name: 'Central Fire Station', 
        email: 'central@fira.com', 
        lastUpdate: '1 min ago',
        responders: 15,
        status: 'active' 
      },
      { 
        id: 2, 
        name: 'North Station', 
        email: 'north@fira.com', 
        lastUpdate: '3 min ago',
        responders: 12,
        status: 'active' 
      },
      { 
        id: 3, 
        name: 'South Station', 
        email: 'south@fira.com', 
        lastUpdate: '2 hours ago',
        responders: 8,
        status: 'inactive' 
      }
    ],
    citizens: [
      { 
        id: 201, 
        name: 'John Doe', 
        email: 'john@fira.com', 
        phone: '+1234567890',
        address: '123 Main St, City',
        lastActivity: '2 min ago',
        reports: 5,
        status: 'active' 
      },
      { 
        id: 202, 
        name: 'Jane Smith', 
        email: 'jane@fira.com', 
        phone: '+1234567891',
        address: '456 Oak Ave, Town',
        lastActivity: '1 hour ago',
        reports: 2,
        status: 'inactive' 
      },
      { 
        id: 203, 
        name: 'Mike Johnson', 
        email: 'mike@fira.com', 
        phone: '+1234567892',
        address: '789 Pine Rd, Village',
        lastActivity: '5 min ago',
        reports: 8,
        status: 'active' 
      }
    ]
  });

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
          </div>
        </div>

      {/* Add Citizen Modal */}
      {showAddCitizenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Citizen</h3>
                <button
                  onClick={() => setShowAddCitizenModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      value={newCitizen.firstName}
                      onChange={(e) => setNewCitizen({...newCitizen, firstName: e.target.value})}
                      placeholder="Enter first name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      value={newCitizen.lastName}
                      onChange={(e) => setNewCitizen({...newCitizen, lastName: e.target.value})}
                      placeholder="Enter last name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newCitizen.phone}
                    onChange={(e) => setNewCitizen({...newCitizen, phone: e.target.value})}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={newCitizen.email}
                    onChange={(e) => setNewCitizen({...newCitizen, email: e.target.value})}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddCitizenModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCitizen}
                  disabled={!newCitizen.firstName || !newCitizen.lastName || !newCitizen.email}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Add Citizen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Station Modal */}
      {showAddStationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Station</h3>
                <button
                  onClick={() => setShowAddStationModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
                </div>
                
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name of Station *</label>
                  <input
                    type="text"
                    value={newStation.name}
                    onChange={(e) => setNewStation({...newStation, name: e.target.value})}
                    placeholder="Enter station name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Station ID *</label>
                  <input
                    type="text"
                    value={newStation.stationId}
                    onChange={(e) => setNewStation({...newStation, stationId: e.target.value})}
                    placeholder="Enter station ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newStation.phone}
                    onChange={(e) => setNewStation({...newStation, phone: e.target.value})}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={newStation.email}
                    onChange={(e) => setNewStation({...newStation, email: e.target.value})}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddStationModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStation}
                  disabled={!newStation.name || !newStation.stationId || !newStation.email}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Add Station
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Profile Modal */}
      {showCitizenProfileModal && selectedCitizen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {activeTab === 'citizens' ? 'Citizen' : 'Station'} Profile
                </h3>
                <button
                  onClick={() => setShowCitizenProfileModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <p className="text-lg font-bold text-gray-900">{selectedCitizen.name}</p>
                </div>
                
                <div className="border-b pb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <p className="text-lg font-bold text-gray-900">{selectedCitizen.email}</p>
                </div>
                
                <div className="border-b pb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <p className="text-lg font-bold text-gray-900">{selectedCitizen.phone}</p>
                </div>
                
                <div className="border-b pb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <p className="text-lg font-bold text-gray-900">{selectedCitizen.address}</p>
                </div>
                
                <div className="border-b pb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <p className="text-lg font-bold text-gray-900">{selectedCitizen.status === 'active' ? 'Active' : 'Inactive'}</p>
                </div>
                
                {activeTab === 'citizens' ? (
                  <div className="border-b pb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Active</label>
                    <p className="text-lg font-bold text-gray-900 text-red-600">{selectedCitizen.lastActivity}</p>
                  </div>
                ) : (
                  <div className="border-b pb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Update</label>
                    <p className="text-lg font-bold text-gray-900 text-red-600">{selectedCitizen.lastUpdate}</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setShowCitizenProfileModal(false)}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Edit Profile</h3>
                <button
                  onClick={() => setShowEditProfileModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    defaultValue={selectedUser.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    defaultValue={selectedUser.email}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    defaultValue={selectedUser.phone || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {activeTab === 'citizens' ? 'Report History' : 'Response History'} - {selectedUser.name}
                </h3>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                {activeTab === 'citizens' ? (
                  // Citizen Report History
                  <div className="space-y-3">
                    {selectedUser.reports > 0 ? (
                      Array.from({ length: selectedUser.reports }, (_, i) => (
                        <div key={i} className="bg-gray-50 p-4 rounded-lg border-l-4 border-l-red-600">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900">Emergency Report #{i + 1}</h4>
                              <p className="text-sm text-gray-600 mt-1">Fire outbreak in residential area</p>
                              <p className="text-xs text-gray-500 mt-2">Location: 123 Main St, City</p>
                              <p className="text-xs text-gray-500">Status: Resolved</p>
                            </div>
                            <span className="text-xs text-gray-500">2 days ago</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-8">No reports found</p>
                    )}
                  </div>
                ) : (
                  // Station Response History
                  <div className="space-y-3">
                    {selectedUser.responders > 0 ? (
                      Array.from({ length: Math.min(selectedUser.responders, 10) }, (_, i) => (
                        <div key={i} className="bg-gray-50 p-4 rounded-lg border-l-4 border-l-green-600">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900">Emergency Response #{i + 1}</h4>
                              <p className="text-sm text-gray-600 mt-1">Fire suppression and rescue operation</p>
                              <p className="text-xs text-gray-500 mt-2">Location: 456 Oak Ave, Town</p>
                              <p className="text-xs text-gray-500">Response Time: 5 minutes</p>
                              <p className="text-xs text-gray-500">Status: Completed</p>
                            </div>
                            <span className="text-xs text-gray-500">1 day ago</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-8">No response history found</p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Responders Modal */}
      {showRespondersModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Responders - {selectedUser.name}</h3>
                <button
                  onClick={() => setShowRespondersModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
              
              <div className="space-y-4">
                {Array.from({ length: selectedUser.responders }, (_, i) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                          <FiUser className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Responder {i + 1}</h4>
                          <p className="text-sm text-gray-600">Firefighter</p>
                          <p className="text-xs text-gray-500">ID: RSP-{String(i + 1).padStart(3, '0')}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => handleViewResponderProfile(i)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full" 
                          title="View Profile"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => handleDisableResponder(i)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-full" 
                          title="Disable"
                        >
                          <FiUserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowRespondersModal(false)}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Responder Profile Modal */}
      {showResponderProfileModal && selectedResponder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Responder Profile - {selectedResponder.name}</h3>
                <button
                  onClick={() => setShowResponderProfileModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                      <p className="text-lg font-bold text-gray-900">{selectedResponder.name}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                      <p className="text-lg font-bold text-gray-900">{selectedResponder.position}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <p className="text-lg font-bold text-gray-900">{selectedResponder.email}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <p className="text-lg font-bold text-gray-900">{selectedResponder.phone}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                      <p className="text-lg font-bold text-gray-900">{selectedResponder.address}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                      <p className="text-lg font-bold text-green-600">{selectedResponder.status}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                      <p className="text-lg font-bold text-gray-900">{selectedResponder.experience}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Specializations</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedResponder.specializations.map((spec, index) => (
                          <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowResponderProfileModal(false)}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default Auser_management;