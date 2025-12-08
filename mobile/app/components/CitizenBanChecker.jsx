import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../config/supabase';
import { useAuth } from '../config/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CitizenBanChecker = () => {
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [citizenId, setCitizenId] = useState(null);
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    let channel = null;
    let interval = null;

    const checkCitizenStatus = async () => {
      try {
        // Get current user ID from AsyncStorage
        const userDataString = await AsyncStorage.getItem('userData');
        if (!userDataString) return;

        const userData = JSON.parse(userDataString);
        const userId = userData.uid || userData.id || userData.user_id;
        
        if (!userId) return;
        
        // Only set citizenId if it's different to avoid re-subscribing
        if (citizenId !== userId) {
          setCitizenId(userId);
        }

        // Check if citizen is disabled
        const { data: citizenData, error } = await supabase
          .from('citizen_users')
          .select('is_disabled, disable_reason')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Error checking citizen status:', error);
          return;
        }

        if (citizenData?.is_disabled === true) {
          setBanReason(citizenData.disable_reason || 'No reason provided');
          setShowBanModal(true);
        }
      } catch (error) {
        console.error('Error in checkCitizenStatus:', error);
      }
    };

    const setupSubscription = async () => {
      // Get user ID first
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) return;

      const userData = JSON.parse(userDataString);
      const userId = userData.uid || userData.id || userData.user_id;
      
      if (!userId) return;

      // Set up real-time subscription for citizen_users table
      channel = supabase
        .channel(`citizen-ban-check:${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'citizen_users',
          filter: `id=eq.${userId}`
        }, async (payload) => {
          console.log('📱 Citizen status updated:', payload.new);
          if (payload.new?.is_disabled === true) {
            setBanReason(payload.new.disable_reason || 'No reason provided');
            setShowBanModal(true);
          }
        })
        .subscribe();
    };

    // Check immediately
    checkCitizenStatus();

    // Set up subscription
    setupSubscription();

    // Also check periodically (every 30 seconds) as backup
    interval = setInterval(() => {
      checkCitizenStatus();
    }, 30000);

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  const handleContinue = async () => {
    // Logout the user
    try {
      // Clear all storage first
      await AsyncStorage.multiRemove(['authToken', 'userType', 'userData', 'loginTime']);
      
      // Logout from auth context
      if (logout) {
        await logout();
      }
      
      // Navigate to login
      router.replace('/Authentication/login');
    } catch (error) {
      console.error('Error during logout:', error);
      // Force navigation even if logout fails
      router.replace('/Authentication/login');
    }
  };

  return (
    <Modal
      visible={showBanModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}} // Prevent closing by back button
    >
      <View 
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View 
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 28,
            padding: 32,
            marginHorizontal: 24,
            maxWidth: 400,
            width: '100%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.3,
            shadowRadius: 30,
            elevation: 20,
          }}
        >
          {/* Animated Icon Container */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View 
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: '#fee2e2',
                borderWidth: 4,
                borderColor: '#fecaca',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                shadowColor: '#dc2626',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 12,
              }}
            >
              <MaterialIcons name="block" size={56} color="#dc2626" />
            </View>
            
            {/* Title */}
            <Text 
              style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: '#1f2937',
                letterSpacing: 0.5,
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Account Disabled
            </Text>
            
            {/* Subtitle */}
            <View style={{ alignItems: 'center' }}>
              <Text 
                style={{
                  fontSize: 16,
                  color: '#6b7280',
                  marginBottom: 4,
                  textAlign: 'center',
                }}
              >
                You have been banned by the
              </Text>
              <Text 
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: '#dc2626',
                  letterSpacing: 0.3,
                  textAlign: 'center',
                }}
              >
                Command Center Admin
              </Text>
            </View>
          </View>

          {/* Ban Reason */}
          {banReason && (
            <View 
              style={{
                backgroundColor: '#fef2f2',
                borderLeftWidth: 5,
                borderLeftColor: '#dc2626',
                borderRadius: 16,
                padding: 18,
                borderWidth: 1,
                borderColor: '#fecaca',
                marginBottom: 24,
                shadowColor: '#dc2626',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="info" size={20} color="#dc2626" />
                <Text 
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: '#991b1b',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginLeft: 8,
                  }}
                >
                  Reason for Ban
                </Text>
              </View>
              <Text 
                style={{
                  fontSize: 16,
                  color: '#1f2937',
                  lineHeight: 24,
                  fontWeight: '500',
                }}
              >
                {banReason}
              </Text>
            </View>
          )}

          {/* Message */}
          <View 
            style={{
              backgroundColor: '#f9fafb',
              borderRadius: 16,
              padding: 18,
              marginBottom: 24,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <MaterialIcons name="warning" size={20} color="#f59e0b" style={{ marginTop: 2 }} />
              <Text 
                style={{
                  fontSize: 14,
                  color: '#374151',
                  lineHeight: 20,
                  fontWeight: '500',
                  marginLeft: 8,
                  flex: 1,
                }}
              >
                Your account has been disabled and you cannot access the application. If you believe this is an error, please contact the Command Center Administrator.
              </Text>
            </View>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#dc2626',
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: 'center',
              shadowColor: '#dc2626',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 12,
              borderWidth: 1,
              borderColor: '#b91c1c',
            }}
          >
            <Text 
              style={{
                color: '#ffffff',
                fontSize: 18,
                fontWeight: '700',
                letterSpacing: 0.5,
              }}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default CitizenBanChecker;

