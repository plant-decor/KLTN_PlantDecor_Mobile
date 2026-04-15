import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { BrandedHeader } from '../../components/branding';
import { orderService, paymentService } from '../../services';
import { useAuthStore, useEnumStore } from '../../stores';
import { OrderPayload, RootStackParamList } from '../../types';
import {
  canContinueOrderPayment,
  getOrderStatusColors,
  getOrderStatusLabel,
  isOrderCancellableStatus,
  notify,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'OrderHistory'>;
type StatusFilter = 'all' | string;

export default function OrderHistoryScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated } = useAuthStore();
  const loadEnumResource = useEnumStore((state) => state.loadResource);
  const getEnumValues = useEnumStore((state) => state.getEnumValues);
  const enumGroups = useEnumStore((state) => state.groups);

  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [orders, setOrders] = useState<OrderPayload[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingCancelOrderId, setProcessingCancelOrderId] = useState<number | null>(null);
  const [processingInvoiceKey, setProcessingInvoiceKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadEnumResource('orders');
    }, [loadEnumResource])
  );

  const statusFilters = useMemo<StatusFilter[]>(() => {
    const enumValues = getEnumValues(['OrderStatus', 'orderStatus']);
    const dynamicStatuses = enumValues
      .map((item) => {
        if (typeof item.value === 'string' && item.value.trim().length > 0) {
          return item.value.trim();
        }

        if (typeof item.name === 'string' && item.name.trim().length > 0) {
          return item.name.trim();
        }

        return null;
      })
      .filter((status): status is string => Boolean(status));

    const uniqueStatuses = Array.from(new Set(dynamicStatuses));

    return ['all', ...uniqueStatuses];
  }, [enumGroups, getEnumValues]);

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

  useEffect(() => {
    if (activeFilter === 'all') {
      return;
    }

    if (statusFilters.includes(activeFilter)) {
      return;
    }

    setActiveFilter('all');
  }, [activeFilter, statusFilters]);

  const getStatusLabel = useCallback(
    (status: string) => {
      if (status === 'all') {
        return t('orderHistory.status.all', { defaultValue: 'All' });
      }

      return getOrderStatusLabel(status, t, enumStatusLabelMap[status]);
    },
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

  const handleBackToProfile = useCallback(() => {
    navigation.popTo('MainTabs', { screen: 'Profile' });
  }, [navigation]);

  const handleConfirmCancelOrder = useCallback(
    async (orderId: number) => {
      if (processingCancelOrderId !== null || processingInvoiceKey !== null) {
        return;
      }

      setProcessingCancelOrderId(orderId);

      try {
        await orderService.cancelOrder(orderId);

        notify({
          title: t('common.success', { defaultValue: 'Success' }),
          message: t('orderHistory.cancelSuccess', {
            defaultValue: 'Order cancelled successfully.',
          }),
        });

        await loadOrders(activeFilter, { refresh: true });
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;

        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('orderHistory.cancelFailed', {
                defaultValue: 'Unable to cancel order. Please try again.',
              })
        );
      } finally {
        setProcessingCancelOrderId(null);
      }
    },
    [activeFilter, loadOrders, processingCancelOrderId, processingInvoiceKey, t]
  );

  const handleCancelOrder = useCallback(
    (orderId: number, orderStatus: string) => {
      if (!isOrderCancellableStatus(orderStatus)) {
        return;
      }

      Alert.alert(
        t('orderHistory.cancelTitle', { defaultValue: 'Cancel order?' }),
        t('orderHistory.cancelMessage', {
          defaultValue: 'Are you sure you want to cancel this order?',
        }),
        [
          {
            text: t('common.cancel', { defaultValue: 'Cancel' }),
            style: 'cancel',
          },
          {
            text: t('orderHistory.cancelAction', { defaultValue: 'Cancel order' }),
            style: 'destructive',
            onPress: () => {
              void handleConfirmCancelOrder(orderId);
            },
          },
        ]
      );
    },
    [handleConfirmCancelOrder, t]
  );

  const handleContinuePayment = useCallback(
    async (
      orderId: number,
      orderStatus: string,
      invoiceId: number,
      invoiceStatus: string
    ) => {
      if (
        processingCancelOrderId !== null ||
        processingInvoiceKey !== null ||
        !canContinueOrderPayment(orderStatus, invoiceStatus)
      ) {
        return;
      }

      const actionKey = `${orderId}:${invoiceId}`;
      setProcessingInvoiceKey(actionKey);

      try {
        const payment = await paymentService.continuePayment(invoiceId);

        if (!payment?.paymentUrl) {
          throw new Error('Missing payment URL');
        }

        navigation.navigate('PaymentWebView', {
          paymentUrl: payment.paymentUrl,
          orderId,
        });
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;

        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('orderHistory.continuePaymentFailed', {
                defaultValue: 'Unable to continue payment. Please try again.',
              })
        );
      } finally {
        setProcessingInvoiceKey(null);
      }
    },
    [navigation, processingCancelOrderId, processingInvoiceKey, t]
  );

  const renderStatusFilters = () => (
    <View style={styles.filterWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
      >
        {statusFilters.map((filter) => {
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
                {getStatusLabel(filter)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderOrderItem = ({ item }: { item: OrderPayload }) => {
    const statusColors = getOrderStatusColors(item.statusName);
    const firstInvoice = item.invoices?.[0];
    const firstContinuableInvoice = item.invoices.find((invoice) =>
      canContinueOrderPayment(item.statusName, invoice.statusName)
    );
    const hasRunningAction =
      processingCancelOrderId !== null || processingInvoiceKey !== null;
    const cancelInProgress = processingCancelOrderId === item.id;
    const continueActionKey = firstContinuableInvoice
      ? `${item.id}:${firstContinuableInvoice.id}`
      : null;
    const continueInProgress =
      continueActionKey !== null && processingInvoiceKey === continueActionKey;

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
              {getStatusLabel(item.statusName)}
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

        {isOrderCancellableStatus(item.statusName) || firstContinuableInvoice ? (
          <View style={styles.actionRow}>
            {isOrderCancellableStatus(item.statusName) ? (
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  hasRunningAction && styles.actionButtonDisabled,
                ]}
                onPress={(event) => {
                  event.stopPropagation();
                  handleCancelOrder(item.id, item.statusName);
                }}
                disabled={hasRunningAction}
              >
                {cancelInProgress ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Text style={styles.cancelButtonText}>
                    {t('orderHistory.cancelAction', { defaultValue: 'Cancel order' })}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}

            {firstContinuableInvoice ? (
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  hasRunningAction && styles.actionButtonDisabled,
                ]}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleContinuePayment(
                    item.id,
                    item.statusName,
                    firstContinuableInvoice.id,
                    firstContinuableInvoice.statusName
                  );
                }}
                disabled={hasRunningAction}
              >
                {continueInProgress ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.continueButtonText}>
                    {t('orderHistory.continuePayment', {
                      defaultValue: 'Continue payment',
                    })}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

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
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={44}
        title={headerTitle}
        left={
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToProfile}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
        right={<View style={styles.backButtonPlaceholder} />}
      />

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
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cancelButton: {
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  cancelButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.error,
  },
  continueButton: {
    minWidth: 148,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  continueButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  actionButtonDisabled: {
    opacity: 0.65,
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
