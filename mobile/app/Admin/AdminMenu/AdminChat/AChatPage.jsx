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
	const [aiModal, setAiModal] = useState({ open: false, level: null, reportId: null, saving: false, error: null, location: 'Loading...' });
	const [successModal, setSuccessModal] = useState({ open: false, level: null });

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

		console.log('🔔 Setting up real-time subscription for admin:', currentAdminId, 'with contact:', contact.id);

		// Listen for messages sent TO this admin (from the contact)
		const incomingChannel = supabase
			.channel(`messages:incoming:${currentAdminId}:${contact.id}`)
			.on('postgres_changes', { 
				event: 'INSERT', 
				schema: 'public', 
				table: 'messages', 
				filter: `receiver_id=eq.${currentAdminId}` 
			}, (payload) => {
				console.log('🔔 Incoming message received:', payload);
				// Only add if it's from the current contact
				if (payload.new.sender_id === contact.id) {
					setMessages((prev) => [...prev, payload.new]);
					setTimeout(scrollToBottom, 100);
				}
			})
			.subscribe();

		// Listen for messages sent BY this admin (to the contact)
		const outgoingChannel = supabase
			.channel(`messages:outgoing:${currentAdminId}:${contact.id}`)
			.on('postgres_changes', { 
				event: 'INSERT', 
				schema: 'public', 
				table: 'messages', 
				filter: `sender_id=eq.${currentAdminId}` 
			}, (payload) => {
				console.log('🔔 Outgoing message received:', payload);
				// Only add if it's to the current contact
				if (payload.new.receiver_id === contact.id) {
					// Check if message already exists (to avoid duplicates from optimistic update)
					setMessages((prev) => {
						const exists = prev.some(msg => msg.id === payload.new.id);
						if (exists) return prev;
						return [...prev, payload.new];
					});
					setTimeout(scrollToBottom, 100);
				}
			})
			.subscribe();

		return () => { 
			incomingChannel.unsubscribe(); 
			outgoingChannel.unsubscribe();
		};
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

	const normalizeAiLabel = (aiValue) => {
		if (!aiValue) return null;
		let suggested = null;
		if (typeof aiValue === 'string') {
			const trimmed = aiValue.trim();
			if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
				try { return normalizeAiLabel(JSON.parse(trimmed)); } catch (_) {}
			}
			suggested = aiValue;
		} else if (aiValue?.suggested_alarm) {
			suggested = aiValue.suggested_alarm;
		} else if (aiValue?.original_response?.alarm_level) {
			suggested = aiValue.original_response.alarm_level.toLowerCase().replace(/\s+/g, '_');
		}
		if (!suggested) return null;
		const map = {
			none: 'Under Control',
			first: '1st Alarm', first_alarm: '1st Alarm',
			second: '2nd Alarm', second_alarm: '2nd Alarm',
			third: '3rd Alarm', third_alarm: '3rd Alarm',
			fourth: '4th Alarm', fourth_alarm: '4th Alarm',
			fifth: '5th Alarm', fifth_alarm: '5th Alarm',
			task_force_alpha: 'TASK FORCE ALPHA',
			task_force_bravo: 'TASK FORCE BRAVO',
			task_force_charlie: 'TASK FORCE CHARLIE',
			task_force_delta_echo_hotel_india: 'TASK FORCE DELTA',
			general: 'GENERAL ALARM'
		};
		return map[suggested] || suggested;
	};

	const loadReportLocation = async (reportId) => {
		if (!reportId) return 'Unknown location';
		try {
			// Try Railway API first (has complete location data)
			try {
				const apiResponse = await fetch('https://new-fira-backend.onrender.com/get_reports');
				if (apiResponse.ok) {
					const allReports = await apiResponse.json();
					const report = Array.isArray(allReports) 
						? allReports.find(r => String(r.id) === String(reportId))
						: null;
					if (report) {
						const loc = report.address || report.geotag_location || report.location;
						if (loc) {
							console.log('✅ Location found from API:', loc);
							return loc;
						}
					}
				}
			} catch (apiErr) {
				console.warn('⚠️ API fetch failed, trying Supabase:', apiErr);
			}

			// Fallback to Supabase
			const { data, error } = await supabase
				.from('fire_reports')
				.select('address, geotag_location')
				.eq('id', reportId)
				.maybeSingle();
			if (error) {
				console.warn('⚠️ Could not load report location from Supabase:', error.message);
				return 'Unknown location';
			}
			const loc = data?.address || data?.geotag_location;
			return loc || 'Unknown location';
		} catch (err) {
			console.warn('⚠️ Could not load report location:', err);
			return 'Unknown location';
		}
	};

	const applyAiAlarm = async () => {
		if (!aiModal.reportId || !aiModal.level) return;
		setAiModal(prev => ({ ...prev, saving: true, error: null }));
		try {
			const response = await fetch('https://new-fira-backend.onrender.com/update_final_alarm_level', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ report_id: aiModal.reportId, final_alarm_level: aiModal.level })
			});
			if (!response.ok) {
				const text = await response.text();
				throw new Error(text || 'Failed to update alarm level');
			}
			const updatedLevel = aiModal.level;
			setAiModal({ open: false, level: null, reportId: null, saving: false, error: null, location: 'Loading...' });
			setSuccessModal({ open: true, level: updatedLevel });
		} catch (err) {
			console.error('Failed to apply AI alarm:', err);
			setAiModal(prev => ({ ...prev, saving: false, error: err.message || 'Failed to update alarm level' }));
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
							{normalizeAiLabel(msg.ai_suggested_alarm) && (
								<View className="mt-2 self-start">
									<View className="bg-blue-100 border border-blue-200 rounded px-2 py-1 flex-row items-center gap-1.5">
										<Text style={{ fontSize: 12 }}>✨</Text>
										<Text className="text-[10px] text-blue-800 font-semibold">AI Suggested: {normalizeAiLabel(msg.ai_suggested_alarm)}</Text>
									</View>
									{msg.report_id && (
										<TouchableOpacity
											onPress={async () => {
												// Always fetch location from the specific report ID that the station chose
												setAiModal({ open: true, level: normalizeAiLabel(msg.ai_suggested_alarm), reportId: msg.report_id, saving: false, error: null, location: 'Loading...' });
												const loc = await loadReportLocation(msg.report_id);
												setAiModal(prev => ({ ...prev, location: loc }));
											}}
											style={{
												marginTop: 6,
												backgroundColor: '#dc2626',
												paddingHorizontal: 12,
												paddingVertical: 8,
												borderRadius: 6,
												flexDirection: 'row',
												alignItems: 'center',
												gap: 6,
												shadowColor: '#000',
												shadowOffset: { width: 0, height: 1 },
												shadowOpacity: 0.1,
												shadowRadius: 2,
												elevation: 2
											}}
											activeOpacity={0.8}
										>
											<Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>✓ Apply to incident</Text>
										</TouchableOpacity>
									)}
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
			<Modal
				animationType="fade"
				transparent
				visible={aiModal.open}
				onRequestClose={() => setAiModal({ open: false, level: null, reportId: null, saving: false, error: null, location: 'Loading...' })}
			>
				<View className="flex-1 bg-black/30 justify-center items-center px-6">
					<View className="bg-white w-full rounded-2xl p-5">
						<View className="flex-row items-start space-x-3">
							<View className="p-2 bg-red-100 rounded-lg">
								<Ionicons name="warning" size={20} color="#dc2626" />
							</View>
							<View className="flex-1">
								<Text className="text-lg font-bold text-gray-900">AI Alarm Suggestion</Text>
								<Text className="text-sm text-gray-700 mt-1">
									AI suggests this incident is <Text className="font-semibold text-red-600">{aiModal.level}</Text>. Apply this alarm level to the linked incident?
								</Text>
								<Text className="text-sm text-gray-600 mt-2">
									<Text className="font-semibold">Location:</Text> {aiModal.location || 'Unknown location'}
								</Text>
								{aiModal.error ? (
									<Text className="text-sm text-red-600 mt-2">{aiModal.error}</Text>
								) : null}
							</View>
						</View>
						<View className="flex-row justify-end space-x-3 mt-4">
							<TouchableOpacity
								onPress={() => setAiModal({ open: false, level: null, reportId: null, saving: false, error: null, location: 'Loading...' })}
								disabled={aiModal.saving}
								className="px-4 py-2 rounded-lg border border-gray-300"
							>
								<Text className="text-gray-700">Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={applyAiAlarm}
								disabled={aiModal.saving}
								className="px-4 py-2 rounded-lg bg-red-600"
							>
								<Text className="text-white font-semibold">{aiModal.saving ? 'Applying...' : 'Change the Alarm'}</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>

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

			{/* Success Modal */}
			<Modal visible={successModal.open} transparent={true} animationType="fade">
				<View className="flex-1 bg-black bg-opacity-50 justify-center items-center px-4">
					<View className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
						<View className="flex-row items-center mb-4">
							<View style={{ backgroundColor: '#dcfce7', padding: 12, borderRadius: 999 }}>
								<Ionicons name="checkmark-circle" size={24} color="#16a34a" />
							</View>
							<View className="ml-3 flex-1">
								<Text className="text-lg font-bold text-gray-900">Success!</Text>
								<Text className="text-sm text-gray-700 mt-1">
									Alarm level has been updated to <Text className="font-semibold text-green-600">{successModal.level}</Text>
								</Text>
							</View>
						</View>
						<TouchableOpacity
							onPress={() => setSuccessModal({ open: false, level: null })}
							className="px-6 py-3 rounded-lg bg-green-600"
						>
							<Text className="text-white font-semibold text-center">OK</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</KeyboardAvoidingView>
	);
}
