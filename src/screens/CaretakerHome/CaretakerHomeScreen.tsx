import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants';
import { useAuthStore } from '../../stores';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CaretakerHome'>;

export default function CaretakerHomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const displayName =
    typeof user?.fullName === 'string' && user.fullName.trim().length > 0
      ? user.fullName.trim()
      : t('caretaker.defaultName', { defaultValue: 'Caretaker' });

  const handleLogout = async () => {
    if (!isAuthenticated || isSigningOut) {
      return;
    }

    try {
      await logout();
    } catch (error) {
      throw error;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandWrap}>
        <BrandMark variant="logoWithText" size="majorHeader" />
      </View>

      <Text style={styles.badge}>{t('caretaker.portalBadge', { defaultValue: 'CARETAKER PORTAL' })}</Text>
      <Text style={styles.title}>
        {t('caretaker.homeTitle', {
          defaultValue: 'Welcome, {{name}}',
          name: displayName,
        })}
      </Text>
      <Text style={styles.subtitle}>
        {t('caretaker.homeSubtitle', {
          defaultValue: 'Review today tasks, check in, and submit checkout evidence in one place.',
        })}
      </Text>

      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CaretakerTasks')}
      >
        <Text style={styles.primaryButtonText}>
          {t('caretaker.openTaskBoard', { defaultValue: 'Open task board' })}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        activeOpacity={0.8}
        onPress={handleLogout}
        disabled={isSigningOut || !isAuthenticated}
      >
        <Text style={styles.secondaryButtonText}>{t('caretaker.signOut', { defaultValue: 'Sign out' })}</Text>
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
  brandWrap: {
    alignSelf: 'center',
    marginBottom: SPACING.xl,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5F8EB',
    color: '#155231',
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
