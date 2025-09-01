import React, { useState, useEffect } from 'react';
import { FiUsers, FiUserPlus, FiEdit2, FiUserX, FiSearch, FiLoader, FiEye } from 'react-icons/fi';
import { supabase } from '../../../../config/supabase';
import emailjs from '@emailjs/browser';

/*
 * IMPORTANT: Database Schema Requirements
 * The responders table should have:
 * - id: uuid (primary key, references auth.users.id)
 * - station_id: uuid (foreign key, references stations table or current station)
 * - first_name: varchar
 * - middle_name: varchar (optional)
 * - last_name: varchar
 * - email: varchar (unique)
 * - phone: varchar
 * - user_position: varchar
 * - created_at: timestamptz
 * - updated_at: timestamptz
 * 
 * The password is stored securely in Supabase Auth, not in the responders table.
 * Responders are linked to the station that creates them via station_id.
 */

const cebuLocations = [
  'Lahug', 'Talamban', 'Mabolo', 'Guadalupe', 'Banilad', 'Capitol', 'Fuente', 'Labangon', 'Pardo', 'Sawang Calero', 'Tisa', 'Inayawan', 'Bulacao', 'Sambag', 'Kamputhaw', 'Other'
];

const Suser_Management = () => {
  // Initialize EmailJS
  useEffect(() => {
    emailjs.init('hDU2Ar_g1pr7Cpg-S');
    console.log('EmailJS initialized with key:', 'hDU2Ar_g1pr7Cpg-S');
  }, []);

  const [showAddUser, setShowAddUser] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedResponder, setSelectedResponder] = useState(null);
  const [editId, setEditId] = useState(null);
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentStationId, setCurrentStationId] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    userPosition: '',
    password: ''
  });

  // Fetch responders from Supabase
  const fetchResponders = async () => {
    if (!currentStationId) {
      console.log('⏳ Waiting for station ID...');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Fetching responders for station:', currentStationId);
      
      const { data: users, error } = await supabase
        .from('responders')
        .select('*')
        .eq('station_id', currentStationId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching responders:', error);
        alert(`Failed to fetch responders: ${error.message}`);
        return;
      }
      
      setResponders(users || []);
      
    } catch (error) {
      console.error('❌ Error fetching responders:', error);
      alert(`Failed to fetch responders: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get current station ID from localStorage
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.id) {
      setCurrentStationId(userData.id);
      console.log('🏢 Current station ID:', userData.id);
    } else {
      console.error('❌ No station ID found in userData');
      alert('Error: Unable to identify current station. Please log in again.');
    }
  }, []);

  useEffect(() => {
    if (currentStationId) {
      fetchResponders();
    }
  }, [currentStationId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email || !form.phone || !form.userPosition || (!editId && !form.password)) {
      alert('Please fill in all required fields');
      return;
    }

    if (!currentStationId) {
      alert('Error: Unable to identify current station. Please refresh the page and try again.');
      return;
    }

    try {
      setSubmitting(true);
      
      if (editId) {
        // Update existing responder
        const { error } = await supabase
          .from('responders')
          .update({
            first_name: form.firstName,
            middle_name: form.middleName,
            last_name: form.lastName,
            email: form.email,
            phone: form.phone,
            user_position: form.userPosition,
            updated_at: new Date().toISOString()
          })
          .eq('id', editId);
        
        if (error) {
          console.error('Error updating responder:', error);
          alert(`Error updating responder: ${error.message}`);
          return;
        }

        // Update password if provided
        if (form.password && form.password.trim() !== '') {
          const passwordUpdated = await handleUpdatePassword(editId, form.password);
          if (!passwordUpdated) {
            return; // Stop if password update failed
          }
          
          // Send password update email
          await sendPasswordUpdateEmail(form.email, form.firstName, form.lastName, form.password, form.userPosition);
        }
        
        setResponders(responders.map(r => 
          r.id === editId 
            ? { ...r, first_name: form.firstName, middle_name: form.middleName, last_name: form.lastName, email: form.email, phone: form.phone, user_position: form.userPosition }
            : r
        ));
        setEditId(null);
        
        const message = form.password && form.password.trim() !== '' 
          ? 'Responder updated successfully! Password update email sent.'
          : 'Responder updated successfully!';
        alert(message);
      } else {
        // Create new responder with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        });

        if (authError) {
          console.error('Error creating user in auth:', authError);
          if (authError.message.includes('already registered')) {
            alert('Error: A responder with this email already exists');
          } else {
            alert(`Error creating responder: ${authError.message}`);
          }
          return;
        }

        // Store responder data in Supabase with auth user ID
        const responderData = {
          id: authData.user?.id, // Use auth user ID as primary key
          station_id: currentStationId, // Link to current station
          first_name: form.firstName,
          middle_name: form.middleName,
          last_name: form.lastName,
          email: form.email,
          phone: form.phone,
          user_position: form.userPosition,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('responders')
          .insert([responderData]);

        if (insertError) {
          console.error('Error inserting responder data:', insertError);
          alert(`Error creating responder: ${insertError.message}`);
          return;
        }

        // Send welcome email with credentials
        await sendWelcomeEmail(form.email, form.firstName, form.lastName, form.password, form.userPosition);
        
        // Refresh the responders list
        await fetchResponders();
        alert('Responder created successfully! Welcome email sent with login credentials.');
      }
      
      setForm({ firstName: '', middleName: '', lastName: '', email: '', phone: '', userPosition: '', password: '' });
      setShowAddUser(false);
    } catch (error) {
      console.error('Error handling responder:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewProfile = (responder) => {
    setSelectedResponder(responder);
    setShowProfileModal(true);
  };

  const handleEdit = (responder) => {
    setEditId(responder.id);
    setForm({
      firstName: responder.first_name || '',
      middleName: responder.middle_name || '',
      lastName: responder.last_name || '',
      email: responder.email || '',
      phone: responder.phone || '',
      userPosition: responder.user_position || '',
      password: ''
    });
    setShowAddUser(true);
  };



  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this responder?')) {
      try {
        // Delete from responders table
        const { error: deleteError } = await supabase
          .from('responders')
          .delete()
          .eq('id', id);
        
        if (deleteError) {
          console.error('Error deleting responder:', deleteError);
          alert('Error deleting responder');
          return;
        }

        // Note: Auth user will remain in auth.users table
        // You may want to delete it as well if needed:
        // const { error: authError } = await supabase.auth.admin.deleteUser(id);
        
        setResponders(responders.filter(r => r.id !== id));
        alert('Responder deleted successfully');
      } catch (error) {
        console.error('Error deleting responder:', error);
        alert('Error deleting responder');
      }
    }
  };

  const sendWelcomeEmail = async (email, firstName, lastName, password, userPosition) => {
    try {
      console.log('🚀 Starting email send process for responder...');
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
        to_name: `${firstName} ${lastName}`,
        user_email: email,
        user_password: password,
        user_position: userPosition
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
      // Don't throw error here as the responder was still created successfully
      // Email failed but responder was created - no user notification
    }
  };

  const sendPasswordUpdateEmail = async (email, firstName, lastName, newPassword, userPosition) => {
    try {
      console.log('🚀 Starting password update email process...');
      
      // EmailJS configuration
      const serviceId = 'service_717ciwa';
      const templateId = 'template_vfzvmj2'; // Using same template for now
      const publicKey = 'hDU2Ar_g1pr7Cpg-S';
      
      const templateParams = {
        to_name: `${firstName} ${lastName}`,
        user_email: email,
        user_password: newPassword,
        user_position: userPosition
      };

      console.log('📋 Password update template parameters:', templateParams);

      const result = await emailjs.send(serviceId, templateId, templateParams, publicKey);
      console.log('✅ Password update email sent successfully:', result);
      
    } catch (error) {
      console.error('❌ Error sending password update email:', error);
      // Don't throw error here as the password was still updated successfully
    }
  };

  const handleUpdatePassword = async (id, newPassword) => {
    try {
      // Update password in Supabase Auth
      const { error } = await supabase.auth.admin.updateUserById(id, {
        password: newPassword
      });

      if (error) {
        console.error('Error updating password:', error);
        alert('Error updating password');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      alert('Error updating password');
      return false;
    }
  };

  // Filter responders based on search term
  const filteredResponders = responders.filter(responder =>
    responder.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.middle_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    responder.user_position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-none mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Responders</h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {loading ? 'Loading...' : `${responders.length} responders found`}
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchResponders}
              className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              disabled={loading}
            >
              <FiLoader className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={() => { setShowAddUser(true); setEditId(null); setForm({ firstName: '', middleName: '', lastName: '', email: '', phone: '', userPosition: '', password: '' }); }}
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
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <FiLoader className="w-8 h-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading responders...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredResponders.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                        No responders found
                      </td>
                    </tr>
                  ) : (
                    filteredResponders.map(responder => (
                      <tr key={responder.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {responder.first_name} {responder.middle_name ? responder.middle_name + ' ' : ''}{responder.last_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{responder.user_position}</td>
                                                 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2">
                           <button
                             onClick={() => handleViewProfile(responder)}
                             className="text-green-600 hover:text-green-900"
                             title="View Profile"
                           >
                             <FiEye />
                           </button>
                           <button
                             onClick={() => handleEdit(responder)}
                             className="text-blue-600 hover:text-blue-900"
                             title="Edit"
                           >
                             <FiEdit2 />
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
                  onClick={() => { setShowAddUser(false); setEditId(null); setForm({ firstName: '', middleName: '', lastName: '', email: '', phone: '', userPosition: '', password: '' }); }}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                  <input
                    type="text"
                    name="middleName"
                    value={form.middleName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Phone number"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <input
                    type="text"
                    name="userPosition"
                    value={form.userPosition}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="e.g., Fire Captain, Firefighter"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {editId ? '(Leave blank to keep current password)' : '(Required)'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder={editId ? "Enter new password or leave blank" : "Enter password"}
                    required={!editId}
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
                    onClick={() => { setShowAddUser(false); setEditId(null); setForm({ firstName: '', middleName: '', lastName: '', email: '', phone: '', userPosition: '', password: '' }); }}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
                 )}

         {/* Profile Modal */}
         {showProfileModal && selectedResponder && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
             <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-semibold text-gray-900">Responder Profile</h3>
                 <button
                   onClick={() => { setShowProfileModal(false); setSelectedResponder(null); }}
                   className="text-gray-400 hover:text-gray-600"
                 >
                   <FiUserX className="w-6 h-6" />
                 </button>
               </div>

               <div className="space-y-6">
                 {/* Profile Header */}
                 <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border border-red-100">
                   <div className="flex items-center space-x-6">
                     <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                       <FiUsers className="w-10 h-10 text-white" />
                     </div>
                     <div>
                       <h3 className="text-2xl font-bold text-gray-900 mb-2">
                         {selectedResponder.first_name} {selectedResponder.middle_name ? selectedResponder.middle_name + ' ' : ''}{selectedResponder.last_name}
                       </h3>
                       <p className="text-gray-600 mb-1">{selectedResponder.email}</p>
                       <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                         Active Responder
                       </span>
                     </div>
                   </div>
                 </div>
                 
                 {/* Profile Details */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                     <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                       <FiUsers className="w-5 h-5 mr-2 text-red-600" />
                       Personal Information
                     </h4>
                     <div className="space-y-4">
                       <div>
                         <span className="text-sm font-medium text-gray-500 block mb-1">Full Name</span>
                         <p className="text-gray-900">
                           {selectedResponder.first_name} {selectedResponder.middle_name ? selectedResponder.middle_name + ' ' : ''}{selectedResponder.last_name}
                         </p>
                       </div>
                       <div>
                         <span className="text-sm font-medium text-gray-500 block mb-1">Email Address</span>
                         <p className="text-gray-900">{selectedResponder.email}</p>
                       </div>
                       <div>
                         <span className="text-sm font-medium text-gray-500 block mb-1">Phone Number</span>
                         <p className="text-gray-900">{selectedResponder.phone}</p>
                       </div>
                       <div>
                         <span className="text-sm font-medium text-gray-500 block mb-1">Position</span>
                         <p className="text-gray-900">{selectedResponder.user_position}</p>
                       </div>
                     </div>
                   </div>

                   <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                     <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                       <FiLoader className="w-5 h-5 mr-2 text-red-600" />
                       Account Information
                     </h4>
                     <div className="space-y-4">
                       <div>
                         <span className="text-sm font-medium text-gray-500 block mb-1">Responder ID</span>
                         <p className="text-gray-900 font-mono text-sm">{selectedResponder.id}</p>
                       </div>
                       <div>
                         <span className="text-sm font-medium text-gray-500 block mb-1">Station ID</span>
                         <p className="text-gray-900 font-mono text-sm">{selectedResponder.station_id}</p>
                       </div>
                       <div>
                         <span className="text-sm font-medium text-gray-500 block mb-1">Created Date</span>
                         <p className="text-gray-900">
                           {selectedResponder.created_at ? new Date(selectedResponder.created_at).toLocaleDateString() : 'Not available'}
                         </p>
                       </div>
                       <div>
                         <span className="text-sm font-medium text-gray-500 block mb-1">Last Updated</span>
                         <p className="text-gray-900">
                           {selectedResponder.updated_at ? new Date(selectedResponder.updated_at).toLocaleDateString() : 'Not available'}
                         </p>
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* Action Buttons */}
                 <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                   <button
                     onClick={() => {
                       setShowProfileModal(false);
                       setSelectedResponder(null);
                       handleEdit(selectedResponder);
                     }}
                     className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                   >
                     Edit Profile
                   </button>
                   <button
                     onClick={() => { setShowProfileModal(false); setSelectedResponder(null); }}
                     className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                   >
                     Close
                   </button>
                 </div>
               </div>
             </div>
           </div>
         )}
       </div>
     </div>
   );
 };

export default Suser_Management;