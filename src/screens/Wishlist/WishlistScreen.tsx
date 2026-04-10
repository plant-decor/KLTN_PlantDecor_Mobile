import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import {
  CheckoutItem,
  NurseryPlantInstanceAvailability,
  RootStackParamList,
  WishlistItem,
  WishlistItemType,
} from '../../types';
import { useAuthStore, useWishlistStore } from '../../stores';
import { cartService, plantService, wishlistService } from '../../services';
import { notify } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PendingPlantAction = 'add' | 'buy';
type PageToken = number | 'left-ellipsis' | 'right-ellipsis';

const PAGE_SIZE = 10;

export default function WishlistScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthStore();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const setWishlistStatuses = useWishlistStore((state) => state.setStatuses);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [isNurseryPickerVisible, setIsNurseryPickerVisible] = useState(false);
  const [isNurseryPickerLoading, setIsNurseryPickerLoading] = useState(false);
  const [isConfirmingNursery, setIsConfirmingNursery] = useState(false);
  const [pendingPlantAction, setPendingPlantAction] = useState<PendingPlantAction>('add');
  const [pendingPlantItem, setPendingPlantItem] = useState<WishlistItem | null>(null);
  const [nurseryOptions, setNurseryOptions] = useState<NurseryPlantInstanceAvailability[]>([]);
  const [selectedNurseryId, setSelectedNurseryId] = useState<number | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  const effectiveTotalPages = useMemo(
    () => Math.max(1, totalPages, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount, totalPages]
  );

  const hasNextPage = useMemo(
    () => hasNext || pageNumber < effectiveTotalPages,
    [effectiveTotalPages, hasNext, pageNumber]
  );

  const visiblePageTokens = useMemo<PageToken[]>(() => {
    if (effectiveTotalPages <= 7) {
      return Array.from({ length: effectiveTotalPages }, (_, index) => index + 1);
    }

    const tokens: PageToken[] = [1];
    const startPage = Math.max(2, pageNumber - 1);
    const endPage = Math.min(effectiveTotalPages - 1, pageNumber + 1);

    if (startPage > 2) {
      tokens.push('left-ellipsis');
    }

    for (let page = startPage; page <= endPage; page += 1) {
      tokens.push(page);
    }

    if (endPage < effectiveTotalPages - 1) {
      tokens.push('right-ellipsis');
    }

    tokens.push(effectiveTotalPages);
    return tokens;
  }, [effectiveTotalPages, pageNumber]);

  const humanizeType = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }

    return trimmed
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ');
  }, []);

  const getItemTypeLabel = useCallback(
    (itemType: WishlistItemType) => {
      const translationKeySuffix = itemType.trim();

      return t(`wishlist.type${translationKeySuffix}`, {
        defaultValue: humanizeType(itemType),
      });
    },
    [humanizeType, t]
  );

  const fetchWishlist = useCallback(
    async (targetPage: number, options?: { refresh?: boolean; paging?: boolean }) => {
      if (options?.refresh) {
        setIsRefreshing(true);
      } else if (options?.paging) {
        setIsLoadingMore(true);
      } else if (targetPage === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const payload = await wishlistService.getWishlist({
          pageNumber: targetPage,
          pageSize: PAGE_SIZE,
        });
        const nextItems = payload.items ?? [];

        setItems(nextItems);
        setWishlistStatuses(
          nextItems.map((item) => ({
            itemType: item.itemType,
            itemId: item.itemId,
          })),
          true
        );
        setPageNumber(payload.pageNumber);
        setTotalPages(Math.max(1, payload.totalPages || 1));
        setTotalCount(payload.totalCount || 0);
        setHasNext(payload.hasNext);
      } catch (error: any) {
        notify({
          message:
            error?.response?.data?.message ||
            t('wishlist.loadFailed', { defaultValue: 'Unable to load wishlist.' }),
          useAlert: true,
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return;
      }
      fetchWishlist(1, { refresh: true });
    }, [fetchWishlist, isAuthenticated])
  );

  const handleRefresh = () => {
    if (!isAuthenticated || isRefreshing) {
      return;
    }
    fetchWishlist(1, { refresh: true });
  };

  const handlePrevPage = () => {
    if (pageNumber <= 1 || isLoading || isLoadingMore) {
      return;
    }

    void fetchWishlist(pageNumber - 1, { paging: true });
  };

  const handleNextPage = () => {
    if (pageNumber >= effectiveTotalPages || !hasNextPage || isLoading || isLoadingMore) {
      return;
    }

    void fetchWishlist(pageNumber + 1, { paging: true });
  };

  const handlePageSelect = (targetPage: number) => {
    if (
      targetPage < 1 ||
      targetPage > effectiveTotalPages ||
      targetPage === pageNumber ||
      isLoading ||
      isLoadingMore
    ) {
      return;
    }

    void fetchWishlist(targetPage, { paging: true });
  };

  const closeNurseryPicker = useCallback(() => {
    setIsNurseryPickerVisible(false);
    setIsNurseryPickerLoading(false);
    setIsConfirmingNursery(false);
    setPendingPlantAction('add');
    setPendingPlantItem(null);
    setNurseryOptions([]);
    setSelectedNurseryId(null);
    setSelectedQuantity(1);
  }, []);

  const openPlantNurseryPicker = useCallback(
    async (item: WishlistItem, action: PendingPlantAction) => {
      setPendingPlantItem(item);
      setPendingPlantAction(action);
      setIsNurseryPickerVisible(true);
      setIsNurseryPickerLoading(true);
      setNurseryOptions([]);
      setSelectedNurseryId(null);
      setSelectedQuantity(1);

      try {
        const options = await plantService.getNurseriesGotCommonPlantByPlantId(item.itemId);
        setNurseryOptions(options ?? []);
        setSelectedNurseryId(options?.[0]?.nurseryId ?? null);
      } catch (error: any) {
        notify({
          message:
            error?.response?.data?.message ||
            t('catalog.loadNurseryFailed', {
              defaultValue: 'Unable to load available nurseries.',
            }),
          useAlert: true,
        });
        closeNurseryPicker();
      } finally {
        setIsNurseryPickerLoading(false);
      }
    },
    [closeNurseryPicker, t]
  );

  const formatNurseryPrice = useCallback(
    (minPrice: number, maxPrice: number) => {
      if (!minPrice && !maxPrice) {
        return t('plantDetail.priceContact', { defaultValue: 'Contact' });
      }

      if (minPrice === maxPrice) {
        return `${minPrice.toLocaleString(locale)}đ`;
      }

      return `${minPrice.toLocaleString(locale)}đ - ${maxPrice.toLocaleString(locale)}đ`;
    },
    [locale, t]
  );

  const handleConfirmPlantNurseryAction = useCallback(async () => {
    if (isConfirmingNursery || !pendingPlantItem || selectedNurseryId === null) {
      return;
    }

    const selectedNursery = nurseryOptions.find(
      (option) => option.nurseryId === selectedNurseryId
    );

    if (!selectedNursery || selectedNursery.commonPlantId == null) {
      notify({
        message: t('cart.addFailed', {
          defaultValue: 'Unable to add to cart.',
        }),
        useAlert: true,
      });
      return;
    }

    try {
      setIsConfirmingNursery(true);

      const quantity = Math.max(1, selectedQuantity);
      const payload = await cartService.addCartItem({
        commonPlantId: selectedNursery.commonPlantId,
        nurseryPlantComboId: null,
        nurseryMaterialId: null,
        quantity,
      });

      if (pendingPlantAction === 'buy') {
        const normalizedImage = pendingPlantItem.itemImageUrl?.trim();
        const checkoutItem: CheckoutItem = {
          id: `wishlist_buy_now_plant_${pendingPlantItem.itemId}_${selectedNursery.nurseryId}`,
          name: pendingPlantItem.itemName,
          image: normalizedImage ? normalizedImage : undefined,
          price: selectedNursery.minPrice || pendingPlantItem.price || 0,
          quantity,
          cartItemId: payload.id,
          isUniqueInstance: false,
        };

        closeNurseryPicker();
        navigation.navigate('Checkout', {
          source: 'buy-now',
          items: [checkoutItem],
        });
        return;
      }

      notify({
        message: t('cart.addedMessage', { defaultValue: 'Added to cart.' }),
      });
      closeNurseryPicker();
    } catch (error: any) {
      notify({
        message:
          error?.response?.data?.message ||
          t('cart.addFailed', {
            defaultValue: 'Unable to add to cart.',
          }),
        useAlert: true,
      });
    } finally {
      setIsConfirmingNursery(false);
    }
  }, [
    closeNurseryPicker,
    isConfirmingNursery,
    navigation,
    nurseryOptions,
    pendingPlantAction,
    pendingPlantItem,
    selectedNurseryId,
    selectedQuantity,
    t,
  ]);

  const handleViewDetail = useCallback(
    (item: WishlistItem) => {
      switch (item.itemType) {
        case 'Plant':
          navigation.navigate('PlantDetail', { plantId: String(item.itemId) });
          return;
        case 'PlantInstance':
          navigation.navigate('PlantInstanceDetail', {
            plantInstanceId: item.itemId,
          });
          return;
        case 'Material':
          navigation.navigate('MaterialDetail', { materialId: item.itemId });
          return;
        case 'PlantCombo':
          navigation.navigate('ComboDetail', { comboId: item.itemId });
          return;
        default:
          return;
      }
    },
    [navigation]
  );

  const handleAddToCart = useCallback(
    async (item: WishlistItem) => {
      if (item.itemType === 'PlantInstance') {
        notify({
          message: t('catalog.uniquePlantCannotCart', {
            defaultValue: 'Unique plants cannot be added to cart directly.',
          }),
          useAlert: true,
        });
        return;
      }

      if (item.itemType === 'Plant') {
        await openPlantNurseryPicker(item, 'add');
        return;
      }

      try {
        if (item.itemType === 'Material') {
          await cartService.addCartItem({
            commonPlantId: null,
            nurseryPlantComboId: null,
            nurseryMaterialId: item.itemId,
            quantity: 1,
          });
        } else if (item.itemType === 'PlantCombo') {
          await cartService.addCartItem({
            commonPlantId: null,
            nurseryPlantComboId: item.itemId,
            nurseryMaterialId: null,
            quantity: 1,
          });
        }

        notify({
          message: t('cart.addedMessage', { defaultValue: 'Added to cart.' }),
        });
      } catch (error: any) {
        notify({
          message:
            error?.response?.data?.message ||
            t('cart.addFailed', {
              defaultValue: 'Unable to add to cart.',
            }),
          useAlert: true,
        });
      }
    },
    [openPlantNurseryPicker, t]
  );

  const handleBuyNow = useCallback(
    async (item: WishlistItem) => {
      if (item.itemType === 'Plant') {
        await openPlantNurseryPicker(item, 'buy');
        return;
      }

      if (item.itemType === 'PlantInstance') {
        const normalizedImage = item.itemImageUrl?.trim();
        const checkoutItem: CheckoutItem = {
          id: `wishlist_buy_now_instance_${item.itemId}`,
          name: item.itemName,
          image: normalizedImage ? normalizedImage : undefined,
          price: item.price || 0,
          quantity: 1,
          plantInstanceId: item.itemId,
          isUniqueInstance: true,
        };

        navigation.navigate('Checkout', {
          source: 'buy-now',
          items: [checkoutItem],
        });
        return;
      }

      try {
        const quantity = 1;
        const payload = await cartService.addCartItem({
          commonPlantId: null,
          nurseryPlantComboId: item.itemType === 'PlantCombo' ? item.itemId : null,
          nurseryMaterialId: item.itemType === 'Material' ? item.itemId : null,
          quantity,
        });

        const normalizedImage = item.itemImageUrl?.trim();
        const checkoutItem: CheckoutItem = {
          id: `wishlist_buy_now_${item.itemType}_${item.itemId}`,
          name: item.itemName,
          image: normalizedImage ? normalizedImage : undefined,
          price: item.price || payload.price || 0,
          quantity,
          cartItemId: payload.id,
          isUniqueInstance: false,
        };

        navigation.navigate('Checkout', {
          source: 'buy-now',
          items: [checkoutItem],
        });
      } catch (error: any) {
        notify({
          message:
            error?.response?.data?.message ||
            t('cart.addFailed', {
              defaultValue: 'Unable to add to cart.',
            }),
          useAlert: true,
        });
      }
    },
    [navigation, openPlantNurseryPicker, t]
  );

  const handleRemoveItem = useCallback(
    (targetItem: WishlistItem) => {
      const previousItems = items;
      setItems((currentItems) =>
        currentItems.filter((item) => item.id !== targetItem.id)
      );
      setWishlistStatuses(
        [{ itemType: targetItem.itemType, itemId: targetItem.itemId }],
        false
      );

      void wishlistService
        .removeWishlistItem(targetItem.itemType, targetItem.itemId)
        .then(() => {
          const targetPage = previousItems.length === 1 && pageNumber > 1 ? pageNumber - 1 : pageNumber;

          notify({
            message: t('wishlist.removeSuccess', {
              defaultValue: 'Removed from wishlist.',
            }),
          });

          void fetchWishlist(targetPage, { refresh: true });
        })
        .catch((error) => {
          setItems(previousItems);
          setWishlistStatuses(
            [{ itemType: targetItem.itemType, itemId: targetItem.itemId }],
            true
          );
          notify({
            message:
              error?.response?.data?.message ||
              t('wishlist.removeFailed', {
                defaultValue: 'Unable to remove from wishlist.',
              }),
            useAlert: true,
          });
        });
    },
    [fetchWishlist, items, pageNumber, t]
  );

  const headerTitle = useMemo(() => {
    const count = totalCount || items.length;

    if (count > 0) {
      return t('wishlist.headerWithCount', {
        defaultValue: 'Wishlist ({{count}})',
        count,
      });
    }
    return t('wishlist.header', { defaultValue: 'Wishlist' });
  }, [items.length, t, totalCount]);

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => {
    const imageUri = item.itemImageUrl?.trim();
    const showQuantity = item.quantity !== null && item.quantity !== undefined;
    const showNurseryName = Boolean(item.nurseryName?.trim());
    const canAddToCart = item.itemType !== 'PlantInstance';

    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.imageWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <Ionicons name="leaf-outline" size={28} color={COLORS.gray400} />
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {item.itemName}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{getItemTypeLabel(item.itemType)}</Text>
              </View>
              {showQuantity && item.quantity != null && (
                <Text style={styles.quantityText}>
                  {t('wishlist.quantityLabel', 'Available: {{count}}', {
                    count: item.quantity,
                  })}
                </Text>
              )}
              {showNurseryName && (
                <Text style={styles.quantityText} numberOfLines={1}>
                  {item.nurseryName}
                </Text>
              )}
            </View>

            <Text style={styles.price}>
              {(item.price || 0).toLocaleString(locale)}đ
            </Text>

            {item.additionalInfo ? (
              <Text style={styles.additionalInfo} numberOfLines={2}>
                {item.additionalInfo}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewDetailActionButton]}
            onPress={() => handleViewDetail(item)}
          >
            <Ionicons name="eye-outline" size={14} color="#1D4ED8" />
            <Text style={[styles.actionButtonText, styles.viewDetailActionText]}>
              {t('wishlist.viewDetail', { defaultValue: 'View detail' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.buyNowActionButton]}
            onPress={() => {
              void handleBuyNow(item);
            }}
          >
            <Ionicons name="flash-outline" size={14} color="#C2410C" />
            <Text style={[styles.actionButtonText, styles.buyNowActionText]}>
              {t('plantDetail.buyNow', { defaultValue: 'Buy now' })}
            </Text>
          </TouchableOpacity>

          {canAddToCart && (
            <TouchableOpacity
              style={[styles.actionButton, styles.addToCartActionButton]}
              onPress={() => {
                void handleAddToCart(item);
              }}
            >
              <Ionicons name="cart-outline" size={14} color="#0F6F3C" />
              <Text style={[styles.actionButtonText, styles.addToCartActionText]}>
                {t('plantDetail.addToCart', { defaultValue: 'Add to cart' })}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item)}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={78} color={COLORS.gray300} />
          <Text style={styles.emptyText}>
            {t('common.loginRequiredTitle', { defaultValue: 'Login required' })}
          </Text>
          <Text style={styles.emptySubtext}>
            {t('common.loginRequiredMessage', {
              defaultValue: 'Please login to continue.',
            })}
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>
              {t('common.login', { defaultValue: 'Login' })}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.headerSidePlaceholder} />
      </View>

      {isLoading && items.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={78} color={COLORS.gray300} />
          <Text style={styles.emptyText}>
            {t('wishlist.emptyTitle', { defaultValue: 'Your wishlist is empty' })}
          </Text>
          <Text style={styles.emptySubtext}>
            {t('wishlist.emptySubtitle', {
              defaultValue: 'Tap the heart icon to save plants for later.',
            })}
          </Text>
        </View>
      ) : (
        <View style={styles.listSection}>
          <FlatList
            style={styles.listFlex}
            data={items}
            renderItem={renderWishlistItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
          />

          <View
            style={[styles.paginationFooter, { paddingBottom: SPACING.xs + insets.bottom }]}
          >
            {isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null}

            <View style={styles.paginationRow}>
              <View style={styles.paginationControl}>
                <TouchableOpacity
                  style={[styles.paginationButton, pageNumber <= 1 && styles.paginationButtonDisabled]}
                  onPress={handlePrevPage}
                  disabled={pageNumber <= 1 || isLoadingMore || isLoading}
                >
                  <Ionicons name="chevron-back" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>

                <View style={styles.pageNumberList}>
                  {visiblePageTokens.map((token, index) =>
                    typeof token === 'number' ? (
                      <TouchableOpacity
                        key={`wishlist-page-${token}`}
                        style={[
                          styles.pageNumberChip,
                          token === pageNumber && styles.pageNumberChipActive,
                        ]}
                        onPress={() => handlePageSelect(token)}
                        disabled={token === pageNumber || isLoadingMore || isLoading}
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
                      <Text
                        key={`wishlist-page-ellipsis-${token}-${index}`}
                        style={styles.pageNumberEllipsis}
                      >
                        ...
                      </Text>
                    )
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    (pageNumber >= effectiveTotalPages || !hasNextPage) &&
                      styles.paginationButtonDisabled,
                  ]}
                  onPress={handleNextPage}
                  disabled={
                    pageNumber >= effectiveTotalPages || !hasNextPage || isLoadingMore || isLoading
                  }
                >
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
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
        <View style={styles.nurseryPickerBackdrop}>
          <TouchableOpacity
            style={styles.nurseryPickerDismissArea}
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
                style={styles.nurseryPickerCloseButton}
                onPress={closeNurseryPicker}
              >
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {pendingPlantItem ? (
              <Text style={styles.nurseryPickerTargetName} numberOfLines={1}>
                {pendingPlantItem.itemName}
              </Text>
            ) : null}

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
              <FlatList
                data={nurseryOptions}
                keyExtractor={(nursery) => `wishlist-nursery-${nursery.nurseryId}`}
                style={styles.nurseryPickerList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: nursery }) => {
                  const isSelected = selectedNurseryId === nursery.nurseryId;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.nurseryPickerItem,
                        isSelected && styles.nurseryPickerItemSelected,
                      ]}
                      onPress={() => setSelectedNurseryId(nursery.nurseryId)}
                    >
                      <View style={styles.nurseryPickerItemHeader}>
                        <Text style={styles.nurseryPickerItemName}>{nursery.nurseryName}</Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#13EC5B" />
                        )}
                      </View>
                      <Text style={styles.nurseryPickerItemAddress} numberOfLines={1}>
                        {nursery.address}
                      </Text>
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
                }}
              />
            )}

            {!isNurseryPickerLoading && nurseryOptions.length > 0 && (
              <View style={styles.nurseryPickerQuantityRow}>
                <Text style={styles.nurseryPickerQuantityLabel}>
                  {t('cart.quantity', { defaultValue: 'Quantity' })}
                </Text>
                <View style={styles.nurseryPickerQuantityStepper}>
                  <TouchableOpacity
                    style={[
                      styles.nurseryPickerQuantityButton,
                      selectedQuantity <= 1 && styles.nurseryPickerQuantityButtonDisabled,
                    ]}
                    disabled={selectedQuantity <= 1}
                    onPress={() => setSelectedQuantity((current) => Math.max(1, current - 1))}
                  >
                    <Ionicons name="remove" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  <Text style={styles.nurseryPickerQuantityValue}>{selectedQuantity}</Text>
                  <TouchableOpacity
                    style={styles.nurseryPickerQuantityButton}
                    onPress={() => setSelectedQuantity((current) => Math.min(99, current + 1))}
                  >
                    <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.nurseryPickerConfirmButton,
                (isNurseryPickerLoading ||
                  isConfirmingNursery ||
                  nurseryOptions.length === 0 ||
                  selectedNurseryId === null) &&
                  styles.nurseryPickerConfirmButtonDisabled,
              ]}
              disabled={
                isNurseryPickerLoading ||
                isConfirmingNursery ||
                nurseryOptions.length === 0 ||
                selectedNurseryId === null
              }
              onPress={() => {
                void handleConfirmPlantNurseryAction();
              }}
            >
              {isConfirmingNursery ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.nurseryPickerConfirmText}>
                  {pendingPlantAction === 'buy'
                    ? `${t('plantDetail.buyNow', { defaultValue: 'Buy now' })} x${selectedQuantity}`
                    : `${t('plantDetail.addToCart', { defaultValue: 'Add to cart' })} x${selectedQuantity}`}
                </Text>
              )}
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSidePlaceholder: {
    width: 32,
  },
  headerTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listSection: {
    flex: 1,
  },
  listFlex: {
    flex: 1,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageWrap: {
    width: 86,
    height: 86,
    borderRadius: 20,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    marginLeft: SPACING.md,
    paddingRight: SPACING['4xl'],
  },
  name: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  typeBadge: {
    backgroundColor: '#E7FDF0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: COLORS.primary,
  },
  quantityText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  price: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  additionalInfo: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    flexWrap: 'nowrap',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  actionButtonText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  viewDetailActionButton: {
    backgroundColor: '#EEF2FF',
  },
  viewDetailActionText: {
    color: '#1D4ED8',
  },
  buyNowActionButton: {
    backgroundColor: '#FFF7ED',
  },
  buyNowActionText: {
    color: '#C2410C',
  },
  addToCartActionButton: {
    backgroundColor: '#E7FDF0',
  },
  addToCartActionText: {
    color: '#0F6F3C',
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING['3xl'],
  },
  emptyText: {
    marginTop: SPACING.lg,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING['3xl'],
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  loginButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  footerLoader: {
    paddingVertical: SPACING.xs,
  },
  paginationFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  paginationRow: {
    paddingTop: SPACING.xs,
  },
  paginationControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageNumberList: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  pageNumberChip: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  pageNumberChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  pageNumberChipText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
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
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    opacity: 0.35,
  },
  nurseryPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  nurseryPickerDismissArea: {
    flex: 1,
  },
  nurseryPickerSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    maxHeight: '72%',
  },
  nurseryPickerHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray300,
    marginBottom: SPACING.md,
  },
  nurseryPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  nurseryPickerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryPickerCloseButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nurseryPickerTargetName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  nurseryPickerLoadingWrap: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  nurseryPickerEmptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  nurseryPickerList: {
    maxHeight: 240,
  },
  nurseryPickerItem: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  nurseryPickerItemSelected: {
    borderColor: '#13EC5B',
    backgroundColor: '#F0FDF4',
  },
  nurseryPickerItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  nurseryPickerItemName: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingRight: 8,
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
    color: COLORS.primary,
    fontWeight: '700',
  },
  nurseryPickerQuantityRow: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nurseryPickerQuantityLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  nurseryPickerQuantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  nurseryPickerQuantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nurseryPickerQuantityButtonDisabled: {
    opacity: 0.4,
  },
  nurseryPickerQuantityValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryPickerConfirmButton: {
    marginTop: SPACING.sm,
    backgroundColor: '#13EC5B',
    borderRadius: 20,
    paddingVertical: SPACING.sm + 2,
    alignItems: 'center',
  },
  nurseryPickerConfirmButtonDisabled: {
    opacity: 0.45,
  },
  nurseryPickerConfirmText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
});
