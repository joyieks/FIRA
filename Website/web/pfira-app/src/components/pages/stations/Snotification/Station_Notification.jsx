import React from 'react';
import { FiBell, FiCheck, FiTrash2 } from 'react-icons/fi';

const Station_Notification = () => {
  // Placeholder notifications
  const notifications = [
    { id: 1, title: 'Sample Notification', message: 'This is a sample notification.', read: false, timestamp: new Date().toISOString() },
    { id: 2, title: 'Another Notification', message: 'Another sample message.', read: true, timestamp: new Date().toISOString() },
  ];
  const unreadCount = notifications.filter(n => !n.read).length;
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <FiBell className="text-red-600 mr-3" size={24} />
          <h1 className="text-2xl font-bold text-gray-800">Station Notifications</h1>
          {unreadCount > 0 && (
            <span className="ml-3 bg-red-100 text-red-800 text-sm font-semibold px-2 py-1 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
            <FiCheck className="mr-1" />
            Mark All Read
          </button>
          <button className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center">
            <FiTrash2 className="mr-1" />
            Clear All
          </button>
        </div>
      </div>
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex space-x-4">
          <button className="px-4 py-2 rounded-lg font-medium bg-red-600 text-white">All (2)</button>
          <button className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Unread (1)</button>
          <button className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">Read (1)</button>
        </div>
      </div>
      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.map((notification) => (
          <div key={notification.id} className={`bg-white rounded-lg shadow-sm border-l-4 border-l-red-600 p-4 ${!notification.read ? 'ring-2 ring-red-100' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="text-sm font-medium text-gray-900">{notification.title}</h3>
                  {!notification.read && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">New</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Just now</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Station_Notification;