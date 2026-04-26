import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotificationStore, NotificationType } from '../../stores/useNotificationStore';
import { COLORS, ICONS } from '../../constants';

const NotificationItem = ({ notification }: { notification: NotificationType }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const hideNotification = useNotificationStore((state) => state.hideNotification);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => hideNotification(notification.id));
    }, notification.duration || 3000);

    return () => clearTimeout(timer);
  }, [notification, opacity, translateY, hideNotification]);

  const Logo = ICONS.logo;

  return (
    <Animated.View style={[styles.toastContainer, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.logoContainer}>
        <Logo width={24} height={24} />
      </View>
      <View style={styles.textContainer}>
        {notification.title ? <Text style={styles.title}>{notification.title}</Text> : null}
        <Text style={styles.message}>{notification.message}</Text>
      </View>
    </Animated.View>
  );
};

export const Notify = () => {
  const notifications = useNotificationStore((state) => state.notifications);
  const insets = useSafeAreaInsets();

  if (notifications.length === 0) return null;

  return (
    <View style={[styles.container, { top: insets.top + 10 }]} pointerEvents="none">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  logoContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 14,
    color: COLORS.textPrimary || '#333',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary || '#666',
  },
});
