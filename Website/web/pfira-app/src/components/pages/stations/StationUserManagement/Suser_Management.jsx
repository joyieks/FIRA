import React, { useState, useEffect } from 'react';
import { FiUsers, FiUserPlus, FiEdit2, FiUserX, FiSearch, FiLoader } from 'react-icons/fi';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../../config/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

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
  const [currentStation, setCurrentStation] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    address: '',
    phoneNumber: '',
    position: '',
    email: '',
    password: ''
  });

  const auth = getAuth();

  // Get current station information
  const getCurrentStation = async () => {
    try {
      const user = auth.currentUser;
      console.log('🔍 Current user:', user);
      
      if (!user) {
        console.error('No authenticated user found');
        return null;
      }

      console.log('🔍 Searching for station with email:', user.email);
      
      // First try to find by email
      let stationQuery = query(collection(db, 'stationUsers'), where('email', '==', user.email));
      let stationSnapshot = await getDocs(stationQuery);
      
      if (stationSnapshot.empty) {
        // If not found by email, try to find by uid
        console.log('🔍 Not found by email, trying uid:', user.uid);
        stationQuery = query(collection(db, 'stationUsers'), where('uid', '==', user.uid));
        stationSnapshot = await getDocs(stationQuery);
      }
      
      if (!stationSnapshot.empty) {
        const stationData = { id: stationSnapshot.docs[0].id, ...stationSnapshot.docs[0].data() };
        console.log('✅ Found station data:', stationData);
        setCurrentStation(stationData);
        return stationData;
      } else {
        console.error('❌ No station found for user:', user.email);
        // For testing purposes, create a default station if none exists
        console.log('🔄 Creating default station for testing...');
        const defaultStation = {
          id: 'default-station',
          stationName: 'Test Station',
          email: user.email,
          uid: user.uid
        };
        setCurrentStation(defaultStation);
        return defaultStation;
      }
    } catch (error) {
      console.error('Error getting current station:', error);
      return null;
    }
  };

  // Fetch responder users from Firestore (only for current station)
  const fetchResponderUsers = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching responder users from Firestore...');
      
      const station = await getCurrentStation();
      if (!station) {
        console.error('No station found for current user');
        setResponders([]);
        return;
      }
      
      // Query responders that belong to this station using stationId instead of stationName
      // Index is now built and enabled - can use orderBy for proper sorting
      const q = query(
        collection(db, 'responderUsers'), 
        where('stationId', '==', station.id),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const users = [];
      querySnapshot.forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        users.push(userData);
      });
      
      setResponders(users);
      
    } catch (error) {
      console.error('❌ Error fetching responder users:', error);
      alert(`Failed to fetch responder users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check authentication status
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('✅ User authenticated:', user.email);
        fetchResponderUsers();
      } else {
        console.log('❌ No user authenticated');
        setResponders([]);
        setCurrentStation(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    // Check if user is authenticated
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert('Error: You must be logged in to add responders. Please log in again.');
      return;
    }
    
    if (!form.firstName || !form.lastName || !form.address || !form.phoneNumber || !form.position || !form.email || (!editId && !form.password)) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      
      if (editId) {
        // Update existing user
        const userRef = doc(db, 'responderUsers', editId);
        await updateDoc(userRef, {
          firstName: form.firstName,
          lastName: form.lastName,
          address: form.address,
          phoneNumber: form.phoneNumber,
          position: form.position,
          email: form.email,
          updatedAt: new Date()
        });
        
        setResponders(responders.map(r => 
          r.id === editId 
            ? { ...r, firstName: form.firstName, lastName: form.lastName, address: form.address, phoneNumber: form.phoneNumber, position: form.position, email: form.email }
            : r
        ));
        setEditId(null);
        alert('Responder updated successfully');
      } else {
        // Get current station information
        const station = await getCurrentStation();
        if (!station) {
          alert('Error: Could not identify current station');
          return;
        }

        try {
          // Create user in Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
          const user = userCredential.user;

          // Store responder data in Firestore
          const responderData = {
            uid: user.uid,
            email: form.email,
            firstName: form.firstName,
            lastName: form.lastName,
            address: form.address,
            phoneNumber: form.phoneNumber,
            position: form.position,
            stationName: station.stationName,
            stationId: station.id,
            role: 'responderUser',
            active: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          await addDoc(collection(db, 'responderUsers'), responderData);

          // Refresh the users list
          await fetchResponderUsers();
          alert('Responder created successfully!');
        } catch (error) {
          console.error('Error creating responder:', error);
          if (error.code === 'auth/email-already-in-use') {
            alert('Error: A user with this email already exists');
          } else {
            alert(`Error creating responder: ${error.message}`);
          }
        }
      }
      
      setForm({ firstName: '', lastName: '', address: '', phoneNumber: '', position: '', email: '', password: '' });
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
      firstName: responder.firstName || '',
      lastName: responder.lastName || '',
      address: responder.address || '',
      phoneNumber: responder.phoneNumber || '',
      position: responder.position || '',
      email: responder.email || '',
      password: ''
    });
    setShowAddUser(true);
  };

  const handleDisable = async (id) => {
    try {
      const userRef = doc(db, 'responderUsers', id);
      const user = responders.find(r => r.id === id);
      const newStatus = user.active ? false : true;
      
      await updateDoc(userRef, { active: newStatus });
      
      setResponders(responders.map(r => 
        r.id === id ? { ...r, active: newStatus } : r
      ));
      
      alert(`Responder ${newStatus ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error updating responder status:', error);
      alert('Error updating responder status');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this responder?')) {
      try {
        await deleteDoc(doc(db, 'responderUsers', id));
        setResponders(responders.filter(r => r.id !== id));
        alert('Responder deleted successfully');
      } catch (error) {
        console.error('Error deleting responder:', error);
        alert('Error deleting responder');
      }
    }
  };

  // Filter responders based on search term
  const filteredResponders = responders.filter(responder =>
    `${responder.firstName} ${responder.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if user is authenticated
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-none mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-6">You must be logged in as a station user to access this page.</p>
            <button 
              onClick={() => window.location.href = '/login'}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-none mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">
              Responder Management
              {currentStation && (
                <span className="text-lg font-normal text-gray-600 ml-2">
                  - {currentStation.stationName}
                </span>
              )}
            </h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {loading ? 'Loading...' : `${responders.length} responders found`}
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchResponderUsers}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              disabled={loading}
            >
              <FiLoader className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={() => { setShowAddUser(true); setEditId(null); setForm({ firstName: '', lastName: '', address: '', phoneNumber: '', position: '', email: '', password: '' }); }}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <FiUserPlus className="w-5 h-5" />
              Add Responder
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search responders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        {/* Responders Table */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          {!loading && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredResponders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                        {loading ? 'Loading responders...' : 'No responders found'}
                      </td>
                    </tr>
                  ) : (
                    filteredResponders.map(responder => (
                      <tr key={responder.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{`${responder.firstName} ${responder.lastName}`}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.address}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.position}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.phoneNumber}</td>
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

        {/* Add/Edit Responder Modal */}
        {showAddUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editId ? 'Edit Responder' : 'Add New Responder'}
                </h3>
                <button
                  onClick={() => { setShowAddUser(false); setEditId(null); setForm({ firstName: '', lastName: '', address: '', phoneNumber: '', position: '', email: '', password: '' }); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiUserX className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={form.lastName}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={form.phoneNumber}
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
                    {submitting ? 'Saving...' : (editId ? 'Update Responder' : 'Add Responder')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddUser(false); setEditId(null); setForm({ firstName: '', lastName: '', address: '', phoneNumber: '', position: '', email: '', password: '' }); }}
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