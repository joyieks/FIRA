import React, { useState, useEffect } from 'react';
import { FiUsers, FiUserPlus, FiEdit2, FiUserX, FiSearch, FiLoader } from 'react-icons/fi';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../../config/firebase';

const cebuLocations = [
  'Lahug', 'Talamban', 'Mabolo', 'Guadalupe', 'Banilad', 'Capitol', 'Fuente', 'Labangon', 'Pardo', 'Sawang Calero', 'Tisa', 'Inayawan', 'Bulacao', 'Sambag', 'Kamputhaw', 'Other'
];

const Suser_Management = () => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [editId, setEditId] = useState(null);
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    stationName: '',
    address: '',
    number: '',
    position: '',
    email: '',
    password: ''
  });

  const functions = getFunctions();

  // Fetch station users from Firestore
  const fetchStationUsers = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching station users from Firestore...');
      
      const q = query(collection(db, 'stationUsers'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const users = [];
      querySnapshot.forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        users.push(userData);
      });
      
      setResponders(users);
      
    } catch (error) {
      console.error('❌ Error fetching station users:', error);
      alert(`Failed to fetch station users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStationUsers();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!form.stationName || !form.address || !form.number || !form.position || !form.email || (!editId && !form.password)) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      
      if (editId) {
        // Update existing user
        const userRef = doc(db, 'stationUsers', editId);
        await updateDoc(userRef, {
          stationName: form.stationName,
          address: form.address,
          number: form.number,
          position: form.position,
          email: form.email,
          updatedAt: new Date()
        });
        
        setResponders(responders.map(r => 
          r.id === editId 
            ? { ...r, stationName: form.stationName, address: form.address, number: form.number, position: form.position, email: form.email }
            : r
        ));
        setEditId(null);
        alert('User updated successfully');
      } else {
        // Create new user using Firebase function
        const createStationUser = httpsCallable(functions, 'createStationUser');
        const result = await createStationUser({
          email: form.email,
          stationName: form.stationName,
          address: form.address,
          number: form.number,
          position: form.position,
          password: form.password
        });

        if (result.data.success) {
          // Refresh the users list
          await fetchStationUsers();
          alert('Station user created successfully and welcome email sent!');
        }
      }
      
      setForm({ stationName: '', address: '', number: '', position: '', email: '', password: '' });
      setShowAddUser(false);
    } catch (error) {
      console.error('Error handling user:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (responder) => {
    setEditId(responder.id);
    setForm({
      stationName: responder.stationName || '',
      address: responder.address || '',
      number: responder.number || '',
      position: responder.position || '',
      email: responder.email || '',
      password: ''
    });
    setShowAddUser(true);
  };

  const handleDisable = async (id) => {
    try {
      const userRef = doc(db, 'stationUsers', id);
      const user = responders.find(r => r.id === id);
      const newStatus = user.active ? false : true;
      
      await updateDoc(userRef, { active: newStatus });
      
      setResponders(responders.map(r => 
        r.id === id ? { ...r, active: newStatus } : r
      ));
      
      alert(`User ${newStatus ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Error updating user status');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'stationUsers', id));
        setResponders(responders.filter(r => r.id !== id));
        alert('User deleted successfully');
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user');
      }
    }
  };

  // Filter responders based on search term
  const filteredResponders = responders.filter(responder =>
    responder.stationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-none mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Station Users</h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {loading ? 'Loading...' : `${responders.length} users found`}
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchStationUsers}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              disabled={loading}
            >
              <FiLoader className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={() => { setShowAddUser(true); setEditId(null); setForm({ stationName: '', address: '', number: '', position: '', email: '', password: '' }); }}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <FiUserPlus className="w-5 h-5" />
              Add User
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search station users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        {/* Station Users Table */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          {!loading && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Station Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredResponders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                        {loading ? 'Loading users...' : 'No station users found'}
                      </td>
                    </tr>
                  ) : (
                    filteredResponders.map(responder => (
                      <tr key={responder.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{responder.stationName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.address}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.position}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.number}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            responder.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {responder.active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2">
                          <button
                            onClick={() => handleEdit(responder)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            onClick={() => handleDisable(responder.id)}
                            className={responder.active ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}
                            title={responder.active ? 'Disable' : 'Enable'}
                          >
                            <FiUserX />
                          </button>
                          <button
                            onClick={() => handleDelete(responder.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <FiUserX />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add/Edit User Modal */}
        {showAddUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editId ? 'Edit User' : 'Add New User'}
                </h3>
                <button
                  onClick={() => { setShowAddUser(false); setEditId(null); setForm({ stationName: '', address: '', number: '', position: '', email: '', password: '' }); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiUserX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Station Name</label>
                  <input
                    type="text"
                    name="stationName"
                    value={form.stationName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>

                {!editId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <select
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  >
                    <option value="">Select Address</option>
                    {cebuLocations.map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <input
                    type="text"
                    name="position"
                    value={form.position}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="e.g., Fire Captain, Firefighter"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number</label>
                  <input
                    type="text"
                    name="number"
                    value={form.number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Phone number"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : (editId ? 'Update User' : 'Add User')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddUser(false); setEditId(null); setForm({ stationName: '', address: '', number: '', position: '', email: '', password: '' }); }}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Suser_Management;