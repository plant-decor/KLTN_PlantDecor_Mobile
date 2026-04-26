import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { RootNavigator } from './src/navigation';
import { useAuthStore } from './src/stores';
import { COLORS } from './src/constants';
import { Notify } from './src/components/Notify';
import './src/i18n';

export default function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const hasCheckedAuth = useAuthStore((state) => state.hasCheckedAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userRole = useAuthStore((state) => state.user?.role);
  const navigationRootKey = isAuthenticated
    ? `auth-${(userRole ?? 'user').toLowerCase()}`
    : 'guest';

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  if (!hasCheckedAuth) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
          <Notify />
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <NavigationContainer key={navigationRootKey}>
          <RootNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
        <Notify />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
