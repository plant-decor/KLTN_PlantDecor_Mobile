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
import { BrandedHeader } from '../../components/branding';
import { RootStackParamList, CheckoutItem } from '../../types';
import { useAuthStore, useWishlistStore } from '../../stores';
import { plantService } from '../../services';
import { getWishlistKey, notify } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'PlantInstanceDetail'>;

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/600x400?text=Plant+Instance';

const resolvePrimaryImage = (images: string[] | undefined) => {
  if (!Array.isArray(images) || images.length === 0) {
    return PLACEHOLDER_IMAGE;
  }

  const firstImage = images.find((image) => typeof image === 'string' && image.trim().length > 0);
  return firstImage ?? PLACEHOLDER_IMAGE;
};

export default function PlantInstanceDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { plantInstanceId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const { isAuthenticated } = useAuthStore();

  const wishlistStatus = useWishlistStore((state) => state.statusByKey);
  const ensureWishlistStatus = useWishlistStore((state) => state.ensureStatus);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const [instanceDetail, setInstanceDetail] = useState<
    Awaited<ReturnType<typeof plantService.getPlantInstanceDetail>> | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wishlistItemId = instanceDetail?.id ?? plantInstanceId;
  const wishlistKey = getWishlistKey('PlantInstance', wishlistItemId);
  const isWishlisted = wishlistStatus[wishlistKey] ?? false;

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

    const loadInstanceDetail = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await plantService.getPlantInstanceDetail(plantInstanceId);
        if (isMounted) {
          setInstanceDetail(payload);
        }
      } catch (loadError: any) {
        if (isMounted) {
          const apiMessage = loadError?.response?.data?.message;
          setError(
            typeof apiMessage === 'string' && apiMessage.trim().length > 0
              ? apiMessage
              : t('plantInstanceDetail.loadFailed', {
                  defaultValue: 'Unable to load plant instance details.',
                })
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInstanceDetail();

    return () => {
      isMounted = false;
    };
  }, [plantInstanceId, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void ensureWishlistStatus([
      {
        itemType: 'PlantInstance',
        itemId: wishlistItemId,
      },
    ]);
  }, [ensureWishlistStatus, isAuthenticated, wishlistItemId]);

  const imageUrl = useMemo(
    () => resolvePrimaryImage(instanceDetail?.images),
    [instanceDetail?.images]
  );

  const isAvailable = (instanceDetail?.statusName || '').trim().toLowerCase() === 'available'
    || instanceDetail?.status === 1;

  const handleToggleWishlist = useCallback(async () => {
    if (!requireAuth()) {
      return;
    }

    const wasInWishlist = wishlistStatus[wishlistKey] ?? false;

    try {
      await toggleWishlist('PlantInstance', wishlistItemId);
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

  const handleBuyNow = useCallback(() => {
    if (!requireAuth()) {
      return;
    }

    if (!instanceDetail) {
      return;
    }

    if (!isAvailable) {
      notify({
        message: t('plantInstanceDetail.unavailableMessage', {
          defaultValue: 'This plant instance is currently unavailable.',
        }),
      });
      return;
    }

    const checkoutItem: CheckoutItem = {
      id: `buy_now_instance_${instanceDetail.id}`,
      name: instanceDetail.plantName,
      size:
        instanceDetail.height != null
          ? `${instanceDetail.height} cm`
          : t('common.updating', { defaultValue: 'Updating' }),
      image: imageUrl !== PLACEHOLDER_IMAGE ? imageUrl : undefined,
      price: instanceDetail.specificPrice,
      quantity: 1,
      plantInstanceId: instanceDetail.id,
      isUniqueInstance: true,
    };

    setIsSubmitting(true);
    navigation.navigate('Checkout', {
      source: 'buy-now',
      items: [checkoutItem],
    });
    setIsSubmitting(false);
  }, [imageUrl, instanceDetail, isAvailable, navigation, requireAuth, t]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!instanceDetail || error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <BrandedHeader
          containerStyle={styles.header}
          sideWidth={44}
          brandVariant="none"
          title={t('plantInstanceDetail.title', { defaultValue: 'Plant instance detail' })}
          left={
            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          }
          right={<View style={styles.headerBtn} />}
        />

        <View style={styles.loaderWrap}>
          <Ionicons name="alert-circle" size={54} color={COLORS.error} />
          <Text style={styles.errorText}>
            {error ||
              t('plantInstanceDetail.notFound', {
                defaultValue: 'Plant instance not found.',
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
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={44}
        brandVariant="none"
        title={t('plantInstanceDetail.title', { defaultValue: 'Plant instance detail' })}
        left={
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity style={styles.headerBtn} onPress={() => void handleToggleWishlist()}>
            <Ionicons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={22}
              color={isWishlisted ? COLORS.error : COLORS.textPrimary}
            />
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />

        <Text style={styles.name}>{instanceDetail.plantName}</Text>
        <Text style={styles.code}>{instanceDetail.sku}</Text>
        <Text style={styles.price}>{`${instanceDetail.specificPrice.toLocaleString(locale)}₫`}</Text>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>
            {t('plantInstanceDetail.nursery', { defaultValue: 'Nursery' })}
          </Text>
          <Text style={styles.metaValue}>{instanceDetail.nurseryName}</Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>
            {t('plantInstanceDetail.healthStatus', { defaultValue: 'Health status' })}
          </Text>
          <Text style={styles.metaValue}>
            {instanceDetail.healthStatus || t('common.updating', { defaultValue: 'Updating' })}
          </Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>
            {t('plantInstanceDetail.status', { defaultValue: 'Status' })}
          </Text>
          <Text style={styles.metaValue}>{instanceDetail.statusName}</Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>
            {t('plantInstanceDetail.height', { defaultValue: 'Height' })}
          </Text>
          <Text style={styles.metaValue}>
            {instanceDetail.height != null
              ? `${instanceDetail.height} cm`
              : t('common.updating', { defaultValue: 'Updating' })}
          </Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>
            {t('plantInstanceDetail.trunkDiameter', { defaultValue: 'Trunk diameter' })}
          </Text>
          <Text style={styles.metaValue}>
            {instanceDetail.trunkDiameter != null
              ? `${instanceDetail.trunkDiameter} mm`
              : t('common.updating', { defaultValue: 'Updating' })}
          </Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>
            {t('plantInstanceDetail.age', { defaultValue: 'Age' })}
          </Text>
          <Text style={styles.metaValue}>
            {instanceDetail.age != null
              ? t('plantInstanceDetail.ageMonth', {
                  defaultValue: '{{count}} months',
                  count: instanceDetail.age,
                })
              : t('common.updating', { defaultValue: 'Updating' })}
          </Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>
            {t('plantInstanceDetail.description', { defaultValue: 'Description' })}
          </Text>
          <Text style={styles.metaValue}>
            {instanceDetail.description || t('common.updating', { defaultValue: 'Updating' })}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.buyNowBtn, (!isAvailable || isSubmitting) && styles.buyNowBtnDisabled]}
          disabled={!isAvailable || isSubmitting}
          onPress={handleBuyNow}
        >
          <Text style={styles.buyNowText}>
            {t('plantDetail.buyNow', { defaultValue: 'Buy now' })}
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: SPACING['5xl'],
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
  bottomBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  buyNowBtn: {
    backgroundColor: '#13EC5B',
    borderRadius: 24,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  buyNowBtnDisabled: {
    opacity: 0.45,
  },
  buyNowText: {
    fontSize: FONTS.sizes.lg,
    color: '#102216',
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