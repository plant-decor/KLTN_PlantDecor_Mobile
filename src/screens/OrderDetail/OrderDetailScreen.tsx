import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { BrandedHeader } from '../../components/branding';
import { orderService, paymentService, returnTicketService } from '../../services';
import { useEnumStore } from '../../stores';
import {
  OrderLineItem,
  OrderPayload,
  ReturnTicket,
  ReturnTicketImageFile,
  RootStackParamList,
} from '../../types';
import {
  canContinueOrderPayment,
  formatVietnamDateTime,
  getOrderStatusColors,
  getOrderStatusLabel,
  isOrderCancellableStatus,
  notify,
  resolveImageUri,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'OrderDetail'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;

const resolveOrderItemImage = (lineItem: OrderPayload['items'][number]): string | null => {
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

const normalizeStatusToken = (status: string): string =>
  status.replace(/[^a-z0-9]/gi, '').toLowerCase();

const isPendingConfirmationStatus = (status: string): boolean =>
  normalizeStatusToken(status) === 'pendingconfirmation';

const resolveReturnEligibleItemId = (lineItem: OrderLineItem): number | null => {
  if (
    typeof lineItem.nurseryOrderDetailId === 'number' &&
    Number.isFinite(lineItem.nurseryOrderDetailId) &&
    lineItem.nurseryOrderDetailId > 0
  ) {
    return lineItem.nurseryOrderDetailId;
  }

  return typeof lineItem.id === 'number' && Number.isFinite(lineItem.id) && lineItem.id > 0
    ? lineItem.id
    : null;
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

type ReturnSelectionState = {
  selected: boolean;
  quantity: number;
  reason: string;
};

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
  const [currentReturnTicket, setCurrentReturnTicket] = useState<ReturnTicket | null>(null);
  const [ticketReason, setTicketReason] = useState('');
  const [returnSelections, setReturnSelections] = useState<Record<number, ReturnSelectionState>>({});
  const [isCreatingReturnTicket, setIsCreatingReturnTicket] = useState(false);
  const [uploadingReturnItemId, setUploadingReturnItemId] = useState<number | null>(null);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadEnumResource('orders');
      void loadEnumResource('return-tickets');
      void loadEnumResource('return-ticket-items');
      void loadEnumResource('return-ticket-assignments');
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

  const getReturnTicketStatusLabel = useCallback(
    (status: string) =>
      t(`returnTicket.status.${normalizeStatusToken(status)}`, {
        defaultValue: status,
      }),
    [t]
  );

  const formatCurrency = useCallback(
    (value: number) => `${(value || 0).toLocaleString(locale)}đ`,
    [locale]
  );

  const formatDateTime = useCallback(
    (value: string) => formatVietnamDateTime(value, locale, { empty: value }),
    [locale]
  );

  const loadOrderDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      setErrorMessage(null);
      const payload = await orderService.getOrderDetail(orderId);
      const returnTickets = await returnTicketService.getMyReturnTickets().catch(() => []);
      const matchedTicket = returnTickets.find((ticket) => ticket.orderId === orderId) ?? null;
      setOrder(payload);
      setCurrentReturnTicket(matchedTicket);
      setTicketReason(matchedTicket?.reason ?? '');
      setReturnSelections({});
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

  const eligibleReturnItems = useMemo(
    () =>
      (order?.items ?? []).filter((item) => resolveReturnEligibleItemId(item) !== null),
    [order]
  );

  const selectedReturnItems = useMemo(
    () =>
      eligibleReturnItems.filter((item) => {
        const itemKey = resolveReturnEligibleItemId(item);
        return itemKey !== null && returnSelections[itemKey]?.selected;
      }),
    [eligibleReturnItems, returnSelections]
  );

  const isAllReturnItemsSelected = useMemo(
    () =>
      eligibleReturnItems.length > 0 &&
      eligibleReturnItems.every((item) => {
        const itemId = resolveReturnEligibleItemId(item);
        return itemId !== null && returnSelections[itemId]?.selected;
      }),
    [eligibleReturnItems, returnSelections]
  );

  const canRequestReturn = useMemo(
    () =>
      Boolean(
        order &&
          isPendingConfirmationStatus(order.statusName) &&
          eligibleReturnItems.length > 0 &&
          !currentReturnTicket
      ),
    [currentReturnTicket, eligibleReturnItems.length, order]
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

  const toggleReturnItemSelection = useCallback((lineItem: OrderLineItem) => {
    const itemId = resolveReturnEligibleItemId(lineItem);
    if (itemId === null) {
      return;
    }

    setReturnSelections((previous) => {
      const current = previous[itemId];
      const nextSelected = !current?.selected;

      return {
        ...previous,
        [itemId]: {
          selected: nextSelected,
          quantity: current?.quantity && current.quantity > 0 ? current.quantity : 1,
          reason: current?.reason ?? '',
        },
      };
    });
  }, []);

  const handleReturnAll = useCallback(() => {
    if (isAllReturnItemsSelected) {
      setReturnSelections({});
      return;
    }

    setReturnSelections((previous) =>
      eligibleReturnItems.reduce<Record<number, ReturnSelectionState>>((accumulator, item) => {
        const itemId = resolveReturnEligibleItemId(item);
        if (itemId === null) {
          return accumulator;
        }

        accumulator[itemId] = {
          selected: true,
          quantity: Math.max(1, item.quantity),
          reason: previous[itemId]?.reason ?? '',
        };
        return accumulator;
      }, {})
    );
  }, [eligibleReturnItems, isAllReturnItemsSelected]);

  const updateReturnItemQuantity = useCallback((lineItem: OrderLineItem, delta: number) => {
    const itemId = resolveReturnEligibleItemId(lineItem);
    if (itemId === null) {
      return;
    }

    setReturnSelections((previous) => {
      const current = previous[itemId];
      const nextQuantity = Math.min(
        Math.max((current?.quantity ?? 1) + delta, 1),
        Math.max(1, lineItem.quantity)
      );

      return {
        ...previous,
        [itemId]: {
          selected: current?.selected ?? true,
          quantity: nextQuantity,
          reason: current?.reason ?? '',
        },
      };
    });
  }, []);

  const updateReturnItemReason = useCallback((lineItem: OrderLineItem, reason: string) => {
    const itemId = resolveReturnEligibleItemId(lineItem);
    if (itemId === null) {
      return;
    }

    setReturnSelections((previous) => {
      const current = previous[itemId];
      return {
        ...previous,
        [itemId]: {
          selected: current?.selected ?? true,
          quantity: current?.quantity ?? 1,
          reason,
        },
      };
    });
  }, []);

  const refreshReturnTicket = useCallback(async () => {
    const tickets = await returnTicketService.getMyReturnTickets();
    const matchedTicket = tickets.find((ticket) => ticket.orderId === orderId) ?? null;
    setCurrentReturnTicket(matchedTicket);
    if (matchedTicket) {
      setTicketReason(matchedTicket.reason ?? '');
    }
  }, [orderId]);

  const handleSubmitReturnTicket = useCallback(async () => {
    if (!order || isCreatingReturnTicket) {
      return;
    }

    if (selectedReturnItems.length === 0) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('returnTicket.noItemsSelected', {
          defaultValue: 'Please select at least one item to return.',
        }),
      });
      return;
    }

    const requestItems = selectedReturnItems.map((item) => {
      const itemId = resolveReturnEligibleItemId(item);
      const selection = itemId !== null ? returnSelections[itemId] : undefined;

      return {
        nurseryOrderDetailId: itemId ?? 0,
        requestedQuantity: selection?.quantity ?? 0,
        reason: selection?.reason?.trim() ?? '',
      };
    });

    const hasInvalidQuantity = requestItems.some(
      (item) => item.nurseryOrderDetailId <= 0 || item.requestedQuantity <= 0
    );
    if (hasInvalidQuantity) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('returnTicket.invalidQuantity', {
          defaultValue: 'Please choose a valid return quantity for each selected item.',
        }),
      });
      return;
    }

    const hasMissingReason = requestItems.some((item) => item.reason.length === 0);
    if (hasMissingReason) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('returnTicket.missingItemReason', {
          defaultValue: 'Please add a reason for each selected item.',
        }),
      });
      return;
    }

    setIsCreatingReturnTicket(true);

    try {
      const createdTicket = await returnTicketService.createReturnTicket({
        orderId: order.id,
        reason: ticketReason.trim(),
        items: requestItems,
      });

      setCurrentReturnTicket(createdTicket);
      setTicketReason(createdTicket.reason ?? '');
      notify({
        title: t('common.success', { defaultValue: 'Success' }),
        message: t('returnTicket.createSuccess', {
          defaultValue: 'Return request submitted successfully.',
        }),
      });
      await refreshReturnTicket();
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message:
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('returnTicket.createFailed', {
                defaultValue: 'Unable to submit the return request. Please try again.',
              }),
      });
    } finally {
      setIsCreatingReturnTicket(false);
    }
  }, [
    isCreatingReturnTicket,
    order,
    refreshReturnTicket,
    returnSelections,
    selectedReturnItems,
    t,
    ticketReason,
  ]);

  const toReturnImageFile = useCallback(
    (asset: ImagePicker.ImagePickerAsset): ReturnTicketImageFile | null => {
      const selectedUri = asset?.uri?.trim();
      if (!selectedUri) {
        return null;
      }

      const fallbackFileName = selectedUri.split('/').pop() || `return-${Date.now()}.jpg`;
      const fileName = asset?.fileName?.trim() || fallbackFileName;
      const mimeType = asset?.mimeType?.trim() || resolveImageMimeType(fileName);

      return {
        uri: selectedUri,
        fileName,
        mimeType,
      };
    },
    []
  );

  const uploadReturnItemImages = useCallback(
    async (returnItemId: number, files: ReturnTicketImageFile[]) => {
      if (!currentReturnTicket || files.length === 0) {
        return;
      }

      setUploadingReturnItemId(returnItemId);

      try {
        const updatedItem = await returnTicketService.uploadReturnTicketItemImages(
          currentReturnTicket.id,
          returnItemId,
          files
        );

        setCurrentReturnTicket((previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            items: previous.items.map((item) =>
              item.id === updatedItem.id ? updatedItem : item
            ),
          };
        });

        notify({
          title: t('common.success', { defaultValue: 'Success' }),
          message: t('returnTicket.uploadSuccess', {
            defaultValue: 'Evidence images uploaded successfully.',
          }),
        });
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message:
            typeof apiMessage === 'string' && apiMessage.trim().length > 0
              ? apiMessage
              : t('returnTicket.uploadFailed', {
                  defaultValue: 'Unable to upload evidence images. Please try again.',
                }),
        });
      } finally {
        setUploadingReturnItemId(null);
      }
    },
    [currentReturnTicket, t]
  );

  const handlePickReturnImages = useCallback(
    async (returnItemId: number) => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('returnTicket.imagePermissionDenied', {
            defaultValue: 'Please grant photo library access to upload evidence images.',
          }),
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const files = (result.assets ?? [])
        .map((asset) => toReturnImageFile(asset))
        .filter((asset): asset is ReturnTicketImageFile => Boolean(asset));

      if (files.length === 0) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('returnTicket.imageMissing', {
            defaultValue: 'Please choose at least one image.',
          }),
        });
        return;
      }

      await uploadReturnItemImages(returnItemId, files);
    },
    [t, toReturnImageFile, uploadReturnItemImages]
  );

  const handleCaptureReturnImage = useCallback(
    async (returnItemId: number) => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('returnTicket.cameraPermissionDenied', {
            defaultValue: 'Please grant camera access to take evidence images.',
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

      const file = toReturnImageFile(result.assets?.[0]);
      if (!file) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('returnTicket.imageMissing', {
            defaultValue: 'Please choose at least one image.',
          }),
        });
        return;
      }

      await uploadReturnItemImages(returnItemId, [file]);
    },
    [t, toReturnImageFile, uploadReturnItemImages]
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
        brandVariant="none"
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
          {order.items.map((item) => {
            const imageUri = resolveOrderItemImage(item);

            return (
              <View key={item.id} style={styles.lineItemRow}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.lineItemImage} resizeMode="cover" />
                ) : (
                  <View style={styles.lineItemImagePlaceholder}>
                    <Ionicons name="image-outline" size={16} color={COLORS.gray500} />
                  </View>
                )}

                <View style={styles.lineItemBody}>
                  <Text style={styles.lineItemName} numberOfLines={2}>
                    {item.itemName}
                  </Text>

                  <View style={styles.lineItemMetaRow}>
                    <View style={styles.lineItemQtyBadge}>
                      <Text style={styles.lineItemQtyBadgeText}>
                        {t('orderDetail.qtyLabel', {
                          defaultValue: 'Qty {{count}}',
                          count: item.quantity,
                        })}
                      </Text>
                    </View>

                    <Text style={styles.lineItemPrice}>{formatCurrency(item.price)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
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

        {(isPendingConfirmationStatus(order.statusName) || currentReturnTicket) ? (
          <View style={styles.card}>
            <View style={styles.returnSectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('returnTicket.sectionTitle', { defaultValue: 'Return request' })}
              </Text>
              {currentReturnTicket ? (
                <View style={styles.returnStatusBadge}>
                  <Text style={styles.returnStatusBadgeText}>
                    {getReturnTicketStatusLabel(currentReturnTicket.statusName)}
                  </Text>
                </View>
              ) : null}
            </View>

            {currentReturnTicket ? (
              <>
                <Text style={styles.infoText}>
                  {t('returnTicket.existingSubtitle', {
                    defaultValue: 'Your return request is already being processed.',
                  })}
                </Text>
                <Text style={styles.noteText}>
                  {t('returnTicket.overallReasonLabel', {
                    defaultValue: 'Overall reason',
                  })}
                  : {currentReturnTicket.reason || '-'}
                </Text>
                <Text style={styles.noteText}>
                  {t('returnTicket.itemCountLabel', {
                    defaultValue: '{{count}} item(s)',
                    count: currentReturnTicket.items.length,
                  })}
                </Text>

                {currentReturnTicket.items.map((item) => (
                  <View key={item.id} style={styles.returnItemCard}>
                    <View style={styles.lineItemRow}>
                      {resolveImageUri(item.productImageUrl) ? (
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => setPreviewImageUri(resolveImageUri(item.productImageUrl))}
                        >
                          <Image
                            source={{ uri: resolveImageUri(item.productImageUrl)! }}
                            style={styles.lineItemImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.lineItemImagePlaceholder}>
                          <Ionicons name="image-outline" size={16} color={COLORS.gray500} />
                        </View>
                      )}

                      <View style={styles.lineItemBody}>
                        <Text style={styles.lineItemName} numberOfLines={2}>
                          {item.itemName}
                        </Text>
                        <Text style={styles.noteText}>
                          {t('returnTicket.quantityLabel', {
                            defaultValue: 'Return qty',
                          })}
                          : {item.requestedQuantity}
                        </Text>
                        <Text style={styles.noteText}>
                          {t('returnTicket.itemReasonLabel', {
                            defaultValue: 'Item reason',
                          })}
                          : {item.reason}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.returnEvidenceHint}>
                      {t('returnTicket.uploadEvidenceHint', {
                        defaultValue:
                          'Upload evidence images to help us decide your return request.',
                      })}
                    </Text>

                    <View style={styles.returnUploadActionRow}>
                      <TouchableOpacity
                        style={styles.returnUploadButton}
                        onPress={() => {
                          void handlePickReturnImages(item.id);
                        }}
                        disabled={uploadingReturnItemId === item.id}
                      >
                        <Ionicons name="images-outline" size={16} color={COLORS.textPrimary} />
                        <Text style={styles.returnUploadButtonText}>
                          {t('returnTicket.chooseImages', {
                            defaultValue: 'Choose images',
                          })}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.returnUploadButton}
                        onPress={() => {
                          void handleCaptureReturnImage(item.id);
                        }}
                        disabled={uploadingReturnItemId === item.id}
                      >
                        <Ionicons name="camera-outline" size={16} color={COLORS.textPrimary} />
                        <Text style={styles.returnUploadButtonText}>
                          {t('returnTicket.takePhoto', {
                            defaultValue: 'Take photo',
                          })}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {uploadingReturnItemId === item.id ? (
                      <ActivityIndicator
                        size="small"
                        color={COLORS.primary}
                        style={styles.returnUploadLoader}
                      />
                    ) : null}

                    {item.imageUrls.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.returnImageList}
                      >
                        {item.imageUrls.map((imageUrl) => (
                          <TouchableOpacity
                            key={imageUrl}
                            activeOpacity={0.9}
                            onPress={() => setPreviewImageUri(imageUrl)}
                          >
                            <Image
                              source={{ uri: imageUrl }}
                              style={styles.returnEvidenceImage}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : (
                      <Text style={styles.noteText}>
                        {t('returnTicket.noImages', {
                          defaultValue: 'No evidence images uploaded yet.',
                        })}
                      </Text>
                    )}
                  </View>
                ))}
              </>
            ) : canRequestReturn ? (
              <>
                <Text style={styles.returnEvidenceHint}>
                  {t('returnTicket.selectItemsHint', {
                    defaultValue: 'Select the items you want to return.',
                  })}
                </Text>

                <View style={styles.returnActionsBar}>
                  <TouchableOpacity style={styles.returnAllButton} onPress={handleReturnAll}>
                    <Text style={styles.returnAllButtonText}>
                      {isAllReturnItemsSelected
                        ? t('returnTicket.unselectAll', { defaultValue: 'Unselect all' })
                        : t('returnTicket.returnAll', { defaultValue: 'Return all' })}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.returnLabel}>
                  {t('returnTicket.overallReasonLabel', {
                    defaultValue: 'Overall reason',
                  })}
                </Text>
                <TextInput
                  style={styles.returnReasonInput}
                  multiline
                  numberOfLines={3}
                  placeholder={t('returnTicket.overallReasonPlaceholder', {
                    defaultValue: 'Describe the overall reason for this return request',
                  })}
                  placeholderTextColor={COLORS.gray400}
                  value={ticketReason}
                  onChangeText={setTicketReason}
                />

                {eligibleReturnItems.map((item) => {
                  const returnItemId = resolveReturnEligibleItemId(item);
                  if (returnItemId === null) {
                    return null;
                  }

                  const selection = returnSelections[returnItemId];
                  const isSelected = selection?.selected === true;
                  const imageUri = resolveOrderItemImage(item);

                  return (
                    <View key={item.id} style={styles.returnItemCard}>
                      <TouchableOpacity
                        style={styles.returnCheckboxRow}
                        onPress={() => toggleReturnItemSelection(item)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? COLORS.primary : COLORS.gray500}
                        />
                        {imageUri ? (
                          <Image source={{ uri: imageUri }} style={styles.lineItemImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.lineItemImagePlaceholder}>
                            <Ionicons name="image-outline" size={16} color={COLORS.gray500} />
                          </View>
                        )}

                        <View style={styles.lineItemBody}>
                          <Text style={styles.lineItemName} numberOfLines={2}>
                            {item.itemName}
                          </Text>
                          <Text style={styles.noteText}>
                            {t('orderDetail.qtyLabel', {
                              defaultValue: 'Qty {{count}}',
                              count: item.quantity,
                            })}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {isSelected ? (
                        <>
                          <View style={styles.returnQuantityRow}>
                            <Text style={styles.returnLabel}>
                              {t('returnTicket.quantityLabel', {
                                defaultValue: 'Return qty',
                              })}
                            </Text>
                            <View style={styles.returnStepper}>
                              <TouchableOpacity
                                style={styles.returnStepperButton}
                                onPress={() => updateReturnItemQuantity(item, -1)}
                              >
                                <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                              </TouchableOpacity>
                              <Text style={styles.returnStepperValue}>
                                {selection?.quantity ?? 1}
                              </Text>
                              <TouchableOpacity
                                style={styles.returnStepperButton}
                                onPress={() => updateReturnItemQuantity(item, 1)}
                              >
                                <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                              </TouchableOpacity>
                            </View>
                          </View>

                          <Text style={styles.returnLabel}>
                            {t('returnTicket.itemReasonLabel', {
                              defaultValue: 'Item reason',
                            })}
                          </Text>
                          <TextInput
                            style={styles.returnReasonInput}
                            multiline
                            numberOfLines={3}
                            placeholder={t('returnTicket.itemReasonPlaceholder', {
                              defaultValue: 'Describe the issue for this item',
                            })}
                            placeholderTextColor={COLORS.gray400}
                            value={selection?.reason ?? ''}
                            onChangeText={(value) => updateReturnItemReason(item, value)}
                          />
                        </>
                      ) : null}
                    </View>
                  );
                })}

                <Text style={styles.returnEvidenceHint}>
                  {t('returnTicket.uploadOptionalHint', {
                    defaultValue:
                      'Images are optional. You can upload multiple images for each item.',
                  })}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.submitReturnButton,
                    isCreatingReturnTicket && styles.actionButtonDisabled,
                  ]}
                  onPress={() => {
                    void handleSubmitReturnTicket();
                  }}
                  disabled={isCreatingReturnTicket}
                >
                  {isCreatingReturnTicket ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.submitReturnButtonText}>
                      {t('returnTicket.submitAction', {
                        defaultValue: 'Submit return request',
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noteText}>
                {eligibleReturnItems.length === 0
                  ? t('returnTicket.noEligibleItems', {
                      defaultValue: 'No eligible items available for return.',
                    })
                  : t('returnTicket.existingSubtitle', {
                      defaultValue: 'Your return request is already being processed.',
                    })}
              </Text>
            )}
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
          >
            <Ionicons name="close" size={22} color={COLORS.white} />
          </TouchableOpacity>

          {previewImageUri ? (
            <Image
              source={{ uri: previewImageUri }}
              style={styles.fullImagePreview}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
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
    marginBottom: SPACING.sm,
  },
  lineItemImage: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
  },
  lineItemImagePlaceholder: {
    width: 44,
    height: 44,
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
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  lineItemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  lineItemQtyBadge: {
    borderRadius: RADIUS.full,
    backgroundColor: '#E8F7EF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  lineItemQtyBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: '#166534',
    fontWeight: '700',
  },
  lineItemPrice: {
    minWidth: 92,
    textAlign: 'right',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  returnSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  returnStatusBadge: {
    borderRadius: RADIUS.full,
    backgroundColor: '#E8F7EF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  returnStatusBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.primary,
  },
  returnActionsBar: {
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  returnAllButton: {
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray100,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  returnAllButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  returnItemCard: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    backgroundColor: COLORS.gray50,
  },
  returnCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  returnQuantityRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  returnLabel: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  returnReasonInput: {
    marginTop: SPACING.xs,
    minHeight: 84,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    textAlignVertical: 'top',
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  returnStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 4,
  },
  returnStepperButton: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  returnStepperValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  returnEvidenceHint: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  submitReturnButton: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  submitReturnButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.white,
  },
  returnUploadActionRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  returnUploadButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  returnUploadButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  returnUploadLoader: {
    marginTop: SPACING.sm,
  },
  returnImageList: {
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  returnEvidenceImage: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
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
