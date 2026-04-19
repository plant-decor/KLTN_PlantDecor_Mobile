import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { orderService } from '../../services';
import { useAuthStore } from '../../stores';
import {
  OrderLineItem,
  OrderNursery,
  RootStackParamList,
  ShipperNurseryOrderDetailPayload,
} from '../../types';
import {
  getOrderStatusColors,
  getOrderStatusLabel,
  notify,
  parseDeliveryNoteWithImage,
  resolveImageUri,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShipperOrderDetail'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'ShipperOrderDetail'>;
type ShipperActionType = 'start-shipping' | 'mark-delivered' | 'mark-delivery-failed';
type SelectedDeliveryImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

const SHIPPING_STATUS = 4;

const buildOrderCode = (id: number): string => `DH-${String(id).padStart(4, '0')}`;

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const isAssignedStatus = (statusName: string): boolean => normalizeToken(statusName).includes('assign');

const isShippingStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('ship') && !token.includes('deliver');
};

const canStartShipping = (statusName: string): boolean => isAssignedStatus(statusName);

const canMarkDelivered = (statusName: string): boolean => isShippingStatus(statusName);

const canMarkDeliveryFailed = (statusName: string): boolean => isShippingStatus(statusName);

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

export default function ShipperOrderDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { orderId, nurseryOrderId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [order, setOrder] = useState<ShipperNurseryOrderDetailPayload | null>(null);
  const [activeShippingOrder, setActiveShippingOrder] = useState<OrderNursery | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState<ShipperActionType | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderNursery | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [selectedDeliveryImage, setSelectedDeliveryImage] = useState<SelectedDeliveryImage | null>(null);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState<number | null>(null);

  const formatCurrency = useCallback(
    (value: number) => `${(value || 0).toLocaleString(locale)}đ`,
    [locale]
  );

  const loadDetail = useCallback(
    async (options?: { refresh?: boolean; background?: boolean }) => {
      if (!isAuthenticated) {
        return;
      }

      const isBackground = options?.background === true;

      if (!isBackground) {
        if (options?.refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
      }

      try {
        setErrorMessage(null);

        const detailId = nurseryOrderId ?? orderId;

        const [detailPayload, shippingPayload] = await Promise.all([
          orderService.getShipperNurseryOrderDetail(detailId),
          orderService.getNurseryOrders({
            status: SHIPPING_STATUS,
            pageNumber: 1,
            pageSize: 1,
          }),
        ]);

        setOrder(detailPayload);
        setActiveShippingOrder(shippingPayload.items[0] ?? null);
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        setErrorMessage(
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('shipperOrderDetail.loadFailed', {
                defaultValue: 'Unable to load shipping order detail. Please try again.',
              })
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAuthenticated, nurseryOrderId, orderId, t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return;
      }

      void loadDetail();
    }, [isAuthenticated, loadDetail])
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

  const openActionModal = useCallback(
    (targetOrder: OrderNursery, nextAction: ShipperActionType) => {
      if (
        nextAction === 'start-shipping' &&
        activeShippingOrder &&
        activeShippingOrder.id !== targetOrder.id
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

      setSelectedOrder(targetOrder);
      setActionType(nextAction);
      if (nextAction === 'start-shipping') {
        setActionNote(targetOrder.shipperNote || '');
      } else {
        const parsedDelivery = parseDeliveryNoteWithImage(targetOrder.deliveryNote);
        setActionNote(parsedDelivery.note || '');
      }
      setSelectedDeliveryImage(null);
      setModalVisible(true);
    },
    [activeShippingOrder, t]
  );

  const submitAction = useCallback(async () => {
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
      if (actionType === 'start-shipping') {
        await orderService.startShipping(selectedOrder.id, {
          shipperNote: trimmedNote,
        });
      } else if (actionType === 'mark-delivered') {
        await orderService.markDelivered(selectedOrder.id, {
          deliveryNote: trimmedNote,
          deliveryImage: selectedDeliveryImage!,
        });
      } else {
        await orderService.markDeliveryFailed(selectedOrder.id, {
          failureReason: trimmedNote,
        });
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

      closeActionModal();
      void loadDetail({ background: true });
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
    activeShippingOrder,
    closeActionModal,
    loadDetail,
    selectedDeliveryImage,
    selectedOrder,
    t,
  ]);

  const handleContact = useCallback(
    (targetOrder: OrderNursery) => {
      notify({
        message: t('shippingList.contactInfo', {
          defaultValue: 'Contact nursery {{nurseryName}} to coordinate delivery.',
          nurseryName: targetOrder.nurseryName,
        }),
      });
    },
    [t]
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerStateWrap}>
          <Ionicons name="person-circle-outline" size={76} color={COLORS.gray300} />
          <Text style={styles.centerTitle}>
            {t('common.loginRequiredTitle', { defaultValue: 'Login required' })}
          </Text>
          <Text style={styles.centerSubtitle}>
            {t('common.loginRequiredMessage', {
              defaultValue: 'Please login to continue.',
            })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerStateWrap}>
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
          title={t('shipperOrderDetail.title', {
            defaultValue: 'Shipping order detail',
          })}
          left={
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          }
          right={<View style={styles.headerPlaceholder} />}
          brandVariant="none"
        />

        <View style={styles.centerStateWrap}>
          <Ionicons name="alert-circle-outline" size={70} color={COLORS.gray300} />
          <Text style={styles.centerTitle}>
            {t('shipperOrderDetail.emptyTitle', { defaultValue: 'Shipping order not found' })}
          </Text>
          <Text style={styles.centerSubtitle}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              void loadDetail();
            }}
          >
            <Text style={styles.retryButtonText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayedStatusName = order.statusName;
  const statusColors = getOrderStatusColors(displayedStatusName);

  const canShowStart = canStartShipping(order.statusName);
  const canShowDelivered = canMarkDelivered(order.statusName);
  const canShowDeliveryFailed = canMarkDeliveryFailed(order.statusName);
  const isActionLoading = processingOrderId === order.id;
  const totalUnits = order.items.reduce((sum, lineItem) => sum + Math.max(0, lineItem.quantity || 0), 0);
  const parsedDelivery = parseDeliveryNoteWithImage(order.deliveryNote);
  const isStartBlocked =
    canShowStart &&
    Boolean(activeShippingOrder) &&
    activeShippingOrder?.id !== order.id;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={44}
        title={t('shipperOrderDetail.title', {
          defaultValue: 'Shipping order detail',
        })}
        left={
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
        right={<View style={styles.headerPlaceholder} />}
        brandVariant="none"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadDetail({ refresh: true })}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('shipperOrderDetail.orderInformation', {
              defaultValue: 'Order information',
            })}
          </Text>

          <View style={styles.topRow}>
            <Text style={styles.orderCodeText}>
              {t('shippingList.orderCode', {
                defaultValue: 'Order #{{code}}',
                code: buildOrderCode(order.id),
              })}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusColors.backgroundColor,
                },
              ]}
            >
              <Text style={[styles.statusBadgeText, { color: statusColors.textColor }]}>
                {getOrderStatusLabel(displayedStatusName, t)}
              </Text>
            </View>
          </View>

          <Text style={styles.metaText}>
            {t('shipperOrderDetail.parentOrderCode', {
              defaultValue: 'Parent order: {{code}}',
              code: buildOrderCode(order.orderId),
            })}
          </Text>
          <Text style={styles.metaText}>
            {t('shipperOrderDetail.nurseryOrderCode', {
              defaultValue: 'Nursery order: {{code}}',
              code: buildOrderCode(order.id),
            })}
          </Text>
          <Text style={styles.metaText}>
            {t('shipperOrderDetail.nurseryLabel', {
              defaultValue: 'Nursery: {{name}}',
              name: order.nurseryName,
            })}
          </Text>
          <Text style={styles.metaText}>
            {t('shippingList.subTotal', { defaultValue: 'Sub total' })}: {formatCurrency(order.subTotalAmount)}
          </Text>
          <Text style={styles.metaText}>
            {t('shipperOrderDetail.totalUnits', {
              defaultValue: 'Total units: {{count}}',
              count: totalUnits,
            })}
          </Text>
        </View>

        {activeShippingOrder && activeShippingOrder.id !== order.id ? (
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('orderDetail.receiver', { defaultValue: 'Receiver information' })}</Text>
          <Text style={styles.metaText}>
            {t('shipperOrderDetail.customerId', {
              defaultValue: 'Customer ID: {{id}}',
              id: order.customerId,
            })}
          </Text>

          <View style={styles.receiverFieldRow}>
            <Text style={styles.receiverFieldLabel}>
              {t('shipperOrderDetail.receiverNameLabel', {
                defaultValue: 'Name',
              })}
            </Text>
            <Text style={styles.receiverFieldValue}>{order.customerName || '--'}</Text>
          </View>

          <View style={styles.receiverFieldRow}>
            <Text style={styles.receiverFieldLabel}>
              {t('shipperOrderDetail.receiverPhoneLabel', {
                defaultValue: 'Phone',
              })}
            </Text>
            <Text style={styles.receiverFieldValue}>{order.customerPhone || '--'}</Text>
          </View>

          <View style={styles.receiverFieldRow}>
            <Text style={styles.receiverFieldLabel}>
              {t('shipperOrderDetail.receiverEmailLabel', {
                defaultValue: 'Email',
              })}
            </Text>
            <Text style={styles.receiverFieldValue}>
              {order.customerEmail ||
                t('shipperOrderDetail.notAvailable', {
                  defaultValue: 'Not available',
                })}
            </Text>
          </View>

          <View style={styles.receiverFieldRow}>
            <Text style={styles.receiverFieldLabel}>
              {t('shipperOrderDetail.receiverAddressLabel', {
                defaultValue: 'Address',
              })}
            </Text>
            <Text style={styles.receiverFieldValue}>{order.customerAddress || '--'}</Text>
          </View>

          {order.note ? (
            <Text style={styles.noteText}>
              {t('orderDetail.note', { defaultValue: 'Note' })}: {order.note}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('orderDetail.items', { defaultValue: 'Items' })}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={16} color={COLORS.primary} />
            <Text style={styles.infoText} numberOfLines={1}>
              {order.nurseryName}
            </Text>
            <Text style={styles.priceText}>{formatCurrency(order.subTotalAmount)}</Text>
          </View>

          {order.items.map((lineItem) => {
            const imageUri = resolveLineItemImage(lineItem);
            return (
              <View key={`shipper-detail-${order.id}-${lineItem.id}`} style={styles.lineItemRow}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.lineItemImage} resizeMode="cover" />
                ) : (
                  <View style={styles.lineItemImagePlaceholder}>
                    <Ionicons name="image-outline" size={16} color={COLORS.gray500} />
                  </View>
                )}

                <View style={styles.lineItemBody}>
                  <Text style={styles.lineItemName} numberOfLines={2}>
                    {lineItem.itemName}
                  </Text>

                  <View style={styles.lineItemMetaRow}>
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyBadgeText}>
                        {t('shippingList.qtyLabel', {
                          defaultValue: 'Qty {{count}}',
                          count: lineItem.quantity,
                        })}
                      </Text>
                    </View>

                    <Text style={styles.priceText}>{formatCurrency(lineItem.price)}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.noteWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={COLORS.gray600} />
            <Text style={styles.noteContent} numberOfLines={3}>
              {parsedDelivery.note ||
                order.shipperNote ||
                t('shippingList.noShipperNote', { defaultValue: 'No shipper note yet.' })}
            </Text>
          </View>

          {parsedDelivery.deliveryImageUrl ? (
            <View style={styles.noteDeliveryImageWrap}>
              <Text style={styles.noteDeliveryImageLabel}>
                {t('shippingList.deliveryImageLabel', {
                  defaultValue: 'Delivery image',
                })}
              </Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setPreviewImageUri(parsedDelivery.deliveryImageUrl)}
              >
                <Image
                  source={{ uri: parsedDelivery.deliveryImageUrl }}
                  style={styles.noteDeliveryImagePreview}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            </View>
          ) : null}

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
              onPress={() => handleContact(order)}
              disabled={isActionLoading}
            >
              <Ionicons name="call-outline" size={15} color={COLORS.textPrimary} />
              <Text style={styles.contactButtonText}>
                {t('shippingList.contact', { defaultValue: 'Contact' })}
              </Text>
            </TouchableOpacity>

            {canShowStart ? (
              <TouchableOpacity
                style={[styles.primaryButton, (isStartBlocked || isActionLoading) && styles.disabledButton]}
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
            ) : null}

            {canShowDelivered ? (
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
            ) : null}

            {canShowDeliveryFailed ? (
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
            ) : null}
          </View>
        </View>

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
    backgroundColor: '#F6F8F6',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPlaceholder: {
    width: 36,
    height: 36,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['3xl'],
    gap: SPACING.md,
  },
  centerStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING['2xl'],
  },
  centerTitle: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  centerSubtitle: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  orderCodeText: {
    flex: 1,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
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
  metaText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
  receiverFieldRow: {
    marginTop: SPACING.sm,
  },
  receiverFieldLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  receiverFieldValue: {
    marginTop: 2,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
    lineHeight: 20,
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
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  noteText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  lineItemRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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
  priceText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  noteWrap: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  noteContent: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    lineHeight: 20,
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
    height: 140,
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
  lockHintText: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: '#854D0E',
    fontWeight: '600',
  },
  emptyInlineText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  actionRow: {
    marginTop: SPACING.md,
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
  disabledButton: {
    opacity: 0.6,
  },
});
