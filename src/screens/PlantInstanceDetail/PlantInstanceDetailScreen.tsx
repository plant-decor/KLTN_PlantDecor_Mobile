import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SHADOWS, SPACING } from '../../constants';
import { RootStackParamList, CheckoutItem } from '../../types';
import { useAuthStore, useCartStore, useWishlistStore } from '../../stores';
import { plantService } from '../../services';
import { getWishlistKey, notify, resolveImageUris } from '../../utils';
import DetailImageGallery from '../../components/media/DetailImageGallery';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'PlantInstanceDetail'>;

const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = 396;
const ATTR_CARD_WIDTH = (width - SPACING.xl * 2 - 12) / 2;
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/600x400?text=Plant+Instance';

type AttributeCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
};

function AttributeCard({ icon, iconColor, iconBg, label, value }: AttributeCardProps) {
  return (
    <View style={styles.attrCard}>
      <View style={[styles.attrIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.attrTextWrap}>
        <Text style={styles.attrLabel}>{label}</Text>
        <Text style={styles.attrValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function PlantInstanceDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const insets = useSafeAreaInsets();
  const { plantInstanceId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const { isAuthenticated } = useAuthStore();
  const cartItemCount = useCartStore((state) => state.totalItems());

  const wishlistStatus = useWishlistStore((state) => state.statusByKey);
  const ensureWishlistStatus = useWishlistStore((state) => state.ensureStatus);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const [instanceDetail, setInstanceDetail] = useState<
    Awaited<ReturnType<typeof plantService.getPlantInstanceDetail>> | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  const contentLayerScrollY = useRef(new Animated.Value(0)).current;

  const wishlistItemId = instanceDetail?.id ?? plantInstanceId;
  const wishlistKey = getWishlistKey('PlantInstance', wishlistItemId);
  const isWishlisted = wishlistStatus[wishlistKey] ?? false;

  const contentLayerTranslateY = useMemo(
    () =>
      contentLayerScrollY.interpolate({
        inputRange: [0, IMAGE_HEIGHT - 24],
        outputRange: [0, -(IMAGE_HEIGHT - 24)],
        extrapolate: 'clamp',
      }),
    [contentLayerScrollY]
  );

  const contentInnerTranslateY = useMemo(
    () =>
      contentLayerScrollY.interpolate({
        inputRange: [0, IMAGE_HEIGHT - 24],
        outputRange: [0, IMAGE_HEIGHT - 24],
        extrapolate: 'clamp',
      }),
    [contentLayerScrollY]
  );

  const handleContentLayerScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: contentLayerScrollY } } }],
        { useNativeDriver: true }
      ),
    [contentLayerScrollY]
  );

  const requireAuth = useCallback(
    (onSuccess?: () => void): boolean => {
      if (isAuthenticated) {
        onSuccess?.();
        return true;
      }

      Alert.alert(
        t('common.loginRequiredTitle', { defaultValue: 'Login required' }),
        t('common.loginRequiredMessage', {
          defaultValue: 'Please login to continue.',
        }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('common.login', { defaultValue: 'Login' }),
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
      return false;
    },
    [isAuthenticated, navigation, t]
  );

  useEffect(() => {
    let isMounted = true;

    const loadInstanceDetail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await plantService.getPlantInstanceDetail(plantInstanceId);
        if (isMounted) {
          setInstanceDetail(payload);
        }
      } catch (loadError: any) {
        if (isMounted) {
          const apiMessage = loadError?.response?.data?.message;
          setError(
            typeof apiMessage === 'string' && apiMessage.trim().length > 0
              ? apiMessage
              : t('plantInstanceDetail.loadFailed', {
                  defaultValue: 'Unable to load plant instance details.',
                })
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInstanceDetail();

    return () => {
      isMounted = false;
    };
  }, [plantInstanceId, refreshKey, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void ensureWishlistStatus([
      {
        itemType: 'PlantInstance',
        itemId: wishlistItemId,
      },
    ]);
  }, [ensureWishlistStatus, isAuthenticated, wishlistItemId]);

  const heroImages = useMemo(() => {
    const resolved = resolveImageUris(instanceDetail?.images);
    return resolved.length > 0 ? resolved : [PLACEHOLDER_IMAGE];
  }, [instanceDetail?.images]);

  const primaryImageForCheckout = heroImages[0] ?? PLACEHOLDER_IMAGE;

  const isAvailable =
    (instanceDetail?.statusName || '').trim().toLowerCase() === 'available' ||
    instanceDetail?.status === 1;

  const nurseryAddress = useMemo(() => {
    if (typeof instanceDetail?.nurseryAddress !== 'string') {
      return null;
    }

    const trimmed = instanceDetail.nurseryAddress.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [instanceDetail?.nurseryAddress]);

  const nurseryPhone = useMemo(() => {
    if (typeof instanceDetail?.nurseryPhone !== 'string') {
      return null;
    }

    const trimmed = instanceDetail.nurseryPhone.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [instanceDetail?.nurseryPhone]);

  const bottomBarPaddingBottom = useMemo(
    () => Math.max(SPACING.lg, insets.bottom + SPACING.sm),
    [insets.bottom]
  );

  const bottomSpacerHeight = useMemo(
    () =>
      Math.max(
        (bottomBarHeight > 0 ? bottomBarHeight : 96) + SPACING.sm,
        120 + insets.bottom
      ),
    [bottomBarHeight, insets.bottom]
  );

  const handleBottomBarLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setBottomBarHeight((previousHeight) =>
      Math.abs(previousHeight - nextHeight) > 1 ? nextHeight : previousHeight
    );
  }, []);

  const handleToggleWishlist = useCallback(async () => {
    if (!requireAuth()) {
      return;
    }

    const wasInWishlist = wishlistStatus[wishlistKey] ?? false;

    try {
      await toggleWishlist('PlantInstance', wishlistItemId);
      notify({
        message: wasInWishlist
          ? t('wishlist.removeSuccess', { defaultValue: 'Removed from wishlist.' })
          : t('wishlist.addedMessage', { defaultValue: 'Added to wishlist.' }),
      });
    } catch (wishlistError: any) {
      notify({
        message:
          wishlistError?.response?.data?.message ||
          t('wishlist.actionFailed', {
            defaultValue: 'Wishlist action failed.',
          }),
      });
    }
  }, [requireAuth, t, toggleWishlist, wishlistItemId, wishlistKey, wishlistStatus]);

  const handleBuyNow = useCallback(() => {
    if (!requireAuth()) {
      return;
    }

    if (!instanceDetail) {
      return;
    }

    if (!isAvailable) {
      notify({
        message: t('plantInstanceDetail.unavailableMessage', {
          defaultValue: 'This plant instance is currently unavailable.',
        }),
      });
      return;
    }

    const checkoutItem: CheckoutItem = {
      id: `buy_now_instance_${instanceDetail.id}`,
      name: instanceDetail.plantName,
      size:
        instanceDetail.height != null
          ? `${instanceDetail.height} cm`
          : t('common.updating', { defaultValue: 'Updating' }),
      image: primaryImageForCheckout !== PLACEHOLDER_IMAGE ? primaryImageForCheckout : undefined,
      price: instanceDetail.specificPrice,
      quantity: 1,
      plantInstanceId: instanceDetail.id,
      isUniqueInstance: true,
    };

    setIsSubmitting(true);
    navigation.navigate('Checkout', {
      source: 'buy-now',
      items: [checkoutItem],
    });
    setIsSubmitting(false);
  }, [
    instanceDetail,
    isAvailable,
    navigation,
    primaryImageForCheckout,
    requireAuth,
    t,
  ]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setRefreshKey((current) => current + 1);
  }, [isRefreshing]);

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    if (!isLoading) {
      setIsRefreshing(false);
    }
  }, [isLoading, isRefreshing]);

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!instanceDetail || error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={54} color={COLORS.error} />
          <Text style={styles.errorTitle}>
            {t('plantInstanceDetail.title', { defaultValue: 'Plant instance detail' })}
          </Text>
          <Text style={styles.errorText}>
            {error ||
              t('plantInstanceDetail.notFound', {
                defaultValue: 'Plant instance not found.',
              })}
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryText}>{t('common.goBack', { defaultValue: 'Go back' })}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.heroWrap}>
        <DetailImageGallery
          images={heroImages}
          height={IMAGE_HEIGHT}
          placeholderIcon="leaf-outline"
        />
      </View>

      <View style={styles.heroOverlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#0D1B12" />
        </TouchableOpacity>

        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.heartBtn} onPress={() => void handleToggleWishlist()}>
            <Ionicons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={20}
              color={isWishlisted ? COLORS.error : COLORS.white}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => requireAuth(() => navigation.navigate('Cart'))}
          >
            <Ionicons name="cart-outline" size={20} color={COLORS.white} />
            {cartItemCount > 0 ? <View style={styles.cartDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View
        style={[
          styles.scrollLayer,
          {
            transform: [{ translateY: contentLayerTranslateY }],
          },
        ]}
      >
        <Animated.ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleContentLayerScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
        <Animated.View
          style={{
            transform: [{ translateY: contentInnerTranslateY }],
          }}
        >
        <View style={styles.contentCard}>
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.nameRow}>
            <View style={styles.nameWrap}>
              <Text style={styles.name}>{instanceDetail.plantName}</Text>
              <Text style={styles.code}>{instanceDetail.sku}</Text>
            </View>
            <View style={styles.titleBadge}>
              <Ionicons name="git-commit-outline" size={14} color="#14532D" />
              <Text style={styles.titleBadgeText}>
                {t('catalog.typePlantInstance', { defaultValue: 'Instance' })}
              </Text>
            </View>
          </View>

          <Text style={styles.price}>{`${instanceDetail.specificPrice.toLocaleString(locale)}₫`}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Ionicons name="business-outline" size={14} color="#4C9A66" />
              <Text style={styles.metaBadgeText}>{instanceDetail.nurseryName}</Text>
            </View>
            <View style={[styles.metaBadge, !isAvailable && styles.metaBadgeDanger]}>
              <Ionicons
                name={isAvailable ? 'checkmark-circle-outline' : 'close-circle-outline'}
                size={14}
                color={isAvailable ? '#4C9A66' : '#B91C1C'}
              />
              <Text style={styles.metaBadgeText}>{instanceDetail.statusName}</Text>
            </View>
          </View>

          <View style={styles.nurseryInfoCard}>
            <Text style={styles.nurseryInfoTitle}>
              {t('plantInstanceDetail.nurseryInfo', {
                defaultValue: 'Nursery information',
              })}
            </Text>

            <View style={styles.nurseryInfoRow}>
              <Ionicons name="business-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.nurseryInfoLabel}>
                {t('plantInstanceDetail.nursery', { defaultValue: 'Nursery' })}:
              </Text>
              <Text style={styles.nurseryInfoValue}>
                {instanceDetail.nurseryName || t('common.updating', { defaultValue: 'Updating' })}
              </Text>
            </View>

            <View style={styles.nurseryInfoRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.nurseryInfoLabel}>
                {t('plantInstanceDetail.nurseryAddress', {
                  defaultValue: 'Address',
                })}
                :
              </Text>
              <Text style={styles.nurseryInfoValue}>
                {nurseryAddress || t('common.updating', { defaultValue: 'Updating' })}
              </Text>
            </View>

            <View style={styles.nurseryInfoRow}>
              <Ionicons name="call-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.nurseryInfoLabel}>
                {t('plantInstanceDetail.nurseryPhone', {
                  defaultValue: 'Phone',
                })}
                :
              </Text>
              <Text style={styles.nurseryInfoValue}>
                {nurseryPhone || t('common.updating', { defaultValue: 'Updating' })}
              </Text>
            </View>
          </View>

          <Text style={styles.description}>
            {instanceDetail.description ||
              t('common.updating', { defaultValue: 'Updating' })}
          </Text>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {t('plantInstanceDetail.highlights', {
                defaultValue: 'Instance highlights',
              })}
            </Text>
            <View style={styles.attrGrid}>
              <AttributeCard
                icon="pulse-outline"
                iconColor="#15803D"
                iconBg="#DCFCE7"
                label={t('plantInstanceDetail.healthStatus', { defaultValue: 'Health status' })}
                value={
                  instanceDetail.healthStatus ||
                  t('common.updating', { defaultValue: 'Updating' })
                }
              />
              <AttributeCard
                icon="resize-outline"
                iconColor="#B45309"
                iconBg="#FEF3C7"
                label={t('plantInstanceDetail.height', { defaultValue: 'Height' })}
                value={
                  instanceDetail.height != null
                    ? `${instanceDetail.height} cm`
                    : t('common.updating', { defaultValue: 'Updating' })
                }
              />
              <AttributeCard
                icon="ellipse-outline"
                iconColor="#1D4ED8"
                iconBg="#DBEAFE"
                label={t('plantInstanceDetail.trunkDiameter', {
                  defaultValue: 'Trunk diameter',
                })}
                value={
                  instanceDetail.trunkDiameter != null
                    ? `${instanceDetail.trunkDiameter} mm`
                    : t('common.updating', { defaultValue: 'Updating' })
                }
              />
              <AttributeCard
                icon="hourglass-outline"
                iconColor="#0E7490"
                iconBg="#CFFAFE"
                label={t('plantInstanceDetail.age', { defaultValue: 'Age' })}
                value={
                  instanceDetail.age != null
                    ? t('plantInstanceDetail.ageMonth', {
                        defaultValue: '{{count}} months',
                        count: instanceDetail.age,
                      })
                    : t('common.updating', { defaultValue: 'Updating' })
                }
              />
            </View>
          </View>

          <View style={[styles.bottomSpacer, { height: bottomSpacerHeight }]} />
        </View>
        </Animated.View>
        </Animated.ScrollView>
      </Animated.View>

      <View
        style={[styles.bottomBar, { paddingBottom: bottomBarPaddingBottom }]}
        onLayout={handleBottomBarLayout}
      >
        <TouchableOpacity
          style={[styles.buyNowBtn, (!isAvailable || isSubmitting) && styles.buyNowBtnDisabled]}
          disabled={!isAvailable || isSubmitting}
          onPress={handleBuyNow}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#102216" />
          ) : (
            <Text style={styles.buyNowText}>
              {t('plantDetail.buyNow', { defaultValue: 'Buy now' })}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F6',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F8F6',
    paddingHorizontal: SPACING.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#F6F8F6',
    paddingHorizontal: SPACING.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0D1B12',
  },
  errorText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: '#13EC5B',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
  },
  retryText: {
    color: '#102216',
    fontWeight: '700',
  },
  heroWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: IMAGE_HEIGHT,
    backgroundColor: COLORS.gray200,
    zIndex: 1,
    elevation: 1,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 6,
    elevation: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  scrollLayer: {
    ...StyleSheet.absoluteFillObject,
    top: IMAGE_HEIGHT - 24,
    overflow: 'visible',
    zIndex: 3,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
    overflow: 'visible',
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  contentCard: {
    backgroundColor: '#F6F8F6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 32,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 0,
  },
  dragHandleWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dragHandle: {
    width: 48,
    height: 4,
    borderRadius: 9999,
    backgroundColor: '#D1D5DB',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  nameWrap: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 30,
  },
  code: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  titleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#14532D',
  },
  price: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '700',
    color: '#13EC5B',
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E7F3EB',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaBadgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4C9A66',
  },
  nurseryInfoCard: {
    marginTop: SPACING.sm,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    backgroundColor: '#F8FFF9',
    gap: 6,
  },
  nurseryInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532D',
  },
  nurseryInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  nurseryInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  nurseryInfoValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#0D1B12',
    lineHeight: 17,
  },
  description: {
    marginTop: SPACING.lg,
    fontSize: 16,
    fontWeight: '400',
    color: '#4B5563',
    lineHeight: 26,
  },
  sectionWrap: {
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 28,
  },
  attrGrid: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attrCard: {
    width: ATTR_CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    ...SHADOWS.sm,
  },
  attrIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attrTextWrap: {
    flex: 1,
    flexShrink: 1,
  },
  attrLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 4,
  },
  attrValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1B12',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 104,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    paddingBottom: SPACING.lg,
    zIndex: 3,
    elevation: 3,
    gap: 10,
  },
  buyNowBtn: {
    borderRadius: 24,
    borderWidth: 0,
    backgroundColor: '#13EC5B',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyNowBtnDisabled: {
    opacity: 0.45,
  },
  buyNowText: {
    fontSize: 16,
    color: '#102216',
    fontWeight: '700',
  },
});
