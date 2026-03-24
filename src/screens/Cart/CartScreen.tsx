import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants';
import { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type MockCartItem = {
  id: string;
  name: string;
  size: string;
  image: string;
  price: number;
  oldPrice?: number;
  quantity: number;
  isAvailable: boolean;
};

const MOCK_CART_ITEMS: MockCartItem[] = [
  {
    id: 'c1',
    name: 'Cây Lưỡi Hổ',
    size: 'Nhỏ',
    image:
      'https://images.unsplash.com/photo-1459156212016-c812468e2115?auto=format&fit=crop&w=700&q=80',
    price: 150000,
    quantity: 1,
    isAvailable: true,
  },
  {
    id: 'c2',
    name: 'Trầu Bà Nam Mỹ',
    size: 'Vừa',
    image:
      'https://images.unsplash.com/photo-1509423350716-97f2360af9e4?auto=format&fit=crop&w=700&q=80',
    price: 280000,
    quantity: 2,
    isAvailable: true,
  },
  {
    id: 'c3',
    name: 'Cây Lan Ý',
    size: 'Nhỏ',
    image:
      'https://images.unsplash.com/photo-1463320898484-cdee8141c787?auto=format&fit=crop&w=700&q=80',
    price: 120000,
    oldPrice: 120000,
    quantity: 1,
    isAvailable: false,
  },
];

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [items, setItems] = useState<MockCartItem[]>(MOCK_CART_ITEMS);
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const totalPrice = useMemo(
    () =>
      items
        .filter((item) => item.isAvailable)
        .reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0),
    [items],
  );

  const incrementQuantity = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.isAvailable
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      ),
    );
  };

  const decrementQuantity = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.isAvailable) return item;
        return { ...item, quantity: Math.max(1, item.quantity - 1) };
      }),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const renderCartItem = ({ item }: { item: MockCartItem }) => {
    const isUnavailable = !item.isAvailable;

    return (
      <View style={[styles.cartItem, isUnavailable && styles.cartItemUnavailable]}>
        <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />

        {!isUnavailable ? (
          <TouchableOpacity style={styles.closeBtn} onPress={() => removeItem(item.id)}>
            <Ionicons name="close" size={20} color={COLORS.gray500} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => removeItem(item.id)}>
            <Text style={styles.deleteText}>{t('cart.delete')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, isUnavailable && styles.unavailableText]} numberOfLines={1}>
            {item.name}
          </Text>

          {isUnavailable ? (
            <View style={styles.priceUnavailableRow}>
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutText}>{t('cart.soldOut')}</Text>
              </View>
              <Text style={styles.oldPrice}>{(item.oldPrice || 0).toLocaleString(locale)}đ</Text>
            </View>
          ) : (
            <Text style={styles.itemPrice}>{(item.price || 0).toLocaleString(locale)}đ</Text>
          )}

          <View style={styles.bottomRow}>
            <Text style={[styles.itemSize, isUnavailable && styles.unavailableText]}>
              {t('cart.size', { size: item.size })}
            </Text>

            {!isUnavailable && (
              <View style={styles.quantityPill}>
                <TouchableOpacity
                  style={[styles.quantityCircle, styles.quantityMinus]}
                  onPress={() => decrementQuantity(item.id)}
                >
                  <Ionicons name="remove" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={[styles.quantityCircle, styles.quantityPlus]}
                  onPress={() => incrementQuantity(item.id)}
                >
                  <Ionicons name="add" size={16} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {isUnavailable && (
            <View style={styles.warningRow}>
              <Ionicons name="alert-circle" size={15} color={COLORS.error} />
              <Text style={styles.warningText}>{t('cart.unavailableMessage')}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('cart.header')}</Text>
          <View style={styles.headerSidePlaceholder} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color={COLORS.gray300} />
          <Text style={styles.emptyText}>{t('cart.emptyTitle')}</Text>
          <Text style={styles.emptySubtext}>{t('cart.emptySubtitle')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('cart.headerWithCount', { count: totalItems })}</Text>
        <TouchableOpacity style={styles.headerEditBtn}>
          <Text style={styles.headerEditText}>{t('cart.edit')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footerSummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.footerLabel}>{t('cart.subtotal')}</Text>
          <Text style={styles.footerSubValue}>{totalPrice.toLocaleString(locale)}đ</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.footerTotalLabel}>{t('cart.total')}</Text>
          <Text style={styles.footerValue}>{totalPrice.toLocaleString(locale)}đ</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => navigation.navigate('Checkout')}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutBtnText}>{t('cart.checkout')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSidePlaceholder: {
    width: 32,
  },
  headerEditBtn: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  headerEditText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING['4xl'],
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 30,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  cartItemUnavailable: {
    opacity: 0.78,
  },
  itemImage: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: COLORS.gray100,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 2,
  },
  deleteBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 2,
  },
  deleteText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.error,
    fontWeight: '500',
  },
  itemInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    paddingRight: SPACING['4xl'],
  },
  itemName: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  unavailableText: {
    color: COLORS.gray600,
  },
  itemPrice: {
    marginTop: 4,
    fontSize: 36 / 2,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  priceUnavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: SPACING.sm,
  },
  soldOutBadge: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  soldOutText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  oldPrice: {
    color: COLORS.gray500,
    textDecorationLine: 'line-through',
    fontSize: FONTS.sizes.xl,
  },
  bottomRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemSize: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.primary,
    fontWeight: '500',
  },
  quantityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 8,
  },
  quantityCircle: {
    width: 34,
    height: 34,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityMinus: {
    backgroundColor: COLORS.gray200,
  },
  quantityPlus: {
    backgroundColor: COLORS.primaryLight,
  },
  quantityText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
    minWidth: 16,
    textAlign: 'center',
  },
  warningRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  warningText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.lg,
    fontWeight: '400',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  footerSummary: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotalRow: {
    marginTop: 2,
  },
  footerLabel: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
  },
  footerSubValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  footerTotalLabel: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  footerValue: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  checkoutBtn: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 4,
  },
  checkoutBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
  },
});
