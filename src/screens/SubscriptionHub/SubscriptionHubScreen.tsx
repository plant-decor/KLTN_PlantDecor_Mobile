import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
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
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { useSubscriptionStore } from '../../stores';
import { RootStackParamList, TierPackage } from '../../types';
import {
  clampProgress,
  formatCurrency,
  formatDateTime,
  getThresholdShade,
} from './subscriptionShared';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SubscriptionHubScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [thresholdsModalVisible, setThresholdsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tierPackages = useSubscriptionStore((state) => state.tierPackages);
  const tierThresholds = useSubscriptionStore((state) => state.tierThresholds);
  const quotaStatus = useSubscriptionStore((state) => state.quotaStatus);
  const tierProgress = useSubscriptionStore((state) => state.tierProgress);
  const error = useSubscriptionStore((state) => state.error);
  const fetchTierPackages = useSubscriptionStore((state) => state.fetchTierPackages);
  const fetchTierThresholds = useSubscriptionStore((state) => state.fetchTierThresholds);
  const fetchQuotaStatus = useSubscriptionStore((state) => state.fetchQuotaStatus);
  const fetchTierProgress = useSubscriptionStore((state) => state.fetchTierProgress);
  const purchaseTierPackage = useSubscriptionStore((state) => state.purchaseTierPackage);

  const loadAll = useCallback(async () => {
    try {
      await Promise.allSettled([
        fetchQuotaStatus(),
        fetchTierPackages(),
        fetchTierThresholds(),
        fetchTierProgress(),
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchQuotaStatus, fetchTierPackages, fetchTierProgress, fetchTierThresholds]);

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
      total:
        quotaStatus.activeSubscriptions.reduce((sum, item) => sum + item.totalQuota, 0) ||
        quotaStatus.totalRemainingQuota,
    });
  }, [quotaStatus, t]);

  const totalActiveQuota = useMemo(
    () =>
      quotaStatus?.activeSubscriptions.reduce((sum, item) => sum + item.totalQuota, 0) ?? 0,
    [quotaStatus]
  );

  const nextTierTeaser = useMemo(() => {
    if (!tierProgress) {
      return null;
    }

    if (tierProgress.isMaxTier || tierProgress.amountToNextTier == null) {
      return t('subscription.maxTierMessage', {
        defaultValue: 'You are already at the highest tier.',
      });
    }

    return t('subscription.nextTierTeaser', {
      defaultValue: 'Spend {{amount}} more to unlock {{tier}}.',
      amount: formatCurrency(tierProgress.amountToNextTier),
      tier: tierProgress.nextTierName,
    });
  }, [t, tierProgress]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadAll();
  }, [loadAll]);

  const handleShowThresholds = useCallback(() => {
    setThresholdsModalVisible(true);
  }, []);

  const handleCloseThresholds = useCallback(() => {
    setThresholdsModalVisible(false);
  }, []);

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
        right={
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => navigation.navigate('SubscriptionHistory')}
          >
            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopyWrap}>
              <Text style={styles.heroEyebrow}>
                {t('subscription.overview', { defaultValue: 'Overview' })}
              </Text>
              <Text style={styles.heroTitle}>
                {quotaStatus?.tierName ||
                  t('subscription.title', { defaultValue: 'AI subscriptions' })}
              </Text>
              <Text style={styles.heroSubtitle}>
                {t('subscription.subtitle', {
                  defaultValue: 'See your quota, tiers, and upgrade options.',
                })}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.heroHistoryPill}
              onPress={() => navigation.navigate('SubscriptionHistory')}
            >
              <Text style={styles.heroHistoryPillText}>
                {t('subscription.history', { defaultValue: 'History' })}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primaryDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>
                {t('subscription.remaining', { defaultValue: 'Remaining quota' })}
              </Text>
              <Text style={styles.heroStatValue}>
                {quotaStatus?.totalRemainingQuota ?? 0}
              </Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>
                {t('subscription.activePlans', { defaultValue: 'Active plans' })}
              </Text>
              <Text style={styles.heroStatValue}>
                {quotaStatus?.activeSubscriptions.length ?? 0}
              </Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>
                {t('subscription.totalQuota', { defaultValue: 'Total quota' })}
              </Text>
              <Text style={styles.heroStatValue}>{totalActiveQuota}</Text>
            </View>
          </View>

          {nextTierTeaser ? <Text style={styles.heroFootnote}>{nextTierTeaser}</Text> : null}
        </View>

        {quotaStatus ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>
                  {quotaStatus.tierName} - {t('subscription.currentTier', { defaultValue: 'Current tier' })}
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
                  <Text style={styles.mutedText}>{formatDateTime(item.endDate)}</Text>
                </View>
                <View style={styles.quotaRowRight}>
                  <Text style={styles.quotaRowValue}>
                    {item.usedQuota}/{item.totalQuota}
                  </Text>
                  <Text style={styles.quotaRowHint}>
                    {t('subscription.used', { defaultValue: 'used' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {tierProgress ? (
          <View style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <View style={styles.progressHeaderMain}>
                <Text style={styles.progressEyebrow}>
                  {t('subscription.tierProgress', { defaultValue: 'Tier progress' })}
                </Text>
                <Text style={styles.progressTitle}>{tierProgress.currentTierName}</Text>
                <Text style={styles.mutedText}>{tierProgress.currentTierBenefitDescription}</Text>
              </View>
              <View style={styles.progressPercentBadge}>
                <Text style={styles.progressPercentText}>
                  {Math.round(tierProgress.progressPercent)}%
                </Text>
              </View>
            </View>

            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${clampProgress(tierProgress.progressPercent)}%` },
                ]}
              />
            </View>

            <View style={styles.progressStatsRow}>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatLabel}>
                  {t('subscription.totalSpent', { defaultValue: 'Total spent' })}
                </Text>
                <Text style={styles.progressStatValue}>
                  {formatCurrency(tierProgress.totalSpent)}
                </Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatLabel}>
                  {t('subscription.amountToNextTier', { defaultValue: 'To next tier' })}
                </Text>
                <Text style={styles.progressStatValue}>
                  {tierProgress.isMaxTier || tierProgress.amountToNextTier == null
                    ? t('subscription.maxTierReached', { defaultValue: 'Max tier reached' })
                    : formatCurrency(tierProgress.amountToNextTier)}
                </Text>
              </View>
            </View>

            <View style={styles.progressMetaBox}>
              {tierProgress.isMaxTier ? (
                <Text style={styles.mutedText}>
                  {t('subscription.maxTierMessage', {
                    defaultValue: 'You are already at the highest tier.',
                  })}
                </Text>
              ) : (
                <>
                  <Text style={styles.progressNextTierLabel}>
                    {t('subscription.nextTier', { defaultValue: 'Next tier' })}
                  </Text>
                  <Text style={styles.progressNextTierTitle}>
                    {tierProgress.nextTierName}
                    {tierProgress.nextTierLevel != null ? ` - T${tierProgress.nextTierLevel}` : ''}
                  </Text>
                  <Text style={styles.mutedText}>{tierProgress.nextTierBenefitDescription}</Text>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.thresholdLinkButton}
              onPress={handleShowThresholds}
            >
              <Text style={styles.thresholdLinkButtonText}>
                {t('subscription.viewThresholds', {
                  defaultValue: 'Show tier thresholds',
                })}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
            </TouchableOpacity>
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
              <View style={styles.packageTextWrap}>
                <Text style={styles.packageName}>{tierPackage.name}</Text>
                <Text style={styles.mutedText}>{tierPackage.description}</Text>
              </View>
              <View style={styles.priceChip}>
                <Text style={styles.priceText}>{formatCurrency(tierPackage.price)}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="sparkles-outline" size={14} color={COLORS.primary} />
                <Text style={styles.metaPillText}>
                  {t('subscription.quotaRequests', {
                    defaultValue: '{{count}} AI requests',
                    count: tierPackage.quotaRequests,
                  })}
                </Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                <Text style={styles.metaPillText}>
                  {t('subscription.durationMonths', {
                    defaultValue: '{{count}} month(s)',
                    count: tierPackage.durationMonths,
                  })}
                </Text>
              </View>
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <Modal
        visible={thresholdsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseThresholds}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalEyebrow}>
                  {t('subscription.tierThresholds', { defaultValue: 'Tier thresholds' })}
                </Text>
                <Text style={styles.modalTitle}>
                  {t('subscription.thresholdsTitle', {
                    defaultValue: 'What unlocks each tier',
                  })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseThresholds}
              >
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {t('subscription.thresholdsSubtitle', {
                defaultValue: 'Review the spending requirement and the benefit for each tier.',
              })}
            </Text>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.thresholdGrid}>
                {tierThresholds.map((threshold) => (
                  <View
                    key={threshold.id}
                    style={[
                      styles.thresholdCard,
                      { borderColor: getThresholdShade(threshold.tierLevel) },
                    ]}
                  >
                    <View style={styles.thresholdTopRow}>
                      <View
                        style={[
                          styles.thresholdDot,
                          { backgroundColor: getThresholdShade(threshold.tierLevel) },
                        ]}
                      />
                      <Text style={styles.thresholdName}>{threshold.name}</Text>
                    </View>
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
            </ScrollView>
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
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING['3xl'],
    gap: SPACING.lg,
  },
  headerBar: {
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
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
  historyButton: {
    minWidth: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: '#E8F3EC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  heroCard: {
    backgroundColor: '#163D2B',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.lg,
    ...SHADOWS.sm,
  },
  heroTopRow: {
    gap: SPACING.md,
  },
  heroCopyWrap: {
    gap: SPACING.xs,
  },
  heroEyebrow: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: '#9FD6AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: FONTS.sizes['3xl'],
    fontWeight: '800',
    color: COLORS.white,
  },
  heroSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: '#D6E8DB',
  },
  heroHistoryPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#E7F2EA',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  heroHistoryPillText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  heroStatLabel: {
    fontSize: FONTS.sizes.xs,
    color: '#D6E8DB',
    textTransform: 'uppercase',
  },
  heroStatValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '800',
    color: COLORS.white,
  },
  heroFootnote: {
    fontSize: FONTS.sizes.sm,
    color: '#D6E8DB',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  progressCard: {
    backgroundColor: '#F7FBF8',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  progressHeaderMain: {
    flex: 1,
  },
  progressEyebrow: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  progressTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  progressPercentBadge: {
    minWidth: 56,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  progressPercentText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 10,
    borderRadius: RADIUS.full,
    backgroundColor: '#DCE9DF',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  progressStatsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  progressStat: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  progressStatLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  progressStatValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  progressMetaBox: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  thresholdLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    backgroundColor: '#E8F3EC',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  thresholdLinkButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING['2xl'],
    maxHeight: '86%',
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  modalTitleWrap: {
    flex: 1,
    gap: SPACING.xs,
  },
  modalEyebrow: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: COLORS.primary,
  },
  modalTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray700,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    marginTop: SPACING.lg,
  },
  modalScrollContent: {
    paddingBottom: SPACING.md,
  },
  progressNextTierLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  progressNextTierTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '800',
    color: COLORS.textPrimary,
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
    color: COLORS.gray700,
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
  quotaRowRight: {
    alignItems: 'flex-end',
    gap: 2,
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
  quotaRowHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
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
  packageTextWrap: {
    flex: 1,
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
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#F3F8F4',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  metaPillText: {
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
  thresholdTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  thresholdDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
  },
});
