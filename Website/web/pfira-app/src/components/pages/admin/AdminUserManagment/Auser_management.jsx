import React, { useState, useEffect } from 'react';
import { FiUsers, FiHome, FiUserCheck, FiUserX, FiEdit2, FiTrash2, FiSearch, FiChevronDown, FiEye, FiFileText, FiX, FiPlus } from 'react-icons/fi';

const Auser_management = () => {
  const [activeTab, setActiveTab] = useState('stations');
  const [editUser, setEditUser] = useState(null);
  const [showAddStationModal, setShowAddStationModal] = useState(false);
  const [showAddCitizenModal, setShowAddCitizenModal] = useState(false);
  const [newStation, setNewStation] = useState({
    name: '',
    username: '',
    email: '',
    address: '',
    phone: ''
  });
  const [newCitizen, setNewCitizen] = useState({
    name: '',
    email: '',
    barangay: '',
    phone: ''
  });

  // Sample data - replace with real data from your API
  const [users, setUsers] = useState({
    stations: [
      { id: 1, name: 'Cebu City DRRMO', email: 'drrmo@cebu.gov.ph', role: 'Admin', status: 'active', users: 15 },
      { id: 2, name: 'BFP Station 1', email: 'bfp1@cebu.gov.ph', role: 'Manager', status: 'active', users: 8 },
      { id: 3, name: 'CCPO Headquarters', email: 'ccpo@cebu.gov.ph', role: 'Operator', status: 'disabled', users: 23 }
    ],
    stationUsers: [
      { id: 101, name: 'Juan Dela Cruz', email: 'juan@cebu.gov.ph', position: 'Firefighter', station: 'BFP Station 1', status: 'active' },
      { id: 102, name: 'Maria Santos', email: 'maria@cebu.gov.ph', position: 'EMT', station: 'Cebu City DRRMO', status: 'active' },
      { id: 103, name: 'Pedro Reyes', email: 'pedro@cebu.gov.ph', position: 'Police Officer', station: 'CCPO Headquarters', status: 'disabled' }
    ],
    citizens: [
      { id: 201, name: 'Ana Lopez', email: 'ana@email.com', barangay: 'Lahug', status: 'active', verified: true },
      { id: 202, name: 'Carlos Gomez', email: 'carlos@email.com', barangay: 'Talamban', status: 'active', verified: true },
      { id: 203, name: 'Elena Tan', email: 'elena@email.com', barangay: 'Mabolo', status: 'disabled', verified: false }
    ]
  });

  const toggleStatus = (type, id) => {
    setUsers(prev => ({
      ...prev,
      [type]: prev[type].map(user => 
        user.id === id ? { ...user, status: user.status === 'active' ? 'disabled' : 'active' } : user
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

  const handleAddStation = () => {
    if (newStation.name && newStation.email && newStation.username) {
      const station = {
        id: Date.now(), // Simple ID generation
        name: newStation.name,
        username: newStation.username,
        email: newStation.email,
        role: 'Manager', // Default role
        status: 'active',
        users: 0,
        address: newStation.address,
        phone: newStation.phone
      };
      
      setUsers(prev => ({
        ...prev,
        stations: [...prev.stations, station]
      }));
      
      // Reset form
      setNewStation({
        name: '',
        username: '',
        email: '',
        address: '',
        phone: ''
      });
      
      setShowAddStationModal(false);
    }
  };

  const handleAddCitizen = () => {
    if (newCitizen.name && newCitizen.email && newCitizen.barangay) {
      const citizen = {
        id: Date.now(), // Simple ID generation
        name: newCitizen.name,
        email: newCitizen.email,
        barangay: newCitizen.barangay,
        status: 'active',
        verified: true,
        phone: newCitizen.phone
      };
      
      setUsers(prev => ({
        ...prev,
        citizens: [...prev.citizens, citizen]
      }));
      
      // Reset form
      setNewCitizen({
        name: '',
        email: '',
        barangay: '',
        phone: ''
      });
      
      setShowAddCitizenModal(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('stations')}
          className={`py-2 px-4 font-medium flex items-center ${activeTab === 'stations' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FiHome className="mr-2" /> Stations
        </button>
        <button
          onClick={() => setActiveTab('citizens')}
          className={`py-2 px-4 font-medium flex items-center ${activeTab === 'citizens' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FiUserCheck className="mr-2" /> Citizens
        </button>
      </div>

      {/* Stations Tab */}
      {activeTab === 'stations' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold text-lg">Emergency Stations</h2>
            <div className="flex items-center space-x-4">
              <div className="relative w-64">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search stations..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <button
                onClick={() => setShowAddStationModal(true)}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FiPlus className="mr-2" />
                Add Station
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Station Name</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                 </tr>
               </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                                 {users.stations.map(station => (
                   <tr key={station.id}>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="font-medium text-gray-900">{station.name}</div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-gray-500">{station.username || 'N/A'}</td>
                     <td className="px-6 py-4 whitespace-nowrap text-gray-500">{station.email}</td>
                     <td className="px-6 py-4 whitespace-nowrap text-gray-500">{station.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {station.users} users
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        station.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {station.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditUser(station)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => toggleStatus('stations', station.id)}
                        className={`mr-3 ${station.status === 'active' ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                      >
                        {station.status === 'active' ? <FiUserX /> : <FiUserCheck />}
                      </button>
                      <button
                        onClick={() => handleDelete('stations', station.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Citizens Tab */}
      {activeTab === 'citizens' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold text-lg">Registered Citizens</h2>
            <div className="flex items-center space-x-4">
              <div className="relative w-64">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search citizens..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <button
                onClick={() => setShowAddCitizenModal(true)}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FiPlus className="mr-2" />
                Add Citizen
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barangay</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.citizens.map(citizen => (
                  <tr key={citizen.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{citizen.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{citizen.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">{citizen.barangay}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        citizen.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {citizen.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        citizen.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {citizen.verified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditUser(citizen)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => toggleStatus('citizens', citizen.id)}
                        className={`mr-3 ${citizen.status === 'active' ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                      >
                        {citizen.status === 'active' ? <FiUserX /> : <FiUserCheck />}
                      </button>
                      <button
                        onClick={() => handleDelete('citizens', citizen.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit User</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    defaultValue={editUser.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    defaultValue={editUser.email}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                {activeTab === 'stations' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      defaultValue={editUser.role}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Manager">Manager</option>
                      <option value="Operator">Operator</option>
                    </select>
                  </div>
                )}
                
                {activeTab === 'citizens' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Barangay</label>
                    <input
                      type="text"
                      defaultValue={editUser.barangay}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    defaultValue={editUser.status}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Station Modal */}
      {showAddStationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
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
                   <label className="block text-sm font-medium text-gray-700 mb-1">Station Name *</label>
                   <input
                     type="text"
                     value={newStation.name}
                     onChange={(e) => setNewStation({...newStation, name: e.target.value})}
                     placeholder="Enter station name"
                     className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                   />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                   <input
                     type="text"
                     value={newStation.username}
                     onChange={(e) => setNewStation({...newStation, username: e.target.value})}
                     placeholder="Enter username"
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={newStation.address}
                    onChange={(e) => setNewStation({...newStation, address: e.target.value})}
                    placeholder="Enter station address"
                    rows="3"
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
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddStationModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Cancel
                </button>
                                 <button
                   onClick={handleAddStation}
                   disabled={!newStation.name || !newStation.email || !newStation.username}
                   className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                 >
                   Add Station
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Citizen Modal */}
      {showAddCitizenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={newCitizen.name}
                    onChange={(e) => setNewCitizen({...newCitizen, name: e.target.value})}
                    placeholder="Enter full name"
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
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barangay *</label>
                  <select
                    value={newCitizen.barangay}
                    onChange={(e) => setNewCitizen({...newCitizen, barangay: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Select barangay</option>
                    <option value="Lahug">Lahug</option>
                    <option value="Talamban">Talamban</option>
                    <option value="Mabolo">Mabolo</option>
                    <option value="Guadalupe">Guadalupe</option>
                    <option value="Pahina Central">Pahina Central</option>
                    <option value="Sambag 1">Sambag 1</option>
                    <option value="Sambag 2">Sambag 2</option>
                    <option value="Capitol Site">Capitol Site</option>
                    <option value="Kamputhaw">Kamputhaw</option>
                    <option value="Tejero">Tejero</option>
                    <option value="Parian">Parian</option>
                    <option value="San Nicolas">San Nicolas</option>
                    <option value="Santo Niño">Santo Niño</option>
                    <option value="San Roque">San Roque</option>
                    <option value="Pari-an">Pari-an</option>
                    <option value="Calamba">Calamba</option>
                    <option value="Sawang Calero">Sawang Calero</option>
                    <option value="Subangdaku">Subangdaku</option>
                    <option value="Mandaue City">Mandaue City</option>
                  </select>
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
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddCitizenModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCitizen}
                  disabled={!newCitizen.name || !newCitizen.email || !newCitizen.barangay}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Add Citizen
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