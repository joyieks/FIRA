import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../config/supabase';
import { analyzeMessageForFireAlarm, updateMessageWithAIAnalysis } from '../../../services/aiService';

export default function AChatPage({ contact, onBack, currentAdminId }) {
	const [message, setMessage] = useState('');
	const [messages, setMessages] = useState([]);
	const [editingMessage, setEditingMessage] = useState(null);
	const [editText, setEditText] = useState('');
	const messagesEndRef = useRef(null);
	const [activeIncidentId, setActiveIncidentId] = useState(null);

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

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollToEnd({ animated: true });
	};

	useEffect(() => {
		const fetchThread = async () => {
			if (!contact?.id || !currentAdminId) return;
			const { data, error } = await supabase
				.from('messages')
				.select('*')
				.or(`and(sender_id.eq.${contact.id},receiver_id.eq.${currentAdminId}),and(sender_id.eq.${currentAdminId},receiver_id.eq.${contact.id})`)
				.order('created_at', { ascending: true });
			if (!error) {
				setMessages(data || []);
				setTimeout(scrollToBottom, 100);
				await supabase
					.from('messages')
					.update({ is_read: true })
					.eq('sender_id', contact.id)
					.eq('receiver_id', currentAdminId)
					.eq('is_read', false);
			}
		};
		fetchThread();
	}, [contact?.id, currentAdminId]);

	useEffect(() => {
		if (!contact?.id || !currentAdminId) return;
		const channel = supabase
			.channel(`messages:${contact.id}:${currentAdminId}`)
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `or(and(sender_id.eq.${contact.id},receiver_id.eq.${currentAdminId}),and(sender_id.eq.${currentAdminId},receiver_id.eq.${contact.id}))` }, (payload) => {
			setMessages((prev) => [...prev, payload.new]);
			setTimeout(scrollToBottom, 100);
		})
			.subscribe();
		return () => { channel.unsubscribe(); };
	}, [contact?.id, currentAdminId]);

	const sendMessage = async () => {
		if (!message.trim() || !contact?.id || !currentAdminId) return;
		const text = message.trim();
		setMessage('');
		const payload = {
			sender_id: currentAdminId,
			receiver_id: contact.id,
			sender_type: 'admin',
			receiver_type: contact.type,
			text,
			is_emergency: false,
			is_read: false,
			report_id: activeIncidentId || null,
		};
		const { data, error } = await supabase.from('messages').insert(payload).select();
		if (!error && data && data[0]) {
			setMessages((prev) => [...prev, data[0]]);
			setTimeout(scrollToBottom, 100);
			if (activeIncidentId) {
				try {
					const analysis = await analyzeMessageForFireAlarm(text);
					if (analysis) await updateMessageWithAIAnalysis(data[0].id, analysis, supabase);
				} catch (_) {}
			}
		}
	};

	const handleLongPress = (msg) => {
		if ((msg.sender_type || msg.sender) === 'admin') {
			Alert.alert(
				'Message Options',
				'Choose an action:',
				[
					{ text: 'Edit', onPress: () => { setEditingMessage(msg); setEditText(msg.text); } },
					{ text: 'Delete', onPress: () => handleDeleteConfirmation(msg.id), style: 'destructive' },
					{ text: 'Cancel', style: 'cancel' }
				]
			);
		} else {
			Alert.alert(
				'Message Options',
				'Choose an action:',
				[
					{ text: 'Delete for you only', onPress: () => handleDeleteMessage(msg.id, false), style: 'destructive' },
					{ text: 'Cancel', style: 'cancel' }
				]
			);
		}
	};

	const handleDeleteConfirmation = (messageId) => {
		Alert.alert(
			'Delete Message',
			'Who should this message be deleted for?',
			[
				{ text: 'For you', onPress: () => handleDeleteMessage(messageId, false), style: 'default' },
				{ text: 'For everyone', onPress: () => handleDeleteMessage(messageId, true), style: 'destructive' },
				{ text: 'Cancel', style: 'cancel' }
			]
		);
	};

	const handleDeleteMessage = (messageId, deleteForEveryone) => {
		if (deleteForEveryone) {
			setMessages(messages.map(msg => msg.id === messageId ? { ...msg, text: 'This message was deleted', isDeleted: true } : msg));
		} else {
			setMessages(messages.filter(msg => msg.id !== messageId));
		}
	};

	const handleEditMessage = () => {
		if (editText.trim() && editingMessage) {
			setMessages(messages.map(msg => msg.id === editingMessage.id ? { ...msg, text: editText.trim(), isEdited: true } : msg));
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
				ref={messagesEndRef}
			>
				{messages.map((msg) => (
					<TouchableOpacity
						key={msg.id}
						onLongPress={() => handleLongPress(msg)}
						activeOpacity={0.7}
						className={`mb-4 ${(msg.sender_type === 'admin' || msg.sender === 'admin') ? 'items-end' : 'items-start'}`}
					>
						<View className={`max-w-[80%] ${(msg.sender_type === 'admin' || msg.sender === 'admin') ? 'bg-gray-800' : 'bg-gray-100'} rounded-2xl px-4 py-3`}>
							{!(msg.sender_type === 'admin' || msg.sender === 'admin') && (
								<Text className="text-xs font-medium text-gray-600 mb-1">
									{getSenderName(msg.sender_type || msg.sender)}
								</Text>
							)}
							<Text className={`text-base ${(msg.sender_type === 'admin' || msg.sender === 'admin') ? 'text-white' : 'text-gray-800'} ${msg.isDeleted ? 'italic text-gray-500' : ''}`}>
								{msg.text}
							</Text>
							{msg.ai_suggested_alarm && (
								<View className="mt-2 self-start bg-blue-100 border border-blue-200 rounded px-2 py-1">
									<Text className="text-[10px] text-blue-800 font-semibold">AI Suggested: {String(msg.ai_suggested_alarm?.suggested_alarm || msg.ai_suggested_alarm)}</Text>
								</View>
							)}
							<View className={`flex-row items-center mt-2 ${(msg.sender_type === 'admin' || msg.sender === 'admin') ? 'justify-end' : 'justify-start'}`}>
								<Text className={`text-xs ${(msg.sender_type === 'admin' || msg.sender === 'admin') ? 'text-gray-300' : 'text-gray-500'}`}>
									{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (msg.timestamp || '')}
								</Text>
								{(msg.sender_type === 'admin' || msg.sender === 'admin') && (
									<Ionicons name={msg.isRead ? "checkmark-done" : "checkmark"} size={14} color={msg.isRead ? "#D1D5DB" : "#9CA3AF"} style={{ marginLeft: 4 }} />
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
						<Ionicons name="send" size={18} color={message.trim() ? "#ffffff" : "#9CA3AF"} />
					</TouchableOpacity>
				</View>
			</View>

			{/* Edit Message Modal */}
			<Modal visible={editingMessage !== null} transparent={true} animationType="fade">
				<View className="flex-1 bg-black bg-opacity-50 justify-center items-center px-4">
					<View className="bg-white rounded-lg p-4 w-full max-w-sm">
						<Text className="text-lg font-semibold mb-4 text-center">Edit Message</Text>
						<TextInput value={editText} onChangeText={setEditText} className="border border-gray-300 rounded-lg px-3 py-2 mb-4 text-base" multiline maxLength={500} placeholder="Edit your message..." />
						<View className="flex-row justify-end space-x-2">
							<TouchableOpacity onPress={() => { setEditingMessage(null); setEditText(''); }} className="px-4 py-2 rounded-lg bg-gray-200">
								<Text className="text-gray-700">Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity onPress={handleEditMessage} className="px-4 py-2 rounded-lg bg-[#ff512f]">
								<Text className="text-white">Save</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		</KeyboardAvoidingView>
	);
}
