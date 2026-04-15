import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants';
import { BrandedHeader } from '../../components/branding';
import { CartApiItem, CheckoutItem, RootStackParamList } from '../../types';
import { useAuthStore, useCartStore } from '../../stores';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const PAGE_SIZE = 10;
type PageToken = number | 'left-ellipsis' | 'right-ellipsis';

type CartDisplayItem = {
  id: string;
  plantId: number | null;
  materialId?: number | null;
  plantComboId?: number | null;
  name: string;
  nurseryName: string;
  size?: string;
  image?: string;
  price: number;
  subTotal: number;
  quantity: number;
  commonPlantId: number | null;
  nurseryPlantComboId: number | null;
  nurseryMaterialId: number | null;
  isAvailable: boolean;
};

const mapCartItems = (
  items: CartApiItem[],
  fallbackSize: string
): CartDisplayItem[] =>
  items.map((item) => {
    const itemWithEntityIds = item as CartApiItem & {
      materialId?: number | null;
      plantComboId?: number | null;
    };

    return {
      id: String(item.id),
      plantId: item.plantId ?? null,
      materialId: itemWithEntityIds.materialId ?? null,
      plantComboId: itemWithEntityIds.plantComboId ?? null,
      name: item.productName,
      nurseryName: item.nurseryName,
      size: fallbackSize,
      price: item.price,
      subTotal: item.subTotal ?? item.price * item.quantity,
      quantity: item.quantity,
      commonPlantId: item.commonPlantId,
      nurseryPlantComboId: item.nurseryPlantComboId,
      nurseryMaterialId: item.nurseryMaterialId,
      isAvailable: true,
    };
  });

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CartDisplayItem[]>([]);
  const [footerHeight, setFooterHeight] = useState(0);
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const { isAuthenticated } = useAuthStore();
  const {
    cartItems,
    cartMeta,
    fetchCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    isLoading,
  } = useCartStore();
  const authPromptedRef = useRef(false);
  const currentPage = Math.max(1, cartMeta?.pageNumber ?? 1);
  const totalPagesFromCount = Math.ceil((cartMeta?.totalCount ?? items.length) / PAGE_SIZE);
  const totalPages = Math.max(1, cartMeta?.totalPages ?? 1, totalPagesFromCount);
  const hasNextPage = cartMeta?.hasNext ?? currentPage < totalPages;
  const visiblePageTokens = useMemo<PageToken[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const tokens: PageToken[] = [1];
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    if (startPage > 2) {
      tokens.push('left-ellipsis');
    }

    for (let page = startPage; page <= endPage; page += 1) {
      tokens.push(page);
    }

    if (endPage < totalPages - 1) {
      tokens.push('right-ellipsis');
    }

    tokens.push(totalPages);
    return tokens;
  }, [currentPage, totalPages]);

  const loadCartPage = useCallback(
    async (targetPage: number) => {
      await fetchCart({ pageNumber: targetPage, pageSize: PAGE_SIZE });
    },
    [fetchCart],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadCartPage(1).catch(() => {
      // Error state handled by UI; keep silent here.
    });
  }, [isAuthenticated, loadCartPage]);

  useEffect(() => {
    const fallbackSize = t('common.updating', { defaultValue: 'Updating' });
    setItems(mapCartItems(cartItems, fallbackSize));
  }, [cartItems, t]);

  useEffect(() => {
    if (isAuthenticated || authPromptedRef.current) {
      return;
    }

    authPromptedRef.current = true;
    Alert.alert(
      t('common.loginRequiredTitle', { defaultValue: 'Login required' }),
      t('common.loginRequiredMessage', { defaultValue: 'Please login to continue.' }),
      [
        {
          text: t('common.login', { defaultValue: 'Login' }),
          onPress: () => navigation.navigate('Login'),
        },
      ],
    );
  }, [isAuthenticated, navigation, t]);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const totalPrice = useMemo(
    () =>
      items
        .filter((item) => item.isAvailable)
        .reduce(
          (sum, item) => sum + (item.subTotal ?? item.price * item.quantity),
          0,
        ),
    [items],
  );

  const listBottomPadding = useMemo(
    () => (footerHeight > 0 ? footerHeight : 220) + SPACING.lg,
    [footerHeight],
  );

  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setFooterHeight((previousHeight) =>
      Math.abs(previousHeight - nextHeight) > 1 ? nextHeight : previousHeight,
    );
  }, []);

  const hasDetailTarget = (item: CartDisplayItem) =>
    item.plantId != null ||
    item.materialId != null ||
    item.plantComboId != null;

  const handleViewDetail = (item: CartDisplayItem) => {
    if (item.plantId != null) {
      navigation.navigate('PlantDetail', { plantId: String(item.plantId) });
      return;
    }

    if (item.materialId != null) {
      navigation.navigate('MaterialDetail', {
        materialId: item.materialId,
      });
      return;
    }

    if (item.plantComboId != null) {
      navigation.navigate('ComboDetail', {
        comboId: item.plantComboId,
      });
    }
  };

  const incrementQuantity = (id: string) => {
    const nextQuantity = items.find((item) => item.id === id)?.quantity ?? 1;
    const quantity = nextQuantity + 1;
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.isAvailable
          ? { ...item, quantity, subTotal: item.price * quantity }
          : item,
      ),
    );
    void updateCartItem(Number(id), quantity).catch(() => {
      // keep optimistic state for now
    });
  };

  const decrementQuantity = (id: string) => {
    const currentQuantity = items.find((item) => item.id === id)?.quantity ?? 1;
    const quantity = Math.max(1, currentQuantity - 1);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.isAvailable) return item;
        return { ...item, quantity, subTotal: item.price * quantity };
      }),
    );
    void updateCartItem(Number(id), quantity).catch(() => {
      // keep optimistic state for now
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    void removeCartItem(Number(id)).catch(() => {
      void loadCartPage(currentPage).catch(() => {
        // keep optimistic state for now
      });
    });
  };

  const handleClearAll = () => {
    setItems([]);
    void clearCart().catch(() => {
      void loadCartPage(currentPage).catch(() => {
        // keep optimistic state for now
      });
    });
  };

  const handlePrevPage = () => {
    if (currentPage <= 1 || isLoading) {
      return;
    }

    void loadCartPage(currentPage - 1).catch(() => {
      // preserve current list if paging fails
    });
  };

  const handleNextPage = () => {
    if (currentPage >= totalPages || !hasNextPage || isLoading) {
      return;
    }

    void loadCartPage(currentPage + 1).catch(() => {
      // preserve current list if paging fails
    });
  };

  const handlePageSelect = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === currentPage || isLoading) {
      return;
    }

    void loadCartPage(targetPage).catch(() => {
      // preserve current list if paging fails
    });
  };

  const renderCartItem = ({ item }: { item: CartDisplayItem }) => {
    const isUnavailable = !item.isAvailable;
    const itemSubTotal = item.subTotal ?? item.price * item.quantity;
    const canViewDetail = hasDetailTarget(item);

    return (
      <View style={[styles.cartItem, isUnavailable && styles.cartItemUnavailable]}>
        <TouchableOpacity
          style={styles.itemContentPressable}
          activeOpacity={canViewDetail ? 0.82 : 1}
          disabled={!canViewDetail}
          onPress={() => handleViewDetail(item)}
        >
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
          ) : (
            <View style={styles.itemImagePlaceholder}>
              <Ionicons name="leaf-outline" size={28} color={COLORS.gray400} />
            </View>
          )}

          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, isUnavailable && styles.unavailableText]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.nurseryText} numberOfLines={1}>
              {t('cart.nurseryLabel', { defaultValue: 'Nursery:' })} {item.nurseryName || '-'}
            </Text>

            <View style={styles.priceBreakdownWrap}>
              <View style={styles.priceBreakdownRow}>
                <Text style={styles.priceBreakdownLabel}>
                  {t('cart.priceLabel', { defaultValue: 'Price:' })}
                </Text>
                <Text style={styles.priceBreakdownValue}>{(item.price || 0).toLocaleString(locale)}đ</Text>
              </View>
              <View style={styles.priceBreakdownRow}>
                <Text style={styles.priceBreakdownLabel}>
                  {t('cart.itemSubtotalLabel', { defaultValue: 'Item subtotal:' })}
                </Text>
                <Text style={styles.priceBreakdownSubtotal}>{itemSubTotal.toLocaleString(locale)}đ</Text>
              </View>
            </View>

            <View style={styles.bottomRow}>
              {!isUnavailable && (
                <View style={styles.quantityPill}>
                  <TouchableOpacity
                    style={[styles.quantityCircle, styles.quantityMinus]}
                    onPress={() => decrementQuantity(item.id)}
                  >
                    <Ionicons name="remove" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={[styles.quantityCircle, styles.quantityPlus]}
                    onPress={() => incrementQuantity(item.id)}
                  >
                    <Ionicons name="add" size={16} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              )}

              {canViewDetail && (
                <TouchableOpacity
                  style={styles.viewDetailBtn}
                  onPress={() => handleViewDetail(item)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.viewDetailText}>
                    {t('cart.viewDetail', { defaultValue: 'View detail' })}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>

            {isUnavailable && (
              <View style={styles.warningRow}>
                <Ionicons name="alert-circle" size={15} color={COLORS.error} />
                <Text style={styles.warningText}>{t('cart.unavailableMessage')}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {!isUnavailable ? (
          <TouchableOpacity style={styles.closeBtn} onPress={() => removeItem(item.id)}>
            <Ionicons name="close" size={20} color={COLORS.gray500} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => removeItem(item.id)}>
            <Text style={styles.deleteText}>{t('cart.delete')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!isAuthenticated) {
    return <SafeAreaView style={styles.container} edges={['top']} />;
  }

  if (isLoading && items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <BrandedHeader
          containerStyle={styles.header}
          sideWidth={56}
          brandVariant="none"
          title={t('cart.header')}
          titleStyle={styles.headerContextTitle}
          left={
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          }
          right={<View style={styles.headerSidePlaceholder} />}
        />
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color={COLORS.gray300} />
          <Text style={styles.emptyText}>{t('cart.emptyTitle')}</Text>
          <Text style={styles.emptySubtext}>{t('cart.emptySubtitle')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={88}
        brandVariant="none"
        title={t('cart.headerWithCount', { count: totalItems })}
        titleStyle={styles.headerContextTitle}
        left={
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity style={styles.headerEditBtn} onPress={handleClearAll}>
            <Text style={styles.headerEditText}>{t('cart.clearAll')}</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: listBottomPadding }]}
        showsVerticalScrollIndicator={false}
      />

      <View
        style={[styles.footerSummary, { paddingBottom: SPACING.md + insets.bottom }]}
        onLayout={handleFooterLayout}
      >
        <View style={styles.paginationRow}>
          <View style={styles.paginationControl}>
            <TouchableOpacity
              style={[styles.paginationButton, currentPage <= 1 && styles.paginationButtonDisabled]}
              onPress={handlePrevPage}
              disabled={currentPage <= 1 || isLoading}
            >
              <Ionicons name="chevron-back" size={16} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <View style={styles.pageNumberList}>
              {visiblePageTokens.map((token, index) =>
                typeof token === 'number' ? (
                  <TouchableOpacity
                    key={`cart-page-${token}`}
                    style={[
                      styles.pageNumberChip,
                      token === currentPage && styles.pageNumberChipActive,
                    ]}
                    onPress={() => handlePageSelect(token)}
                    disabled={token === currentPage || isLoading}
                  >
                    <Text
                      style={[
                        styles.pageNumberChipText,
                        token === currentPage && styles.pageNumberChipTextActive,
                      ]}
                    >
                      {token}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text key={`cart-page-ellipsis-${token}-${index}`} style={styles.pageNumberEllipsis}>
                    ...
                  </Text>
                )
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.paginationButton,
                (currentPage >= totalPages || !hasNextPage) && styles.paginationButtonDisabled,
              ]}
              onPress={handleNextPage}
              disabled={currentPage >= totalPages || !hasNextPage || isLoading}
            >
              <Ionicons name="chevron-forward" size={16} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.footerLabel}>{t('cart.subtotal')}</Text>
          <Text style={styles.footerSubValue}>{totalPrice.toLocaleString(locale)}đ</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text style={styles.footerTotalLabel}>{t('cart.total')}</Text>
          <Text style={styles.footerValue}>{totalPrice.toLocaleString(locale)}đ</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => {
            const checkoutItems: CheckoutItem[] = items
              .filter((item) => item.isAvailable)
              .map((item) => ({
                id: item.id,
                name: item.name,
                size: item.size,
                image: item.image,
                price: item.price,
                quantity: item.quantity,
                cartItemId: Number(item.id),
              }));

            navigation.navigate('Checkout', {
              source: 'cart',
              items: checkoutItems,
            });
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutBtnText}>{t('cart.checkout')}</Text>
        </TouchableOpacity>
      </View>
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
  headerEditBtn: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  headerEditText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  headerContextTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  cartItem: {
    backgroundColor: COLORS.white,
    borderRadius: 30,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    position: 'relative',
  },
  itemContentPressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cartItemUnavailable: {
    opacity: 0.78,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: COLORS.gray100,
  },
  itemImagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    zIndex: 2,
  },
  deleteBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 2,
  },
  deleteText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.error,
    fontWeight: '500',
  },
  itemInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    paddingRight: SPACING['4xl'],
  },
  itemName: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  nurseryText: {
    marginTop: 2,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  unavailableText: {
    color: COLORS.gray600,
  },
  itemPrice: {
    marginTop: 4,
    fontSize: 36 / 2,
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  priceBreakdownWrap: {
    marginTop: 6,
    gap: 2,
  },
  priceBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceBreakdownLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  priceBreakdownValue: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  priceBreakdownSubtotal: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  priceUnavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: SPACING.sm,
  },
  soldOutBadge: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  soldOutText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  oldPrice: {
    color: COLORS.gray500,
    textDecorationLine: 'line-through',
    fontSize: FONTS.sizes.xl,
  },
  bottomRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewDetailBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  itemSize: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.primary,
    fontWeight: '500',
  },
  quantityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 8,
  },
  quantityCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityMinus: {
    backgroundColor: COLORS.gray200,
  },
  quantityPlus: {
    backgroundColor: COLORS.primaryLight,
  },
  quantityText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
    minWidth: 16,
    textAlign: 'center',
  },
  warningRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  warningText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.lg,
    fontWeight: '400',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  footerSummary: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.xs,
  },
  paginationRow: {
    paddingTop: SPACING.xs,
    marginBottom: 2,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTotalRow: {
    marginTop: 2,
  },
  footerLabel: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
  },
  footerSubValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  footerTotalLabel: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  footerValue: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.primaryLight,
  },
  checkoutBtn: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 4,
  },
  checkoutBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
  },
});
