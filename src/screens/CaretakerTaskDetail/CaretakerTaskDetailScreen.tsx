import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { careService } from '../../services';
import { useAuthStore } from '../../stores';
import { RootStackParamList, ServiceProgress } from '../../types';
import {
  canCheckInCaretakerProgress,
  canCheckOutCaretakerProgress,
  formatVietnamDate,
  formatVietnamDateTime,
  getCaretakerStatusPalette,
  getVietnamDateKey,
  isCaretakerCompletedStatus,
  isLateCheckInCaretakerProgress,
  notify,
  sanitizeCaretakerTaskDateKey,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CaretakerTaskDetail'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'CaretakerTaskDetail'>;
type SelectedEvidenceImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

const TEXT_DARK = '#0D1B12';

const buildRegistrationCode = (id: number): string => `DV-${String(id).padStart(4, '0')}`;

const resolveImageMimeType = (fileName: string): string => {
  const normalizedName = fileName.toLowerCase();

  if (normalizedName.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedName.endsWith('.webp')) {
    return 'image/webp';
  }

  if (normalizedName.endsWith('.heic') || normalizedName.endsWith('.heif')) {
    return 'image/heic';
  }

  return 'image/jpeg';
};

const formatDateLabel = (dateText: string, locale: string): string => {
  const dateKey = sanitizeCaretakerTaskDateKey(dateText);
  if (!dateKey) {
    return '--';
  }

  return formatVietnamDate(dateKey, locale, { empty: dateKey });
};

const formatDateTimeLabel = (value: string | null | undefined, locale: string): string => {
  return formatVietnamDateTime(value, locale, {
    empty: '--',
    hour12: false,
  });
};

export default function CaretakerTaskDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { progressId, serviceRegistrationId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [progress, setProgress] = useState<ServiceProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [processingProgressId, setProcessingProgressId] = useState<number | null>(null);

  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutDescription, setCheckoutDescription] = useState('');
  const [selectedEvidenceImage, setSelectedEvidenceImage] =
    useState<SelectedEvidenceImage | null>(null);
  const [incidentModalVisible, setIncidentModalVisible] = useState(false);
  const [incidentReason, setIncidentReason] = useState('');
  const [selectedIncidentImage, setSelectedIncidentImage] = useState<SelectedEvidenceImage | null>(null);

  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (options?: { refresh?: boolean; background?: boolean }) => {
      if (!isAuthenticated) {
        return;
      }

      const isBackground = options?.background === true;

      if (!isBackground) {
        if (options?.refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
      }

      try {
        setErrorMessage(null);

        const payload = await careService.getServiceProgressDetail(progressId);
        setProgress(payload);

        if (!payload) {
          setErrorMessage(
            t('caretaker.detailNotFoundSubtitle', {
              defaultValue: 'This task may have been updated or is no longer assigned.',
            })
          );
        }
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        setErrorMessage(
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('caretaker.loadFailed', {
                defaultValue: 'Unable to load caretaker tasks. Please try again.',
              })
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAuthenticated, progressId, t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return;
      }

      void loadDetail();
    }, [isAuthenticated, loadDetail])
  );

  const closeCheckoutModal = useCallback(() => {
    if (isSubmittingAction) {
      return;
    }

    setCheckoutModalVisible(false);
    setCheckoutDescription('');
    setSelectedEvidenceImage(null);
  }, [isSubmittingAction]);

  const openCheckoutModal = useCallback(
    (targetProgress: ServiceProgress) => {
      if (!canCheckOutCaretakerProgress(targetProgress)) {
        return;
      }

      setCheckoutDescription(targetProgress.description ?? '');
      setSelectedEvidenceImage(null);
      setCheckoutModalVisible(true);
    },
    []
  );

  const handleEvidenceImageAsset = useCallback(
    (asset?: ImagePicker.ImagePickerAsset) => {
      const selectedUri = asset?.uri?.trim();

      if (!selectedUri) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('caretaker.imageMissing', {
            defaultValue: 'Please choose an image.',
          }),
        });
        return;
      }

      const fallbackFileName = selectedUri.split('/').pop() || `evidence-${Date.now()}.jpg`;
      const fileName = asset?.fileName?.trim() || fallbackFileName;
      const mimeType = asset?.mimeType?.trim() || resolveImageMimeType(fileName);

      setSelectedEvidenceImage({
        uri: selectedUri,
        fileName,
        mimeType,
      });
    },
    [t]
  );

  const handlePickEvidenceImage = useCallback(async () => {
    if (isSubmittingAction) {
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('caretaker.imagePermissionDenied', {
          defaultValue: 'Please grant photo library access to upload evidence.',
        }),
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    handleEvidenceImageAsset(result.assets?.[0]);
  }, [handleEvidenceImageAsset, isSubmittingAction, t]);

  const handleCaptureEvidenceImage = useCallback(async () => {
    if (isSubmittingAction) {
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('caretaker.cameraPermissionDenied', {
          defaultValue: 'Please grant camera access to take evidence image.',
        }),
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    handleEvidenceImageAsset(result.assets?.[0]);
  }, [handleEvidenceImageAsset, isSubmittingAction, t]);

  const handleCheckIn = useCallback(
    async (targetProgress: ServiceProgress) => {
      const todayDate = getVietnamDateKey(new Date());
      if (!canCheckInCaretakerProgress(targetProgress, todayDate)) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('caretaker.checkInWindowHint', {
            defaultValue: 'Check-in is available from 30 minutes before your shift starts.',
          }),
        });
        return;
      }

      if (isLateCheckInCaretakerProgress(targetProgress, todayDate)) {
        setIncidentReason('');
        setSelectedIncidentImage(null);
        setIncidentModalVisible(true);
        return;
      }

      setIsSubmittingAction(true);
      setProcessingProgressId(targetProgress.id);

      try {
        await careService.checkInServiceProgress(targetProgress.id);

        notify({
          title: t('common.success', { defaultValue: 'Success' }),
          message: t('caretaker.checkInSuccess', {
            defaultValue: 'Check-in successful.',
          }),
        });

        await loadDetail({ background: true });
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message:
            typeof apiMessage === 'string' && apiMessage.trim().length > 0
              ? apiMessage
              : t('caretaker.checkInFailed', {
                  defaultValue: 'Unable to check in. Please try again.',
                }),
        });
      } finally {
        setIsSubmittingAction(false);
        setProcessingProgressId(null);
      }
    },
    [loadDetail, t]
  );

  const closeIncidentModal = useCallback(() => {
    if (isSubmittingAction) {
      return;
    }

    setIncidentModalVisible(false);
    setIncidentReason('');
    setSelectedIncidentImage(null);
  }, [isSubmittingAction]);

  const handleIncidentImageAsset = useCallback(
    (asset?: ImagePicker.ImagePickerAsset) => {
      const selectedUri = asset?.uri?.trim();

      if (!selectedUri) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('caretaker.imageMissing', {
            defaultValue: 'Please choose an image.',
          }),
        });
        return;
      }

      const fallbackFileName = selectedUri.split('/').pop() || `incident-${Date.now()}.jpg`;
      const fileName = asset?.fileName?.trim() || fallbackFileName;
      const mimeType = asset?.mimeType?.trim() || resolveImageMimeType(fileName);

      setSelectedIncidentImage({
        uri: selectedUri,
        fileName,
        mimeType,
      });
    },
    [t]
  );

  const handlePickIncidentImage = useCallback(async () => {
    if (isSubmittingAction) {
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('caretaker.imagePermissionDenied', {
          defaultValue: 'Please grant photo library access to upload evidence.',
        }),
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    handleIncidentImageAsset(result.assets?.[0]);
  }, [handleIncidentImageAsset, isSubmittingAction, t]);

  const handleCaptureIncidentImage = useCallback(async () => {
    if (isSubmittingAction) {
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('caretaker.cameraPermissionDenied', {
          defaultValue: 'Please grant camera access to take evidence image.',
        }),
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    handleIncidentImageAsset(result.assets?.[0]);
  }, [handleIncidentImageAsset, isSubmittingAction, t]);

  const submitIncidentAndCheckIn = useCallback(async () => {
    if (!progress) {
      return;
    }

    const trimmedReason = incidentReason.trim();
    if (trimmedReason.length === 0) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('caretaker.incidentReportReasonRequired', {
          defaultValue: 'Please provide a reason for this incident.',
        }),
      });
      return;
    }

    if (!selectedIncidentImage) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('caretaker.incidentReportImageRequired', {
          defaultValue: 'Please attach an image for this incident.',
        }),
      });
      return;
    }

    setIsSubmittingAction(true);
    setProcessingProgressId(progress.id);

    try {
      await careService.reportServiceProgressIncident(progress.id, {
        IncidentReason: trimmedReason,
        incidentImage: selectedIncidentImage,
      });

      await careService.checkInServiceProgress(progress.id);

      notify({
        title: t('common.success', { defaultValue: 'Success' }),
        message: t('caretaker.checkInSuccess', {
          defaultValue: 'Check-in successful.',
        }),
      });

      closeIncidentModal();
      await loadDetail({ background: true });
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message:
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('caretaker.incidentReportFailed', {
                defaultValue: 'Unable to submit incident report. Please try again.',
              }),
      });
    } finally {
      setIsSubmittingAction(false);
      setProcessingProgressId(null);
    }
  }, [
    closeIncidentModal,
    incidentReason,
    loadDetail,
    progress,
    selectedIncidentImage,
    t,
  ]);

  const submitCheckout = useCallback(async () => {
    if (!progress) {
      return;
    }

    if (!selectedEvidenceImage) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('caretaker.checkOutImageRequired', {
          defaultValue: 'Please select an evidence image before check-out.',
        }),
      });
      return;
    }

    setIsSubmittingAction(true);
    setProcessingProgressId(progress.id);

    try {
      const trimmedDescription = checkoutDescription.trim();
      await careService.checkOutServiceProgress(progress.id, {
        Description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
        evidenceImage: selectedEvidenceImage,
      });

      notify({
        title: t('common.success', { defaultValue: 'Success' }),
        message: t('caretaker.checkOutSuccess', {
          defaultValue: 'Check-out successful.',
        }),
      });

      closeCheckoutModal();
      await loadDetail({ background: true });
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message:
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('caretaker.checkOutFailed', {
                defaultValue: 'Unable to check out. Please try again.',
              }),
      });
    } finally {
      setIsSubmittingAction(false);
      setProcessingProgressId(null);
    }
  }, [checkoutDescription, closeCheckoutModal, loadDetail, progress, selectedEvidenceImage, t]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerStateWrap}>
          <Ionicons name="person-circle-outline" size={76} color={COLORS.gray300} />
          <Text style={styles.centerTitle}>
            {t('common.loginRequiredTitle', { defaultValue: 'Login required' })}
          </Text>
          <Text style={styles.centerSubtitle}>
            {t('common.loginRequiredMessage', {
              defaultValue: 'Please login to continue.',
            })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const todayDate = getVietnamDateKey(new Date());
  const statusPalette = getCaretakerStatusPalette(progress?.statusName || '--');
  const canPressCheckIn = progress ? canCheckInCaretakerProgress(progress, todayDate) : false;
  const canPressCheckOut = progress ? canCheckOutCaretakerProgress(progress) : false;
  const isActionLoading = progress ? isSubmittingAction && processingProgressId === progress.id : false;
  const hasIncidentData =
    Boolean(progress?.hasIncidents) ||
    (typeof progress?.incidentReason === 'string' && progress.incidentReason.trim().length > 0) ||
    (typeof progress?.incidentImageUrl === 'string' && progress.incidentImageUrl.trim().length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={44}
        title={t('caretaker.detailTitle', { defaultValue: 'Task detail' })}
        left={
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
        }
        right={<View style={styles.headerPlaceholder} />}
        brandVariant="none"
      />

      {isLoading && !progress ? (
        <View style={styles.centerStateWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !progress ? (
        <View style={styles.centerStateWrap}>
          <Ionicons name="alert-circle-outline" size={70} color={COLORS.gray300} />
          <Text style={styles.centerTitle}>
            {t('caretaker.detailNotFoundTitle', {
              defaultValue: 'Task not found',
            })}
          </Text>
          <Text style={styles.centerSubtitle}>{errorMessage}</Text>

          <View style={styles.emptyActionsRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                navigation.navigate('CaretakerRegistrationDetail', {
                  registrationId: serviceRegistrationId,
                });
              }}
            >
              <Ionicons name="document-text-outline" size={16} color={COLORS.textPrimary} />
              <Text style={styles.secondaryButtonText}>
                {t('caretaker.openRegistrationDetail', {
                  defaultValue: 'Registration detail',
                })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                void loadDetail();
              }}
            >
              <Text style={styles.retryButtonText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void loadDetail({ refresh: true })}
                tintColor={COLORS.primary}
              />
            }
          >
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {t('caretaker.taskInformation', {
                  defaultValue: 'Task information',
                })}
              </Text>

              <View style={styles.cardTopRow}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: statusPalette.backgroundColor,
                      borderColor: statusPalette.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: statusPalette.textColor }]}>
                    {progress.statusName || '--'}
                  </Text>
                </View>

                <Text style={styles.taskDateText}>{formatDateLabel(progress.taskDate, locale)}</Text>
              </View>

              <Text style={styles.registrationCodeText}>
                {t('caretaker.registrationCode', {
                  defaultValue: 'Registration #{{code}}',
                  code: buildRegistrationCode(progress.serviceRegistrationId),
                })}
              </Text>

              <Text style={styles.packageNameText} numberOfLines={2}>
                {progress.serviceRegistration?.nurseryCareService?.careServicePackage?.name ||
                  t('caretaker.unnamedPackage', { defaultValue: 'Care service package' })}
              </Text>

              <View style={styles.infoRow}>
                <Ionicons name="business-outline" size={16} color={COLORS.gray600} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {progress.serviceRegistration?.nurseryCareService?.nurseryName || '--'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={COLORS.gray600} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {progress.shift?.shiftName || '--'} ({progress.shift?.startTime || '--'} -{' '}
                  {progress.shift?.endTime || '--'})
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.gray600} />
                <Text style={styles.infoText} numberOfLines={2}>
                  {progress.serviceRegistration?.address || '--'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={16} color={COLORS.gray600} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {progress.serviceRegistration?.phone || '--'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="layers-outline" size={16} color={COLORS.gray600} />
                <Text style={styles.infoText} numberOfLines={1}>
                  {t('caretaker.careServiceTypeLabel', { defaultValue: 'Service type' })}: {' '}
                  {progress.careServiceTypeName || '--'}
                </Text>
              </View>

              {progress.serviceRegistration?.customer ? (
                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={16} color={COLORS.gray600} />
                  <Text style={styles.infoText} numberOfLines={1}>
                    {t('caretaker.customerLabel', { defaultValue: 'Customer' })}: {' '}
                    {progress.serviceRegistration.customer.fullName || '--'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.timeSummaryWrap}>
                <Text style={styles.timeSummaryLabel}>
                  {t('caretaker.startTimeLabel', { defaultValue: 'Start time' })}:{' '}
                  <Text style={styles.timeSummaryValue}>
                    {formatDateTimeLabel(progress.actualStartTime, locale)}
                  </Text>
                </Text>
                <Text style={styles.timeSummaryLabel}>
                  {t('caretaker.endTimeLabel', { defaultValue: 'End time' })}:{' '}
                  <Text style={styles.timeSummaryValue}>
                    {formatDateTimeLabel(progress.actualEndTime, locale)}
                  </Text>
                </Text>
              </View>

              {typeof progress.description === 'string' && progress.description.trim().length > 0 ? (
                <View style={styles.descriptionWrap}>
                  <Ionicons name="document-text-outline" size={15} color={COLORS.gray600} />
                  <Text style={styles.descriptionText}>{progress.description.trim()}</Text>
                </View>
              ) : null}

              {hasIncidentData ? (
                <View style={styles.incidentWrap}>
                  <Text style={styles.incidentTitle}>
                    {t('caretaker.incidentSectionTitle', { defaultValue: 'Incident report' })}
                  </Text>

                  <Text style={styles.incidentText}>
                    {t('caretaker.hasIncidentLabel', { defaultValue: 'Has incidents' })}:{' '}
                    {progress.hasIncidents
                      ? t('common.yes', { defaultValue: 'Yes' })
                      : t('common.no', { defaultValue: 'No' })}
                  </Text>

                  {typeof progress.incidentReason === 'string' && progress.incidentReason.trim().length > 0 ? (
                    <Text style={styles.incidentText}>
                      {t('caretaker.incidentReasonLabel', { defaultValue: 'Reason' })}: {progress.incidentReason.trim()}
                    </Text>
                  ) : null}

                  {typeof progress.incidentImageUrl === 'string' && progress.incidentImageUrl.trim().length > 0 ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => setPreviewImageUri(progress.incidentImageUrl?.trim() || null)}
                    >
                      <Image
                        source={{ uri: progress.incidentImageUrl.trim() }}
                        style={styles.evidencePreviewImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {typeof progress.evidenceImageUrl === 'string' && progress.evidenceImageUrl.trim().length > 0 ? (
                <View style={styles.evidenceWrap}>
                  <Text style={styles.evidenceLabel}>
                    {t('caretaker.checkOutImageLabel', { defaultValue: 'Evidence image' })}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setPreviewImageUri(progress.evidenceImageUrl?.trim() || null)}
                  >
                    <Image
                      source={{ uri: progress.evidenceImageUrl.trim() }}
                      style={styles.evidencePreviewImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.detailButton}
                onPress={() =>
                  navigation.navigate('CaretakerRegistrationDetail', {
                    registrationId: progress.serviceRegistrationId,
                    highlightedProgressId: progress.id,
                  })
                }
              >
                <Ionicons name="eye-outline" size={16} color={COLORS.white} />
                <Text style={styles.detailButtonText}>
                  {t('caretaker.openRegistrationDetail', {
                    defaultValue: 'Registration detail',
                  })}
                </Text>
              </TouchableOpacity>

              <View style={styles.actionRow}>
                {canPressCheckIn ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.checkInButton, isActionLoading && styles.disabledButton]}
                    onPress={() => void handleCheckIn(progress)}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="play-outline" size={16} color={COLORS.white} />
                        <Text style={styles.actionButtonText}>
                          {t('caretaker.checkInAction', { defaultValue: 'Check in' })}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}

                {canPressCheckOut ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.checkOutButton, isActionLoading && styles.disabledButton]}
                    onPress={() => openCheckoutModal(progress)}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? (
                      <ActivityIndicator size="small" color={TEXT_DARK} />
                    ) : (
                      <>
                        <Ionicons name="exit-outline" size={16} color={TEXT_DARK} />
                        <Text style={[styles.actionButtonText, styles.checkOutButtonText]}>
                          {t('caretaker.checkOutAction', { defaultValue: 'Check out' })}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}

                {isCaretakerCompletedStatus(progress.statusName) ? (
                  <View style={styles.completedPill}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={'#1E7040'} />
                    <Text style={styles.completedPillText}>
                      {t('caretaker.completedLabel', { defaultValue: 'Completed' })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>

          <Modal
            visible={Boolean(previewImageUri)}
            transparent
            animationType="fade"
            onRequestClose={() => setPreviewImageUri(null)}
          >
            <View style={styles.fullImageModalOverlay}>
              <TouchableOpacity
                style={styles.fullImageCloseButton}
                onPress={() => setPreviewImageUri(null)}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={24} color={COLORS.white} />
              </TouchableOpacity>

              {previewImageUri ? (
                <Image source={{ uri: previewImageUri }} style={styles.fullImagePreview} resizeMode="contain" />
              ) : null}
            </View>
          </Modal>

          <Modal
            visible={incidentModalVisible}
            transparent
            animationType="fade"
            onRequestClose={closeIncidentModal}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {t('caretaker.incidentReportTitle', {
                    defaultValue: 'Late check-in incident report',
                  })}
                </Text>

                <Text style={styles.modalSubTitle}>
                  {t('caretaker.incidentReportDescriptionLabel', {
                    defaultValue: 'Incident detail',
                  })}
                </Text>

                <TextInput
                  style={styles.modalInput}
                  value={incidentReason}
                  onChangeText={setIncidentReason}
                  placeholder={t('caretaker.incidentReportReasonPlaceholder', {
                    defaultValue: 'Describe the reason for late check-in',
                  })}
                  placeholderTextColor={COLORS.gray500}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <Text style={styles.modalSubTitle}>
                  {t('caretaker.incidentReportImageLabel', { defaultValue: 'Incident image' })}
                </Text>

                <View style={styles.modalImageActionsRow}>
                  <TouchableOpacity
                    style={[styles.modalImageActionButton, isSubmittingAction && styles.disabledButton]}
                    onPress={() => {
                      void handlePickIncidentImage();
                    }}
                    disabled={isSubmittingAction}
                  >
                    <Ionicons name="images-outline" size={16} color={COLORS.textPrimary} />
                    <Text style={styles.modalImageActionText}>
                      {t('caretaker.chooseImage', {
                        defaultValue: 'Choose image',
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalImageActionButton, isSubmittingAction && styles.disabledButton]}
                    onPress={() => {
                      void handleCaptureIncidentImage();
                    }}
                    disabled={isSubmittingAction}
                  >
                    <Ionicons name="camera-outline" size={16} color={COLORS.textPrimary} />
                    <Text style={styles.modalImageActionText}>
                      {t('caretaker.takePhoto', {
                        defaultValue: 'Take photo',
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedIncidentImage ? (
                  <View style={styles.modalImagePreviewRow}>
                    <Image
                      source={{ uri: selectedIncidentImage.uri }}
                      style={styles.modalImagePreview}
                      resizeMode="cover"
                    />
                    <Text style={styles.modalImagePreviewText} numberOfLines={2}>
                      {t('caretaker.selectedImage', {
                        defaultValue: 'Selected: {{name}}',
                        name: selectedIncidentImage.fileName,
                      })}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalCancelButton]}
                    onPress={closeIncidentModal}
                    disabled={isSubmittingAction}
                  >
                    <Text style={styles.modalCancelButtonText}>
                      {t('common.cancel', { defaultValue: 'Cancel' })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalConfirmButton]}
                    onPress={() => void submitIncidentAndCheckIn()}
                    disabled={isSubmittingAction}
                  >
                    {isSubmittingAction ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.modalConfirmButtonText}>
                        {t('caretaker.submitIncidentAction', { defaultValue: 'Submit report' })}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={checkoutModalVisible}
            transparent
            animationType="fade"
            onRequestClose={closeCheckoutModal}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {t('caretaker.checkOutTitle', { defaultValue: 'Check out task' })}
                </Text>

                <Text style={styles.modalSubTitle}>
                  {t('caretaker.checkOutDescriptionLabel', {
                    defaultValue: 'Work summary (optional)',
                  })}
                </Text>

                <TextInput
                  style={styles.modalInput}
                  value={checkoutDescription}
                  onChangeText={setCheckoutDescription}
                  placeholder={t('caretaker.checkOutDescriptionPlaceholder', {
                    defaultValue: 'Add summary for this session',
                  })}
                  placeholderTextColor={COLORS.gray500}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <Text style={styles.modalSubTitle}>
                  {t('caretaker.checkOutImageLabel', { defaultValue: 'Evidence image' })}
                </Text>

                <View style={styles.modalImageActionsRow}>
                  <TouchableOpacity
                    style={[styles.modalImageActionButton, isSubmittingAction && styles.disabledButton]}
                    onPress={() => {
                      void handlePickEvidenceImage();
                    }}
                    disabled={isSubmittingAction}
                  >
                    <Ionicons name="images-outline" size={16} color={COLORS.textPrimary} />
                    <Text style={styles.modalImageActionText}>
                      {t('caretaker.chooseImage', {
                        defaultValue: 'Choose image',
                      })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalImageActionButton, isSubmittingAction && styles.disabledButton]}
                    onPress={() => {
                      void handleCaptureEvidenceImage();
                    }}
                    disabled={isSubmittingAction}
                  >
                    <Ionicons name="camera-outline" size={16} color={COLORS.textPrimary} />
                    <Text style={styles.modalImageActionText}>
                      {t('caretaker.takePhoto', {
                        defaultValue: 'Take photo',
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedEvidenceImage ? (
                  <View style={styles.modalImagePreviewRow}>
                    <Image
                      source={{ uri: selectedEvidenceImage.uri }}
                      style={styles.modalImagePreview}
                      resizeMode="cover"
                    />
                    <Text style={styles.modalImagePreviewText} numberOfLines={2}>
                      {t('caretaker.selectedImage', {
                        defaultValue: 'Selected: {{name}}',
                        name: selectedEvidenceImage.fileName,
                      })}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalCancelButton]}
                    onPress={closeCheckoutModal}
                    disabled={isSubmittingAction}
                  >
                    <Text style={styles.modalCancelButtonText}>
                      {t('common.cancel', { defaultValue: 'Cancel' })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalConfirmButton]}
                    onPress={() => void submitCheckout()}
                    disabled={isSubmittingAction}
                  >
                    {isSubmittingAction ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.modalConfirmButtonText}>
                        {t('caretaker.checkOutAction', { defaultValue: 'Check out' })}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
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
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E9EFEA',
  },
  headerPlaceholder: {
    width: 34,
    height: 34,
  },
  centerStateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING['2xl'],
  },
  centerTitle: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  centerSubtitle: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyActionsRow: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
  },
  secondaryButtonText: {
    marginLeft: 6,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  retryButton: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['2xl'],
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  registrationDataCard: {
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  sectionCaption: {
    marginTop: -2,
    marginBottom: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  taskDateText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  registrationCodeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  packageNameText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  infoText: {
    flex: 1,
    marginLeft: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  timeSummaryWrap: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  timeSummaryLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  timeSummaryValue: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  descriptionWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F8F6',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8E3',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  descriptionText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  incidentWrap: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#F2D59D',
    backgroundColor: '#FFF8E8',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  incidentTitle: {
    fontSize: FONTS.sizes.sm,
    color: '#8A5D00',
    fontWeight: '700',
    marginBottom: 4,
  },
  incidentText: {
    fontSize: FONTS.sizes.sm,
    color: '#6E4B08',
    marginBottom: 4,
  },
  evidenceWrap: {
    marginBottom: SPACING.sm,
  },
  evidenceLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  evidencePreviewImage: {
    width: '100%',
    height: 164,
    borderRadius: RADIUS.md,
    backgroundColor: '#DFE7E1',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    marginBottom: SPACING.sm,
  },
  detailButtonText: {
    marginLeft: 6,
    color: COLORS.white,
    fontWeight: '700',
    fontSize: FONTS.sizes.sm,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    marginRight: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  checkInButton: {
    backgroundColor: '#1B9B53',
  },
  checkOutButton: {
    backgroundColor: '#F8DE63',
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: '700',
  },
  checkOutButtonText: {
    color: TEXT_DARK,
  },
  detailList: {
    borderWidth: 1,
    borderColor: '#E3E9E4',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#FAFCFA',
  },
  detailRow: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E3E9E4',
  },
  detailRowLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray700,
    marginBottom: 4,
  },
  detailRowValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  detailRowEmpty: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  completedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8FAEF',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#BCEBCB',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    marginBottom: SPACING.xs,
  },
  completedPillText: {
    marginLeft: 6,
    color: '#1E7040',
    fontWeight: '700',
    fontSize: FONTS.sizes.xs,
  },
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  fullImageCloseButton: {
    position: 'absolute',
    top: SPACING['3xl'],
    right: SPACING.lg,
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  fullImagePreview: {
    width: '100%',
    height: '82%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  modalSubTitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  modalInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#D7E0D8',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    backgroundColor: '#FAFCFA',
  },
  modalImageActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalImageActionButton: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#D7E0D8',
    backgroundColor: '#FAFCFA',
    height: 40,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImageActionText: {
    marginLeft: 6,
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: FONTS.sizes.sm,
  },
  modalImagePreviewRow: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#D7E0D8',
    backgroundColor: '#FAFCFA',
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalImagePreview: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: '#DFE7E1',
  },
  modalImagePreviewText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
  },
  modalActionButton: {
    minWidth: 112,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
  },
  modalCancelButton: {
    backgroundColor: '#EDF2EE',
    marginRight: SPACING.sm,
  },
  modalCancelButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  modalConfirmButton: {
    backgroundColor: COLORS.primary,
  },
  modalConfirmButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
