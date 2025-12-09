import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';

const AUserManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Stations'); // 'Citizens' | 'Stations'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRespondersModal, setShowRespondersModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showReEnableModal, setShowReEnableModal] = useState(false);
  const [disableReason, setDisableReason] = useState('');
  const [userToDisable, setUserToDisable] = useState(null);
  const [userToReEnable, setUserToReEnable] = useState(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  const [citizens, setCitizens] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);

  const currentUsers = activeTab === 'Citizens' ? citizens : stations;
  const filteredUsers = currentUsers.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status) => {
    return status === 'Active' ? '#10b981' : '#ef4444';
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // Fetch citizens
        const { data: citizensData, error: citizensError } = await supabase
          .from('citizen_users')
          .select('*');

        if (citizensError) {
          console.error('Error fetching citizens from Supabase:', citizensError);
        }

        const mappedCitizens = (citizensData || []).map((data) => {
          const name = data.first_name && data.last_name
            ? `${data.first_name} ${data.last_name}`
            : (data.first_name || data.last_name || data.display_name || (data.email ? data.email.split('@')[0] : 'Unknown User'));

          // Determine if user is active based on status field
          const isActive = (data.status || 'active').toLowerCase() === 'active';
          // Check if user is disabled/banned
          const isDisabled = data.is_disabled === true;

          return {
            id: data.id,
            name,
            email: data.email || 'No email',
            phone: data.phone || data.phone_number || 'No phone',
            address: data.address || 'No address',
            status: isActive ? 'Active' : 'Inactive',
            isDisabled: isDisabled,
            disableReason: data.disable_reason || null,
            lastActive: data.updated_at ? 'Recently active' : 'Unknown',
            reports: data.reports || 0,
          };
        });

        setCitizens(mappedCitizens);

        // Fetch stations
        const { data: stationsData, error: stationsError } = await supabase
          .from('station_users')
          .select('*')
          .order('station_name', { ascending: true });

        if (stationsError) {
          console.error('Error fetching stations from Supabase:', stationsError);
        }

        const mappedStations = (stationsData || []).map((data) => {
          // Determine if user is active based on status field
          const isActive = (data.status || 'active').toLowerCase() === 'active';
          
          return {
            id: data.id,
            name: data.station_name || data.name || 'Unnamed Station',
            email: data.email || 'No email',
            phone: data.phone || 'No number',
            address: data.address || 'Address not specified',
            status: isActive ? 'Active' : 'Inactive',
            lastActive: data.updated_at ? 'Recently updated' : 'Unknown',
            responders: 0, // Could be populated by another query if needed
          };
        });

        setStations(mappedStations);
      } catch (e) {
        console.error('Error fetching users (mobile admin):', e);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleAddUser = () => {
    if (!newUser.name || !newUser.email || !newUser.phone || !newUser.address) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    Alert.alert(
      'Confirm Registration',
      'Are you sure you want to register this station?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Register',
          onPress: () => {
            Alert.alert('Success', 'Station registered successfully!');
            setShowAddModal(false);
            setNewUser({ name: '', email: '', phone: '', address: '' });
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

  // Handle disable for citizens (shows modal with reason)
  const handleDisableCitizen = (user) => {
    setUserToDisable(user);
    setDisableReason('');
    setShowDisableModal(true);
  };

  // Handle re-enable for citizens (shows modal)
  const handleReEnableCitizen = (user) => {
    setUserToReEnable(user);
    setShowReEnableModal(true);
  };

  // Confirm disable action for citizens
  const handleConfirmDisableCitizen = async () => {
    if (!userToDisable) return;
    
    if (!disableReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for disabling this citizen.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('citizen_users')
        .update({ 
          is_disabled: true,
          disable_reason: disableReason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userToDisable.id);

      if (error) {
        console.error('Error disabling citizen:', error);
        Alert.alert('Error', `Failed to disable citizen: ${error.message}`);
        return;
      }

      // Update local state
      setCitizens(prevCitizens => 
        prevCitizens.map(c => 
          c.id === userToDisable.id 
            ? { ...c, isDisabled: true, disableReason: disableReason.trim() } 
            : c
        )
      );

      setShowDisableModal(false);
      setDisableReason('');
      setUserToDisable(null);
      Alert.alert('Success', 'Account disabled successfully!');
    } catch (error) {
      console.error('Error disabling citizen:', error);
      Alert.alert('Error', `Failed to disable citizen: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Confirm re-enable action for citizens
  const handleConfirmReEnableCitizen = async () => {
    if (!userToReEnable) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('citizen_users')
        .update({ 
          is_disabled: false,
          disable_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userToReEnable.id);

      if (error) {
        console.error('Error re-enabling citizen:', error);
        Alert.alert('Error', `Failed to re-enable citizen: ${error.message}`);
        return;
      }

      // Update local state
      setCitizens(prevCitizens => 
        prevCitizens.map(c => 
          c.id === userToReEnable.id 
            ? { ...c, isDisabled: false, disableReason: null } 
            : c
        )
      );

      setShowReEnableModal(false);
      setUserToReEnable(null);
      Alert.alert('Success', 'Account re-enabled successfully!');
    } catch (error) {
      console.error('Error re-enabling citizen:', error);
      Alert.alert('Error', `Failed to re-enable citizen: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle disable/enable for stations (uses simple alert)
  const handleDisableStation = async (user) => {
    const isActive = user.status === 'Active';
    const action = isActive ? 'disable' : 'enable';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Station`,
      `Are you sure you want to ${action} ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              const { error } = await supabase
                .from('station_users')
                .update({ 
                  status: !isActive ? 'active' : 'inactive',
                  updated_at: new Date().toISOString()
                })
                .eq('id', user.id);
              
              if (error) {
                console.error(`Error ${action}ing station:`, error);
                Alert.alert('Error', `Failed to ${action} station`);
                return;
              }

              // Update local state
              setStations(prevStations => 
                prevStations.map(s => 
                  s.id === user.id 
                    ? { ...s, status: !isActive ? 'Active' : 'Inactive' }
                    : s
                )
              );

              Alert.alert('Success', `Station ${action}d successfully!`);
            } catch (error) {
              console.error(`Error ${action}ing station:`, error);
              Alert.alert('Error', `Failed to ${action} station`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDisableUser = async (user) => {
    // For citizens, use the disable/re-enable flow with modals
    if (activeTab === 'Citizens') {
      if (user.isDisabled) {
        handleReEnableCitizen(user);
      } else {
        handleDisableCitizen(user);
      }
      return;
    }

    // For stations, use the simple alert flow
    if (activeTab === 'Stations') {
      handleDisableStation(user);
      return;
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const openProfileModal = (user) => {
    setSelectedUser(user);
    setShowProfileModal(true);
  };

  const openHistoryModal = (user) => {
    setSelectedUser(user);
    setShowHistoryModal(true);
  };

  const openRespondersModal = (user) => {
    setSelectedUser(user);
    setShowRespondersModal(true);
  };

  const openResponderProfileModal = (responderIndex) => {
    console.log('Opening responder profile for index:', responderIndex);
    Alert.alert(
      `Responder ${responderIndex + 1} Profile`,
      `Name: Responder ${responderIndex + 1}\nPosition: Firefighter\nAddress: 123 Fire Station St, City\nPhone: +1-555-012${responderIndex + 1}\nStatus: Active\nExperience: 5 years\nSpecializations: Fire Suppression, Rescue Operations, Hazmat`,
      [
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  const handleEditResponder = (responderIndex) => {
    console.log('Editing responder at index:', responderIndex);
    Alert.alert(
      `Edit Responder ${responderIndex + 1}`,
      `Current Information:\nName: Responder ${responderIndex + 1}\nAddress: 123 Fire Station St, City\nPhone: +1-555-012${responderIndex + 1}\nPosition: Firefighter\n\nEdit functionality would open here with form fields.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit', onPress: () => Alert.alert('Success', `Edit form would open for Responder ${responderIndex + 1}`) }
      ]
    );
  };

  const handleDisableResponder = (responderIndex) => {
    console.log('Disabling responder at index:', responderIndex);
    Alert.alert(
      'Disable Responder',
      `Are you sure you want to disable Responder ${responderIndex + 1}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disable', 
          style: 'destructive',
          onPress: () => Alert.alert('Success', `Responder ${responderIndex + 1} has been disabled`) 
        }
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4 pt-32">
        


        {/* Stats Cards */}
        <View className="flex-row mb-6">
          <View className="flex-1 bg-white rounded-lg p-4 mr-2 shadow-sm">
            <Text className="text-2xl font-bold text-gray-800">{citizens.length + stations.length}</Text>
            <Text className="text-gray-600 text-sm">Total Users</Text>
          </View>
          <View className="flex-1 bg-white rounded-lg p-4 ml-2 shadow-sm">
            <Text className="text-2xl font-bold text-green-600">
              {citizens.filter(u => u.status === 'Active').length + stations.filter(u => u.status === 'Active').length}
            </Text>
            <Text className="text-gray-600 text-sm">Active Users</Text>
          </View>
        </View>

        {/* Tab Buttons */}
        <View className="flex-row mb-4 bg-white rounded-lg p-1 shadow-sm">
          <TouchableOpacity
            className={`flex-1 py-3 px-4 rounded-lg ${activeTab === 'Citizens' ? 'bg-[#ff512f]' : 'bg-transparent'}`}
            onPress={() => setActiveTab('Citizens')}
          >
            <Text className={`text-center font-semibold ${activeTab === 'Citizens' ? 'text-white' : 'text-gray-600'}`}>
              Citizens ({citizens.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 px-4 rounded-lg ${activeTab === 'Stations' ? 'bg-[#ff512f]' : 'bg-transparent'}`}
            onPress={() => setActiveTab('Stations')}
          >
            <Text className={`text-center font-semibold ${activeTab === 'Stations' ? 'text-white' : 'text-gray-600'}`}>
              Stations ({stations.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <View className="flex-row items-center">
            <MaterialIcons name="search" size={20} color="#6b7280" />
            <TextInput
              className="flex-1 ml-2 text-gray-800"
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Add Station Button - only for Stations tab */}
        {activeTab === 'Stations' && (
          <TouchableOpacity 
            className="bg-[#ff512f] rounded-lg p-4 mb-4 items-center shadow-sm"
            onPress={() => setShowAddModal(true)}
          >
            <MaterialIcons name="business" size={24} color="#ffffff" />
            <Text className="text-white font-semibold text-base mt-2">
              Add New Station
            </Text>
          </TouchableOpacity>
        )}

        {/* User List */}
        <View className="bg-white rounded-lg shadow-sm">
          <View className="p-4 border-b border-gray-200">
            <Text className="text-lg font-semibold text-gray-800">
              {activeTab} ({filteredUsers.length})
            </Text>
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
                    <MaterialIcons 
                      name={activeTab === 'Citizens' ? 'person' : 'business'} 
                      size={24} 
                      color="#6b7280" 
                    />
                  </View>
                  
                  <View className="flex-1">
                    <Text className="text-gray-800 font-semibold text-base">{user.name}</Text>
                    <Text className="text-gray-500 text-sm">{user.email}</Text>
                    <Text className="text-gray-400 text-xs">{user.lastActive}</Text>
                    {activeTab === 'Citizens' ? (
                      <Text className="text-blue-600 text-xs">Reports: {user.reports}</Text>
                    ) : (
                      <TouchableOpacity onPress={() => openRespondersModal(user)}>
                        <Text className="text-blue-600 text-xs underline">Responders: {user.responders}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                
                <View className="items-end">
                  <View className="flex-row items-center mb-2">
                    <View 
                      className="px-2 py-1 rounded-full mr-2"
                      style={{ backgroundColor: getStatusColor(user.status) + '20' }}
                    >
                      <Text 
                        className="text-xs font-medium"
                        style={{ color: getStatusColor(user.status) }}
                      >
                        {user.status}
                      </Text>
                    </View>
                    {activeTab === 'Citizens' && user.isDisabled && (
                      <View 
                        className="px-2 py-1 rounded-full"
                        style={{ backgroundColor: '#dc2626' }}
                      >
                        <Text className="text-xs font-medium text-white">
                          🚫 Disabled
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <View className="flex-row">
                    <TouchableOpacity
                      className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2"
                      onPress={() => openProfileModal(user)}
                    >
                      <MaterialIcons name="visibility" size={16} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-2"
                      onPress={() => openHistoryModal(user)}
                    >
                      <MaterialIcons name="history" size={16} color="#10b981" />
                    </TouchableOpacity>
                    {activeTab === 'Stations' && (
                      <TouchableOpacity
                        className="w-8 h-8 rounded-full bg-yellow-100 items-center justify-center mr-2"
                        onPress={() => openEditModal(user)}
                      >
                        <MaterialIcons name="edit" size={16} color="#f59e0b" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ 
                        backgroundColor: activeTab === 'Citizens' && user.isDisabled
                          ? '#d1fae5'
                          : user.status === 'Active' 
                          ? '#fee2e2' 
                          : '#d1fae5'
                      }}
                      onPress={() => handleDisableUser(user)}
                    >
                      <MaterialIcons 
                        name={
                          activeTab === 'Citizens' && user.isDisabled
                            ? 'check-circle'
                            : user.status === 'Active' 
                            ? 'block' 
                            : 'check-circle'
                        } 
                        size={16} 
                        color={
                          activeTab === 'Citizens' && user.isDisabled
                            ? '#10b981'
                            : user.status === 'Active' 
                            ? '#ef4444' 
                            : '#10b981'
                        } 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Add Station Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg p-6 w-11/12 max-h-96">
            <Text className="text-xl font-bold text-gray-800 mb-4">
              Add New Station
            </Text>
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Station Name"
              value={newUser.name}
              onChangeText={(text) => setNewUser({...newUser, name: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Email"
              keyboardType="email-address"
              value={newUser.email}
              onChangeText={(text) => setNewUser({...newUser, email: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={newUser.phone}
              onChangeText={(text) => setNewUser({...newUser, phone: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-4"
              placeholder="Address"
              value={newUser.address}
              onChangeText={(text) => setNewUser({...newUser, address: text})}
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

      {/* Edit Station Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg p-6 w-11/12 max-h-96">
            <Text className="text-xl font-bold text-gray-800 mb-4">
              Edit Station
            </Text>
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Station Name"
              value={selectedUser?.name || ''}
              onChangeText={(text) => setSelectedUser({...selectedUser, name: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Email"
              keyboardType="email-address"
              value={selectedUser?.email || ''}
              onChangeText={(text) => setSelectedUser({...selectedUser, email: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-3"
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={selectedUser?.phone || ''}
              onChangeText={(text) => setSelectedUser({...selectedUser, phone: text})}
            />
            
            <TextInput
              className="border border-gray-300 rounded-lg p-3 mb-4"
              placeholder="Address"
              value={selectedUser?.address || ''}
              onChangeText={(text) => setSelectedUser({...selectedUser, address: text})}
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

      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white rounded-lg w-11/12">
            <View className="p-6">
              <Text className="text-xl font-bold text-gray-800 mb-6 text-center">{activeTab === 'Citizens' ? 'Citizen Profile' : 'Station Profile'}</Text>
              
              <View className="space-y-4 mb-6">
                <View className="border-b border-gray-200 pb-3">
                  <Text className="text-gray-600 text-sm mb-1">Name</Text>
                  <Text className="text-gray-800 font-bold text-lg">{selectedUser?.name || 'N/A'}</Text>
                </View>
                
                <View className="border-b border-gray-200 pb-3">
                  <Text className="text-gray-600 text-sm mb-1">Email</Text>
                  <Text className="text-gray-800 font-bold text-lg">{selectedUser?.email || 'N/A'}</Text>
                </View>
                
                <View className="border-b border-gray-200 pb-3">
                  <Text className="text-gray-600 text-sm mb-1">Phone</Text>
                  <Text className="text-gray-800 font-bold text-lg">{selectedUser?.phone || 'N/A'}</Text>
                </View>
                
                <View className="border-b border-gray-200 pb-3">
                  <Text className="text-gray-600 text-sm mb-1">Address</Text>
                  <Text className="text-gray-800 font-bold text-lg">{selectedUser?.address || 'N/A'}</Text>
                </View>
                
                <View className="border-b border-gray-200 pb-3">
                  <Text className="text-gray-600 text-sm mb-1">Status</Text>
                  <Text className="text-gray-800 font-bold text-lg">{selectedUser?.status || 'N/A'}</Text>
                </View>
                
                <View className="border-b border-gray-200 pb-3">
                  <Text className="text-gray-600 text-sm mb-1">Last Active</Text>
                  <Text className="text-red-600 font-bold text-lg">{selectedUser?.lastActive || 'N/A'}</Text>
                </View>
                
                {/* Show disable reason if citizen is disabled */}
                {activeTab === 'Citizens' && selectedUser?.isDisabled && selectedUser?.disableReason && (
                  <View className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="block" size={20} color="#dc2626" />
                      <Text className="text-red-900 font-bold text-sm ml-2">Account Disabled</Text>
                    </View>
                    <Text className="text-xs font-medium text-red-800 mb-1">Reason:</Text>
                    <Text className="text-gray-800 text-sm">{selectedUser.disableReason}</Text>
                  </View>
                )}
              </View>
              
              <TouchableOpacity
                className="bg-[#ff512f] rounded-lg p-4"
                onPress={() => setShowProfileModal(false)}
              >
                <Text className="text-center font-semibold text-white text-lg">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-lg p-6 w-11/12 max-h-96">
            <Text className="text-xl font-bold text-gray-800 mb-4">{activeTab === 'Citizens' ? 'Report History' : 'Activity History'}</Text>
            
            <ScrollView className="max-h-64">
              <View>
                <Text className="text-gray-600 mb-2">Recent Activities:</Text>
                <View className="bg-gray-50 p-3 rounded-lg mb-2">
                  <Text className="font-semibold">Emergency Response</Text>
                  <Text className="text-sm text-gray-600">Responded 1 hour ago</Text>
                  <Text className="text-sm text-gray-600">Type: Fire</Text>
                </View>
                <View className="bg-gray-50 p-3 rounded-lg mb-2">
                  <Text className="font-semibold">Training Session</Text>
                  <Text className="text-sm text-gray-600">Completed 2 days ago</Text>
                  <Text className="text-sm text-gray-600">Type: Safety Training</Text>
                </View>
              </View>
            </ScrollView>
            
            <TouchableOpacity
              className="bg-[#ff512f] rounded-lg p-3 mt-4"
              onPress={() => setShowHistoryModal(false)}
            >
              <Text className="text-center font-semibold text-white">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Responders Modal */}
      <Modal
        visible={showRespondersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRespondersModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white rounded-lg p-6 w-11/12 max-h-96">
            <Text className="text-xl font-bold text-gray-800 mb-4">
              Responders - {selectedUser?.name}
            </Text>
            
            <ScrollView className="max-h-64">
              {selectedUser && Array.from({ length: selectedUser.responders }, (_, i) => (
                <View key={i} className="bg-gray-50 p-3 rounded-lg mb-2 border border-gray-200">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center mr-3">
                        <MaterialIcons name="person" size={20} color="#ef4444" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-gray-800">Responder {i + 1}</Text>
                        <Text className="text-sm text-gray-600">Firefighter</Text>
                        <Text className="text-xs text-gray-500">ID: RSP-{String(i + 1).padStart(3, '0')}</Text>
                      </View>
                    </View>
                    
                                         <View className="flex-row">
                       <TouchableOpacity 
                         className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3 border-2 border-blue-400 shadow-sm"
                         onPress={() => openResponderProfileModal(i)}
                         activeOpacity={0.6}
                       >
                         <MaterialIcons name="visibility" size={20} color="#3b82f6" />
                       </TouchableOpacity>
                       <TouchableOpacity 
                         className="w-12 h-12 rounded-full bg-yellow-100 items-center justify-center mr-3 border-2 border-yellow-400 shadow-sm"
                         onPress={() => handleEditResponder(i)}
                         activeOpacity={0.6}
                       >
                         <MaterialIcons name="edit" size={20} color="#f59e0b" />
                       </TouchableOpacity>
                       <TouchableOpacity 
                         className="w-12 h-12 rounded-full bg-red-100 items-center justify-center border-2 border-red-400 shadow-sm"
                         onPress={() => handleDisableResponder(i)}
                         activeOpacity={0.6}
                       >
                         <MaterialIcons name="block" size={20} color="#ef4444" />
                       </TouchableOpacity>
                     </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              className="bg-[#ff512f] rounded-lg p-3 mt-4"
              onPress={() => setShowRespondersModal(false)}
            >
              <Text className="text-center font-semibold text-white">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Disable Citizen Modal */}
      <Modal
        visible={showDisableModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowDisableModal(false);
          setDisableReason('');
          setUserToDisable(null);
        }}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-md">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 bg-red-100 rounded-full items-center justify-center mr-3">
                  <MaterialIcons name="block" size={24} color="#dc2626" />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900">Disable Account</Text>
                  <Text className="text-gray-600 text-sm">Confirm action and provide reason</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowDisableModal(false);
                  setDisableReason('');
                  setUserToDisable(null);
                }}
                className="p-2"
              >
                <MaterialIcons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* User Info */}
            {userToDisable && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <Text className="text-sm text-gray-700 mb-1">
                  <Text className="font-semibold">Citizen:</Text> {userToDisable.name}
                </Text>
                <Text className="text-sm text-gray-600">
                  <Text className="font-semibold">Email:</Text> {userToDisable.email}
                </Text>
              </View>
            )}

            {/* Warning */}
            <View className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r-lg">
              <View className="flex-row">
                <MaterialIcons name="warning" size={20} color="#f59e0b" style={{ marginRight: 8, marginTop: 2 }} />
                <Text className="text-sm text-yellow-700 flex-1">
                  <Text className="font-bold">Warning:</Text> Disabling this citizen will prevent them from logging in. They will see a ban message when attempting to access their account.
                </Text>
              </View>
            </View>

            {/* Reason Input */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Reason for Disabling <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl p-4 bg-gray-50 text-gray-800"
                placeholder="Enter the reason for disabling this citizen (e.g., Violation of terms, Inappropriate behavior, etc.)"
                value={disableReason}
                onChangeText={setDisableReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ minHeight: 100 }}
              />
              <Text className="text-xs text-gray-500 mt-1">
                This reason will be shown to the citizen when they attempt to log in.
              </Text>
            </View>

            {/* Buttons */}
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 bg-gray-200 rounded-xl py-4 items-center"
                onPress={() => {
                  setShowDisableModal(false);
                  setDisableReason('');
                  setUserToDisable(null);
                }}
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-xl py-4 items-center ${
                  disableReason.trim() ? 'bg-red-600' : 'bg-gray-300'
                }`}
                onPress={handleConfirmDisableCitizen}
                disabled={!disableReason.trim()}
              >
                <Text className={`font-semibold ${disableReason.trim() ? 'text-white' : 'text-gray-500'}`}>
                  Confirm Disable
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Re-enable Citizen Modal */}
      <Modal
        visible={showReEnableModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowReEnableModal(false);
          setUserToReEnable(null);
        }}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-white rounded-3xl p-6 w-full max-w-md">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mr-3">
                  <MaterialIcons name="check-circle" size={24} color="#10b981" />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900">Re-enable Account</Text>
                  <Text className="text-gray-600 text-sm">Confirm action to restore access</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowReEnableModal(false);
                  setUserToReEnable(null);
                }}
                className="p-2"
              >
                <MaterialIcons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* User Info */}
            {userToReEnable && (
              <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <Text className="text-sm text-gray-700 mb-1">
                  <Text className="font-semibold">Citizen:</Text> {userToReEnable.name}
                </Text>
                <Text className="text-sm text-gray-600">
                  <Text className="font-semibold">Email:</Text> {userToReEnable.email}
                </Text>
                {userToReEnable.disableReason && (
                  <View className="mt-3 pt-3 border-t border-green-200">
                    <Text className="text-xs font-medium text-green-800 mb-1">Previous Ban Reason:</Text>
                    <Text className="text-sm text-gray-700 italic">{userToReEnable.disableReason}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Info */}
            <View className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-r-lg">
              <View className="flex-row">
                <MaterialIcons name="info" size={20} color="#3b82f6" style={{ marginRight: 8, marginTop: 2 }} />
                <Text className="text-sm text-blue-700 flex-1">
                  <Text className="font-bold">Note:</Text> Re-enabling this citizen will restore their login access. They will be able to use the application again immediately.
                </Text>
              </View>
            </View>

            {/* Checklist */}
            <View className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-6">
              <View className="flex-row items-start">
                <MaterialIcons name="check-circle" size={20} color="#10b981" style={{ marginRight: 8, marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-green-900 mb-2">What will happen:</Text>
                  <Text className="text-sm text-green-800 mb-1">• Account ban will be removed</Text>
                  <Text className="text-sm text-green-800 mb-1">• Login access will be restored</Text>
                  <Text className="text-sm text-green-800 mb-1">• Previous ban reason will be cleared</Text>
                  <Text className="text-sm text-green-800">• Citizen can immediately access the application</Text>
                </View>
              </View>
            </View>

            {/* Buttons */}
            <View className="flex-row space-x-3">
              <TouchableOpacity
                className="flex-1 bg-gray-200 rounded-xl py-4 items-center"
                onPress={() => {
                  setShowReEnableModal(false);
                  setUserToReEnable(null);
                }}
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-green-600 rounded-xl py-4 items-center"
                onPress={handleConfirmReEnableCitizen}
              >
                <Text className="text-white font-semibold">Confirm Re-enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
        
    </ScrollView>
  );
};

export default AUserManagement; 