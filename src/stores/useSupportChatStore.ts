import { create } from 'zustand';

interface SupportChatState {
  unreadCount: number;
  isChatScreenActive: boolean;
  incrementUnread: () => void;
  clearUnread: () => void;
  setChatScreenActive: (active: boolean) => void;
}

export const useSupportChatStore = create<SupportChatState>((set) => ({
  unreadCount: 0,
  isChatScreenActive: false,
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
  setChatScreenActive: (active) => set({ isChatScreenActive: active }),
}));
