import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { BrandedHeader } from '../../components/branding';
import { orderService } from '../../services';
import { useAuthStore } from '../../stores';
import { OrderLineItem, OrderNursery, RootStackParamList, ShipperNurseryOrderDetailPayload } from '../../types';
import {
  getOrderStatusColors,
  getOrderStatusLabel,
  notify,
  parseDeliveryNoteWithImage,
  resolveImageUri,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShippingList'>;
type StatusFilter = 'assigned' | 'shipping' | 'delivered' | 'failed';
type ShipperActionType = 'start-shipping' | 'mark-delivered' | 'mark-delivery-failed';
type PageToken = number | 'left-ellipsis' | 'right-ellipsis';
type SelectedDeliveryImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

const PAGE_SIZE = 10;
const SCREEN_BG = '#F6F8F6';
const ACCENT_GREEN = '#13EC5B';
const ACCENT_DARK = '#102216';
const TEXT_DARK = '#0D1B12';
const SHIPPING_STATUS = 4;

const FILTER_STATUS_MAP: Record<StatusFilter, number> = {
  assigned: 3,
  shipping: 4,
  delivered: 5,
  failed: 9,
};

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const isAssignedStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('assign');
};

const isShippingStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('ship') && !token.includes('deliver');
};

const isDeliveredStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('deliver');
};

const canStartShipping = (statusName: string): boolean => isAssignedStatus(statusName);

const canMarkDelivered = (statusName: string): boolean => isShippingStatus(statusName);

const canMarkDeliveryFailed = (statusName: string): boolean => isShippingStatus(statusName);

const isOrderInFilter = (order: OrderNursery, filter: StatusFilter): boolean =>
  order.status === FILTER_STATUS_MAP[filter];

const buildOrderCode = (id: number): string => `DH-${String(id).padStart(4, '0')}`;

const resolveNumericId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const resolveOrderDetailId = (order: OrderNursery): number => {
  const orderRecord = order as OrderNursery & {
    orderID?: unknown;
    parentOrderId?: unknown;
  };

  return (
    resolveNumericId(orderRecord.orderId) ??
    resolveNumericId(orderRecord.orderID) ??
    resolveNumericId(orderRecord.parentOrderId) ??
    order.id
  );
};

const resolveLineItemImage = (lineItem: OrderLineItem): string | null => {
  const possibleValues: unknown[] = [
    lineItem.itemImageUrl,
    lineItem.itemImage,
    lineItem.primaryImageUrl,
    lineItem.imageUrl,
  ];

  for (const value of possibleValues) {
    const uri = resolveImageUri(value);
    if (uri) {
      return uri;
    }
  }

  return null;
};

const resolveImageMimeType = (fileName: string): string => {
  const normalizedName = fileName.toLowerCase();

  if (normalizedName.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedName.endsWith('.webp')) {
    return 'image/webp';
  }

  if (normalizedName.endsWith('.heic') || normalizedName.endsWith('.heif')) {
    return 'image/heic';
  }

  return 'image/jpeg';
};

export default function ShippingListScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [activeFilter, setActiveFilter] = useState<StatusFilter>('assigned');
  const [orders, setOrders] = useState<(OrderNursery | ShipperNurseryOrderDetailPayload)[]>([]);
  const [activeShippingOrder, setActiveShippingOrder] = useState<OrderNursery | ShipperNurseryOrderDetailPayload | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState<ShipperActionType | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderNursery | ShipperNurseryOrderDetailPayload | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [selectedDeliveryImage, setSelectedDeliveryImage] = useState<SelectedDeliveryImage | null>(null);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);

  const statusFilters = useMemo<StatusFilter[]>(
    () => ['assigned', 'shipping', 'delivered', 'failed'],
    []
  );

  const visiblePageTokens = useMemo<PageToken[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const tokens: PageToken[] = [1];
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    if (startPage > 2) {
      tokens.push('left-ellipsis');
    }

    for (let page = startPage; page <= endPage; page += 1) {
      tokens.push(page);
    }

    if (endPage < totalPages - 1) {
      tokens.push('right-ellipsis');
    }

    tokens.push(totalPages);
    return tokens;
  }, [currentPage, totalPages]);

  const formatCurrency = useCallback(
    (value: number) => `${(value || 0).toLocaleString(locale)}đ`,
    [locale]
  );

  const getFilterLabel = useCallback(
    (filter: StatusFilter) => {
      if (filter === 'assigned') {
        return t('shippingList.filterAssigned', {
          defaultValue: 'Assigned',
        });
      }

      if (filter === 'shipping') {
        return t('shippingList.filterShipping', { defaultValue: 'Shipping' });
      }

      if (filter === 'delivered') {
        return t('shippingList.filterDelivered', { defaultValue: 'Delivered' });
      }

      return t('shippingList.filterFailed', {
        defaultValue: 'Failed',
      });
    },
    [t]
  );

  const getStatusHint = useCallback(
    (statusName: string) => {
      if (isShippingStatus(statusName)) {
        return t('shippingList.hintShipping', { defaultValue: 'In transit' });
      }

      if (isAssignedStatus(statusName)) {
        return t('shippingList.hintAssigned', { defaultValue: 'Ready for pickup' });
      }

      if (isDeliveredStatus(statusName)) {
        return t('shippingList.hintDelivered', { defaultValue: 'Completed' });
      }

      return t('shippingList.hintDefault', { defaultValue: 'Latest update' });
    },
    [t]
  );

  const closeActionModal = useCallback(() => {
    if (isSubmittingAction) {
      return;
    }

    setModalVisible(false);
    setActionType(null);
    setSelectedOrder(null);
    setActionNote('');
    setSelectedDeliveryImage(null);
  }, [isSubmittingAction]);

  const loadOrders = useCallback(
    async (
      filter: StatusFilter,
      options?: {
        refresh?: boolean;
        pageNumber?: number;
        pageChange?: boolean;
        background?: boolean;
      }
    ) => {
      const targetPage = Math.max(1, options?.pageNumber ?? 1);
      const isBackground = options?.background === true;

      if (!isBackground) {
        if (options?.refresh) {
          setIsRefreshing(true);
        } else if (options?.pageChange) {
          setIsPageLoading(true);
        } else {
          setIsLoading(true);
        }
      }

      try {
        setErrorMessage(null);
        const [payload, shippingPayload] = await Promise.all([
          orderService.getNurseryOrders({
            status: FILTER_STATUS_MAP[filter],
            pageNumber: targetPage,
            pageSize: PAGE_SIZE,
          }),
          orderService.getNurseryOrders({
            status: SHIPPING_STATUS,
            pageNumber: 1,
            pageSize: 1,
          }),
        ]);

        const sortedItems = [...(payload.items ?? [])].sort((left, right) => right.id - left.id);
        const resolvedPage = Math.max(1, payload.pageNumber ?? targetPage);
        const resolvedTotalPages = Math.max(1, payload.totalPages ?? 1);

        setOrders(sortedItems);
        setTotalCount(payload.totalCount ?? sortedItems.length);
        setCurrentPage(resolvedPage);
        setTotalPages(resolvedTotalPages);
        setHasPreviousPage(payload.hasPrevious ?? resolvedPage > 1);
        setHasNextPage(payload.hasNext ?? resolvedPage < resolvedTotalPages);
        setActiveShippingOrder(shippingPayload.items[0] ?? null);
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        setErrorMessage(
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('shippingList.loadFailed', {
                defaultValue: 'Unable to load shipping orders. Please try again.',
              })
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsPageLoading(false);
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return;
      }

      void loadOrders(activeFilter, { pageNumber: 1 });
    }, [activeFilter, isAuthenticated, loadOrders])
  );

  const handlePrevPage = useCallback(() => {
    if (isLoading || isRefreshing || isPageLoading || !hasPreviousPage || currentPage <= 1) {
      return;
    }

    void loadOrders(activeFilter, {
      pageNumber: currentPage - 1,
      pageChange: true,
    });
  }, [activeFilter, currentPage, hasPreviousPage, isLoading, isPageLoading, isRefreshing, loadOrders]);

  const handleNextPage = useCallback(() => {
    if (isLoading || isRefreshing || isPageLoading || !hasNextPage || currentPage >= totalPages) {
      return;
    }

    void loadOrders(activeFilter, {
      pageNumber: currentPage + 1,
      pageChange: true,
    });
  }, [
    activeFilter,
    currentPage,
    hasNextPage,
    isLoading,
    isPageLoading,
    isRefreshing,
    loadOrders,
    totalPages,
  ]);

  const handlePageSelect = useCallback(
    (page: number) => {
      if (
        page < 1 ||
        page > totalPages ||
        page === currentPage ||
        isLoading ||
        isRefreshing ||
        isPageLoading
      ) {
        return;
      }

      void loadOrders(activeFilter, {
        pageNumber: page,
        pageChange: true,
      });
    },
    [activeFilter, currentPage, isLoading, isPageLoading, isRefreshing, loadOrders, totalPages]
  );

  const updateOrderOnCurrentPage = useCallback((updatedOrder: OrderNursery | ShipperNurseryOrderDetailPayload, filter: StatusFilter) => {
    const shouldKeep = isOrderInFilter(updatedOrder, filter);

    setOrders((previousOrders) => {
      const existed = previousOrders.some((order) => order.id === updatedOrder.id);

      if (!shouldKeep) {
        return previousOrders.filter((order) => order.id !== updatedOrder.id);
      }

      if (!existed) {
        return [updatedOrder, ...previousOrders].sort((left, right) => right.id - left.id);
      }

      return previousOrders
        .map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
        .sort((left, right) => right.id - left.id);
    });
  }, []);

  const handleDeliveryImageAsset = useCallback(
    (asset?: ImagePicker.ImagePickerAsset) => {
      const selectedUri = asset?.uri?.trim();
      if (!selectedUri) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('shippingList.imageMissing', {
            defaultValue: 'Please choose an image.',
          }),
        });
        return;
      }

      const fallbackFileName = selectedUri.split('/').pop() || `delivery-${Date.now()}.jpg`;
      const fileName = asset?.fileName?.trim() || fallbackFileName;
      const mimeType = asset?.mimeType?.trim() || resolveImageMimeType(fileName);

      setSelectedDeliveryImage({
        uri: selectedUri,
        fileName,
        mimeType,
      });
    },
    [t]
  );

  const handlePickDeliveryImage = useCallback(async () => {
    if (isSubmittingAction) {
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('shippingList.mediaPermissionDenied', {
          defaultValue: 'Please grant photo library access to upload delivery image.',
        }),
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    handleDeliveryImageAsset(result.assets?.[0]);
  }, [handleDeliveryImageAsset, isSubmittingAction, t]);

  const handleCaptureDeliveryImage = useCallback(async () => {
    if (isSubmittingAction) {
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('shippingList.cameraPermissionDenied', {
          defaultValue: 'Please grant camera access to take delivery image.',
        }),
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    handleDeliveryImageAsset(result.assets?.[0]);
  }, [handleDeliveryImageAsset, isSubmittingAction, t]);

  const openActionModal = (order: OrderNursery | ShipperNurseryOrderDetailPayload, nextAction: ShipperActionType) => {
    if (
      nextAction === 'start-shipping' &&
      activeShippingOrder &&
      activeShippingOrder.id !== order.id
    ) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('shippingList.oneShippingRule', {
          defaultValue:
            'You already have one order in shipping. Complete it before starting a new one.',
        }),
      });
      return;
    }

    setSelectedOrder(order);
    setActionType(nextAction);
    if (nextAction === 'start-shipping') {
      setActionNote(order.shipperNote || '');
    } else {
      const parsedDelivery = parseDeliveryNoteWithImage(order.deliveryNote);
      setActionNote(parsedDelivery.note || '');
    }
    setSelectedDeliveryImage(null);
    setModalVisible(true);
  };

  const submitAction = async () => {
    if (!selectedOrder || !actionType) {
      return;
    }

    if (
      actionType === 'start-shipping' &&
      activeShippingOrder &&
      activeShippingOrder.id !== selectedOrder.id
    ) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('shippingList.oneShippingRule', {
          defaultValue:
            'You already have one order in shipping. Complete it before starting a new one.',
        }),
      });
      return;
    }

    const trimmedNote = actionNote.trim();
    if (trimmedNote.length === 0) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('shippingList.noteRequired', { defaultValue: 'Please enter a note.' }),
      });
      return;
    }

    if (actionType === 'mark-delivered' && !selectedDeliveryImage) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('shippingList.imageRequired', {
          defaultValue: 'Please select a delivery image before confirming.',
        }),
      });
      return;
    }

    setIsSubmittingAction(true);
    setProcessingOrderId(selectedOrder.id);

    try {
      const updatedOrder =
        actionType === 'start-shipping'
          ? await orderService.startShipping(selectedOrder.id, {
              shipperNote: trimmedNote,
            })
          : actionType === 'mark-delivered'
          ? await orderService.markDelivered(selectedOrder.id, {
              deliveryNote: trimmedNote,
              deliveryImage: selectedDeliveryImage!,
            })
          : await orderService.markDeliveryFailed(selectedOrder.id, {
              failureReason: trimmedNote,
            });

      updateOrderOnCurrentPage(updatedOrder, activeFilter);

      if (actionType === 'start-shipping') {
        setActiveShippingOrder(updatedOrder);
      }

      if (
        actionType !== 'start-shipping' &&
        activeShippingOrder &&
        activeShippingOrder.id === updatedOrder.id
      ) {
        setActiveShippingOrder(null);
      }

      notify({
        title: t('common.success', { defaultValue: 'Success' }),
        message:
          actionType === 'start-shipping'
            ? t('shippingList.startShippingSuccess', {
                defaultValue: 'Start shipping confirmed successfully.',
              })
            : actionType === 'mark-delivered'
            ? t('shippingList.markDeliveredSuccess', {
                defaultValue: 'Delivery confirmed successfully.',
              })
            : t('shippingList.markDeliveryFailedSuccess', {
                defaultValue: 'Marked delivery failed successfully.',
              }),
      });

      setModalVisible(false);
      setActionType(null);
      setSelectedOrder(null);
      setActionNote('');
      setSelectedDeliveryImage(null);

      void loadOrders(activeFilter, {
        pageNumber: currentPage,
        background: true,
      });
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message:
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('shippingList.actionFailed', {
                defaultValue: 'Unable to update shipping status. Please try again.',
              }),
      });
    } finally {
      setIsSubmittingAction(false);
      setProcessingOrderId(null);
    }
  };

  const handleContact = (order: OrderNursery | ShipperNurseryOrderDetailPayload) => {
    notify({
      message: t('shippingList.contactInfo', {
        defaultValue: 'Contact nursery {{nurseryName}} to coordinate delivery.',
        nurseryName: order.nurseryName,
      }),
    });
  };

  const handleViewOrderDetail = useCallback(
    (order: OrderNursery | ShipperNurseryOrderDetailPayload) => {
      navigation.navigate('ShipperOrderDetail', {
        orderId: resolveOrderDetailId(order),
        nurseryOrderId: order.id,
      });
    },
    [navigation]
  );

  const renderOrderCard = ({ item }: { item: OrderNursery | ShipperNurseryOrderDetailPayload }) => {
    const shipperItem = item as ShipperNurseryOrderDetailPayload;
    const statusColors = getOrderStatusColors(item.statusName);
    const isActionLoading = processingOrderId === item.id;
    const isStartBlocked =
      canStartShipping(item.statusName) &&
      !!activeShippingOrder &&
      activeShippingOrder.id !== item.id;
    const canShowStart = canStartShipping(item.statusName);
    const canShowDelivered = canMarkDelivered(item.statusName);
    const canShowDeliveryFailed = canMarkDeliveryFailed(item.statusName);
    const totalUnits = item.items.reduce((sum, lineItem) => sum + Math.max(0, lineItem.quantity || 0), 0);
    const parsedDelivery = parseDeliveryNoteWithImage(item.deliveryNote);
    const deliveryImageUrl = (shipperItem.deliveryImageUrl || parsedDelivery.deliveryImageUrl) as string | null;
    const displayNote =
      parsedDelivery.note ||
      (shipperItem.shipperNote as string | undefined) ||
      t('shippingList.noShipperNote', { defaultValue: 'No shipper note yet.' });

    return (
      <View style={[styles.orderCard, isDeliveredStatus(item.statusName) && styles.orderCardDelivered]}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTopLeft}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusColors.backgroundColor,
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: statusColors.textColor }]}>
                {getOrderStatusLabel(item.statusName, t)}
              </Text>
            </View>
            <Text style={styles.statusHintText}>{getStatusHint(item.statusName)}</Text>
          </View>

          <TouchableOpacity
            style={styles.moreIconButton}
            onPress={() => handleViewOrderDetail(item)}
            disabled={isActionLoading}
          >
            <Ionicons name="open-outline" size={18} color={TEXT_DARK} />
          </TouchableOpacity>
        </View>

        <Text style={styles.orderCodeText}>
          {t('shippingList.orderCode', {
            defaultValue: 'Order #{{code}}',
            code: buildOrderCode(item.id),
          })}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="cube-outline" size={16} color={COLORS.gray500} />
          <Text style={styles.infoRowTextMuted} numberOfLines={1}>
            {t('shippingList.itemsAndSubtotal', {
              defaultValue: '{{count}} items • {{units}} qty • {{subtotal}}',
              count: item.items.length,
              units: totalUnits,
              subtotal: formatCurrency(item.subTotalAmount),
            })}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color={COLORS.gray500} />
          <Text style={styles.infoRowText} numberOfLines={1}>
            {shipperItem.customerName || t('shippingList.noCustomer', { defaultValue: 'Customer' })}
          </Text>

          {typeof shipperItem.depositAmount === 'number' && shipperItem.depositAmount > 0 ? (
            <View style={styles.paymentInlineWrap}>
              <View style={styles.paymentPill}>
                <Text style={styles.paymentPillLabel}>
                  {t('shipperOrderList.paidDepositLabel', { defaultValue: 'Paid deposit' })}
                </Text>
                <Text style={styles.paymentPillValue}>{formatCurrency(shipperItem.depositAmount)}</Text>
              </View>

              <View style={styles.paymentPill}>
                <Text style={styles.paymentPillLabel}>
                  {t('shipperOrderList.remainingLabel', { defaultValue: 'Remaining' })}
                </Text>
                <Text style={styles.paymentPillValue}>{formatCurrency(shipperItem.remainingAmount ?? Math.max(0, (shipperItem.totalAmount || 0) - (shipperItem.depositAmount || 0)))}</Text>
              </View>
            </View>
          ) : typeof shipperItem.remainingAmount === 'number' ? (
            <Text style={styles.lineItemPrice}>{formatCurrency(shipperItem.remainingAmount)}</Text>
          ) : null}
        </View>

        <View style={styles.divider} />

        {item.items.slice(0, 2).map((lineItem) => {
          const imageUri = resolveLineItemImage(lineItem);

          return (
            <View key={`${item.id}-${lineItem.id}`} style={styles.lineItemRow}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.lineItemImage} resizeMode="cover" />
              ) : (
                <View style={styles.lineItemImagePlaceholder}>
                  <Ionicons name="image-outline" size={16} color={COLORS.gray500} />
                </View>
              )}

              <View style={styles.lineItemBody}>
                <Text style={styles.lineItemName} numberOfLines={1}>
                  {lineItem.itemName}
                </Text>
                <View style={styles.lineItemMetaRow}>
                  <View style={styles.lineItemQtyBadge}>
                    <Text style={styles.lineItemQtyBadgeText}>
                      {t('shippingList.qtyLabel', {
                        defaultValue: 'Qty {{count}}',
                        count: lineItem.quantity,
                      })}
                    </Text>
                  </View>
                  <Text style={styles.lineItemPrice}>{formatCurrency(lineItem.price)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {item.items.length > 2 ? (
          <Text style={styles.moreItemsText}>
            {t('shippingList.moreItems', {
              defaultValue: '+{{count}} more items',
              count: item.items.length - 2,
            })}
          </Text>
        ) : null}

        <View style={styles.noteWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={15} color={COLORS.gray600} />
          <Text style={styles.noteText} numberOfLines={2}>
            {displayNote}
          </Text>
        </View>

        {deliveryImageUrl ? (
          <View style={styles.noteDeliveryImageWrap}>
            <Text style={styles.noteDeliveryImageLabel}>
              {t('shippingList.deliveryImageLabel', {
                defaultValue: 'Delivery image',
              })}
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPreviewImageUri(deliveryImageUrl)}
            >
              <Image
                source={{ uri: deliveryImageUrl }}
                style={styles.noteDeliveryImagePreview}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.viewDetailButton}
          onPress={() => handleViewOrderDetail(item)}
          disabled={isActionLoading}
        >
          <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
          <Text style={styles.viewDetailButtonText}>
            {t('shippingList.viewOrderDetail', {
              defaultValue: 'View order detail',
            })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>

        {isStartBlocked ? (
          <Text style={styles.lockHintText}>
            {t('shippingList.lockHint', {
              defaultValue: 'Complete your active shipping order before taking a new one.',
            })}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.contactButton,
              (canShowDelivered || canShowDeliveryFailed) && styles.contactButtonCompact,
              isActionLoading && styles.disabledButton,
            ]}
            onPress={() => handleContact(item)}
            disabled={isActionLoading}
          >
            <Ionicons name="call-outline" size={15} color={TEXT_DARK} />
            <Text style={styles.contactButtonText}>
              {t('shippingList.contact', { defaultValue: 'Contact' })}
            </Text>
          </TouchableOpacity>

          {canShowStart ? (
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                (isActionLoading || isStartBlocked) && styles.disabledButton,
              ]}
              onPress={() => openActionModal(item, 'start-shipping')}
              disabled={isActionLoading || isStartBlocked}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="bag-check-outline" size={15} color={COLORS.white} />
                  <Text style={styles.primaryActionButtonText}>
                    {t('shippingList.pickedUp', { defaultValue: 'Picked up' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {canShowDelivered ? (
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                styles.primaryActionButtonHighlight,
                isActionLoading && styles.disabledButton,
              ]}
              onPress={() => openActionModal(item, 'mark-delivered')}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color={ACCENT_DARK} />
              ) : (
                <>
                  <Ionicons name="checkmark-done-outline" size={15} color={ACCENT_DARK} />
                  <Text style={[styles.primaryActionButtonText, styles.primaryActionButtonTextDark]}>
                    {t('shippingList.complete', { defaultValue: 'Complete' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {canShowDeliveryFailed ? (
            <TouchableOpacity
              style={[styles.failureActionButton, isActionLoading && styles.disabledButton]}
              onPress={() => openActionModal(item, 'mark-delivery-failed')}
              disabled={isActionLoading}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={15} color={COLORS.white} />
                  <Text style={styles.failureActionButtonText}>
                    {t('shippingList.markDeliveryFailed', { defaultValue: 'Mark failed' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-circle-outline" size={76} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>
            {t('common.loginRequiredTitle', { defaultValue: 'Login required' })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('common.loginRequiredMessage', {
              defaultValue: 'Please login to continue.',
            })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('common.redirectingToLogin', {
              defaultValue: 'Redirecting to login...',
            })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={52}
        title={t('shippingList.screenTitle', { defaultValue: 'Shipping List' })}
        left={
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
        }
        // right={
        //   <View style={styles.notificationButton}>
        //     <Ionicons name="notifications-outline" size={20} color={TEXT_DARK} />
        //     <View style={styles.notificationDot} />
        //   </View>
        // }
        brandVariant='none'
      />

      {activeShippingOrder ? (
        <View style={styles.lockBanner}>
          <Ionicons name="lock-closed-outline" size={15} color={COLORS.warning} />
          <Text style={styles.lockBannerText}>
            {t('shippingList.activeShippingBanner', {
              defaultValue: 'Shipping order #{{code}} is active. Complete it to accept a new one.',
              code: buildOrderCode(activeShippingOrder.id),
            })}
          </Text>
        </View>
      ) : null}

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {statusFilters.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {getFilterLabel(filter)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading && orders.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={70} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>
            {t('shippingList.emptyTitle', {
              defaultValue: 'No shipping orders found',
            })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {errorMessage ||
              t('shippingList.emptySubtitle', {
                defaultValue: 'Assigned and shipping nursery orders will appear here.',
              })}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void loadOrders(activeFilter)}
          >
            <Text style={styles.retryButtonText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={orders}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderOrderCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: SPACING.lg,
              },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() =>
                  void loadOrders(activeFilter, {
                    refresh: true,
                    pageNumber: currentPage,
                  })
                }
                tintColor={COLORS.primary}
              />
            }
          />

          <View style={[styles.paginationWrap, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
            <Text style={styles.paginationMetaText}>
              {t('shippingList.paginationMeta', {
                defaultValue: 'Page {{current}}/{{total}} • {{count}} orders',
                current: currentPage,
                total: totalPages,
                count: totalCount,
              })}
            </Text>

            <View style={styles.paginationControl}>
              <TouchableOpacity
                style={[styles.paginationButton, (!hasPreviousPage || isPageLoading) && styles.disabledButton]}
                onPress={handlePrevPage}
                disabled={!hasPreviousPage || isPageLoading}
              >
                <Ionicons name="chevron-back" size={16} color={TEXT_DARK} />
              </TouchableOpacity>

              <View style={styles.pageNumberList}>
                {visiblePageTokens.map((token, index) =>
                  typeof token === 'number' ? (
                    <TouchableOpacity
                      key={`shipping-page-${token}`}
                      style={[styles.pageNumberChip, token === currentPage && styles.pageNumberChipActive]}
                      onPress={() => handlePageSelect(token)}
                      disabled={token === currentPage || isPageLoading}
                    >
                      <Text
                        style={[
                          styles.pageNumberChipText,
                          token === currentPage && styles.pageNumberChipTextActive,
                        ]}
                      >
                        {token}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text key={`shipping-page-ellipsis-${token}-${index}`} style={styles.pageNumberEllipsis}>
                      ...
                    </Text>
                  )
                )}
              </View>

              <TouchableOpacity
                style={[styles.paginationButton, (!hasNextPage || isPageLoading) && styles.disabledButton]}
                onPress={handleNextPage}
                disabled={!hasNextPage || isPageLoading}
              >
                <Ionicons name="chevron-forward" size={16} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>

            {isPageLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
          </View>
        </>
      )}

      <Modal
        visible={Boolean(previewImageUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri(null)}
      >
        <View style={styles.fullImageModalOverlay}>
          <TouchableOpacity
            style={styles.fullImageCloseButton}
            onPress={() => setPreviewImageUri(null)}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={24} color={COLORS.white} />
          </TouchableOpacity>

          {previewImageUri ? (
            <Image source={{ uri: previewImageUri }} style={styles.fullImagePreview} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeActionModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {actionType === 'start-shipping'
                ? t('shippingList.startShippingTitle', {
                    defaultValue: 'Confirm start shipping',
                  })
                : actionType === 'mark-delivered'
                ? t('shippingList.markDeliveredTitle', {
                    defaultValue: 'Confirm delivered',
                  })
                : t('shippingList.markDeliveryFailedTitle', {
                    defaultValue: 'Confirm delivery failed',
                  })}
            </Text>

            <Text style={styles.modalSubtitle}>
              {actionType === 'start-shipping'
                ? t('shippingList.startShippingDescription', {
                    defaultValue: 'Add a shipper note before confirming pickup.',
                  })
                : actionType === 'mark-delivered'
                ? t('shippingList.markDeliveredDescription', {
                    defaultValue: 'Add a delivery note before confirming delivery.',
                  })
                : t('shippingList.markDeliveryFailedDescription', {
                    defaultValue: 'Add a failure reason before confirming.',
                  })}
            </Text>

            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={4}
              placeholder={
                actionType === 'start-shipping'
                  ? t('shippingList.shipperNotePlaceholder', {
                      defaultValue: 'Enter shipper note',
                    })
                  : actionType === 'mark-delivered'
                  ? t('shippingList.deliveryNotePlaceholder', {
                      defaultValue: 'Enter delivery note',
                    })
                  : t('shippingList.failureReasonPlaceholder', {
                      defaultValue: 'Enter failure reason',
                    })
              }
              placeholderTextColor={COLORS.gray400}
              value={actionNote}
              onChangeText={setActionNote}
              editable={!isSubmittingAction}
            />

            {actionType === 'mark-delivered' ? (
              <View style={styles.modalImageSection}>
                <Text style={styles.modalImageLabel}>
                  {t('shippingList.deliveryImageLabel', {
                    defaultValue: 'Delivery image',
                  })}
                </Text>

                <View style={styles.modalImageActionsRow}>
                  <TouchableOpacity
                    style={[styles.modalImageActionButton, isSubmittingAction && styles.disabledButton]}
                    onPress={() => {
                      void handlePickDeliveryImage();
                    }}
                    disabled={isSubmittingAction}
                  >
                    <Ionicons name="images-outline" size={16} color={COLORS.textPrimary} />
                    <Text style={styles.modalImageActionText}>
                      {t('shippingList.chooseImage', {
                        defaultValue: 'Choose image',
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalImageActionButton, isSubmittingAction && styles.disabledButton]}
                    onPress={() => {
                      void handleCaptureDeliveryImage();
                    }}
                    disabled={isSubmittingAction}
                  >
                    <Ionicons name="camera-outline" size={16} color={COLORS.textPrimary} />
                    <Text style={styles.modalImageActionText}>
                      {t('shippingList.takePhoto', {
                        defaultValue: 'Take photo',
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedDeliveryImage ? (
                  <View style={styles.modalImagePreviewRow}>
                    <Image
                      source={{ uri: selectedDeliveryImage.uri }}
                      style={styles.modalImagePreview}
                      resizeMode="cover"
                    />
                    <Text style={styles.modalImagePreviewText} numberOfLines={2}>
                      {t('shippingList.selectedImage', {
                        defaultValue: 'Selected: {{name}}',
                        name: selectedDeliveryImage.fileName,
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeActionModal}
                disabled={isSubmittingAction}
              >
                <Text style={styles.modalCancelButtonText}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  void submitAction();
                }}
                disabled={isSubmittingAction}
              >
                {isSubmittingAction ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>
                    {actionType === 'start-shipping'
                      ? t('shippingList.startShipping', { defaultValue: 'Start shipping' })
                      : actionType === 'mark-delivered'
                      ? t('shippingList.markDelivered', { defaultValue: 'Mark delivered' })
                      : t('shippingList.markDeliveryFailed', {
                          defaultValue: 'Mark delivery failed',
                        })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCREEN_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: 'rgba(246, 248, 246, 0.95)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.xl,
    lineHeight: 23,
    color: TEXT_DARK,
    fontWeight: '700',
    marginHorizontal: SPACING.sm,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    borderWidth: 1,
    borderColor: COLORS.white,
    position: 'absolute',
    top: 8,
    right: 8,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.25)',
    backgroundColor: 'rgba(254, 252, 232, 0.9)',
  },
  lockBannerText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: '#854D0E',
    fontWeight: '600',
  },
  filterWrap: {
    paddingBottom: SPACING.md,
  },
  filterContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    height: 36,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  filterChipActive: {
    borderColor: ACCENT_GREEN,
    backgroundColor: ACCENT_GREEN,
  },
  filterChipText: {
    fontSize: FONTS.sizes.md,
    lineHeight: 20,
    color: TEXT_DARK,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: ACCENT_DARK,
    fontWeight: '700',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  orderCardDelivered: {
    opacity: 0.75,
    backgroundColor: COLORS.gray50,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  statusHintText: {
    fontSize: FONTS.sizes.sm,
    color: '#4C9A66',
  },
  moreIconButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCodeText: {
    fontSize: FONTS.sizes.xl,
    lineHeight: 23,
    color: TEXT_DARK,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  infoRowText: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    lineHeight: 21,
    color: '#4C9A66',
    fontWeight: '500',
  },
  infoRowTextMuted: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    lineHeight: 20,
    color: TEXT_DARK,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.md,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  lineItemImage: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
  },
  lineItemImagePlaceholder: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemBody: {
    flex: 1,
    gap: 4,
  },
  lineItemName: {
    fontSize: FONTS.sizes.md,
    color: TEXT_DARK,
    fontWeight: '600',
  },
  lineItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  lineItemQtyBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: '#E8F7EF',
  },
  lineItemQtyBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: '#166534',
    fontWeight: '700',
  },
  lineItemPrice: {
    minWidth: 98,
    textAlign: 'right',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  moreItemsText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  noteWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  noteText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    lineHeight: 18,
    color: COLORS.gray700,
  },
  noteDeliveryImageWrap: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  noteDeliveryImageLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  noteDeliveryImagePreview: {
    width: '100%',
    height: 128,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
  },
  paymentInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  paymentPill: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentPillLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  paymentPillValue: {
    marginTop: 2,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  fullImageCloseButton: {
    position: 'absolute',
    top: SPACING['3xl'],
    right: SPACING.lg,
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  fullImagePreview: {
    width: '100%',
    height: '82%',
  },
  viewDetailButton: {
    marginTop: SPACING.sm,
    height: 38,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  viewDetailButtonText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  lockHintText: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: '#854D0E',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  contactButton: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  contactButtonCompact: {
    flex: 0.95,
  },
  contactButtonText: {
    fontSize: FONTS.sizes.md,
    color: TEXT_DARK,
    fontWeight: '700',
  },
  primaryActionButton: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  primaryActionButtonHighlight: {
    backgroundColor: ACCENT_GREEN,
  },
  primaryActionButtonText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    fontWeight: '700',
  },
  primaryActionButtonTextDark: {
    color: ACCENT_DARK,
  },
  failureActionButton: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  failureActionButtonText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  paginationWrap: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  paginationMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  paginationControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  paginationButton: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  pageNumberChip: {
    minWidth: 34,
    height: 34,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  pageNumberChipActive: {
    borderColor: ACCENT_GREEN,
    backgroundColor: 'rgba(19, 236, 91, 0.15)',
  },
  pageNumberChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  pageNumberChipTextActive: {
    color: ACCENT_DARK,
  },
  pageNumberEllipsis: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING['2xl'],
  },
  emptyTitle: {
    marginTop: SPACING.md,
    textAlign: 'center',
    color: TEXT_DARK,
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
  },
  emptySubtitle: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  modalSubtitle: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  modalInput: {
    marginTop: SPACING.md,
    minHeight: 108,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    textAlignVertical: 'top',
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.gray50,
  },
  modalImageSection: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  modalImageLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  modalImageActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalImageActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  modalImageActionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  modalImagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray50,
    padding: SPACING.sm,
  },
  modalImagePreview: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
  },
  modalImagePreviewText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalActions: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  modalCancelButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  modalConfirmButton: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    minWidth: 130,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  modalConfirmButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
});
