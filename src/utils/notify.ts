import { Alert, Platform, ToastAndroid } from 'react-native';

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
  if (Platform.OS === 'android' && !useAlert) {
    const duration =
      androidDuration === 'long' ? ToastAndroid.LONG : ToastAndroid.SHORT;
    ToastAndroid.show(message, duration);
    return;
  }

  if (title) {
    Alert.alert(title, message);
    return;
  }

  Alert.alert(message);
};
