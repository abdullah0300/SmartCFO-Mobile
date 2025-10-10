// src/components/Notifications/NotificationCenter.tsx

import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  Filter, 
  Calendar,
  Clock,
  AlertCircle,
  Info,
  X
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from 'date-fns';
import { notificationConfig, NotificationType } from '../../types/notification.types'; // CHANGE THIS LINE
import * as Icons from 'lucide-react';

export const NotificationCenter: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    loading,
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    refreshNotifications 
  } = useNotifications();
  
  const [selectedType, setSelectedType] = useState<NotificationType | 'all'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { formatCurrency, baseCurrency } = useSettings();

  const formatNotificationMessage = (notification: any) => {
    let message = notification.message;
    
    // Check if notification was already formatted at creation
    if (notification.metadata?.formatted_at_creation) {
      return message; // Already formatted, return as-is
    }
    
    // Legacy formatting for old notifications
    if (notification.metadata?.amount !== undefined) {
      const amount = notification.metadata.amount;
      const currency = notification.metadata.currency || baseCurrency;
      message = message.replace(/\$[\d,]+\.?\d*/g, () => {
        return formatCurrency(Math.abs(amount), currency);
      });
    } else {
      message = message.replace(/\$[\d,]+\.?\d*/g, (match: string) => {
        const amount = parseFloat(match.replace(/[$,]/g, ''));
        return formatCurrency(Math.abs(amount), baseCurrency);
      });
    }
    
    return message;
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    if (selectedType !== 'all' && notification.type !== selectedType) return false;
    if (showUnreadOnly && notification.is_read) return false;
    return true;
  });

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = parseISO(notification.created_at);
    let key: string;
    
    if (isToday(date)) {
      key = 'Today';
    } else if (isYesterday(date)) {
      key = 'Yesterday';
    } else {
      key = format(date, 'MMMM d, yyyy');
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(notification);
    return groups;
  }, {} as Record<string, typeof notifications>);

  // Get icon component
  const getIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName] || Icons.Bell;
    return Icon;
  };

  // Handle notification click
  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  // Handle bulk actions
  const handleBulkDelete = async () => {
    if (selectedNotifications.size === 0) return;
    
    if (window.confirm(`Delete ${selectedNotifications.size} notifications?`)) {
      const idsToDelete = Array.from(selectedNotifications);
      for (const id of idsToDelete) {
        await deleteNotification(id);
      }
      setSelectedNotifications(new Set());
    }
  };

  const handleBulkMarkAsRead = async () => {
    if (selectedNotifications.size === 0) return;
    
    const idsToMarkRead = Array.from(selectedNotifications);
    for (const id of idsToMarkRead) {
      const notification = notifications.find(n => n.id === id);
      if (notification && !notification.is_read) {
        await markAsRead(id);
      }
    }
    setSelectedNotifications(new Set());
  };

  // Toggle notification selection
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedNotifications);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedNotifications(newSelection);
  };

  // Select all visible notifications
  const selectAll = () => {
    const newSelection = new Set(filteredNotifications.map(n => n.id));
    setSelectedNotifications(newSelection);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedNotifications(new Set());
  };

  // Get notification type counts with type safety
  const typeCounts = notifications.reduce((counts, notification) => {
    const type = notification.type as NotificationType;
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {} as Partial<Record<NotificationType, number>>);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notification Center</h1>
        <p className="text-gray-600">
          Stay updated with your latest activities and important alerts
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
            </div>
            <Bell className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Unread</p>
              <p className="text-2xl font-bold text-blue-900">{unreadCount}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">This Week</p>
              <p className="text-2xl font-bold text-green-900">
                {notifications.filter(n => {
                  const date = parseISO(n.created_at);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return date > weekAgo;
                }).length}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600">Important</p>
              <p className="text-2xl font-bold text-purple-900">
                {notifications.filter(n => n.priority === 'high' || n.priority === 'urgent').length}
              </p>
            </div>
            <Info className="h-8 w-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter:</span>
              </div>
              
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as NotificationType | 'all')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {Object.entries(notificationConfig).map(([type, config]) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    {typeCounts[type as NotificationType] ? ` (${typeCounts[type as NotificationType]})` : ''}
                  </option>
                ))}
              </select>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUnreadOnly}
                  onChange={(e) => setShowUnreadOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Unread only</span>
              </label>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center gap-3">
              {selectedNotifications.size > 0 && (
                <>
                  <span className="text-sm text-gray-600">
                    {selectedNotifications.size} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleBulkMarkAsRead}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Mark as read
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Delete
                  </button>
                </>
              )}
              
              {selectedNotifications.size === 0 && filteredNotifications.length > 0 && (
                <>
                  <button
                    onClick={selectAll}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Select all
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                    >
                      <CheckCheck className="h-4 w-4" />
                      Mark all as read
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length > 0 ? (
            Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
              <div key={date}>
                <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                  {date}
                </div>
                {dateNotifications.map((notification) => {
                  const config = notificationConfig[notification.type] || {
                    icon: 'Bell',
                    color: 'text-gray-600',
                    bgColor: 'bg-gray-100'
                  };
                  const Icon = getIcon(config.icon);
                  const isSelected = selectedNotifications.has(notification.id);
                  
                  return (
                    <div
                      key={notification.id}
                      className={`px-4 py-4 hover:bg-gray-50 transition-colors ${
                        !notification.is_read ? 'bg-blue-50 hover:bg-blue-100' : ''
                      } ${isSelected ? 'bg-yellow-50' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(notification.id)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />

                        {/* Icon */}
                        <div className={`p-2 rounded-full ${config.bgColor} flex-shrink-0`}>
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div
                            onClick={() => handleNotificationClick(notification)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className={`text-sm font-medium text-gray-900 ${
                                  !notification.is_read ? 'font-semibold' : ''
                                }`}>
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {formatNotificationMessage(notification)}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true })}
                                  </span>
                                  {notification.priority !== 'normal' && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                      notification.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                      notification.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {notification.priority}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex items-center gap-2 ml-4">
                                {!notification.is_read && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(notification.id);
                                    }}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                    title="Mark as read"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">No notifications found</p>
              <p className="text-gray-600">
                {showUnreadOnly ? "You're all caught up! No unread notifications." : 
                 selectedType !== 'all' ? `No ${selectedType.replace(/_/g, ' ')} notifications yet.` :
                 "You don't have any notifications yet."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};