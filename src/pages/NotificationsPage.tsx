import React from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle, Clock, AlertCircle } from "lucide-react";

export function NotificationsPage() {
  console.log('🔍 NOTIFICATIONS PAGE MOUNTED');
  const navigate = useNavigate();

  // Sample notifications
  const notifications = [
    {
      id: '1',
      type: 'success',
      title: 'Assignment Submitted',
      message: 'Your Writing Task 1 has been submitted successfully',
      time: '2 hours ago',
      read: false
    },
    {
      id: '2',
      type: 'info',
      title: 'Live Class Reminder',
      message: 'Speaking practice session starts in 30 minutes',
      time: '30 minutes ago',
      read: false
    },
    {
      id: '3',
      type: 'warning',
      title: 'Assignment Due Soon',
      message: 'Reading comprehension is due tomorrow at 11:59 PM',
      time: '1 day ago',
      read: true
    },
    {
      id: '4',
      type: 'success',
      title: 'Assignment Graded',
      message: 'Your Speaking Assessment received a score of 7.5',
      time: '2 days ago',
      read: true
    }
  ];

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle size={16} className="text-green-500" />;
      case 'warning': return <AlertCircle size={16} className="text-yellow-500" />;
      case 'info': return <Clock size={16} className="text-blue-500" />;
      default: return <Bell size={16} className="text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string, read: boolean) => {
    if (read) return 'bg-white border-gray-200';
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'info': return 'bg-blue-50 border-blue-200';
      default: return 'bg-white border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/dashboard")}
              className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <span className="text-gray-700">←</span>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-black">Notifications</h1>
              <p className="text-sm text-gray-500">Stay updated with your progress</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Notifications List */}
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div 
              key={notification.id}
              className={`rounded-2xl p-4 shadow-sm border ${getNotificationColor(notification.type, notification.read)}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-black text-sm ${!notification.read ? 'font-bold' : ''}`}>
                    {notification.title}
                  </h3>
                  <p className="text-gray-700 text-sm mt-1">{notification.message}</p>
                  <p className="text-gray-500 text-xs mt-2">{notification.time}</p>
                </div>

                {!notification.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty state for future use */}
        {notifications.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={24} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-black mb-2">No notifications</h3>
            <p className="text-gray-700 text-sm">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}

