import React, { useState, useEffect } from 'react';
import { FiEdit, FiSettings, FiLock, FiUnlock, FiSave, FiCamera, FiUser, FiLoader } from 'react-icons/fi';
import { supabase } from '../../../../config/supabase';
import Station_ChangePass from './Station_ChangePass.jsx';

const Station_Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    id: '',
    station_name: '',
    email: '',
    address: '',
    phone: '',
    position: '',
    role: 'stationUser',
    active: true,
    status: 'active',
    is_online: false,
    created_at: '',
    updated_at: ''
  });

  // Fetch station user data from Supabase
  const fetchStationProfile = async () => {
    try {
      setLoading(true);
      
      // Get current user data from localStorage
      const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
      if (!userData.id) {
        console.error('❌ No station ID found in userData');
        alert('Error: Unable to identify current station. Please log in again.');
        return;
      }

      console.log('🔍 Fetching station profile for ID:', userData.id);
      
      const { data: stationData, error } = await supabase
        .from('station_users')
        .select('*')
        .eq('id', userData.id)
        .single();
      
      if (error) {
        console.error('❌ Error fetching station profile:', error);
        alert(`Failed to fetch station profile: ${error.message}`);
        return;
      }
      
      if (stationData) {
        setProfileData(stationData);
        setIsDisabled(!stationData.active);
        console.log('✅ Station profile loaded:', stationData);
      }
      
    } catch (error) {
      console.error('❌ Error fetching station profile:', error);
      alert(`Failed to fetch station profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load profile data on component mount
  useEffect(() => {
    fetchStationProfile();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({ ...prev, profileImage: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('station_users')
        .update({
          station_name: profileData.station_name,
          email: profileData.email,
          address: profileData.address,
          phone: profileData.phone,
          position: profileData.position,
          updated_at: new Date().toISOString()
        })
        .eq('id', profileData.id);
      
      if (error) {
        console.error('❌ Error updating station profile:', error);
        alert(`Error updating profile: ${error.message}`);
        return;
      }
      
      console.log('✅ Station profile updated successfully');
      alert('Profile updated successfully!');
      setIsEditing(false);
      
    } catch (error) {
      console.error('❌ Error updating station profile:', error);
      alert(`Error updating profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAccountStatus = async () => {
    try {
      const newActiveStatus = !isDisabled;
      
      const { error } = await supabase
        .from('station_users')
        .update({
          active: newActiveStatus,
          status: newActiveStatus ? 'active' : 'disabled',
          updated_at: new Date().toISOString()
        })
        .eq('id', profileData.id);
      
      if (error) {
        console.error('❌ Error updating account status:', error);
        alert(`Error updating account status: ${error.message}`);
        return;
      }
      
      setIsDisabled(!newActiveStatus);
      setProfileData(prev => ({
        ...prev,
        active: newActiveStatus,
        status: newActiveStatus ? 'active' : 'disabled'
      }));
      
      console.log('✅ Account status updated successfully');
      alert(`Account ${newActiveStatus ? 'enabled' : 'disabled'} successfully!`);
      
    } catch (error) {
      console.error('❌ Error updating account status:', error);
      alert(`Error updating account status: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-md p-8 flex items-center space-x-4">
          <FiLoader className="w-8 h-8 animate-spin text-red-600" />
          <span className="text-gray-600">Loading station profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Profile Header */}
        <div className="bg-red-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">Station Profile</h1>
              <p className="text-red-100 mt-1">Cebu City Emergency Response System</p>
            </div>
            <button 
              onClick={handleToggleAccountStatus}
              className={`px-4 py-2 rounded-lg flex items-center ${isDisabled ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-700 hover:bg-gray-800'}`}
            >
              {isDisabled ? <FiUnlock className="mr-2" /> : <FiLock className="mr-2" />}
              {isDisabled ? 'Enable Account' : 'Disable Account'}
            </button>
          </div>
        </div>
        {/* Profile Content */}
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Profile Picture Section */}
            <div className="w-full md:w-1/3 flex flex-col items-center">
              <div className="relative mb-4">
                <div className="w-40 h-40 rounded-full bg-gray-200 overflow-hidden border-4 border-white shadow-lg">
                  {profileData.profileImage ? (
                    <img src={profileData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <FiUser className="w-20 h-20" />
                    </div>
                  )}
                </div>
                {isEditing && (
                  <label className="absolute bottom-2 right-2 bg-white p-2 rounded-full shadow-md cursor-pointer hover:bg-gray-100">
                    <FiCamera className="text-gray-700" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800">{profileData.station_name || 'Station Name'}</h2>
                <p className="text-gray-600">{profileData.position || 'Station User'}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Status: <span className={`font-medium ${profileData.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                    {profileData.status || 'Unknown'}
                  </span>
                </p>
                <p className="text-sm text-gray-500">
                  Last updated: {profileData.updated_at ? new Date(profileData.updated_at).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
            </div>
            {/* Profile Information Section */}
            <div className="w-full md:w-2/3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800">
                  Station Information
                </h3>
                {!isEditing ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg flex items-center hover:bg-blue-200"
                  >
                    <FiEdit className="mr-2" />
                    Edit Profile
                  </button>
                ) : (
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-lg flex items-center hover:bg-green-200 disabled:opacity-50"
                  >
                    <FiSave className="mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Station Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="station_name"
                      value={profileData.station_name || ''}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  ) : (
                    <p className="text-gray-800">{profileData.station_name || 'Not specified'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={profileData.email || ''}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  ) : (
                    <p className="text-gray-800">{profileData.email || 'Not specified'}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Position</label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="position"
                        value={profileData.position || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    ) : (
                      <p className="text-gray-800">{profileData.position || 'Not specified'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Role</label>
                    <p className="text-gray-800">{profileData.role || 'stationUser'}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Address</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="address"
                      value={profileData.address || ''}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  ) : (
                    <p className="text-gray-800">{profileData.address || 'Not specified'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                  {isEditing ? (
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500">+63</span>
                      <input
                        type="tel"
                        name="phone"
                        value={profileData.phone || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 rounded-r-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="9123456789"
                      />
                    </div>
                  ) : (
                    <p className="text-gray-800">{profileData.phone ? `+63${profileData.phone}` : 'Not specified'}</p>
                  )}
                </div>
                {isDisabled && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                    <div className="flex">
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Account Disabled</h3>
                        <p className="text-sm text-yellow-700 mt-1">
                          This account is currently disabled and cannot access the system.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Account Security Section */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Security</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">Password</h4>
              <p className="text-gray-600 mb-3">Last changed 3 months ago</p>
              <button 
                onClick={() => setShowChangePassword(true)}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200"
              >
                Change Password
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">Account Status</h4>
              <p className="text-gray-600 mb-3">
                Status: <span className={`font-medium ${profileData.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {profileData.status || 'Unknown'}
                </span>
              </p>
              <p className="text-gray-600 mb-3">
                Online: <span className={`font-medium ${profileData.is_online ? 'text-green-600' : 'text-gray-600'}`}>
                  {profileData.is_online ? 'Yes' : 'No'}
                </span>
              </p>
              <button 
                onClick={handleToggleAccountStatus}
                className={`px-3 py-1 rounded-lg text-sm ${
                  isDisabled 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {isDisabled ? 'Enable Account' : 'Disable Account'}
              </button>
            </div>
          </div>
        </div>
        {/* Change Password Modal */}
        <Station_ChangePass isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
      </div>
    </div>
  );
};

export default Station_Profile;
