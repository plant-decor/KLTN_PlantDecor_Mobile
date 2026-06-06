import { useEffect } from 'react';
import { supportRealtimeService, supportService } from '../services';
import { useSupportChatStore } from '../stores/useSupportChatStore';
import { useAuthStore } from '../stores';

export function useSupportChatConnection() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      void supportRealtimeService.disconnect();
      useSupportChatStore.getState().clearUnread();
      return;
    }

    const connectAndJoin = async () => {
      try {
        await supportRealtimeService.connect();
        const res = await supportService.getLatestActive();
        if (res.success && res.payload?.id) {
          await supportRealtimeService.joinConversation(res.payload.id);
        }
      } catch {
        // silently ignore initial connection errors
      }
    };

    void connectAndJoin();

    const unsubMessage = supportRealtimeService.onMessage(() => {
      if (!useSupportChatStore.getState().isChatScreenActive) {
        useSupportChatStore.getState().incrementUnread();
      }
    });

    return () => {
      unsubMessage();
    };
  }, [isAuthenticated]);
}
