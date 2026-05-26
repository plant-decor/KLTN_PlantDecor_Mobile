import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { BrandedHeader } from '../../components/branding';
import { useSubscriptionStore } from '../../stores';
import { RootStackParamList, TierPackage, TierThreshold } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const formatCurrency = (value: number) => `${value.toLocaleString('vi-VN')} ₫`;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const getThresholdShade = (tierLevel: number) => {
  if (tierLevel >= 3) {
    return '#D4AF37';
  }

  if (tierLevel === 2) {
    return '#94A3B8';
  }

  return COLORS.primary;
};

export default function SubscriptionHubScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tierPackages = useSubscriptionStore((state) => state.tierPackages);
  const tierThresholds = useSubscriptionStore((state) => state.tierThresholds);
  const quotaStatus = useSubscriptionStore((state) => state.quotaStatus);
  const subscriptionHistory = useSubscriptionStore((state) => state.subscriptionHistory);
  const error = useSubscriptionStore((state) => state.error);
  const fetchTierPackages = useSubscriptionStore((state) => state.fetchTierPackages);
  const fetchTierThresholds = useSubscriptionStore((state) => state.fetchTierThresholds);
  const fetchQuotaStatus = useSubscriptionStore((state) => state.fetchQuotaStatus);
  const fetchSubscriptionHistory = useSubscriptionStore((state) => state.fetchSubscriptionHistory);
  const purchaseTierPackage = useSubscriptionStore((state) => state.purchaseTierPackage);

  const loadAll = useCallback(async () => {
    const tasks = [
      fetchTierPackages(),
      fetchTierThresholds(),
      fetchSubscriptionHistory(),
    ];

    try {
      await Promise.allSettled([fetchQuotaStatus(), ...tasks]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchQuotaStatus, fetchSubscriptionHistory, fetchTierPackages, fetchTierThresholds]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const quotaProgressText = useMemo(() => {
    if (!quotaStatus) {
      return null;
    }

    return t('subscription.quotaSummary', {
      defaultValue: '{{remaining}} remaining / {{total}} total',
      remaining: quotaStatus.totalRemainingQuota,
      total: quotaStatus.activeSubscriptions.reduce((sum, item) => sum + item.totalQuota, 0) || quotaStatus.totalRemainingQuota,
    });
  }, [quotaStatus, t]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadAll();
  }, [loadAll]);

  const handlePurchase = useCallback(
    async (tierPackage: TierPackage) => {
      try {
        const result = await purchaseTierPackage(tierPackage.id);
        if (!result?.paymentUrl) {
          throw new Error('Missing payment URL');
        }

        navigation.navigate('PaymentWebView', {
          paymentUrl: result.paymentUrl,
          paymentContext: 'subscription',
          subscriptionPackageName: tierPackage.name,
        });
      } catch (purchaseError) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('subscription.purchaseFailed', {
            defaultValue: 'Unable to start payment. Please try again.',
          })
        );
      }
    },
    [navigation, purchaseTierPackage, t]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.headerBar}
        sideWidth={44}
        brandVariant="none"
        title={t('subscription.title', { defaultValue: 'AI subscriptions' })}
        titleStyle={styles.headerTitle}
        left={
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
        right={<View style={styles.backButtonPlaceholder} />}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.subtitle}>
          {t('subscription.subtitle', {
            defaultValue: 'See your quota, tiers, and upgrade options.',
          })}
        </Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : null}

        {quotaStatus ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>
                  {quotaStatus.tierName} · {t('subscription.currentTier', { defaultValue: 'Current tier' })}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {t('subscription.freeQuota', {
                    defaultValue: '{{count}} free requests this month',
                    count: quotaStatus.tierMonthlyFreeQuota,
                  })}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{quotaStatus.totalRemainingQuota}</Text>
              </View>
            </View>

            {quotaProgressText ? <Text style={styles.mutedText}>{quotaProgressText}</Text> : null}

            {quotaStatus.activeSubscriptions.map((item) => (
              <View key={item.subscriptionId} style={styles.quotaRow}>
                <View style={styles.quotaRowMain}>
                  <Text style={styles.quotaRowTitle}>{item.packageName}</Text>
                  <Text style={styles.mutedText}>
                    {formatDateTime(item.endDate)}
                  </Text>
                </View>
                <Text style={styles.quotaRowValue}>
                  {item.usedQuota}/{item.totalQuota}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('subscription.tierPackages', { defaultValue: 'Tier packages' })}
          </Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.refreshText}>
              {t('common.refresh', { defaultValue: 'Refresh' })}
            </Text>
          </TouchableOpacity>
        </View>

        {tierPackages.map((tierPackage) => (
          <View key={tierPackage.id} style={styles.packageCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.packageName}>{tierPackage.name}</Text>
                <Text style={styles.mutedText}>{tierPackage.description}</Text>
              </View>
              <View style={styles.priceChip}>
                <Text style={styles.priceText}>{formatCurrency(tierPackage.price)}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {t('subscription.quotaRequests', {
                  defaultValue: '{{count}} AI requests',
                  count: tierPackage.quotaRequests,
                })}
              </Text>
              <Text style={styles.metaText}>
                {t('subscription.durationMonths', {
                  defaultValue: '{{count}} month(s)',
                  count: tierPackage.durationMonths,
                })}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.buyButton}
              onPress={() => void handlePurchase(tierPackage)}
            >
              <Text style={styles.buyButtonText}>
                {t('subscription.buyNow', { defaultValue: 'Buy now' })}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionTitle}>
          {t('subscription.tierThresholds', { defaultValue: 'Tier thresholds' })}
        </Text>
        <View style={styles.thresholdGrid}>
          {tierThresholds.map((threshold) => (
            <View key={threshold.id} style={[styles.thresholdCard, { borderColor: getThresholdShade(threshold.tierLevel) }]}>
              <View style={[styles.thresholdDot, { backgroundColor: getThresholdShade(threshold.tierLevel) }]} />
              <Text style={styles.thresholdName}>{threshold.name}</Text>
              <Text style={styles.mutedText}>{threshold.benefitDescription}</Text>
              <Text style={styles.thresholdValue}>
                {t('subscription.minSpent', {
                  defaultValue: 'Min {{value}} VND',
                  value: threshold.minTotalSpent.toLocaleString('vi-VN'),
                })}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>
          {t('subscription.history', { defaultValue: 'Subscription history' })}
        </Text>
        <View style={styles.historyList}>
          {subscriptionHistory.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.packageName}>{item.packageName}</Text>
                  <Text style={styles.mutedText}>
                    {formatDateTime(item.startDate)} - {formatDateTime(item.endDate)}
                  </Text>
                </View>
                <View style={[styles.statusChip, item.isActive ? styles.statusChipActive : styles.statusChipInactive]}>
                  <Text style={styles.statusChipText}>
                    {item.isActive
                      ? t('subscription.active', { defaultValue: 'Active' })
                      : t('subscription.expired', { defaultValue: 'Expired' })}
                  </Text>
                </View>
              </View>
              <Text style={styles.metaText}>
                {t('subscription.quotaUsage', {
                  defaultValue: '{{used}} used / {{remaining}} remaining / {{total}} total',
                  used: item.usedQuota,
                  remaining: item.remainingQuota,
                  total: item.totalQuota,
                })}
              </Text>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['3xl'],
    gap: SPACING.lg,
  },
  headerBar: {
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 32,
    height: 32,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
    gap: SPACING.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  cardTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  badge: {
    minWidth: 48,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  badgeText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  mutedText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  quotaRowMain: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  quotaRowTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  quotaRowValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  refreshText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  packageCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  packageName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  priceChip: {
    backgroundColor: '#EDF8F1',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  priceText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  buyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  buyButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: FONTS.sizes.md,
  },
  thresholdGrid: {
    gap: SPACING.md,
  },
  thresholdCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  thresholdDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: SPACING.xs,
  },
  thresholdName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  thresholdValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  historyList: {
    gap: SPACING.md,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  statusChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  statusChipActive: {
    backgroundColor: '#E7F7ED',
  },
  statusChipInactive: {
    backgroundColor: '#F1F3F5',
  },
  statusChipText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
  },
});