import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function AcknowledgmentModal({ visible, onClose, reportLocation }) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Success Icon with animated glow effect */}
          <View style={styles.iconContainer}>
            <View style={styles.iconGlow}>
              <MaterialIcons name="check-circle" size={80} color="#10b981" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Your Report Has Been{'\n'}Acknowledged!</Text>
          
          {/* Success Emoji */}
          <Text style={styles.emoji}>🎉</Text>

          {/* Message */}
          <Text style={styles.message}>
            Great news! Your fire report has been acknowledged by the command center. Responders are currently working to resolve the incident.
          </Text>

          {/* Location Info */}
          {reportLocation && (
            <View style={styles.locationContainer}>
              <MaterialIcons name="location-on" size={20} color="#10b981" />
              <Text style={styles.locationText} numberOfLines={2}>
                {reportLocation}
              </Text>
            </View>
          )}
          
          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <MaterialIcons name="emergency" size={18} color="#10b981" />
            <Text style={styles.statusText}>Status: Under Control</Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity 
            style={styles.button} 
            onPress={onClose} 
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Continue</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#ffffff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 15,
  },
  iconContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  iconGlow: {
    backgroundColor: '#d1fae5',
    borderRadius: 50,
    padding: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  emoji: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  locationText: {
    fontSize: 14,
    color: '#065f46',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 28,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 6,
  },
  button: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

