import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Modal, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';
import { useAuth } from '../../../config/AuthContext';
//import { analyzeMessageForFireAlarm, updateMessageWithAIAnalysis } from '../../../services/openaiService';

export default function RChatPage({ contact, onBack }) {
  const { userData } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef(null);

  // Fetch messages when contact changes
  useEffect(() => {
    if (!contact || !userData) return;

    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        console.log('🔍 Fetching messages between responder:', userData.id, 'and contact:', contact.id);
        
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${userData.id},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${userData.id})`)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages:', error);
          Alert.alert('Error', 'Failed to load messages');
          return;
        }

        console.log('✅ Messages fetched:', messagesData?.length || 0);
        setMessages(messagesData || []);
        
        // Mark messages as read when opening conversation
        if (messagesData && messagesData.length > 0) {
          markMessagesAsRead();
        }
        
        setTimeout(scrollToBottom, 100);
      } catch (error) {
        console.error('Error fetching messages:', error);
        Alert.alert('Error', 'Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [contact, userData]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!contact || !userData) return;

    const subscription = supabase
      .channel(`messages:${userData.id}:${contact.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `or(and(sender_id.eq.${userData.id},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${userData.id}))`
      }, (payload) => {
        console.log('🔔 New message received:', payload);
        setMessages(prev => [...prev, payload.new]);
        setTimeout(scrollToBottom, 100);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [contact, userData]);

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  const markMessagesAsRead = async () => {
    if (!contact || !userData) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', contact.id)
        .eq('receiver_id', userData.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking messages as read:', error);
      } else {
        console.log('✅ Messages marked as read');
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const getContactIcon = (type) => {
    switch (type) {
      case 'station':
        return 'business';
      case 'responder':
        return 'shield-checkmark';
      case 'admin':
        return 'shield';
      case 'system':  
        return 'warning';
      default:
        return 'person';
    }
  };

  const getContactColor = (type) => {
    switch (type) {
      case 'station':
        return 'bg-purple-500';
      case 'responder':
        return 'bg-green-500';
      case 'system':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSenderName = (sender) => {
    switch (sender) {
      case 'admin':
        return 'Admin';
      case 'responder':
        return 'Responder';
      case 'station':
        return 'Station';
      case 'system':
        return 'System';
      default:
        return 'Unknown';
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !contact || !userData || isSending) return;

    try {
      setIsSending(true);
      const messageText = message.trim();
      setMessage(''); // Clear input immediately for better UX

      const messageData = {
        sender_id: userData.id,
        receiver_id: contact.id,
        sender_type: 'responder',
        receiver_type: contact.type,
        text: messageText,
        is_emergency: false,
        is_read: false
      };

      console.log('📤 Sending message:', messageData);

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select();

      if (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message');
        setMessage(messageText); // Restore message on error
        return;
      }

      console.log('✅ Message sent successfully:', data);
      
      // Add message to local state immediately for better UX
      if (data && data[0]) {
        setMessages(prev => [...prev, data[0]]);
        setTimeout(scrollToBottom, 100);

        // AI Analysis: Analyze the message for fire alarm level
        try {
          console.log('🤖 Starting AI analysis for responder message:', messageText);
          const analysis = await analyzeMessageForFireAlarm(messageText);
          console.log('🤖 AI Analysis result:', analysis);
          
          if (analysis.suggested_alarm) {
            // Update the message with AI analysis
            await updateMessageWithAIAnalysis(data[0].id, analysis, supabase);
            console.log('✅ Responder message updated with AI suggested alarm:', analysis.suggested_alarm);
          } else {
            console.log('ℹ️ No fire-related content detected in responder message');
          }
        } catch (aiError) {
          console.error('❌ AI analysis failed for responder message:', aiError);
          // Don't show error to user, just log it
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      setMessage(message.trim()); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleLongPress = (msg) => {
    if (msg.sender === 'responder') {
      // Your own message - show Edit and Delete options
      Alert.alert(
        'Message Options',
        'Choose an action:',
        [
          {
            text: 'Edit',
            onPress: () => {
              setEditingMessage(msg);
              setEditText(msg.text);
            }
          },
          {
            text: 'Delete',
            onPress: () => handleDeleteConfirmation(msg.id),
            style: 'destructive'
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } else {
      // Others' message - show Delete for you only
      Alert.alert(
        'Message Options',
        'Choose an action:',
        [
          {
            text: 'Delete for you only',
            onPress: () => handleDeleteMessage(msg.id, false),
            style: 'destructive'
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const handleDeleteConfirmation = (messageId) => {
    Alert.alert(
      'Delete Message',
      'Who should this message be deleted for?',
      [
        {
          text: 'For you',
          onPress: () => handleDeleteMessage(messageId, false),
          style: 'default'
        },
        {
          text: 'For everyone',
          onPress: () => handleDeleteMessage(messageId, true),
          style: 'destructive'
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleDeleteMessage = (messageId, deleteForEveryone) => {
    if (deleteForEveryone) {
      // Replace message with "This message was deleted"
      setMessages(messages.map(msg => 
        msg.id === messageId 
          ? { ...msg, text: 'This message was deleted', isDeleted: true }
          : msg
      ));
    } else {
      // Remove message from your view only
      setMessages(messages.filter(msg => msg.id !== messageId));
    }
  };

  const handleEditMessage = () => {
    if (editText.trim() && editingMessage) {
      setMessages(messages.map(msg => 
        msg.id === editingMessage.id 
          ? { 
              ...msg, 
              text: editText.trim(), 
              isEdited: true,
              originalTimestamp: msg.originalTimestamp || msg.timestamp,
              editTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          : msg
      ));
      setEditingMessage(null);
      setEditText('');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      {/* Chat Header */}
      <View className="pt-12 pb-4 px-4 border-b border-gray-100">
        <View className="flex-row items-center">
          {/* Left side - Back button and Contact info */}
          <View className="flex-row items-center flex-1">
            <TouchableOpacity 
              onPress={onBack}
              className="mr-3"
            >
              <Ionicons name="arrow-back" size={24} color="#6B7280" />
            </TouchableOpacity>
            <View className={`w-10 h-10 rounded-full ${getContactColor(contact.type)} items-center justify-center mr-3`}>
              <Ionicons name={getContactIcon(contact.type)} size={20} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-800">{contact.name}</Text>
              <View className="flex-row items-center">
                <View className={`w-2 h-2 rounded-full mr-2 ${contact.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
                <Text className="text-sm text-gray-500">
                  {contact.status === 'online' ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 px-4 py-2"
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-8">
            <Text className="text-gray-500">Loading messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View className="flex-1 items-center justify-center py-8">
            <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="chatbubble-outline" size={32} color="#9CA3AF" />
            </View>
            <Text className="text-lg font-medium text-gray-900 mb-2">No messages yet</Text>
            <Text className="text-sm text-gray-500 text-center px-8">
              Start a conversation with {contact.name}
            </Text>
          </View>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.sender_id === userData?.id;
            const formatTime = (timestamp) => {
              if (!timestamp) return '';
              const date = new Date(timestamp);
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            };
            
            // Add timestamp separator for new days
            const showDateSeparator = index === 0 || 
              new Date(msg.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();
            
            return (
              <View key={`msg-${msg.id}`}>
                {showDateSeparator && (
                  <View className="items-center my-4">
                    <Text className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {new Date(msg.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              <TouchableOpacity
                key={msg.id}
                onLongPress={() => handleLongPress(msg)}
                activeOpacity={0.7}
                className={`mb-4 ${isMine ? 'items-end' : 'items-start'}`}
              >
                <View className={`max-w-[80%] ${isMine ? 'bg-blue-500' : 'bg-white border border-gray-200'} rounded-2xl px-4 py-3`}>
                  {!isMine && (
                    <Text className="text-xs font-medium text-gray-600 mb-1">
                      {contact.name}
                    </Text>
                  )}
                  <Text className={`text-base ${isMine ? 'text-white' : 'text-gray-800'} ${msg.isDeleted ? 'italic text-gray-500' : ''}`}>
                    {msg.text}
                    {msg.isEdited && !msg.isDeleted && (
                      <Text className="text-xs text-gray-400 ml-2">(edited)</Text>
                    )}
                  </Text>
                  <View className={`flex-row items-center mt-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <Text className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                      {formatTime(msg.created_at)}
                    </Text>
                    {isMine && (
                      <Ionicons 
                        name={msg.is_read ? "checkmark-done" : "checkmark"} 
                        size={14} 
                        color={msg.is_read ? "#93C5FD" : "#DBEAFE"} 
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input Area */}
      <View className="border-t border-gray-200 px-4 py-3 pb-16 bg-white">
        <View className="flex-row items-center">
          <TouchableOpacity className="p-2 mr-2">
            <Ionicons name="image-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
          <View className="flex-1 bg-gray-100 rounded-full px-4 py-3 mr-2 min-h-[40px]">
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type a message..."
              className="text-base text-gray-800"
              multiline
              maxLength={500}
              style={{ minHeight: 20, maxHeight: 100 }}
              textAlignVertical="center"
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity 
            onPress={sendMessage}
            className={`w-10 h-10 rounded-full items-center justify-center ${message.trim() && !isSending ? 'bg-blue-500' : 'bg-gray-300'}`}
            disabled={!message.trim() || isSending}
          >
            {isSending ? (
              <Ionicons 
                name="hourglass-outline" 
                size={18} 
                color="#9CA3AF" 
              />
            ) : (
              <Ionicons 
                name="send" 
                size={18} 
                color={message.trim() ? "#ffffff" : "#9CA3AF"} 
              />
            )}
          </TouchableOpacity>
        </View>
        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-xs text-gray-500">Standard message</Text>
          <TouchableOpacity>
            <Text className="text-xs text-red-500">Switch to emergency mode</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit Message Modal */}
      <Modal
        visible={editingMessage !== null}
        transparent={true}
        animationType="fade"
      >
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center px-4">
          <View className="bg-white rounded-lg p-4 w-full max-w-sm">
            <Text className="text-lg font-semibold mb-4 text-center">Edit Message</Text>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              className="border border-gray-300 rounded-lg px-3 py-2 mb-4 text-base"
              multiline
              maxLength={500}
              placeholder="Edit your message..."
            />
            <View className="flex-row justify-end space-x-2">
              <TouchableOpacity
                onPress={() => {
                  setEditingMessage(null);
                  setEditText('');
                }}
                className="px-4 py-2 rounded-lg bg-gray-200"
              >
                <Text className="text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEditMessage}
                className="px-4 py-2 rounded-lg bg-[#ff512f]"
              >
                <Text className="text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}