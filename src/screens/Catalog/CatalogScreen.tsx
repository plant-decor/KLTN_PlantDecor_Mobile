import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { BrandMark } from '../../components/branding';
import {
  AddCartItemRequest,
  CheckoutItem,
  RootStackParamList,
  ShopSearchConfigGroup,
  ShopSearchItem,
  ShopSearchMaterialSummary,
  ShopSearchPlantSummary,
  ShopSearchComboSummary,
  ShopSearchRequest,
  WishlistItemType,
} from '../../types';
import { useAuthStore, useCartStore, usePlantStore, useWishlistStore } from '../../stores';
import { plantService } from '../../services';
import { getWishlistKey, notify } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type NumberOption = { value: number; label: string };
type StringOption = { value: string; label: string };
type WishlistTarget = { itemType: WishlistItemType; itemId: number };
type PageToken = number | 'left-ellipsis' | 'right-ellipsis';
type FilterSectionKey =
  | 'productTypes'
  | 'priceRange'
  | 'sort'
  | 'careLevel'
  | 'placement'
  | 'size'
  | 'fengShui'
  | 'combo'
  | 'features'
  | 'categories'
  | 'tags'
  | 'nursery';

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
const CARD_WIDTH = (width - SPACING.lg * 3) / 2;
const PAGE_SIZE_OPTIONS = [10, 20, 40, 80];
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT_BY_OPTIONS: StringOption[] = [
  { value: 'Name', label: 'Name' },
  { value: 'Price', label: 'Price' },
  { value: 'Size', label: 'Size' },
  { value: 'AvailableInstances', label: 'Available' },
  { value: 'CreatedAt', label: 'Newest' },
];
const DEFAULT_SORT_DIRECTION_OPTIONS: StringOption[] = [
  { value: 'Asc', label: 'Asc' },
  { value: 'Desc', label: 'Desc' },
];
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/320x320?text=PlantDecor';
const FLOATING_TAB_BAR_OFFSET = 12;
const MIN_FLOATING_TAB_BAR_HEIGHT = 64;

const normalizeLookup = (value: string): string =>
  value.replace(/[^a-z0-9]/gi, '').toLowerCase();

const toPositiveInt = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
};

const findGroup = (
  groups: ShopSearchConfigGroup[],
  aliases: string[]
): ShopSearchConfigGroup | undefined => {
  const normalizedAliases = aliases.map(normalizeLookup);
  return groups.find((group) => normalizedAliases.includes(normalizeLookup(group.groupName)));
};

const toNumberOptions = (group?: ShopSearchConfigGroup): NumberOption[] => {
  if (!group) {
    return [];
  }

  return group.values
    .map((entry) => {
      const value = Number(entry.value);
      if (!Number.isFinite(value)) {
        return null;
      }

      return {
        value,
        label: entry.name,
      };
    })
    .filter((entry): entry is NumberOption => Boolean(entry));
};

const toStringOptions = (group?: ShopSearchConfigGroup): StringOption[] => {
  if (!group) {
    return [];
  }

  return group.values
    .map((entry) => {
      const value = String(entry.name || entry.value).trim();
      if (!value) {
        return null;
      }

      return {
        value,
        label: entry.name,
      };
    })
    .filter((entry): entry is StringOption => Boolean(entry));
};

const formatMoney = (amount: number, locale: string): string =>
  `${Math.max(0, amount).toLocaleString(locale)}₫`;

const getItemKey = (item: ShopSearchItem, index: number): string => {
  if (item.type === 'Plant') {
    return `Plant-${item.plant?.id ?? index}`;
  }

  if (item.type === 'Material') {
    return `Material-${item.material?.id ?? index}`;
  }

  return `Combo-${item.combo?.id ?? index}`;
};

const resolveWishlistTarget = (item: ShopSearchItem): WishlistTarget | null => {
  if (item.type === 'Plant' && item.plant) {
    const entityId = toPositiveInt(item.plant.id);
    const commonPlantId = toPositiveInt(item.plant.commonPlantId);
    const shouldUsePlantInstanceTarget =
      item.plant.isUniqueInstance ||
      (entityId !== null && commonPlantId !== null && entityId !== commonPlantId);

    if (shouldUsePlantInstanceTarget && entityId) {
      return { itemType: 'PlantInstance', itemId: entityId };
    }

    const plantId = commonPlantId ?? entityId;
    if (plantId) {
      return { itemType: 'Plant', itemId: plantId };
    }

    return null;
  }

  if (item.type === 'Material' && item.material) {
    const materialId = toPositiveInt(item.material.materialId ?? item.material.id);
    if (materialId) {
      return { itemType: 'Material', itemId: materialId };
    }
  }

  if (item.type === 'Combo' && item.combo) {
    const comboId = toPositiveInt(item.combo.id);
    if (comboId) {
      return { itemType: 'PlantCombo', itemId: comboId };
    }
  }

  return null;
};

export default function CatalogScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Catalog'>>();
  const routeKeyword = useMemo(() => {
    const value = route.params?.keyword;
    return typeof value === 'string' ? value.trim() : '';
  }, [route.params?.keyword]);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const { isAuthenticated } = useAuthStore();
  const {
    fetchNurseriesGotCommonPlantByPlantId,
    fetchNurseriesGotMaterialByMaterialId,
    fetchNurseriesGotPlantComboByPlantComboId,
  } = usePlantStore();
  const cartItemCount = useCartStore((state) => state.totalItems());
  const addCartItem = useCartStore((state) => state.addCartItem);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const hasLoadedCart = useCartStore((state) => state.hasLoadedCart);
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const effectiveTabBarHeight = useMemo(() => {
    if (tabBarHeight <= 0) {
      return 0;
    }

    return Math.max(tabBarHeight + FLOATING_TAB_BAR_OFFSET, MIN_FLOATING_TAB_BAR_HEIGHT);
  }, [tabBarHeight]);
  const bottomContentInset = useMemo(
    () => effectiveTabBarHeight + insets.bottom + SPACING.sm,
    [effectiveTabBarHeight, insets.bottom]
  );
  const filterFooterPaddingBottom = useMemo(
    () => effectiveTabBarHeight + insets.bottom + SPACING.lg,
    [effectiveTabBarHeight, insets.bottom]
  );

  const wishlistStatus = useWishlistStore((state) => state.statusByKey);
  const ensureWishlistStatus = useWishlistStore((state) => state.ensureStatus);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const clearWishlistStatus = useWishlistStore((state) => state.clearStatus);

  const [shopItems, setShopItems] = useState<ShopSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [plantTotalCount, setPlantTotalCount] = useState(0);
  const [materialTotalCount, setMaterialTotalCount] = useState(0);
  const [comboTotalCount, setComboTotalCount] = useState(0);

  const [keyword, setKeyword] = useState(routeKeyword);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [selectedCareLevel, setSelectedCareLevel] = useState<number | null>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<number | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<number[]>([]);
  const [selectedFengShuiElement, setSelectedFengShuiElement] = useState<number | null>(null);
  const [selectedComboType, setSelectedComboType] = useState<number | null>(null);
  const [selectedComboSeason, setSelectedComboSeason] = useState<number | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedNurseryId, setSelectedNurseryId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState(DEFAULT_SORT_BY_OPTIONS[0].value);
  const [sortDirection, setSortDirection] = useState(DEFAULT_SORT_DIRECTION_OPTIONS[0].value);

  const [toxicity, setToxicity] = useState(false);
  const [airPurifying, setAirPurifying] = useState(false);
  const [hasFlower, setHasFlower] = useState(false);
  const [petSafe, setPetSafe] = useState(false);
  const [childSafe, setChildSafe] = useState(false);
  const [isUniqueInstance, setIsUniqueInstance] = useState(false);

  const [includePlants, setIncludePlants] = useState(true);
  const [includeMaterials, setIncludeMaterials] = useState(true);
  const [includeCombos, setIncludeCombos] = useState(true);

  const [placementOptions, setPlacementOptions] = useState<NumberOption[]>([]);
  const [careLevelOptions, setCareLevelOptions] = useState<NumberOption[]>([]);
  const [sizeOptions, setSizeOptions] = useState<NumberOption[]>([]);
  const [fengShuiOptions, setFengShuiOptions] = useState<NumberOption[]>([]);
  const [comboTypeOptions, setComboTypeOptions] = useState<NumberOption[]>([]);
  const [comboSeasonOptions, setComboSeasonOptions] = useState<NumberOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<NumberOption[]>([]);
  const [tagOptions, setTagOptions] = useState<NumberOption[]>([]);
  const [nurseryFilterOptions, setNurseryFilterOptions] = useState<NumberOption[]>([]);
  const [sortByOptions, setSortByOptions] = useState<StringOption[]>(DEFAULT_SORT_BY_OPTIONS);
  const [sortDirectionOptions, setSortDirectionOptions] = useState<StringOption[]>(
    DEFAULT_SORT_DIRECTION_OPTIONS
  );

  const [showFilters, setShowFilters] = useState(false);
  const [isFilterDataLoading, setIsFilterDataLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<FilterSectionKey, boolean>
  >({
    productTypes: true,
    priceRange: true,
    sort: true,
    careLevel: true,
    placement: true,
    size: true,
    fengShui: true,
    combo: true,
    features: true,
    categories: true,
    tags: true,
    nursery: true,
  });

  const [isNurseryPickerVisible, setIsNurseryPickerVisible] = useState(false);
  const [isNurseryPickerLoading, setIsNurseryPickerLoading] = useState(false);
  const [pendingNurserySelection, setPendingNurserySelection] =
    useState<PendingNurserySelection | null>(null);
  const [availableNurseryOptions, setAvailableNurseryOptions] =
    useState<NurseryPickerOption[]>([]);
  const [selectedCartNurseryId, setSelectedCartNurseryId] = useState<number | null>(null);
  const [selectedCartQuantity, setSelectedCartQuantity] = useState(1);

  const filterHeight = useRef(new Animated.Value(0)).current;
  const filterOpacity = useRef(new Animated.Value(0)).current;
  const hasLoadedInitialRef = useRef(false);
  const previousRouteKeywordRef = useRef(routeKeyword);

  const toggleArrayValue = (
    value: number,
    setState: React.Dispatch<React.SetStateAction<number[]>>
  ) => {
    setState((previous) =>
      previous.includes(value)
        ? previous.filter((currentValue) => currentValue !== value)
        : [...previous, value]
    );
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(filterHeight, {
        toValue: showFilters ? 1 : 0,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(filterOpacity, {
        toValue: showFilters ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [filterHeight, filterOpacity, showFilters]);

  const loadFilterSources = useCallback(async () => {
    setIsFilterDataLoading(true);
    try {
      const [config, categoriesPayload, tagsPayload, nurseryPayload] = await Promise.all([
        plantService.getShopUnifiedSearchConfig(),
        plantService.getAdminCategories({ pageNumber: 1, pageSize: 200 }),
        plantService.getAdminTags({ pageNumber: 1, pageSize: 200 }),
        plantService.searchNurseries({
          pagination: {
            pageNumber: 1,
            pageSize: 200,
          },
        }),
      ]);

      const filterGroups = config.filterEnums ?? [];
      const sortGroups = config.sortEnums ?? [];

      const nextPlacementOptions = toNumberOptions(
        findGroup(filterGroups, ['PlacementType', 'placementType'])
      );
      const nextCareLevelOptions = toNumberOptions(
        findGroup(filterGroups, ['CareLevelType', 'careLevelType'])
      );
      const nextSizeOptions = toNumberOptions(findGroup(filterGroups, ['PlantSize', 'plantSize']));
      const nextFengShuiOptions = toNumberOptions(
        findGroup(filterGroups, ['FengShuiElement', 'fengShuiElement'])
      );
      const nextComboTypeOptions = toNumberOptions(
        findGroup(filterGroups, ['ComboType', 'comboType'])
      );
      const nextComboSeasonOptions = toNumberOptions(
        findGroup(filterGroups, ['SeasonType', 'seasonType', 'comboSeason'])
      );

      const nextSortByOptions = toStringOptions(
        findGroup(sortGroups, ['UnifiedSearchSortBy', 'sortBy'])
      );
      const nextSortDirectionOptions = toStringOptions(
        findGroup(sortGroups, ['SortDirection', 'sortDirection'])
      );

      setPlacementOptions(nextPlacementOptions);
      setCareLevelOptions(nextCareLevelOptions);
      setSizeOptions(nextSizeOptions);
      setFengShuiOptions(nextFengShuiOptions);
      setComboTypeOptions(nextComboTypeOptions);
      setComboSeasonOptions(nextComboSeasonOptions);
      setSortByOptions(nextSortByOptions.length > 0 ? nextSortByOptions : DEFAULT_SORT_BY_OPTIONS);
      setSortDirectionOptions(
        nextSortDirectionOptions.length > 0
          ? nextSortDirectionOptions
          : DEFAULT_SORT_DIRECTION_OPTIONS
      );

      setSortBy((previous) =>
        previous ||
        nextSortByOptions[0]?.value ||
        DEFAULT_SORT_BY_OPTIONS[0].value
      );
      setSortDirection((previous) =>
        previous ||
        nextSortDirectionOptions[0]?.value ||
        DEFAULT_SORT_DIRECTION_OPTIONS[0].value
      );

      setCategoryOptions(
        (categoriesPayload.items ?? [])
          .map((category) => {
            const value = Number(category.id);
            if (!Number.isFinite(value)) {
              return null;
            }

            return {
              value,
              label: category.name,
            };
          })
          .filter((option): option is NumberOption => Boolean(option))
      );

      setTagOptions(
        (tagsPayload.items ?? [])
          .map((tag) => ({
            value: tag.id,
            label: tag.tagName,
          }))
          .filter((option) => Number.isFinite(option.value))
      );

      setNurseryFilterOptions(
        (nurseryPayload.items ?? []).map((nursery) => ({
          value: nursery.id,
          label: nursery.name,
        }))
      );
    } catch (loadError) {
      console.warn('Catalog filter source load failed:', loadError);
      notify({
        message: t('catalog.filterConfigLoadFailed', {
          defaultValue: 'Could not load all filter options. Fallback values will be used.',
        }),
      });
    } finally {
      setIsFilterDataLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadFilterSources();
  }, [loadFilterSources]);

  const buildSearchRequest = useCallback(
    (
      targetPage: number,
      targetPageSize: number,
      keywordOverride?: string
    ): ShopSearchRequest => ({
      pagination: {
        pageNumber: targetPage,
        pageSize: targetPageSize,
      },
      keyword: (keywordOverride ?? keyword).trim() || undefined,
      minPrice: priceRange.min > 0 ? priceRange.min : undefined,
      maxPrice: priceRange.max > 0 ? priceRange.max : undefined,
      categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      petSafe: petSafe ? true : undefined,
      childSafe: childSafe ? true : undefined,
      comboSeason: selectedComboSeason || undefined,
      comboType: selectedComboType || undefined,
      placementType: selectedPlacement || undefined,
      careLevelType: selectedCareLevel || undefined,
      toxicity: toxicity ? true : undefined,
      airPurifying: airPurifying ? true : undefined,
      hasFlower: hasFlower ? true : undefined,
      isUniqueInstance: isUniqueInstance ? true : undefined,
      sizes: selectedSizes.length > 0 ? selectedSizes : undefined,
      fengShuiElement: selectedFengShuiElement || undefined,
      nurseryId: selectedNurseryId || undefined,
      sortBy: sortBy || undefined,
      sortDirection: sortDirection || undefined,
      includePlants,
      includeMaterials,
      includeCombos,
    }),
    [
      airPurifying,
      childSafe,
      includeCombos,
      includeMaterials,
      includePlants,
      hasFlower,
      isUniqueInstance,
      keyword,
      petSafe,
      priceRange.max,
      priceRange.min,
      selectedCareLevel,
      selectedCategoryIds,
      selectedComboSeason,
      selectedComboType,
      selectedFengShuiElement,
      selectedNurseryId,
      selectedPlacement,
      selectedSizes,
      selectedTagIds,
      sortBy,
      sortDirection,
      toxicity,
    ]
  );

  const performSearch = useCallback(
    async (request: ShopSearchRequest, fallbackPage: number, fallbackPageSize: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await plantService.searchShop(request);
        const itemsPayload = payload.items;

        setShopItems(itemsPayload?.items ?? []);
        setTotalCount(itemsPayload?.totalCount ?? 0);
        setPageNumber(itemsPayload?.pageNumber ?? fallbackPage);
        setPageSize(itemsPayload?.pageSize ?? fallbackPageSize);
        setTotalPages(itemsPayload?.totalPages ?? 1);
        setPlantTotalCount(payload.plantTotalCount ?? 0);
        setMaterialTotalCount(payload.materialTotalCount ?? 0);
        setComboTotalCount(payload.comboTotalCount ?? 0);
      } catch (searchError: any) {
        const message =
          searchError?.response?.data?.message ||
          t('catalog.searchFailed', {
            defaultValue: 'Unable to search products right now.',
          });

        setError(message);
        setShopItems([]);
        setTotalCount(0);
        setTotalPages(1);
        setPlantTotalCount(0);
        setMaterialTotalCount(0);
        setComboTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  const executeSearch = useCallback(
    async (targetPage: number, targetPageSize: number, keywordOverride?: string) => {
      const request = buildSearchRequest(targetPage, targetPageSize, keywordOverride);
      await performSearch(request, targetPage, targetPageSize);
    },
    [buildSearchRequest, performSearch]
  );

  useEffect(() => {
    if (hasLoadedInitialRef.current) {
      return;
    }

    hasLoadedInitialRef.current = true;
    void executeSearch(1, DEFAULT_PAGE_SIZE, routeKeyword);
  }, [executeSearch, routeKeyword]);

  useEffect(() => {
    if (previousRouteKeywordRef.current === routeKeyword) {
      return;
    }

    previousRouteKeywordRef.current = routeKeyword;
    setKeyword(routeKeyword);

    if (!hasLoadedInitialRef.current) {
      return;
    }

    void executeSearch(1, pageSize, routeKeyword);
  }, [executeSearch, pageSize, routeKeyword]);

  useEffect(() => {
    if (!isAuthenticated || hasLoadedCart) {
      return;
    }

    void fetchCart({ pageNumber: 1, pageSize: 20 }).catch(() => {
      // Keep badge in its current state when the prefetch fails.
    });
  }, [fetchCart, hasLoadedCart, isAuthenticated]);

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

  const wishlistTargets = useMemo(
    () =>
      shopItems
        .map((item) => resolveWishlistTarget(item))
        .filter((target): target is WishlistTarget => Boolean(target)),
    [shopItems]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      clearWishlistStatus();
      return;
    }

    void ensureWishlistStatus(wishlistTargets);
  }, [clearWishlistStatus, ensureWishlistStatus, isAuthenticated, wishlistTargets]);

  const isWishlisted = useCallback(
    (item: ShopSearchItem): boolean => {
      const target = resolveWishlistTarget(item);
      if (!target) {
        return false;
      }

      return wishlistStatus[getWishlistKey(target.itemType, target.itemId)] ?? false;
    },
    [wishlistStatus]
  );

  const handleToggleWishlist = useCallback(
    async (item: ShopSearchItem) => {
      if (!requireAuth()) {
        return;
      }

      const target = resolveWishlistTarget(item);
      if (!target) {
        notify({
          message: t('wishlist.invalidItem', {
            defaultValue: 'Unable to add this item to wishlist.',
          }),
        });
        return;
      }

      const key = getWishlistKey(target.itemType, target.itemId);
      const wasInWishlist = wishlistStatus[key] ?? false;

      try {
        await toggleWishlist(target.itemType, target.itemId);
        notify({
          message: wasInWishlist
            ? t('wishlist.removeSuccess', { defaultValue: 'Removed from wishlist.' })
            : t('wishlist.addedMessage', { defaultValue: 'Added to wishlist.' }),
        });
      } catch (wishlistError: any) {
        const apiMessage = wishlistError?.response?.data?.message;
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

  const submitAddToCart = useCallback(
    async (request: AddCartItemRequest) => {
      if (!requireAuth()) {
        return null;
      }

      console.log('[Catalog][submitAddToCart] request:', request);
      const payload = await addCartItem(request);

      if (!payload) {
        console.warn('[Catalog][submitAddToCart] failed:', {
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

      console.log('[Catalog][submitAddToCart] response:', {
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

  const formatNurseryPrice = useCallback(
    (minPrice?: number, maxPrice?: number) => {
      const safeMin = minPrice ?? 0;
      const safeMax = maxPrice ?? 0;

      if (!safeMin && !safeMax) {
        return t('plantDetail.priceContact', { defaultValue: 'Contact' });
      }

      if (safeMin === safeMax) {
        return formatMoney(safeMin, locale);
      }

      return `${formatMoney(safeMin, locale)} - ${formatMoney(safeMax, locale)}`;
    },
    [locale, t]
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
          id: `buy_now_${pendingNurserySelection.mode}_${selectedNursery.actionId}`,
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

  const handleSelectNurseryForCart = useCallback(
    async (plant: ShopSearchPlantSummary) => {
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
          image: plant.primaryImageUrl ?? undefined,
          unitPrice: plant.basePrice,
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
      const materialEntityId = toPositiveInt(material.materialId) ?? toPositiveInt(material.id);
      if (!materialEntityId) {
        notify({
          message: t('checkout.invalidCheckoutItems', {
            defaultValue: 'Cannot resolve buy now item for order creation.',
          }),
          useAlert: true,
        });
        return;
      }

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
            actionId: option.nurseryMaterialId ?? null,
          }));
        }
      );
    },
    [fetchNurseriesGotMaterialByMaterialId, openNurseryPicker, t]
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
            actionId: option.nurseryPlantComboId ?? null,
          }));
        }
      );
    },
    [fetchNurseriesGotPlantComboByPlantComboId, openNurseryPicker]
  );

  const handleSearch = useCallback(() => {
    void executeSearch(1, pageSize);
  }, [executeSearch, pageSize]);

  const handleRefresh = useCallback(() => {
    if (showFilters || isRefreshing || isLoading) {
      return;
    }

    setIsRefreshing(true);
    void executeSearch(1, pageSize).finally(() => {
      setIsRefreshing(false);
    });
  }, [executeSearch, isLoading, isRefreshing, pageSize, showFilters]);

  const applyFilters = useCallback(() => {
    setShowFilters(false);
    void executeSearch(1, pageSize);
  }, [executeSearch, pageSize]);

  const resetFilters = useCallback(() => {
    const resetSortBy = sortByOptions[0]?.value ?? DEFAULT_SORT_BY_OPTIONS[0].value;
    const resetSortDirection =
      sortDirectionOptions[0]?.value ?? DEFAULT_SORT_DIRECTION_OPTIONS[0].value;

    setKeyword('');
    setPriceRange({ min: 0, max: 0 });
    setMinPriceInput('');
    setMaxPriceInput('');
    setSelectedCareLevel(null);
    setSelectedPlacement(null);
    setSelectedSizes([]);
    setSelectedFengShuiElement(null);
    setSelectedComboType(null);
    setSelectedComboSeason(null);
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    setSelectedNurseryId(null);
    setSortBy(resetSortBy);
    setSortDirection(resetSortDirection);
    setToxicity(false);
    setAirPurifying(false);
    setHasFlower(false);
    setPetSafe(false);
    setChildSafe(false);
    setIsUniqueInstance(false);
    setIncludePlants(true);
    setIncludeMaterials(true);
    setIncludeCombos(true);
    setPageSize(DEFAULT_PAGE_SIZE);

    const request: ShopSearchRequest = {
      pagination: {
        pageNumber: 1,
        pageSize: DEFAULT_PAGE_SIZE,
      },
      sortBy: resetSortBy,
      sortDirection: resetSortDirection,
      includePlants: true,
      includeMaterials: true,
      includeCombos: true,
    };

    setShowFilters(false);
    void performSearch(request, 1, DEFAULT_PAGE_SIZE);
  }, [performSearch, sortByOptions, sortDirectionOptions]);

  const handlePageSizeChange = useCallback(
    (nextPageSize: number) => {
      setPageSize(nextPageSize);
      void executeSearch(1, nextPageSize);
    },
    [executeSearch]
  );

  const handlePrevPage = useCallback(() => {
    if (pageNumber <= 1 || isLoading) {
      return;
    }

    void executeSearch(pageNumber - 1, pageSize);
  }, [executeSearch, isLoading, pageNumber, pageSize]);

  const handleNextPage = useCallback(() => {
    if (pageNumber >= totalPages || isLoading) {
      return;
    }

    void executeSearch(pageNumber + 1, pageSize);
  }, [executeSearch, isLoading, pageNumber, pageSize, totalPages]);

  const handlePageSelect = useCallback(
    (targetPage: number) => {
      if (isLoading || targetPage === pageNumber || targetPage < 1 || targetPage > totalPages) {
        return;
      }

      void executeSearch(targetPage, pageSize);
    },
    [executeSearch, isLoading, pageNumber, pageSize, totalPages]
  );

  const visiblePageTokens = useMemo<PageToken[]>(() => {
    const normalizedTotalPages = Math.max(1, totalPages);

    if (normalizedTotalPages <= 7) {
      return Array.from({ length: normalizedTotalPages }, (_, index) => index + 1);
    }

    const tokens: PageToken[] = [1];
    const startPage = Math.max(2, pageNumber - 1);
    const endPage = Math.min(normalizedTotalPages - 1, pageNumber + 1);

    if (startPage > 2) {
      tokens.push('left-ellipsis');
    }

    for (let nextPage = startPage; nextPage <= endPage; nextPage += 1) {
      tokens.push(nextPage);
    }

    if (endPage < normalizedTotalPages - 1) {
      tokens.push('right-ellipsis');
    }

    tokens.push(normalizedTotalPages);
    return tokens;
  }, [pageNumber, totalPages]);

  const handleMinPriceChange = useCallback((text: string) => {
    setMinPriceInput(text);
    const numeric = Number(text.replace(/[^0-9]/g, ''));
    if (Number.isFinite(numeric)) {
      setPriceRange((previous) => ({ ...previous, min: numeric }));
      return;
    }

    setPriceRange((previous) => ({ ...previous, min: 0 }));
  }, []);

  const handleMaxPriceChange = useCallback((text: string) => {
    setMaxPriceInput(text);
    const numeric = Number(text.replace(/[^0-9]/g, ''));
    if (Number.isFinite(numeric)) {
      setPriceRange((previous) => ({ ...previous, max: numeric }));
      return;
    }

    setPriceRange((previous) => ({ ...previous, max: 0 }));
  }, []);

  const isNurseryActionDisabled =
    isNurseryPickerLoading ||
    availableNurseryOptions.length === 0 ||
    selectedCartNurseryId === null;

  const renderChip = (
    option: NumberOption,
    isActive: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      key={option.value}
      style={[styles.filterChip, isActive && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );

  const renderStringChip = (
    option: StringOption,
    isActive: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      key={option.value}
      style={[styles.filterChip, isActive && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );

  const toggleSection = useCallback((sectionKey: FilterSectionKey) => {
    setExpandedSections((previous) => ({
      ...previous,
      [sectionKey]: !previous[sectionKey],
    }));
  }, []);

  const renderCollapsibleSection = useCallback(
    (sectionKey: FilterSectionKey, title: string, content: React.ReactNode) => (
      <View style={styles.filterSection}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(sectionKey)}
          activeOpacity={0.8}
        >
          <Text style={styles.sectionHeaderTitle}>{title}</Text>
          <Ionicons
            name={expandedSections[sectionKey] ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>

        {expandedSections[sectionKey] ? (
          <View style={styles.sectionBody}>{content}</View>
        ) : null}
      </View>
    ),
    [expandedSections, toggleSection]
  );

  const renderPlantCard = (item: ShopSearchItem, plant: ShopSearchPlantSummary) => {
    const imageUrl = plant.primaryImageUrl || PLACEHOLDER_IMAGE;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('PlantDetail', { plantId: String(plant.id) })}
      >
        <View style={styles.productImageContainer}>
          <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
          {!plant.isUniqueInstance && (
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={(event) => {
                event.stopPropagation();
                void handleToggleWishlist(item);
              }}
            >
              <Ionicons
                name={isWishlisted(item) ? 'heart' : 'heart-outline'}
                size={18}
                color={isWishlisted(item) ? COLORS.error : COLORS.white}
              />
            </TouchableOpacity>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{t('catalog.typePlant', { defaultValue: 'Plant' })}</Text>
          </View>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {plant.name}
          </Text>
          <Text style={styles.productMeta} numberOfLines={1}>
            {`${plant.careLevelTypeName || '-'} • ${plant.sizeName || '-'}`}
          </Text>
          <View style={styles.productFooter}>
            <Text style={styles.productPrice}>{formatMoney(plant.basePrice, locale)}</Text>
            {!plant.isUniqueInstance && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleSelectNurseryForCart(plant);
                }}
              >
                <Ionicons name="add" size={14} color={COLORS.black} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMaterialCard = (item: ShopSearchItem, material: ShopSearchMaterialSummary) => {
    const materialId = material.materialId || material.id;
    const materialImageUrl = material.primaryImageUrl?.trim() || '';

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() =>
          navigation.navigate('MaterialDetail', {
            materialId,
            nurseryMaterialId: material.id,
          })
        }
      >
        <View style={[styles.productImageContainer, styles.materialImageContainer]}>
          {materialImageUrl ? (
            <Image source={{ uri: materialImageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <Ionicons name="cube-outline" size={48} color={COLORS.primary} />
          )}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(event) => {
              event.stopPropagation();
              void handleToggleWishlist(item);
            }}
          >
            <Ionicons
              name={isWishlisted(item) ? 'heart' : 'heart-outline'}
              size={18}
              color={isWishlisted(item) ? COLORS.error : COLORS.white}
            />
          </TouchableOpacity>
          <View style={[styles.typeBadge, styles.typeBadgeMaterial]}>
            <Text style={styles.typeBadgeText}>
              {t('catalog.typeMaterial', { defaultValue: 'Material' })}
            </Text>
          </View>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {material.materialName}
          </Text>
          <Text style={styles.productMeta} numberOfLines={1}>
            {`${material.nurseryName} • ${t('catalog.stock', { defaultValue: 'Stock' })}: ${material.availableQuantity}`}
          </Text>
          <View style={styles.productFooter}>
            <Text style={styles.productPrice}>{material.basePrice}</Text>
            <View style={styles.productActions}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleAddMaterialToCart(material);
                }}
              >
                <Ionicons name="add" size={14} color={COLORS.black} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderComboCard = (item: ShopSearchItem, combo: ShopSearchComboSummary) => {
    const comboImageUrl = combo.primaryImageUrl?.trim() || '';

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() =>
          navigation.navigate('ComboDetail', {
            comboId: combo.id,
          })
        }
      >
        <View style={[styles.productImageContainer, styles.comboImageContainer]}>
          {comboImageUrl ? (
            <Image source={{ uri: comboImageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <Ionicons name="albums-outline" size={46} color={COLORS.primaryDark} />
          )}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(event) => {
              event.stopPropagation();
              void handleToggleWishlist(item);
            }}
          >
            <Ionicons
              name={isWishlisted(item) ? 'heart' : 'heart-outline'}
              size={18}
              color={isWishlisted(item) ? COLORS.error : COLORS.white}
            />
          </TouchableOpacity>
          <View style={[styles.typeBadge, styles.typeBadgeCombo]}>
            <Text style={styles.typeBadgeText}>{t('catalog.typeCombo', { defaultValue: 'Combo' })}</Text>
          </View>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {combo.name}
          </Text>
          <Text style={styles.productMeta} numberOfLines={1}>
            {combo.comboTypeName || '-'}
          </Text>
          <View style={styles.productFooter}>
            <Text style={styles.productPrice}>{formatMoney(combo.price, locale)}</Text>
            <View style={styles.productActions}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleAddComboToCart(combo);
                }}
              >
                <Ionicons name="add" size={14} color={COLORS.black} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderResultCard = ({ item }: { item: ShopSearchItem }) => {
    if (item.type === 'Plant' && item.plant) {
      return renderPlantCard(item, item.plant);
    }

    if (item.type === 'Material' && item.material) {
      return renderMaterialCard(item, item.material);
    }

    if (item.type === 'Combo' && item.combo) {
      return renderComboCard(item, item.combo);
    }

    return <View style={styles.productCardPlaceholder} />;
  };

  const renderFilterSection = () => (
    <View style={styles.filtersContainer}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={[
          styles.filterContent,
          {
            paddingBottom: filterFooterPaddingBottom + SPACING['4xl'],
          },
        ]}
      >
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>{t('catalog.filters')}</Text>
          <TouchableOpacity onPress={resetFilters}>
            <Text style={styles.resetText}>{t('catalog.reset')}</Text>
          </TouchableOpacity>
        </View>

      {renderCollapsibleSection(
        'productTypes',
        t('catalog.productTypes', { defaultValue: 'Product types' }),
        <View style={styles.chipWrap}>
          <TouchableOpacity
            style={[styles.filterChip, includePlants && styles.filterChipActive]}
            onPress={() => setIncludePlants((previous) => !previous)}
          >
            <Text style={[styles.filterChipText, includePlants && styles.filterChipTextActive]}>
              {t('catalog.typePlant', { defaultValue: 'Plant' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, includeMaterials && styles.filterChipActive]}
            onPress={() => setIncludeMaterials((previous) => !previous)}
          >
            <Text style={[styles.filterChipText, includeMaterials && styles.filterChipTextActive]}>
              {t('catalog.typeMaterial', { defaultValue: 'Material' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, includeCombos && styles.filterChipActive]}
            onPress={() => setIncludeCombos((previous) => !previous)}
          >
            <Text style={[styles.filterChipText, includeCombos && styles.filterChipTextActive]}>
              {t('catalog.typeCombo', { defaultValue: 'Combo' })}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {renderCollapsibleSection(
        'priceRange',
        t('catalog.priceRange'),
        <View style={styles.priceInputContainer}>
          <View style={styles.priceInputWrapper}>
            <Text style={styles.priceInputLabel}>{t('catalog.minPrice')}</Text>
            <TextInput
              style={styles.priceInput}
              value={minPriceInput}
              onChangeText={handleMinPriceChange}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
          <View style={styles.priceInputWrapper}>
            <Text style={styles.priceInputLabel}>{t('catalog.maxPrice')}</Text>
            <TextInput
              style={styles.priceInput}
              value={maxPriceInput}
              onChangeText={handleMaxPriceChange}
              keyboardType="numeric"
              placeholder="0"
            />
          </View>
        </View>
      )}

      {renderCollapsibleSection(
        'sort',
        t('catalog.sortBy'),
        <>
          <View style={styles.chipWrap}>
            {sortByOptions.map((option) =>
              renderStringChip(option, sortBy === option.value, () => setSortBy(option.value))
            )}
          </View>
          <Text style={[styles.sectionTitle, styles.sectionSubTitle]}>
            {t('catalog.sortDirection', { defaultValue: 'Sort direction' })}
          </Text>
          <View style={styles.chipWrap}>
            {sortDirectionOptions.map((option) =>
              renderStringChip(option, sortDirection === option.value, () =>
                setSortDirection(option.value)
              )
            )}
          </View>
        </>
      )}

      {renderCollapsibleSection(
        'careLevel',
        t('catalog.careLevel'),
        <View style={styles.chipWrap}>
          {careLevelOptions.map((option) =>
            renderChip(option, selectedCareLevel === option.value, () =>
              setSelectedCareLevel((previous) =>
                previous === option.value ? null : option.value
              )
            )
          )}
        </View>
      )}

      {renderCollapsibleSection(
        'placement',
        t('catalog.placement'),
        <View style={styles.chipWrap}>
          {placementOptions.map((option) =>
            renderChip(option, selectedPlacement === option.value, () =>
              setSelectedPlacement((previous) =>
                previous === option.value ? null : option.value
              )
            )
          )}
        </View>
      )}

      {renderCollapsibleSection(
        'size',
        t('catalog.size', { defaultValue: 'Sizes' }),
        <View style={styles.chipWrap}>
          {sizeOptions.map((option) =>
            renderChip(option, selectedSizes.includes(option.value), () =>
              toggleArrayValue(option.value, setSelectedSizes)
            )
          )}
        </View>
      )}

      {renderCollapsibleSection(
        'fengShui',
        t('catalog.fengShui'),
        <View style={styles.chipWrap}>
          {fengShuiOptions.map((option) =>
            renderChip(option, selectedFengShuiElement === option.value, () =>
              setSelectedFengShuiElement((previous) =>
                previous === option.value ? null : option.value
              )
            )
          )}
        </View>
      )}

      {renderCollapsibleSection(
        'combo',
        t('catalog.comboType', { defaultValue: 'Combo type' }),
        <>
          <View style={styles.chipWrap}>
            {comboTypeOptions.map((option) =>
              renderChip(option, selectedComboType === option.value, () =>
                setSelectedComboType((previous) =>
                  previous === option.value ? null : option.value
                )
              )
            )}
          </View>

          <Text style={[styles.sectionTitle, styles.sectionSubTitle]}>
            {t('catalog.comboSeason', { defaultValue: 'Combo season' })}
          </Text>
          <View style={styles.chipWrap}>
            {comboSeasonOptions.map((option) =>
              renderChip(option, selectedComboSeason === option.value, () =>
                setSelectedComboSeason((previous) =>
                  previous === option.value ? null : option.value
                )
              )
            )}
          </View>
        </>
      )}

      {renderCollapsibleSection(
        'features',
        t('catalog.features'),
        <View style={styles.chipWrap}>
          <TouchableOpacity
            style={[styles.filterChip, toxicity && styles.filterChipActive]}
            onPress={() => setToxicity((previous) => !previous)}
          >
            <Text style={[styles.filterChipText, toxicity && styles.filterChipTextActive]}>
              {t('catalog.toxicity')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, airPurifying && styles.filterChipActive]}
            onPress={() => setAirPurifying((previous) => !previous)}
          >
            <Text style={[styles.filterChipText, airPurifying && styles.filterChipTextActive]}>
              {t('catalog.airPurifying')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, hasFlower && styles.filterChipActive]}
            onPress={() => setHasFlower((previous) => !previous)}
          >
            <Text style={[styles.filterChipText, hasFlower && styles.filterChipTextActive]}>
              {t('catalog.hasFlower')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, petSafe && styles.filterChipActive]}
            onPress={() => setPetSafe((previous) => !previous)}
          >
            <Text style={[styles.filterChipText, petSafe && styles.filterChipTextActive]}>
              {t('catalog.petSafe')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, childSafe && styles.filterChipActive]}
            onPress={() => setChildSafe((previous) => !previous)}
          >
            <Text style={[styles.filterChipText, childSafe && styles.filterChipTextActive]}>
              {t('catalog.childSafe')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, isUniqueInstance && styles.filterChipActive]}
            onPress={() => setIsUniqueInstance((previous) => !previous)}
          >
            <Text style={[styles.filterChipText, isUniqueInstance && styles.filterChipTextActive]}>
              {t('catalog.uniqueInstance')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {renderCollapsibleSection(
        'categories',
        t('catalog.categories', { defaultValue: 'Categories' }),
        <View style={styles.chipWrap}>
          {categoryOptions.map((option) =>
            renderChip(option, selectedCategoryIds.includes(option.value), () =>
              toggleArrayValue(option.value, setSelectedCategoryIds)
            )
          )}
        </View>
      )}

      {renderCollapsibleSection(
        'tags',
        t('catalog.tags', { defaultValue: 'Tags' }),
        <View style={styles.chipWrap}>
          {tagOptions.map((option) =>
            renderChip(option, selectedTagIds.includes(option.value), () =>
              toggleArrayValue(option.value, setSelectedTagIds)
            )
          )}
        </View>
      )}

      {renderCollapsibleSection(
        'nursery',
        t('catalog.nursery', { defaultValue: 'Nursery' }),
        <View style={styles.chipWrap}>
          {nurseryFilterOptions.map((option) =>
            renderChip(option, selectedNurseryId === option.value, () =>
              setSelectedNurseryId((previous) =>
                previous === option.value ? null : option.value
              )
            )
          )}
        </View>
      )}

      </ScrollView>

      <View
        style={[
          styles.applyButtonContainer,
          {
            paddingBottom: filterFooterPaddingBottom,
          },
        ]}
      >
        <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
          <Text style={styles.applyButtonText}>{t('catalog.applyFilters')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading && shopItems.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <BrandMark variant="logoWithText" size="majorHeader" />
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
              {cartItemCount > 0 && <View style={styles.cartDot} />}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && shopItems.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <BrandMark variant="logoWithText" size="majorHeader" />
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
              {cartItemCount > 0 && <View style={styles.cartDot} />}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loaderContainer}>
          <Ionicons name="alert-circle" size={56} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void executeSearch(1, pageSize)}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        <BrandMark variant="logoWithText" size="majorHeader" />
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
            {cartItemCount > 0 && <View style={styles.cartDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('catalog.searchPlaceholder', {
              defaultValue: 'Search products...',
            })}
            placeholderTextColor="#0DA84D"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
          />
        </View>

        <TouchableOpacity style={styles.filterToggle} onPress={() => setShowFilters((previous) => !previous)}>
          <Ionicons name="options" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.filtersWrapper,
          {
            height: filterHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 860],
            }),
            opacity: filterOpacity,
          },
        ]}
        pointerEvents={showFilters ? 'auto' : 'none'}
      >
        {renderFilterSection()}
      </Animated.View>

      {!showFilters && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <View style={styles.resultsTopRow}>
              <Text style={styles.resultsTitle}>{t('catalog.results', { count: totalCount })}</Text>

              <Text style={styles.pageSizeLabel}>
                {t('catalog.pageSize', { defaultValue: 'Page size' })}
              </Text>
            </View>

            <View style={styles.resultsBottomRow}>
              <Text style={styles.resultsBreakdown} numberOfLines={1}>
                {t('catalog.resultBreakdown', {
                  defaultValue: 'Plant: {{plant}} | Material: {{material}} | Combo: {{combo}}',
                  plant: plantTotalCount,
                  material: materialTotalCount,
                  combo: comboTotalCount,
                })}
              </Text>

              <View style={styles.pageSizeOptions}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[styles.pageSizeChip, pageSize === size && styles.pageSizeChipActive]}
                    onPress={() => handlePageSizeChange(size)}
                  >
                    <Text
                      style={[
                        styles.pageSizeChipText,
                        pageSize === size && styles.pageSizeChipTextActive,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {isFilterDataLoading && (
            <View style={styles.filterLoadingHint}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.filterLoadingHintText}>
                {t('catalog.loadingFilters', {
                  defaultValue: 'Loading filter options...',
                })}
              </Text>
            </View>
          )}

          <FlatList
            style={styles.resultsList}
            data={shopItems}
            renderItem={renderResultCard}
            keyExtractor={getItemKey}
            numColumns={2}
            columnWrapperStyle={styles.productRow}
            contentContainerStyle={[
              styles.productList,
              {
                paddingBottom: bottomContentInset,
              },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
                enabled={!showFilters}
              />
            }
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="search-outline" size={46} color={COLORS.textLight} />
                  <Text style={styles.emptyText}>
                    {t('catalog.noResults', {
                      defaultValue: 'No products found for the current filters.',
                    })}
                  </Text>
                </View>
              ) : null
            }
          />

          <View style={styles.paginationRow}>
            <View style={styles.paginationControl}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  (pageNumber <= 1 || isLoading) && styles.paginationButtonDisabled,
                ]}
                disabled={pageNumber <= 1 || isLoading}
                onPress={handlePrevPage}
              >
                <Ionicons name="chevron-back" size={16} color={COLORS.textPrimary} />
              </TouchableOpacity>

              <View style={styles.pageNumberCenter}>
                <ScrollView
                  horizontal
                  style={styles.pageNumberScroller}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pageNumberList}
                >
                  {visiblePageTokens.map((token, index) =>
                    typeof token === 'number' ? (
                      <TouchableOpacity
                        key={`page-${token}`}
                        style={[
                          styles.pageNumberChip,
                          token === pageNumber && styles.pageNumberChipActive,
                        ]}
                        onPress={() => handlePageSelect(token)}
                        disabled={isLoading || token === pageNumber}
                      >
                        <Text
                          style={[
                            styles.pageNumberChipText,
                            token === pageNumber && styles.pageNumberChipTextActive,
                          ]}
                        >
                          {token}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text key={`ellipsis-${token}-${index}`} style={styles.pageNumberEllipsis}>
                        ...
                      </Text>
                    )
                  )}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  (pageNumber >= totalPages || isLoading) && styles.paginationButtonDisabled,
                ]}
                disabled={pageNumber >= totalPages || isLoading}
                onPress={handleNextPage}
              >
                <Ionicons name="chevron-forward" size={16} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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
                {pendingNurserySelection.displayName}
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
    backgroundColor: '#F6F8F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerSide: {
    width: 84,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActions: {
    justifyContent: 'flex-end',
    gap: SPACING.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
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
  filtersWrapper: {
    overflow: 'hidden',
    backgroundColor: '#F6F8F6',
  },
  filtersContainer: {
    flex: 1,
    backgroundColor: '#F6F8F6',
  },
  filterContent: {
    paddingBottom: SPACING['4xl'],
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  filterTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  resetText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: '#13EC5B',
  },
  filterSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D7E4DB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    flex: 1,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionBody: {
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  sectionSubTitle: {
    marginTop: SPACING.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D7E4DB',
  },
  filterChipActive: {
    backgroundColor: '#13EC5B',
    borderColor: '#13EC5B',
  },
  filterChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  priceInputContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  priceInputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D7E4DB',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  priceInputLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  priceInput: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
    padding: 0,
  },
  applyButtonContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    backgroundColor: '#F6F8F6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D7E4DB',
    marginBottom: 64,
  },
  applyButton: {
    backgroundColor: '#13EC5B',
    borderRadius: 24,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  errorText: {
    textAlign: 'center',
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsList: {
    flex: 1,
  },
  resultsHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  resultsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  resultsBottomRow: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  resultsTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  resultsBreakdown: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  paginationRow: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D7E4DB',
    backgroundColor: '#F6F8F6',
  },
  pageSizeLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  pageSizeOptions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  pageSizeChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7E4DB',
    backgroundColor: COLORS.white,
  },
  pageSizeChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E7FDF0',
  },
  pageSizeChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  pageSizeChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  paginationControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  pageNumberCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  pageNumberScroller: {
    maxWidth: '100%',
  },
  pageNumberList: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  pageNumberChip: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D7E4DB',
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  pageNumberChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E7FDF0',
  },
  pageNumberChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  pageNumberChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  pageNumberEllipsis: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    paddingHorizontal: 2,
  },
  paginationButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D7E4DB',
  },
  paginationButtonDisabled: {
    opacity: 0.4,
  },
  paginationText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  filterLoadingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  filterLoadingHintText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  productList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  productCard: {
    width: CARD_WIDTH,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    ...SHADOWS.sm,
  },
  productCardPlaceholder: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
  },
  productImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#E8ECEA',
    marginBottom: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  materialImageContainer: {
    backgroundColor: '#EEF7F1',
  },
  comboImageContainer: {
    backgroundColor: '#F0F5FF',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  typeBadge: {
    position: 'absolute',
    left: SPACING.sm,
    bottom: SPACING.sm,
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  typeBadgeMaterial: {
    backgroundColor: 'rgba(45,106,79,0.85)',
  },
  typeBadgeCombo: {
    backgroundColor: 'rgba(49,81,180,0.85)',
  },
  typeBadgeText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  productInfo: {
    gap: 2,
  },
  productName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  productMeta: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  productFooter: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: '#13A454',
    flex: 1,
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  addButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13EC5B',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['4xl'],
    gap: SPACING.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
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
