import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { RootStackParamList, ServiceProgress } from '../../types';
import { formatVietnamDate, formatVietnamDateTime } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CustomerServiceProgressDetail'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'CustomerServiceProgressDetail'>;

const getProgressStatusPalette = (statusName: string | null) => {
  const normalized = (statusName || '').trim().toLowerCase();

  if (normalized.includes('pending') || normalized.includes('scheduled')) {
    return { backgroundColor: '#FFF3BF', borderColor: '#FFE066', textColor: '#A66700' };
  }

  if (normalized.includes('progress') || normalized.includes('ongoing') || normalized.includes('active')) {
    return { backgroundColor: '#E7F5FF', borderColor: '#74C0FC', textColor: '#1864AB' };
  }

  if (normalized.includes('completed')) {
    return { backgroundColor: '#D3F9D8', borderColor: '#69DB7C', textColor: '#2B8A3E' };
  }

  if (normalized.includes('cancel') || normalized.includes('fail')) {
    return { backgroundColor: '#FFE3E3', borderColor: '#FF8787', textColor: '#C92A2A' };
  }

  return { backgroundColor: COLORS.gray100, borderColor: COLORS.gray300, textColor: COLORS.textSecondary };
};

const formatDateLabel = (value: string, locale: string): string => {
  if (!value || value.trim().length === 0) {
    return '--';
  }

  return formatVietnamDate(value, locale, { empty: '--' });
};

const formatDateTimeLabel = (value: string | null | undefined, locale: string): string => {
  return formatVietnamDateTime(value, locale, { empty: '--', hour12: false });
};

export default function CustomerServiceProgressDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();

  const { progressId, serviceRegistrationId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [progress, setProgress] = useState<ServiceProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const payload = await careService.getServiceProgressDetail(progressId);
      setProgress(payload);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      setErrorMessage(
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('careService.progressDetailLoadFailed', {
              defaultValue: 'Unable to load service progress detail. Please try again.',
            })
      );
    } finally {
      setIsLoading(false);
    }
  }, [progressId, t]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const statusPalette = progress ? getProgressStatusPalette(progress.statusName || '--') : null;
  const hasIncidentData = progress
    ? Boolean(progress.hasIncidents) ||
      (typeof progress.incidentReason === 'string' && progress.incidentReason.trim().length > 0) ||
      (typeof progress.incidentImageUrl === 'string' && progress.incidentImageUrl.trim().length > 0)
    : false;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        brandVariant="none"
        containerStyle={styles.header}
        sideWidth={88}
        title={t('caretaker.detailTitle', {
          defaultValue: 'Service progress',
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
      ) : !progress ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>
            {t('careService.progressDetailNotFound', {
              defaultValue: 'Service progress not found.',
            })}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusPalette?.backgroundColor, borderColor: statusPalette?.borderColor }]}>
                <Text style={[styles.statusBadgeText, { color: statusPalette?.textColor }]}>
                  {progress.statusName || '--'}
                </Text>
              </View>
              <Text style={styles.dateText}>{formatDateLabel(progress.taskDate, locale)}</Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.infoSection}>
              <Text style={styles.sectionLabel}>
                {t('caretaker.serviceInformationTitle', { defaultValue: 'Service information' })}
              </Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t('caretaker.registrationIdLabel', { defaultValue: 'Registration ID' })}
                </Text>
                <Text style={styles.infoValue}>#{progress.serviceRegistrationId}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t('caretaker.taskDateLabel', { defaultValue: 'Task date' })}
                </Text>
                <Text style={styles.infoValue}>{formatDateLabel(progress.taskDate, locale)}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t('caretaker.shiftLabel', { defaultValue: 'Shift' })}
                </Text>
                <Text style={styles.infoValue}>
                  {progress.shift?.shiftName || '--'} ({progress.shift?.startTime?.slice(0, 5) || '--'} -{' '}
                  {progress.shift?.endTime?.slice(0, 5) || '--'})
                </Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.infoSection}>
              <Text style={styles.sectionLabel}>
                {t('caretaker.actualTimeTitle', { defaultValue: 'Actual time' })}
              </Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t('caretaker.startTimeLabel', { defaultValue: 'Start time' })}
                </Text>
                <Text style={styles.infoValue}>{formatDateTimeLabel(progress.actualStartTime, locale)}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  {t('caretaker.endTimeLabel', { defaultValue: 'End time' })}
                </Text>
                <Text style={styles.infoValue}>{formatDateTimeLabel(progress.actualEndTime, locale)}</Text>
              </View>
            </View>

            {progress.caretaker && (
              <>
                <View style={styles.separator} />

                <View style={styles.infoSection}>
                  <Text style={styles.sectionLabel}>
                    {t('careService.caretakerInformationTitle', {
                      defaultValue: 'Caretaker information',
                    })}
                  </Text>

                  {progress.caretaker.fullName && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>
                        {t('careService.caretakerNameLabel', {
                          defaultValue: 'Name',
                        })}
                      </Text>
                      <Text style={styles.infoValue}>{progress.caretaker.fullName}</Text>
                    </View>
                  )}

                  {typeof progress.caretaker.phone === 'string' &&
                    progress.caretaker.phone.trim().length > 0 && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                          {t('careService.caretakerPhoneLabel', {
                            defaultValue: 'Phone',
                          })}
                        </Text>
                        <Text style={styles.infoValue}>{progress.caretaker.phone}</Text>
                      </View>
                    )}

                  {typeof progress.caretaker.email === 'string' &&
                    progress.caretaker.email.trim().length > 0 && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                          {t('careService.caretakerEmailLabel', {
                            defaultValue: 'Email',
                          })}
                        </Text>
                        <Text style={[styles.infoValue, { flex: 1 }]}>
                          {progress.caretaker.email}
                        </Text>
                      </View>
                    )}
                </View>
              </>
            )}

            {typeof progress.description === 'string' && progress.description.trim().length > 0 ? (
              <>
                <View style={styles.separator} />

                <View style={styles.infoSection}>
                  <Text style={styles.sectionLabel}>
                    {t('caretaker.descriptionTitle', { defaultValue: 'Description' })}
                  </Text>
                  <Text style={styles.descriptionText}>{progress.description.trim()}</Text>
                </View>
              </>
            ) : null}

            {hasIncidentData ? (
              <>
                <View style={styles.separator} />

                <View style={[styles.infoSection, styles.incidentSection]}>
                  <Text style={styles.incidentTitle}>
                    {t('caretaker.incidentSectionTitle', { defaultValue: 'Incident report' })}
                  </Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.incidentLabel}>
                      {t('caretaker.hasIncidentLabel', { defaultValue: 'Has incidents' })}
                    </Text>
                    <Text style={styles.incidentValue}>
                      {progress.hasIncidents ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })}
                    </Text>
                  </View>

                  {typeof progress.incidentReason === 'string' && progress.incidentReason.trim().length > 0 ? (
                    <View style={styles.infoRow}>
                      <Text style={styles.incidentLabel}>
                        {t('caretaker.incidentReasonLabel', { defaultValue: 'Reason' })}
                      </Text>
                      <Text style={[styles.incidentValue, { flex: 1, textAlign: 'right' }]}>
                        {progress.incidentReason.trim()}
                      </Text>
                    </View>
                  ) : null}

                  {typeof progress.incidentImageUrl === 'string' && progress.incidentImageUrl.trim().length > 0 ? (
                    <View style={styles.imageSection}>
                      <Text style={styles.imageSectionLabel}>
                        {t('caretaker.incidentImageLabel', { defaultValue: 'Incident image' })}
                      </Text>
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImageUri(progress.incidentImageUrl?.trim() || null)}>
                        <Image
                          source={{ uri: progress.incidentImageUrl.trim() }}
                          style={styles.previewImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            {typeof progress.evidenceImageUrl === 'string' && progress.evidenceImageUrl.trim().length > 0 ? (
              <>
                <View style={styles.separator} />

                <View style={styles.infoSection}>
                  <Text style={styles.sectionLabel}>
                    {t('caretaker.checkOutImageLabel', { defaultValue: 'Evidence image' })}
                  </Text>
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImageUri(progress.evidenceImageUrl?.trim() || null)}>
                    <Image
                      source={{ uri: progress.evidenceImageUrl.trim() }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      )}

      {previewImageUri ? (
        <Modal visible={Boolean(previewImageUri)} transparent animationType="fade" onRequestClose={() => setPreviewImageUri(null)}>
          <View style={styles.fullImageModalOverlay}>
            <TouchableOpacity
              style={styles.fullImageCloseButton}
              onPress={() => setPreviewImageUri(null)}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>

            {previewImageUri ? <Image source={{ uri: previewImageUri }} style={styles.fullImagePreview} resizeMode="contain" /> : null}
          </View>
        </Modal>
      ) : null}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  dateText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  infoSection: {
    gap: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  infoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  incidentSection: {
    backgroundColor: '#FFF3BF',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#FFE066',
  },
  incidentTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: '#A66700',
    marginBottom: SPACING.sm,
  },
  incidentLabel: {
    fontSize: FONTS.sizes.sm,
    color: '#A66700',
    flexShrink: 0,
  },
  incidentValue: {
    fontSize: FONTS.sizes.sm,
    color: '#A66700',
    fontWeight: '600',
  },
  imageSection: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  imageSectionLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray200,
  },
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImagePreview: {
    width: '90%',
    height: '70%',
  },
});
