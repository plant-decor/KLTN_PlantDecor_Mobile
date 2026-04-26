import { Alert, Platform } from 'react-native';
import { useNotificationStore } from '../stores/useNotificationStore';

export type NotifyOptions = {
  message: string;
  title?: string;
  androidDuration?: 'short' | 'long';
  useAlert?: boolean;
};

export const notify = ({
  message,
  title,
  androidDuration = 'short',
  useAlert = false,
}: NotifyOptions) => {
  if (useAlert) {
    if (title) {
      Alert.alert(title, message);
    } else {
      Alert.alert(message);
    }
    return;
  }

  const duration = androidDuration === 'long' ? 5000 : 3000;
  
  useNotificationStore.getState().showNotification({
    message,
    title,
    duration,
  });
};
