import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants';
import {
  CartApiItem,
  CartItem,
  CheckoutItem,
  CreateOrderRequest,
  RootStackParamList,
  UpdateProfileRequest,
  UserGender,
  UserGenderCode,
} from '../../types';
import { orderService, paymentService } from '../../services';
import { useAuthStore, useCartStore } from '../../stores';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'Checkout'>;

const mapApiCartItems = (
  items: CartApiItem[],
  fallbackSize: string
): CheckoutItem[] =>
  items.map((item) => ({
    id: String(item.id),
    name: item.productName,
    size: fallbackSize,
    image: undefined,
    price: item.price,
    quantity: item.quantity,
    cartItemId: item.id,
    isUniqueInstance: false,
  }));

const mapLocalCartItems = (
  items: CartItem[],
  fallbackSize: string
): CheckoutItem[] =>
  items.map((item) => ({
    id: item.id,
    name: item.plant.name,
    size: item.plant.sizeName || fallbackSize,
    image: item.plant.images?.[0] ?? undefined,
    price: item.plant.basePrice || 0,
    quantity: item.quantity,
    isUniqueInstance: item.plant.isUniqueInstance,
  }));

const mapGenderToCode = (gender?: UserGender): UserGenderCode => {
  if (gender === 'Female') {
    return 2;
  }
  if (gender === 'Other') {
    return 3;
  }
  return 1;
};

const normalizeGenderCode = (rawCode: unknown): UserGenderCode | null => {
  if (rawCode === 1 || rawCode === 2 || rawCode === 3) {
    return rawCode;
  }
  return null;
};

export default function CheckoutScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const paymentMethod: 'vnpay' = 'vnpay';
  const { isAuthenticated, user, updateProfile } = useAuthStore();
  const {
    cartItems,
    items: localCartItems,
    fetchCart,
    isLoading: isCartLoading,
  } = useCartStore();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const fallbackSize = t('common.updating', { defaultValue: 'Updating' });
  const routeItems = route.params?.items ?? [];
  const hasRouteItems = routeItems.length > 0;
  const userAddress =
    typeof user?.address === 'string'
      ? user.address.trim()
      : user?.address?.fullAddress?.trim() ?? '';
  const userPhone = user?.phone?.trim() ?? '';
  const [deliveryAddress, setDeliveryAddress] = useState(userAddress);
  const [deliveryPhone, setDeliveryPhone] = useState(userPhone);
  const [orderNote, setOrderNote] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (hasRouteItems) {
      return;
    }
    if (cartItems.length > 0 || localCartItems.length > 0) {
      return;
    }

    void fetchCart({ pageNumber: 1, pageSize: 20 }).catch(() => {
      // Keep screen usable with empty state when cart fetch fails.
    });
  }, [
    isAuthenticated,
    hasRouteItems,
    cartItems.length,
    localCartItems.length,
    fetchCart,
  ]);

  useEffect(() => {
    if (!isEditingAddress) {
      setDeliveryAddress(userAddress);
      setDeliveryPhone(userPhone);
    }
  }, [userAddress, userPhone, isEditingAddress]);

  useEffect(() => {
    if (!route.params?.paymentCompleted) {
      return;
    }

    Alert.alert(
      t('common.success', { defaultValue: 'Success' }),
      t('checkout.paymentSuccessMessage', {
        orderId: route.params.completedOrderId,
        defaultValue: 'Payment completed successfully.',
      })
    );

    setOrderNote('');

    void fetchCart({ pageNumber: 1, pageSize: 20 }).catch(() => {
      // Keep screen usable even when cart refresh fails.
    });

    navigation.setParams({
      paymentCompleted: undefined,
      completedOrderId: undefined,
      source: undefined,
      items: [],
    });
  }, [
    fetchCart,
    navigation,
    route.params?.completedOrderId,
    route.params?.paymentCompleted,
    t,
  ]);

  const checkoutItems = useMemo(() => {
    if (routeItems.length > 0) {
      return routeItems;
    }
    if (cartItems.length > 0) {
      return mapApiCartItems(cartItems, fallbackSize);
    }
    if (localCartItems.length > 0) {
      return mapLocalCartItems(localCartItems, fallbackSize);
    }
    return [];
  }, [routeItems, cartItems, localCartItems, fallbackSize]);

  const subTotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0),
    [checkoutItems],
  );
  const totalQuantity = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + item.quantity, 0),
    [checkoutItems],
  );
  const total = subTotal;

  const isLoadingCheckout = isCartLoading && !hasRouteItems && checkoutItems.length === 0;
  const receiverLine = [user?.fullName?.trim(), deliveryPhone.trim()]
    .filter((value): value is string => Boolean(value))
    .join(' | ');

  const handleCancelEditAddress = () => {
    if (isSavingAddress) {
      return;
    }
    setDeliveryAddress(userAddress);
    setDeliveryPhone(userPhone);
    setIsEditingAddress(false);
  };

  const handleSaveEditAddress = async () => {
    const trimmedAddress = deliveryAddress.trim();
    const trimmedPhone = deliveryPhone.trim();

    if (!trimmedAddress) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('checkout.editAddressRequired', {
          defaultValue: 'Please enter a delivery address.',
        })
      );
      return;
    }

    if (!user) {
      setDeliveryAddress(trimmedAddress);
      setDeliveryPhone(trimmedPhone);
      setIsEditingAddress(false);
      return;
    }

    const username = user.username?.trim() ?? '';
    const fullName = user.fullName?.trim() ?? '';
    const birthYear = user.birthYear;

    if (!username || !fullName || typeof birthYear !== 'number' || !Number.isInteger(birthYear)) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('checkout.profileRequiredForAddressUpdate', {
          defaultValue: 'Please complete your profile before saving address from checkout.',
        }),
        [
          {
            text: t('common.cancel', { defaultValue: 'Cancel' }),
            style: 'cancel',
          },
          {
            text: t('profile.editProfile', { defaultValue: 'Edit profile' }),
            onPress: () => {
              setIsEditingAddress(false);
              navigation.navigate('EditProfile');
            },
          },
        ]
      );
      return;
    }

    const payload: UpdateProfileRequest = {
      username,
      fullName,
      phoneNumber: trimmedPhone || user.phone?.trim() || undefined,
      address: trimmedAddress,
      birthYear,
      gender: normalizeGenderCode(user.genderCode) ?? mapGenderToCode(user.gender),
      receiveNotifications:
        user.receiveNotifications ?? user.receiveNotification ?? false,
    };

    try {
      setIsSavingAddress(true);
      await updateProfile(payload);
      setDeliveryAddress(trimmedAddress);
      setDeliveryPhone(trimmedPhone);
      setIsEditingAddress(false);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('profile.editFormUpdateFailed', {
              defaultValue: 'Unable to update profile. Please try again.',
            })
      );
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleCheckout = async () => {
    if (isSubmittingOrder) {
      return;
    }

    const trimmedAddress = deliveryAddress.trim();
    const trimmedPhone = deliveryPhone.trim();
    const trimmedCustomerName = user?.fullName?.trim() ?? '';
    const trimmedNote = orderNote.trim();

    if (!isAuthenticated || !user) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('common.loginRequiredMessage', {
          defaultValue: 'Please login to continue.',
        })
      );
      return;
    }

    if (!trimmedAddress) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('checkout.editAddressRequired', {
          defaultValue: 'Please enter a delivery address.',
        })
      );
      return;
    }

    if (!trimmedPhone) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('checkout.phoneRequired', {
          defaultValue: 'Please enter phone number.',
        })
      );
      return;
    }

    if (!trimmedCustomerName) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('checkout.customerNameRequired', {
          defaultValue: 'Please complete your profile name before checkout.',
        })
      );
      return;
    }

    if (checkoutItems.length === 0) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('checkout.emptyOrder', {
          defaultValue: 'No items available for checkout.',
        })
      );
      return;
    }

    const plantInstanceId = checkoutItems.find(
      (item) => Number.isInteger(item.plantInstanceId)
    )?.plantInstanceId;

    const cartIdsFromCheckoutItems = checkoutItems
      .map((item) => item.cartItemId)
      .filter((id): id is number => Number.isInteger(id));

    const fallbackCartItemIds = cartItems
      .map((item) => item.id)
      .filter((id) => Number.isInteger(id));

    const cartItemIds = plantInstanceId
      ? []
      : cartIdsFromCheckoutItems.length > 0
        ? cartIdsFromCheckoutItems
        : fallbackCartItemIds;

    if (!plantInstanceId && cartItemIds.length === 0) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('checkout.invalidCheckoutItems', {
          defaultValue: 'Cannot resolve cart items for order creation.',
        })
      );
      return;
    }

    const orderType: 1 | 2 = plantInstanceId ? 2 : 1;

    const createOrderPayload: CreateOrderRequest = {
      address: trimmedAddress,
      phone: trimmedPhone,
      customerName: trimmedCustomerName,
      note: trimmedNote || undefined,
      paymentStrategy: 1,
      orderType,
      cartItemIds,
      plantInstanceId: plantInstanceId ?? 0,
    };

    try {
      setIsSubmittingOrder(true);

      const createdOrder = await orderService.createOrder(createOrderPayload);
      const invoiceId = createdOrder.invoices?.[0]?.id;

      if (!invoiceId) {
        throw new Error('Missing invoice id from create order response');
      }

      const payment = await paymentService.createPayment({ invoiceId });

      if (!payment?.paymentUrl) {
        throw new Error('Missing payment URL');
      }

      navigation.navigate('PaymentWebView', {
        paymentUrl: payment.paymentUrl,
        orderId: createdOrder.id,
      });
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('checkout.createOrderFailed', {
              defaultValue: 'Unable to create order or payment. Please try again.',
            })
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  };

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
        {isLoadingCheckout && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="location" size={16} color={COLORS.primaryLight} />
            <Text style={styles.cardTitle}>{t('checkout.deliveryAddress')}</Text>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => setIsEditingAddress(true)}
              disabled={isEditingAddress || isSavingAddress}
            >
              <Text style={styles.changeText}>
                {isEditingAddress
                  ? t('checkout.editingAddress', { defaultValue: 'Editing...' })
                  : t('checkout.change')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.receiverText}>
            {receiverLine ||
              t('checkout.receiverFallback', {
                defaultValue: 'Recipient information unavailable',
              })}
          </Text>
          {isEditingAddress ? (
            <>
              <TextInput
                style={styles.phoneInput}
                value={deliveryPhone}
                onChangeText={setDeliveryPhone}
                placeholder={t('checkout.editPhonePlaceholder', {
                  defaultValue: 'Enter phone number',
                })}
                placeholderTextColor={COLORS.gray500}
                keyboardType="phone-pad"
                editable={!isSavingAddress}
              />
              <TextInput
                style={styles.addressInput}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder={t('checkout.editAddressPlaceholder', {
                  defaultValue: 'Enter your delivery address',
                })}
                placeholderTextColor={COLORS.gray500}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!isSavingAddress}
              />
              <View style={styles.addressActions}>
                <TouchableOpacity
                  style={[
                    styles.addressActionBtn,
                    styles.addressCancelBtn,
                    isSavingAddress && styles.addressActionBtnDisabled,
                  ]}
                  onPress={handleCancelEditAddress}
                  disabled={isSavingAddress}
                >
                  <Text style={styles.addressCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.addressActionBtn,
                    styles.addressSaveBtn,
                    isSavingAddress && styles.addressActionBtnDisabled,
                  ]}
                  onPress={handleSaveEditAddress}
                  disabled={isSavingAddress}
                >
                  <Text style={styles.addressSaveText}>
                    {isSavingAddress
                      ? t('common.updating', { defaultValue: 'Updating...' })
                      : t('checkout.saveAddress', { defaultValue: 'Save address' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.addressText}>
              {deliveryAddress ||
                t('checkout.deliveryAddressFallback', {
                  defaultValue: 'No delivery address found. Please update your profile address.',
                })}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('checkout.orderTitle', { count: checkoutItems.length })}</Text>
          {checkoutItems.length === 0 ? (
            <Text style={styles.emptyOrderText}>
              {t('cart.emptySubtitle', {
                defaultValue: 'Your cart is empty.',
              })}
            </Text>
          ) : (
            checkoutItems.map((item) => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.orderImageWrap}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.orderImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.orderImagePlaceholder}>
                      <Ionicons name="leaf-outline" size={22} color={COLORS.gray500} />
                    </View>
                  )}
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityBadgeText}>x{item.quantity}</Text>
                  </View>
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderName}>{item.name}</Text>
                  <Text style={styles.orderSize}>{t('checkout.size', { size: item.size || fallbackSize })}</Text>
                  <Text style={styles.orderPrice}>{(item.price || 0).toLocaleString(locale)}đ</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('checkout.noteLabel', { defaultValue: 'Order note' })}
          </Text>
          <TextInput
            style={styles.noteInput}
            value={orderNote}
            onChangeText={setOrderNote}
            placeholder={t('checkout.notePlaceholder', {
              defaultValue: 'Add a note for nursery or shipper (optional)',
            })}
            placeholderTextColor={COLORS.gray500}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!isSubmittingOrder}
          />
        </View>

        <Text style={styles.sectionHeading}>{t('checkout.paymentMethod')}</Text>

        <View style={[styles.paymentCard, styles.paymentCardActive]}>
          <View style={[styles.radioOuter, styles.radioOuterActive]}>
            {paymentMethod === 'vnpay' && <View style={styles.radioInner} />}
          </View>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>{t('checkout.paymentVNPayTitle')}</Text>
            <Text style={styles.paymentSub}>{t('checkout.paymentVNPaySub')}</Text>
          </View>
          <View style={styles.payIconWrap}>
            <Text style={styles.payIconText}>e</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>{t('checkout.paymentDetail')}</Text>
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('checkout.summarySubtotal', { count: totalQuantity })}</Text>
            <Text style={styles.summaryValue}>{subTotal.toLocaleString(locale)}đ</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>{t('checkout.total')}</Text>
            <Text style={styles.totalValue}>{total.toLocaleString(locale)}đ</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.checkoutBtn,
            (checkoutItems.length === 0 || isSubmittingOrder) && styles.checkoutBtnDisabled,
          ]}
          activeOpacity={0.85}
          disabled={checkoutItems.length === 0 || isSubmittingOrder}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutBtnText}>
            {isSubmittingOrder
              ? t('checkout.processing', { defaultValue: 'Processing...' })
              : t('checkout.checkoutButton')}
          </Text>
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
  loadingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingVertical: SPACING.md,
    alignItems: 'center',
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
  phoneInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.lg,
    backgroundColor: COLORS.white,
  },
  addressInput: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.lg,
    backgroundColor: COLORS.white,
  },
  noteInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    backgroundColor: COLORS.white,
  },
  addressActions: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  addressActionBtn: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  addressActionBtnDisabled: {
    opacity: 0.6,
  },
  addressCancelBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  addressSaveBtn: {
    backgroundColor: COLORS.primary,
  },
  addressCancelText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  addressSaveText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
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
  orderImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
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
  emptyOrderText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
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
  checkoutBtnDisabled: {
    opacity: 0.45,
  },
  checkoutBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
  },
});
