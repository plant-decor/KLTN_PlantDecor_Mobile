import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { orderService } from '../../services';
import { OrderPayload, OrderStatusFilter, RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'OrderDetail'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;

const statusColorMap: Record<string, { backgroundColor: string; textColor: string }> = {
  Pending: { backgroundColor: '#FFF4CC', textColor: '#8A6D1F' },
  DepositPaid: { backgroundColor: '#E5F9EB', textColor: '#1A7F37' },
  Paid: { backgroundColor: '#DFF7E9', textColor: '#19743A' },
  Assigned: { backgroundColor: '#EAF4FF', textColor: '#0B63B6' },
  Shipping: { backgroundColor: '#EAF2FF', textColor: '#2958A5' },
  Delivered: { backgroundColor: '#E7F8EF', textColor: '#1B7F46' },
  RemainingPaymentPending: { backgroundColor: '#FFF3E5', textColor: '#995200' },
  Completed: { backgroundColor: '#E7F8EF', textColor: '#1B7F46' },
  Cancelled: { backgroundColor: '#F3F4F6', textColor: '#6B7280' },
  Failed: { backgroundColor: '#FDEBEC', textColor: '#B42318' },
  RefundRequested: { backgroundColor: '#F3ECFF', textColor: '#7A3DD4' },
  Refunded: { backgroundColor: '#EFEAFE', textColor: '#6D32C8' },
  Rejected: { backgroundColor: '#FDEBEC', textColor: '#B42318' },
  PendingConfirmation: { backgroundColor: '#FFF3CC', textColor: '#8A6D1F' },
};

export default function OrderDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { orderId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [order, setOrder] = useState<OrderPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusLabelMap = useMemo(
    () => ({
      Pending: t('orderHistory.status.pending', { defaultValue: 'Pending' }),
      DepositPaid: t('orderHistory.status.depositPaid', { defaultValue: 'Deposit paid' }),
      Paid: t('orderHistory.status.paid', { defaultValue: 'Paid' }),
      Assigned: t('orderHistory.status.assigned', { defaultValue: 'Assigned' }),
      Shipping: t('orderHistory.status.shipping', { defaultValue: 'Shipping' }),
      Delivered: t('orderHistory.status.delivered', { defaultValue: 'Delivered' }),
      RemainingPaymentPending: t('orderHistory.status.remainingPaymentPending', {
        defaultValue: 'Remaining payment pending',
      }),
      Completed: t('orderHistory.status.completed', { defaultValue: 'Completed' }),
      Cancelled: t('orderHistory.status.cancelled', { defaultValue: 'Cancelled' }),
      Failed: t('orderHistory.status.failed', { defaultValue: 'Failed' }),
      RefundRequested: t('orderHistory.status.refundRequested', {
        defaultValue: 'Refund requested',
      }),
      Refunded: t('orderHistory.status.refunded', { defaultValue: 'Refunded' }),
      Rejected: t('orderHistory.status.rejected', { defaultValue: 'Rejected' }),
      PendingConfirmation: t('orderHistory.status.pendingConfirmation', {
        defaultValue: 'Pending confirmation',
      }),
    }),
    [t]
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('orderDetail.title', { defaultValue: 'Order detail' })}
          </Text>
          <View style={styles.headerPlaceholder} />
        </View>

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

  const statusColors =
    statusColorMap[order.statusName] ?? {
      backgroundColor: '#F3F4F6',
      textColor: '#4B5563',
    };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('orderDetail.orderCode', {
            defaultValue: 'Order #{{id}}',
            id: order.id,
          })}
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>

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
                {statusLabelMap[order.statusName as OrderStatusFilter] ?? order.statusName}
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
