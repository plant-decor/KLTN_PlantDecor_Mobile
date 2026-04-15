import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { BrandedHeader } from '../../components/branding';
import { orderService, paymentService } from '../../services';
import { useEnumStore } from '../../stores';
import { OrderPayload, RootStackParamList } from '../../types';
import {
  canContinueOrderPayment,
  getOrderStatusColors,
  getOrderStatusLabel,
  isOrderCancellableStatus,
  notify,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'OrderDetail'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;

export default function OrderDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const loadEnumResource = useEnumStore((state) => state.loadResource);
  const getEnumValues = useEnumStore((state) => state.getEnumValues);
  const enumGroups = useEnumStore((state) => state.groups);
  const { orderId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [order, setOrder] = useState<OrderPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [processingInvoiceId, setProcessingInvoiceId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadEnumResource('orders');
    }, [loadEnumResource])
  );

  const enumStatusLabelMap = useMemo(() => {
    const enumValues = getEnumValues(['OrderStatus', 'orderStatus']);

    return enumValues.reduce<Record<string, string>>((accumulator, item) => {
      const keyFromValue =
        typeof item.value === 'string' && item.value.trim().length > 0
          ? item.value.trim()
          : null;
      const keyFromName =
        typeof item.name === 'string' && item.name.trim().length > 0
          ? item.name.trim()
          : null;

      const finalKey = keyFromValue ?? keyFromName;
      if (!finalKey || !keyFromName) {
        return accumulator;
      }

      accumulator[finalKey] = keyFromName;
      return accumulator;
    }, {});
  }, [enumGroups, getEnumValues]);

  const getStatusLabel = useCallback(
    (status: string) => getOrderStatusLabel(status, t, enumStatusLabelMap[status]),
    [enumStatusLabelMap, t]
  );

  const formatCurrency = useCallback(
    (value: number) => `${(value || 0).toLocaleString(locale)}đ`,
    [locale]
  );

  const formatDateTime = useCallback(
    (value: string) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }
      return parsed.toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [locale]
  );

  const loadOrderDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      setErrorMessage(null);
      const payload = await orderService.getOrderDetail(orderId);
      setOrder(payload);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      setErrorMessage(
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('orderDetail.loadFailed', {
              defaultValue: 'Unable to load order details. Please try again.',
            })
      );
    } finally {
      setIsLoading(false);
    }
  }, [orderId, t]);

  useFocusEffect(
    useCallback(() => {
      void loadOrderDetail();
    }, [loadOrderDetail])
  );

  const canCancelOrder = useMemo(
    () => (order ? isOrderCancellableStatus(order.statusName) : false),
    [order]
  );

  const handleConfirmCancelOrder = useCallback(async () => {
    if (!order || isCancellingOrder) {
      return;
    }

    setIsCancellingOrder(true);

    try {
      const payload = await orderService.cancelOrder(order.id);
      setOrder(payload);

      notify({
        title: t('common.success', { defaultValue: 'Success' }),
        message: t('orderDetail.cancelSuccess', {
          defaultValue: 'Order cancelled successfully.',
        }),
      });
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;

      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('orderDetail.cancelFailed', {
              defaultValue: 'Unable to cancel order. Please try again.',
            })
      );
    } finally {
      setIsCancellingOrder(false);
    }
  }, [isCancellingOrder, order, t]);

  const handleCancelOrder = useCallback(() => {
    if (!order || !canCancelOrder || isCancellingOrder) {
      return;
    }

    Alert.alert(
      t('orderDetail.cancelTitle', { defaultValue: 'Cancel order?' }),
      t('orderDetail.cancelMessage', {
        defaultValue: 'Are you sure you want to cancel this order?',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('orderDetail.cancelAction', { defaultValue: 'Cancel order' }),
          style: 'destructive',
          onPress: () => {
            void handleConfirmCancelOrder();
          },
        },
      ]
    );
  }, [canCancelOrder, handleConfirmCancelOrder, isCancellingOrder, order, t]);

  const handleContinuePayment = useCallback(
    async (invoiceId: number) => {
      if (!order || isCancellingOrder || processingInvoiceId !== null) {
        return;
      }

      setProcessingInvoiceId(invoiceId);

      try {
        const payment = await paymentService.continuePayment(invoiceId);

        if (!payment?.paymentUrl) {
          throw new Error('Missing payment URL');
        }

        navigation.navigate('PaymentWebView', {
          paymentUrl: payment.paymentUrl,
          orderId: order.id,
        });
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;

        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('orderDetail.continuePaymentFailed', {
                defaultValue: 'Unable to continue payment. Please try again.',
              })
        );
      } finally {
        setProcessingInvoiceId(null);
      }
    },
    [isCancellingOrder, navigation, order, processingInvoiceId, t]
  );

  if (isLoading && !order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <BrandedHeader
          containerStyle={styles.header}
          sideWidth={44}
          title={t('orderDetail.title', { defaultValue: 'Order detail' })}
          left={
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          }
          right={<View style={styles.headerPlaceholder} />}
        />

        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={70} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>
            {t('orderDetail.emptyTitle', { defaultValue: 'Order not found' })}
          </Text>
          <Text style={styles.emptySubtitle}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              void loadOrderDetail();
            }}
          >
            <Text style={styles.retryButtonText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusColors = getOrderStatusColors(order.statusName);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={44}
        title={t('orderDetail.orderCode', {
          defaultValue: 'Order #{{id}}',
          id: order.id,
        })}
        left={
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
        right={<View style={styles.headerPlaceholder} />}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.sectionTitle}>
              {t('orderDetail.status', { defaultValue: 'Status' })}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColors.backgroundColor },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: statusColors.textColor }]}>
                {getStatusLabel(order.statusName)}
              </Text>
            </View>
          </View>

          <Text style={styles.infoText}>
            {t('orderDetail.createdAt', { defaultValue: 'Created at' })}: {formatDateTime(order.createdAt)}
          </Text>
          <Text style={styles.infoText}>
            {t('orderDetail.updatedAt', { defaultValue: 'Updated at' })}: {formatDateTime(order.updatedAt)}
          </Text>
          <Text style={styles.totalText}>
            {t('orderDetail.total', { defaultValue: 'Total' })}: {formatCurrency(order.totalAmount)}
          </Text>

          {canCancelOrder ? (
            <View style={styles.orderActionRow}>
              <TouchableOpacity
                style={[
                  styles.cancelOrderButton,
                  isCancellingOrder && styles.actionButtonDisabled,
                ]}
                onPress={handleCancelOrder}
                disabled={isCancellingOrder}
              >
                {isCancellingOrder ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Text style={styles.cancelOrderButtonText}>
                    {t('orderDetail.cancelAction', { defaultValue: 'Cancel order' })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('orderDetail.receiver', { defaultValue: 'Receiver information' })}
          </Text>
          <Text style={styles.infoText}>{order.customerName}</Text>
          <Text style={styles.infoText}>{order.phone}</Text>
          <Text style={styles.infoText}>{order.address}</Text>
          {order.note ? (
            <Text style={styles.noteText}>
              {t('orderDetail.note', { defaultValue: 'Note' })}: {order.note}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('orderDetail.items', { defaultValue: 'Items' })}
          </Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.lineItemRow}>
              <Text style={styles.lineItemName} numberOfLines={2}>
                {item.itemName}
              </Text>
              <Text style={styles.lineItemQty}>x{item.quantity}</Text>
              <Text style={styles.lineItemPrice}>{formatCurrency(item.price)}</Text>
            </View>
          ))}
        </View>

        {order.nurseryOrders.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('orderDetail.nurseryOrders', { defaultValue: 'Nursery orders' })}
            </Text>
            {order.nurseryOrders.map((nurseryOrder) => (
              <View key={nurseryOrder.id} style={styles.nurseryBlock}>
                <View style={styles.topRow}>
                  <Text style={styles.nurseryName}>{nurseryOrder.nurseryName}</Text>
                  <Text style={styles.nurseryStatus}>{nurseryOrder.statusName}</Text>
                </View>
                <Text style={styles.infoText}>
                  {t('orderDetail.shipper', { defaultValue: 'Shipper' })}:{' '}
                  {nurseryOrder.shipperName || '-'}
                </Text>
                <Text style={styles.infoText}>
                  {t('orderDetail.subTotal', { defaultValue: 'Sub total' })}:{' '}
                  {formatCurrency(nurseryOrder.subTotalAmount)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {order.invoices.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t('orderDetail.invoices', { defaultValue: 'Invoices' })}
            </Text>
            {order.invoices.map((invoice) => (
              <View key={invoice.id} style={styles.invoiceBlock}>
                <View style={styles.topRow}>
                  <Text style={styles.invoiceTitle}>#{invoice.id}</Text>
                  <Text style={styles.invoiceStatus}>{invoice.statusName}</Text>
                </View>
                <Text style={styles.infoText}>{invoice.typeName}</Text>
                <Text style={styles.infoText}>{formatDateTime(invoice.issuedDate)}</Text>
                <Text style={styles.totalText}>{formatCurrency(invoice.totalAmount)}</Text>

                {canContinueOrderPayment(order.statusName, invoice.statusName) ? (
                  <View style={styles.invoiceActionRow}>
                    <TouchableOpacity
                      style={[
                        styles.continuePaymentButton,
                        (processingInvoiceId !== null || isCancellingOrder) &&
                          styles.actionButtonDisabled,
                      ]}
                      onPress={() => {
                        void handleContinuePayment(invoice.id);
                      }}
                      disabled={processingInvoiceId !== null || isCancellingOrder}
                    >
                      {processingInvoiceId === invoice.id ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Text style={styles.continuePaymentButtonText}>
                          {t('orderDetail.continuePayment', {
                            defaultValue: 'Continue payment',
                          })}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    maxWidth: '72%',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 32,
    height: 32,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['4xl'],
    gap: SPACING.md,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  infoText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray700,
    marginBottom: 4,
  },
  totalText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderActionRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelOrderButton: {
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.error,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
  },
  cancelOrderButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.error,
  },
  actionButtonDisabled: {
    opacity: 0.65,
  },
  noteText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  lineItemName: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  lineItemQty: {
    minWidth: 28,
    textAlign: 'right',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  lineItemPrice: {
    minWidth: 84,
    textAlign: 'right',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  nurseryBlock: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
  },
  nurseryName: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryStatus: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  invoiceBlock: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
  },
  invoiceTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  invoiceStatus: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  invoiceActionRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  continuePaymentButton: {
    minWidth: 156,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  continuePaymentButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING['2xl'],
  },
  emptyTitle: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
});
