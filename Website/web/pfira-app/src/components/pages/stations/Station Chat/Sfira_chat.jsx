import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiPaperclip, FiMic, FiPhone, FiVideo, FiUser, FiMapPin, FiAlertTriangle } from 'react-icons/fi';

const Sfira_chat = () => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'DRRMO Operator', text: 'Emergency alert received. What is your situation?', timestamp: '10:30 AM', isEmergency: true },
    { id: 2, sender: 'You', text: 'Fire outbreak in Barangay Lahug near UC campus!', timestamp: '10:31 AM', isEmergency: true },
    { id: 3, sender: 'DRRMO Operator', text: 'Help is on the way. Can you share your exact location?', timestamp: '10:32 AM', isEmergency: true },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const messagesEndRef = useRef(null);

  // Sample emergency contacts
  const emergencyContacts = [
    { id: 1, name: 'DRRMO Central', status: 'Online', avatar: 'D' },
    { id: 2, name: 'BFP Station 1', status: 'Online', avatar: 'B' },
    { id: 3, name: 'CCPO Dispatch', status: 'Offline', avatar: 'C' },
    { id: 4, name: 'Medical Response', status: 'Online', avatar: 'M' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;
    
    const newMsg = {
      id: messages.length + 1,
      sender: 'You',
      text: newMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEmergency: isEmergencyMode
    };
    
    setMessages([...messages, newMsg]);
    setNewMessage('');
    
    // Simulate response after 1-2 seconds
    setTimeout(() => {
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
        isEmergency: isEmergencyMode
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

  const triggerEmergency = () => {
    setIsEmergencyMode(true);
    setMessages([
      ...messages,
      { 
        id: messages.length + 1, 
        sender: 'System', 
        text: 'EMERGENCY MODE ACTIVATED - Connecting to DRRMO', 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: true 
      }
    ]);
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
            <div className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer">
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
                  <p className="text-sm text-gray-500">{contact.status}</p>
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
              D
            </div>
            <div>
              <h3 className="font-medium">DRRMO Central</h3>
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
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`mb-4 flex ${
                message.sender === 'You' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                message.sender === 'You' 
                  ? isEmergencyMode 
                    ? 'bg-red-600 text-white' 
                    : 'bg-blue-600 text-white'
                  : message.isEmergency
                    ? 'bg-red-100 border border-red-200'
                    : 'bg-white border border-gray-200'
              }`}>
                {message.sender !== 'You' && (
                  <div className={`text-xs font-medium mb-1 ${
                    message.isEmergency ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {message.sender}
                  </div>
                )}
                <p>{message.text}</p>
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
          ))}
          <div ref={messagesEndRef} />
        </div>
        
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
          <div className="flex items-center">
            <button className="p-2 text-gray-500 hover:text-gray-700 mr-2">
              <FiPaperclip size={20} />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 mr-2">
              <FiMic size={20} />
            </button>
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
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className={`ml-3 p-2 rounded-full ${
                isEmergencyMode
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } ${!newMessage.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <FiSend size={20} />
            </button>
          </div>
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