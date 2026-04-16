import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { RootStackParamList, ServiceRegistration, ServiceRegistrationShift } from '../../types';

type RouteProps = RouteProp<RootStackParamList, 'ServiceRegistrationDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ServiceRegistrationDetail'>;

const getRegistrationStatusColors = (statusName: string) => {
  const normalized = statusName.trim().toLowerCase();

  if (normalized.includes('pending')) {
    return {
      backgroundColor: '#FFF3BF',
      textColor: '#A66700',
    };
  }

  if (
    normalized.includes('approved') ||
    normalized.includes('active') ||
    normalized.includes('inprogress') ||
    normalized.includes('ongoing')
  ) {
    return {
      backgroundColor: '#D3F9D8',
      textColor: '#2B8A3E',
    };
  }

  if (normalized.includes('completed')) {
    return {
      backgroundColor: '#D0EBFF',
      textColor: '#1864AB',
    };
  }

  if (normalized.includes('cancel') || normalized.includes('reject')) {
    return {
      backgroundColor: '#FFE3E3',
      textColor: '#C92A2A',
    };
  }

  return {
    backgroundColor: COLORS.gray100,
    textColor: COLORS.textSecondary,
  };
};

export default function ServiceRegistrationDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t, i18n } = useTranslation();

  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const registrationId = route.params.registrationId;

  const [registration, setRegistration] = useState<ServiceRegistration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formatDate = useCallback(
    (value: string) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }

      return parsed.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    },
    [locale]
  );

  const formatDateTime = useCallback(
    (value: string | null) => {
      if (!value) {
        return '-';
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }

      return parsed.toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [locale]
  );

  const formatCurrency = useCallback((amount: number) => {
    return `${(amount || 0).toLocaleString('vi-VN')}đ`;
  }, []);

  const loadDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const payload = await careService.getServiceRegistrationDetail(registrationId);
      setRegistration(payload);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      setErrorMessage(
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('careService.registrationDetailLoadFailed', {
              defaultValue: 'Unable to load service registration detail. Please try again.',
            })
      );
    } finally {
      setIsLoading(false);
    }
  }, [registrationId, t]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const preferredShift = useMemo<ServiceRegistrationShift | null>(() => {
    if (!registration) {
      return null;
    }

    return registration.preferredShift ?? registration.prefferedShift ?? null;
  }, [registration]);

  const scheduleDaysLabel = useMemo(() => {
    if (!registration?.scheduleDaysOfWeek) {
      return '-';
    }

    try {
      const parsed = JSON.parse(registration.scheduleDaysOfWeek);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return '-';
      }

      const dayMap: Record<number, string> = {
        0: t('careService.daySun', { defaultValue: 'Sun' }),
        1: t('careService.dayMon', { defaultValue: 'Mon' }),
        2: t('careService.dayTue', { defaultValue: 'Tue' }),
        3: t('careService.dayWed', { defaultValue: 'Wed' }),
        4: t('careService.dayThu', { defaultValue: 'Thu' }),
        5: t('careService.dayFri', { defaultValue: 'Fri' }),
        6: t('careService.daySat', { defaultValue: 'Sat' }),
      };

      const labels = parsed
        .map((dayValue) => {
          if (typeof dayValue !== 'number') {
            return null;
          }

          return dayMap[dayValue] ?? null;
        })
        .filter((label): label is string => Boolean(label));

      return labels.length > 0 ? labels.join(', ') : '-';
    } catch {
      return registration.scheduleDaysOfWeek;
    }
  }, [registration?.scheduleDaysOfWeek, t]);

  const packageId = registration?.nurseryCareService?.careServicePackage?.id ?? null;
  const statusColors = getRegistrationStatusColors(registration?.statusName ?? '');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        brandVariant="none"
        containerStyle={styles.header}
        sideWidth={88}
        title={t('careService.registrationDetailHeader', {
          defaultValue: 'Registration detail',
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
      ) : !registration ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>
            {t('careService.registrationDetailNotFound', {
              defaultValue: 'Service registration not found.',
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
            <View style={styles.topRow}>
              <Text style={styles.codeText}>#{registration.id}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.backgroundColor }]}>
                <Text style={[styles.statusText, { color: statusColors.textColor }]}>
                  {registration.statusName}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationServiceDateLabel', {
                  defaultValue: 'Service date',
                })}
              </Text>
              <Text style={styles.infoValue}>{formatDate(registration.serviceDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationCreatedAtLabel', {
                  defaultValue: 'Created at',
                })}
              </Text>
              <Text style={styles.infoValue}>{formatDateTime(registration.createdAt)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationApprovedAtLabel', {
                  defaultValue: 'Approved at',
                })}
              </Text>
              <Text style={styles.infoValue}>{formatDateTime(registration.approvedAt)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationTotalSessionsLabel', {
                  defaultValue: 'Total sessions',
                })}
              </Text>
              <Text style={styles.infoValue}>
                {registration.totalSessions ?? '-'}
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationPackageLabel', {
                  defaultValue: 'Package',
                })}
              </Text>
              <Text style={styles.infoValueRight}>
                {registration.nurseryCareService?.careServicePackage?.name ?? '-'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationNurseryLabel', {
                  defaultValue: 'Nursery',
                })}
              </Text>
              <Text style={styles.infoValueRight}>
                {registration.nurseryCareService?.nurseryName ?? '-'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationUnitPriceLabel', {
                  defaultValue: 'Unit price',
                })}
              </Text>
              <Text style={styles.infoValueRight}>
                {formatCurrency(registration.nurseryCareService?.careServicePackage?.unitPrice ?? 0)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.packageDetailButton}
              onPress={() => {
                if (typeof packageId === 'number' && packageId > 0) {
                  navigation.navigate('CareServicePackageDetail', {
                    packageId,
                  });
                }
              }}
              disabled={typeof packageId !== 'number' || packageId <= 0}
            >
              <Text style={styles.packageDetailButtonText}>
                {t('careService.viewPackageDetailButton', {
                  defaultValue: 'View package detail',
                })}
              </Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationAddressLabel', {
                  defaultValue: 'Address',
                })}
              </Text>
              <Text style={styles.infoValueRight}>{registration.address || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationPhoneLabel', {
                  defaultValue: 'Phone',
                })}
              </Text>
              <Text style={styles.infoValue}>{registration.phone || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationScheduleLabel', {
                  defaultValue: 'Schedule days',
                })}
              </Text>
              <Text style={styles.infoValueRight}>{scheduleDaysLabel}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationShiftLabel', {
                  defaultValue: 'Preferred shift',
                })}
              </Text>
              <Text style={styles.infoValueRight}>
                {preferredShift
                  ? `${preferredShift.shiftName} (${preferredShift.startTime.slice(0, 5)} - ${preferredShift.endTime.slice(0, 5)})`
                  : '-'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {t('careService.registrationNoteLabel', {
                  defaultValue: 'Note',
                })}
              </Text>
              <Text style={styles.infoValueRight}>{registration.note || '-'}</Text>
            </View>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  codeText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
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
    flexShrink: 0,
  },
  infoValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  infoValueRight: {
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
  packageDetailButton: {
    marginTop: SPACING.sm,
    minHeight: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
  },
  packageDetailButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
});
