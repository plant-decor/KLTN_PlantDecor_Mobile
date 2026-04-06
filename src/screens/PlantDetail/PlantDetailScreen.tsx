import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { usePlantStore, useCartStore, useAuthStore, useWishlistStore } from '../../stores';
import { RootStackParamList, Plant, CheckoutItem } from '../../types';
import { getWishlistKey, notify, resolveWishlistTarget } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'PlantDetail'>;

const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = 396;
const ATTR_CARD_WIDTH = (width - SPACING.xl * 2 - 12) / 2;
const RELATED_CARD_WIDTH = 196;
const RELATED_CARD_GAP = 16;
const RELATED_IMAGE_HEIGHT = 215;

// ---------- Attribute card helper ----------
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
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.attrLabel}>{label}</Text>
        <Text style={styles.attrValue}>{value}</Text>
      </View>
    </View>
  );
}

// ============================================================
export default function PlantDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { plantId: plantId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const {
    selectedPlant,
    isLoading,
    fetchPlantDetail,
    fetchPlants,
    plants,
    nurseriesGotPlantInstances,
    nurseriesGotCommonPlants,
    fetchNurseriesGotPlantInstances,
    fetchNurseriesGotCommonPlantByPlantId,
  } = usePlantStore();
  const { addToCart } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [relatedListWidth, setRelatedListWidth] = useState(0);
  const [relatedContentWidth, setRelatedContentWidth] = useState(0);
  const [relatedScrollX, setRelatedScrollX] = useState(0);
  const [showAllNurseries, setShowAllNurseries] = useState(false);
  const [renderExtraNurseries, setRenderExtraNurseries] = useState(false);
  const [extraNurseryHeight, setExtraNurseryHeight] = useState(0);
  const [selectedNurseryId, setSelectedNurseryId] = useState<number | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const wishlistStatus = useWishlistStore((state) => state.statusByKey);
  const ensureWishlistStatus = useWishlistStore((state) => state.ensureStatus);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const clearWishlistStatus = useWishlistStore((state) => state.clearStatus);
  const nurseryExtraAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchPlantDetail(plantId);
  }, [fetchPlantDetail, plantId]);

  useEffect(() => {
    if (plants.length === 0) {
      fetchPlants({ page: 1, sortBy: 'createdAt', sortDirection: 'desc' });
    }
  }, [fetchPlants, plants.length]);

  useEffect(() => {
    setSelectedQuantity(1);
  }, [plantId]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearWishlistStatus();
    }
  }, [clearWishlistStatus, isAuthenticated]);

  const plant = selectedPlant;

  // Related plants from store (exclude current)
  const relatedPlants = useMemo(() => {
    return plants
      .filter((p) => String(p.id) !== String(plantId))
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        name: p.name,
        subtitle: t('plantDetail.defaultSubtitle'),
        price: p.basePrice ?? 0,
        isUniqueInstance: p.isUniqueInstance,
        image: p.images?.[0] ?? '',
      }));
  }, [plants, plantId, t]);

  const relatedPlantEntities = useMemo(() => {
    return relatedPlants
      .map((item) => plants.find((plantItem) => String(plantItem.id) === String(item.id)))
      .filter((item): item is Plant => Boolean(item));
  }, [plants, relatedPlants]);

  const wishlistCheckPlants = useMemo(() => {
    const nextPlants: Plant[] = [];
    if (plant) {
      nextPlants.push(plant);
    }
    nextPlants.push(...relatedPlantEntities);
    return nextPlants;
  }, [plant, relatedPlantEntities]);

  const wishlistTargets = useMemo(
    () =>
      wishlistCheckPlants
        .map(resolveWishlistTarget)
        .filter(
          (target): target is NonNullable<ReturnType<typeof resolveWishlistTarget>> =>
            target !== null
        ),
    [wishlistCheckPlants]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void ensureWishlistStatus(wishlistTargets);
  }, [ensureWishlistStatus, isAuthenticated, wishlistTargets]);

  const plantImage = plant?.images?.[0] ?? '';
  const isInstancePlant = Boolean(plant?.isUniqueInstance);
  const nurseriesForPlant = isInstancePlant
    ? nurseriesGotPlantInstances
    : nurseriesGotCommonPlants;
  const baseNurseries = nurseriesForPlant.slice(0, 3);
  const extraNurseries = nurseriesForPlant.slice(3);
  const hasExtraNurseries = extraNurseries.length > 0;

  const selectedNursery = !isInstancePlant
    ? nurseriesForPlant.find((nursery) => nursery.nurseryId === selectedNurseryId) ?? null
    : null;

  useEffect(() => {
    if (!plant) {
      return;
    }

    const targetPlantId = plant.id ?? plantId;
    if (plant.isUniqueInstance) {
      fetchNurseriesGotPlantInstances(targetPlantId);
      return;
    }

    fetchNurseriesGotCommonPlantByPlantId(targetPlantId);
  }, [
    plant,
    plantId,
    fetchNurseriesGotPlantInstances,
    fetchNurseriesGotCommonPlantByPlantId,
  ]);

  useEffect(() => {
    if (isInstancePlant) {
      setSelectedNurseryId(null);
      return;
    }

    if (nurseriesForPlant.length === 0) {
      setSelectedNurseryId(null);
      return;
    }

    setSelectedNurseryId((current) => {
      if (current && nurseriesForPlant.some((nursery) => nursery.nurseryId === current)) {
        return current;
      }
      return nurseriesForPlant[0].nurseryId;
    });
  }, [isInstancePlant, nurseriesForPlant]);
  const hasMoreRelatedItems = relatedPlants.length > 1;
  const showRelatedArrowLeft = relatedScrollX > 4;
  const showRelatedArrowRight = hasMoreRelatedItems
    ? relatedContentWidth === 0 || relatedContentWidth - relatedListWidth - relatedScrollX > 4
    : false;

  useEffect(() => {
    if (!hasExtraNurseries) {
      setShowAllNurseries(false);
      setRenderExtraNurseries(false);
      nurseryExtraAnim.setValue(0);
      return;
    }

    if (showAllNurseries) {
      setRenderExtraNurseries(true);
    }
  }, [hasExtraNurseries, showAllNurseries, nurseryExtraAnim]);

  useEffect(() => {
    if (!renderExtraNurseries || (showAllNurseries && extraNurseryHeight === 0)) {
      return;
    }

    Animated.timing(nurseryExtraAnim, {
      toValue: showAllNurseries ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !showAllNurseries) {
        setRenderExtraNurseries(false);
      }
    });
  }, [renderExtraNurseries, showAllNurseries, extraNurseryHeight, nurseryExtraAnim]);

  const extraNurseryAnimatedStyle = {
    height: nurseryExtraAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, extraNurseryHeight],
    }),
    opacity: nurseryExtraAnim,
  };

  const requireAuth = (onSuccess?: () => void) => {
    if (isAuthenticated) {
      onSuccess?.();
      return true;
    }

    Alert.alert(
      t('common.loginRequiredTitle', { defaultValue: 'Login required' }),
      t('common.loginRequiredMessage', { defaultValue: 'Please login to continue.' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.login', { defaultValue: 'Login' }),
          onPress: () => navigation.navigate('Login'),
        },
      ],
    );
    return false;
  };

  const handleBuyNow = () => {
    requireAuth(() => {
      if (!plant) {
        navigation.navigate('Checkout');
        return;
      }

      const checkoutQuantity = plant.isUniqueInstance ? 1 : selectedQuantity;
      const checkoutItem: CheckoutItem = {
        id: `buy_now_${plant.id}`,
        name: plant.name,
        size: plant.sizeName || t('common.updating', { defaultValue: 'Updating' }),
        image: plant.images?.[0] ?? undefined,
        price: selectedNursery?.minPrice || plant.basePrice || 0,
        quantity: checkoutQuantity,
      };

      if (!plant.isUniqueInstance) {
        addToCart(plant, checkoutQuantity, {
          commonPlantId: selectedNursery?.commonPlantId ?? undefined,
        });
      }

      navigation.navigate('Checkout', {
        source: 'buy-now',
        items: [checkoutItem],
      });
    });
  };

  const handleAddToCart = (
    targetPlant: Plant,
    overrideCommonPlantId?: number,
    quantity = 1,
  ) => {
    if (!requireAuth()) {
      return;
    }

    if (targetPlant.isUniqueInstance) {
      return;
    }

    addToCart(targetPlant, quantity, {
      commonPlantId: overrideCommonPlantId,
    });
    notify({ message: t('cart.addedMessage', { defaultValue: 'Added to cart.' }) });
  };

  const handleToggleWishlist = async (targetPlant: Plant) => {
    if (!requireAuth()) {
      return;
    }

    const wishlistTarget = resolveWishlistTarget(targetPlant);
    if (!wishlistTarget) {
      notify({
        message: t('wishlist.invalidItem', {
          defaultValue: 'Unable to add this item to wishlist.',
        }),
      });
      return;
    }

    const wishlistKey = getWishlistKey(wishlistTarget.itemType, wishlistTarget.itemId);
    const wasInWishlist = wishlistStatus[wishlistKey] ?? false;

    try {
      await toggleWishlist(wishlistTarget.itemType, wishlistTarget.itemId);
      notify({
        message: wasInWishlist
          ? t('wishlist.removeSuccess', { defaultValue: 'Removed from wishlist.' })
          : t('wishlist.addedMessage', { defaultValue: 'Added to wishlist.' }),
      });
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      notify({
        message:
          apiMessage ||
          (wasInWishlist
            ? t('wishlist.removeFailed', {
                defaultValue: 'Unable to remove from wishlist.',
              })
            : t('wishlist.addFailed', {
                defaultValue: 'Unable to add to wishlist.',
              })),
      });
    }
  };

  const handleAddRelatedToCart = (plantId: string | number) => {
    const targetPlant = plants.find((item) => String(item.id) === String(plantId));
    if (!targetPlant) {
      return;
    }
    handleAddToCart(targetPlant);
  };

  const handleAddRelatedToWishlist = (plantId: string | number) => {
    const targetPlant = plants.find((item) => String(item.id) === String(plantId));
    if (!targetPlant) {
      return;
    }
    handleToggleWishlist(targetPlant);
  };

  const isWishlisted = useCallback(
    (targetPlant: Plant) => {
      const wishlistTarget = resolveWishlistTarget(targetPlant);
      if (!wishlistTarget) {
        return false;
      }
      const wishlistKey = getWishlistKey(wishlistTarget.itemType, wishlistTarget.itemId);
      return wishlistStatus[wishlistKey] ?? false;
    },
    [wishlistStatus]
  );

  const isWishlistedById = useCallback(
    (plantIdValue: string | number) => {
      const targetPlant = plants.find((item) => String(item.id) === String(plantIdValue));
      if (!targetPlant) {
        return false;
      }
      return isWishlisted(targetPlant);
    },
    [isWishlisted, plants]
  );

  // ---------- helpers ----------
  const getCareLabel = () => {
    if (!plant) {
      return '';
    }
    if (plant.careLevelTypeName) {
      return plant.careLevelTypeName;
    }
    // Fallback to care level string
    switch (plant.careLevel?.toLowerCase()) {
      case 'easy':
        return t('plantDetail.careEasy');
      case 'medium':
        return t('plantDetail.careMedium');
      case 'hard':
        return t('plantDetail.careHard');
      default:
        return plant.careLevel;
    }
  };

  const getLightLabel = () => {
    if (!plant) {
      return '';
    }
    return plant.placementTypeName || '';
  };

  const getSizeLabel = () => {
    if (!plant) {
      return '';
    }
    if (plant.sizeName) {
      return plant.sizeName;
    }
    return typeof plant.size === 'string' ? plant.size : String(plant.size);
  };

  const formatNurseryPrice = (minPrice: number, maxPrice: number) => {
    if (!minPrice && !maxPrice) {
      return t('plantDetail.priceContact', { defaultValue: 'Contact' });
    }

    if (minPrice === maxPrice) {
      return `${minPrice.toLocaleString(locale)}₫`;
    }

    return `${minPrice.toLocaleString(locale)}₫ - ${maxPrice.toLocaleString(locale)}₫`;
  };

  const renderNurseryCard = (nursery: (typeof nurseriesForPlant)[number]) => {
    const isSelected = !isInstancePlant && nursery.nurseryId === selectedNurseryId;

    return (
      <TouchableOpacity
        key={`${nursery.nurseryId}-${nursery.commonPlantId ?? 'i'}`}
        style={[styles.nurseryCard, isSelected && styles.nurseryCardSelected]}
        onPress={() => {
          if (!isInstancePlant) {
            setSelectedNurseryId(nursery.nurseryId);
          }
        }}
        activeOpacity={0.8}
        disabled={isInstancePlant}
      >
      <View style={styles.nurseryHeader}>
        <Ionicons name="business-outline" size={18} color="#15803D" />
        <Text style={styles.nurseryName}>{nursery.nurseryName}</Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={16} color="#13EC5B" />
        )}
      </View>
      <Text style={styles.nurseryAddress}>{nursery.address}</Text>
      <View style={styles.nurseryMetaRow}>
        <Ionicons name="call-outline" size={14} color={COLORS.textSecondary} />
        <Text style={styles.nurseryMetaText}>
          {nursery.phone || t('common.updating', { defaultValue: 'Updating' })}
        </Text>
      </View>
      <View style={styles.nurseryFooter}>
        <Text style={styles.nurseryAvailability}>
          {t('plantDetail.availableCount', { defaultValue: 'Available' })}:{' '}
          {nursery.availableInstanceCount}
        </Text>
        <Text style={styles.nurseryPrice}>
          {formatNurseryPrice(nursery.minPrice, nursery.maxPrice)}
        </Text>
      </View>
      </TouchableOpacity>
    );
  };

  // ---------- loading / empty state ----------
  if (isLoading && !plant) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!plant) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.emptyTitle}>
          {t('plantDetail.notFoundTitle', { defaultValue: 'Plant not found' })}
        </Text>
        <Text style={styles.emptySubtitle}>
          {t('plantDetail.notFoundMessage', {
            defaultValue: 'This plant is unavailable or has been removed.',
          })}
        </Text>
        <TouchableOpacity style={styles.backToListBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backToListText}>
            {t('common.goBack', { defaultValue: 'Go back' })}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const price = plant.basePrice ?? 0;

  // ============ RENDER ============
  return (
    <View style={styles.container}>
      {/* ===== Hero image ===== */}
      <View style={styles.heroWrap}>
        {plantImage ? (
          <Image
            source={{ uri: plantImage }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Ionicons name="leaf-outline" size={52} color={COLORS.gray500} />
          </View>
        )}
      </View>

      {/* Overlay nav buttons */}
      <View style={styles.heroOverlay} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color="#0D1B12" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => {
            if (plant) {
              handleToggleWishlist(plant);
            }
          }}
        >
          <Ionicons
            name={plant && isWishlisted(plant) ? 'heart' : 'heart-outline'}
            size={20}
            color={plant && isWishlisted(plant) ? COLORS.error : COLORS.white}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* ===== Content card (overlaps image) ===== */}
        <View style={styles.contentCard}>
          {/* Drag handle */}
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          {/* Name + rating */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.plantName}>{plant.name}</Text>
              {plant.specificName && (
                <Text style={styles.specificName}>{plant.specificName}</Text>
              )}
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={16} color="#EAB308" />
              <Text style={styles.ratingText}>4.8</Text>
            </View>
          </View>

          {/* Price */}
          <Text style={styles.price}>{price.toLocaleString(locale)} ₫</Text>

          {/* Origin & Tags */}
          {(plant.origin || (plant.tags && plant.tags.length > 0)) && (
            <View style={styles.metaRow}>
              {plant.origin && (
                <View style={styles.originBadge}>
                  <Ionicons name="location" size={14} color="#4C9A66" />
                  <Text style={styles.originText}>{plant.origin}</Text>
                </View>
              )}
              {plant.tags && plant.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {plant.tags.slice(0, 3).map((tag) => (
                    <View key={tag.id} style={styles.tagBadge}>
                      <Text style={styles.tagText}>{tag.tagName}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Description */}
          <Text style={styles.description}>{plant.description}</Text>

          {/* ===== Biological Properties ===== */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {t('plantDetail.biologicalProperties')}
            </Text>
            <View style={styles.attrGrid}>
              <AttributeCard
                icon="leaf-outline"
                iconColor="#15803D"
                iconBg="#DBEAFE"
                label={t('plantDetail.size')}
                value={getSizeLabel()}
              />
              <AttributeCard
                icon="flower-outline"
                iconColor="#EA580C"
                iconBg="#FFEDD5"
                label={t('plantDetail.care')}
                value={getCareLabel()}
              />
              <AttributeCard
                icon="sunny-outline"
                iconColor="#CA8A04"
                iconBg="#FEF9C3"
                label={t('plantDetail.placement')}
                value={getLightLabel()}
              />
              {plant.growthRate && (
                <AttributeCard
                  icon="trending-up-outline"
                  iconColor="#059669"
                  iconBg="#D1FAE5"
                  label={t('plantDetail.growthRate')}
                  value={plant.growthRate}
                />
              )}
              {plant.airPurifying !== undefined && (
                <AttributeCard
                  icon="leaf"
                  iconColor="#0891B2"
                  iconBg="#CFFAFE"
                  label={t('plantDetail.airPurifying')}
                  value={plant.airPurifying ? t('common.yes') : t('common.no')}
                />
              )}
              {plant.petSafe !== undefined && (
                <AttributeCard
                  icon="paw-outline"
                  iconColor="#E11D48"
                  iconBg="#FFE4E6"
                  label={t('plantDetail.petSafety')}
                  value={plant.petSafe ? t('common.safe') : t('common.toxic')}
                />
              )}
              {plant.childSafe !== undefined && (
                <AttributeCard
                  icon="happy-outline"
                  iconColor="#7C3AED"
                  iconBg="#EDE9FE"
                  label={t('plantDetail.childSafety')}
                  value={plant.childSafe ? t('common.safe') : t('common.caution')}
                />
              )}
            </View>
          </View>

          {/* ===== Feng Shui Section (if available) ===== */}
          {(plant.fengShuiElement || plant.fengShuiMeaning) && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>
                {t('plantDetail.fengShui')}
              </Text>
              <View style={styles.fengShuiCard}>
                {plant.fengShuiElement && (
                  <View style={styles.fengShuiRow}>
                    <Ionicons name="planet-outline" size={20} color="#CA8A04" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fengShuiLabel}>
                        {t('plantDetail.fengShuiElement')}
                      </Text>
                      <Text style={styles.fengShuiValue}>
                        {plant.fengShuiElement}
                      </Text>
                    </View>
                  </View>
                )}
                {plant.fengShuiMeaning && (
                  <View style={styles.fengShuiRow}>
                    <Ionicons name="sparkles-outline" size={20} color="#7C3AED" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fengShuiLabel}>
                        {t('plantDetail.fengShuiMeaning')}
                      </Text>
                      <Text style={styles.fengShuiValue}>
                        {plant.fengShuiMeaning}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ===== Pot Information (if included) ===== */}
          {plant.potIncluded && plant.potSize && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>
                {t('plantDetail.potInfo')}
              </Text>
              <View style={styles.potCard}>
                <Ionicons name="cube-outline" size={20} color="#15803D" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.potLabel}>
                    {t('plantDetail.potIncluded')}
                  </Text>
                  <Text style={styles.potValue}>{plant.potSize}</Text>
                </View>
              </View>
            </View>
          )}

          {nurseriesForPlant.length > 0 && (
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>
                {t('plantDetail.availableNurseries', {
                  defaultValue: 'Available nurseries',
                })}
              </Text>
              <View style={styles.nurseryList}>
                {baseNurseries.map(renderNurseryCard)}
                {renderExtraNurseries && (
                  <Animated.View
                    style={[styles.nurseryExtraWrap, extraNurseryAnimatedStyle]}
                    pointerEvents={showAllNurseries ? 'auto' : 'none'}
                  >
                    {extraNurseries.map(renderNurseryCard)}
                  </Animated.View>
                )}
                {hasExtraNurseries && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => setShowAllNurseries((prev) => !prev)}
                  >
                    <Text style={styles.loadMoreText}>
                      {showAllNurseries
                        ? t('plantDetail.collapseNurseries', {
                            defaultValue: 'Show less',
                          })
                        : t('plantDetail.loadMoreNurseries', {
                            defaultValue: 'Load more',
                          })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {hasExtraNurseries && (
                <View
                  pointerEvents="none"
                  style={styles.nurseryMeasure}
                  onLayout={(event) => {
                    const height = event.nativeEvent.layout.height;
                    if (height !== extraNurseryHeight) {
                      setExtraNurseryHeight(height);
                    }
                  }}
                >
                  {extraNurseries.map(renderNurseryCard)}
                </View>
              )}
            </View>
          )}

          {/* ===== You may also like ===== */}
          {relatedPlants.length > 0 && (
            <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {t('plantDetail.youMayAlsoLike')}
            </Text>
            </View>
          )}
        </View>

        {/* Horizontal related plants (outside card padding for full bleed) */}
        {relatedPlants.length > 0 && (
          <View
            style={styles.relatedSliderWrap}
            onLayout={(event) => setRelatedListWidth(event.nativeEvent.layout.width)}
          >
            <FlatList
              data={relatedPlants}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `related-${item.id}`}
              contentContainerStyle={styles.relatedList}
              ItemSeparatorComponent={() => <View style={styles.relatedSeparator} />}
              snapToInterval={RELATED_CARD_WIDTH + RELATED_CARD_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
              onContentSizeChange={(contentWidth) => setRelatedContentWidth(contentWidth)}
              onScroll={(event) => setRelatedScrollX(event.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.relatedCard}
                  onPress={() =>
                    navigation.push('PlantDetail', { plantId: String(item.id) })
                  }
                >
                  <View style={styles.relatedImageWrap}>
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.relatedImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.relatedImagePlaceholder}>
                        <Ionicons name="leaf-outline" size={28} color={COLORS.gray500} />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.relatedHeartBtn}
                      onPress={() => handleAddRelatedToWishlist(item.id)}
                    >
                      <Ionicons
                        name={isWishlistedById(item.id) ? 'heart' : 'heart-outline'}
                        size={16}
                        color={isWishlistedById(item.id) ? COLORS.error : COLORS.white}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.relatedName}>{item.name}</Text>
                  <Text style={styles.relatedSub}>{item.subtitle}</Text>
                  <View style={styles.relatedPriceRow}>
                    <Text style={styles.relatedPrice}>
                      {(item.price || 0).toLocaleString(locale)}₫
                    </Text>
                    {!item.isUniqueInstance && (
                      <TouchableOpacity
                        style={styles.relatedPlusBtn}
                        onPress={() => handleAddRelatedToCart(item.id)}
                      >
                        <Ionicons name="add" size={14} color={COLORS.black} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
            <View style={styles.relatedArrowOverlay} pointerEvents="none">
              {showRelatedArrowLeft && (
                <View style={[styles.relatedArrow, styles.relatedArrowLeft]}>
                  <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
                </View>
              )}
              {showRelatedArrowRight && (
                <View style={[styles.relatedArrow, styles.relatedArrowRight]}>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Bottom spacer for sticky bar */}
        <View style={{ height: 84 }} />
      </ScrollView>

      {/* ===== Sticky bottom bar ===== */}
      <View style={styles.bottomBar}>
        {isInstancePlant ? (
          <TouchableOpacity
            style={[styles.buyNowBtn, styles.buyNowBtnPrimary]}
            onPress={handleBuyNow}
          >
            <Text style={[styles.buyNowText, styles.buyNowTextPrimary]}>
              {t('plantDetail.buyNow', { defaultValue: 'Buy now' })}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.bottomActionWrap}>
            <View style={styles.quantityControl}>
              <Text style={styles.quantityLabel}>
                {t('cart.quantity', { defaultValue: 'Quantity' })}
              </Text>
              <View style={styles.quantityStepper}>
                <TouchableOpacity
                  style={[
                    styles.quantityBtn,
                    selectedQuantity <= 1 && styles.quantityBtnDisabled,
                  ]}
                  disabled={selectedQuantity <= 1}
                  onPress={() => setSelectedQuantity((prev) => Math.max(1, prev - 1))}
                >
                  <Ionicons name="remove" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.quantityValue}>{selectedQuantity}</Text>
                <TouchableOpacity
                  style={styles.quantityBtn}
                  onPress={() => setSelectedQuantity((prev) => Math.min(99, prev + 1))}
                >
                  <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.bottomActionRow}>
              <TouchableOpacity
                style={[styles.buyNowBtn, styles.buyNowBtnCompact]}
                onPress={handleBuyNow}
              >
                <Text style={styles.buyNowText}>
                  {t('plantDetail.buyNow', { defaultValue: 'Buy now' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addToCartBtn, styles.addToCartBtnWide]}
                onPress={() =>
                  handleAddToCart(
                    plant,
                    selectedNursery?.commonPlantId ?? undefined,
                    selectedQuantity,
                  )
                }
              >
                <Ionicons name="cart-outline" size={20} color="#102216" />
                <Text style={styles.addToCartText}>
                  {t('plantDetail.addToCart')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingTop: IMAGE_HEIGHT - 24,
    paddingBottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F8F6',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0D1B12',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
  },
  backToListBtn: {
    marginTop: 16,
    backgroundColor: '#13EC5B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backToListText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#102216',
  },

  // ---- Hero ----
  heroWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width,
    height: IMAGE_HEIGHT,
    backgroundColor: COLORS.gray200,
  },
  heroImage: {
    width,
    height: IMAGE_HEIGHT,
  },
  heroPlaceholder: {
    width,
    height: IMAGE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray200,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
    elevation: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ---- Content card ----
  contentCard: {
    marginTop: 0,
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

  // ---- Name + rating ----
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  plantName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 30,
  },
  specificName: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
    color: '#6B7280',
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(19,236,91,0.10)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: SPACING.sm,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1B12',
  },

  // ---- Meta row (origin + tags) ----
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  originBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E7F3EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  originText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4C9A66',
  },
  tagsContainer: {
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

  // ---- Price ----
  price: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '700',
    color: '#13EC5B',
    lineHeight: 32,
  },

  // ---- Description ----
  description: {
    marginTop: SPACING.lg,
    fontSize: 16,
    fontWeight: '400',
    color: '#4B5563',
    lineHeight: 26,
  },

  // ---- Section ----
  sectionWrap: {
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#13EC5B',
    lineHeight: 20,
  },

  // ---- Attribute grid ----
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
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attrLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 16,
  },
  attrValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1B12',
    lineHeight: 20,
  },

  // ---- Review ----
  reviewCard: {
    marginTop: SPACING.lg,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    gap: 7,
    ...SHADOWS.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  reviewMeta: {
    flex: 1,
  },
  reviewName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1B12',
    lineHeight: 20,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 16,
  },
  reviewComment: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4B5563',
    lineHeight: 20,
  },

  // ---- Feng Shui Card ----
  fengShuiCard: {
    marginTop: SPACING.lg,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    gap: 16,
    ...SHADOWS.sm,
  },
  fengShuiRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  fengShuiLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 2,
  },
  fengShuiValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1B12',
    lineHeight: 20,
  },

  // ---- Pot Card ----
  potCard: {
    marginTop: SPACING.lg,
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...SHADOWS.sm,
  },
  potLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 2,
  },
  potValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D1B12',
  },

  // ---- Nurseries ----
  nurseryList: {
    marginTop: SPACING.lg,
    gap: 12,
  },
  nurseryExtraWrap: {
    gap: 12,
    overflow: 'hidden',
  },
  nurseryMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
    gap: 12,
  },
  nurseryCard: {
    padding: 14,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F5F5F5',
    gap: 6,
    ...SHADOWS.sm,
  },
  nurseryCardSelected: {
    borderColor: '#13EC5B',
    backgroundColor: '#F0FDF4',
  },
  nurseryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nurseryName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1B12',
  },
  nurseryAddress: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 16,
  },
  nurseryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nurseryMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  nurseryFooter: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nurseryAvailability: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4C9A66',
  },
  nurseryPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#13EC5B',
  },
  loadMoreBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#E7FDF0',
    borderWidth: 1,
    borderColor: '#13EC5B',
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#13EC5B',
  },

  // ---- Related / You may also like ----
  relatedSliderWrap: {
    position: 'relative',
  },
  relatedList: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  relatedSeparator: {
    width: RELATED_CARD_GAP,
  },
  relatedCard: {
    width: RELATED_CARD_WIDTH,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
  },
  relatedImageWrap: {
    width: RELATED_CARD_WIDTH - 24,
    height: RELATED_IMAGE_HEIGHT,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    position: 'relative',
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
  relatedImage: {
    width: '100%',
    height: '100%',
  },
  relatedImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray200,
  },
  relatedHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedRatingBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  relatedRatingText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.white,
    lineHeight: 16,
  },
  relatedHotBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  relatedHotText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 15,
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
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  relatedPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#13EC5B',
    lineHeight: 24,
  },
  relatedPlusBtn: {
    width: 18,
    height: 18,
    borderRadius: 9999,
    backgroundColor: '#13EC5B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedPlusBtnDisabled: {
    opacity: 0.35,
  },

  // ---- Bottom bar ----
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
    alignItems: 'stretch',
    zIndex: 3,
    elevation: 3,
  },
  bottomActionWrap: {
    gap: 10,
  },
  bottomActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#13EC5B',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  quantityBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityBtnDisabled: {
    opacity: 0.4,
  },
  quantityValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1B12',
  },
  buyNowBtn: {
    flex: 1,
    height: 42,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#13EC5B',
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  buyNowBtnCompact: {
    flex: 3,
  },
  buyNowBtnPrimary: {
    borderWidth: 0,
    backgroundColor: '#13EC5B',
  },
  buyNowText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#13EC5B',
    lineHeight: 24,
  },
  buyNowTextPrimary: {
    color: '#102216',
  },
  addToCartBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#13EC5B',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#13EC5B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addToCartBtnWide: {
    flex: 7,
  },
  addToCartText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102216',
    lineHeight: 24,
  },
});
