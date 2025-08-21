import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiPaperclip, FiMic, FiPhone, FiVideo, FiUser, FiMapPin, FiAlertTriangle, FiImage, FiCheck } from 'react-icons/fi';
import { db, auth, storage } from './../../../../config/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const Afira_chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [users, setUsers] = useState([]); // stationUsers
  const [selectedUser, setSelectedUser] = useState(null);
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  // Restore emergency contacts for Contacts tab
  const emergencyContacts = [
    { id: 1, name: 'DRRMO Central', status: 'Online', avatar: 'D' },
    { id: 2, name: 'BFP Station 1', status: 'Online', avatar: 'B' },
    { id: 3, name: 'CCPO Dispatch', status: 'Offline', avatar: 'C' },
    { id: 4, name: 'Medical Response', status: 'Online', avatar: 'M' },
  ];

  // Fetch station users for chat list (admins chat with stations)
  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, 'stationUsers'));
      setUsers(snapshot.docs.map(doc => {
        const data = doc.data();
        const name =
          data.stationName ||
          data['Station Name'] ||
          data.name ||
          data.Username ||
          "Unnamed User";
        const email =
          data.email ||
          data.Email ||
          "";
        return {
          id: data.uid || doc.id,
          docId: doc.id,
          name,
          email,
          avatar: name[0] || 'U',
        };
      }));
    };
    fetchUsers();
  }, []);

  // Real-time messages for selected user
  useEffect(() => {
    if (!selectedUser) return;
    
    setMessages([]); // Clear messages when switching users
    
    const q = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      const currentUserId = auth.currentUser?.uid;
      const selectedUserId = selectedUser.id;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Show messages between admin and selected station, regardless of userType
        if (
          (data.senderId === currentUserId && data.receiverId === selectedUserId) ||
          (data.senderId === selectedUserId && data.receiverId === currentUserId) ||
          // Fallback for admin <-> station communication
          (data.userType === 'admin' && data.receiverId === selectedUserId) ||
          (data.userType === 'station' && data.senderId === selectedUserId)
        ) {
          msgs.push({ id: doc.id, ...data });
        }
      });
      setMessages(msgs);
      setTimeout(scrollToBottom, 100);
    });
    return () => unsubscribe();
    // eslint-disable-next-line
  }, [selectedUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || !selectedUser) return;
    try {
      const currentUserId = auth.currentUser?.uid;
      const selectedUserId = selectedUser.id;
      
      await addDoc(collection(db, 'messages'), {
        sender: auth.currentUser?.displayName || 'Admin',
        senderId: currentUserId || 'admin',
        receiverId: selectedUserId,
        receiverName: selectedUser.name || selectedUser.email || '',
        text: newMessage,
        isEmergency: isEmergencyMode,
        timestamp: serverTimestamp(),
        userType: 'admin',
      });
      setNewMessage('');
    } catch (error) {
      alert('Failed to send message: ' + error.message);
    }
  };

  const handleSelectImage = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file || !selectedUser) return;
    setIsUploadingImage(true);
    try {
      const currentUserId = auth.currentUser?.uid;
      const selectedUserId = selectedUser.id;
      
      const path = `chatImages/${currentUserId}/${Date.now()}-${file.name}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file);
      const downloadURL = await getDownloadURL(ref);
      await addDoc(collection(db, 'messages'), {
        sender: auth.currentUser?.displayName || 'Admin',
        senderId: currentUserId || 'admin',
        receiverId: selectedUserId,
        receiverName: selectedUser.name || selectedUser.email || '',
        text: '',
        imageUrl: downloadURL,
        isEmergency: isEmergencyMode,
        timestamp: serverTimestamp(),
        userType: 'admin',
      });
    } catch (error) {
      alert('Failed to upload image: ' + error.message);
    } finally {
      setIsUploadingImage(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReactCheck = async (message) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid || !message?.id) return;
      const reactedBy = message.checkReactedBy || [];
      if (reactedBy.includes(uid)) return; // non-revertable
      const mref = doc(db, 'messages', message.id);
      await updateDoc(mref, { checkReactedBy: arrayUnion(uid) });
    } catch (error) {
      alert('Failed to react: ' + error.message);
    }
  };

  // Acknowledge button (toggle)
  const handleAcknowledge = async (message) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid || !message?.id) return;
      const alreadyAcked = (message.ackBy || message.checkReactedBy || []).includes(uid);
      const mref = doc(db, 'messages', message.id);
      if (alreadyAcked) {
        await updateDoc(mref, { ackBy: arrayRemove(uid) });
      } else {
        await updateDoc(mref, { ackBy: arrayUnion(uid) });
      }
    } catch (error) {
      alert('Failed to acknowledge: ' + error.message);
    }
  };

  const triggerEmergency = async () => {
    setIsEmergencyMode(true);
    try {
      await addDoc(collection(db, 'messages'), {
        sender: 'System',
        senderId: 'system',
        text: 'EMERGENCY MODE ACTIVATED - Connecting to DRRMO',
        isEmergency: true,
        timestamp: serverTimestamp(),
        userType: 'admin',
      });
    } catch (error) {
      alert('Failed to send emergency message: ' + error.message);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
<div className="w-1/4 bg-white border-r flex flex-col">
  {/* Sidebar Header */}
<div className="p-4 border-b border-gray-300">
  <h2 className="text-lg font-bold text-red-600">Project FIRA</h2>
  <p className="text-sm text-gray-500">Emergency Communication</p>
</div>

{/* Tabs */}
<div className="flex border-b border-gray-300">
  <button
    className={`flex-1 py-2 text-center font-medium ${
      activeTab === 'chat'
        ? 'text-red-600 border-b-2 border-red-600'
        : 'text-gray-500 hover:text-gray-700'
    }`}
    onClick={() => setActiveTab('chat')}
  >
    Chats
  </button>
  <button
    className={`flex-1 py-2 text-center font-medium ${
      activeTab === 'contacts'
        ? 'text-red-600 border-b-2 border-red-600'
        : 'text-gray-500 hover:text-gray-700'
    }`}
    onClick={() => setActiveTab('contacts')}
  >
    Contacts
  </button>
</div>

  {/* Chat tab */}
  {activeTab === 'chat' && (
    <div className="overflow-y-auto h-[calc(100vh-12rem)] p-4 space-y-2">
      {users.map(user => (
        <div 
          key={user.id} 
          onClick={() => setSelectedUser(user)}
          className={`cursor-pointer p-2 hover:bg-gray-200 rounded-lg flex items-center space-x-2 ${selectedUser?.id === user.id ? 'bg-gray-300' : ''}`}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-green-100 text-green-600">
            {user.avatar}
          </div>
          <div>
            <div className="font-bold">{user.name}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        </div>
      ))}
    </div>
  )}

  {/* Contacts tab */}
  {activeTab === 'contacts' && (
    <div className="overflow-y-auto h-[calc(100vh-12rem)] p-4 space-y-2">
      {emergencyContacts.map(contact => (
        <div 
          key={contact.id}
          className="cursor-pointer p-2 hover:bg-gray-200 rounded-lg"
          onClick={() => setSelectedUser({ id: contact.id, name: contact.name, email: contact.email })}
        >
          <div className="flex items-center space-x-2">
            <div>
              <div className="font-bold">{contact.name}</div>
              <div className="text-sm text-gray-500">{contact.email}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Only show chat if a user is selected */}
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className={`p-4 border-b border-gray-200 flex items-center justify-between ${
              isEmergencyMode ? 'bg-red-50' : 'bg-white'
            }`}>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                  {selectedUser.name ? selectedUser.name[0] : (selectedUser.email ? selectedUser.email[0] : '?')}
                </div>
                <div>
                  <h3 className="font-medium">{selectedUser.name || selectedUser.email}</h3>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                {/* Removed video call, map, and call icons */}
              </div>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messages.map((message) => {
                const isMine = message.userType === 'admin';
                return (
                  <div 
                    key={message.id} 
                    className={`mb-4 flex ${isMine ? 'justify-end' : 'justify-start'} items-center`}
                  >
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(message)}
                        className={`mr-2 inline-flex items-center text-xs text-green-600 ${hasAcked ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                        aria-label={hasAcked ? 'Acknowledged' : 'Acknowledge message'}
                        title={hasAcked ? 'You acknowledged' : 'Acknowledge'}
                      >
                        <span className="text-base leading-none">✅</span>
                        {count > 0 && <span className="ml-1">{count}</span>}
                      </button>
                    )}
                    <div className={`max-w-xs md:max-w-md ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-lg px-4 py-2 ${
                        isMine 
                          ? isEmergencyMode 
                            ? 'bg-red-600 text-white' 
                            : 'bg-blue-600 text-white'
                          : message.isEmergency
                            ? 'bg-red-100 border border-red-200'
                            : 'bg-white border border-gray-200'
                      }`}>
                        {!isMine && (
                          <div className={`text-xs font-medium mb-1 ${
                            message.isEmergency ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {message.sender || selectedUser.name || selectedUser.email}
                          </div>
                        )}
                        {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
                        {message.imageUrl && (
                          <img
                            src={message.imageUrl}
                            alt="sent attachment"
                            className="mt-1 max-h-60 rounded-md object-cover"
                          />
                        )}
                        <div className={`text-xs mt-1 text-right ${
                          isMine 
                            ? 'text-white text-opacity-80' 
                            : message.isEmergency 
                              ? 'text-red-500' 
                              : 'text-gray-500'
                        }`}>
                          {message.timestamp && message.timestamp.toDate ? message.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                      <div className={`mt-0.5 flex items-center ${isMine ? 'justify-end' : 'justify-start'} space-x-2`}>
                        {isMine ? (
                          ((message.seenBy || []).includes(selectedUser?.id)) ? (
                            <span className="inline-flex items-center text-[10px] text-green-600">
                              <FiCheck className="mr-1" size={12} /> Seen
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] text-gray-400">
                              <FiCheck className="mr-1" size={12} /> Sent
                            </span>
                          )
                        ) : null}
                      </div>
                    </div>
                    {!isMine && (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(message)}
                        className={`ml-2 inline-flex items-center text-xs text-green-600 ${hasAcked ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                        aria-label={hasAcked ? 'Acknowledged' : 'Acknowledge message'}
                        title={hasAcked ? 'You acknowledged' : 'Acknowledge'}
                      >
                        <span className="text-base leading-none">✅</span>
                        {count > 0 && <span className="ml-1">{count}</span>}
                      </button>
                    )}
                  </div>
                );
              })}
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
                <button className="p-2 text-gray-500 hover:text-gray-700 mr-2" disabled={isUploadingImage}>
                  <FiPaperclip size={20} />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSelectImage}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingImage || !selectedUser}
                  className={`p-2 mr-2 rounded-full ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Send image"
                >
                  <FiImage size={20} />
                </button>
                {/* Removed voice message icon */}
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">
            Select a user to start chatting.
          </div>
        )}
      </div>
    </div>
  );
};

export default Afira_chat;