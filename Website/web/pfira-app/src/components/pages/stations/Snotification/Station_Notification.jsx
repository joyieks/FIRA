import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FiBell, FiCheck, FiTrash2 } from 'react-icons/fi';
import { supabase } from '../../../../config/supabase';

const Station_Notification = () => {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // all | unread | read

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const loadNotifications = useCallback(async () => {
    try {
      const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
      const stationId = userData?.id;
      if (!stationId) return;
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', stationId)
        .eq('user_type', 'station')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 4000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (!error) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        try {
          // Stop any active station alarm immediately when a notification is marked read
          if (window.__stationAlarmAudio) {
            window.__stationAlarmAudio.pause();
            window.__stationAlarmAudio.currentTime = 0;
            window.__stationAlarmAudio.loop = false;
          }
        } catch (_) {}
      }
    } catch (_) {}
  };

  const clearAll = async () => {
    try {
      const userData = JSON.parse(sessionStorage.getItem('userData') || localStorage.getItem('userData') || '{}');
      const stationId = userData?.id;
      if (!stationId) return;
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', stationId)
        .eq('user_type', 'station');
      if (!error) setNotifications([]);
    } catch (_) {}
  };

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.is_read);
    if (filter === 'read') return notifications.filter(n => n.is_read);
    return notifications;
  }, [filter, notifications]);
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        
        {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex space-x-4">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg font-medium ${filter==='all' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>All ({notifications.length})</button>
          <button onClick={() => setFilter('unread')} className={`px-4 py-2 rounded-lg font-medium ${filter==='unread' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Unread ({unreadCount})</button>
          <button onClick={() => setFilter('read')} className={`px-4 py-2 rounded-lg font-medium ${filter==='read' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Read ({notifications.length - unreadCount})</button>
          <div className="ml-auto">
            <button onClick={clearAll} className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 inline-flex items-center"><FiTrash2 className="mr-2" /> Clear all</button>
          </div>
        </div>
      </div>
      {/* Notifications List */}
      <div className="space-y-4">
        {filtered.map((notification) => (
          <div key={notification.id} className={`bg-white rounded-lg shadow-sm border-l-4 border-l-red-600 p-4 ${!notification.is_read ? 'ring-2 ring-red-100' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-sm font-medium text-gray-900">{notification.title}</h3>
                  {!notification.is_read && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">New</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>{notification.created_at ? new Date(notification.created_at).toLocaleString() : 'Just now'}</span>
                </div>
              </div>
              {!notification.is_read && (
                <button onClick={() => markAsRead(notification.id)} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 inline-flex items-center">
                  <FiCheck className="mr-1" /> Mark as read
                </button>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
};

export default Station_Notification;