import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { careService } from '../../services';
import { CareServicePackage, RootStackParamList } from '../../types';

type RouteProps = RouteProp<RootStackParamList, 'CareServicePackageDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CareServicePackageDetail'>;

export default function CareServicePackageDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation();

  const packageId = route.params.packageId;

  const [servicePackage, setServicePackage] = useState<CareServicePackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatCurrency = useCallback((amount: number) => {
    return `${(amount || 0).toLocaleString('vi-VN')}đ`;
  }, []);

  const loadDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const payload = await careService.getCareServicePackageDetail(packageId);
      setServicePackage(payload);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      setErrorMessage(
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('careService.packageDetailLoadFailed', {
              defaultValue: 'Unable to load package detail. Please try again.',
            })
      );
    } finally {
      setIsLoading(false);
    }
  }, [packageId, t]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        brandVariant="none"
        containerStyle={styles.header}
        sideWidth={44}
        centerStyle={styles.headerCenter}
        titleStyle={styles.headerTitle}
        title={t('careService.packageDetailHeader', {
          defaultValue: 'Package detail',
        })}
        left={
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : errorMessage ? (
        <View style={styles.stateWrap}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadDetail()}>
            <Text style={styles.retryButtonText}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : !servicePackage ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>
            {t('careService.packageDetailNotFound', {
              defaultValue: 'Service package not found.',
            })}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.packageName}>{servicePackage.name}</Text>
            <Text style={styles.packageDescription}>{servicePackage.description}</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.packageDetailPriceLabel', {
                  defaultValue: 'Price',
                })}
              </Text>
              <Text style={styles.infoValue}>{formatCurrency(servicePackage.unitPrice)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.packageDetailDurationLabel', {
                  defaultValue: 'Duration',
                })}
              </Text>
              <Text style={styles.infoValue}>
                {t('careService.packageDetailDurationValue', {
                  defaultValue: '{{days}} days',
                  days: servicePackage.durationDays,
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.packageDetailVisitPerWeekLabel', {
                  defaultValue: 'Visits/week',
                })}
              </Text>
              <Text style={styles.infoValue}>{servicePackage.visitPerWeek ?? '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.packageDetailTotalSessionsLabel', {
                  defaultValue: 'Total sessions',
                })}
              </Text>
              <Text style={styles.infoValue}>{servicePackage.totalSessions ?? '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.packageDetailAreaLimitLabel', {
                  defaultValue: 'Area limit',
                })}
              </Text>
              <Text style={styles.infoValue}>{servicePackage.areaLimit}</Text>
            </View>

            <View style={styles.separator} />

            <Text style={styles.sectionTitle}>
              {t('careService.packageDetailFeaturesTitle', {
                defaultValue: 'Features',
              })}
            </Text>
            <Text style={styles.paragraph}>{servicePackage.features || '-'}</Text>

            <View style={styles.separator} />

            <Text style={styles.sectionTitle}>
              {t('careService.packageDetailSpecializationsTitle', {
                defaultValue: 'Specializations',
              })}
            </Text>
            {servicePackage.specializations.length === 0 ? (
              <Text style={styles.paragraph}>
                {t('careService.packageDetailNoSpecializations', {
                  defaultValue: 'No specialization details available.',
                })}
              </Text>
            ) : (
              servicePackage.specializations.map((specialization) => (
                <View key={specialization.id} style={styles.specializationCard}>
                  <Text style={styles.specializationName}>{specialization.name}</Text>
                  <Text style={styles.specializationDescription}>{specialization.description}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
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
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    paddingHorizontal: 0,
  },
  headerTitle: {
    maxWidth: '100%',
    flexShrink: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  stateText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.error,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['4xl'],
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  packageName: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  packageDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  infoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  paragraph: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  specializationCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  specializationName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  specializationDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
