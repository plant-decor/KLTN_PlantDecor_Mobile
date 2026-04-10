import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants';
import { useAuthStore } from '../../stores';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShipperHome'>;

export default function ShipperHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.badge}>SHIPPER PORTAL</Text>
      <Text style={styles.title}>Welcome, Shipper</Text>
      <Text style={styles.subtitle}>
        You are signed in with shipper access. Shipment-specific widgets can be added here.
      </Text>

      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('ShippingList')}
      >
        <Text style={styles.primaryButtonText}>Open Shipping List</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        activeOpacity={0.8}
        onPress={handleLogout}
      >
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.secondaryLight,
    color: COLORS.primaryDark,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes['3xl'],
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING['2xl'],
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
});
