import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { roomDesignService } from '../../services';
import { useCartStore } from '../../stores';
import { RootStackParamList, RoomDesignGeneratedImage } from '../../types';
import { formatVietnamDateTime, notify, resolveImageUris } from '../../utils';
import { plantService } from '../../services';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const formatPrice = (value: number | null | undefined, locale: string): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  const normalizedLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
  return `${new Intl.NumberFormat(normalizedLocale, { maximumFractionDigits: 0 }).format(value)}${
    locale === 'vi' ? 'đ' : ' VND'
  }`;
};

export default function MyDesignScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'vi' ? 'vi' : 'en';
  const addCartItem = useCartStore((state) => state.addCartItem);

  const [items, setItems] = useState<RoomDesignGeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const loadMyDesigns = useCallback(async () => {
    try {
      setErrorMessage(null);
      const response = await roomDesignService.getMyDesigns();
      const sorted = [...response].sort((left, right) => {
        const leftTime = typeof left.createdAt === 'string' ? Date.parse(left.createdAt) : 0;
        const rightTime = typeof right.createdAt === 'string' ? Date.parse(right.createdAt) : 0;
        return rightTime - leftTime;
      });
      setItems(sorted);
    } catch {
      setErrorMessage(
        t('myDesign.loadFailed', {
          defaultValue: 'Unable to load your designs. Please try again.',
        })
      );
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const run = async () => {
        setIsLoading(true);
        await loadMyDesigns();
        if (isActive) {
          setIsLoading(false);
        }
      };

      void run();

      return () => {
        isActive = false;
      };
    }, [loadMyDesigns])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadMyDesigns();
    setIsRefreshing(false);
  }, [loadMyDesigns]);

  const handleAddToCart = useCallback(
    async (item: RoomDesignGeneratedImage) => {
      if (!item.commonPlantId) {
        return;
      }

      setActiveActionId(`cart-${item.id}`);

      try {
        const payload = await addCartItem({
          commonPlantId: item.commonPlantId,
          nurseryPlantComboId: null,
          nurseryMaterialId: null,
          quantity: 1,
        });

        notify({
          message: payload
            ? t('aiDesign.addToCartSuccess', { defaultValue: 'Added to cart.' })
            : t('aiDesign.addToCartFailed', {
                defaultValue: 'Unable to add this plant to cart.',
              }),
        });
      } catch {
        notify({
          message: t('aiDesign.addToCartFailed', {
            defaultValue: 'Unable to add this plant to cart.',
          }),
          useAlert: true,
        });
      } finally {
        setActiveActionId(null);
      }
    },
    [addCartItem, t]
  );

  const handleBuyNow = useCallback(
    async (item: RoomDesignGeneratedImage) => {
      if (!item.plantInstanceId) {
        return;
      }

      setActiveActionId(`buy-${item.id}`);

      try {
        const detail = await plantService.getPlantInstanceDetail(item.plantInstanceId);
        const detailImages = resolveImageUris(detail.images);
        const checkoutItem = {
          id: detail.id,
          name: detail.plantName ?? item.name ?? `Plant Instance #${item.plantInstanceId}`,
          size:
            detail.height != null
              ? `${detail.height} cm`
              : t('common.updating', { defaultValue: 'Updating' }),
          image: detailImages[0] ?? item.imageUrl,
          price: detail.specificPrice ?? item.price ?? 0,
          quantity: 1,
          buyNowItemId: detail.id,
          buyNowItemTypeName: 'PlantInstance',
          plantInstanceId: detail.id,
          isUniqueInstance: true,
        };

        navigation.navigate('Checkout', {
          source: 'buy-now',
          items: [checkoutItem],
        });
      } catch {
        notify({
          message: t('aiDesign.buyNowFailed', {
            defaultValue: 'Unable to open buy now for this plant instance.',
          }),
          useAlert: true,
        });
      } finally {
        setActiveActionId(null);
      }
    },
    [navigation, t]
  );

  const headerRight = useMemo(
    () => (
      <TouchableOpacity
        onPress={() => void handleRefresh()}
        style={styles.headerActionButton}
        accessibilityRole="button"
        accessibilityLabel={t('common.retry', { defaultValue: 'Refresh' })}
      >
        <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
      </TouchableOpacity>
    ),
    [handleRefresh, t]
  );

  const renderState = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>
            {t('common.loading', { defaultValue: 'Loading...' })}
          </Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.stateWrap}>
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={42} color={COLORS.error} />
            <Text style={styles.stateTitle}>
              {t('myDesign.emptyTitle', { defaultValue: 'No designs yet' })}
            </Text>
            <Text style={styles.stateSubtitle}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void handleRefresh()}>
              <Text style={styles.retryButtonText}>
                {t('common.retry', { defaultValue: 'Retry' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={styles.stateWrap}>
          <View style={styles.stateCard}>
            <Ionicons name="images-outline" size={42} color={COLORS.primary} />
            <Text style={styles.stateTitle}>
              {t('myDesign.emptyTitle', { defaultValue: 'No designs yet' })}
            </Text>
            <Text style={styles.stateSubtitle}>
              {t('myDesign.emptySubtitle', {
                defaultValue: 'Your generated room designs will appear here.',
              })}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={COLORS.primary}
          />
        }
        renderItem={({ item }) => {
          const canAddToCart = typeof item.commonPlantId === 'number' && item.commonPlantId > 0;
          const canBuyNow = typeof item.plantInstanceId === 'number' && item.plantInstanceId > 0;
          const isAddingToCart = activeActionId === `cart-${item.id}`;
          const isBuyingNow = activeActionId === `buy-${item.id}`;

          return (
            <View style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setSelectedImageUrl(item.imageUrl)}
                accessibilityRole="button"
              >
                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
              </TouchableOpacity>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name ?? t('myDesign.title', { defaultValue: 'My Design' })}
                </Text>
                <Text style={styles.cardPrice}>{formatPrice(item.price, locale)}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>
                    {t('myDesign.layoutDesignId', { defaultValue: 'Layout design ID' })}
                  </Text>
                  <Text style={styles.metaValue}>{item.layoutDesignId ?? '-'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>
                    {t('myDesign.createdAt', { defaultValue: 'Created' })}
                  </Text>
                  <Text style={styles.metaValue}>
                    {formatVietnamDateTime(item.createdAt ?? null, i18n.language, {
                      empty: '-',
                    })}
                  </Text>
                </View>

                {item.placementPosition ? (
                  <Text style={styles.bodyText} numberOfLines={2}>
                    {item.placementPosition}
                  </Text>
                ) : null}

                {(canAddToCart || canBuyNow) ? (
                  <View style={styles.actionRow}>
                    {canAddToCart ? (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.secondaryActionButton,
                          isAddingToCart && styles.actionButtonDisabled,
                        ]}
                        onPress={() => void handleAddToCart(item)}
                        disabled={isAddingToCart}
                      >
                        {isAddingToCart ? (
                          <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : null}
                        <Text style={styles.secondaryActionButtonText}>
                          {t('plantDetail.addToCart', { defaultValue: 'Add to cart' })}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {canBuyNow ? (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.primaryActionButton,
                          isBuyingNow && styles.actionButtonDisabled,
                        ]}
                        onPress={() => void handleBuyNow(item)}
                        disabled={isBuyingNow}
                      >
                        {isBuyingNow ? (
                          <ActivityIndicator size="small" color={COLORS.white} />
                        ) : null}
                        <Text style={styles.primaryActionButtonText}>
                          {t('plantDetail.buyNow', { defaultValue: 'Buy now' })}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        title={t('myDesign.title', { defaultValue: 'My Design' })}
        brandVariant="none"
        containerStyle={styles.header}
        left={
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerActionButton}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        }
        right={headerRight}
      />

      <Text style={styles.subtitle}>
        {t('myDesign.subtitle', {
          defaultValue: 'All AI room designs created for your account.',
        })}
      </Text>

      {renderState()}

      <Modal
        visible={Boolean(selectedImageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImageUrl(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedImageUrl(null)}
        >
          <View style={styles.modalContent}>
            {selectedImageUrl ? (
              <Image source={{ uri: selectedImageUrl }} style={styles.modalImage} resizeMode="contain" />
            ) : null}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedImageUrl(null)}>
              <Ionicons name="close" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    paddingHorizontal: SPACING.lg,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  subtitle: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['3xl'],
    gap: SPACING.md,
  },
  gridRow: {
    gap: SPACING.md,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS['2xl'],
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  cardImage: {
    width: '100%',
    height: 170,
    backgroundColor: COLORS.gray100,
  },
  cardBody: {
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  cardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardPrice: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  metaLabel: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
  },
  metaValue: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  bodyText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  actionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  secondaryActionButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  primaryActionButton: {
    backgroundColor: COLORS.primary,
  },
  actionButtonDisabled: {
    opacity: 0.75,
  },
  secondaryActionButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  primaryActionButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  stateCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  stateTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  stateText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  retryButton: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.secondaryLight,
  },
  retryButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
