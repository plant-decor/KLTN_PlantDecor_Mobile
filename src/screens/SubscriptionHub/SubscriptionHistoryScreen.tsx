import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { useSubscriptionStore } from '../../stores';
import { RootStackParamList, SubscriptionRecord } from '../../types';
import {
  formatDateTime,
  getSubscriptionStatusCopy,
} from './subscriptionShared';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SubscriptionHistory'
>;

export default function SubscriptionHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const subscriptionHistory = useSubscriptionStore((state) => state.subscriptionHistory);
  const error = useSubscriptionStore((state) => state.error);
  const fetchSubscriptionHistory = useSubscriptionStore((state) => state.fetchSubscriptionHistory);

  const loadHistory = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (options?.refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        await fetchSubscriptionHistory();
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchSubscriptionHistory]
  );

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const sortedHistory = useMemo(
    () =>
      [...subscriptionHistory].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [subscriptionHistory]
  );

  const renderHistoryItem = ({ item }: { item: SubscriptionRecord }) => (
    <View style={styles.historyCard}>
      <View style={styles.historyTopRow}>
        <View style={styles.historyTitleWrap}>
          <Text style={styles.packageName}>{item.packageName}</Text>
          <Text style={styles.historyDate}>
            {formatDateTime(item.startDate)} - {formatDateTime(item.endDate)}
          </Text>
        </View>

        <View
          style={[
            styles.statusChip,
            item.isActive ? styles.statusChipActive : styles.statusChipInactive,
          ]}
        >
          <Text style={styles.statusChipText}>
            {getSubscriptionStatusCopy(
              item,
              t('subscription.active', { defaultValue: 'Active' }),
              t('subscription.expired', { defaultValue: 'Expired' })
            )}
          </Text>
        </View>
      </View>

      <View style={styles.historyMetricsRow}>
        <View style={styles.metricTile}>
          <Text style={styles.metricLabel}>
            {t('subscription.used', { defaultValue: 'Used' })}
          </Text>
          <Text style={styles.metricValue}>{item.usedQuota}</Text>
        </View>
        <View style={styles.metricTile}>
          <Text style={styles.metricLabel}>
            {t('subscription.remaining', { defaultValue: 'Remaining' })}
          </Text>
          <Text style={styles.metricValue}>{item.remainingQuota}</Text>
        </View>
        <View style={styles.metricTile}>
          <Text style={styles.metricLabel}>
            {t('subscription.total', { defaultValue: 'Total' })}
          </Text>
          <Text style={styles.metricValue}>{item.totalQuota}</Text>
        </View>
      </View>

      <View style={styles.historyMetaRow}>
        <Text style={styles.historyMetaText}>
          {item.isMonthlyFree
            ? t('subscription.monthlyFreePlan', {
                defaultValue: 'Monthly free allocation',
              })
            : t('subscription.paidPlan', {
                defaultValue: 'Paid subscription package',
              })}
        </Text>
        {item.paidAt ? (
          <Text style={styles.historyMetaText}>
            {t('subscription.paidAt', { defaultValue: 'Paid at' })}: {formatDateTime(item.paidAt)}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const isEmpty = !loading && sortedHistory.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.headerBar}
        sideWidth={44}
        brandVariant="none"
        title={t('subscription.history', { defaultValue: 'Subscription history' })}
        left={
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
        right={<View style={styles.iconButtonPlaceholder} />}
      />

      {loading && sortedHistory.length === 0 ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : isEmpty ? (
        <View style={styles.stateWrap}>
          <Ionicons name="time-outline" size={52} color={COLORS.gray400} />
          <Text style={styles.emptyTitle}>
            {t('subscription.historyEmptyTitle', {
              defaultValue: 'No subscription history yet',
            })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {error ||
              t('subscription.historyEmptySubtitle', {
                defaultValue: 'Your purchased packages will appear here after checkout.',
              })}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void loadHistory()}
          >
            <Text style={styles.retryButtonText}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedHistory}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadHistory({ refresh: true })}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.listIntro}>
              <Text style={styles.listIntroTitle}>
                {t('subscription.historySummaryTitle', {
                  defaultValue: 'Keep track of every plan you have used',
                })}
              </Text>
              <Text style={styles.listIntroSubtitle}>
                {t('subscription.historySummarySubtitle', {
                  defaultValue:
                    'Review active and expired packages, quota usage, and payment timing in one place.',
                })}
              </Text>
            </View>
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
  headerBar: {
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPlaceholder: {
    width: 32,
    height: 32,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING['2xl'],
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray700,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING['4xl'],
    gap: SPACING.md,
  },
  listIntro: {
    backgroundColor: '#EEF7F1',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#D6EADB',
    gap: SPACING.xs,
  },
  listIntroTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  listIntroSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray700,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  historyTitleWrap: {
    flex: 1,
    gap: SPACING.xs,
  },
  packageName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  historyDate: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray700,
  },
  statusChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  statusChipActive: {
    backgroundColor: '#E7F7ED',
  },
  statusChipInactive: {
    backgroundColor: COLORS.gray100,
  },
  statusChipText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  historyMetricsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metricTile: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  metricLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.gray700,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  historyMetaRow: {
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  historyMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray700,
  },
});
