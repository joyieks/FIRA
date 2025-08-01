import React, { useState } from 'react';
import { FiEdit, FiSettings, FiLock, FiUnlock, FiSave, FiCamera, FiUser } from 'react-icons/fi';
import ChangePassword from './ChangePassword.jsx';

const Admin_Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [profileData, setProfileData] = useState({
    name: 'Admin User',
    email: 'admin@cebucity.gov.ph',
    position: 'System Administrator',
    department: 'Cebu City DRRMO',
    mobile: '9123456789',
    profileImage: null,
    lastLogin: 'Today at 2:45 PM'
  });

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

  const handleSave = () => {
    setIsEditing(false);
    // Add your save logic here (API call, etc.)
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {/* Profile Header */}
        <div className="bg-red-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">Admin Profile</h1>
              <p className="text-red-100 mt-1">Cebu City Emergency Response System</p>
            </div>
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
                <h2 className="text-xl font-bold text-gray-800">{profileData.name}</h2>
                <p className="text-gray-600">{profileData.position}</p>
                <p className="text-sm text-gray-500 mt-2">Last login: {profileData.lastLogin}</p>
              </div>
            </div>
            {/* Profile Information Section */}
            <div className="w-full md:w-2/3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800">
                  Personal Information
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
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-lg flex items-center hover:bg-green-200"
                  >
                    <FiSave className="mr-2" />
                    Save Changes
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      value={profileData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  ) : (
                    <p className="text-gray-800">{profileData.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  ) : (
                    <p className="text-gray-800">{profileData.email}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Position</label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="position"
                        value={profileData.position}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    ) : (
                      <p className="text-gray-800">{profileData.position}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Department</label>
                    {isEditing ? (
                      <select
                        name="department"
                        value={profileData.department}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="Cebu City DRRMO">Cebu City DRRMO</option>
                        <option value="CCPO">Cebu City Police Office</option>
                        <option value="BFP Cebu">Bureau of Fire Protection</option>
                        <option value="City Health">City Health Department</option>
                      </select>
                    ) : (
                      <p className="text-gray-800">{profileData.department}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Mobile Number</label>
                  {isEditing ? (
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500">+63</span>
                      <input
                        type="tel"
                        name="mobile"
                        value={profileData.mobile}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 rounded-r-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        pattern="[0-9]{10}"
                      />
                    </div>
                  ) : (
                    <p className="text-gray-800">+63{profileData.mobile}</p>
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
              <h4 className="font-medium text-gray-800 mb-2">Two-Factor Authentication</h4>
              <p className="text-gray-600 mb-3">Currently not enabled</p>
              <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200">
                Enable 2FA
              </button>
            </div>
          </div>
        </div>
        {/* Change Password Modal */}
        <ChangePassword isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
      </div>
    </div>
  );
};

export default Admin_Profile;