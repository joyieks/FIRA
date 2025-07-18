import React, { useState } from 'react';
import { FiUsers, FiUserPlus, FiEdit2, FiUserX } from 'react-icons/fi';

const cebuLocations = [
  'Lahug', 'Talamban', 'Mabolo', 'Guadalupe', 'Banilad', 'Capitol', 'Fuente', 'Labangon', 'Pardo', 'Sawang Calero', 'Tisa', 'Inayawan', 'Bulacao', 'Sambag', 'Kamputhaw', 'Other'
];

const Suser_Management = () => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [editId, setEditId] = useState(null);
  const [responders, setResponders] = useState([
    { id: 1, name: 'Sample Responder', email: 'responder@email.com', position: 'Firefighter', location: 'Lahug', active: true }
  ]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    position: '',
    location: ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddUser = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || (!editId && !form.password) || !form.position || !form.location) return;
    if (editId) {
      setResponders(responders.map(r => r.id === editId ? { ...r, ...form } : r));
      setEditId(null);
    } else {
      setResponders([
        ...responders,
        { id: responders.length + 1, name: form.name, email: form.email, position: form.position, location: form.location, active: true }
      ]);
    }
    setForm({ name: '', email: '', password: '', position: '', location: '' });
    setShowAddUser(false);
  };

  const handleEdit = (responder) => {
    setForm({
      name: responder.name,
      email: responder.email,
      password: '',
      position: responder.position,
      location: responder.location
    });
    setEditId(responder.id);
    setShowAddUser(true);
  };

  const handleDisable = (id) => {
    setResponders(responders.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const handleCancel = () => {
    setShowAddUser(false);
    setEditId(null);
    setForm({ name: '', email: '', password: '', position: '', location: '' });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <FiUsers className="mr-2" /> Station User Management
      </h1>
      {/* Add User Button */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { setShowAddUser(true); setEditId(null); setForm({ name: '', email: '', password: '', position: '', location: '' }); }}
          className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
        >
          <FiUserPlus className="mr-2" /> Add User
        </button>
      </div>
      {/* Add/Edit User Form */}
      {showAddUser && (
        <div className="mb-6 bg-white rounded-lg shadow p-6 max-w-lg mx-auto">
          <h2 className="text-lg font-semibold mb-4">{editId ? 'Edit Responder' : 'Add Responder'}</h2>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input
                type="text"
                name="position"
                value={form.position}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location (Cebu City)</label>
              <select
                name="location"
                value={form.location}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                required
              >
                <option value="">Select location</option>
                {cebuLocations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="mr-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {editId ? 'Save Changes' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Responders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-lg">Responders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {responders.map(responder => (
                <tr key={responder.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{responder.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.position}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.location}</td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Suser_Management;