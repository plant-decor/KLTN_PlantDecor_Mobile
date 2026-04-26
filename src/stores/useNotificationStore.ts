import { create } from 'zustand';

export type NotificationType = {
  id: string;
  message: string;
  title?: string;
  duration?: number;
};

interface NotificationState {
  notifications: NotificationType[];
  showNotification: (notification: Omit<NotificationType, 'id'>) => void;
  hideNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  showNotification: (notification) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));
  },
  hideNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));
