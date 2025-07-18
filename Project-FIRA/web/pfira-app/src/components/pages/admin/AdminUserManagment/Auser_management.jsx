import React, { useState, useEffect } from 'react';
import { FiUsers, FiHome, FiUserCheck, FiUserX, FiEdit2, FiTrash2, FiSearch, FiChevronDown, FiEye, FiFileText, FiX } from 'react-icons/fi';

const Auser_management = () => {
  const [activeTab, setActiveTab] = useState('stations');
  const [editUser, setEditUser] = useState(null);
  const [reviewApplication, setReviewApplication] = useState(null);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);

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

  // Load pending registrations from localStorage
  useEffect(() => {
    const loadRegistrations = () => {
      const storedRegistrations = JSON.parse(localStorage.getItem('pendingRegistrations') || '[]');
      setPendingRegistrations(storedRegistrations);
    };

    loadRegistrations();

    // Listen for storage changes (when new registrations are added)
    const handleStorageChange = (e) => {
      if (e.key === 'pendingRegistrations') {
        loadRegistrations();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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

  const handleApprove = (id, approve) => {
    if (approve) {
      const application = pendingRegistrations.find(app => app.id === id);
      setUsers(prev => ({
        ...prev,
        citizens: [...prev.citizens, { 
          id: application.id,
          name: `${application.firstName} ${application.lastName}`, 
          email: application.email, 
          barangay: application.headquarter, 
          status: 'active', 
          verified: true 
        }]
      }));
    }
    
    // Remove from pending registrations
    const updatedPending = pendingRegistrations.filter(app => app.id !== id);
    setPendingRegistrations(updatedPending);
    localStorage.setItem('pendingRegistrations', JSON.stringify(updatedPending));
    
    setReviewApplication(null);
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
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <FiUsers className="mr-2" /> User Management
      </h1>

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
        <button
          onClick={() => setActiveTab('pending')}
          className={`py-2 px-4 font-medium flex items-center ${activeTab === 'pending' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FiUserX className="mr-2" /> Pending Registrations
          {pendingRegistrations.length > 0 && (
            <span className="ml-2 bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5 rounded-full">
              {pendingRegistrations.length}
            </span>
          )}
        </button>
      </div>

      {/* Stations Tab */}
      {activeTab === 'stations' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold text-lg">Emergency Stations</h2>
            <div className="relative w-64">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search stations..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Station Name</th>
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
            <div className="relative w-64">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search citizens..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
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

      {/* Pending Registrations Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold text-lg">Pending Registration Applications</h2>
            <div className="flex items-center space-x-4">
              <div className="relative w-64">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search applications..."
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
          </div>
          
          <div className="p-4">
            {pendingRegistrations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FiUserX className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p>No pending registration applications</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRegistrations.map((application) => (
                  <div key={application.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-gray-800">
                            {application.firstName} {application.lastName}
                          </h3>
                          <span className="text-sm text-gray-500">
                            {formatDate(application.submittedAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                          {application.email} • {application.mobile} • {application.headquarter}
                        </p>
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Expertise:</span> {application.emergencyExpertise}
                        </p>
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Address:</span> {application.address}, {application.postalCode}
                        </p>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Director:</span> {application.directorName}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(application.documents).map(([doc, file]) => (
                            <span key={doc} className={`text-xs px-2 py-1 rounded ${
                              file ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {doc}: {file ? '✓ Uploaded' : 'Pending'}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => setReviewApplication(application)}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200 flex items-center"
                        >
                          <FiEye className="mr-1" />
                          Review
                        </button>
                        <button
                          onClick={() => handleApprove(application.id, true)}
                          className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm hover:bg-green-200"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApprove(application.id, false)}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* Review Application Modal */}
      {reviewApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Review Application - {reviewApplication.firstName} {reviewApplication.lastName}
                </h3>
                <button
                  onClick={() => setReviewApplication(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX size={24} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Personal Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Full Name:</span> {reviewApplication.firstName} {reviewApplication.lastName}</p>
                    <p><span className="font-medium">Mobile:</span> {reviewApplication.mobile}</p>
                    <p><span className="font-medium">Email:</span> {reviewApplication.email}</p>
                    <p><span className="font-medium">Headquarters:</span> {reviewApplication.headquarter}</p>
                    <p><span className="font-medium">Emergency Expertise:</span> {reviewApplication.emergencyExpertise}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Location & Contact</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Address:</span> {reviewApplication.address}</p>
                    <p><span className="font-medium">Postal Code:</span> {reviewApplication.postalCode}</p>
                    <p><span className="font-medium">Office Director:</span> {reviewApplication.directorName}</p>
                    <p><span className="font-medium">Submitted:</span> {formatDate(reviewApplication.submittedAt)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium text-gray-800 mb-3">Documents</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(reviewApplication.documents).map(([doc, file]) => (
                    <div key={doc} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {doc === 'idFront' ? 'Government ID (Front)' :
                           doc === 'idBack' ? 'Government ID (Back)' :
                           doc === 'selfie' ? 'Face Photo/Selfie' :
                           doc === 'proof' ? 'Station/Office Proof' :
                           'Additional Documents'}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          file ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {file ? '✓ Uploaded' : 'Pending'}
                        </span>
                      </div>
                      {file && (
                        <p className="text-xs text-gray-500 mt-1">{file.name}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => setReviewApplication(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => handleApprove(reviewApplication.id, false)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reject Application
                </button>
                <button
                  onClick={() => handleApprove(reviewApplication.id, true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve Application
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