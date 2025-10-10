import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SUserManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const users = [
    { 
      id: 1, 
      firstName: 'John', 
      lastName: 'Doe', 
      email: 'john@fira.com', 
      phone: '+1234567890',
      role: 'Responder', 
      status: 'Active',
      lastActive: '2 min ago'
    },
    { 
      id: 2, 
      firstName: 'Mike', 
      lastName: 'Johnson', 
      email: 'mike@fira.com', 
      phone: '+1234567891',
      role: 'Responder', 
      status: 'Inactive',
      lastActive: '1 hour ago'
    },
    { 
      id: 3, 
      firstName: 'Sarah', 
      lastName: 'Wilson', 
      email: 'sarah@fira.com', 
      phone: '+1234567892',
      role: 'Responder', 
      status: 'Active',
      lastActive: '5 min ago'
    },
  ];

  const filteredUsers = users.filter(user => 
    user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status) => {
    return status === 'Active' ? '#10b981' : '#ef4444';
  };

  const handleAddUser = () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.phone) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    Alert.alert(
      'Confirm Registration',
      'Are you sure you want to register this responder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Register',
          onPress: () => {
            Alert.alert('Success', 'Responder registered successfully!');
            setShowAddModal(false);
            setNewUser({ firstName: '', lastName: '', email: '', phone: '' });
          }
        }
      ]
    );
  };

  const handleEditUser = () => {
    Alert.alert('Success', 'User information updated successfully!');
    setShowEditModal(false);
    setSelectedUser(null);
  };

  const handleDisableUser = (user) => {
    Alert.alert(
      'Disable User',
      `Are you sure you want to ${user.status === 'Active' ? 'disable' : 'enable'} ${user.firstName} ${user.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: user.status === 'Active' ? 'Disable' : 'Enable',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', `User ${user.status === 'Active' ? 'disabled' : 'enabled'} successfully!`);
          }
        }
      ]
    );
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 pt-32">
        
        {/* Stats Cards */}
        <View className="flex-row mb-6">
          <View className="flex-1 bg-white rounded-lg p-4 mr-2 shadow-sm">
            <Text className="text-2xl font-bold text-gray-800">{users.length}</Text>
            <Text className="text-gray-600 text-sm">Total Responders</Text>
          </View>
          <View className="flex-1 bg-white rounded-lg p-4 ml-2 shadow-sm">
            <Text className="text-2xl font-bold text-green-600">
              {users.filter(u => u.status === 'Active').length}
            </Text>
            <Text className="text-gray-600 text-sm">Active Responders</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <View className="flex-row items-center">
            <MaterialIcons name="search" size={20} color="#6b7280" />
            <TextInput
              className="flex-1 ml-2 text-gray-800"
              placeholder="Search responders..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Add User Button */}
        <TouchableOpacity 
          className="bg-[#ff512f] rounded-lg p-4 mb-4 items-center shadow-sm"
          onPress={() => setShowAddModal(true)}
        >
          <MaterialIcons name="person-add" size={24} color="#ffffff" />
          <Text className="text-white font-semibold text-base mt-2">Add New Responder</Text>
        </TouchableOpacity>

        {/* User List */}
        <View className="bg-white rounded-lg shadow-sm">
          <View className="p-4 border-b border-gray-200">
            <Text className="text-lg font-semibold text-gray-800">Registered Responders</Text>
          </View>
          
          {filteredUsers.map((user) => (
            <TouchableOpacity
              key={user.id}
              className="p-4 border-b border-gray-100"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mr-4">
                    <MaterialIcons name="person" size={24} color="#6b7280" />
                  </View>
                  
                  <View className="flex-1">
                    <Text className="text-gray-800 font-semibold text-base">
                      {user.firstName} {user.lastName}
                    </Text>
                    <Text className="text-gray-500 text-sm">{user.email}</Text>
                    <Text className="text-gray-400 text-xs">{user.lastActive}</Text>
                  </View>
                </View>
                
                <View className="items-end">
                  <View 
                    className="px-2 py-1 rounded-full mb-2"
                    style={{ backgroundColor: getStatusColor(user.status) + '20' }}
                  >
                    <Text 
                      className="text-xs font-medium"
                      style={{ color: getStatusColor(user.status) }}
                    >
                      {user.status}
                    </Text>
                  </View>
                  
                  <View className="flex-row">
                    <TouchableOpacity
                      className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2"
                      onPress={() => openEditModal(user)}
                    >
                      <MaterialIcons name="edit" size={16} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="w-8 h-8 rounded-full bg-red-100 items-center justify-center"
                      onPress={() => handleDisableUser(user)}
                    >
                      <MaterialIcons 
                        name={user.status === 'Active' ? 'block' : 'check-circle'} 
                        size={16} 
                        color={user.status === 'Active' ? '#ef4444' : '#10b981'} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Add User Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg p-6 w-11/12 max-h-96">
            <Text className="text-xl font-bold text-gray-800 mb-4">Add New Responder</Text>
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="First Name"
              value={newUser.firstName}
              onChangeText={(text) => setNewUser({...newUser, firstName: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Last Name"
              value={newUser.lastName}
              onChangeText={(text) => setNewUser({...newUser, lastName: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Email"
              keyboardType="email-address"
              value={newUser.email}
              onChangeText={(text) => setNewUser({...newUser, email: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-4"
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={newUser.phone}
              onChangeText={(text) => setNewUser({...newUser, phone: text})}
            />
            
            <View className="flex-row">
              <TouchableOpacity
                className="flex-1 bg-gray-300 rounded-lg p-3 mr-2"
                onPress={() => setShowAddModal(false)}
              >
                <Text className="text-center font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-[#ff512f] rounded-lg p-3 ml-2"
                onPress={handleAddUser}
              >
                <Text className="text-center font-semibold text-white">Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg p-6 w-11/12 max-h-96">
            <Text className="text-xl font-bold text-gray-800 mb-4">Edit Responder</Text>
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="First Name"
              value={selectedUser?.firstName || ''}
              onChangeText={(text) => setSelectedUser({...selectedUser, firstName: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Last Name"
              value={selectedUser?.lastName || ''}
              onChangeText={(text) => setSelectedUser({...selectedUser, lastName: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Email"
              keyboardType="email-address"
              value={selectedUser?.email || ''}
              onChangeText={(text) => setSelectedUser({...selectedUser, email: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-4"
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={selectedUser?.phone || ''}
              onChangeText={(text) => setSelectedUser({...selectedUser, phone: text})}
            />
            
            <View className="flex-row">
              <TouchableOpacity
                className="flex-1 bg-gray-300 rounded-lg p-3 mr-2"
                onPress={() => setShowEditModal(false)}
              >
                <Text className="text-center font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-[#ff512f] rounded-lg p-3 ml-2"
                onPress={handleEditUser}
              >
                <Text className="text-center font-semibold text-white">Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default SUserManagement; 