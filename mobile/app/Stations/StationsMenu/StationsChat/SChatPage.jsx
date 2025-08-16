import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SChatPage({ contact, onBack }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: 'Station 1 reporting for duty', sender: 'station', timestamp: '10:30 AM', isRead: true },
    { id: 2, text: 'We have 3 units available', sender: 'station', timestamp: '10:32 AM', isRead: true },
    { id: 3, text: 'Perfect, keep them ready', sender: 'station', timestamp: '10:33 AM', isRead: true },
    { id: 4, text: 'Any emergency calls?', sender: 'station', timestamp: '10:35 AM', isRead: false }
  ]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');

  const getContactIcon = (type) => {
    switch (type) {
      case 'station':
        return 'business';
      case 'responder':
        return 'shield-checkmark';
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

  const sendMessage = () => {
    if (message.trim()) {
      const newMessage = {
        id: messages.length + 1,
        text: message.trim(),
        sender: 'station',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false
      };
      setMessages([...messages, newMessage]);
      setMessage('');
    }
  };

  const handleLongPress = (msg) => {
    if (msg.sender === 'station') {
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
    <KeyboardAvoidingView 
      className="flex-1 bg-white"
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
        className="flex-1 px-4 py-2"
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <TouchableOpacity
            key={msg.id}
            onLongPress={() => handleLongPress(msg)}
            activeOpacity={0.7}
            className={`mb-4 ${msg.sender === 'station' ? 'items-end' : 'items-start'}`}
          >
            <View className={`max-w-[80%] ${msg.sender === 'station' ? 'bg-gray-800' : 'bg-gray-100'} rounded-2xl px-4 py-3`}>
              {msg.sender !== 'station' && (
                <Text className="text-xs font-medium text-gray-600 mb-1">
                  {getSenderName(msg.sender)}
                </Text>
              )}
              <Text className={`text-base ${msg.sender === 'station' ? 'text-white' : 'text-gray-800'} ${msg.isDeleted ? 'italic text-gray-500' : ''}`}>
                {msg.text}
                {msg.isEdited && !msg.isDeleted && (
                  <Text className="text-xs text-gray-400 ml-2">(edited)</Text>
                )}
              </Text>
                             <View className={`flex-row items-center mt-2 ${msg.sender === 'station' ? 'justify-end' : 'justify-start'}`}>
                 <Text className={`text-xs ${msg.sender === 'station' ? 'text-gray-300' : 'text-gray-500'}`}>
                   {msg.isEdited ? `${msg.originalTimestamp} (edited ${msg.editTimestamp})` : msg.timestamp}
                 </Text>
                 {msg.sender === 'station' && (
                   <Ionicons 
                     name={msg.isRead ? "checkmark-done" : "checkmark"} 
                     size={14} 
                     color={msg.isRead ? "#D1D5DB" : "#9CA3AF"} 
                     style={{ marginLeft: 4 }}
                   />
                 )}
               </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input Area */}
      <View className="border-t border-gray-100 px-4 py-3 bg-white">
        <View className="flex-row items-center">
          <TouchableOpacity className="p-2 mr-2">
            <Ionicons name="attach" size={24} color="#6B7280" />
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
            />
          </View>
          <TouchableOpacity 
            onPress={sendMessage}
            className={`w-10 h-10 rounded-full items-center justify-center ${message.trim() ? 'bg-[#ff512f]' : 'bg-gray-300'}`}
            disabled={!message.trim()}
          >
            <Ionicons 
              name="send" 
              size={18} 
              color={message.trim() ? "#ffffff" : "#9CA3AF"} 
            />
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
  );
}
