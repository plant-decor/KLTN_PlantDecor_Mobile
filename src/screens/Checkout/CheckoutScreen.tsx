import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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

type CheckoutItem = {
  id: string;
  name: string;
  size: string;
  image: string;
  price: number;
  quantity: number;
};

const CHECKOUT_ITEMS: CheckoutItem[] = [
  {
    id: 'co1',
    name: 'Cây Lưỡi Hổ',
    size: 'Nhỏ',
    image:
      'https://images.unsplash.com/photo-1459156212016-c812468e2115?auto=format&fit=crop&w=700&q=80',
    price: 150000,
    quantity: 1,
  },
  {
    id: 'co2',
    name: 'Trầu Bà Nam Mỹ',
    size: 'Vừa',
    image:
      'https://images.unsplash.com/photo-1509423350716-97f2360af9e4?auto=format&fit=crop&w=700&q=80',
    price: 280000,
    quantity: 2,
  },
];

export default function CheckoutScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'vnpay'>('cod');
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const subTotal = useMemo(
    () => CHECKOUT_ITEMS.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [],
  );
  const totalQuantity = useMemo(
    () => CHECKOUT_ITEMS.reduce((sum, item) => sum + item.quantity, 0),
    [],
  );
  const shippingFee = 35000;
  const discount = 15000;
  const total = subTotal + shippingFee - discount;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('checkout.headerTitle')}</Text>
        <TouchableOpacity style={styles.headerIconBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="location" size={16} color={COLORS.primaryLight} />
            <Text style={styles.cardTitle}>{t('checkout.deliveryAddress')}</Text>
            <TouchableOpacity style={styles.changeBtn}>
              <Text style={styles.changeText}>{t('checkout.change')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.receiverText}>Nguyễn Văn A | (+84)912345 678</Text>
          <Text style={styles.addressText}>
            Số 123, Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('checkout.orderTitle', { count: CHECKOUT_ITEMS.length })}</Text>
          {CHECKOUT_ITEMS.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <View style={styles.orderImageWrap}>
                <Image source={{ uri: item.image }} style={styles.orderImage} resizeMode="cover" />
                <View style={styles.quantityBadge}>
                  <Text style={styles.quantityBadgeText}>x{item.quantity}</Text>
                </View>
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderName}>{item.name}</Text>
                <Text style={styles.orderSize}>{t('checkout.size', { size: item.size })}</Text>
                <Text style={styles.orderPrice}>{item.price.toLocaleString(locale)}đ</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeading}>{t('checkout.paymentMethod')}</Text>

        <TouchableOpacity
          style={[styles.paymentCard, paymentMethod === 'cod' && styles.paymentCardActive]}
          onPress={() => setPaymentMethod('cod')}
          activeOpacity={0.8}
        >
          <View style={[styles.radioOuter, paymentMethod === 'cod' && styles.radioOuterActive]}>
            {paymentMethod === 'cod' && <View style={styles.radioInner} />}
          </View>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>{t('checkout.paymentCODTitle')}</Text>
            <Text style={styles.paymentSub}>{t('checkout.paymentCODSub')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.paymentCard, paymentMethod === 'vnpay' && styles.paymentCardActive]}
          onPress={() => setPaymentMethod('vnpay')}
          activeOpacity={0.8}
        >
          <View style={[styles.radioOuter, paymentMethod === 'vnpay' && styles.radioOuterActive]}>
            {paymentMethod === 'vnpay' && <View style={styles.radioInner} />}
          </View>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>{t('checkout.paymentVNPayTitle')}</Text>
            <Text style={styles.paymentSub}>{t('checkout.paymentVNPaySub')}</Text>
          </View>
          <View style={styles.payIconWrap}>
            <Text style={styles.payIconText}>e</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionHeading}>{t('checkout.paymentDetail')}</Text>
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('checkout.summarySubtotal', { count: totalQuantity })}</Text>
            <Text style={styles.summaryValue}>{subTotal.toLocaleString(locale)}đ</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('checkout.shippingFee')}</Text>
            <Text style={styles.summaryValue}>{shippingFee.toLocaleString(locale)}đ</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('checkout.discount')}</Text>
            <Text style={styles.discountValue}>-{discount.toLocaleString(locale)}đ</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
            <Text style={styles.totalValue}>{total.toLocaleString(locale)}đ</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.checkoutBtn} activeOpacity={0.85}>
          <Text style={styles.checkoutBtnText}>{t('checkout.checkoutButton')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 52,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.gray100,
  },
  headerIconBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['4xl'],
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    marginLeft: 6,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  changeBtn: {
    marginLeft: 'auto',
  },
  changeText: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  receiverText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  orderImageWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
    position: 'relative',
  },
  orderImage: {
    width: '100%',
    height: '100%',
  },
  quantityBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.textPrimary,
  },
  quantityBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  orderInfo: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  orderName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderSize: {
    marginTop: 2,
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
  },
  orderPrice: {
    marginTop: 2,
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  sectionHeading: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  paymentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  paymentCardActive: {
    borderColor: COLORS.primaryLight,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: {
    borderColor: COLORS.primaryLight,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  paymentInfo: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  paymentTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  paymentSub: {
    marginTop: 2,
    fontSize: FONTS.sizes.lg,
    color: COLORS.primary,
  },
  payIconWrap: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payIconText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  discountValue: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  divider: {
    marginTop: SPACING.sm,
    marginBottom: 4,
    height: 1,
    backgroundColor: COLORS.border,
  },
  totalLabel: {
    fontSize: FONTS.sizes['2xl'],
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: FONTS.sizes['3xl'],
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  checkoutBtn: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 4,
    marginTop: SPACING.xs,
  },
  checkoutBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
  },
});
