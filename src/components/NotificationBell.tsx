import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { NotificationService } from '../services/notificationService';
import { Notification } from '../types';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const unsubscribe = NotificationService.subscribe(user.uid, setNotifications);
    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    await NotificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await NotificationService.markAllAsRead(user.uid, notifications);
  };

  const handleDelete = async (id: string) => {
    await NotificationService.delete(id);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
      >
        <Bell size={20} className={cn("text-[var(--ui-muted)] group-hover:text-[var(--ui-heading)] transition-colors", unreadCount > 0 && "animate-pulse")} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 size-4 bg-[var(--ui-accent)] text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-[var(--ui-bg)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[100]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 md:w-96 bg-[var(--ui-bg-2)] border border-[var(--ui-border)] rounded-2xl shadow-2xl z-[101] overflow-hidden"
            >
              <div className="p-4 border-b border-[var(--ui-border-soft)] flex items-center justify-between bg-white/[0.02]">
                <h3 className="text-sm font-bold text-[var(--ui-heading)] uppercase tracking-wider">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] text-[var(--ui-accent)] hover:opacity-90 font-bold uppercase"
                    >
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="text-[var(--ui-muted)] hover:text-[var(--ui-heading)]">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={cn(
                          "p-4 hover:bg-white/[0.03] transition-colors group relative",
                          !notification.read && "bg-[rgba(var(--ui-accent-rgb)/0.06)]"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "size-2 mt-1.5 rounded-full shrink-0",
                            !notification.read ? "bg-[var(--ui-accent)]" : "bg-transparent"
                          )} />
                          <div className="flex-1 min-w-0" onClick={() => handleNotificationClick(notification)}>
                            <p className="text-xs font-bold text-[var(--ui-heading)] truncate">{notification.title}</p>
                            <p className="text-[11px] text-[var(--ui-body)] mt-0.5 line-clamp-2">{notification.message}</p>
                            <p className="text-[9px] text-[var(--ui-muted)] mt-1 uppercase font-bold">
                              {notification.createdAt?.toDate ? new Date(notification.createdAt.toDate()).toLocaleString() : 'Just now'}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.read && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notification.id); }}
                                className="p-1 rounded-md bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-600 text-[var(--ui-muted)]"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(notification.id); }}
                              className="p-1 rounded-md bg-white/5 hover:bg-red-500/20 hover:text-red-500 text-[var(--ui-muted)]"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Bell size={40} className="mx-auto text-slate-700 mb-3" />
                    <p className="text-[var(--ui-muted)] text-sm">No notifications yet.</p>
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 border-t border-white/5 bg-white/[0.02] text-center">
                  <button className="text-[10px] text-[var(--ui-muted)] hover:text-[var(--ui-heading)] font-bold uppercase tracking-widest">
                    View All Activity
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
