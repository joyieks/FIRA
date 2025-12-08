import React, { useState, useEffect } from 'react';
import { FiUsers, FiHome, FiUserCheck, FiUserX, FiEdit2, FiTrash2, FiSearch, FiChevronDown, FiEye, FiFileText, FiX, FiPlus, FiClock, FiUser, FiLoader } from 'react-icons/fi';
import { supabase } from '../../../../config/supabase';
import emailjs from '@emailjs/browser';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

// Move libraries outside component to prevent re-initialization
const GOOGLE_MAPS_LIBRARIES = ['places'];

const Auser_management = () => {
  const GOOGLE_MAPS_API_KEY = 'AIzaSyBX5taF1AgNhicxw5_BXUJDs6ouniAuiQI';
  
  const { isLoaded: isMapLoaded, loadError } = useJsApiLoader({
    id: 'google-map-user-management',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // Initialize EmailJS once
  useEffect(() => {
    emailjs.init('N_WM9SM_s6cRQPVgT');
  }, []);

  const [activeTab, setActiveTab] = useState('citizens');
  const [editUser, setEditUser] = useState(null);
  const [showAddStationModal, setShowAddStationModal] = useState(false);
  const [showCitizenProfileModal, setShowCitizenProfileModal] = useState(false);
  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [activeProfileSection, setActiveProfileSection] = useState('profile'); // 'profile', 'reports', 'edit'
  const [editFormData, setEditFormData] = useState({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRespondersModal, setShowRespondersModal] = useState(false);
  const [showResponderProfileModal, setShowResponderProfileModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [stationResponders, setStationResponders] = useState([]);
  const [loadingResponders, setLoadingResponders] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedResponder, setSelectedResponder] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 10.3157, lng: 123.8854 }); // Cebu City default
  const [mapZoom, setMapZoom] = useState(13);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [placesService, setPlacesService] = useState(null);
  const [citizenReports, setCitizenReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableReason, setDisableReason] = useState('');
  const [userToDisable, setUserToDisable] = useState(null);
  const [showReEnableModal, setShowReEnableModal] = useState(false);
  const [userToReEnable, setUserToReEnable] = useState(null);
  const [showDisableStationModal, setShowDisableStationModal] = useState(false);
  const [showReEnableStationModal, setShowReEnableStationModal] = useState(false);
  const [stationToDisable, setStationToDisable] = useState(null);
  const [stationToReEnable, setStationToReEnable] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' }); // 'success' or 'error'
  const [newStation, setNewStation] = useState({
    name: '',
    stationId: '',
    location: '',
    email: '',
    phone: '',
    position: '',
    password: '',
    lat: '',
    lng: ''
  });



  // Sample data matching the mobile interface
  const [users, setUsers] = useState({ stations: [], citizens: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchUsers = async () => {
      if (!mounted) return;
      setLoading(true);
      setFetchError(null);
      try {
        // Fetch in parallel for faster loads
        const [citizensRes, stationsRes, respondersRes] = await Promise.all([
          supabase.from('citizen_users').select('*'),
          supabase.from('station_users').select('*'),
          supabase.from('responders').select('station_id')
        ]);

        if (!mounted) return;

        if (citizensRes.error) {
          console.error('Error fetching citizens from Supabase:', citizensRes.error);
        }
        if (stationsRes.error) {
          console.error('Error fetching stations from Supabase:', stationsRes.error);
        }
        if (respondersRes.error) {
          console.warn('Error fetching responders (counts only):', respondersRes.error);
        }

        const citizensData = citizensRes.data || [];
        const stationsData = stationsRes.data || [];
        const respondersData = respondersRes.data || [];

        // Citizens mapping
        const citizens = citizensData.map(data => {
  console.log('Citizen data from Supabase:', data); // Debug log
  
  // Construct full name from first_name and last_name
  let fullName = 'Unknown User';
  if (data.first_name && data.last_name) {
    fullName = `${data.first_name} ${data.last_name}`;
  } else if (data.first_name) {
    fullName = data.first_name;
  } else if (data.last_name) {
    fullName = data.last_name;
  } else if (data.display_name) {
    fullName = data.display_name;
  } else if (data.email) {
    // Extract name from email as fallback
    const emailName = data.email.split('@')[0];
    fullName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }
  
  // Determine if user is active based on status field
  const isActive = (data.status || 'active').toLowerCase() === 'active';
  // Check if user is disabled/banned
  const isDisabled = data.is_disabled === true;

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phoneNumber: data.phone, // Changed from phone_number to phone
    displayName: data.display_name,
    status: isActive ? 'active' : 'inactive',
    isDisabled: isDisabled,
    disableReason: data.disable_reason || null,
    reports: data.reports || 0,
    isVerified: data.is_verified || false,
    userType: data.user_type || 'citizen',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    name: fullName,
    // Add default values for missing fields
    lastActivity: data.created_at ? 'Recently active' : 'Unknown',
    phone: data.phone || 'No phone' // Changed from phone_number to phone
  };
});

        // Stations mapping
        const stations = stationsData.map(data => {
          console.log('🔍 Station data from Supabase:', { id: data.id, ...data }); // Debug log
          
          // Determine if station is active based on status
          const isActive = (data.status || 'active').toLowerCase() === 'active';
          
          return {
            id: data.id,
            ...data,
            // Add default values for missing fields
            name: data.station_name || 'Unnamed Station',
            stationName: data.station_name || 'Unnamed Station',
            address: data.address || 'Address not specified',
            number: data.phone || 'No number',
            location: data.address || 'Address not specified',
            lastUpdate: data.updated_at ? 'Recently updated' : 'Unknown',
            responders: 0, // Will be updated below
            status: isActive ? 'active' : 'inactive',
            phone: data.phone || 'No number',
            isOnline: data.is_online || false
          };
        });

        // Responder counts per station
        const supabaseResponders = respondersData;
        if (supabaseResponders && supabaseResponders.length > 0) {
          // Count responders by station_id
          const responderCounts = {};
          
          supabaseResponders.forEach(responder => {
            if (responder.station_id) {
              responderCounts[responder.station_id] = (responderCounts[responder.station_id] || 0) + 1;
            }
          });
          
          // Update stations with responder counts using station ID
          stations.forEach(station => {
            station.responders = responderCounts[station.id] || 0;
          });
        } else {
          console.log('No responders or failed to fetch responder counts; defaulting to 0');
          // Set default responder count to 0
          stations.forEach(station => {
            station.responders = 0;
          });
        }
        
        console.log('📊 Processed stations data:', stations);
        console.log('📊 Total citizens fetched:', citizens.length);
        console.log('📊 Total stations fetched:', stations.length);
        console.log('📊 Citizens data sample:', citizens.slice(0, 2));
        console.log('📊 Stations data sample:', stations.slice(0, 2));

        if (mounted) {
          setUsers({ citizens, stations });
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        if (mounted) {
          setFetchError(error.message || 'Failed to load user data');
          setUsers({ citizens: [], stations: [] });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch citizen reports when viewing reports section
  useEffect(() => {
    let mounted = true;

    const fetchCitizenReports = async () => {
      if (!selectedCitizen || activeProfileSection !== 'reports') {
        setCitizenReports([]);
        return;
      }

      setLoadingReports(true);
      try {
        const response = await fetch('https://fire-detection-api-production-f55b.up.railway.app/get_reports');
        if (!response.ok) {
          throw new Error('Failed to fetch reports');
        }

        const allReports = await response.json();
        console.log('📊 All reports fetched:', allReports.length);

        // Filter for this citizen's Fire Out reports
        const fireOutReports = allReports.filter(report => {
          const isFireOut = report.status?.toLowerCase().includes('fire out');
          const matchesReporter = 
            report.reporter?.toLowerCase().includes(selectedCitizen.name?.toLowerCase()) ||
            report.reporter?.toLowerCase().includes(selectedCitizen.email?.toLowerCase()) ||
            report.email?.toLowerCase() === selectedCitizen.email?.toLowerCase();
          
          return isFireOut && matchesReporter;
        });

        console.log('🔥 Fire Out reports for citizen:', fireOutReports.length);
        
        if (mounted) {
          setCitizenReports(fireOutReports);
        }
      } catch (error) {
        console.error('Error fetching citizen reports:', error);
        if (mounted) {
          setCitizenReports([]);
        }
      } finally {
        if (mounted) {
          setLoadingReports(false);
        }
      }
    };

    fetchCitizenReports();

    return () => {
      mounted = false;
    };
  }, [selectedCitizen, activeProfileSection]);

  // Filter users based on search query
  const filteredUsers = users[activeTab]?.filter(user => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    if (activeTab === 'citizens') {
      return (
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.phoneNumber?.toLowerCase().includes(query) ||
        user.displayName?.toLowerCase().includes(query)
      );
    } else {
      return (
        user.name?.toLowerCase().includes(query) ||
        user.stationName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.address?.toLowerCase().includes(query) ||
        user.location?.toLowerCase().includes(query)
      );
    }
  }) || [];



  const handleViewCitizenProfile = (citizen) => {
    setSelectedCitizen(citizen);
    setShowCitizenProfileModal(true);
    setActiveProfileSection('profile');
    setEditFormData({
      firstName: citizen.firstName || '',
      lastName: citizen.lastName || '',
      email: citizen.email || '',
      phone: citizen.phone || citizen.phoneNumber || ''
    });
  };

  const handleViewStationProfile = (station) => {
    setSelectedCitizen(station); // Reuse the same modal state
    setShowCitizenProfileModal(true);
    setActiveProfileSection('profile');
    setEditFormData({
      stationName: station.stationName || station.name || '',
      address: station.address || station.location || '',
      number: station.number || station.phone || '',
      position: station.position || station.role || '',
      email: station.email || ''
    });
  };

  const handleEditProfile = (user) => {
    setSelectedUser(user);
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    try {
      console.log('Saving profile:', editFormData);
      
      if (activeTab === 'citizens') {
        // Update citizen profile in Supabase
        const { data, error } = await supabase
          .from('citizen_users')
          .update({
            first_name: editFormData.firstName,
            last_name: editFormData.lastName,
            email: editFormData.email,
            phone_number: editFormData.phone,
            display_name: `${editFormData.firstName} ${editFormData.lastName}`.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedCitizen.id)
          .select();

        if (error) {
          console.error('Error updating citizen in Supabase:', error);
          throw new Error(`Failed to update citizen: ${error.message}`);
        }

        // Update local state
        setUsers(prev => ({
          ...prev,
          citizens: prev.citizens.map(citizen => 
            citizen.id === selectedCitizen.id 
              ? { 
                  ...citizen, 
                  ...editFormData,
                  name: `${editFormData.firstName} ${editFormData.lastName}`.trim(),
                  firstName: editFormData.firstName,
                  lastName: editFormData.lastName,
                  phoneNumber: editFormData.phone
                }
              : citizen
          )
        }));
      } else {
        // Update station profile in Supabase
        const { data, error } = await supabase
          .from('station_users')
          .update({
            station_name: editFormData.stationName,
            address: editFormData.address,
            phone: editFormData.number,
            position: editFormData.position,
            email: editFormData.email,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedCitizen.id)
          .select();

        if (error) {
          console.error('Error updating station in Supabase:', error);
          throw new Error(`Failed to update station: ${error.message}`);
        }

        // Update local state
        setUsers(prev => ({
          ...prev,
          stations: prev.stations.map(station => 
            station.id === selectedCitizen.id 
              ? { 
                  ...station, 
                  stationName: editFormData.stationName,
                  address: editFormData.address,
                  number: editFormData.number,
                  position: editFormData.position,
                  email: editFormData.email
                }
              : station
          )
        }));
      }
      
      setActiveProfileSection('profile');
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  };

  const handleCancelEdit = () => {
    setActiveProfileSection('profile');
    if (activeTab === 'citizens') {
      setEditFormData({
        firstName: selectedCitizen.firstName || '',
        lastName: selectedCitizen.lastName || '',
        email: selectedCitizen.email || '',
        phone: selectedCitizen.phone || selectedCitizen.phoneNumber || ''
      });
    } else {
      // Station data
      setEditFormData({
        stationName: selectedCitizen.stationName || selectedCitizen.name || '',
        address: selectedCitizen.address || selectedCitizen.location || '',
        number: selectedCitizen.number || selectedCitizen.phone || '',
        position: selectedCitizen.position || selectedCitizen.role || '',
        email: selectedCitizen.email || ''
      });
    }
  };

  const handleViewHistory = (user) => {
    setSelectedUser(user);
    setShowHistoryModal(true);
  };

  const handleViewResponders = async (station) => {
    setSelectedStation(station);
    setLoadingResponders(true);
    setShowRespondersModal(true);
    
    try {
      // Fetch from Supabase responders table
      const { data: supabaseResponders, error: supabaseError } = await supabase
        .from('responders')
        .select('*')
        .eq('station_id', station.id);
      
      if (!supabaseError && supabaseResponders) {
        // Map Supabase responder data to match expected format
        const responders = supabaseResponders.map(resp => ({
          id: resp.id,
          firstName: resp.first_name,
          lastName: resp.last_name,
          email: resp.email,
          phoneNumber: resp.phone,
          position: resp.user_position,
          address: resp.address || 'Not specified',
          stationName: station.stationName,
          active: resp.status === 'active' || resp.active !== false,
          createdAt: resp.created_at
        }));
        
        setStationResponders(responders);
        
        // Update the responder count in the stations list
        setUsers(prev => ({
          ...prev,
          stations: prev.stations.map(s => 
            s.id === station.id 
              ? { ...s, responders: responders.length }
              : s
          )
        }));
      } else {
        console.error('Error fetching responders:', supabaseError);
        setStationResponders([]);
      }
    } catch (error) {
      console.error('Error fetching station responders:', error);
      alert('Error fetching responders for this station');
    } finally {
      setLoadingResponders(false);
    }
  };

  // Handle disable/ban for citizens (shows modal with reason)
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

  // Confirm re-enable action
  const handleConfirmReEnable = async () => {
    if (!userToReEnable) return;

    try {
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
        throw new Error(`Failed to re-enable citizen: ${error.message}`);
      }

      // Update local state
      setUsers(prev => ({
        ...prev,
        citizens: prev.citizens.map(user => 
          user.id === userToReEnable.id 
            ? { ...user, isDisabled: false, disableReason: null } 
            : user
        )
      }));

      setShowReEnableModal(false);
      setUserToReEnable(null);
      setToast({ show: true, message: 'Account re-enabled successfully!', type: 'success' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    } catch (error) {
      console.error('Error re-enabling citizen:', error);
      setToast({ show: true, message: `Failed to re-enable citizen: ${error.message}`, type: 'error' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    }
  };

  // Confirm disable action
  const handleConfirmDisable = async () => {
    if (!userToDisable) return;
    
    if (!disableReason.trim()) {
      setToast({ show: true, message: 'Please provide a reason for disabling this citizen.', type: 'error' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
      return;
    }

    try {
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
        throw new Error(`Failed to disable citizen: ${error.message}`);
      }

      // Update local state
      setUsers(prev => ({
        ...prev,
        citizens: prev.citizens.map(user => 
          user.id === userToDisable.id 
            ? { ...user, isDisabled: true, disableReason: disableReason.trim() } 
            : user
        )
      }));

      setShowDisableModal(false);
      setDisableReason('');
      setUserToDisable(null);
      setToast({ show: true, message: 'Account disabled successfully!', type: 'success' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    } catch (error) {
      console.error('Error disabling citizen:', error);
      setToast({ show: true, message: `Failed to disable citizen: ${error.message}`, type: 'error' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    }
  };

  // Handle disable for stations (shows modal)
  const handleDisableStation = (station) => {
    setStationToDisable(station);
    setShowDisableStationModal(true);
  };

  // Handle re-enable for stations (shows modal)
  const handleReEnableStation = (station) => {
    setStationToReEnable(station);
    setShowReEnableStationModal(true);
  };

  // Confirm disable station action
  const handleConfirmDisableStation = async () => {
    if (!stationToDisable) return;

    try {
      const { error } = await supabase
        .from('station_users')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', stationToDisable.id);

      if (error) {
        console.error('Error disabling station:', error);
        throw new Error(`Failed to disable station: ${error.message}`);
      }

      // Update local state
      setUsers(prev => ({
        ...prev,
        stations: prev.stations.map(station => 
          station.id === stationToDisable.id 
            ? { ...station, status: 'inactive' } 
            : station
        )
      }));

      setShowDisableStationModal(false);
      setStationToDisable(null);
      setToast({ show: true, message: 'Station disabled successfully!', type: 'success' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    } catch (error) {
      console.error('Error disabling station:', error);
      setToast({ show: true, message: `Failed to disable station: ${error.message}`, type: 'error' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    }
  };

  // Confirm re-enable station action
  const handleConfirmReEnableStation = async () => {
    if (!stationToReEnable) return;

    try {
      const { error } = await supabase
        .from('station_users')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', stationToReEnable.id);

      if (error) {
        console.error('Error re-enabling station:', error);
        throw new Error(`Failed to re-enable station: ${error.message}`);
      }

      // Update local state
      setUsers(prev => ({
        ...prev,
        stations: prev.stations.map(station => 
          station.id === stationToReEnable.id 
            ? { ...station, status: 'active' } 
            : station
        )
      }));

      setShowReEnableStationModal(false);
      setStationToReEnable(null);
      setToast({ show: true, message: 'Station re-enabled successfully!', type: 'success' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    } catch (error) {
      console.error('Error re-enabling station:', error);
      setToast({ show: true, message: `Failed to re-enable station: ${error.message}`, type: 'error' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    }
  };

  const handleToggleStatus = async (type, id) => {
    // For citizens, use the disable/re-enable flow
    if (type === 'citizens') {
      const user = users[type].find(user => user.id === id);
      if (user?.isDisabled) {
        handleReEnableCitizen(user);
      } else {
        handleDisableCitizen(user);
      }
      return;
    }

    // For stations, use the disable/re-enable flow with modals
    if (type === 'stations') {
      const station = users[type].find(station => station.id === id);
      if (station?.status === 'inactive') {
        handleReEnableStation(station);
      } else {
        handleDisableStation(station);
      }
      return;
    }
  };

  const handleViewResponderProfile = (responderIndex) => {
    setSelectedResponder({
      id: responderIndex + 1,
      name: `Responder ${responderIndex + 1}`,
      position: 'Firefighter',
      address: '123 Fire Station St, City',
      phone: `+1-555-012${responderIndex + 1}`,
      status: 'Active',
      experience: '5 years',
      specializations: ['Fire Suppression', 'Rescue Operations', 'Hazmat'],
      email: `responder${responderIndex + 1}@fira.com`
    });
    setShowResponderProfileModal(true);
  };



  const handleDisableResponder = (responderIndex) => {
    if (window.confirm(`Are you sure you want to disable Responder ${responderIndex + 1}?`)) {
      alert(`Responder ${responderIndex + 1} has been disabled successfully!`);
    }
  };

  const handleAddStation = async () => {
    if (!newStation.name || !newStation.location || !newStation.email || !newStation.password) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Check if email already exists in Supabase
      const { data: existingStations, error: checkError } = await supabase
        .from('station_users')
        .select('email')
        .eq('email', newStation.email.toLowerCase());

      if (checkError) {
        console.error('Error checking email:', checkError);
        throw new Error(`Error checking email: ${checkError.message}`);
      }

      if (existingStations && existingStations.length > 0) {
        alert('A station with this email already exists. Please use a different email address.');
        return;
      }

      // Create Supabase Auth account for the station
      console.log('🔐 Creating Supabase Auth account for station...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newStation.email.toLowerCase(),
        password: newStation.password,
        options: {
          data: {
            full_name: newStation.name,
            display_name: newStation.name,
            station_name: newStation.name,
            user_type: 'station',
            role: 'station'
          }
        }
      });

      if (authError) {
        console.error('❌ Error creating Supabase Auth account:', authError);
        alert(`Error creating station account: ${authError.message}`);
        return;
      }

      console.log('✅ Supabase Auth account created:', authData.user.id);

      // Create station data for Supabase (linked to auth user)
      const supabaseData = {
        user_id: authData.user.id,
        station_name: newStation.name,
        email: newStation.email.toLowerCase(),
        address: newStation.location,
        phone: newStation.phone || '',
        position: newStation.position || '',
        lat: newStation.lat ? parseFloat(newStation.lat) : null,
        lng: newStation.lng ? parseFloat(newStation.lng) : null,
        role: 'stationUser',
        active: true,
        status: 'active',
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add to Supabase
      console.log('💾 Storing station data in Supabase...');
      console.log('📋 Station data to insert:', supabaseData);
      
      let insertedData;
      try {
        const { data, error } = await supabase
          .from('station_users')
          .insert([supabaseData])
          .select();

        if (error) {
          console.error('❌ Supabase error details:', error);
          throw new Error(`Supabase error: ${error.message} (Code: ${error.code})`);
        }

        console.log('✅ Station data stored in Supabase:', data[0]);
        insertedData = data[0];
      } catch (networkError) {
        console.error('❌ Network error:', networkError);
        throw new Error(`Network error: ${networkError.message}. Please check your internet connection and try again.`);
      }
      
      // Create the station object for local state
      const station = {
        id: insertedData.id,
        name: newStation.name,
        stationName: newStation.name,
        address: newStation.location,
        number: newStation.phone || '',
        position: newStation.position || '',
        email: newStation.email,
        lastUpdate: 'Recently updated',
        responders: 0,
        status: 'active',
        isOnline: false,
        createdAt: supabaseData.created_at
      };
      
      // Update local state
      setUsers(prev => ({
        ...prev,
        stations: [...prev.stations, station]
      }));
      
      // Send email with credentials
      await sendWelcomeEmail(newStation.email, newStation.name, newStation.password);
      
      // Clear form
      setNewStation({
        name: '',
        stationId: '',
        location: '',
        email: '',
        phone: '',
        position: '',
        password: '',
        lat: '',
        lng: ''
      });
      
      setShowAddStationModal(false);
      alert('Station added successfully!');
      
    } catch (error) {
      console.error('Error adding station:', error);
      
      // Check if it's a duplicate email error
      if (error.message.includes('duplicate key value violates unique constraint "station_users_email_key"')) {
        alert('A station with this email already exists. Please use a different email address.');
      } else {
        alert(`Error adding station: ${error.message}`);
      }
    }
  };

  const sendWelcomeEmail = async (email, stationName, password) => {
    try {
      console.log('🚀 Starting email send process for station...');
      console.log('📧 EmailJS configuration:', {
        serviceId: 'service_5k3e6xe',
        templateId: 'template_ztp029i',
        publicKey: 'N_WM9SM_s6cRQPVgT'
      });
      
      // EmailJS configuration
      const serviceId = 'service_5k3e6xe'; // Your EmailJS service ID
      const templateId = 'template_ztp029i'; // Your EmailJS template ID
      const publicKey = 'N_WM9SM_s6cRQPVgT'; // Your EmailJS public key
      
      const templateParams = {
        to_name: stationName,
        user_email: email,
        user_password: password
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
      // Don't throw error here as the station was still created successfully
      // Email failed but station was created - no user notification
    }
  };

  // Refresh responder counts for all stations
  const refreshResponderCounts = async () => {
    try {
      console.log('🔄 Refreshing responder counts...');
      
      // Fetch from Supabase responders table
      const { data: supabaseResponders, error } = await supabase
        .from('responders')
        .select('station_id');
      
      if (!error && supabaseResponders) {
        const responderCounts = {};
        
        supabaseResponders.forEach(responder => {
          if (responder.station_id) {
            responderCounts[responder.station_id] = (responderCounts[responder.station_id] || 0) + 1;
          }
        });
        
        // Update stations with new responder counts
        setUsers(prev => ({
          ...prev,
          stations: prev.stations.map(station => ({
            ...station,
            responders: responderCounts[station.id] || 0
          }))
        }));
        
        console.log('✅ Responder counts refreshed from Supabase');
      } else {
        console.error('❌ Error fetching responders:', error);
        // Set all responder counts to 0
        setUsers(prev => ({
          ...prev,
          stations: prev.stations.map(station => ({
            ...station,
            responders: 0
          }))
        }));
      }
    } catch (error) {
      console.error('❌ Error refreshing responder counts:', error);
    }
  };

  // Calculate statistics safely
  const totalUsers = (users?.citizens?.length || 0) + (users?.stations?.length || 0);

  const activeUsers = (users?.citizens?.filter(u => u.status === 'active')?.length || 0) + 
                     (users?.stations?.filter(u => u.status === 'active')?.length || 0);

  // Show loading screen while fetching data
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-medium">Loading user data...</p>
        </div>
      </div>
    );
  }

  // Show error screen if data fetch failed
  if (fetchError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">
            <FiUserX className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Data</h3>
          <p className="text-gray-600 mb-4">{fetchError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toast Notification */}
      {toast.show && (
        <div 
          className={`fixed top-4 right-4 z-50 transition-all duration-300 transform ${
            toast.show ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
          }`}
          style={{
            animation: toast.show ? 'slideInRight 0.3s ease-out' : 'none'
          }}
        >
          <div className={`${
            toast.type === 'success' 
              ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
              : 'bg-gradient-to-r from-red-500 to-red-600'
          } text-white shadow-2xl rounded-xl px-6 py-4 flex items-center space-x-4 min-w-[300px] max-w-md`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              toast.type === 'success' ? 'bg-white/20' : 'bg-white/20'
            }`}>
              {toast.type === 'success' ? (
                <FiUserCheck className="w-5 h-5 text-white" />
              ) : (
                <FiUserX className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <FiUsers className="w-6 h-6 text-blue-600" />
                </div>
              </div>
        </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-3xl font-bold text-green-600">{activeUsers}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <FiUserCheck className="w-6 h-6 text-green-600" />
                </div>
                </div>
              </div>
            </div>
            
          {/* Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="flex border-b">
                        <button
              onClick={() => {
                setActiveTab('citizens');
                setSearchQuery(''); // Clear search when switching tabs
              }}
              className={`flex-1 py-4 px-6 text-center font-medium text-sm ${
                activeTab === 'citizens' 
                  ? 'text-red-600 border-b-2 border-red-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Citizens ({users.citizens.length})
                        </button>
                        <button
              onClick={() => {
                setActiveTab('stations');
                setSearchQuery(''); // Clear search when switching tabs
              }}
              className={`flex-1 py-4 px-6 text-center font-medium text-sm ${
                activeTab === 'stations' 
                  ? 'text-red-600 border-b-2 border-red-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Stations ({users.stations.length})
                        </button>
            </div>
          </div>



          

          {/* Search and Add Button */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="relative flex-1 max-w-lg">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'citizens' ? 'Search citizens...' : 'Search stations...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 py-3 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {activeTab === 'stations' && (
                  <>
                    <button
                      onClick={refreshResponderCounts}
                      className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FiLoader className="mr-2" />
                      Refresh Counts
                    </button>
                    <button
                      onClick={() => setShowAddStationModal(true)}
                      className="flex items-center justify-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <FiPlus className="mr-2" />
                      Add New Station
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
            

          {/* Users List */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {activeTab === 'citizens' ? 'Citizens' : 'Stations'} ({filteredUsers.length})
                {searchQuery && (
                  <span className="text-sm text-gray-500 ml-2">
                    (filtered from {users[activeTab]?.length || 0} total)
                  </span>
                )}
              </h2>
            </div>
            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                {searchQuery ? 
                  `No ${activeTab} found matching "${searchQuery}"` : 
                  `No ${activeTab} available`
                }
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <div key={user.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <FiUser className="w-6 h-6 text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {activeTab === 'citizens' ? user.name : user.stationName || user.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {activeTab === 'citizens' ? user.email : user.location || user.address || 'Location not specified'}
                          </p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-sm text-gray-500">
                              {activeTab === 'citizens' ? `Last activity: ${user.lastActivity}` : `Last update: ${user.lastUpdate}`}
                            </span>
                            <span className="text-sm text-blue-600">
                              {activeTab === 'citizens' ? (
                                `Reports: ${user.reports}`
                              ) : (
                                <button 
                                  onClick={() => handleViewResponders(user)}
                                  className="hover:underline cursor-pointer"
                                  title="Click to view responders"
                                >
                                  Responders: {user.responders}
                                </button>
                              )}
                            </span>
                            {activeTab === 'stations' && (
                              <span className={`text-sm px-2 py-1 rounded-full ${
                                user.isOnline 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {user.isOnline ? '🟢 Online' : '🔴 Offline'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            user.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                          {activeTab === 'citizens' && user.isDisabled && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
                              🚫 Disabled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => activeTab === 'citizens' ? handleViewCitizenProfile(user) : handleViewStationProfile(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                            title={activeTab === 'citizens' ? 'View Citizen Profile' : 'View Station Profile'}
                          >
                            <FiEye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedCitizen(user);
                              setShowCitizenProfileModal(true);
                              setActiveProfileSection('reports');
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-full"
                            title="View Reports History"
                          >
                            <FiClock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(activeTab, user.id)}
                            className={`p-2 rounded-full ${
                              activeTab === 'citizens' && user.isDisabled
                                ? 'text-green-600 hover:bg-green-50'
                                : user.status === 'active' 
                                ? 'text-red-600 hover:bg-red-50' 
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={
                              activeTab === 'citizens' && user.isDisabled
                                ? 'Re-enable Citizen'
                                : user.status === 'active' 
                                ? 'Disable' 
                                : 'Enable'
                            }
                          >
                            {activeTab === 'citizens' && user.isDisabled ? (
                              <FiUserCheck className="w-4 h-4" />
                            ) : user.status === 'active' ? (
                              <FiUserX className="w-4 h-4" />
                            ) : (
                              <FiUserCheck className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Citizen Profile Modal */}
      {showCitizenProfileModal && selectedCitizen && (
            <div 
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-lg"
              onClick={() => setShowCitizenProfileModal(false)}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-5xl w-full mx-4 h-[85vh] flex flex-col border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      {activeTab === 'citizens' ? 
                        (activeProfileSection === 'profile' ? 'Citizen Profile' : 
                         activeProfileSection === 'reports' ? 'Citizen Reports History' : 'Citizen Profile') 
                        : 'Station Profile'}
                    </h2>
                    <p className="text-gray-600">
                      {activeProfileSection === 'profile' ? 'View and manage user information' :
                       activeProfileSection === 'reports' ? 'View resolved fire reports' : 
                       'View and manage user information'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCitizenProfileModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                                   {/* Navigation Tabs */}
                  <div className="flex border-b border-gray-200 mb-8 flex-shrink-0 bg-gray-50 rounded-lg p-1">
                    <button
                      onClick={() => setActiveProfileSection('profile')}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                        activeProfileSection === 'profile'
                          ? 'text-white bg-gradient-to-r from-red-600 to-red-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center">
                        <FiUser className="w-4 h-4 mr-2" />
                        Profile
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveProfileSection('reports')}
                      className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                        activeProfileSection === 'reports'
                          ? 'text-white bg-gradient-to-r from-red-600 to-red-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center">
                        <FiFileText className="w-4 h-4 mr-2" />
                        Reports History
                      </span>
                    </button>
                  </div>

                  {/* Scrollable Content Area */}
                  <div className={`flex-1 ${activeProfileSection === 'reports' ? 'overflow-y-auto' : ''}`}>

                                   {/* Profile Section */}
                  {activeProfileSection === 'profile' && (
                    <div className="space-y-8">
                      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border border-red-100">
                        <div className="flex items-center space-x-6">
                          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                            <FiUser className="w-10 h-10 text-white" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedCitizen.name}</h3>
                            <p className="text-gray-600 mb-1">{selectedCitizen.email}</p>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              selectedCitizen.status === 'active' 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {selectedCitizen.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                            {activeTab === 'citizens' && selectedCitizen.isDisabled && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-600 text-white border border-red-700 ml-2">
                                🚫 Disabled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Disable Reason Alert */}
                      {activeTab === 'citizens' && selectedCitizen.isDisabled && selectedCitizen.disableReason && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
                          <div className="flex items-start">
                            <FiUserX className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="text-red-900 font-semibold mb-1">Account Disabled</h4>
                              <p className="text-red-700 text-sm mb-2">This citizen account has been disabled by an administrator.</p>
                              <div className="bg-white rounded-lg p-3 border border-red-200">
                                <p className="text-xs font-medium text-red-600 mb-1">Reason:</p>
                                <p className="text-gray-800 text-sm">{selectedCitizen.disableReason}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <FiUser className="w-5 h-5 mr-2 text-red-600" />
                            Personal Information
                          </h4>
                          <div className="space-y-4">
                                                         <div>
                               <span className="text-sm font-medium text-gray-500 block mb-1">Phone Number</span>
                               <p className="text-gray-900">{selectedCitizen.phone || selectedCitizen.phoneNumber || 'Not provided'}</p>
                             </div>
                             {selectedCitizen.firstName && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">First Name</span>
                                 <p className="text-gray-900">{selectedCitizen.firstName}</p>
                               </div>
                             )}
                             {selectedCitizen.lastName && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">Last Name</span>
                                 <p className="text-gray-900">{selectedCitizen.lastName}</p>
                               </div>
                             )}
                           </div>
                         </div>

                         <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                           <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                             <FiClock className="w-5 h-5 mr-2 text-red-600" />
                             Activity Information
                           </h4>
                           <div className="space-y-4">
                             <div>
                               <span className="text-sm font-medium text-gray-500 block mb-1">Status</span>
                               <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                 selectedCitizen.status === 'active' 
                                   ? 'bg-green-100 text-green-800 border border-green-200' 
                                   : 'bg-red-100 text-red-800 border border-red-200'
                               }`}>
                                 {selectedCitizen.status === 'active' ? 'Active' : 'Inactive'}
                               </span>
                             </div>
                             <div>
                               <span className="text-sm font-medium text-gray-500 block mb-1">Last Activity</span>
                               <p className="text-gray-900">{selectedCitizen.lastActivity}</p>
                             </div>
                             {activeTab === 'citizens' && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">Total Reports</span>
                                 <p className="text-gray-900">{selectedCitizen.reports}</p>
                               </div>
                             )}
                             {activeTab === 'stations' && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">Responders</span>
                                 <p className="text-gray-900">{selectedCitizen.responders}</p>
                               </div>
                             )}
                             {selectedCitizen.createdAt && (
                               <div>
                                 <span className="text-sm font-medium text-gray-500 block mb-1">Created Date</span>
                                 <p className="text-gray-900">{new Date(selectedCitizen.createdAt).toLocaleDateString()}</p>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     </div>
                   )}

                                    {/* Reports History Section */}
                   {activeProfileSection === 'reports' && (
                     <div className="space-y-6">
                       {loadingReports ? (
                         <div className="flex justify-center items-center py-12">
                           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                           <p className="ml-4 text-gray-600">Loading Fire Out reports...</p>
                         </div>
                       ) : citizenReports.length === 0 ? (
                         <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                           <FiFileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                           <h4 className="text-lg font-semibold text-gray-900 mb-2">No Fire Out Reports</h4>
                           <p className="text-gray-600">This citizen has no resolved fire reports yet.</p>
                         </div>
                       ) : (
                         <div className="space-y-4">
                           {citizenReports.map((report, index) => (
                             <div key={index} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                               {/* Red Header */}
                               <div className="bg-red-600 px-6 py-4 flex items-center">
                                 <span className="text-3xl mr-3">🔥</span>
                                 <h3 className="text-white text-xl font-bold">Fire Report</h3>
                               </div>

                               {/* Report Content */}
                               <div className="p-6 space-y-4">
                                 {/* Reporter and Reported Time - Side by Side */}
                                 <div className="grid grid-cols-2 gap-4">
                                   <div>
                                     <span className="text-gray-600 font-medium block mb-1">Reporter:</span>
                                     <span className="text-gray-900 font-semibold">{report.reporter || selectedCitizen.name}</span>
                                   </div>
                                   <div>
                                     <span className="text-gray-600 font-medium block mb-1">Reported:</span>
                                     <span className="text-gray-900 font-semibold">
                                       {report.created_at || report.timestamp 
                                         ? new Date(report.created_at || report.timestamp).toLocaleString('en-US', {
                                             month: 'short',
                                             day: 'numeric',
                                             year: 'numeric',
                                             hour: 'numeric',
                                             minute: '2-digit',
                                             hour12: true
                                           }).replace(',', '')
                                         : 'N/A'}
                                     </span>
                                   </div>
                                 </div>

                                 {/* Location with Coordinates */}
                                 <div>
                                   <span className="text-gray-600 font-medium block mb-1">Location:</span>
                                   <span className="text-blue-600 font-semibold block">{report.address || report.geotag_location || 'Location not available'}</span>
                                   {(report.latitude || report.longitude) && (
                                     <span className="text-gray-500 text-sm">
                                       Coordinates: {report.latitude || 'N/A'}, {report.longitude || 'N/A'}
                                     </span>
                                   )}
                                 </div>

                                 {/* Cause of Fire */}
                                 {report.cause_of_fire && (
                                   <div>
                                     <span className="text-gray-600 font-medium block mb-1">Cause of Fire:</span>
                                     <span className="text-gray-900 font-semibold">{report.cause_of_fire}</span>
                                   </div>
                                 )}

                                 {/* AI Analysis Results Section */}
                                 <div className="bg-blue-50 rounded-lg p-4">
                                   <h4 className="text-blue-900 font-bold mb-3">AI Analysis Results</h4>
                                   
                                   <div className="grid grid-cols-2 gap-4">
                                     {/* Fire Detection */}
                                     <div>
                                       <span className="text-blue-700 font-medium block mb-1">Fire Detection:</span>
                                       <span className="text-blue-900 font-semibold block">
                                         {report.prediction || 'N/A'} ({report.confidence ? typeof report.confidence === 'number' ? `${(report.confidence * 100).toFixed(2)}%` : report.confidence : 'N/A'})
                                       </span>
                                     </div>

                                     {/* Structure Type */}
                                     <div>
                                       <span className="text-blue-700 font-medium block mb-1">Structure Type:</span>
                                       <span className="text-blue-900 font-semibold block">
                                         {report.structure || 'Unknown'}
                                         {report.structure_confidence && (
                                           <span className="text-sm text-blue-700"> ({typeof report.structure_confidence === 'number' ? `${(report.structure_confidence * 100).toFixed(2)}%` : report.structure_confidence})</span>
                                         )}
                                       </span>
                                     </div>

                                     {/* Smoke Intensity */}
                                     <div>
                                       <span className="text-blue-700 font-medium block mb-1">Smoke Intensity:</span>
                                       <span className="text-blue-900 font-semibold block">
                                         {report.smoke_detection || report.smoke_intensity || 'N/A'} {report.smoke_confidence && (
                                           <span className="text-sm text-blue-700">
                                             ({typeof report.smoke_confidence === 'number' ? `${(report.smoke_confidence * 100).toFixed(2)}%` : report.smoke_confidence})
                                           </span>
                                         )}
                                       </span>
                                     </div>

                                     {/* Structures Affected */}
                                     <div>
                                       <span className="text-blue-700 font-medium block mb-1">Structures Affected:</span>
                                       <span className="text-blue-900 font-semibold block">
                                         {report.number_of_structures_on_fire || report.structures_affected || 'Unknown'}
                                       </span>
                                     </div>
                                   </div>
                                 </div>

                                 {/* Status and Alarm Levels */}
                                 <div className="grid grid-cols-3 gap-4">
                                   {/* Current Status */}
                                   <div>
                                     <span className="text-gray-600 font-medium block mb-2">Current Status:</span>
                                     <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-bold inline-block">
                                       {report.status || 'Fire Out'}
                                     </span>
                                   </div>

                                   {/* Suggested Alarm Level */}
                                   {report.suggested_alarm_level && (
                                     <div>
                                       <span className="text-gray-600 font-medium block mb-2">Suggested Alarm Level:</span>
                                       <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded text-sm font-bold inline-block">
                                         {report.suggested_alarm_level}
                                       </span>
                                     </div>
                                   )}

                                   {/* Final Alarm Level */}
                                   {report.alarm_level && (
                                     <div>
                                       <span className="text-gray-600 font-medium block mb-2">Final Alarm Level:</span>
                                       <span className={`px-3 py-1 rounded text-sm font-bold inline-block ${
                                         report.alarm_level === '1st Alarm' ? 'bg-yellow-400 text-yellow-900' :
                                         report.alarm_level === '2nd Alarm' ? 'bg-orange-400 text-orange-900' :
                                         report.alarm_level === '3rd Alarm' ? 'bg-red-500 text-white' :
                                         'bg-gray-300 text-gray-900'
                                       }`}>
                                         {report.alarm_level}
                                       </span>
                                     </div>
                                   )}
                                 </div>

                                 {/* Report Image */}
                                 {report.image_url && (
                                   <div className="mt-4">
                                     <img 
                                       src={report.image_url} 
                                       alt="Fire report" 
                                       className="w-full rounded-lg border border-gray-200"
                                       onError={(e) => {
                                         e.target.onerror = null;
                                         e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Available';
                                       }}
                                     />
                                   </div>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   )}

                                    {/* Edit Profile Section */}
                   {activeProfileSection === 'edit' && (
                     <div className="space-y-6">
                       
                       
                       <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {activeTab === 'citizens' ? (
                             // Citizen fields
                             <>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                                 <input
                                   type="text"
                                   value={editFormData.firstName || ''}
                                   onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter first name"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                                 <input
                                   type="text"
                                   value={editFormData.lastName || ''}
                                   onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter last name"
                                 />
                               </div>
                             </>
                           ) : (
                             // Station fields
                             <>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Station Name</label>
                                 <input
                                   type="text"
                                   value={editFormData.stationName || ''}
                                   onChange={(e) => setEditFormData({...editFormData, stationName: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter station name"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                                 <input
                                   type="text"
                                   value={editFormData.address || ''}
                                   onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter station address"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Number</label>
                                 <input
                                   type="tel"
                                   value={editFormData.number || ''}
                                   onChange={(e) => setEditFormData({...editFormData, number: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter phone number"
                                 />
                               </div>
                               <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                                 <input
                                   type="text"
                                   value={editFormData.position || ''}
                                   onChange={(e) => setEditFormData({...editFormData, position: e.target.value})}
                                   className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                   placeholder="Enter position/role"
                                 />
                               </div>
                             </>
                           )}
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                             <input
                               type="email"
                               value={editFormData.email || ''}
                               onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                               className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                               placeholder="Enter email address"
                             />
                           </div>
                           {activeTab === 'citizens' && (
                             <div>
                               <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                               <input
                                 type="tel"
                                 value={editFormData.phone || ''}
                                 onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                                 className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                                 placeholder="Enter phone number"
                               />
                             </div>
                           )}
                         </div>
                         <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 mt-6">
                           <button
                             onClick={handleCancelEdit}
                             className="px-6 py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                           >
                             Cancel
                           </button>
                           <button
                             onClick={handleSaveProfile}
                             className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                           >
                             Save Changes
                           </button>
                         </div>
                       </div>
                     </div>
                   )}

                                   {/* Bottom Actions */}
                  <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200 flex-shrink-0">
                    {/* Close button removed as requested */}
                  </div>
                </div>
              </div>
            </div>
          )}
          







          {/* Add Station Modal */}
          {showAddStationModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-lg" onClick={() => setShowAddStationModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Add New Station</h2>
                    <p className="text-gray-600">Create a new station account</p>
                  </div>
                  <button
                    onClick={() => setShowAddStationModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleAddStation(); }} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Station Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newStation.name}
                        onChange={(e) => setNewStation({...newStation, name: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter station name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={newStation.location}
                          onChange={(e) => setNewStation({...newStation, location: e.target.value})}
                          className="w-full px-4 py-3 pr-24 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                          placeholder="Click 'Pick on Map' or enter manually"
                          required
                          readOnly={showMapPicker}
                        />
                        <button
                          type="button"
                          onClick={() => setShowMapPicker(!showMapPicker)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
                        >
                          {showMapPicker ? 'Close Map' : 'Pick on Map'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={newStation.email}
                        onChange={(e) => setNewStation({...newStation, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter email address"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={newStation.phone}
                        onChange={(e) => setNewStation({...newStation, phone: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter phone number (optional)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Position <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newStation.position || ''}
                        onChange={(e) => setNewStation({...newStation, position: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter position/role (e.g., Fire Captain, Firefighter)"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={newStation.password}
                        onChange={(e) => setNewStation({...newStation, password: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter password for the station"
                        required
                      />
                    </div>

                  </div>

                  {/* Map Picker */}
                  {showMapPicker && (
                    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gradient-to-r from-red-50 to-orange-50 px-4 py-3 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">📍 Click on the Map to Set Location</h3>
                            <p className="text-xs text-gray-600 mt-0.5">Click anywhere on the map to pin the station location</p>
                          </div>
                          {newStation.lat && newStation.lng && (
                            <div className="text-xs text-gray-600 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                              📍 {parseFloat(newStation.lat).toFixed(4)}, {parseFloat(newStation.lng).toFixed(4)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Search Bar */}
                      <div className="p-4 bg-white border-b border-gray-200">
                        <div className="relative">
                          <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={locationSearchQuery}
                              onChange={(e) => {
                                const query = e.target.value;
                                setLocationSearchQuery(query);
                                
                                if (query.length > 2 && isMapLoaded && window.google) {
                                  setIsSearching(true);
                                  setShowSearchResults(true);
                                  
                                  // Use Google Maps Places Service
                                  const service = new window.google.maps.places.PlacesService(document.createElement('div'));
                                  
                                  const request = {
                                    query: query,
                                    fields: ['name', 'formatted_address', 'geometry'],
                                    locationBias: {
                                      center: mapCenter,
                                      radius: 50000
                                    }
                                  };
                                  
                                  service.textSearch(request, (results, status) => {
                                    setIsSearching(false);
                                    
                                    if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                                      setSearchResults(results.slice(0, 5));
                                    } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                                      // Fallback to Geocoder
                                      const geocoder = new window.google.maps.Geocoder();
                                      geocoder.geocode({ address: query, region: 'ph' }, (geoResults, geoStatus) => {
                                        if (geoStatus === 'OK' && geoResults) {
                                          const transformedResults = geoResults.map(result => ({
                                            name: result.formatted_address,
                                            formatted_address: result.formatted_address,
                                            geometry: result.geometry
                                          }));
                                          setSearchResults(transformedResults.slice(0, 5));
                                        } else {
                                          setSearchResults([]);
                                        }
                                      });
                                    } else {
                                      console.error('Places search failed:', status);
                                      setSearchResults([]);
                                    }
                                  });
                                } else {
                                  setSearchResults([]);
                                  setShowSearchResults(false);
                                }
                              }}
                              onFocus={() => {
                                if (searchResults.length > 0) {
                                  setShowSearchResults(true);
                                }
                              }}
                              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              placeholder="Search for a location (e.g., Fire Station, City Hall, Cebu...)"
                            />
                            {locationSearchQuery && (
                              <button
                                onClick={() => {
                                  setLocationSearchQuery('');
                                  setSearchResults([]);
                                  setShowSearchResults(false);
                                }}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <FiX />
                              </button>
                            )}
                          </div>
                          
                          {/* Search Results Dropdown */}
                          {showSearchResults && (
                            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {isSearching ? (
                                <div className="p-4 text-center text-gray-500">
                                  <FiLoader className="animate-spin inline-block mr-2" />
                                  Searching...
                                </div>
                              ) : searchResults.length > 0 ? (
                                searchResults.map((result, index) => {
                                  // Handle both Google Maps LatLng objects and plain objects
                                  const getLat = () => {
                                    if (typeof result.geometry.location.lat === 'function') {
                                      return result.geometry.location.lat();
                                    }
                                    return result.geometry.location.lat;
                                  };
                                  
                                  const getLng = () => {
                                    if (typeof result.geometry.location.lng === 'function') {
                                      return result.geometry.location.lng();
                                    }
                                    return result.geometry.location.lng;
                                  };
                                  
                                  const displayLat = getLat();
                                  const displayLng = getLng();
                                  
                                  return (
                                    <button
                                      key={index}
                                      onClick={() => {
                                        const lat = getLat();
                                        const lng = getLng();
                                        
                                        setMapCenter({ lat, lng });
                                        setMapZoom(17); // Zoom closer for precise location
                                        
                                        // Set the location immediately with place name
                                        const locationName = result.name !== result.formatted_address 
                                          ? `${result.name}, ${result.formatted_address}`
                                          : result.formatted_address;
                                        
                                        setNewStation({
                                          ...newStation,
                                          location: locationName,
                                          lat: lat.toString(),
                                          lng: lng.toString()
                                        });
                                        
                                        setShowSearchResults(false);
                                        setLocationSearchQuery('');
                                      }}
                                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                    >
                                      <div className="flex items-start space-x-3">
                                        <span className="text-red-500 mt-1">📍</span>
                                        <div className="flex-1">
                                          {result.name && result.name !== result.formatted_address && (
                                            <p className="font-semibold text-gray-900">{result.name}</p>
                                          )}
                                          <p className={`${result.name && result.name !== result.formatted_address ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                                            {result.formatted_address}
                                          </p>
                                          <p className="text-xs text-gray-500 mt-0.5">
                                            {displayLat.toFixed(6)}, {displayLng.toFixed(6)}
                                          </p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="p-4 text-center text-gray-500">
                                  No results found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isMapLoaded ? (
                        <GoogleMap
                          mapContainerStyle={{ width: '100%', height: '500px' }}
                          center={mapCenter}
                          zoom={mapZoom}
                          onLoad={(map) => {
                            setMapInstance(map);
                            setPlacesService(new window.google.maps.places.PlacesService(map));
                          }}
                          onClick={(e) => {
                            const lat = e.latLng.lat();
                            const lng = e.latLng.lng();
                            
                            setMapCenter({ lat, lng });
                            
                            // Use Geocoder from Google Maps API
                            if (window.google) {
                              const geocoder = new window.google.maps.Geocoder();
                              geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                                if (status === 'OK' && results[0]) {
                                  const address = results[0].formatted_address;
                                  setNewStation({
                                    ...newStation,
                                    location: address,
                                    lat: lat.toString(),
                                    lng: lng.toString()
                                  });
                                } else {
                                  setNewStation({
                                    ...newStation,
                                    location: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                                    lat: lat.toString(),
                                    lng: lng.toString()
                                  });
                                }
                              });
                            }
                          }}
                          options={{
                            streetViewControl: false,
                            mapTypeControl: true,
                            fullscreenControl: true,
                          }}
                        >
                          {newStation.lat && newStation.lng && (
                            <Marker
                              position={{ 
                                lat: parseFloat(newStation.lat), 
                                lng: parseFloat(newStation.lng) 
                              }}
                            />
                          )}
                        </GoogleMap>
                      ) : (
                        <div className="h-96 bg-gray-100 flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading map...</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">💡 Tip: Click anywhere on the map to set the station location</span>
                          {newStation.lat && newStation.lng && (
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-medium text-green-600">✅ Location pinned</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowMapPicker(false);
                                }}
                                className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                              >
                                Use Location
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {newStation.lat && newStation.lng && (
                        <div className="bg-green-50 border-t border-green-200 px-4 py-3">
                          <div className="flex items-start space-x-3">
                            <span className="text-xl">✅</span>
                            <div className="flex-1">
                              <h4 className="font-semibold text-green-900 text-sm mb-1">Location Selected</h4>
                              <p className="text-sm text-green-700">{newStation.location}</p>
                              <p className="text-xs text-green-600 mt-1">
                                Coordinates: {parseFloat(newStation.lat).toFixed(6)}, {parseFloat(newStation.lng).toFixed(6)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddStationModal(false);
                        setShowMapPicker(false);
                        setNewStation({
                          name: '',
                          stationId: '',
                          location: '',
                          email: '',
                          phone: '',
                          position: '',
                          password: '',
                          lat: '',
                          lng: ''
                        });
                        setLocationSearchQuery('');
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }}
                      className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white font-medium rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Create Station Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

      {/* History Modal */}
      {showHistoryModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FiClock className="text-2xl" />
                <div>
                  <h2 className="text-xl font-bold">{selectedUser.name}</h2>
                  <p className="text-sm text-red-100">Activity History</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedUser(null);
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Placeholder for history items */}
              <div className="text-center text-gray-500 py-8">
                <FiClock className="text-4xl mx-auto mb-3 text-gray-300" />
                <p>No activity history available</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Responder Profile Modal */}
      {showResponderProfileModal && selectedResponder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FiUser className="text-2xl" />
                <div>
                  <h2 className="text-xl font-bold">{selectedResponder.name}</h2>
                  <p className="text-sm text-red-100">{selectedResponder.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowResponderProfileModal(false);
                  setSelectedResponder(null);
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            {/* Responder Details */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="mt-1 text-gray-900 font-medium">{selectedResponder.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="mt-1 text-gray-900 font-medium">{selectedResponder.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="mt-1 text-gray-900 font-medium">{selectedResponder.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Position</label>
                    <p className="mt-1 text-gray-900 font-medium">{selectedResponder.position || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <p className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedResponder.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedResponder.status || 'N/A'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

          {/* Responders Modal */}
          {showRespondersModal && selectedStation && (
            <div 
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-lg"
              onClick={() => setShowRespondersModal(false)}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-6xl w-full mx-4 h-[85vh] flex flex-col border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Responders - {selectedStation.stationName}
                    </h2>
                    <p className="text-gray-600">
                      {stationResponders.length} responders registered
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRespondersModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                {loadingResponders ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading responders...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    {stationResponders.length === 0 ? (
                      <div className="text-center py-12">
                        <FiUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Responders Found</h3>
                        <p className="text-gray-600">This station hasn't registered any responders yet.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {stationResponders.map((responder) => (
                          <div key={responder.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                                  <FiUser className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {responder.firstName} {responder.lastName}
                                  </h3>
                                  <p className="text-sm text-gray-600">{responder.email}</p>
                                  <div className="flex items-center space-x-4 mt-1">
                                    <span className="text-sm text-gray-500">
                                      Position: {responder.position}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Phone: {responder.phoneNumber}
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Address: {responder.address}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  responder.active !== false 
                                    ? 'bg-green-100 text-green-800 border border-green-200' 
                                    : 'bg-red-100 text-red-800 border border-red-200'
                                }`}>
                                  {responder.active !== false ? 'Active' : 'Inactive'}
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedResponder(responder);
                                    setShowResponderProfileModal(true);
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                  title="View Profile"
                                >
                                  <FiEye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Responder Profile Modal */}
          {showResponderProfileModal && selectedResponder && (
            <div 
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-lg"
              onClick={() => setShowResponderProfileModal(false)}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4 border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">
                      Responder Profile
                    </h2>
                    <p className="text-gray-600">View responder details</p>
                  </div>
                  <button
                    onClick={() => setShowResponderProfileModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border border-red-100">
                    <div className="flex items-center space-x-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                        <FiUser className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          {selectedResponder.firstName} {selectedResponder.lastName}
                        </h3>
                        <p className="text-gray-600 mb-1">{selectedResponder.email}</p>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          selectedResponder.active !== false 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {selectedResponder.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <FiUser className="w-5 h-5 mr-2 text-red-600" />
                        Personal Information
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Position</span>
                          <p className="text-gray-900">{selectedResponder.position}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Phone Number</span>
                          <p className="text-gray-900">{selectedResponder.phoneNumber}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Address</span>
                          <p className="text-gray-900">{selectedResponder.address}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <FiClock className="w-5 h-5 mr-2 text-red-600" />
                        Station Information
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Station</span>
                          <p className="text-gray-900">{selectedResponder.stationName}</p>
                        </div>
                        {selectedResponder.createdAt && (
                          <div>
                            <span className="text-sm font-medium text-gray-500 block mb-1">Registered Date</span>
                            <p className="text-gray-900">{new Date(selectedResponder.createdAt).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* Disable Citizen Modal */}
      {showDisableModal && userToDisable && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-md"
          onClick={() => {
            setShowDisableModal(false);
            setDisableReason('');
            setUserToDisable(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <FiUserX className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Disable Citizen</h2>
                  <p className="text-gray-600 text-sm">Confirm action and provide reason</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDisableModal(false);
                  setDisableReason('');
                  setUserToDisable(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Citizen:</span> {userToDisable.name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Email:</span> {userToDisable.email}
                </p>
              </div>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      <strong>Warning:</strong> Disabling this citizen will prevent them from logging in. They will see a ban message when attempting to access their account.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Disabling <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 bg-gray-50 focus:bg-white resize-none"
                  placeholder="Enter the reason for disabling this citizen (e.g., Violation of terms, Inappropriate behavior, etc.)"
                  rows={4}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This reason will be shown to the citizen when they attempt to log in.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDisableModal(false);
                  setDisableReason('');
                  setUserToDisable(null);
                }}
                className="px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisable}
                disabled={!disableReason.trim()}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  disableReason.trim()
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Confirm Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-enable Citizen Modal */}
      {showReEnableModal && userToReEnable && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-md"
          onClick={() => {
            setShowReEnableModal(false);
            setUserToReEnable(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <FiUserCheck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Re-enable Citizen</h2>
                  <p className="text-gray-600 text-sm">Confirm action to restore access</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReEnableModal(false);
                  setUserToReEnable(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Citizen:</span> {userToReEnable.name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Email:</span> {userToReEnable.email}
                </p>
                {userToReEnable.disableReason && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="text-xs font-medium text-green-800 mb-1">Previous Ban Reason:</p>
                    <p className="text-sm text-gray-700 italic">{userToReEnable.disableReason}</p>
                  </div>
                )}
              </div>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> Re-enabling this citizen will restore their login access. They will be able to use the application again immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-green-900 mb-1">
                      What will happen:
                    </h3>
                    <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                      <li>Account ban will be removed</li>
                      <li>Login access will be restored</li>
                      <li>Previous ban reason will be cleared</li>
                      <li>Citizen can immediately access the application</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowReEnableModal(false);
                  setUserToReEnable(null);
                }}
                className="px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReEnable}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
              >
                Confirm Re-enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable Station Modal */}
      {showDisableStationModal && stationToDisable && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-md"
          onClick={() => {
            setShowDisableStationModal(false);
            setStationToDisable(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <FiUserX className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Disable Station</h2>
                  <p className="text-gray-600 text-sm">Confirm action to disable station</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDisableStationModal(false);
                  setStationToDisable(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Station:</span> {stationToDisable.stationName || stationToDisable.name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Email:</span> {stationToDisable.email}
                </p>
                {stationToDisable.address && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Address:</span> {stationToDisable.address}
                  </p>
                )}
              </div>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      <strong>Warning:</strong> Disabling this station will prevent them from accessing the system. They will not be able to log in or perform any operations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-5">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-red-900 mb-1">
                      What will happen:
                    </h3>
                    <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                      <li>Station will be marked as inactive</li>
                      <li>Login access will be revoked</li>
                      <li>Station cannot perform any operations</li>
                      <li>All station responders will be affected</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDisableStationModal(false);
                  setStationToDisable(null);
                }}
                className="px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisableStation}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
              >
                Confirm Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-enable Station Modal */}
      {showReEnableStationModal && stationToReEnable && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-md"
          onClick={() => {
            setShowReEnableStationModal(false);
            setStationToReEnable(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <FiUserCheck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Re-enable Station</h2>
                  <p className="text-gray-600 text-sm">Confirm action to restore access</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReEnableStationModal(false);
                  setStationToReEnable(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">Station:</span> {stationToReEnable.stationName || stationToReEnable.name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Email:</span> {stationToReEnable.email}
                </p>
                {stationToReEnable.address && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Address:</span> {stationToReEnable.address}
                  </p>
                )}
              </div>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Note:</strong> Re-enabling this station will restore their login access. They will be able to use the system again immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-semibold text-green-900 mb-1">
                      What will happen:
                    </h3>
                    <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                      <li>Station will be marked as active</li>
                      <li>Login access will be restored</li>
                      <li>Station can perform all operations</li>
                      <li>Station can immediately access the system</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowReEnableStationModal(false);
                  setStationToReEnable(null);
                }}
                className="px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReEnableStation}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
              >
                Confirm Re-enable
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Auser_management;