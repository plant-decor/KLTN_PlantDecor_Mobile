import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { orderService } from '../../services';
import { useAuthStore } from '../../stores';
import { OrderPayload, OrderStatusFilter, RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'OrderHistory'>;
type StatusFilter = 'all' | OrderStatusFilter;

const ORDER_STATUS_FILTERS: StatusFilter[] = [
  'all',
  'Pending',
  'Paid',
  'Shipping',
  'Delivered',
  'Cancelled',
  'Failed',
];

const statusColorMap: Record<string, { backgroundColor: string; textColor: string }> = {
  Pending: {
    backgroundColor: '#FFF4CC',
    textColor: '#8A6D1F',
  },
  DepositPaid: {
    backgroundColor: '#E5F9EB',
    textColor: '#1A7F37',
  },
  Paid: {
    backgroundColor: '#DFF7E9',
    textColor: '#19743A',
  },
  Assigned: {
    backgroundColor: '#EAF4FF',
    textColor: '#0B63B6',
  },
  Shipping: {
    backgroundColor: '#EAF2FF',
    textColor: '#2958A5',
  },
  Delivered: {
    backgroundColor: '#E7F8EF',
    textColor: '#1B7F46',
  },
  RemainingPaymentPending: {
    backgroundColor: '#FFF3E5',
    textColor: '#995200',
  },
  Completed: {
    backgroundColor: '#E7F8EF',
    textColor: '#1B7F46',
  },
  Cancelled: {
    backgroundColor: '#F3F4F6',
    textColor: '#6B7280',
  },
  Failed: {
    backgroundColor: '#FDEBEC',
    textColor: '#B42318',
  },
  RefundRequested: {
    backgroundColor: '#F3ECFF',
    textColor: '#7A3DD4',
  },
  Refunded: {
    backgroundColor: '#EFEAFE',
    textColor: '#6D32C8',
  },
  Rejected: {
    backgroundColor: '#FDEBEC',
    textColor: '#B42318',
  },
  PendingConfirmation: {
    backgroundColor: '#FFF3CC',
    textColor: '#8A6D1F',
  },
};

export default function OrderHistoryScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated } = useAuthStore();

  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [orders, setOrders] = useState<OrderPayload[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusLabelMap = useMemo(
    () => ({
      all: t('orderHistory.status.all', { defaultValue: 'All' }),
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

  const loadOrders = useCallback(
    async (filter: StatusFilter, options?: { refresh?: boolean }) => {
      if (options?.refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        setErrorMessage(null);
        const fetchedOrders = await orderService.getMyOrders(
          filter === 'all' ? undefined : filter
        );

        const sortedOrders = [...fetchedOrders].sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        );

        setOrders(sortedOrders);
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        setErrorMessage(
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('orderHistory.loadFailed', {
                defaultValue: 'Unable to load orders. Please try again.',
              })
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return;
      }
      void loadOrders(activeFilter);
    }, [activeFilter, isAuthenticated, loadOrders])
  );

  const headerTitle = useMemo(() => {
    if (orders.length > 0) {
      return t('orderHistory.titleWithCount', {
        defaultValue: 'Order history ({{count}})',
        count: orders.length,
      });
    }

    return t('profile.orderHistory', { defaultValue: 'Order history' });
  }, [orders.length, t]);

  const renderStatusFilters = () => (
    <View style={styles.filterWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
      >
        {ORDER_STATUS_FILTERS.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {statusLabelMap[filter] ?? filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderOrderItem = ({ item }: { item: OrderPayload }) => {
    const statusColors =
      statusColorMap[item.statusName] ?? {
        backgroundColor: '#F3F4F6',
        textColor: '#4B5563',
      };
    const firstInvoice = item.invoices?.[0];

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.orderCard}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      >
        <View style={styles.orderTopRow}>
          <Text style={styles.orderCode}>#{item.id}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors.backgroundColor },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColors.textColor }]}>
              {statusLabelMap[item.statusName as OrderStatusFilter] ?? item.statusName}
            </Text>
          </View>
        </View>

        <Text style={styles.orderDate}>
          {t('orderHistory.createdAt', { defaultValue: 'Created' })}: {formatDateTime(item.createdAt)}
        </Text>

        <View style={styles.orderMetaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{t('orderHistory.total', { defaultValue: 'Total' })}</Text>
            <Text style={styles.metaValue}>{formatCurrency(item.totalAmount)}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{t('orderHistory.items', { defaultValue: 'Items' })}</Text>
            <Text style={styles.metaValue}>{item.items.length}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>{t('orderHistory.invoice', { defaultValue: 'Invoice' })}</Text>
            <Text style={styles.metaValue}>#{firstInvoice?.id ?? '-'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {item.items.slice(0, 2).map((orderItem) => (
          <View key={orderItem.id} style={styles.lineItemRow}>
            <Text style={styles.lineItemName} numberOfLines={1}>
              {orderItem.itemName}
            </Text>
            <Text style={styles.lineItemQty}>x{orderItem.quantity}</Text>
            <Text style={styles.lineItemPrice}>{formatCurrency(orderItem.price)}</Text>
          </View>
        ))}

        {item.items.length > 2 ? (
          <Text style={styles.moreItemsText}>
            {t('orderHistory.moreItems', {
              defaultValue: '+{{count}} more items',
              count: item.items.length - 2,
            })}
          </Text>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.bottomRow}>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={15} color={COLORS.gray600} />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>

          <View style={styles.detailHintWrap}>
            <Text style={styles.detailHintText}>
              {t('orderHistory.viewDetail', { defaultValue: 'View detail' })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-circle-outline" size={78} color={COLORS.gray300} />
          <Text style={styles.emptyText}>
            {t('common.loginRequiredTitle', { defaultValue: 'Login required' })}
          </Text>
          <Text style={styles.emptySubtext}>
            {t('common.loginRequiredMessage', {
              defaultValue: 'Please login to continue.',
            })}
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>
              {t('common.login', { defaultValue: 'Login' })}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {renderStatusFilters()}

      {isLoading && orders.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={72} color={COLORS.gray300} />
          <Text style={styles.emptyText}>
            {t('orderHistory.emptyTitle', {
              defaultValue: 'No orders found',
            })}
          </Text>
          <Text style={styles.emptySubtext}>
            {errorMessage ||
              t('orderHistory.emptySubtitle', {
                defaultValue: 'Your completed checkout orders will appear here.',
              })}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void loadOrders(activeFilter)}
          >
            <Text style={styles.retryButtonText}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadOrders(activeFilter, { refresh: true })}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
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
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    maxWidth: '72%',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  filterWrap: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  filterScrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['4xl'],
    gap: SPACING.md,
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  orderCode: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  statusText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  orderDate: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  orderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  metaBlock: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  metaLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  divider: {
    marginVertical: SPACING.md,
    height: 1,
    backgroundColor: COLORS.borderLight,
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
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    minWidth: 28,
    textAlign: 'right',
  },
  lineItemPrice: {
    minWidth: 84,
    textAlign: 'right',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  moreItemsText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  addressText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray700,
  },
  detailHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailHintText: {
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
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtext: {
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
  loginButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
});
