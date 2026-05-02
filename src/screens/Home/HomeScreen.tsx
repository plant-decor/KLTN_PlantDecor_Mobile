import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
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
import { BrandMark } from '../../components/branding';
import { usePlantStore, useCartStore, useAuthStore, useWishlistStore } from '../../stores';
import {
  AddCartItemRequest,
  CheckoutItem,
  MainTabParamList,
  PreferencesRecommendationPlant,
  Plant,
  RootStackParamList,
  ShopSearchComboSummary,
  ShopSearchMaterialSummary,
  WishlistItemType,
} from '../../types';
import { plantService } from '../../services';
import { getWishlistKey, notify } from '../../utils';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type HomePlant = {
  id: number;
  commonPlantId: number | null;
  name: string;
  subtitle: string;
  price: number;
  isUniqueInstance: boolean;
  image?: string;
};

type WishlistTarget = {
  itemType: WishlistItemType;
  itemId: number;
};

type NurseryPickerMode = 'plant' | 'material' | 'combo';

type NurseryPickerOption = {
  nurseryId: number;
  nurseryName: string;
  address: string;
  phone?: string | null;
  actionId: number | null;
  availableCount?: number;
  minPrice?: number;
  maxPrice?: number;
};

type PendingNurserySelection = {
  mode: NurseryPickerMode;
  displayName: string;
  image?: string;
  unitPrice: number;
  buyNowItemTypeName: 'CommonPlant' | 'NurseryMaterial' | 'NurseryPlantCombo';
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 3) / 2 - 2;

const formatMoney = (amount: number, locale: string): string =>
  `${Math.max(0, amount).toLocaleString(locale)}₫`;

const toPositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const resolveMaterialWishlistTarget = (
  material: ShopSearchMaterialSummary
): WishlistTarget | null => {
  const materialId = toPositiveInt(material.materialId) ?? toPositiveInt(material.id);
  if (!materialId) {
    return null;
  }

  return { itemType: 'Material', itemId: materialId };
};

const resolveComboWishlistTarget = (combo: ShopSearchComboSummary): WishlistTarget | null => {
  const comboId = toPositiveInt(combo.id);
  if (!comboId) {
    return null;
  }

  return { itemType: 'PlantCombo', itemId: comboId };
};

const resolveImageCandidate = (entry: unknown): string | undefined => {
  if (typeof entry === 'string' && entry.trim().length > 0) {
    return entry;
  }

  if (!entry || typeof entry !== 'object') {
    return undefined;
  }

  const imageRecord = entry as {
    imageUrl?: unknown;
    url?: unknown;
    uri?: unknown;
  };
  const candidate = imageRecord.imageUrl ?? imageRecord.url ?? imageRecord.uri;
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate
    : undefined;
};

const resolveEntityImage = (entity: {
  images?: unknown;
  primaryImageUrl?: unknown;
  imageUrl?: unknown;
}): string | undefined => {
  if (Array.isArray(entity.images)) {
    const fromCollection = entity.images
      .map(resolveImageCandidate)
      .find((entry): entry is string => Boolean(entry));

    if (fromCollection) {
      return fromCollection;
    }
  }

  const primary = resolveImageCandidate(entity.primaryImageUrl);
  if (primary) {
    return primary;
  }

  return resolveImageCandidate(entity.imageUrl);
};

const resolveHomePlantWishlistTarget = (plant: HomePlant): WishlistTarget | null => {
  const entityId = plant.id;
  if (!entityId) {
    return null;
  }

  const shouldUsePlantInstanceTarget =
    plant.isUniqueInstance ||
    (plant.commonPlantId !== null && plant.commonPlantId !== entityId);

  if (shouldUsePlantInstanceTarget) {
    return { itemType: 'PlantInstance', itemId: entityId };
  }

  return {
    itemType: 'Plant',
    itemId: plant.commonPlantId ?? entityId,
  };
};

const resolveRecommendationImage = (
  item: PreferencesRecommendationPlant
): string | undefined => {
  return resolveEntityImage(item);
};

const mapRecommendationItemToHomePlant = (
  item: PreferencesRecommendationPlant,
  subtitle: string
): HomePlant | null => {
  const numericId =
    toPositiveInt(item.plantId) ??
    toPositiveInt(item.id) ??
    toPositiveInt(item.commonPlantId);

  if (!numericId) {
    return null;
  }

  const rawPrice = Number(item.basePrice ?? item.price);
  const price = Number.isFinite(rawPrice) ? Math.max(0, rawPrice) : 0;
  const displayName =
    (typeof item.name === 'string' ? item.name.trim() : '') ||
    (typeof item.plantName === 'string' ? item.plantName.trim() : '') ||
    `Plant #${numericId}`;

  return {
    id: numericId,
    commonPlantId: toPositiveInt(item.commonPlantId),
    name: displayName,
    subtitle,
    price,
    isUniqueInstance: Boolean(item.isUniqueInstance),
    image: resolveRecommendationImage(item),
  };
};

const resolveSliderIndex = (scrollX: number, itemCount: number) => {
  if (itemCount <= 1) {
    return 0;
  }

  const estimatedIndex = Math.round(scrollX / (CARD_WIDTH + SPACING.md));
  return Math.max(0, Math.min(itemCount - 1, estimatedIndex));
};

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const {
    plants,
    fetchPlants,
    fetchNurseriesGotCommonPlantByPlantId,
    fetchNurseriesGotMaterialByMaterialId,
    fetchNurseriesGotPlantComboByPlantComboId,
  } = usePlantStore();
  const addCartItem = useCartStore((state) => state.addCartItem);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const hasLoadedCart = useCartStore((state) => state.hasLoadedCart);
  const { isAuthenticated } = useAuthStore();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const [keyword, setKeyword] = useState('');
  const [aiListWidth, setAiListWidth] = useState(0);
  const [aiContentWidth, setAiContentWidth] = useState(0);
  const [aiScrollX, setAiScrollX] = useState(0);
  const [materialScrollX, setMaterialScrollX] = useState(0);
  const [comboScrollX, setComboScrollX] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingNewestPlants, setIsLoadingNewestPlants] = useState(false);
  const [recommendedPlants, setRecommendedPlants] = useState<HomePlant[]>([]);
  const [hasRecommendationPayload, setHasRecommendationPayload] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const wishlistStatus = useWishlistStore((state) => state.statusByKey);
  const ensureWishlistStatus = useWishlistStore((state) => state.ensureStatus);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const clearWishlistStatus = useWishlistStore((state) => state.clearStatus);
  const [isNurseryPickerVisible, setIsNurseryPickerVisible] = useState(false);
  const [isNurseryPickerLoading, setIsNurseryPickerLoading] = useState(false);
  const [pendingNurserySelection, setPendingNurserySelection] =
    useState<PendingNurserySelection | null>(null);
  const [availableNurseryOptions, setAvailableNurseryOptions] =
    useState<NurseryPickerOption[]>([]);
  const [selectedCartNurseryId, setSelectedCartNurseryId] = useState<number | null>(null);
  const [selectedCartQuantity, setSelectedCartQuantity] = useState(1);
  const [featuredMaterials, setFeaturedMaterials] = useState<ShopSearchMaterialSummary[]>([]);
  const [featuredCombos, setFeaturedCombos] = useState<ShopSearchComboSummary[]>([]);
  const [isLoadingFeaturedProducts, setIsLoadingFeaturedProducts] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || hasLoadedCart) {
      return;
    }

    void fetchCart({ pageNumber: 1, pageSize: 20 }).catch(() => {
      // Keep current UI if cart prefetch fails.
    });
  }, [fetchCart, hasLoadedCart, isAuthenticated]);

  const loadNewestPlants = useCallback(async () => {
    setIsLoadingNewestPlants(true);
    try {
      await fetchPlants({
        sortBy: 'createdAt',
        sortDirection: 'desc',
      });
    } finally {
      setIsLoadingNewestPlants(false);
    }
  }, [fetchPlants]);

  useEffect(() => {
    void loadNewestPlants();
  }, [loadNewestPlants]);

  useEffect(() => {
    if (!isAuthenticated) {
      setHasRecommendationPayload(false);
      setRecommendedPlants([]);
      setIsLoadingRecommendations(false);
      return;
    }

    let isMounted = true;

    const loadRecommendations = async () => {
      setIsLoadingRecommendations(true);

      try {
        const payload = await plantService.getPreferencesRecommendations();

        if (!isMounted) {
          return;
        }

        if (payload === null) {
          setHasRecommendationPayload(false);
          setRecommendedPlants([]);
          return;
        }

        const subtitle = t('home.defaultSubtitle');
        const normalizedRecommendations = payload
          .map((entry) => mapRecommendationItemToHomePlant(entry, subtitle))
          .filter((entry): entry is HomePlant => Boolean(entry))
          .slice(0, 8);

        setHasRecommendationPayload(true);
        setRecommendedPlants(normalizedRecommendations);
      } catch {
        if (isMounted) {
          setHasRecommendationPayload(false);
          setRecommendedPlants([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingRecommendations(false);
        }
      }
    };

    void loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, t]);

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

  const newestPlants = useMemo<HomePlant[]>(() => {
    if (plants.length === 0) {
      return [];
    }

    const subtitle = t('home.defaultSubtitle');
    return plants
      .slice(0, 8)
      .map((item: Plant) => ({
        id: toPositiveInt(item.id) ?? 0,
        commonPlantId: toPositiveInt(item.commonPlantId),
        name: item.name,
        subtitle,
        price: item.basePrice ?? 0,
        isUniqueInstance: item.isUniqueInstance,
        image: resolveEntityImage(
          item as {
            images?: unknown;
            primaryImageUrl?: unknown;
            imageUrl?: unknown;
          }
        ),
      }))
      .filter((item) => item.id > 0);
  }, [plants, t]);

  const wishlistTargets = useMemo(() => {
    const plantTargets = [...newestPlants, ...recommendedPlants]
      .map(resolveHomePlantWishlistTarget)
      .filter((target): target is WishlistTarget => target !== null);

    const materialTargets = featuredMaterials
      .map(resolveMaterialWishlistTarget)
      .filter((target): target is WishlistTarget => target !== null);

    const comboTargets = featuredCombos
      .map(resolveComboWishlistTarget)
      .filter((target): target is WishlistTarget => target !== null);

    const dedupedTargets = new Map<string, WishlistTarget>();
    [...plantTargets, ...materialTargets, ...comboTargets].forEach((target) => {
      dedupedTargets.set(getWishlistKey(target.itemType, target.itemId), target);
    });

    return Array.from(dedupedTargets.values());
  }, [featuredCombos, featuredMaterials, newestPlants, recommendedPlants]);

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

  const handleSearchSubmit = useCallback(() => {
    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword.length > 0) {
      navigation.navigate('Catalog', { keyword: trimmedKeyword });
      return;
    }

    navigation.navigate('Catalog');
  }, [keyword, navigation]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

    const refreshFeaturedProducts = async () => {
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
        setFeaturedMaterials([]);
        setFeaturedCombos([]);
      }
    };

    const refreshRecommendations = async () => {
      try {
        const payload = await plantService.getPreferencesRecommendations();

        if (payload === null) {
          setHasRecommendationPayload(false);
          setRecommendedPlants([]);
          return;
        }

        const subtitle = t('home.defaultSubtitle');
        const normalizedRecommendations = payload
          .map((entry) => mapRecommendationItemToHomePlant(entry, subtitle))
          .filter((entry): entry is HomePlant => Boolean(entry))
          .slice(0, 8);

        setHasRecommendationPayload(true);
        setRecommendedPlants(normalizedRecommendations);
      } catch {
        setHasRecommendationPayload(false);
        setRecommendedPlants([]);
      }
    };

    const refreshTasks: Promise<unknown>[] = [
      loadNewestPlants(),
      refreshFeaturedProducts(),
    ];

    if (isAuthenticated) {
      refreshTasks.push(refreshRecommendations());
      refreshTasks.push(
        fetchCart({ pageNumber: 1, pageSize: 20 }).catch(() => undefined)
      );
    }

    void Promise.all(refreshTasks).finally(() => {
      setIsRefreshing(false);
    });
  }, [fetchCart, isAuthenticated, isRefreshing, loadNewestPlants, t]);

  const submitAddToCart = useCallback(
    async (request: AddCartItemRequest) => {
      if (!requireAuth()) {
        return null;
      }

      console.log('[Home][submitAddToCart] request:', request);
      const payload = await addCartItem(request);

      if (!payload) {
        console.warn('[Home][submitAddToCart] failed:', {
          request,
          error: 'Store addCartItem returned null',
        });
        notify({
          message: t('cart.addFailed', {
            defaultValue: 'Unable to add to cart.',
          }),
        });
        return null;
      }

      console.log('[Home][submitAddToCart] response:', {
        cartItemId: payload.id,
        commonPlantId: payload.commonPlantId,
        nurseryPlantComboId: payload.nurseryPlantComboId,
        nurseryMaterialId: payload.nurseryMaterialId,
      });

      return payload;
    },
    [addCartItem, requireAuth, t]
  );

  const closeNurseryPicker = useCallback(() => {
    setIsNurseryPickerVisible(false);
    setIsNurseryPickerLoading(false);
    setPendingNurserySelection(null);
    setAvailableNurseryOptions([]);
    setSelectedCartNurseryId(null);
    setSelectedCartQuantity(1);
  }, []);

  const openNurseryPicker = useCallback(
    async (
      selection: PendingNurserySelection,
      fetchOptions: () => Promise<NurseryPickerOption[]>
    ) => {
      if (!requireAuth()) {
        return;
      }

      setPendingNurserySelection(selection);
      setIsNurseryPickerVisible(true);
      setIsNurseryPickerLoading(true);
      setAvailableNurseryOptions([]);
      setSelectedCartNurseryId(null);
      setSelectedCartQuantity(1);

      try {
        const options = await fetchOptions();
        const normalizedOptions = options ?? [];
        setAvailableNurseryOptions(normalizedOptions);
        setSelectedCartNurseryId(normalizedOptions[0]?.nurseryId ?? null);
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

  const handleConfirmNurseryAdd = useCallback(
    async (goToCheckout = false) => {
      if (!pendingNurserySelection || selectedCartNurseryId === null) {
        return;
      }

      const selectedNursery = availableNurseryOptions.find(
        (option) => option.nurseryId === selectedCartNurseryId
      );

      if (!selectedNursery || selectedNursery.actionId == null) {
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
          id: selectedNursery.actionId,
          name: pendingNurserySelection.displayName,
          image: pendingNurserySelection.image,
          price: selectedNursery.minPrice ?? pendingNurserySelection.unitPrice,
          quantity,
          buyNowItemId: selectedNursery.actionId,
          buyNowItemTypeName: pendingNurserySelection.buyNowItemTypeName,
          isUniqueInstance: false,
        };

        closeNurseryPicker();
        navigation.navigate('Checkout', {
          source: 'buy-now',
          items: [checkoutItem],
        });
        return;
      }

      const request: AddCartItemRequest = {
        commonPlantId:
          pendingNurserySelection.mode === 'plant' ? selectedNursery.actionId : null,
        nurseryPlantComboId:
          pendingNurserySelection.mode === 'combo' ? selectedNursery.actionId : null,
        nurseryMaterialId:
          pendingNurserySelection.mode === 'material' ? selectedNursery.actionId : null,
        quantity,
      };

      const payload = await submitAddToCart(request);

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
      pendingNurserySelection,
      selectedCartNurseryId,
      selectedCartQuantity,
      submitAddToCart,
      t,
    ]
  );

  const handleSelectPlantNursery = useCallback(
    async (plant: HomePlant) => {
      if (plant.isUniqueInstance) {
        notify({
          message: t('catalog.uniquePlantCannotCart', {
            defaultValue: 'Unique plants cannot be added to cart directly.',
          }),
        });
        return;
      }

      await openNurseryPicker(
        {
          mode: 'plant',
          displayName: plant.name,
          image: plant.image,
          unitPrice: plant.price,
          buyNowItemTypeName: 'CommonPlant',
        },
        async () => {
          const options = await fetchNurseriesGotCommonPlantByPlantId(plant.id);
          return (options ?? []).map((option) => ({
            nurseryId: option.nurseryId,
            nurseryName: option.nurseryName,
            address: option.address,
            phone: option.phone,
            actionId: option.commonPlantId ?? null,
            availableCount: option.availableInstanceCount,
            minPrice: option.minPrice,
            maxPrice: option.maxPrice,
          }));
        }
      );
    },
    [fetchNurseriesGotCommonPlantByPlantId, openNurseryPicker, t]
  );

  const handleAddMaterialToCart = useCallback(
    async (material: ShopSearchMaterialSummary) => {
      const materialEntityId =
        Number.isInteger(material.materialId) && material.materialId > 0
          ? material.materialId
          : material.id;

      await openNurseryPicker(
        {
          mode: 'material',
          displayName: material.materialName,
          image: material.primaryImageUrl?.trim() || undefined,
          unitPrice: material.basePrice,
          buyNowItemTypeName: 'NurseryMaterial',
        },
        async () => {
          const options = await fetchNurseriesGotMaterialByMaterialId(materialEntityId);
          return (options ?? []).map((option) => ({
            nurseryId: option.id,
            nurseryName: option.name,
            address: option.address,
            phone: option.phone,
            availableCount: option.quantity ?? undefined,
            actionId: option.nurseryMaterialId ?? null,
          }));
        }
      );
    },
    [fetchNurseriesGotMaterialByMaterialId, openNurseryPicker]
  );

  const handleAddComboToCart = useCallback(
    async (combo: ShopSearchComboSummary) => {
      await openNurseryPicker(
        {
          mode: 'combo',
          displayName: combo.name,
          image: combo.primaryImageUrl?.trim() || undefined,
          unitPrice: Math.max(0, combo.price || 0),
          buyNowItemTypeName: 'NurseryPlantCombo',
        },
        async () => {
          const options = await fetchNurseriesGotPlantComboByPlantComboId(combo.id);
          return (options ?? []).map((option) => ({
            nurseryId: option.id,
            nurseryName: option.name,
            address: option.address,
            phone: option.phone,
            availableCount: option.quantity ?? undefined,
            actionId: option.nurseryPlantComboId ?? null,
          }));
        }
      );
    },
    [fetchNurseriesGotPlantComboByPlantComboId, openNurseryPicker]
  );

  const handleAddToCart = useCallback(
    async (plant: HomePlant) => {
      await handleSelectPlantNursery(plant);
    },
    [handleSelectPlantNursery]
  );

  const isWishlistTargetActive = useCallback(
    (wishlistTarget: WishlistTarget | null) => {
      if (!wishlistTarget) {
        return false;
      }

      const wishlistKey = getWishlistKey(wishlistTarget.itemType, wishlistTarget.itemId);
      return wishlistStatus[wishlistKey] ?? false;
    },
    [wishlistStatus]
  );

  const handleToggleWishlistTarget = useCallback(
    async (wishlistTarget: WishlistTarget | null) => {
      if (!wishlistTarget) {
        notify({
          message: t('wishlist.invalidItem', {
            defaultValue: 'Unable to add this item to wishlist.',
          }),
        });
        return;
      }

      if (!requireAuth()) {
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
    },
    [requireAuth, t, toggleWishlist, wishlistStatus]
  );

  const handleToggleWishlist = useCallback(
    async (plant: HomePlant) => {
      await handleToggleWishlistTarget(resolveHomePlantWishlistTarget(plant));
    },
    [handleToggleWishlistTarget]
  );

  const handleToggleMaterialWishlist = useCallback(
    async (material: ShopSearchMaterialSummary) => {
      await handleToggleWishlistTarget(resolveMaterialWishlistTarget(material));
    },
    [handleToggleWishlistTarget]
  );

  const handleToggleComboWishlist = useCallback(
    async (combo: ShopSearchComboSummary) => {
      await handleToggleWishlistTarget(resolveComboWishlistTarget(combo));
    },
    [handleToggleWishlistTarget]
  );

  const isWishlisted = useCallback(
    (plant: HomePlant) => isWishlistTargetActive(resolveHomePlantWishlistTarget(plant)),
    [isWishlistTargetActive]
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

          {!item.isUniqueInstance && (
            <TouchableOpacity
              style={styles.favoriteBtn}
              onPress={(event) => {
                event.stopPropagation();
                void handleToggleWishlist(item);
              }}
            >
              <Ionicons
                name={isWishlisted(item) ? 'heart' : 'heart-outline'}
                size={16}
                color={isWishlisted(item) ? COLORS.error : COLORS.white}
              />
            </TouchableOpacity>
          )}
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
                  void handleAddToCart(item);
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
    const imageUri = item.primaryImageUrl?.trim();
    const materialId =
      Number.isInteger(item.materialId) && item.materialId > 0 ? item.materialId : item.id;
    const materialWishlistTarget = resolveMaterialWishlistTarget(item);
    const isMaterialWishlisted = isWishlistTargetActive(materialWishlistTarget);

    return (
      <TouchableOpacity
        style={styles.featuredCard}
        onPress={() =>
          navigation.navigate('MaterialDetail', {
            materialId
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

          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={(event) => {
              event.stopPropagation();
              void handleToggleMaterialWishlist(item);
            }}
          >
            <Ionicons
              name={isMaterialWishlisted ? 'heart' : 'heart-outline'}
              size={16}
              color={isMaterialWishlisted ? COLORS.error : COLORS.white}
            />
          </TouchableOpacity>

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
            {`${item.unit}`}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.plantPrice} numberOfLines={1}>
              {formatMoney(item.basePrice, locale)}
            </Text>
            <View style={styles.quickActionRow}>
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
    const imageUri = item.primaryImageUrl?.trim();
    const comboWishlistTarget = resolveComboWishlistTarget(item);
    const isComboWishlisted = isWishlistTargetActive(comboWishlistTarget);

    return (
      <TouchableOpacity
        style={styles.featuredCard}
        onPress={() =>
          navigation.navigate('ComboDetail', {
            comboId: item.id,
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

          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={(event) => {
              event.stopPropagation();
              void handleToggleComboWishlist(item);
            }}
          >
            <Ionicons
              name={isComboWishlisted ? 'heart' : 'heart-outline'}
              size={16}
              color={isComboWishlisted ? COLORS.error : COLORS.white}
            />
          </TouchableOpacity>

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

  const hasMoreAiItems = newestPlants.length > 1;
  const showAiArrowLeft = aiScrollX > 4;
  const showAiArrowRight = hasMoreAiItems
    ? aiContentWidth === 0 || aiContentWidth - aiListWidth - aiScrollX > 4
    : false;
  const showRecommendations =
    isAuthenticated && hasRecommendationPayload && recommendedPlants.length > 0;
  const materialSliderIndex = resolveSliderIndex(materialScrollX, featuredMaterials.length);
  const comboSliderIndex = resolveSliderIndex(comboScrollX, featuredCombos.length);
  const isNurseryActionDisabled =
    isNurseryPickerLoading ||
    availableNurseryOptions.length === 0 ||
    selectedCartNurseryId === null;

  const renderSliderIndicators = (
    totalItems: number,
    activeIndex: number,
    keyPrefix: string
  ) => {
    if (totalItems <= 1) {
      return null;
    }

    return (
      <View style={styles.sliderIndicatorRow}>
        {Array.from({ length: totalItems - 1 }).map((_, index) => (
          <View
            key={`${keyPrefix}-${index}`}
            style={[
              styles.sliderIndicatorDot,
              index === activeIndex && styles.sliderIndicatorDotActive,
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentWrap}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.stickyHeader}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="menu" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.brandRow}>
              <BrandMark variant="logoWithText" size="majorHeader" />
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
                onPress={() => requireAuth(() => navigation.navigate('Cart'))}
              >
                <Ionicons name="cart-outline" size={22} color={COLORS.textPrimary} />
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
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="leaf" size={16} color={COLORS.primaryLight} />
          <Text style={styles.sectionTitle}>{t('home.newestPlants')}</Text>
        </View>

        {isLoadingNewestPlants && newestPlants.length === 0 ? (
          <View style={styles.newestLoadingWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : (
          <View
            style={styles.aiSliderWrap}
            onLayout={(event) => setAiListWidth(event.nativeEvent.layout.width)}
          >
            <FlatList
              data={newestPlants}
              renderItem={renderPlantCard}
              keyExtractor={(item) => `newest-${item.id}`}
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
        )}

        <LinearGradient
          colors={['#1B4332', '#2D6A4F']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.banner}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTag}>{t('home.careServiceTag')}</Text>
              <Text style={styles.bannerTitle}>{t('home.careServiceTitle', { newline: '\n' })}</Text>
              <TouchableOpacity
                style={styles.bannerBtn}
                onPress={() => navigation.navigate('ServiceTab')}
              >
                <Text style={styles.bannerBtnText}>{t('home.bookCareNow')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bannerRight}>
              <Ionicons name="construct-outline" size={66} color={COLORS.secondaryLight} />
            </View>
          </View>
        </LinearGradient>

        {isAuthenticated && isLoadingRecommendations ? (
          <View style={styles.featuredLoadingWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : showRecommendations ? (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="thumbs-up-outline" size={16} color={COLORS.primaryLight} />
              <Text style={styles.sectionTitle}>{t('home.recommendations')}</Text>
            </View>

            <FlatList
              data={recommendedPlants}
              renderItem={renderPlantCard}
              keyExtractor={(item, index) => `recommend-${item.id}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.aiList}
              ItemSeparatorComponent={() => <View style={styles.aiSeparator} />}
              snapToInterval={CARD_WIDTH + SPACING.md}
              snapToAlignment="start"
              decelerationRate="fast"
            />
          </>
        ) : null}

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
          <>
            <FlatList
              data={featuredMaterials}
              renderItem={renderMaterialCard}
              keyExtractor={(item) => `home-material-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
              ItemSeparatorComponent={() => <View style={styles.featuredSeparator} />}
              snapToInterval={CARD_WIDTH + SPACING.md}
              snapToAlignment="start"
              decelerationRate="fast"
              onScroll={(event) => setMaterialScrollX(event.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
            />
            {renderSliderIndicators(
              featuredMaterials.length,
              materialSliderIndex,
              'material-slider'
            )}
          </>
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
          <>
            <FlatList
              data={featuredCombos}
              renderItem={renderComboCard}
              keyExtractor={(item) => `home-combo-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
              ItemSeparatorComponent={() => <View style={styles.featuredSeparator} />}
              snapToInterval={CARD_WIDTH + SPACING.md}
              snapToAlignment="start"
              decelerationRate="fast"
              onScroll={(event) => setComboScrollX(event.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
            />
            {renderSliderIndicators(
              featuredCombos.length,
              comboSliderIndex,
              'combo-slider'
            )}
          </>
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

            {pendingNurserySelection && (
              <Text style={styles.nurseryPickerPlantName} numberOfLines={1}>
                {pendingNurserySelection?.displayName}
              </Text>
            )}

            {isNurseryPickerLoading ? (
              <View style={styles.nurseryPickerLoadingWrap}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : availableNurseryOptions.length === 0 ? (
              <Text style={styles.nurseryPickerEmptyText}>
                {t('catalog.noNurseryAvailableForItem', {
                  defaultValue: 'No nursery is currently available for this item.',
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
                      key={`${nursery.nurseryId}-${nursery.actionId ?? 'none'}`}
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
                      <Text style={styles.nurseryPickerItemPhone}>
                        {`${t('catalog.phone', { defaultValue: 'Phone' })}: ${nursery.phone || '-'}`}
                      </Text>
                      <View style={styles.nurseryPickerItemMetaRow}>
                        <Text style={styles.nurseryPickerItemMetaText}>
                          {t('plantDetail.availableCount', {
                            defaultValue: 'Available',
                          })}
                          : {nursery.availableCount ?? 0}
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
  newestLoadingWrap: {
    minHeight: CARD_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
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
  sliderIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sliderIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray300,
  },
  sliderIndicatorDotActive: {
    width: 16,
    backgroundColor: COLORS.primary,
  },
  featuredLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
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
  nurseryPickerItemPhone: {
    marginTop: 2,
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
