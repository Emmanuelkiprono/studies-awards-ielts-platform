import { db } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Notification } from '../types';

export const NotificationService = {
  create: async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', link?: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        message,
        type,
        link,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  },

  subscribe: (userId: string, callback: (notifications: Notification[]) => void) => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      callback(notifications);
    });
  },

  markAsRead: async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  markAllAsRead: async (userId: string, notifications: Notification[]) => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  delete: async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }
};
