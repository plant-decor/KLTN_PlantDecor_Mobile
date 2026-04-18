import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { APP_CONFIG, COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { useAuthStore, useCartStore } from '../../stores';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const logoutAll = useAuthStore((state) => state.logoutAll);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const { totalItems } = useCartStore();

  const selectedLanguage = i18n.language === 'vi' ? 'vi' : 'en';

  const handleChangeLanguage = (language: 'en' | 'vi') => {
    if (selectedLanguage !== language) {
      i18n.changeLanguage(language);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  const handleLogoutAll = () => {
    Alert.alert(
      t('profile.logoutAllConfirmTitle', {
        defaultValue: 'Log out all devices',
      }),
      t('profile.logoutAllConfirmMessage', {
        defaultValue: 'Are you sure you want to log out on all devices?',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logoutAll', {
            defaultValue: 'Log out all devices',
          }),
          style: 'destructive',
          onPress: () => {
            void logoutAll();
          },
        },
      ]
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.guestContainer}>
          <Ionicons name="person-circle-outline" size={100} color={COLORS.gray300} />
          <Text style={styles.guestTitle}>{t('profile.guestTitle')}</Text>
          <Text style={styles.guestSubtitle}>{t('profile.guestSubtitle')}</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>{t('profile.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerButtonText}>{t('profile.registerNew')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      icon: 'person-outline' as const,
      label: t('profile.editProfile'),
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      icon: 'receipt-outline' as const,
      label: t('profile.orderHistory'),
      onPress: () => navigation.navigate('OrderHistory'),
    },
    {
      icon: 'cart-outline' as const,
      label: t('profile.cartWithCount', { count: totalItems() }),
      onPress: () => navigation.navigate('Cart'),
    },
    {
      icon: 'sparkles-outline' as const,
      label: t('profile.myAIDesign'),
      onPress: () => navigation.navigate('AIDesign'),
    },
    {
      icon: 'heart-outline' as const,
      label: t('profile.favoritePlants'),
      onPress: () => navigation.navigate('Wishlist'),
    },
    {
      icon: 'settings-outline' as const,
      label: t('profile.settings'),
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.fullName?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user?.fullName}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Menu */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon} size={22} color={COLORS.gray700} />
                <Text style={styles.menuItemLabel}>{item.label}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.gray400}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.languageContainer}>
          <Text style={styles.languageTitle}>{t('common.language')}</Text>
          <View style={styles.languageSwitchRow}>
            <TouchableOpacity
              style={[
                styles.languageButton,
                selectedLanguage === 'en' && styles.languageButtonActive,
              ]}
              onPress={() => handleChangeLanguage('en')}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  selectedLanguage === 'en' && styles.languageButtonTextActive,
                ]}
              >
                {t('common.english')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.languageButton,
                selectedLanguage === 'vi' && styles.languageButtonActive,
              ]}
              onPress={() => handleChangeLanguage('vi')}
            >
              <Text
                style={[
                  styles.languageButtonText,
                  selectedLanguage === 'vi' && styles.languageButtonTextActive,
                ]}
              >
                {t('common.vietnamese')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={isSigningOut}
        >
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.logoutText}>{t('common.logout')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutAllButton}
          onPress={handleLogoutAll}
          disabled={isSigningOut}
        >
          <Ionicons name="exit-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutAllText}>
            {t('profile.logoutAll', { defaultValue: 'Log out all devices' })}
          </Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.version}>
          {t('profile.version', { version: APP_CONFIG.VERSION })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING['3xl'],
  },
  guestTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  guestSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING['2xl'],
  },
  loginButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  registerButton: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  registerButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
  },
  avatarContainer: {
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONTS.sizes['4xl'],
    fontWeight: '700',
    color: COLORS.white,
  },
  userName: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  userEmail: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  menuContainer: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    ...SHADOWS.sm,
  },
  languageContainer: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  languageTitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  languageSwitchRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.lg,
    padding: SPACING.xs,
    gap: SPACING.sm,
  },
  languageButton: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  languageButtonActive: {
    backgroundColor: COLORS.primary,
  },
  languageButtonText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  languageButtonTextActive: {
    color: COLORS.white,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuItemLabel: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING['2xl'],
    paddingVertical: SPACING.lg,
  },
  logoutText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.error,
    fontWeight: '600',
  },
  logoutAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: COLORS.white,
  },
  logoutAllText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.error,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    paddingBottom: SPACING['3xl'],
    marginTop: SPACING.sm,
  },
});
