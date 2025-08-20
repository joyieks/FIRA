import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiPaperclip, FiUser, FiAlertTriangle, FiImage, FiCheck } from 'react-icons/fi';
import { db, auth, storage } from './../../../../config/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const Sfira_chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [users, setUsers] = useState([]); // stationUsers
  const [selectedUser, setSelectedUser] = useState(null);
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Fallback emergency contacts for Contacts tab
  const emergencyContacts = [
    { id: 1, name: 'DRRMO Central', status: 'Online', avatar: 'D' },
    { id: 2, name: 'BFP Station 1', status: 'Online', avatar: 'B' },
    { id: 3, name: 'CCPO Dispatch', status: 'Offline', avatar: 'C' },
    { id: 4, name: 'Medical Response', status: 'Online', avatar: 'M' },
  ];

  // Fetch admin and station users for chat list
  useEffect(() => {
    const fetchUsers = async () => {
      const [stationsSnap, adminsSnap] = await Promise.all([
        getDocs(collection(db, 'stationUsers')),
        getDocs(collection(db, 'adminUser')),
      ]);
      const currentUid = auth.currentUser?.uid;
      const stations = stationsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.data().fullName || d.data().displayName || d.data().stationName || '',
        email: d.data().email || '',
        type: 'station',
      }));
      const admins = adminsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.data().fullName || d.data().displayName || 'Admin',
        email: d.data().email || '',
        type: 'admin',
      }));
      const combined = [...admins, ...stations].filter(u => !!u.id && u.id !== currentUid);
      setUsers(combined);
    };
    fetchUsers();
  }, []);

  // Real-time messages for selected user
  useEffect(() => {
    if (!selectedUser) return;
    // Fetch all messages, filter in callback (same as Admin Chat)
    const q = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Only show messages between current user and selected user
        if (
          (data.senderId === auth.currentUser?.uid && data.receiverId === selectedUser.id) ||
          (data.senderId === selectedUser.id && data.receiverId === auth.currentUser?.uid)
        ) {
          msgs.push({ id: doc.id, ...data });
        }
      });
      setMessages(msgs);
      scrollToBottom();
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
      await addDoc(collection(db, 'messages'), {
        sender: auth.currentUser?.displayName || 'Station',
        senderId: auth.currentUser?.uid || '',
        receiverId: selectedUser.id,
        receiverName: selectedUser.name || selectedUser.email || '',
        text: newMessage,
        isEmergency: isEmergencyMode,
        timestamp: serverTimestamp(),
        userType: 'station',
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
      const path = `chatImages/${auth.currentUser?.uid}/${Date.now()}-${file.name}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file);
      const downloadURL = await getDownloadURL(ref);
      await addDoc(collection(db, 'messages'), {
        sender: auth.currentUser?.displayName || 'Station',
        senderId: auth.currentUser?.uid || '',
        receiverId: selectedUser.id,
        receiverName: selectedUser.name || selectedUser.email || '',
        text: '',
        imageUrl: downloadURL,
        isEmergency: isEmergencyMode,
        timestamp: serverTimestamp(),
        userType: 'station',
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
      if (reactedBy.includes(uid)) return; // do not allow revert or duplicate
      const mref = doc(db, 'messages', message.id);
      await updateDoc(mref, { checkReactedBy: arrayUnion(uid) });
    } catch (error) {
      alert('Failed to react: ' + error.message);
    }
  };

  // Acknowledge button (toggle). Prefer new field `ackBy` but still support old `checkReactedBy`.
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
        userType: 'station',
      });
    } catch (error) {
      alert('Failed to send emergency message: ' + error.message);
    }
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
            {/* Real-time user list for chat */}
            {users.map(user => (
              <div
                key={user.id}
                className={`p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer flex items-center ${selectedUser?.id === user.id ? 'bg-red-50' : ''}`}
                onClick={() => setSelectedUser(user)}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                  {user.name ? user.name[0] : (user.email ? user.email[0] : '?')}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{user.name || user.email}</h3>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
            ))}
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
                  {/* Removed call icon */}
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
                {/* Reserved for future actions */}
              </div>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.map((message) => {
            const isMine = message.senderId === auth.currentUser?.uid;
            const ackList = message.ackBy || message.checkReactedBy || [];
            const hasAcked = !!auth.currentUser?.uid && ackList.includes(auth.currentUser.uid);
            const ackCount = ackList.length || 0;
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
                    {ackCount > 0 && <span className="ml-1">{ackCount}</span>}
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
                        {message.sender}
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
                  {/* Messenger-style seen/sent indicator below message */}
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
                    {ackCount > 0 && <span className="ml-1">{ackCount}</span>}
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

export default Sfira_chat;