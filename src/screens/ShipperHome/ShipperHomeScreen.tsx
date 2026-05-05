import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShipperHome'>;
type ShipperActionType = 'start-shipping' | 'mark-delivered' | 'mark-delivery-failed';
type SelectedDeliveryImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

const ASSIGNED_STATUS = 3;
const SHIPPING_STATUS = 4;

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

export default function ShipperHomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [shippingOrder, setShippingOrder] = useState<OrderNursery | ShipperNurseryOrderDetailPayload | null>(null);
  const [assignedOrders, setAssignedOrders] = useState<(OrderNursery | ShipperNurseryOrderDetailPayload)[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState<ShipperActionType | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderNursery | ShipperNurseryOrderDetailPayload | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [selectedDeliveryImage, setSelectedDeliveryImage] = useState<SelectedDeliveryImage | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);

  const displayName =
    typeof user?.fullName === 'string' && user.fullName.trim().length > 0
      ? user.fullName.trim()
      : t('shipperHome.defaultName', { defaultValue: 'Shipper' });

  const displayEmail =
    typeof user?.email === 'string' && user.email.trim().length > 0
      ? user.email.trim()
      : t('shipperHome.noEmail', { defaultValue: 'No email available' });

  const displayPhone =
    typeof user?.phoneNumber === 'string' && user.phoneNumber.trim().length > 0
      ? user.phoneNumber.trim()
      : typeof user?.phone === 'string' && user.phone.trim().length > 0
      ? user.phone.trim()
      : null;

  const nurseryName =
    typeof user?.nurseryName === 'string' && user.nurseryName.trim().length > 0
      ? user.nurseryName.trim()
      : t('shipperHome.nurseryFallback', { defaultValue: 'None' });

  const formatCurrency = useCallback(
    (value: number) => `${(value || 0).toLocaleString(locale)}đ`,
    [locale]
  );

  const loadStatusOrders = useCallback(
    async (options?: { refresh?: boolean; background?: boolean }) => {
      if (!isAuthenticated) {
        return;
      }

      const isBackground = options?.background === true;

      if (!isBackground) {
        if (options?.refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoadingOrders(true);
        }
      }

      try {
        setErrorMessage(null);

        const [shippingPayload, assignedPayload] = await Promise.all([
          orderService.getNurseryOrders({
            status: SHIPPING_STATUS,
            pageNumber: 1,
            pageSize: 1,
          }),
          orderService.getNurseryOrders({
            status: ASSIGNED_STATUS,
            pageNumber: 1,
            pageSize: 50,
          }),
        ]);

        const oldestAssigned = [...(assignedPayload.items ?? [])].sort((left, right) => left.id - right.id);

        setShippingOrder(shippingPayload.items[0] ?? null);
        setAssignedOrders(oldestAssigned.slice(0, 1));
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
        setIsLoadingOrders(false);
        setIsRefreshing(false);
      }
    },
    [isAuthenticated, t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return;
      }

      void loadStatusOrders();
    }, [isAuthenticated, loadStatusOrders])
  );

  const handleLogout = async () => {
    if (!isAuthenticated || isSigningOut) {
      return;
    }

    try {
      await logout();
    } catch (error) {
      throw error;
    }
  };

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

      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (asset?.fileSize && asset.fileSize > MAX_FILE_SIZE) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('shippingList.imageTooLarge', {
            defaultValue: 'Image size must be less than 5MB.',
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
      quality: 0.5,
    });

    if (result.canceled) {
      return;
    }

    handleDeliveryImageAsset(result.assets?.[0]);
  }, [handleDeliveryImageAsset, isSubmittingAction, t]);

  const openActionModal = useCallback(
    (order: OrderNursery | ShipperNurseryOrderDetailPayload, nextAction: ShipperActionType) => {
      if (nextAction === 'start-shipping' && shippingOrder && shippingOrder.id !== order.id) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('shippingList.oneShippingRule', {
            defaultValue:
              'You already have one order in shipping. Complete it before starting a new order.',
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
    },
    [shippingOrder, t]
  );

  const submitAction = useCallback(async () => {
    if (!selectedOrder || !actionType) {
      return;
    }

    if (actionType === 'start-shipping' && shippingOrder && shippingOrder.id !== selectedOrder.id) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('shippingList.oneShippingRule', {
          defaultValue:
            'You already have one order in shipping. Complete it before starting a new order.',
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
              deliveryImage: selectedDeliveryImage ?? undefined,
            });

      if (actionType === 'start-shipping') {
        setShippingOrder(updatedOrder);
      }

      if (actionType !== 'start-shipping' && shippingOrder && shippingOrder.id === updatedOrder.id) {
        setShippingOrder(null);
      }

      setAssignedOrders((previousOrders) =>
        previousOrders.filter((order) => order.id !== updatedOrder.id)
      );

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

      closeActionModal();
      void loadStatusOrders({ background: true });
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
  }, [
    actionNote,
    actionType,
    closeActionModal,
    loadStatusOrders,
    selectedDeliveryImage,
    selectedOrder,
    shippingOrder,
    t,
  ]);

  const handleContact = useCallback(
    (order: OrderNursery | ShipperNurseryOrderDetailPayload) => {
      notify({
        message: t('shippingList.contactInfo', {
          defaultValue: 'Contact nursery {{nurseryName}} to coordinate delivery.',
          nurseryName: order.nurseryName,
        }),
      });
    },
    [t]
  );

  const handleViewOrderDetail = useCallback(
    (order: OrderNursery | ShipperNurseryOrderDetailPayload) => {
      navigation.navigate('ShipperOrderDetail', {
        orderId: resolveOrderDetailId(order),
        nurseryOrderId: order.id,
      });
    },
    [navigation]
  );

  const renderOrderCard = useCallback(
    (order: OrderNursery | ShipperNurseryOrderDetailPayload, sectionType: 'shipping' | 'assigned') => {
      const statusColors = getOrderStatusColors(order.statusName);
      const shipperOrder = order as ShipperNurseryOrderDetailPayload;
      const isActionLoading = processingOrderId === order.id;
      const isStartBlocked =
        sectionType === 'assigned' && !!shippingOrder && shippingOrder.id !== order.id;
      const totalUnits = order.items.reduce(
        (sum, lineItem) => sum + Math.max(0, lineItem.quantity || 0),
        0
      );
      const previewLineItem = order.items[0];
      const previewImageUri = previewLineItem ? resolveLineItemImage(previewLineItem) : null;

      return (
        <View key={`${sectionType}-${order.id}`} style={styles.orderCard}>
          <View style={styles.cardTopRow}>
            {/* <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusColors.backgroundColor,
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: statusColors.textColor }]}>
                {getOrderStatusLabel(order.statusName, t)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.iconButton, isActionLoading && styles.disabledButton]}
              onPress={() => handleViewOrderDetail(order)}
              disabled={isActionLoading}
            >
              <Ionicons name="open-outline" size={16} color={COLORS.textPrimary} />
            </TouchableOpacity> */}
          </View>

          <Text style={styles.orderCodeText}>
            {t('shippingList.orderCode', {
              defaultValue: 'Order #{{code}}',
              code: buildOrderCode(order.id),
            })}
          </Text>

          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={15} color={COLORS.gray500} />
            <Text style={styles.infoTextMuted} numberOfLines={1}>
              {t('shippingList.itemsAndSubtotal', {
                defaultValue: '{{count}} items • {{units}} qty • {{subtotal}}',
                count: order.items.length,
                units: totalUnits,
                subtotal: formatCurrency(order.subTotalAmount),
              })}
            </Text>
          </View>

          {typeof shipperOrder.depositAmount === 'number' && shipperOrder.depositAmount > 0 ? (
            <View style={styles.paymentSummarySmall}>
              <View style={styles.paymentPill}>
                <Text style={styles.paymentPillLabel}>
                  {t('shipperOrderList.paidDepositLabel', { defaultValue: 'Paid deposit' })}
                </Text>
                <Text style={styles.paymentPillValue}>{formatCurrency(shipperOrder.depositAmount)}</Text>
              </View>

              <View style={[styles.paymentPill, styles.paymentPillRight]}>
                <Text style={styles.paymentPillLabel}>
                  {t('shipperOrderList.remainingLabel', { defaultValue: 'Remaining' })}
                </Text>
                <Text style={styles.paymentPillValue}>{formatCurrency(shipperOrder.remainingAmount ?? Math.max(0, (shipperOrder.totalAmount || 0) - (shipperOrder.depositAmount || 0)))}</Text>
              </View>
            </View>
          ) : null}

          {previewLineItem ? (
            <View style={styles.itemPreviewRow}>
              {previewImageUri ? (
                <Image source={{ uri: previewImageUri }} style={styles.itemPreviewImage} resizeMode="cover" />
              ) : (
                <View style={styles.itemPreviewImagePlaceholder}>
                  <Ionicons name="image-outline" size={15} color={COLORS.gray500} />
                </View>
              )}

              <View style={styles.itemPreviewMeta}>
                <Text style={styles.itemPreviewName} numberOfLines={1}>
                  {previewLineItem.itemName}
                </Text>

                <View style={styles.itemPreviewMetaRow}>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>
                      {t('shippingList.qtyLabel', {
                        defaultValue: 'Qty {{count}}',
                        count: previewLineItem.quantity,
                      })}
                    </Text>
                  </View>
                  <Text style={styles.itemPreviewPrice}>{formatCurrency(previewLineItem.price)}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {order.items.length > 1 ? (
            <Text style={styles.moreItemsText}>
              {t('shippingList.moreItems', {
                defaultValue: '+{{count}} more items',
                count: order.items.length - 1,
              })}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => handleViewOrderDetail(order)}
            disabled={isActionLoading}
          >
            <Ionicons name="document-text-outline" size={15} color={COLORS.primary} />
            <Text style={styles.detailButtonText}>
              {t('shippingList.viewOrderDetail', {
                defaultValue: 'View order detail',
              })}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.primary} />
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
                sectionType === 'shipping' && styles.contactButtonCompact,
                isActionLoading && styles.disabledButton,
              ]}
              onPress={() => handleContact(order)}
              disabled={isActionLoading}
            >
              <Ionicons name="call-outline" size={15} color={COLORS.textPrimary} />
              <Text style={styles.contactButtonText}>
                {t('shippingList.contact', { defaultValue: 'Contact' })}
              </Text>
            </TouchableOpacity>

            {sectionType === 'assigned' ? (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (isStartBlocked || isActionLoading) && styles.disabledButton,
                ]}
                onPress={() => openActionModal(order, 'start-shipping')}
                disabled={isStartBlocked || isActionLoading}
              >
                {isActionLoading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="bag-check-outline" size={15} color={COLORS.white} />
                    <Text style={styles.primaryButtonText}>
                      {t('shippingList.pickedUp', { defaultValue: 'Picked up' })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.primaryButtonHighlight, isActionLoading && styles.disabledButton]}
                  onPress={() => openActionModal(order, 'mark-delivered')}
                  disabled={isActionLoading}
                >
                  {isActionLoading ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done-outline" size={15} color={COLORS.white} />
                      <Text style={styles.primaryButtonText}>
                        {t('shippingList.complete', { defaultValue: 'Complete' })}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.failureButton, isActionLoading && styles.disabledButton]}
                  onPress={() => openActionModal(order, 'mark-delivery-failed')}
                  disabled={isActionLoading}
                >
                  {isActionLoading ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={15} color={COLORS.white} />
                      <Text style={styles.failureButtonText}>
                        {t('shippingList.markDeliveryFailed', { defaultValue: 'Mark failed' })}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      );
    },
    [
      formatCurrency,
      handleContact,
      handleViewOrderDetail,
      openActionModal,
      processingOrderId,
      shippingOrder,
      t,
    ]
  );

  const shippingSection = useMemo(() => {
    if (isLoadingOrders && !shippingOrder) {
      return (
        <View style={styles.sectionLoaderWrap}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    if (!shippingOrder) {
      return (
        <View style={styles.emptyStateWrap}>
          <Ionicons name="car-outline" size={22} color={COLORS.gray500} />
          <Text style={styles.emptyStateText}>
            {t('shipperHome.emptyShippingOrder', {
              defaultValue: 'No order is currently in shipping status.',
            })}
          </Text>
        </View>
      );
    }

    return renderOrderCard(shippingOrder, 'shipping');
  }, [isLoadingOrders, renderOrderCard, shippingOrder, t]);

  const assignedSection = useMemo(() => {
    if (isLoadingOrders && assignedOrders.length === 0) {
      return (
        <View style={styles.sectionLoaderWrap}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    if (assignedOrders.length === 0) {
      return (
        <View style={styles.emptyStateWrap}>
          <Ionicons name="cube-outline" size={22} color={COLORS.gray500} />
          <Text style={styles.emptyStateText}>
            {t('shipperHome.emptyAssignedOrders', {
              defaultValue: 'No assigned orders at the moment.',
            })}
          </Text>
        </View>
      );
    }

    return assignedOrders.map((order) => renderOrderCard(order, 'assigned'));
  }, [assignedOrders, isLoadingOrders, renderOrderCard, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={44}
        // title={t('shipperHome.headerTitle', { defaultValue: 'Shipper hub' })}
        left={<View style={styles.headerPlaceholder} />}
        right={
          <TouchableOpacity
            style={[styles.headerActionButton, (isSigningOut || !isAuthenticated) && styles.disabledButton]}
            onPress={handleLogout}
            disabled={isSigningOut || !isAuthenticated}
          >
            {isSigningOut ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="log-out-outline" size={20} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        }
        brandVariant="logoWithText"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadStatusOrders({ refresh: true })}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            {t('shipperHome.profileSectionTitle', { defaultValue: 'User profile' })}
          </Text>

          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <Ionicons name="person" size={26} color={COLORS.primary} />
            </View>

            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.profileNursery} numberOfLines={1}>
                {t('shipperHome.nurseryLabel', {
                  defaultValue: 'Nursery: {{nursery}}',
                  nursery: nurseryName,
                })}
              </Text>
              <Text style={styles.profileContact} numberOfLines={1}>
                {displayEmail}
              </Text>
              {displayPhone ? (
                <Text style={styles.profileContact} numberOfLines={1}>
                  {displayPhone}
                </Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, (isSigningOut || !isAuthenticated) && styles.disabledButton]}
            activeOpacity={0.8}
            onPress={handleLogout}
            disabled={isSigningOut || !isAuthenticated}
          >
            {isSigningOut ? (
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            ) : (
              <>
                <Ionicons name="power-outline" size={16} color={COLORS.textPrimary} />
                <Text style={styles.secondaryButtonText}>
                  {t('shipperHome.signOut', { defaultValue: 'Sign out' })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {shippingOrder ? (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.warning} />
            <Text style={styles.lockBannerText}>
              {t('shippingList.activeShippingBanner', {
                defaultValue: 'Shipping order #{{code}} is active. Complete it to accept a new one.',
                code: buildOrderCode(shippingOrder.id),
              })}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            {t('shipperHome.shippingStatusOrderTitle', {
              defaultValue: 'Shipping status order',
            })}
          </Text>
          {shippingSection}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            {t('shipperHome.assignedStatusOrdersTitle', {
              defaultValue: 'Assigned status orders',
            })}
          </Text>
          {assignedSection}
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.stickyBottomBar,
          {
            paddingBottom: Math.max(insets.bottom, SPACING.sm),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.primaryCtaButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ShippingList')}
        >
          <Ionicons name="list-outline" size={18} color={COLORS.white} />
          <Text style={styles.primaryCtaButtonText}>
            {t('shipperHome.openShippingList', { defaultValue: 'Open shipping list' })}
          </Text>
        </TouchableOpacity>
      </View>

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

            {actionType === 'mark-delivered' || actionType === 'mark-delivery-failed' ? (
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
    backgroundColor: '#F6F8F6',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  headerPlaceholder: {
    width: 36,
    height: 36,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  sectionLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: '#E9FBEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMeta: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  profileNursery: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  profileContact: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.25)',
    backgroundColor: 'rgba(254, 252, 232, 0.9)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  lockBannerText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: '#854D0E',
    fontWeight: '600',
  },
  sectionLoaderWrap: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateWrap: {
    minHeight: 64,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyStateText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  orderCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -SPACING.md,
  },
  statusBadge: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray50,
  },
  orderCodeText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  infoTextMuted: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  itemPreviewRow: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemPreviewImage: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
  },
  itemPreviewImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemPreviewMeta: {
    flex: 1,
    gap: 4,
  },
  itemPreviewName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  itemPreviewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  itemPreviewPrice: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  qtyBadge: {
    borderRadius: RADIUS.full,
    backgroundColor: '#E8F7EF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  qtyBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: '#166534',
    fontWeight: '700',
  },
  moreItemsText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  detailButton: {
    marginTop: SPACING.xs,
    height: 34,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  detailButtonText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  lockHintText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: '#854D0E',
    fontWeight: '600',
  },
  actionRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  contactButton: {
    flex: 1,
    height: 38,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  contactButtonCompact: {
    flex: 0.95,
  },
  contactButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    height: 38,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  primaryButtonHighlight: {
    backgroundColor: '#16A34A',
  },
  primaryButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: '700',
  },
  failureButton: {
    flex: 1,
    height: 38,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  failureButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: '700',
  },
  errorBanner: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(185, 28, 28, 0.28)',
    backgroundColor: 'rgba(254, 242, 242, 0.95)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  errorBannerText: {
    fontSize: FONTS.sizes.sm,
    color: '#991B1B',
    fontWeight: '600',
  },
  stickyBottomBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: 'rgba(246, 248, 246, 0.98)',
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  primaryCtaButton: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
  },
  primaryCtaButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
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
  paymentSummarySmall: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  paymentPill: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentPillRight: {},
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
  disabledButton: {
    opacity: 0.6,
  },
});
