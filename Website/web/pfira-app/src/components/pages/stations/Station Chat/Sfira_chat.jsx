import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiPaperclip, FiPhone, FiVideo, FiUser, FiMapPin, FiAlertTriangle, FiImage, FiFile, FiSmile, FiMoreVertical, FiHeart, FiMessageCircle, FiShare2, FiDownload } from 'react-icons/fi';

const Sfira_chat = () => {
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
    },
    {
      id: 5,
      sender: 'DRRMO Operator',
      type: 'image',
      imageUrl: 'https://via.placeholder.com/300x200/ff6b6b/ffffff?text=Emergency+Response+Map',
      caption: 'Response team deployment map',
      timestamp: '10:34 AM',
      isEmergency: true,
      reactions: { 
        thumbsUp: { count: 2, users: ['user1', 'user2'] }, 
        heart: { count: 1, users: ['user1'] } 
      }
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [selectedContact, setSelectedContact] = useState({ name: 'DRRMO Operator', avatar: 'D' });
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);

  // Sample emergency contacts
  const emergencyContacts = [
    { id: 1, name: 'DRRMO Central', status: 'Online', avatar: 'D', lastSeen: '2 min ago' },
    { id: 2, name: 'BFP Station 1', status: 'Online', avatar: 'B', lastSeen: '1 min ago' },
    { id: 3, name: 'CCPO Dispatch', status: 'Offline', avatar: 'C', lastSeen: '5 min ago' },
    { id: 4, name: 'Medical Response', status: 'Online', avatar: 'M', lastSeen: '30 sec ago' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only scroll to bottom when a new message is added, not when reactions are updated
    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // Typing indicator simulation
  useEffect(() => {
    if (isTyping) {
      const timer = setTimeout(() => {
        setIsTyping(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isTyping]);



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
    
    // Simulate response after 1-2 seconds
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const isImage = file.type.startsWith('image/');
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        isImage: isImage
      });
    }
  };

  const handleLocationShare = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationMsg = {
            id: messages.length + 1,
            sender: 'You',
            type: 'location',
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
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
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get location. Please check your permissions.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
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
      <div 
        key={message.id} 
        className={`mb-4 flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 relative group ${
          message.sender === 'You' 
            ? isEmergencyMode 
              ? 'bg-red-600 text-white' 
              : 'bg-gray-100 text-gray-800 border border-gray-300'
                                  : message.isEmergency
                        ? 'bg-red-100 border border-red-200'
                        : 'bg-red-100 text-gray-800'
        }`}>
          {message.sender !== 'You' && (
            <div className={`text-xs font-medium mb-1 ${
              message.isEmergency ? 'text-red-600' : 'text-gray-500'
            }`}>
              {message.sender}
            </div>
          )}
          
          {/* Message Content */}
          {message.type === 'text' && (
            <p className={message.sender !== 'You' ? 'text-red-800' : ''}>
              {message.text}
            </p>
          )}
          
          {message.type === 'image' && (
            <div>
              <img 
                src={message.imageUrl} 
                alt="Shared image" 
                className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90"
                onClick={() => window.open(message.imageUrl, '_blank')}
              />
              {message.caption && (
                <p className="text-sm mt-2 opacity-80">{message.caption}</p>
              )}
            </div>
          )}
          
          {message.type === 'file' && (
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <FiFile size={24} className="text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{message.file.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(message.file.size)}</p>
              </div>
              <button className="p-2 hover:bg-gray-200 rounded-full">
                <FiDownload size={16} />
              </button>
            </div>
          )}
          
          {message.type === 'location' && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <FiMapPin size={16} />
                <span className="font-medium">Location Shared</span>
              </div>
              <div className="bg-gray-100 rounded-lg p-2 text-sm">
                <p>Lat: {message.location.lat.toFixed(4)}</p>
                <p>Lng: {message.location.lng.toFixed(4)}</p>
                <p className="text-gray-600">{message.location.address}</p>
              </div>
              <button className="text-blue-600 text-sm hover:underline">
                View on Map
              </button>
            </div>
          )}
          

          
          {message.type === 'system' && (
            <div className="text-center text-sm font-medium">
              {message.text}
            </div>
          )}
          
          {/* Message Actions */}
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1 hover:bg-gray-200 rounded">
              <FiMoreVertical size={12} />
            </button>
          </div>
          
          {/* Reactions */}
          <div className="flex items-center space-x-1 mt-2">
            <button
              onClick={() => handleReaction(message.id, 'thumbsUp')}
              className={`text-xs px-2 py-1 rounded-full transition-colors flex items-center gap-1 ${
                message.reactions.thumbsUp.users.includes(currentUserId)
                  ? 'bg-blue-100 text-blue-600 border border-blue-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              title={`${message.reactions.thumbsUp.count} user${message.reactions.thumbsUp.count !== 1 ? 's' : ''} reacted`}
            >
              <span>👍</span>
              {message.reactions.thumbsUp.count > 0 && <span>{message.reactions.thumbsUp.count}</span>}
            </button>
            <button
              onClick={() => handleReaction(message.id, 'heart')}
              className={`text-xs px-2 py-1 rounded-full transition-colors flex items-center gap-1 ${
                message.reactions.heart.users.includes(currentUserId)
                  ? 'bg-red-100 text-red-600 border border-red-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              title={`${message.reactions.heart.count} user${message.reactions.heart.count !== 1 ? 's' : ''} reacted`}
            >
              <span>❤️</span>
              {message.reactions.heart.count > 0 && <span>{message.reactions.heart.count}</span>}
            </button>
          </div>
          
          <div className={`text-xs mt-1 text-right ${
            message.sender === 'You' 
              ? 'text-white text-opacity-80' 
              : message.isEmergency 
                ? 'text-red-500' 
                : 'text-gray-500'
          }`}>
            {message.timestamp}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-red-600">Project FIRA</h2>
          <p className="text-sm text-gray-500">Emergency Communication</p>
        </div>
        
        <div className="flex border-b">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'chat' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
          >
            Chats
          </button>
          <button 
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-3 text-center font-medium ${activeTab === 'contacts' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
          >
            Contacts
          </button>
        </div>
        
        {activeTab === 'chat' ? (
          <div className="flex-1 overflow-y-auto">
            {/* Chat list would go here */}
            <div 
              className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
              onClick={() => setSelectedContact({ name: 'DRRMO Operator', avatar: 'D' })}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold mr-3">
                  D
                </div>
                <div>
                  <h3 className="font-medium">DRRMO Central</h3>
                  <p className="text-sm text-gray-500 truncate">Emergency response team</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {emergencyContacts.map(contact => (
              <div key={contact.id} className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3 ${
                  contact.status === 'Online' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {contact.avatar}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{contact.name}</h3>
                  <p className="text-sm text-gray-500">{contact.status} • {contact.lastSeen}</p>
                </div>
                <div className="flex space-x-2">
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-full">
                    <FiPhone size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={triggerEmergency}
            className="w-full py-3 px-4 bg-red-600 text-white rounded-lg font-medium flex items-center justify-center hover:bg-red-700"
          >
            <FiAlertTriangle className="mr-2" />
            Emergency Alert
          </button>
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className={`p-4 border-b border-gray-200 flex items-center justify-between ${
          isEmergencyMode ? 'bg-red-50' : 'bg-white'
        }`}>
                      <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold mr-3">
                {selectedContact.avatar}
              </div>
              <div>
                <h3 className="font-medium">{selectedContact.name}</h3>
                <p className="text-sm text-gray-500">
                  {isEmergencyMode ? (
                    <span className="text-red-600 flex items-center">
                      <FiAlertTriangle className="mr-1" /> Emergency Response
                    </span>
                  ) : 'Online'}
                </p>
              </div>
            </div>
          <div className="flex space-x-2">
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
              <FiPhone size={20} />
            </button>
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
              <FiVideo size={20} />
            </button>
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full">
              <FiMapPin size={20} />
            </button>
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.map(renderMessage)}
          
          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start mb-4">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-sm text-gray-500 ml-2">DRRMO Operator is typing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* File Preview */}
        {selectedFile && (
          <div className="p-3 bg-blue-50 border-t border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FiFile size={20} className="text-blue-500" />
                <div>
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedFile(null)}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        {/* Message Input */}
        <div className="p-4 border-t border-gray-200 bg-white">
          {isEmergencyMode && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3 mb-3 rounded-r-lg">
              <div className="flex items-center text-red-800">
                <FiAlertTriangle className="mr-2 flex-shrink-0" />
                <p className="text-sm">You are in emergency mode. All messages are prioritized.</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            {/* File Upload */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
            >
              <FiPaperclip size={20} />
            </button>
            
            {/* Image Upload */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
            >
              <FiImage size={20} />
            </button>
            
            {/* Location Share */}
            <button 
              onClick={handleLocationShare}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
            >
              <FiMapPin size={20} />
            </button>
            

            
            {/* Message Input */}
            <div className="flex-1 relative">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isEmergencyMode ? "Describe your emergency..." : "Type a message..."}
                className="w-full border border-gray-300 rounded-lg pl-4 pr-12 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows="1"
              />
            </div>
            
            {/* Emoji Picker */}
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
            >
              <FiSmile size={20} />
            </button>
            
            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() && !selectedFile}
              className={`p-2 rounded-full ${
                isEmergencyMode
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } ${(!newMessage.trim() && !selectedFile) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <FiSend size={20} />
            </button>
          </div>
          
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
          />
          
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <div>
              {isEmergencyMode ? (
                <span className="text-red-600 flex items-center">
                  <FiAlertTriangle className="mr-1" /> Emergency communication
                </span>
              ) : 'Standard message'}
            </div>
            <div>
              <button 
                onClick={() => setIsEmergencyMode(!isEmergencyMode)}
                className="text-red-600 hover:underline"
              >
                {isEmergencyMode ? 'Exit emergency mode' : 'Switch to emergency mode'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sfira_chat;