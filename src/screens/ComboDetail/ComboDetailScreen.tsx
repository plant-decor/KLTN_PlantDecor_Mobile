import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
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
import { COLORS, FONTS, SHADOWS, SPACING } from '../../constants';
import { CheckoutItem, RootStackParamList, ShopSearchComboSummary } from '../../types';
import { useAuthStore, useWishlistStore } from '../../stores';
import { cartService, plantService } from '../../services';
import { getWishlistKey, notify } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'ComboDetail'>;

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/600x400?text=Combo';
const IMAGE_HEIGHT = 396;
const ATTR_CARD_WIDTH = (Dimensions.get('window').width - SPACING.xl * 2 - 12) / 2;
const RELATED_CARD_WIDTH = 196;
const RELATED_CARD_GAP = 16;
const RELATED_IMAGE_HEIGHT = 210;

type AttributeProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
};

function AttributeCard({ icon, iconColor, iconBg, label, value }: AttributeProps) {
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

export default function ComboDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { comboId, nurseryPlantComboId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthStore();

  const wishlistStatus = useWishlistStore((state) => state.statusByKey);
  const ensureStatus = useWishlistStore((state) => state.ensureStatus);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const [combo, setCombo] = useState<
    Awaited<ReturnType<typeof plantService.getPlantComboDetail>> | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relatedCombos, setRelatedCombos] = useState<ShopSearchComboSummary[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [relatedListWidth, setRelatedListWidth] = useState(0);
  const [relatedContentWidth, setRelatedContentWidth] = useState(0);
  const [relatedScrollX, setRelatedScrollX] = useState(0);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);

  const wishlistItemId = comboId;
  const wishlistKey = getWishlistKey('PlantCombo', wishlistItemId);

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

    const loadCombo = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await plantService.getPlantComboDetail(comboId);
        if (isMounted) {
          setCombo(payload);
        }
      } catch (loadError: any) {
        if (isMounted) {
          setError(
            loadError?.response?.data?.message ||
              t('comboDetail.loadFailed', {
                defaultValue: 'Unable to load combo details.',
              })
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCombo();

    return () => {
      isMounted = false;
    };
  }, [comboId, t]);

  useEffect(() => {
    setQuantity(1);
  }, [comboId]);

  useEffect(() => {
    if (!combo) {
      setRelatedCombos([]);
      setRelatedScrollX(0);
      setRelatedContentWidth(0);
      return;
    }

    let isMounted = true;

    const extractCombos = (items: Awaited<ReturnType<typeof plantService.searchShop>>['items']['items']) => {
      const map = new Map<number, ShopSearchComboSummary>();

      items.forEach((entry) => {
        if (entry.type !== 'Combo' || !entry.combo) {
          return;
        }

        if (!map.has(entry.combo.id)) {
          map.set(entry.combo.id, entry.combo);
        }
      });

      return Array.from(map.values());
    };

    const loadRelatedCombos = async () => {
      setIsLoadingRelated(true);

      try {
        const primaryPayload = await plantService.searchShop({
          pagination: {
            pageNumber: 1,
            pageSize: 24,
          },
          keyword: combo.comboName,
          includePlants: false,
          includeMaterials: false,
          includeCombos: true,
          sortBy: 'CreatedAt',
          sortDirection: 'Desc',
        });

        let merged = extractCombos(primaryPayload.items.items);

        if (merged.length < 6) {
          const fallbackPayload = await plantService.searchShop({
            pagination: {
              pageNumber: 1,
              pageSize: 24,
            },
            includePlants: false,
            includeMaterials: false,
            includeCombos: true,
            sortBy: 'CreatedAt',
            sortDirection: 'Desc',
          });

          const combinedMap = new Map<number, ShopSearchComboSummary>();
          [...merged, ...extractCombos(fallbackPayload.items.items)].forEach((entry) => {
            if (!combinedMap.has(entry.id)) {
              combinedMap.set(entry.id, entry);
            }
          });

          merged = Array.from(combinedMap.values());
        }

        if (isMounted) {
          setRelatedCombos(merged.filter((entry) => entry.id !== comboId).slice(0, 6));
        }
      } catch {
        if (isMounted) {
          setRelatedCombos([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingRelated(false);
        }
      }
    };

    void loadRelatedCombos();

    return () => {
      isMounted = false;
    };
  }, [combo, comboId]);

  const wishlistTargets = useMemo(() => {
    const uniqueIds = Array.from(
      new Set(
        [wishlistItemId, ...relatedCombos.map((entry) => entry.id)].filter(
          (itemId) => Number.isInteger(itemId) && itemId > 0
        )
      )
    );

    return uniqueIds.map((itemId) => ({
      itemType: 'PlantCombo' as const,
      itemId,
    }));
  }, [relatedCombos, wishlistItemId]);

  useEffect(() => {
    if (!isAuthenticated || wishlistTargets.length === 0) {
      return;
    }

    void ensureStatus(wishlistTargets);
  }, [ensureStatus, isAuthenticated, wishlistTargets]);

  const isWishlisted = wishlistStatus[wishlistKey] ?? false;

  const imageUrl = useMemo(() => combo?.images?.[0] || PLACEHOLDER_IMAGE, [combo?.images]);
  const hasMoreRelatedItems = relatedCombos.length > 1;
  const showRelatedArrowLeft = relatedScrollX > 4;
  const showRelatedArrowRight = hasMoreRelatedItems
    ? relatedContentWidth === 0 || relatedContentWidth - relatedListWidth - relatedScrollX > 4
    : false;
  const bottomBarPaddingBottom = useMemo(
    () => Math.max(SPACING.lg, insets.bottom + SPACING.sm),
    [insets.bottom]
  );
  const bottomSpacerHeight = useMemo(
    () =>
      Math.max(
        (bottomBarHeight > 0 ? bottomBarHeight : 112) + SPACING.sm,
        120 + insets.bottom
      ),
    [bottomBarHeight, insets.bottom]
  );
  const formatMoney = useCallback(
    (value: number) => `${Math.max(0, value).toLocaleString(locale)}₫`,
    [locale]
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
      await toggleWishlist('PlantCombo', wishlistItemId);
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

  const handleToggleRelatedWishlist = useCallback(
    async (relatedComboId: number) => {
      if (!requireAuth()) {
        return;
      }

      const relatedWishlistKey = getWishlistKey('PlantCombo', relatedComboId);
      const wasInWishlist = wishlistStatus[relatedWishlistKey] ?? false;

      try {
        await toggleWishlist('PlantCombo', relatedComboId);
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
    },
    [requireAuth, t, toggleWishlist, wishlistStatus]
  );

  const handleOpenComboPlant = useCallback(
    (plantId: number | null | undefined) => {
      if (!plantId || plantId <= 0) {
        return;
      }

      navigation.push('PlantDetail', {
        plantId: String(plantId),
      });
    },
    [navigation]
  );

  const handleOpenRelatedCombo = useCallback(
    (relatedComboId: number) => {
      navigation.push('ComboDetail', {
        comboId: relatedComboId,
        nurseryPlantComboId: relatedComboId,
      });
    },
    [navigation]
  );

  const handleAddToCart = useCallback(async () => {
    if (!requireAuth()) {
      return;
    }

    const resolvedNurseryPlantComboId = nurseryPlantComboId ?? combo?.id ?? wishlistItemId;

    if (!resolvedNurseryPlantComboId) {
      notify({
        message: t('checkout.invalidCheckoutItems', {
          defaultValue: 'Cannot resolve buy now item for order creation.',
        }),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await cartService.addCartItem({
        commonPlantId: null,
        nurseryPlantComboId: resolvedNurseryPlantComboId,
        nurseryMaterialId: null,
        quantity: Math.max(1, quantity),
      });

      notify({
        message: t('cart.addedMessage', { defaultValue: 'Added to cart.' }),
      });
    } catch (cartError: any) {
      notify({
        message:
          cartError?.response?.data?.message ||
          t('cart.addFailed', { defaultValue: 'Unable to add to cart.' }),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [combo?.id, nurseryPlantComboId, quantity, requireAuth, t, wishlistItemId]);

  const handleBuyNow = useCallback(() => {
    if (!requireAuth() || !combo) {
      return;
    }

    const buyNowItemId = nurseryPlantComboId ?? combo.id ?? comboId;

    if (!buyNowItemId) {
      notify({
        message: t('checkout.invalidCheckoutItems', {
          defaultValue: 'Cannot resolve buy now item for order creation.',
        }),
        useAlert: true,
      });
      return;
    }

    const checkoutItem: CheckoutItem = {
      id: `buy_now_combo_${buyNowItemId}`,
      name: combo.comboName,
      image: combo.images?.[0] ?? undefined,
      price: combo.comboPrice,
      quantity: Math.max(1, quantity),
      buyNowItemId,
      buyNowItemTypeName: 'NurseryPlantCombo',
      isUniqueInstance: false,
    };

    navigation.navigate('Checkout', {
      source: 'buy-now',
      items: [checkoutItem],
    });
  }, [combo, comboId, navigation, nurseryPlantComboId, quantity, requireAuth, t]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!combo || error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={54} color={COLORS.error} />
          <Text style={styles.errorTitle}>{t('comboDetail.title', { defaultValue: 'Combo detail' })}</Text>
          <Text style={styles.errorText}>
            {error ||
              t('comboDetail.notFound', {
                defaultValue: 'Combo not found.',
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
        <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
      </View>

      <View style={styles.heroOverlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#0D1B12" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => void handleToggleWishlist()}>
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={20}
            color={isWishlisted ? COLORS.error : COLORS.white}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.contentCard}>
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.nameRow}>
            <View style={styles.nameWrap}>
              <Text style={styles.name}>{combo.comboName}</Text>
              <Text style={styles.code}>{combo.comboCode}</Text>
            </View>
            <View style={styles.titleBadge}>
              <Ionicons name="albums-outline" size={14} color="#14532D" />
              <Text style={styles.titleBadgeText}>{t('catalog.typeCombo', { defaultValue: 'Combo' })}</Text>
            </View>
          </View>

          <Text style={styles.price}>{formatMoney(combo.comboPrice)}</Text>

          <View style={styles.metaRow}>
            {combo.comboTypeName ? (
              <View style={styles.metaBadge}>
                <Ionicons name="layers-outline" size={14} color="#4C9A66" />
                <Text style={styles.metaBadgeText}>{combo.comboTypeName}</Text>
              </View>
            ) : null}
            {combo.seasonName ? (
              <View style={styles.metaBadge}>
                <Ionicons name="sunny-outline" size={14} color="#4C9A66" />
                <Text style={styles.metaBadgeText}>{combo.seasonName}</Text>
              </View>
            ) : null}
            <View style={styles.metaBadge}>
              <Ionicons
                name={combo.petSafe ? 'paw-outline' : 'warning-outline'}
                size={14}
                color={combo.petSafe ? '#4C9A66' : '#B91C1C'}
              />
              <Text style={styles.metaBadgeText}>
                {combo.petSafe
                  ? t('comboDetail.petSafe', { defaultValue: 'Pet safe' })
                  : t('comboDetail.petUnsafe', { defaultValue: 'Pet caution' })}
              </Text>
            </View>
          </View>

          <Text style={styles.description}>{combo.description || '-'}</Text>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {t('comboDetail.highlights', { defaultValue: 'Combo highlights' })}
            </Text>
            <View style={styles.attrGrid}>
              <AttributeCard
                icon="layers-outline"
                iconColor="#15803D"
                iconBg="#DCFCE7"
                label={t('comboDetail.type', { defaultValue: 'Type' })}
                value={combo.comboTypeName || '-'}
              />
              <AttributeCard
                icon="sunny-outline"
                iconColor="#B45309"
                iconBg="#FEF3C7"
                label={t('comboDetail.season', { defaultValue: 'Season' })}
                value={combo.seasonName || '-'}
              />
              <AttributeCard
                icon="home-outline"
                iconColor="#1D4ED8"
                iconBg="#DBEAFE"
                label={t('comboDetail.suitableSpace', { defaultValue: 'Suitable space' })}
                value={combo.suitableSpace || '-'}
              />
              <AttributeCard
                icon="leaf-outline"
                iconColor="#0E7490"
                iconBg="#CFFAFE"
                label={t('comboDetail.fengShui', { defaultValue: 'Feng Shui' })}
                value={combo.fengShuiPurpose || '-'}
              />
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{t('comboDetail.theme', { defaultValue: 'Theme' })}</Text>
            <View style={styles.themeCard}>
              <Text style={styles.themeTitle}>{combo.themeName || '-'}</Text>
              <Text style={styles.themeDescription}>{combo.themeDescription || '-'}</Text>
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{t('comboDetail.items', { defaultValue: 'Combo items' })}</Text>
            <View style={styles.includedList}>
              {combo.comboItems.length > 0 ? (
                combo.comboItems.map((item) => {
                  const canOpenPlantDetail = Number.isInteger(item.plantId) && item.plantId > 0;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.includedItem, !canOpenPlantDetail && styles.includedItemDisabled]}
                      activeOpacity={canOpenPlantDetail ? 0.82 : 1}
                      disabled={!canOpenPlantDetail}
                      onPress={() => handleOpenComboPlant(item.plantId)}
                    >
                      <View style={styles.includedHeader}>
                        <View style={styles.includedDot} />
                        <Text style={styles.includedName}>{item.plantName}</Text>
                        <Text style={styles.includedQty}>x{Math.max(1, item.quantity)}</Text>
                        <Ionicons
                          name={canOpenPlantDetail ? 'chevron-forward' : 'ban-outline'}
                          size={16}
                          color={canOpenPlantDetail ? '#15803D' : COLORS.textSecondary}
                        />
                      </View>
                      {item.notes ? <Text style={styles.includedNotes}>{item.notes}</Text> : null}
                      <Text
                        style={canOpenPlantDetail ? styles.includedHint : styles.includedUnavailable}
                      >
                        {canOpenPlantDetail
                          ? t('comboDetail.viewPlantDetail', { defaultValue: 'View plant details' })
                          : t('comboDetail.plantUnavailable', {
                              defaultValue: 'Plant details unavailable',
                            })}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>-</Text>
              )}
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{t('comboDetail.tags', { defaultValue: 'Tags' })}</Text>
            {combo.tagsNavigation.length > 0 ? (
              <View style={styles.tagsContainer}>
                {combo.tagsNavigation.map((tag) => (
                  <View key={tag.id} style={styles.tagBadge}>
                    <Text style={styles.tagText}>{tag.tagName}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>-</Text>
            )}
          </View>

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {t('plantDetail.youMayAlsoLike', { defaultValue: 'You may also like' })}
            </Text>
            {isLoadingRelated ? (
              <View style={styles.relatedLoaderWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : relatedCombos.length > 0 ? (
              <View
                style={styles.relatedSliderWrap}
                onLayout={(event) => setRelatedListWidth(event.nativeEvent.layout.width)}
              >
                <FlatList
                  data={relatedCombos}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => `related-combo-${item.id}`}
                  contentContainerStyle={styles.relatedList}
                  ItemSeparatorComponent={() => <View style={styles.relatedSeparator} />}
                  snapToInterval={RELATED_CARD_WIDTH + RELATED_CARD_GAP}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  onContentSizeChange={(contentWidth) => setRelatedContentWidth(contentWidth)}
                  onScroll={(event) => setRelatedScrollX(event.nativeEvent.contentOffset.x)}
                  scrollEventThrottle={16}
                  renderItem={({ item }) => {
                    const relatedWishlistKey = getWishlistKey('PlantCombo', item.id);
                    const isRelatedWishlisted = wishlistStatus[relatedWishlistKey] ?? false;

                    return (
                      <TouchableOpacity
                        style={styles.relatedCard}
                        activeOpacity={0.84}
                        onPress={() => handleOpenRelatedCombo(item.id)}
                      >
                        <View style={styles.relatedImageWrap}>
                          {item.imageUrl?.trim() ? (
                            <Image
                              source={{ uri: item.imageUrl }}
                              style={styles.relatedImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.relatedImagePlaceholder}>
                              <Ionicons name="albums-outline" size={30} color={COLORS.gray500} />
                            </View>
                          )}
                          <TouchableOpacity
                            style={styles.relatedHeartBtn}
                            onPress={(event) => {
                              event.stopPropagation();
                              void handleToggleRelatedWishlist(item.id);
                            }}
                          >
                            <Ionicons
                              name={isRelatedWishlisted ? 'heart' : 'heart-outline'}
                              size={18}
                              color={isRelatedWishlisted ? COLORS.error : COLORS.white}
                            />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.relatedName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.relatedSub} numberOfLines={1}>
                          {item.comboTypeName || '-'}
                        </Text>
                        <View style={styles.relatedPriceRow}>
                          <Text style={styles.relatedPrice} numberOfLines={1}>
                            {formatMoney(item.price)}
                          </Text>
                          <View style={styles.relatedOpenBtn}>
                            <Ionicons name="arrow-forward" size={12} color={COLORS.white} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />

                {(showRelatedArrowLeft || showRelatedArrowRight) && (
                  <View style={styles.relatedArrowOverlay} pointerEvents="none">
                    {showRelatedArrowLeft ? (
                      <View style={[styles.relatedArrow, styles.relatedArrowLeft]}>
                        <Ionicons name="chevron-back" size={18} color="#13EC5B" />
                      </View>
                    ) : null}
                    {showRelatedArrowRight ? (
                      <View style={[styles.relatedArrow, styles.relatedArrowRight]}>
                        <Ionicons name="chevron-forward" size={18} color="#13EC5B" />
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                {t('catalog.noResults', {
                  defaultValue: 'No products found for the current filters.',
                })}
              </Text>
            )}
          </View>

          <View style={[styles.bottomSpacer, { height: bottomSpacerHeight }]} />
        </View>
      </ScrollView>

      <View
        style={[styles.bottomBar, { paddingBottom: bottomBarPaddingBottom }]}
        onLayout={handleBottomBarLayout}
      >
        <View style={styles.quantityControl}>
          <Text style={styles.quantityLabel}>{t('cart.quantity', { defaultValue: 'Quantity' })}</Text>
          <View style={styles.quantityStepper}>
            <TouchableOpacity
              style={[styles.quantityBtn, quantity <= 1 && styles.quantityBtnDisabled]}
              disabled={quantity <= 1 || isSubmitting}
              onPress={() => setQuantity((previous) => Math.max(1, previous - 1))}
            >
              <Ionicons name="remove" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityBtn}
              disabled={isSubmitting}
              onPress={() => setQuantity((previous) => Math.min(99, previous + 1))}
            >
              <Ionicons name="add" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomActionRow}>
          <TouchableOpacity
            style={[styles.buyNowButton, isSubmitting && styles.actionDisabled]}
            disabled={isSubmitting}
            onPress={handleBuyNow}
          >
            <Text style={styles.buyNowText}>
              {t('plantDetail.buyNow', { defaultValue: 'Buy now' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addToCartButton, isSubmitting && styles.actionDisabled]}
            disabled={isSubmitting}
            onPress={() => void handleAddToCart()}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.addToCartText}>
                {t('plantDetail.addToCart', { defaultValue: 'Add to cart' })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
    fontSize: FONTS.sizes.md,
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
  },
  heroImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
  },
  heroOverlay: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
    elevation: 2,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: IMAGE_HEIGHT - 24,
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
  metaBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4C9A66',
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
  themeCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    padding: 14,
    gap: 6,
    ...SHADOWS.sm,
  },
  themeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1B12',
  },
  themeDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  includedList: {
    marginTop: SPACING.md,
    gap: 10,
  },
  includedItem: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: COLORS.white,
    gap: 7,
    ...SHADOWS.sm,
  },
  includedItemDisabled: {
    opacity: 0.6,
  },
  includedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  includedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#13EC5B',
  },
  includedName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#102216',
  },
  includedQty: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4C9A66',
  },
  includedNotes: {
    marginLeft: 16,
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  includedHint: {
    marginLeft: 16,
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  includedUnavailable: {
    marginLeft: 16,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  tagsContainer: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#2563EB',
  },
  emptyText: {
    marginTop: SPACING.sm,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  relatedLoaderWrap: {
    marginTop: SPACING.md,
    alignItems: 'flex-start',
  },
  relatedSliderWrap: {
    marginTop: SPACING.md,
    position: 'relative',
    marginHorizontal: -SPACING.xl,
  },
  relatedList: {
    paddingHorizontal: SPACING.xl,
  },
  relatedSeparator: {
    width: RELATED_CARD_GAP,
  },
  relatedCard: {
    width: RELATED_CARD_WIDTH,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    ...SHADOWS.sm,
  },
  relatedImageWrap: {
    width: RELATED_CARD_WIDTH - 24,
    height: RELATED_IMAGE_HEIGHT,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    position: 'relative',
  },
  relatedImage: {
    width: '100%',
    height: '100%',
  },
  relatedImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray200,
  },
  relatedHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedName: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 22,
  },
  relatedSub: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4C9A66',
    lineHeight: 16,
  },
  relatedPriceRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  relatedPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#13EC5B',
    flex: 1,
  },
  relatedOpenBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#13EC5B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedArrowOverlay: {
    position: 'absolute',
    top: 0,
    height: RELATED_IMAGE_HEIGHT,
    left: SPACING.xl,
    right: SPACING.xl,
    alignItems: 'center',
  },
  relatedArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedArrowLeft: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -14,
  },
  relatedArrowRight: {
    position: 'absolute',
    right: 4,
    top: '50%',
    marginTop: -14,
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
  quantityControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: '#13EC5B',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quantityBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  quantityBtnDisabled: {
    opacity: 0.4,
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D1B12',
  },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1B12',
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buyNowButton: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#13EC5B',
    backgroundColor: '#F0FDF4',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyNowText: {
    fontSize: 16,
    color: '#13EC5B',
    fontWeight: '700',
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: '#13EC5B',
    borderRadius: 24,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.7,
  },
  addToCartText: {
    fontSize: 16,
    color: '#102216',
    fontWeight: '700',
  },
});
