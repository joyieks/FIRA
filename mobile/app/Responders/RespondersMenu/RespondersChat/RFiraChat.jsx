import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Alert, 
  Dimensions,
  Animated,
  PanGestureHandler,
  State
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const { width, height } = Dimensions.get('window');

export default function RFiraChat() {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      sender: 'DRRMO Operator', 
      text: 'Emergency alert received. What is your situation?', 
      timestamp: '10:30 AM', 
      isEmergency: true,
      type: 'text',
      reactions: { 
        thumbsUp: { count: 1, users: ['user1'] }, 
        heart: { count: 0, users: [] } 
      }
    },
    { 
      id: 2, 
      sender: 'You', 
      text: 'Fire outbreak in Barangay Lahug near UC campus!', 
      timestamp: '10:31 AM', 
      isEmergency: true,
      type: 'text',
      reactions: { 
        thumbsUp: { count: 0, users: [] }, 
        heart: { count: 2, users: ['user1', 'user2'] } 
      }
    },
    { 
      id: 3, 
      sender: 'DRRMO Operator', 
      text: 'Help is on the way. Can you share your exact location?', 
      timestamp: '10:32 AM', 
      isEmergency: true,
      type: 'text',
      reactions: { 
        thumbsUp: { count: 1, users: ['user1'] }, 
        heart: { count: 0, users: [] } 
      }
    },
    {
      id: 4,
      sender: 'You',
      type: 'location',
      location: { lat: 10.3157, lng: 123.8854, address: 'Barangay Lahug, Cebu City' },
      timestamp: '10:33 AM',
      isEmergency: true,
      reactions: { 
        thumbsUp: { count: 1, users: ['user1'] }, 
        heart: { count: 0, users: [] } 
      }
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedContact, setSelectedContact] = useState({ name: 'DRRMO Operator', avatar: 'D' });
  const scrollViewRef = useRef(null);

  const typingAnimation = useRef(new Animated.Value(0)).current;
  const prevMessagesLengthRef = useRef(0);

  // Emergency contacts
  const emergencyContacts = [
    { id: 1, name: 'DRRMO Central', status: 'Online', avatar: 'D', lastSeen: '2 min ago' },
    { id: 2, name: 'BFP Station 1', status: 'Online', avatar: 'B', lastSeen: '1 min ago' },
    { id: 3, name: 'CCPO Dispatch', status: 'Offline', avatar: 'C', lastSeen: '5 min ago' },
    { id: 4, name: 'Medical Response', status: 'Online', avatar: 'M', lastSeen: '30 sec ago' },
  ];

  useEffect(() => {
    // Only scroll to bottom when a new message is added, not when reactions are updated
    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // Typing indicator animation
  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      const timer = setTimeout(() => {
        setIsTyping(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isTyping]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        setRecordingTime(0);
      }
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleSendMessage = () => {
    if (newMessage.trim() === '' && !selectedFile) return;
    
    let messageType = 'text';
    let messageData = { text: newMessage };
    
    if (selectedFile) {
      if (selectedFile.isImage) {
        messageType = 'image';
        messageData = {
          imageUrl: selectedFile.url,
          caption: newMessage || null
        };
      } else {
        messageType = 'file';
        messageData = { file: selectedFile };
      }
    }
    
    const newMsg = {
      id: messages.length + 1,
      sender: 'You',
      ...messageData,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEmergency: isEmergencyMode,
      type: messageType,
      reactions: { 
        thumbsUp: { count: 0, users: [] }, 
        heart: { count: 0, users: [] } 
      }
    };
    
    setMessages([...messages, newMsg]);
    setNewMessage('');
    setSelectedFile(null);
    
    // Show typing indicator
    setIsTyping(true);
    
    // Simulate response
    setTimeout(() => {
      setIsTyping(false);
      const responses = [
        "We've dispatched a team to your location.",
        "Please stay in a safe area.",
        "Can you provide more details about the situation?",
        "Medical assistance is 5 minutes away.",
        "How many people are affected?"
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const responseMsg = {
        id: messages.length + 2,
        sender: isEmergencyMode ? 'DRRMO Operator' : 'Support',
        text: randomResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: isEmergencyMode,
        type: 'text',
        reactions: { 
          thumbsUp: { count: 0, users: [] }, 
          heart: { count: 0, users: [] } 
        }
      };
      
      setMessages(prev => [...prev, responseMsg]);
    }, 1000 + Math.random() * 1000);
  };

  const handleLocationShare = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to share your location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const locationMsg = {
        id: messages.length + 1,
        sender: 'You',
        type: 'location',
        location: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          address: 'Current Location'
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: isEmergencyMode,
        reactions: { 
          thumbsUp: { count: 0, users: [] }, 
          heart: { count: 0, users: [] } 
        }
      };
      setMessages([...messages, locationMsg]);
    } catch (error) {
      Alert.alert('Error', 'Unable to get location. Please try again.');
    }
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const imageMsg = {
          id: messages.length + 1,
          sender: 'You',
          type: 'image',
          imageUrl: result.assets[0].uri,
          caption: 'Shared image',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isEmergency: isEmergencyMode,
          reactions: { 
            thumbsUp: { count: 0, users: [] }, 
            heart: { count: 0, users: [] } 
          }
        };
        setMessages([...messages, imageMsg]);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to pick image. Please try again.');
    }
  };

  const handleDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const isImage = asset.mimeType && asset.mimeType.startsWith('image/');
        
        if (isImage) {
          const imageMsg = {
            id: messages.length + 1,
            sender: 'You',
            type: 'image',
            imageUrl: asset.uri,
            caption: 'Shared image',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isEmergency: isEmergencyMode,
            reactions: { 
              thumbsUp: { count: 0, users: [] }, 
              heart: { count: 0, users: [] } 
            }
          };
          setMessages([...messages, imageMsg]);
        } else {
          const fileMsg = {
            id: messages.length + 1,
            sender: 'You',
            type: 'file',
            file: {
              name: asset.name,
              size: asset.size,
              uri: asset.uri,
            },
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isEmergency: isEmergencyMode,
            reactions: { 
              thumbsUp: { count: 0, users: [] }, 
              heart: { count: 0, users: [] } 
            }
          };
          setMessages([...messages, fileMsg]);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to pick document. Please try again.');
    }
  };



  const handleReaction = (messageId, reaction) => {
    // For demo purposes, using a fixed user ID - in real app this would come from auth
    const currentUserId = 'currentUser';
    
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const currentReaction = msg.reactions[reaction];
        const userHasReacted = currentReaction.users.includes(currentUserId);
        
        if (userHasReacted) {
          // Remove user's reaction
          const updatedUsers = currentReaction.users.filter(user => user !== currentUserId);
          return {
            ...msg,
            reactions: {
              ...msg.reactions,
              [reaction]: {
                count: updatedUsers.length,
                users: updatedUsers
              }
            }
          };
        } else {
          // Add user's reaction
          const updatedUsers = [...currentReaction.users, currentUserId];
          return {
            ...msg,
            reactions: {
              ...msg.reactions,
              [reaction]: {
                count: updatedUsers.length,
                users: updatedUsers
              }
            }
          };
        }
      }
      return msg;
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };



  const triggerEmergency = () => {
    setIsEmergencyMode(true);
    setMessages([
      ...messages,
      { 
        id: messages.length + 1, 
        sender: 'System', 
        text: 'EMERGENCY MODE ACTIVATED - Connecting to DRRMO', 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: true,
        type: 'system',
        reactions: { 
          thumbsUp: { count: 0, users: [] }, 
          heart: { count: 0, users: [] } 
        }
      }
    ]);
  };

  const renderMessage = (message) => {
    const isOwnMessage = message.sender === 'You';
    const currentUserId = 'currentUser'; // For demo purposes
    
    return (
      <View 
        key={message.id} 
        style={{
          flexDirection: 'row',
          justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
          marginBottom: 16,
          paddingHorizontal: 16,
        }}
      >
        <View style={{
          maxWidth: width * 0.7,
          padding: 12,
          borderRadius: 16,
                              backgroundColor: isOwnMessage
                      ? (isEmergencyMode ? '#dc2626' : '#f3f4f6')
                      : message.isEmergency
                        ? '#fef2f2'
                        : '#fef2f2',
          borderWidth: message.isEmergency && !isOwnMessage ? 1 : 0,
          borderColor: '#fecaca',
        }}>
          {message.sender !== 'You' && (
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              marginBottom: 4,
              color: message.isEmergency ? '#dc2626' : '#6b7280',
            }}>
              {message.sender}
            </Text>
          )}
          
                      {/* Message Content */}
            {message.type === 'text' && (
              <Text style={{
                color: isOwnMessage ? '#374151' : '#991b1b',
                fontSize: 16,
              }}>
                {message.text}
              </Text>
            )}
          
          {message.type === 'image' && (
            <View>
              <Image 
                source={{ uri: message.imageUrl }} 
                style={{
                  width: width * 0.6,
                  height: 200,
                  borderRadius: 12,
                  marginBottom: 8,
                }}
                resizeMode="cover"
              />
              {message.caption && (
                                          <Text style={{
                            fontSize: 14,
                            color: isOwnMessage ? '#6b7280' : '#6b7280',
                            fontStyle: 'italic',
                          }}>
                  {message.caption}
                </Text>
              )}
            </View>
          )}
          
          {message.type === 'file' && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f3f4f6',
              padding: 12,
              borderRadius: 12,
            }}>
              <Ionicons name="document" size={24} color="#3b82f6" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '600', fontSize: 14 }}>
                  {message.file.name}
                </Text>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                  {formatFileSize(message.file.size)}
                </Text>
              </View>
              <TouchableOpacity>
                <Ionicons name="download" size={20} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          )}
          
          {message.type === 'location' && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="location" size={16} color="#3b82f6" />
                <Text style={{ fontWeight: '600', marginLeft: 4 }}>Location Shared</Text>
              </View>
              <View style={{
                backgroundColor: '#f3f4f6',
                padding: 8,
                borderRadius: 8,
                marginBottom: 8,
              }}>
                <Text style={{ fontSize: 12 }}>Lat: {message.location.lat.toFixed(4)}</Text>
                <Text style={{ fontSize: 12 }}>Lng: {message.location.lng.toFixed(4)}</Text>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>{message.location.address}</Text>
              </View>
              <TouchableOpacity>
                <Text style={{ color: '#3b82f6', fontSize: 12 }}>View on Map</Text>
              </TouchableOpacity>
            </View>
          )}
          

          
          {message.type === 'system' && (
            <Text style={{
              textAlign: 'center',
              fontSize: 14,
              fontWeight: '600',
              color: '#dc2626',
            }}>
              {message.text}
            </Text>
          )}
          
          {/* Reactions */}
          <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => handleReaction(message.id, 'thumbsUp')}
              style={{
                backgroundColor: message.reactions.thumbsUp.users.includes(currentUserId)
                  ? '#dbeafe'
                  : '#f3f4f6',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                marginRight: 4,
                borderWidth: message.reactions.thumbsUp.users.includes(currentUserId) ? 1 : 0,
                borderColor: '#3b82f6',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text style={{ 
                fontSize: 12,
                color: message.reactions.thumbsUp.users.includes(currentUserId) ? '#1d4ed8' : '#6b7280',
                marginRight: 2,
              }}>
                👍
              </Text>
              {message.reactions.thumbsUp.count > 0 && (
                <Text style={{ 
                  fontSize: 12,
                  color: message.reactions.thumbsUp.users.includes(currentUserId) ? '#1d4ed8' : '#6b7280',
                }}>
                  {message.reactions.thumbsUp.count}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => handleReaction(message.id, 'heart')}
              style={{
                backgroundColor: message.reactions.heart.users.includes(currentUserId)
                  ? '#fee2e2'
                  : '#f3f4f6',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                borderWidth: message.reactions.heart.users.includes(currentUserId) ? 1 : 0,
                borderColor: '#dc2626',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text style={{ 
                fontSize: 12,
                color: message.reactions.heart.users.includes(currentUserId) ? '#dc2626' : '#6b7280',
                marginRight: 2,
              }}>
                ❤️
              </Text>
              {message.reactions.heart.count > 0 && (
                <Text style={{ 
                  fontSize: 12,
                  color: message.reactions.heart.users.includes(currentUserId) ? '#dc2626' : '#6b7280',
                }}>
                  {message.reactions.heart.count}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          <Text style={{
            fontSize: 10,
            marginTop: 4,
            textAlign: 'right',
            color: isOwnMessage ? 'rgba(255,255,255,0.8)' : '#6b7280',
          }}>
            {message.timestamp}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <View style={{
        backgroundColor: isEmergencyMode ? '#fef2f2' : '#ffffff',
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 40,
              height: 40,
              backgroundColor: '#fecaca',
              borderRadius: 20,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Text style={{ fontWeight: 'bold', color: '#dc2626' }}>{selectedContact.avatar}</Text>
            </View>
            <View>
              <Text style={{ fontWeight: '600', fontSize: 16 }}>{selectedContact.name}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>
                {isEmergencyMode ? '🆘 Emergency Response' : 'Online'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={{ marginLeft: 8 }}>
              <Ionicons name="call" size={20} color="#6b7280" />
            </TouchableOpacity>
            <TouchableOpacity style={{ marginLeft: 8 }}>
              <Ionicons name="videocam" size={20} color="#6b7280" />
            </TouchableOpacity>
            <TouchableOpacity style={{ marginLeft: 8 }}>
              <Ionicons name="location" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Emergency Mode Banner */}
      {isEmergencyMode && (
        <View style={{
          backgroundColor: '#fef2f2',
          borderLeftWidth: 4,
          borderLeftColor: '#dc2626',
          padding: 12,
          marginHorizontal: 16,
          marginTop: 8,
          borderRadius: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="warning" size={16} color="#dc2626" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 12, color: '#dc2626', flex: 1 }}>
              You are in emergency mode. All messages are prioritized.
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(renderMessage)}
        
        {/* Typing Indicator */}
        {isTyping && (
          <View style={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            marginBottom: 16,
            paddingHorizontal: 16,
          }}>
            <View style={{
              backgroundColor: '#ffffff',
              padding: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#e5e7eb',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Animated.View style={{
                  width: 8,
                  height: 8,
                  backgroundColor: '#9ca3af',
                  borderRadius: 4,
                  marginRight: 4,
                  opacity: typingAnimation,
                }} />
                <Animated.View style={{
                  width: 8,
                  height: 8,
                  backgroundColor: '#9ca3af',
                  borderRadius: 4,
                  marginRight: 4,
                  opacity: typingAnimation,
                }} />
                <Animated.View style={{
                  width: 8,
                  height: 8,
                  backgroundColor: '#9ca3af',
                  borderRadius: 4,
                  marginRight: 8,
                  opacity: typingAnimation,
                }} />
                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                  DRRMO Operator is typing...
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Attachment Menu */}
      {showAttachmentMenu && (
        <View style={{
          position: 'absolute',
          bottom: 80,
          left: 16,
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}>
          <TouchableOpacity
            onPress={() => {
              handleImagePicker();
              setShowAttachmentMenu(false);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
          >
            <Ionicons name="image" size={24} color="#3b82f6" style={{ marginRight: 12 }} />
            <Text>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              handleDocumentPicker();
              setShowAttachmentMenu(false);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
          >
            <Ionicons name="document" size={24} color="#3b82f6" style={{ marginRight: 12 }} />
            <Text>Document</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              handleLocationShare();
              setShowAttachmentMenu(false);
            }}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="location" size={24} color="#3b82f6" style={{ marginRight: 12 }} />
            <Text>Location</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Area */}
      <View style={{
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Attachment Button */}
          <TouchableOpacity
            onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
            style={{ marginRight: 8 }}
          >
            <Ionicons name="add-circle" size={24} color="#6b7280" />
          </TouchableOpacity>
          

          
          {/* Text Input */}
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder={isEmergencyMode ? "Describe your emergency..." : "Type a message..."}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#d1d5db',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 8,
              marginRight: 8,
              fontSize: 16,
            }}
            multiline
          />
          
          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!newMessage.trim() && !selectedFile}
            style={{
              padding: 8,
              borderRadius: 20,
              backgroundColor: (!newMessage.trim() && !selectedFile) 
                ? '#d1d5db' 
                : (isEmergencyMode ? '#dc2626' : '#3b82f6'),
            }}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color="#ffffff" 
            />
          </TouchableOpacity>
        </View>
        
        {/* Emergency Mode Toggle */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
        }}>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            {isEmergencyMode ? '🆘 Emergency communication' : 'Standard message'}
          </Text>
          <TouchableOpacity onPress={() => setIsEmergencyMode(!isEmergencyMode)}>
            <Text style={{ fontSize: 12, color: '#dc2626' }}>
              {isEmergencyMode ? 'Exit emergency mode' : 'Switch to emergency mode'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Emergency Alert Button */}
      <TouchableOpacity
        onPress={triggerEmergency}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          backgroundColor: '#dc2626',
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 25,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Ionicons name="warning" size={20} color="#ffffff" style={{ marginRight: 8 }} />
        <Text style={{ color: '#ffffff', fontWeight: '600' }}>Emergency</Text>
      </TouchableOpacity>
    </View>
  );
}
