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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { RootStackParamList, WishlistItem, WishlistItemType } from '../../types';
import { useAuthStore, useWishlistStore } from '../../stores';
import { wishlistService } from '../../services';
import { notify } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 10;

export default function WishlistScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated } = useAuthStore();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const setWishlistStatuses = useWishlistStore((state) => state.setStatuses);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const getItemTypeLabel = useCallback(
    (itemType: WishlistItemType) => {
      switch (itemType) {
        case 'CommonPlant':
          return t('wishlist.typeCommonPlant', { defaultValue: 'Common plant' });
        case 'PlantInstance':
          return t('wishlist.typePlantInstance', { defaultValue: 'Plant instance' });
        case 'NurseryPlantCombo':
          return t('wishlist.typeNurseryPlantCombo', { defaultValue: 'Nursery combo' });
        case 'NurseryMaterial':
          return t('wishlist.typeNurseryMaterial', { defaultValue: 'Nursery material' });
        default:
          return itemType;
      }
    },
    [t]
  );

  const fetchWishlist = useCallback(
    async (targetPage: number, options?: { refresh?: boolean }) => {
      if (options?.refresh) {
        setIsRefreshing(true);
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

        setItems((prev) => (targetPage === 1 ? nextItems : [...prev, ...nextItems]));
        setWishlistStatuses(
          nextItems.map((item) => ({
            itemType: item.itemType,
            itemId: item.itemId,
          })),
          true
        );
        setPageNumber(payload.pageNumber);
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

  const handleLoadMore = () => {
    if (!hasNext || isLoadingMore || isLoading) {
      return;
    }
    fetchWishlist(pageNumber + 1);
  };

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
          notify({
            message: t('wishlist.removeSuccess', {
              defaultValue: 'Removed from wishlist.',
            }),
          });
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
    [items, t]
  );

  const headerTitle = useMemo(() => {
    if (items.length > 0) {
      return t('wishlist.headerWithCount', {
        defaultValue: 'Wishlist ({{count}})',
        count: items.length,
      });
    }
    return t('wishlist.header', { defaultValue: 'Wishlist' });
  }, [items.length, t]);

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => {
    const imageUri = item.itemImageUrl?.trim();
    const showQuantity = item.quantity !== null && item.quantity !== undefined;

    return (
      <View style={styles.card}>
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
        <FlatList
          data={items}
          renderItem={renderWishlistItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
        />
      )}
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
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['4xl'],
    paddingTop: SPACING.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
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
    paddingVertical: SPACING.md,
  },
});
