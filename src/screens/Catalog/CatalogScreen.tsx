import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Animated,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { RootStackParamList, Plant, NurseryPlantInstanceAvailability } from '../../types';
import { usePlantStore, useCartStore, useAuthStore, useWishlistStore } from '../../stores';
import { plantService } from '../../services/plantService';
import { getWishlistKey, notify, resolveWishlistTarget } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 3) / 2;

// Enum types matching API
type PlacementTypeEnum = 1 | 2 | 3; // 1=Indoor, 2=Outdoor, 3=SemiShade
type CareLevelTypeEnum = 1 | 2 | 3 | 4; // 1=Easy, 2=Medium, 3=Hard, 4=Expert

export default function CatalogScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { plants, isLoading, error, searchShopPlants } = usePlantStore();
  const addToCart = useCartStore((state) => state.addToCart);
  const { isAuthenticated } = useAuthStore();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  // Filter states
  const [keyword, setKeyword] = useState('');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 200000000 });
  const [minPriceInput, setMinPriceInput] = useState('0');
  const [maxPriceInput, setMaxPriceInput] = useState('200000000');
  const [selectedCareLevel, setSelectedCareLevel] = useState<CareLevelTypeEnum | null>(null);
  const [selectedPlacement, setSelectedPlacement] = useState<PlacementTypeEnum | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [toxicity, setToxicity] = useState<boolean>(false);
  const [airPurifying, setAirPurifying] = useState<boolean>(false);
  const [hasFlower, setHasFlower] = useState<boolean>(false);
  const [petSafe, setPetSafe] = useState<boolean>(false);
  const [childSafe, setChildSafe] = useState<boolean>(false);
  const [isUniqueInstance, setIsUniqueInstance] = useState<boolean>(false);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [nurseryId, setNurseryId] = useState<number | undefined>(undefined);
  const [isNurseryPickerVisible, setIsNurseryPickerVisible] = useState(false);
  const [isNurseryPickerLoading, setIsNurseryPickerLoading] = useState(false);
  const [pendingCartPlant, setPendingCartPlant] = useState<Plant | null>(null);
  const [nurseryOptions, setNurseryOptions] = useState<NurseryPlantInstanceAvailability[]>([]);
  const [selectedNurseryOptionId, setSelectedNurseryOptionId] = useState<number | null>(null);
  const [selectedCartQuantity, setSelectedCartQuantity] = useState(1);
  const wishlistStatus = useWishlistStore((state) => state.statusByKey);
  const ensureWishlistStatus = useWishlistStore((state) => state.ensureStatus);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const clearWishlistStatus = useWishlistStore((state) => state.clearStatus);

  // Animation
  const filterHeight = useRef(new Animated.Value(0)).current;
  const filterOpacity = useRef(new Animated.Value(0)).current;

  // Load initial plants
  useEffect(() => {
    loadPlants();
  }, []);

  // Animate filter panel
  useEffect(() => {
    Animated.parallel([
      Animated.timing(filterHeight, {
        toValue: showFilters ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(filterOpacity, {
        toValue: showFilters ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [showFilters]);

  // Update price range when inputs change
  const handleMinPriceChange = (text: string) => {
    setMinPriceInput(text);
    const value = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(value)) {
      setPriceRange(prev => ({ ...prev, min: value }));
    }
  };

  const handleMaxPriceChange = (text: string) => {
    setMaxPriceInput(text);
    const value = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(value)) {
      setPriceRange(prev => ({ ...prev, max: value }));
    }
  };

  const wishlistTargets = useMemo(
    () =>
      plants
        .map(resolveWishlistTarget)
        .filter(
          (target): target is NonNullable<ReturnType<typeof resolveWishlistTarget>> =>
            target !== null
        ),
    [plants]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      clearWishlistStatus();
    }
  }, [clearWishlistStatus, isAuthenticated]);

  const formatPriceInput = (value: number) => {
    return value.toLocaleString(locale);
  };

  const loadPlants = useCallback(() => {
    console.log('CatalogScreen: Loading plants...');
    searchShopPlants({
      pagination: {
        pageNumber: 1,
        pageSize: 20,
      },
      isActive: true,
    });
  }, [searchShopPlants]);

  const resetFilters = useCallback(() => {
    setKeyword('');
    setPriceRange({ min: 0, max: 200000000 });
    setMinPriceInput('0');
    setMaxPriceInput('200000000');
    setSelectedCareLevel(null);
    setSelectedPlacement(null);
    setToxicity(false);
    setAirPurifying(false);
    setHasFlower(false);
    setPetSafe(false);
    setChildSafe(false);
    setIsUniqueInstance(false);
    setCategoryIds([]);
    setTagIds([]);
    setNurseryId(undefined);

    loadPlants();
  }, [loadPlants]);

  const applyFilters = useCallback(() => {
    setShowFilters(false);

    // Build the request based on selected filters
    // Only send boolean filters when they are true
    searchShopPlants({
      pagination: {
        pageNumber: 1,
        pageSize: 20,
      },
      keyword: keyword || undefined,
      isActive: true,
      placementType: selectedPlacement || undefined,
      careLevelType: selectedCareLevel || undefined,
      toxicity: toxicity ? true : undefined,
      airPurifying: airPurifying ? true : undefined,
      hasFlower: hasFlower ? true : undefined,
      petSafe: petSafe ? true : undefined,
      childSafe: childSafe ? true : undefined,
      isUniqueInstance: isUniqueInstance ? true : undefined,
      minBasePrice: priceRange.min > 0 ? priceRange.min : undefined,
      maxBasePrice: priceRange.max < 200000000 ? priceRange.max : undefined,
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      nurseryId,
      sortBy: 'name',
      sortDirection: 'asc',
    });
  }, [
    keyword,
    selectedPlacement,
    selectedCareLevel,
    toxicity,
    airPurifying,
    hasFlower,
    petSafe,
    childSafe,
    isUniqueInstance,
    priceRange,
    categoryIds,
    tagIds,
    nurseryId,
    searchShopPlants,
  ]);

  const handleSearch = useCallback(() => {
    searchShopPlants({
      pagination: {
        pageNumber: 1,
        pageSize: 20,
      },
      keyword: keyword,
      isActive: true,
    });
  }, [keyword, searchShopPlants]);

  const renderFilterSection = () => (
    <ScrollView
      style={styles.filtersContainer}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
    >
      {/* Header */}
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>{t('catalog.filters')}</Text>
        <TouchableOpacity onPress={resetFilters}>
          <Text style={styles.resetText}>{t('catalog.reset')}</Text>
        </TouchableOpacity>
      </View>

      {/* Price Range */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>{t('catalog.priceRange')}</Text>
        <View style={styles.priceInputContainer}>
          <View style={styles.priceInputWrapper}>
            <Text style={styles.priceInputLabel}>{t('catalog.minPrice')}</Text>
            <TextInput
              style={styles.priceInput}
              value={minPriceInput}
              onChangeText={handleMinPriceChange}
              keyboardType="numeric"
              placeholder="100,000"
            />
            <Text style={styles.priceInputCurrency}>₫</Text>
          </View>
          <View style={styles.priceRangeSeparator}>
            <View style={styles.priceRangeLine} />
          </View>
          <View style={styles.priceInputWrapper}>
            <Text style={styles.priceInputLabel}>{t('catalog.maxPrice')}</Text>
            <TextInput
              style={styles.priceInput}
              value={maxPriceInput}
              onChangeText={handleMaxPriceChange}
              keyboardType="numeric"
              placeholder="200,000,000"
            />
            <Text style={styles.priceInputCurrency}>₫</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Care Level */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>{t('catalog.careLevel')}</Text>
        <View style={styles.chipContainer}>
          {[
            { value: 1 as CareLevelTypeEnum, label: t('catalog.careEasy') },
            { value: 2 as CareLevelTypeEnum, label: t('catalog.careMedium') },
            { value: 3 as CareLevelTypeEnum, label: t('catalog.careHard') },
            { value: 4 as CareLevelTypeEnum, label: t('catalog.careExpert') },
          ].map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.chip,
                selectedCareLevel === level.value && styles.chipActive,
              ]}
              onPress={() => setSelectedCareLevel(selectedCareLevel === level.value ? null : level.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCareLevel === level.value && styles.chipTextActive,
                ]}
              >
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Placement Type */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>{t('catalog.placement')}</Text>
        <View style={styles.chipContainer}>
          {[
            { value: 1 as PlacementTypeEnum, icon: 'home', label: t('catalog.placementIndoor') },
            { value: 2 as PlacementTypeEnum, icon: 'leaf', label: t('catalog.placementOutdoor') },
            { value: 3 as PlacementTypeEnum, icon: 'partly-sunny', label: t('catalog.placementSemiShade') },
          ].map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.chip,
                selectedPlacement === item.value && styles.chipActive,
              ]}
              onPress={() => setSelectedPlacement(selectedPlacement === item.value ? null : item.value)}
            >
              <Ionicons
                name={item.icon as any}
                size={16}
                color={selectedPlacement === item.value ? COLORS.black : COLORS.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.chipText,
                  selectedPlacement === item.value && styles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Features - Boolean Filters */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>{t('catalog.features')}</Text>
        <View style={styles.featuresGrid}>
          {[
            { key: 'toxicity', label: t('catalog.toxicity'), icon: 'shield-checkmark', value: toxicity, setter: setToxicity },
            { key: 'airPurifying', label: t('catalog.airPurifying'), icon: 'leaf', value: airPurifying, setter: setAirPurifying },
            { key: 'hasFlower', label: t('catalog.hasFlower'), icon: 'flower', value: hasFlower, setter: setHasFlower },
            { key: 'petSafe', label: t('catalog.petSafe'), icon: 'paw', value: petSafe, setter: setPetSafe },
            { key: 'childSafe', label: t('catalog.childSafe'), icon: 'happy', value: childSafe, setter: setChildSafe },
            { key: 'uniqueInstance', label: t('catalog.uniqueInstance'), icon: 'star', value: isUniqueInstance, setter: setIsUniqueInstance },
          ].map((feature) => (
            <TouchableOpacity
              key={feature.key}
              style={[
                styles.featureChip,
                feature.value && styles.featureChipActive,
              ]}
              onPress={() => feature.setter(!feature.value)}
            >
              <Ionicons
                name={feature.icon as any}
                size={18}
                color={feature.value ? COLORS.white : COLORS.primary}
              />
              <Text
                style={[
                  styles.featureText,
                  feature.value && styles.featureTextActive,
                ]}
              >
                {feature.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Apply Button */}
      <View style={styles.applyButtonContainer}>
        <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
          <Text style={styles.applyButtonText}>{t('catalog.applyFilters')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

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

  const closeNurseryPicker = useCallback(() => {
    setIsNurseryPickerVisible(false);
    setIsNurseryPickerLoading(false);
    setPendingCartPlant(null);
    setNurseryOptions([]);
    setSelectedNurseryOptionId(null);
    setSelectedCartQuantity(1);
  }, []);

  const formatNurseryPrice = useCallback((minPrice: number, maxPrice: number) => {
    if (!minPrice && !maxPrice) {
      return t('plantDetail.priceContact', { defaultValue: 'Contact' });
    }

    if (minPrice === maxPrice) {
      return `${minPrice.toLocaleString(locale)}₫`;
    }

    return `${minPrice.toLocaleString(locale)}₫ - ${maxPrice.toLocaleString(locale)}₫`;
  }, [locale, t]);

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

  const handleSelectNurseryForCart = async (targetPlant: Plant) => {
    if (!requireAuth()) {
      return;
    }

    if (targetPlant.isUniqueInstance) {
      return;
    }

    setPendingCartPlant(targetPlant);
    setIsNurseryPickerVisible(true);
    setIsNurseryPickerLoading(true);
    setNurseryOptions([]);
    setSelectedNurseryOptionId(null);
    setSelectedCartQuantity(1);

    try {
      const result = await plantService.getNurseriesGotCommonPlantByPlantId(targetPlant.id);
      const options = result ?? [];
      setNurseryOptions(options);
      setSelectedNurseryOptionId(options[0]?.nurseryId ?? null);
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      notify({
        message:
          apiMessage ||
          t('catalog.loadNurseryFailed', {
            defaultValue: 'Unable to load available nurseries.',
          }),
      });
      closeNurseryPicker();
    } finally {
      setIsNurseryPickerLoading(false);
    }
  };

  const handleConfirmNurseryAdd = (goToCheckout = false) => {
    if (!pendingCartPlant || selectedNurseryOptionId === null) {
      return;
    }

    const selectedNursery = nurseryOptions.find(
      (nursery) => nursery.nurseryId === selectedNurseryOptionId
    );

    if (!selectedNursery || selectedNursery.commonPlantId == null) {
      notify({
        message: t('cart.addFailed', {
          defaultValue: 'Unable to add to cart.',
        }),
      });
      return;
    }

    handleAddToCart(
      pendingCartPlant,
      selectedNursery.commonPlantId,
      Math.max(1, selectedCartQuantity),
    );
    closeNurseryPicker();

    if (goToCheckout) {
      navigation.navigate('Checkout');
    }
  };

  const isNurseryActionDisabled =
    isNurseryPickerLoading ||
    nurseryOptions.length === 0 ||
    selectedNurseryOptionId === null;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void ensureWishlistStatus(wishlistTargets);
  }, [ensureWishlistStatus, isAuthenticated, wishlistTargets]);

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

  const renderPlantCard = ({ item }: { item: Plant }) => {
    const imageUrl = item.images && item.images.length > 0
      ? item.images[0]
      : 'https://via.placeholder.com/200';

    return (
      <TouchableOpacity
        style={styles.plantCard}
        onPress={() => navigation.navigate('PlantDetail', { plantId: String(item.id) })}
      >
        <View style={styles.plantImageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.plantImage}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => handleToggleWishlist(item)}
          >
            <Ionicons
              name={isWishlisted(item) ? 'heart' : 'heart-outline'}
              size={20}
              color={isWishlisted(item) ? COLORS.error : COLORS.white}
            />
          </TouchableOpacity>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#FACC15" />
            <Text style={styles.ratingText}>4.8</Text>
          </View>
          {/* {item.availableInstances === 0 && (
            <View style={styles.soldOutOverlay}>
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutText}>{t('cart.soldOut')}</Text>
              </View>
            </View>
          )} */}
        </View>
        <View style={styles.plantInfo}>
          <Text style={styles.plantName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.plantMeta}>
            {item.careLevelTypeName || item.careLevel} • {item.sizeName}
          </Text>
          <View style={styles.plantFooter}>
            <Text style={styles.plantPrice}>
              {(item.basePrice || 0).toLocaleString(locale)}₫
            </Text>
            {!item.isUniqueInstance && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  void handleSelectNurseryForCart(item);
                }}
              >
                <Ionicons name="add" size={12} color={COLORS.black} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('catalog.headerTitle')}</Text>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => requireAuth(() => navigation.navigate('Cart'))}
          >
            <View>
              <Ionicons name="cart" size={24} color={COLORS.textPrimary} />
              <View style={styles.cartBadge}>
                <View style={styles.cartBadgeDot} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Show error state if there's an error
  if (error && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('catalog.headerTitle')}</Text>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => requireAuth(() => navigation.navigate('Cart'))}
          >
            <View>
              <Ionicons name="cart" size={24} color={COLORS.textPrimary} />
              <View style={styles.cartBadge}>
                <View style={styles.cartBadgeDot} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.loaderContainer}>
          <Ionicons name="alert-circle" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPlants}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('catalog.headerTitle')}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => requireAuth(() => navigation.navigate('Cart'))}
        >
          <View>
            <Ionicons name="cart" size={24} color={COLORS.textPrimary} />
            <View style={styles.cartBadge}>
              <View style={styles.cartBadgeDot} />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('catalog.searchPlaceholder')}
            placeholderTextColor="#0DA84D"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
          />
        </View>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Filters Section */}
      <Animated.View
        style={[
          styles.filtersWrapper,
          {
            height: filterHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 800],
            }),
            opacity: filterOpacity,
          },
        ]}
        pointerEvents={showFilters ? 'auto' : 'none'}
      >
        {renderFilterSection()}
      </Animated.View>

      {/* Results Section */}
      {!showFilters && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>
              {t('catalog.results', { count: plants.length })}
            </Text>
            <TouchableOpacity style={styles.sortButton}>
              <Text style={styles.sortLabel}>{t('catalog.sortBy')}</Text>
              <Text style={styles.sortValue}>{t('catalog.sortPopular')}</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={plants}
            renderItem={renderPlantCard}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={styles.plantRow}
            contentContainerStyle={styles.plantList}
            showsVerticalScrollIndicator={false}
          />
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
              <TouchableOpacity
                style={styles.nurseryPickerCloseBtn}
                onPress={closeNurseryPicker}
              >
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
            ) : nurseryOptions.length === 0 ? (
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
                {nurseryOptions.map((nursery) => {
                  const isSelected = nursery.nurseryId === selectedNurseryOptionId;

                  return (
                    <TouchableOpacity
                      key={`${nursery.nurseryId}-${nursery.commonPlantId ?? 'none'}`}
                      style={[
                        styles.nurseryPickerItem,
                        isSelected && styles.nurseryPickerItemSelected,
                      ]}
                      onPress={() => setSelectedNurseryOptionId(nursery.nurseryId)}
                    >
                      <View style={styles.nurseryPickerItemHeader}>
                        <Text style={styles.nurseryPickerItemName}>
                          {nursery.nurseryName}
                        </Text>
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

            {!isNurseryPickerLoading && nurseryOptions.length > 0 && (
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
                onPress={() => handleConfirmNurseryAdd(true)}
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
                onPress={() => handleConfirmNurseryAdd(false)}
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  errorText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING['3xl'],
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.lg,
  },
  retryButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  iconBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cartBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 10,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#13EC5B',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
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
  searchPlaceholder: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: '#0DA84D',
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
  filtersContainer: {
    flex: 1,
    backgroundColor: '#F6F8F6',
  },
  filtersWrapper: {
    overflow: 'hidden',
    backgroundColor: '#F6F8F6',
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
    paddingVertical: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  priceRangeContainer: {
    paddingVertical: SPACING.lg,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  priceInputWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  priceInputLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  priceInput: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    padding: 0,
  },
  priceInputCurrency: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.sm + 2,
  },
  priceRangeSeparator: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRangeLine: {
    width: 12,
    height: 2,
    backgroundColor: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#DBEAFE',
    marginHorizontal: SPACING.lg,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: 24,
  },
  chipActive: {
    backgroundColor: '#13EC5B',
    ...SHADOWS.md,
  },
  chipText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: '#475569',
  },
  chipTextActive: {
    fontWeight: '600',
    color: COLORS.black,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: '#E7FDF0',
    borderRadius: 24,
    gap: 6,
    borderWidth: 1,
    borderColor: '#0DA84D',
  },
  featureChipActive: {
    backgroundColor: '#0DA84D',
    borderColor: '#0DA84D',
  },
  featureText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.primary,
  },
  featureTextActive: {
    fontWeight: '600',
    color: COLORS.white,
  },
  iconChipContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconChipItem: {
    alignItems: 'center',
    minWidth: 80,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E7F3EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(19, 236, 91, 0.2)',
    borderColor: '#13EC5B',
  },
  iconChipLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  toggleContainer: {
    backgroundColor: '#DBEAFE',
    borderRadius: 24,
    padding: 4,
    flexDirection: 'row',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 16,
    gap: SPACING.sm,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  toggleText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  toggleTextActive: {
    fontWeight: '600',
  },
  fengShuiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: '#DBEAFE',
    borderRadius: 24,
    gap: SPACING.sm,
  },
  fengShuiChipActive: {
    backgroundColor: '#13EC5B',
  },
  fengShuiDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  fengShuiDotActive: {
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  fengShuiText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  fengShuiTextActive: {
    color: COLORS.white,
  },
  applyButtonContainer: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
    ...SHADOWS.md,
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
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  resultsTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortLabel: {
    fontSize: FONTS.sizes.md,
    color: '#4C9A66',
  },
  sortValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  plantList: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  plantRow: {
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  plantCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
  },
  plantImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.25,
    backgroundColor: '#F5F5F5',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  plantImage: {
    width: '100%',
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  ratingText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: COLORS.white,
  },
  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOutBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
  },
  soldOutText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  plantInfo: {
    gap: 2,
  },
  plantName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  plantMeta: {
    fontSize: FONTS.sizes.sm,
    color: '#4C9A66',
  },
  plantFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  plantPrice: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#13EC5B',
  },
  addButton: {
    width: 18,
    height: 18,
    backgroundColor: '#13EC5B',
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.35,
  },
  nurseryPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  nurseryPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  nurseryPickerSheet: {
    maxHeight: '75%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  nurseryPickerHandle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.gray300,
  },
  nurseryPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nurseryPickerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryPickerCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
  },
  nurseryPickerPlantName: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  nurseryPickerLoadingWrap: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  nurseryPickerEmptyText: {
    paddingVertical: SPACING.xl,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  nurseryPickerList: {
    maxHeight: 300,
  },
  nurseryPickerItem: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
    gap: 6,
  },
  nurseryPickerItemSelected: {
    borderColor: '#13EC5B',
    backgroundColor: '#F0FDF4',
  },
  nurseryPickerItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  nurseryPickerItemName: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryPickerItemAddress: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  nurseryPickerItemMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  nurseryPickerItemMetaText: {
    fontSize: FONTS.sizes.sm,
    color: '#4C9A66',
    fontWeight: '600',
  },
  nurseryPickerItemPrice: {
    fontSize: FONTS.sizes.sm,
    color: '#13EC5B',
    fontWeight: '700',
  },
  nurseryPickerQuantityRow: {
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
    borderColor: COLORS.gray300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  nurseryPickerQuantityBtnDisabled: {
    opacity: 0.45,
  },
  nurseryPickerQuantityValue: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryPickerActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nurseryPickerBuyNowBtn: {
    flex: 3,
    height: 44,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#13EC5B',
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nurseryPickerBuyNowText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#0DA84D',
  },
  nurseryPickerConfirmBtn: {
    flex: 7,
    height: 44,
    borderRadius: 24,
    backgroundColor: '#13EC5B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nurseryPickerConfirmBtnDisabled: {
    opacity: 0.45,
  },
  nurseryPickerConfirmText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#102216',
  },
});
