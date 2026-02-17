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
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { useAuthStore, useCartStore } from '../../stores';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { totalItems } = useCartStore();

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.guestContainer}>
          <Ionicons name="person-circle-outline" size={100} color={COLORS.gray300} />
          <Text style={styles.guestTitle}>Chào mừng đến PlantDecor</Text>
          <Text style={styles.guestSubtitle}>
            Đăng nhập để trải nghiệm đầy đủ tính năng
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Đăng nhập</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerButtonText}>Đăng ký tài khoản mới</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      icon: 'person-outline' as const,
      label: 'Chỉnh sửa hồ sơ',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      icon: 'receipt-outline' as const,
      label: 'Lịch sử đơn hàng',
      onPress: () => navigation.navigate('OrderHistory'),
    },
    {
      icon: 'cart-outline' as const,
      label: `Giỏ hàng (${totalItems()})`,
      onPress: () => navigation.navigate('Cart'),
    },
    {
      icon: 'sparkles-outline' as const,
      label: 'Thiết kế AI của tôi',
      onPress: () => navigation.navigate('AIDesign'),
    },
    {
      icon: 'heart-outline' as const,
      label: 'Sản phẩm yêu thích',
      onPress: () => {},
    },
    {
      icon: 'settings-outline' as const,
      label: 'Cài đặt',
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

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.version}>PlantDecor v1.0.0</Text>
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
  version: {
    textAlign: 'center',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    paddingBottom: SPACING['3xl'],
    marginTop: SPACING.sm,
  },
});
