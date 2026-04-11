import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { usePlantStore, useCartStore, useAuthStore, useWishlistStore, useEnumStore } from '../../stores';
import {
  AddCartItemRequest,
  CheckoutItem,
  MainTabParamList,
  NurseryPlantInstanceAvailability,
  Plant,
  RootStackParamList,
  ShopSearchComboSummary,
  ShopSearchMaterialSummary,
} from '../../types';
import { cartService, plantService } from '../../services';
import { getWishlistKey, notify, resolveWishlistTarget } from '../../utils';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type HomePlant = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  isUniqueInstance: boolean;
  image?: string;
};

type HomeSortKey = 'newest' | 'priceAsc' | 'priceDesc';

const parseSortDescriptor = (
  value: unknown
): { sortBy: string; sortDirection: 'asc' | 'desc' } | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const directMatch = trimmed.match(/^([a-zA-Z][\w]*)[\s._:-](asc|desc)$/i);
  if (directMatch) {
    return {
      sortBy: directMatch[1],
      sortDirection: directMatch[2].toLowerCase() as 'asc' | 'desc',
    };
  }

  const camelCaseMatch = trimmed.match(/^([a-zA-Z][\w]*?)(Asc|Desc)$/);
  if (camelCaseMatch) {
    return {
      sortBy: camelCaseMatch[1],
      sortDirection: camelCaseMatch[2].toLowerCase() as 'asc' | 'desc',
    };
  }

  return null;
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 3) / 2 - 2;

const formatMoney = (amount: number, locale: string): string =>
  `${Math.max(0, amount).toLocaleString(locale)}₫`;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { plants, fetchPlants } = usePlantStore();
  const loadEnumResource = useEnumStore((state) => state.loadResource);
  const getEnumValues = useEnumStore((state) => state.getEnumValues);
  const enumGroups = useEnumStore((state) => state.groups);
  const cartItemCount = useCartStore((state) => state.totalItems());
  const fetchCart = useCartStore((state) => state.fetchCart);
  const hasLoadedCart = useCartStore((state) => state.hasLoadedCart);
  const { isAuthenticated } = useAuthStore();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const [selectedSort, setSelectedSort] = useState<HomeSortKey>('newest');
  const [keyword, setKeyword] = useState('');
  const [aiListWidth, setAiListWidth] = useState(0);
  const [aiContentWidth, setAiContentWidth] = useState(0);
  const [aiScrollX, setAiScrollX] = useState(0);
  const wishlistStatus = useWishlistStore((state) => state.statusByKey);
  const ensureWishlistStatus = useWishlistStore((state) => state.ensureStatus);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const clearWishlistStatus = useWishlistStore((state) => state.clearStatus);
  const [isNurseryPickerVisible, setIsNurseryPickerVisible] = useState(false);
  const [isNurseryPickerLoading, setIsNurseryPickerLoading] = useState(false);
  const [pendingCartPlant, setPendingCartPlant] = useState<Plant | null>(null);
  const [availableNurseryOptions, setAvailableNurseryOptions] =
    useState<NurseryPlantInstanceAvailability[]>([]);
  const [selectedCartNurseryId, setSelectedCartNurseryId] = useState<number | null>(null);
  const [selectedCartQuantity, setSelectedCartQuantity] = useState(1);
  const [featuredMaterials, setFeaturedMaterials] = useState<ShopSearchMaterialSummary[]>([]);
  const [featuredCombos, setFeaturedCombos] = useState<ShopSearchComboSummary[]>([]);
  const [isLoadingFeaturedProducts, setIsLoadingFeaturedProducts] = useState(false);

  useEffect(() => {
    void loadEnumResource('plant-sort');
  }, [loadEnumResource]);

  useEffect(() => {
    if (!isAuthenticated || hasLoadedCart) {
      return;
    }

    void fetchCart({ pageNumber: 1, pageSize: 20 }).catch(() => {
      // Keep current UI if cart prefetch fails.
    });
  }, [fetchCart, hasLoadedCart, isAuthenticated]);

  const sortConfig = useMemo(
    () => {
      const fallbackConfig: Record<
        HomeSortKey,
        { sortBy: string; sortDirection: 'asc' | 'desc' }
      > = {
        newest: { sortBy: 'createdAt', sortDirection: 'desc' },
        priceAsc: { sortBy: 'basePrice', sortDirection: 'asc' },
        priceDesc: { sortBy: 'basePrice', sortDirection: 'desc' },
      };

      const enumValues = getEnumValues(['PlantSort', 'plantSort', 'sortBy']);

      enumValues.forEach((item) => {
        const parsed = parseSortDescriptor(item.value) ?? parseSortDescriptor(item.name);
        if (!parsed) {
          return;
        }

        const normalized = `${item.name} ${String(item.value)}`.toLowerCase();
        if (normalized.includes('new') || normalized.includes('create') || normalized.includes('latest')) {
          fallbackConfig.newest = parsed;
          return;
        }

        if (
          (normalized.includes('price') && normalized.includes('asc')) ||
          normalized.includes('low')
        ) {
          fallbackConfig.priceAsc = parsed;
          return;
        }

        if (
          (normalized.includes('price') && normalized.includes('desc')) ||
          normalized.includes('high')
        ) {
          fallbackConfig.priceDesc = parsed;
        }
      });

      return fallbackConfig;
    },
    [enumGroups, getEnumValues]
  );

  useEffect(() => {
    const selectedSortConfig = sortConfig[selectedSort] ?? sortConfig.newest;
    fetchPlants({
      sortBy: selectedSortConfig.sortBy,
      sortDirection: selectedSortConfig.sortDirection,
    });
  }, [fetchPlants, selectedSort, sortConfig]);

  useEffect(() => {
    let isMounted = true;

    const loadFeaturedProducts = async () => {
      setIsLoadingFeaturedProducts(true);

      try {
        const payload = await plantService.searchShop({
          pagination: {
            pageNumber: 1,
            pageSize: 24,
          },
          includePlants: false,
          includeMaterials: true,
          includeCombos: true,
          sortBy: 'CreatedAt',
          sortDirection: 'Desc',
        });

        if (!isMounted) {
          return;
        }

        const featuredItems = payload.items?.items ?? [];
        const materialItems = featuredItems
          .filter((entry) => entry.type === 'Material')
          .map((entry) => entry.material)
          .filter((entry): entry is ShopSearchMaterialSummary => Boolean(entry))
          .slice(0, 6);
        const comboItems = featuredItems
          .filter((entry) => entry.type === 'Combo')
          .map((entry) => entry.combo)
          .filter((entry): entry is ShopSearchComboSummary => Boolean(entry))
          .slice(0, 6);

        setFeaturedMaterials(materialItems);
        setFeaturedCombos(comboItems);
      } catch {
        if (isMounted) {
          setFeaturedMaterials([]);
          setFeaturedCombos([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingFeaturedProducts(false);
        }
      }
    };

    void loadFeaturedProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const homePlants = useMemo<HomePlant[]>(() => {
    if (plants.length === 0) {
      return [];
    }

    return plants.slice(0, 4).map((item: Plant) => ({
      id: String(item.id),
      name: item.name,
      subtitle: t('home.defaultSubtitle'),
      price: item.basePrice ?? 0,
      isUniqueInstance: item.isUniqueInstance,
      image: item.images?.find((image) => typeof image === 'string' && image.trim().length > 0),
    }));
  }, [plants, t]);

  const homePlantEntities = useMemo(() => plants.slice(0, 4), [plants]);

  const wishlistTargets = useMemo(
    () =>
      homePlantEntities
        .map(resolveWishlistTarget)
        .filter(
          (target): target is NonNullable<ReturnType<typeof resolveWishlistTarget>> =>
            target !== null
        ),
    [homePlantEntities]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      clearWishlistStatus();
    }
  }, [clearWishlistStatus, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void ensureWishlistStatus(wishlistTargets);
  }, [ensureWishlistStatus, isAuthenticated, wishlistTargets]);

  const requireAuth = useCallback(
    (onSuccess?: () => void) => {
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
    },
    [isAuthenticated, navigation, t]
  );

  const submitAddToCart = useCallback(
    async (request: AddCartItemRequest) => {
      if (!requireAuth()) {
        return null;
      }

      try {
        const payload = await cartService.addCartItem(request);
        void fetchCart({ pageNumber: 1, pageSize: 20 }).catch(() => {
          // Keep optimistic UI if syncing cart count fails.
        });
        return payload;
      } catch (cartError: any) {
        notify({
          message:
            cartError?.response?.data?.message ||
            t('cart.addFailed', {
              defaultValue: 'Unable to add to cart.',
            }),
        });
        return null;
      }
    },
    [fetchCart, requireAuth, t]
  );

  const handleAddMaterialToCart = useCallback(
    async (material: ShopSearchMaterialSummary) => {
      const payload = await submitAddToCart({
        commonPlantId: null,
        nurseryPlantComboId: null,
        nurseryMaterialId: material.id,
        quantity: 1,
      });

      if (payload) {
        notify({
          message: t('cart.addedMessage', { defaultValue: 'Added to cart.' }),
        });
      }
    },
    [submitAddToCart, t]
  );

  const handleAddComboToCart = useCallback(
    async (combo: ShopSearchComboSummary) => {
      const payload = await submitAddToCart({
        commonPlantId: null,
        nurseryPlantComboId: combo.id,
        nurseryMaterialId: null,
        quantity: 1,
      });

      if (payload) {
        notify({
          message: t('cart.addedMessage', { defaultValue: 'Added to cart.' }),
        });
      }
    },
    [submitAddToCart, t]
  );

  const handleBuyNowMaterial = useCallback(
    async (material: ShopSearchMaterialSummary) => {
      if (!requireAuth()) {
        return;
      }

      const buyNowItemId = Number.isInteger(material.id) && material.id > 0 ? material.id : null;
      if (!buyNowItemId) {
        notify({
          message: t('checkout.invalidCheckoutItems', {
            defaultValue: 'Cannot resolve buy now item for order creation.',
          }),
          useAlert: true,
        });
        return;
      }

      const detailMaterialId =
        Number.isInteger(material.materialId) && material.materialId > 0
          ? material.materialId
          : buyNowItemId;

      let materialPrice = 0;
      try {
        const materialDetail = await plantService.getMaterialDetail(detailMaterialId);
        materialPrice = Math.max(0, materialDetail.basePrice || 0);
      } catch {
        // Buy-now payload can still be created with backend price resolution.
      }

      const checkoutItem: CheckoutItem = {
        id: `buy_now_material_${buyNowItemId}`,
        name: material.materialName,
        image: material.imageUrl?.trim() || undefined,
        price: materialPrice,
        quantity: 1,
        buyNowItemId,
        buyNowItemTypeName: 'NurseryMaterial',
        isUniqueInstance: false,
      };

      navigation.navigate('Checkout', {
        source: 'buy-now',
        items: [checkoutItem],
      });
    },
    [navigation, requireAuth, t]
  );

  const handleBuyNowCombo = useCallback(
    (combo: ShopSearchComboSummary) => {
      if (!requireAuth()) {
        return;
      }

      const buyNowItemId = Number.isInteger(combo.id) && combo.id > 0 ? combo.id : null;
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
        name: combo.name,
        image: combo.imageUrl?.trim() || undefined,
        price: Math.max(0, combo.price || 0),
        quantity: 1,
        buyNowItemId,
        buyNowItemTypeName: 'NurseryPlantCombo',
        isUniqueInstance: false,
      };

      navigation.navigate('Checkout', {
        source: 'buy-now',
        items: [checkoutItem],
      });
    },
    [navigation, requireAuth, t]
  );

  const closeNurseryPicker = useCallback(() => {
    setIsNurseryPickerVisible(false);
    setIsNurseryPickerLoading(false);
    setPendingCartPlant(null);
    setAvailableNurseryOptions([]);
    setSelectedCartNurseryId(null);
    setSelectedCartQuantity(1);
  }, []);

  const handleSelectNurseryForCart = useCallback(
    async (plant: Plant) => {
      if (!requireAuth()) {
        return;
      }

      if (plant.isUniqueInstance) {
        notify({
          message: t('catalog.uniquePlantCannotCart', {
            defaultValue: 'Unique plants cannot be added to cart directly.',
          }),
        });
        return;
      }

      setPendingCartPlant(plant);
      setIsNurseryPickerVisible(true);
      setIsNurseryPickerLoading(true);
      setAvailableNurseryOptions([]);
      setSelectedCartNurseryId(null);
      setSelectedCartQuantity(1);

      try {
        const options = await plantService.getNurseriesGotCommonPlantByPlantId(plant.id);
        setAvailableNurseryOptions(options ?? []);
        setSelectedCartNurseryId(options?.[0]?.nurseryId ?? null);
      } catch (pickerError: any) {
        notify({
          message:
            pickerError?.response?.data?.message ||
            t('catalog.loadNurseryFailed', {
              defaultValue: 'Unable to load available nurseries.',
            }),
        });
        closeNurseryPicker();
      } finally {
        setIsNurseryPickerLoading(false);
      }
    },
    [closeNurseryPicker, requireAuth, t]
  );

  const formatNurseryPrice = useCallback(
    (minPrice: number, maxPrice: number) => {
      if (!minPrice && !maxPrice) {
        return t('plantDetail.priceContact', { defaultValue: 'Contact' });
      }

      if (minPrice === maxPrice) {
        return formatMoney(minPrice, locale);
      }

      return `${formatMoney(minPrice, locale)} - ${formatMoney(maxPrice, locale)}`;
    },
    [locale, t]
  );

  const handleConfirmNurseryAdd = useCallback(
    async (goToCheckout = false) => {
      if (!pendingCartPlant || selectedCartNurseryId === null) {
        return;
      }

      const selectedNursery = availableNurseryOptions.find(
        (option) => option.nurseryId === selectedCartNurseryId
      );

      if (!selectedNursery || selectedNursery.commonPlantId == null) {
        notify({
          message: t('cart.addFailed', {
            defaultValue: 'Unable to add to cart.',
          }),
        });
        return;
      }

      const quantity = Math.max(1, selectedCartQuantity);

      if (goToCheckout) {
        const checkoutItem: CheckoutItem = {
          id: `buy_now_${pendingCartPlant.id}_${selectedNursery.nurseryId}`,
          name: pendingCartPlant.name,
          image: pendingCartPlant.images?.find(
            (image) => typeof image === 'string' && image.trim().length > 0
          ),
          price: selectedNursery.minPrice || pendingCartPlant.basePrice,
          quantity,
          buyNowItemId: selectedNursery.commonPlantId,
          buyNowItemTypeName: 'CommonPlant',
          isUniqueInstance: false,
        };

        closeNurseryPicker();
        navigation.navigate('Checkout', {
          source: 'buy-now',
          items: [checkoutItem],
        });
        return;
      }

      const payload = await submitAddToCart({
        commonPlantId: selectedNursery.commonPlantId,
        nurseryPlantComboId: null,
        nurseryMaterialId: null,
        quantity,
      });

      if (!payload) {
        return;
      }

      notify({
        message: t('cart.addedMessage', { defaultValue: 'Added to cart.' }),
      });
      closeNurseryPicker();
    },
    [
      availableNurseryOptions,
      closeNurseryPicker,
      navigation,
      pendingCartPlant,
      selectedCartNurseryId,
      selectedCartQuantity,
      submitAddToCart,
      t,
    ]
  );

  const handleAddToCart = useCallback(async (plantId: string) => {
    const targetPlant = plants.find((plant) => String(plant.id) === plantId);
    if (!targetPlant) {
      return;
    }

    await handleSelectNurseryForCart(targetPlant);
  }, [handleSelectNurseryForCart, plants]);

  const handleToggleWishlist = async (plantId: string) => {
    const targetPlant = plants.find((plant) => String(plant.id) === plantId);
    if (!targetPlant) {
      return;
    }

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

  const isWishlisted = useCallback(
    (plantId: string) => {
      const targetPlant = plants.find((plant) => String(plant.id) === plantId);
      if (!targetPlant) {
        return false;
      }
      const wishlistTarget = resolveWishlistTarget(targetPlant);
      if (!wishlistTarget) {
        return false;
      }
      const wishlistKey = getWishlistKey(wishlistTarget.itemType, wishlistTarget.itemId);
      return wishlistStatus[wishlistKey] ?? false;
    },
    [plants, wishlistStatus]
  );

  const renderPlantCard = ({ item }: { item: HomePlant }) => {
    const imageUri = item.image?.trim();

    return (
      <TouchableOpacity
        style={styles.plantCard}
        onPress={() => navigation.navigate('PlantDetail', { plantId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.plantImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="leaf-outline" size={32} color={COLORS.gray500} />
            </View>
          )}

          <View style={styles.hotBadge}>
            <Text style={styles.hotBadgeText}>{t('home.hot')}</Text>
          </View>

          {!item.isUniqueInstance && (
            <TouchableOpacity
              style={styles.favoriteBtn}
              onPress={(event) => {
                event.stopPropagation();
                void handleToggleWishlist(item.id);
              }}
            >
              <Ionicons
                name={isWishlisted(item.id) ? 'heart' : 'heart-outline'}
                size={16}
                color={isWishlisted(item.id) ? COLORS.error : COLORS.white}
              />
            </TouchableOpacity>
          )}

          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color={COLORS.warning} />
            <Text style={styles.ratingBadgeText}>4.8</Text>
          </View>
        </View>

        <View style={styles.plantInfo}>
          <Text style={styles.plantName}>{item.name}</Text>
          <Text style={styles.plantSub}>{item.subtitle}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.plantPrice}>{formatMoney(item.price, locale)}</Text>
            {!item.isUniqueInstance && (
              <TouchableOpacity
                style={styles.plusBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleAddToCart(item.id);
                }}
              >
                <Ionicons name="add" size={15} color={COLORS.black} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMaterialCard = ({ item }: { item: ShopSearchMaterialSummary }) => {
    const imageUri = item.imageUrl?.trim();
    const materialId =
      Number.isInteger(item.materialId) && item.materialId > 0 ? item.materialId : item.id;

    return (
      <TouchableOpacity
        style={styles.featuredCard}
        onPress={() =>
          navigation.navigate('MaterialDetail', {
            materialId,
            nurseryMaterialId: item.id,
          })
        }
        activeOpacity={0.75}
      >
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.plantImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="cube-outline" size={32} color={COLORS.gray500} />
            </View>
          )}

          <View style={[styles.productTypeBadge, styles.productTypeBadgeMaterial]}>
            <Text style={styles.productTypeBadgeText}>
              {t('catalog.typeMaterial', { defaultValue: 'Material' })}
            </Text>
          </View>
        </View>

        <View style={styles.plantInfo}>
          <Text style={styles.plantName} numberOfLines={1}>
            {item.materialName}
          </Text>
          <Text style={styles.plantSub} numberOfLines={1}>
            {`${item.nurseryName} • ${t('catalog.stock', { defaultValue: 'Stock' })}: ${item.availableQuantity}`}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.plantPrice} numberOfLines={1}>
              {item.unit}
            </Text>
            <View style={styles.quickActionRow}>
              <TouchableOpacity
                style={styles.quickBuyBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleBuyNowMaterial(item);
                }}
              >
                <Ionicons name="flash-outline" size={13} color="#13A454" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleAddMaterialToCart(item);
                }}
              >
                <Ionicons name="add" size={15} color={COLORS.black} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderComboCard = ({ item }: { item: ShopSearchComboSummary }) => {
    const imageUri = item.imageUrl?.trim();

    return (
      <TouchableOpacity
        style={styles.featuredCard}
        onPress={() =>
          navigation.navigate('ComboDetail', {
            comboId: item.id,
            nurseryPlantComboId: item.id,
          })
        }
        activeOpacity={0.75}
      >
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.plantImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="albums-outline" size={32} color={COLORS.gray500} />
            </View>
          )}

          <View style={[styles.productTypeBadge, styles.productTypeBadgeCombo]}>
            <Text style={styles.productTypeBadgeText}>
              {t('catalog.typeCombo', { defaultValue: 'Combo' })}
            </Text>
          </View>
        </View>

        <View style={styles.plantInfo}>
          <Text style={styles.plantName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.plantSub} numberOfLines={1}>
            {item.comboTypeName || '-'}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.plantPrice} numberOfLines={1}>
              {formatMoney(item.price, locale)}
            </Text>
            <View style={styles.quickActionRow}>
              <TouchableOpacity
                style={styles.quickBuyBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleBuyNowCombo(item);
                }}
              >
                <Ionicons name="flash-outline" size={13} color="#13A454" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleAddComboToCart(item);
                }}
              >
                <Ionicons name="add" size={15} color={COLORS.black} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const hasMoreAiItems = homePlants.length > 1;
  const showAiArrowLeft = aiScrollX > 4;
  const showAiArrowRight = hasMoreAiItems
    ? aiContentWidth === 0 || aiContentWidth - aiListWidth - aiScrollX > 4
    : false;
  const isNurseryActionDisabled =
    isNurseryPickerLoading ||
    availableNurseryOptions.length === 0 ||
    selectedCartNurseryId === null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentWrap}
        stickyHeaderIndices={[0]}
      >
        <View style={styles.stickyHeader}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="menu" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.brandRow}>
              <Ionicons name="leaf" size={18} color={COLORS.primaryLight} />
              <Text style={styles.brandText}>PlantDecor</Text>
            </View>

            <View style={[styles.headerSide, styles.headerActions]}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => requireAuth(() => navigation.navigate('Wishlist'))}
              >
                <Ionicons name="heart-outline" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => requireAuth(() => navigation.navigate('CartTab'))}
              >
                <Ionicons name="cart-outline" size={22} color={COLORS.textPrimary} />
                {cartItemCount > 0 && <View style={styles.cartDot} />}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={COLORS.primary} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor="#0DA84D"
                value={keyword}
                onChangeText={setKeyword}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles" size={16} color={COLORS.primaryLight} />
          <Text style={styles.sectionTitle}>{t('home.aiSuggestions')}</Text>
        </View>

        <View
          style={styles.aiSliderWrap}
          onLayout={(event) => setAiListWidth(event.nativeEvent.layout.width)}
        >
          <FlatList
            data={homePlants}
            renderItem={renderPlantCard}
            keyExtractor={(item) => `ai-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.aiList}
            ItemSeparatorComponent={() => <View style={styles.aiSeparator} />}
            snapToInterval={CARD_WIDTH + SPACING.md}
            snapToAlignment="start"
            decelerationRate="fast"
            onContentSizeChange={(width) => setAiContentWidth(width)}
            onScroll={(event) => setAiScrollX(event.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
          />
          <View style={styles.aiArrowOverlay} pointerEvents="none">
            {showAiArrowLeft && (
              <View style={[styles.aiArrow, styles.aiArrowLeft]}>
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
              </View>
            )}
            {showAiArrowRight && (
              <View style={[styles.aiArrow, styles.aiArrowRight]}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </View>
            )}
          </View>
        </View>

        <LinearGradient
          colors={[COLORS.primaryDark, COLORS.primary]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTag}>{t('home.summerTag')}</Text>
              <Text style={styles.bannerTitle}>{t('home.summerTitle', { newline: '\n' })}</Text>
              <TouchableOpacity style={styles.bannerBtn}>
                <Text style={styles.bannerBtnText}>{t('home.discoverNow')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bannerRight}>
              <Ionicons name="leaf" size={72} color={COLORS.secondaryLight} />
            </View>
          </View>
        </LinearGradient>

        <Text style={styles.bestSellerTitle}>{t('home.bestSeller')}</Text>

        <FlatList
          data={homePlants}
          renderItem={renderPlantCard}
          keyExtractor={(item) => `best-${item.id}`}
          numColumns={2}
          columnWrapperStyle={styles.plantRow}
          scrollEnabled={false}
          contentContainerStyle={styles.bestList}
        />

        <View style={styles.featuredSectionHeader}>
          <Text style={styles.featuredSectionTitle}>
            {t('catalog.typeMaterial', { defaultValue: 'Material' })}
          </Text>
        </View>

        {isLoadingFeaturedProducts && featuredMaterials.length === 0 ? (
          <View style={styles.featuredLoadingWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={featuredMaterials}
            renderItem={renderMaterialCard}
            keyExtractor={(item) => `home-material-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
            ItemSeparatorComponent={() => <View style={styles.featuredSeparator} />}
          />
        )}

        <View style={styles.featuredSectionHeader}>
          <Text style={styles.featuredSectionTitle}>
            {t('catalog.typeCombo', { defaultValue: 'Combo' })}
          </Text>
        </View>

        {isLoadingFeaturedProducts && featuredCombos.length === 0 ? (
          <View style={styles.featuredLoadingWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={featuredCombos}
            renderItem={renderComboCard}
            keyExtractor={(item) => `home-combo-${item.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
            ItemSeparatorComponent={() => <View style={styles.featuredSeparator} />}
          />
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={isNurseryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={closeNurseryPicker}
      >
        <View style={styles.nurseryPickerOverlay}>
          <TouchableOpacity
            style={styles.nurseryPickerBackdrop}
            activeOpacity={1}
            onPress={closeNurseryPicker}
          />

          <View style={styles.nurseryPickerSheet}>
            <View style={styles.nurseryPickerHandle} />
            <View style={styles.nurseryPickerHeader}>
              <Text style={styles.nurseryPickerTitle}>
                {t('catalog.selectNurseryTitle', {
                  defaultValue: 'Select a nursery',
                })}
              </Text>
              <TouchableOpacity style={styles.nurseryPickerCloseBtn} onPress={closeNurseryPicker}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {pendingCartPlant && (
              <Text style={styles.nurseryPickerPlantName} numberOfLines={1}>
                {pendingCartPlant.name}
              </Text>
            )}

            {isNurseryPickerLoading ? (
              <View style={styles.nurseryPickerLoadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : availableNurseryOptions.length === 0 ? (
              <Text style={styles.nurseryPickerEmptyText}>
                {t('catalog.noNurseryAvailable', {
                  defaultValue: 'No nursery is currently available for this plant.',
                })}
              </Text>
            ) : (
              <ScrollView
                style={styles.nurseryPickerList}
                showsVerticalScrollIndicator={false}
              >
                {availableNurseryOptions.map((nursery) => {
                  const isSelected = nursery.nurseryId === selectedCartNurseryId;

                  return (
                    <TouchableOpacity
                      key={`${nursery.nurseryId}-${nursery.commonPlantId ?? 'none'}`}
                      style={[
                        styles.nurseryPickerItem,
                        isSelected && styles.nurseryPickerItemSelected,
                      ]}
                      onPress={() => setSelectedCartNurseryId(nursery.nurseryId)}
                    >
                      <View style={styles.nurseryPickerItemHeader}>
                        <Text style={styles.nurseryPickerItemName}>{nursery.nurseryName}</Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#13EC5B" />
                        )}
                      </View>

                      <Text style={styles.nurseryPickerItemAddress}>{nursery.address}</Text>
                      <View style={styles.nurseryPickerItemMetaRow}>
                        <Text style={styles.nurseryPickerItemMetaText}>
                          {t('plantDetail.availableCount', {
                            defaultValue: 'Available',
                          })}
                          : {nursery.availableInstanceCount}
                        </Text>
                        <Text style={styles.nurseryPickerItemPrice}>
                          {formatNurseryPrice(nursery.minPrice, nursery.maxPrice)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {!isNurseryPickerLoading && availableNurseryOptions.length > 0 && (
              <View style={styles.nurseryPickerQuantityRow}>
                <Text style={styles.nurseryPickerQuantityLabel}>
                  {t('cart.quantity', { defaultValue: 'Quantity' })}
                </Text>
                <View style={styles.nurseryPickerQuantityControl}>
                  <TouchableOpacity
                    style={[
                      styles.nurseryPickerQuantityBtn,
                      selectedCartQuantity <= 1 && styles.nurseryPickerQuantityBtnDisabled,
                    ]}
                    disabled={selectedCartQuantity <= 1}
                    onPress={() =>
                      setSelectedCartQuantity((previous) => Math.max(1, previous - 1))
                    }
                  >
                    <Ionicons name="remove" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>

                  <Text style={styles.nurseryPickerQuantityValue}>{selectedCartQuantity}</Text>

                  <TouchableOpacity
                    style={styles.nurseryPickerQuantityBtn}
                    onPress={() =>
                      setSelectedCartQuantity((previous) => Math.min(99, previous + 1))
                    }
                  >
                    <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.nurseryPickerActionRow}>
              <TouchableOpacity
                style={[
                  styles.nurseryPickerBuyNowBtn,
                  isNurseryActionDisabled && styles.nurseryPickerConfirmBtnDisabled,
                ]}
                disabled={isNurseryActionDisabled}
                onPress={() => void handleConfirmNurseryAdd(true)}
              >
                <Text style={styles.nurseryPickerBuyNowText}>
                  {`${t('plantDetail.buyNow', { defaultValue: 'Buy now' })} x${selectedCartQuantity}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.nurseryPickerConfirmBtn,
                  isNurseryActionDisabled && styles.nurseryPickerConfirmBtnDisabled,
                ]}
                disabled={isNurseryActionDisabled}
                onPress={() => void handleConfirmNurseryAdd(false)}
              >
                <Text style={styles.nurseryPickerConfirmText}>
                  {`${t('plantDetail.addToCart', { defaultValue: 'Add to cart' })} x${selectedCartQuantity}`}
                </Text>
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
    backgroundColor: COLORS.background,
  },
  contentWrap: {
    paddingHorizontal: SPACING.lg,
  },
  stickyHeader: {
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  headerSide: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActions: {
    justifyContent: 'flex-end',
    gap: SPACING.xs,
  },
  iconBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandText: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cartDot: {
    position: 'absolute',
    top: 6,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7FDF0',
    borderRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderWidth: 0.5,
    borderColor: '#0DA84D',
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: '#0DA84D',
    padding: 0,
  },
  filterToggle: {
    width: 40,
    height: 40,
    backgroundColor: '#E7FDF0',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#0DA84D',
  },
  sortList: {
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  sortChip: {
    backgroundColor: COLORS.gray200,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
  },
  sortChipActive: {
    backgroundColor: COLORS.primaryLight,
    ...SHADOWS.md,
  },
  sortText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sortTextActive: {
    color: COLORS.white,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  aiSliderWrap: {
    position: 'relative',
  },
  aiList: {
    paddingRight: SPACING.lg,
  },
  aiSeparator: {
    width: SPACING.md,
  },
  aiArrowOverlay: {
    position: 'absolute',
    top: 0,
    height: CARD_WIDTH,
    left: -10,
    right: 0,
    alignItems: 'center',
  },
  aiArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiArrowLeft: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -8,
  },
  aiArrowRight: {
    position: 'absolute',
    right: 4,
    top: '50%',
    marginTop: -8,
  },
  sectionTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  plantRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  plantCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.xl,
    padding: SPACING.sm,
  },
  featuredCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.xl,
    padding: SPACING.sm,
  },
  imageWrap: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
    height: CARD_WIDTH,
    position: 'relative',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantImage: {
    width: '100%',
    height: '100%',
  },
  hotBadge: {
    position: 'absolute',
    left: SPACING.sm,
    top: SPACING.sm,
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  hotBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  favoriteBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    left: SPACING.sm,
    bottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gray800,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  ratingBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  productTypeBadge: {
    position: 'absolute',
    left: SPACING.sm,
    bottom: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  productTypeBadgeMaterial: {
    backgroundColor: 'rgba(45, 106, 79, 0.85)',
  },
  productTypeBadgeCombo: {
    backgroundColor: 'rgba(49, 81, 180, 0.85)',
  },
  productTypeBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  plantInfo: {
    paddingTop: SPACING.sm,
    gap: 2,
  },
  plantName: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  plantSub: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
  },
  priceRow: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plantPrice: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.primaryLight,
    flex: 1,
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  quickBuyBtn: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#13A454',
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtn: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtnDisabled: {
    opacity: 0.35,
  },
  banner: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    minHeight: 145,
  },
  bannerLeft: {
    flex: 2,
    padding: SPACING.lg,
    justifyContent: 'space-between',
  },
  bannerTag: {
    color: COLORS.secondaryLight,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  bannerTitle: {
    color: COLORS.white,
    fontSize: FONTS.sizes['3xl'],
    fontWeight: '700',
    lineHeight: 30,
  },
  bannerBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  bannerBtnText: {
    color: COLORS.black,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  bannerRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  bestSellerTitle: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
    fontSize: FONTS.sizes['3xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  featuredSectionHeader: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  featuredSectionTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  featuredList: {
    paddingBottom: SPACING.sm,
  },
  featuredSeparator: {
    width: SPACING.md,
  },
  featuredLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
  },
  bestList: {
    paddingBottom: SPACING.lg,
  },
  bottomSpace: {
    height: 80,
  },
  nurseryPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  nurseryPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  nurseryPickerSheet: {
    maxHeight: '78%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  nurseryPickerHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray300,
    marginBottom: SPACING.sm,
  },
  nurseryPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  nurseryPickerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryPickerCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  nurseryPickerPlantName: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  nurseryPickerLoadingWrap: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  nurseryPickerEmptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingVertical: SPACING.lg,
  },
  nurseryPickerList: {
    maxHeight: 260,
  },
  nurseryPickerItem: {
    borderWidth: 1,
    borderColor: '#D7E4DB',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  nurseryPickerItemSelected: {
    borderColor: '#13EC5B',
    backgroundColor: '#EDFEF3',
  },
  nurseryPickerItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  nurseryPickerItemName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryPickerItemAddress: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  nurseryPickerItemMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nurseryPickerItemMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  nurseryPickerItemPrice: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: '#13A454',
  },
  nurseryPickerQuantityRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nurseryPickerQuantityLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  nurseryPickerQuantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  nurseryPickerQuantityBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D7E4DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  nurseryPickerQuantityBtnDisabled: {
    opacity: 0.4,
  },
  nurseryPickerQuantityValue: {
    minWidth: 20,
    textAlign: 'center',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryPickerActionRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  nurseryPickerBuyNowBtn: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#13A454',
  },
  nurseryPickerBuyNowText: {
    color: '#13A454',
    fontWeight: '700',
  },
  nurseryPickerConfirmBtn: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    backgroundColor: '#13EC5B',
  },
  nurseryPickerConfirmBtnDisabled: {
    opacity: 0.4,
  },
  nurseryPickerConfirmText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
