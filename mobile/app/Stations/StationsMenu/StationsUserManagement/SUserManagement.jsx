import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';

const SUserManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editId, setEditId] = useState(null);
  const [responders, setResponders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStationId, setCurrentStationId] = useState(null);
  const [newUser, setNewUser] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    userPosition: '',
    password: '',
  });

  // Get current station ID from AsyncStorage
  useEffect(() => {
    const getUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.user_metadata && user.user_metadata.station_id) {
          setCurrentStationId(user.user_metadata.station_id);
          console.log('🏢 Current station ID:', user.user_metadata.station_id);
        } else if (user && user.id) {
          // Fallback: use user ID as station ID
          setCurrentStationId(user.id);
          console.log('🏢 Using user ID as station ID:', user.id);
        } else {
          Alert.alert('Error', 'Unable to identify current station. Please log in again.');
        }
      } catch (error) {
        console.error('Error getting user data:', error);
        Alert.alert('Error', 'Failed to get station information.');
      }
    };
    getUserData();
  }, []);

  // Fetch responders from database
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
        Alert.alert('Error', `Failed to fetch responders: ${error.message}`);
        return;
      }
      
      setResponders(users || []);
      
    } catch (error) {
      console.error('❌ Error fetching responders:', error);
      Alert.alert('Error', `Failed to fetch responders: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch responders when station ID is available
  useEffect(() => {
    if (currentStationId) {
      fetchResponders();
    }
  }, [currentStationId]);

  // Filter responders based on search query
  const filteredUsers = responders.filter(user => 
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.middle_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.user_position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status) => {
    return status === 'Active' ? '#10b981' : '#ef4444';
  };

  const handleAddUser = async () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.phone || !newUser.userPosition || (!editId && !newUser.password)) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!currentStationId) {
      Alert.alert('Error', 'Unable to identify current station. Please refresh and try again.');
      return;
    }

    try {
      setSubmitting(true);
      
      if (editId) {
        // Update existing responder
        const { error } = await supabase
          .from('responders')
          .update({
            first_name: newUser.firstName,
            middle_name: newUser.middleName,
            last_name: newUser.lastName,
            email: newUser.email,
            phone: newUser.phone,
            user_position: newUser.userPosition,
            updated_at: new Date().toISOString()
          })
          .eq('id', editId);
        
        if (error) {
          console.error('Error updating responder:', error);
          Alert.alert('Error', `Failed to update responder: ${error.message}`);
          return;
        }

        // Update password if provided
        if (newUser.password && newUser.password.trim() !== '') {
          const { error: pwError } = await supabase.auth.admin.updateUserById(editId, {
            password: newUser.password
          });
          if (pwError) {
            console.error('Error updating password:', pwError);
            Alert.alert('Warning', 'Responder updated but password update failed.');
          }
        }
        
        Alert.alert('Success', 'Responder updated successfully!');
        setEditId(null);
      } else {
        // Create Supabase Auth account for the responder
        console.log('🔐 Creating Supabase Auth account for responder...');
        console.log('🏢 Linking responder to station ID:', currentStationId);
        const fullName = `${newUser.firstName} ${newUser.middleName ? newUser.middleName + ' ' : ''}${newUser.lastName}`.trim();
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: newUser.email,
          password: newUser.password,
          options: {
            data: {
              full_name: fullName,
              display_name: fullName,
              first_name: newUser.firstName,
              middle_name: newUser.middleName,
              last_name: newUser.lastName,
              user_type: 'responder',
              role: 'responder',
              station_id: currentStationId,
              stationId: currentStationId // Also add camelCase version for compatibility
            }
          }
        });

        if (authError) {
          console.error('❌ Error creating Supabase Auth account:', authError);
          Alert.alert('Error', `Failed to create responder account: ${authError.message}`);
          return;
        }

        console.log('✅ Supabase Auth account created:', authData.user.id);

        // Create responder data for Supabase (linked to auth user and station)
        const responderData = {
          id: authData.user.id, // Use auth user ID as primary key
          user_id: authData.user.id,
          station_id: currentStationId, // Link responder to this station
          first_name: newUser.firstName,
          middle_name: newUser.middleName,
          last_name: newUser.lastName,
          email: newUser.email,
          phone: newUser.phone,
          user_position: newUser.userPosition,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('📝 Creating responder with data:', responderData);

        const { error: insertError } = await supabase
          .from('responders')
          .insert([responderData]);

        if (insertError) {
          console.error('Error inserting responder data:', insertError);
          Alert.alert('Error', `Failed to create responder: ${insertError.message}`);
          return;
        }

        Alert.alert('Success', 'Responder created successfully!');
      }
      
      // Refresh the responders list
      await fetchResponders();
      setNewUser({ firstName: '', middleName: '', lastName: '', email: '', phone: '', userPosition: '', password: '' });
      setShowAddModal(false);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error handling responder:', error);
      Alert.alert('Error', `Failed to save responder: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (responder) => {
    setEditId(responder.id);
    setNewUser({
      firstName: responder.first_name || '',
      middleName: responder.middle_name || '',
      lastName: responder.last_name || '',
      email: responder.email || '',
      phone: responder.phone || '',
      userPosition: responder.user_position || '',
      password: ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id, name) => {
    Alert.alert(
      'Delete Responder',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('responders')
                .delete()
                .eq('id', id);
              
              if (error) {
                console.error('Error deleting responder:', error);
                Alert.alert('Error', 'Failed to delete responder');
                return;
              }

              Alert.alert('Success', 'Responder deleted successfully');
              await fetchResponders();
            } catch (error) {
              console.error('Error deleting responder:', error);
              Alert.alert('Error', 'Failed to delete responder');
            }
          }
        }
      ]
    );
  };

  const handleViewProfile = (responder) => {
    setSelectedUser(responder);
    setShowProfileModal(true);
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 pt-32">
        
        {/* Stats Cards */}
        <View className="flex-row mb-6">
          <View className="flex-1 bg-white rounded-lg p-4 mr-2 shadow-sm">
            <Text className="text-2xl font-bold text-gray-800">{responders.length}</Text>
            <Text className="text-gray-600 text-sm">Total Responders</Text>
          </View>
          <View className="flex-1 bg-white rounded-lg p-4 ml-2 shadow-sm">
            <Text className="text-2xl font-bold text-green-600">{responders.length}</Text>
            <Text className="text-gray-600 text-sm">Registered</Text>
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
          onPress={() => {
            setEditId(null);
            setNewUser({ firstName: '', middleName: '', lastName: '', email: '', phone: '', userPosition: '', password: '' });
            setShowAddModal(true);
          }}
        >
          <MaterialIcons name="person-add" size={24} color="#ffffff" />
          <Text className="text-white font-semibold text-base mt-2">Add New Responder</Text>
        </TouchableOpacity>

        {/* Refresh Button */}
        <TouchableOpacity 
          className="bg-blue-600 rounded-lg p-3 mb-4 flex-row items-center justify-center shadow-sm"
          onPress={fetchResponders}
          disabled={loading}
        >
          <MaterialIcons name="refresh" size={20} color="#ffffff" />
          <Text className="text-white font-semibold text-sm ml-2">
            {loading ? 'Loading...' : 'Refresh'}
          </Text>
        </TouchableOpacity>

        {/* User List */}
        <View className="bg-white rounded-lg shadow-sm">
          <View className="p-4 border-b border-gray-200">
            <Text className="text-lg font-semibold text-gray-800">Registered Responders</Text>
          </View>
          
          {loading ? (
            <View className="p-8 items-center">
              <ActivityIndicator size="large" color="#ff512f" />
              <Text className="text-gray-600 mt-2">Loading responders...</Text>
            </View>
          ) : filteredUsers.length === 0 ? (
            <View className="p-8 items-center">
              <MaterialIcons name="people-outline" size={48} color="#9ca3af" />
              <Text className="text-gray-500 mt-2">No responders found</Text>
            </View>
          ) : (
            filteredUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                className="p-4 border-b border-gray-100"
                activeOpacity={0.7}
                onPress={() => handleViewProfile(user)}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center mr-4">
                      <MaterialIcons name="person" size={24} color="#6b7280" />
                    </View>
                    
                    <View className="flex-1">
                      <Text className="text-gray-800 font-semibold text-base">
                        {user.first_name} {user.middle_name ? user.middle_name + ' ' : ''}{user.last_name}
                      </Text>
                      <Text className="text-gray-500 text-sm">{user.email}</Text>
                      <Text className="text-gray-400 text-xs">{user.user_position || 'No position'}</Text>
                    </View>
                  </View>
                  
                  <View className="items-end">
                    <View className="flex-row">
                      <TouchableOpacity
                        className="w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-2"
                        onPress={() => handleViewProfile(user)}
                      >
                        <MaterialIcons name="visibility" size={16} color="#10b981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2"
                        onPress={() => handleEdit(user)}
                      >
                        <MaterialIcons name="edit" size={16} color="#3b82f6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="w-8 h-8 rounded-full bg-red-100 items-center justify-center"
                        onPress={() => handleDelete(user.id, `${user.first_name} ${user.last_name}`)}
                      >
                        <MaterialIcons name="delete" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Add/Edit User Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <ScrollView className="flex-1 w-full" contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}>
            <View className="bg-white rounded-lg p-6 w-11/12 my-8">
              <Text className="text-xl font-bold text-gray-800 mb-4">
                {editId ? 'Edit Responder' : 'Add New Responder'}
              </Text>
              
              <TextInput
                className="border border-gray-300 rounded-lg p-3 mb-3"
                placeholder="First Name *"
                placeholderTextColor="#1f2937"
                value={newUser.firstName}
                onChangeText={(text) => setNewUser({...newUser, firstName: text})}
              />
              
              <TextInput
                className="border border-gray-300 rounded-lg p-3 mb-3"
                placeholder="Middle Name"
                placeholderTextColor="#1f2937"
                value={newUser.middleName}
                onChangeText={(text) => setNewUser({...newUser, middleName: text})}
              />
              
              <TextInput
                className="border border-gray-300 rounded-lg p-3 mb-3"
                placeholder="Last Name *"
                placeholderTextColor="#1f2937"
                value={newUser.lastName}
                onChangeText={(text) => setNewUser({...newUser, lastName: text})}
              />
              
              <TextInput
                className="border border-gray-300 rounded-lg p-3 mb-3"
                placeholder="Email *"
                placeholderTextColor="#1f2937"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newUser.email}
                onChangeText={(text) => setNewUser({...newUser, email: text})}
              />
              
              <TextInput
                className="border border-gray-300 rounded-lg p-3 mb-3"
                placeholder="Phone Number *"
                placeholderTextColor="#1f2937"
                keyboardType="phone-pad"
                value={newUser.phone}
                onChangeText={(text) => setNewUser({...newUser, phone: text})}
              />
              
              <TextInput
                className="border border-gray-300 rounded-lg p-3 mb-3"
                placeholder="Position (e.g., Fire Captain, Firefighter) *"
                placeholderTextColor="#1f2937"
                value={newUser.userPosition}
                onChangeText={(text) => setNewUser({...newUser, userPosition: text})}
              />
              
              <TextInput
                className="border border-gray-300 rounded-lg p-3 mb-4"
                placeholder={editId ? "Password (leave blank to keep current)" : "Password *"}
                placeholderTextColor="#1f2937"
                secureTextEntry
                autoCapitalize="none"
                value={newUser.password}
                onChangeText={(text) => setNewUser({...newUser, password: text})}
              />
              
              <View className="flex-row">
                <TouchableOpacity
                  className="flex-1 bg-gray-300 rounded-lg p-3 mr-2"
                  onPress={() => {
                    setShowAddModal(false);
                    setEditId(null);
                    setNewUser({ firstName: '', middleName: '', lastName: '', email: '', phone: '', userPosition: '', password: '' });
                  }}
                  disabled={submitting}
                >
                  <Text className="text-center font-semibold text-gray-700">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-[#ff512f] rounded-lg p-3 ml-2"
                  onPress={handleAddUser}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-center font-semibold text-white">
                      {editId ? 'Update' : 'Register'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Profile View Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <ScrollView className="flex-1 w-full" contentContainerStyle={{ justifyContent: 'center', alignItems: 'center' }}>
            <View className="bg-white rounded-lg p-6 w-11/12 my-8">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-800">Responder Profile</Text>
                <TouchableOpacity onPress={() => {
                  setShowProfileModal(false);
                  setSelectedUser(null);
                }}>
                  <MaterialIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {selectedUser && (
                <>
                  {/* Profile Header */}
                  <View className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 mb-4 border border-red-100">
                    <View className="flex-row items-center">
                      <View className="w-16 h-16 bg-red-600 rounded-full items-center justify-center mr-4">
                        <MaterialIcons name="person" size={32} color="#ffffff" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xl font-bold text-gray-900 mb-1">
                          {selectedUser.first_name} {selectedUser.middle_name ? selectedUser.middle_name + ' ' : ''}{selectedUser.last_name}
                        </Text>
                        <Text className="text-gray-600 text-sm">{selectedUser.email}</Text>
                        <View className="mt-2 bg-green-100 px-3 py-1 rounded-full self-start">
                          <Text className="text-green-800 text-xs font-medium">Active Responder</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Personal Information */}
                  <View className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
                    <View className="flex-row items-center mb-3">
                      <MaterialIcons name="person" size={20} color="#ef4444" />
                      <Text className="text-base font-semibold text-gray-900 ml-2">Personal Information</Text>
                    </View>
                    <View className="space-y-3">
                      <View>
                        <Text className="text-xs font-medium text-gray-500 mb-1">Full Name</Text>
                        <Text className="text-gray-900">
                          {selectedUser.first_name} {selectedUser.middle_name ? selectedUser.middle_name + ' ' : ''}{selectedUser.last_name}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-xs font-medium text-gray-500 mb-1">Email Address</Text>
                        <Text className="text-gray-900">{selectedUser.email}</Text>
                      </View>
                      <View>
                        <Text className="text-xs font-medium text-gray-500 mb-1">Phone Number</Text>
                        <Text className="text-gray-900">{selectedUser.phone}</Text>
                      </View>
                      <View>
                        <Text className="text-xs font-medium text-gray-500 mb-1">Position</Text>
                        <Text className="text-gray-900">{selectedUser.user_position}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Account Information */}
                  <View className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                    <View className="flex-row items-center mb-3">
                      <MaterialIcons name="info" size={20} color="#ef4444" />
                      <Text className="text-base font-semibold text-gray-900 ml-2">Account Information</Text>
                    </View>
                    <View className="space-y-3">
                      <View>
                        <Text className="text-xs font-medium text-gray-500 mb-1">Responder ID</Text>
                        <Text className="text-gray-900 font-mono text-xs">{selectedUser.id}</Text>
                      </View>
                      <View>
                        <Text className="text-xs font-medium text-gray-500 mb-1">Station ID</Text>
                        <Text className="text-gray-900 font-mono text-xs">{selectedUser.station_id}</Text>
                      </View>
                      {selectedUser.created_at && (
                        <View>
                          <Text className="text-xs font-medium text-gray-500 mb-1">Created Date</Text>
                          <Text className="text-gray-900">{new Date(selectedUser.created_at).toLocaleDateString()}</Text>
                        </View>
                      )}
                      {selectedUser.updated_at && (
                        <View>
                          <Text className="text-xs font-medium text-gray-500 mb-1">Last Updated</Text>
                          <Text className="text-gray-900">{new Date(selectedUser.updated_at).toLocaleDateString()}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row space-x-2">
                    <TouchableOpacity
                      className="flex-1 bg-blue-600 rounded-lg p-3 mr-2"
                      onPress={() => {
                        setShowProfileModal(false);
                        setSelectedUser(null);
                        handleEdit(selectedUser);
                      }}
                    >
                      <Text className="text-center font-semibold text-white">Edit Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 bg-gray-500 rounded-lg p-3 ml-2"
                      onPress={() => {
                        setShowProfileModal(false);
                        setSelectedUser(null);
                      }}
                    >
                      <Text className="text-center font-semibold text-white">Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default SUserManagement; 