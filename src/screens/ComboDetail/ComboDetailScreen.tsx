import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants';
import { CheckoutItem, RootStackParamList } from '../../types';
import { useAuthStore, useWishlistStore } from '../../stores';
import { cartService, plantService } from '../../services';
import { getWishlistKey, notify } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'ComboDetail'>;

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/600x400?text=Combo';

export default function ComboDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { comboId, nurseryPlantComboId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
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
    if (!isAuthenticated) {
      return;
    }

    void ensureStatus([
      {
        itemType: 'PlantCombo',
        itemId: wishlistItemId,
      },
    ]);
  }, [ensureStatus, isAuthenticated, wishlistItemId]);

  const isWishlisted = wishlistStatus[wishlistKey] ?? false;

  const imageUrl = useMemo(() => combo?.images?.[0] || PLACEHOLDER_IMAGE, [combo?.images]);

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

  const handleAddToCart = useCallback(async () => {
    if (!requireAuth()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await cartService.addCartItem({
        commonPlantId: null,
        nurseryPlantComboId: wishlistItemId,
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
  }, [quantity, requireAuth, t, wishlistItemId]);

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
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!combo || error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('comboDetail.title', { defaultValue: 'Combo detail' })}</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.loaderWrap}>
          <Ionicons name="alert-circle" size={54} color={COLORS.error} />
          <Text style={styles.errorText}>
            {error ||
              t('comboDetail.notFound', {
                defaultValue: 'Combo not found.',
              })}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryText}>{t('common.goBack', { defaultValue: 'Go back' })}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('comboDetail.title', { defaultValue: 'Combo detail' })}</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => void handleToggleWishlist()}>
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={22}
            color={isWishlisted ? COLORS.error : COLORS.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />

        <Text style={styles.name}>{combo.comboName}</Text>
        <Text style={styles.code}>{combo.comboCode}</Text>
        <Text style={styles.price}>{`${combo.comboPrice.toLocaleString(locale)}₫`}</Text>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>{t('comboDetail.type', { defaultValue: 'Type' })}</Text>
          <Text style={styles.metaValue}>{combo.comboTypeName || '-'}</Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>{t('comboDetail.season', { defaultValue: 'Season' })}</Text>
          <Text style={styles.metaValue}>{combo.seasonName || '-'}</Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>{t('comboDetail.description', { defaultValue: 'Description' })}</Text>
          <Text style={styles.metaValue}>{combo.description || '-'}</Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>{t('comboDetail.suitableSpace', { defaultValue: 'Suitable space' })}</Text>
          <Text style={styles.metaValue}>{combo.suitableSpace || '-'}</Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>{t('comboDetail.theme', { defaultValue: 'Theme' })}</Text>
          <Text style={styles.metaValue}>{combo.themeName || '-'}</Text>
          <Text style={styles.metaValue}>{combo.themeDescription || '-'}</Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>{t('comboDetail.items', { defaultValue: 'Combo items' })}</Text>
          {combo.comboItems.length > 0 ? (
            combo.comboItems.map((item) => (
              <Text key={item.id} style={styles.metaValue}>{
                `• ${item.plantName} x${item.quantity}`
              }</Text>
            ))
          ) : (
            <Text style={styles.metaValue}>-</Text>
          )}
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>{t('comboDetail.tags', { defaultValue: 'Tags' })}</Text>
          <Text style={styles.metaValue}>
            {combo.tagsNavigation.length > 0
              ? combo.tagsNavigation.map((tag) => tag.tagName).join(', ')
              : '-'}
          </Text>
        </View>

        <View style={styles.quantityRow}>
          <Text style={styles.quantityLabel}>{t('cart.quantity', { defaultValue: 'Quantity' })}</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={[styles.quantityBtn, quantity <= 1 && styles.quantityBtnDisabled]}
              disabled={quantity <= 1}
              onPress={() => setQuantity((previous) => Math.max(1, previous - 1))}
            >
              <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityBtn}
              onPress={() => setQuantity((previous) => Math.min(99, previous + 1))}
            >
              <Ionicons name="add" size={16} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.buyNowButton, isSubmitting && styles.addToCartDisabled]}
            disabled={isSubmitting}
            onPress={handleBuyNow}
          >
            <Text style={styles.buyNowText}>
              {t('plantDetail.buyNow', { defaultValue: 'Buy now' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addToCartButton, isSubmitting && styles.addToCartDisabled]}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8F6',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['4xl'],
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    backgroundColor: '#E3E7E3',
  },
  name: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  code: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  price: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  metaCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D9E5DD',
  },
  metaLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  quantityRow: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E5DD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  quantityBtnDisabled: {
    opacity: 0.4,
  },
  quantityValue: {
    minWidth: 20,
    textAlign: 'center',
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  actionRow: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  buyNowButton: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#13EC5B',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  buyNowText: {
    fontSize: FONTS.sizes.lg,
    color: '#13EC5B',
    fontWeight: '700',
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: '#13EC5B',
    borderRadius: 24,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  addToCartDisabled: {
    opacity: 0.7,
  },
  addToCartText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.white,
    fontWeight: '700',
  },
  errorText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
