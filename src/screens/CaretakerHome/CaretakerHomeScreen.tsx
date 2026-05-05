import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { careService } from '../../services';
import { useAuthStore } from '../../stores';
import { RootStackParamList, ServiceProgress } from '../../types';
import {
  addDaysToIsoDateKey,
  canCheckInCaretakerProgress,
  canCheckOutCaretakerProgress,
  formatVietnamDate,
  formatVietnamDateTime,
  getCaretakerStatusPalette,
  getVietnamDateKey,
  isCaretakerAssignedStatus,
  isCaretakerCompletedStatus,
  isLateCheckInCaretakerProgress,
  notify,
  sanitizeCaretakerTaskDateKey,
  sortCaretakerProgressesByTaskDate,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CaretakerHome'>;

type SelectedEvidenceImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

const TEXT_DARK = '#0D1B12';
const SCHEDULE_WINDOW_DAYS = 7;

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

const buildScheduleRange = () => {
  const fromDateKey = getVietnamDateKey(new Date());

  return {
    from: fromDateKey,
    to: addDaysToIsoDateKey(fromDateKey, SCHEDULE_WINDOW_DAYS - 1),
  };
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

const mergeAndSortProgresses = (
  todayProgresses: ServiceProgress[],
  scheduleProgresses: ServiceProgress[]
): ServiceProgress[] => {
  const merged = new Map<number, ServiceProgress>();

  for (const item of todayProgresses) {
    merged.set(item.id, item);
  }

  for (const item of scheduleProgresses) {
    merged.set(item.id, item);
  }

  return sortCaretakerProgressesByTaskDate(Array.from(merged.values()));
};

export default function CaretakerHomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [todayProgresses, setTodayProgresses] = useState<ServiceProgress[]>([]);
  const [scheduleProgresses, setScheduleProgresses] = useState<ServiceProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [processingProgressId, setProcessingProgressId] = useState<number | null>(null);

  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutProgress, setCheckoutProgress] = useState<ServiceProgress | null>(null);
  const [checkoutDescription, setCheckoutDescription] = useState('');
  const [selectedEvidenceImage, setSelectedEvidenceImage] =
    useState<SelectedEvidenceImage | null>(null);
  const [incidentModalVisible, setIncidentModalVisible] = useState(false);
  const [incidentProgress, setIncidentProgress] = useState<ServiceProgress | null>(null);
  const [incidentReason, setIncidentReason] = useState('');
  const [selectedIncidentImage, setSelectedIncidentImage] = useState<SelectedEvidenceImage | null>(null);

  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const scheduleRange = useMemo(() => buildScheduleRange(), []);

  const allVisibleProgresses = useMemo(
    () => mergeAndSortProgresses(todayProgresses, scheduleProgresses),
    [scheduleProgresses, todayProgresses]
  );

  const inProgressTask = useMemo(
    () => allVisibleProgresses.find((item) => canCheckOutCaretakerProgress(item)) ?? null,
    [allVisibleProgresses]
  );

  const nextAssignedTask = useMemo(() => {
    const todayDate = getVietnamDateKey(new Date());

    return (
      allVisibleProgresses.find((item) => {
        if (inProgressTask && item.id === inProgressTask.id) {
          return false;
        }

        const taskDate = sanitizeCaretakerTaskDateKey(item.taskDate);
        return isCaretakerAssignedStatus(item.statusName) && taskDate >= todayDate;
      }) ?? null
    );
  }, [allVisibleProgresses, inProgressTask]);

  const displayName =
    typeof user?.fullName === 'string' && user.fullName.trim().length > 0
      ? user.fullName.trim()
      : t('caretaker.defaultName', { defaultValue: 'Caretaker' });

  const displayEmail =
    typeof user?.email === 'string' && user.email.trim().length > 0
      ? user.email.trim()
      : t('shipperHome.noEmail', { defaultValue: 'No email available' });

  const displayPhone =
    typeof user?.phoneNumber === 'string' && user.phoneNumber.trim().length > 0
      ? user.phoneNumber.trim()
      : typeof user?.phone === 'string' && user.phone.trim().length > 0
      ? user.phone.trim()
      : null;

  const nurseryName =
    typeof user?.nurseryName === 'string' && user.nurseryName.trim().length > 0
      ? user.nurseryName.trim()
      : t('shipperHome.nurseryFallback', { defaultValue: 'None' });

  const loadDashboard = useCallback(
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

        const [todayPayload, schedulePayload] = await Promise.all([
          careService.getServiceProgressToday(),
          careService.getServiceProgressMySchedule(scheduleRange),
        ]);

        setTodayProgresses(sortCaretakerProgressesByTaskDate(todayPayload ?? []));
        setScheduleProgresses(sortCaretakerProgressesByTaskDate(schedulePayload ?? []));
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
    [isAuthenticated, scheduleRange, t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return;
      }

      void loadDashboard();
    }, [isAuthenticated, loadDashboard])
  );

  const handleLogout = async () => {
    if (!isAuthenticated || isSigningOut) {
      return;
    }

    try {
      await logout();
    } catch (error) {
      throw error;
    }
  };

  const closeCheckoutModal = useCallback(() => {
    if (isSubmittingAction) {
      return;
    }

    setCheckoutModalVisible(false);
    setCheckoutProgress(null);
    setCheckoutDescription('');
    setSelectedEvidenceImage(null);
  }, [isSubmittingAction]);

  const openCheckoutModal = useCallback((progress: ServiceProgress) => {
    if (!canCheckOutCaretakerProgress(progress)) {
      return;
    }

    setCheckoutProgress(progress);
    setCheckoutDescription(progress.description ?? '');
    setSelectedEvidenceImage(null);
    setCheckoutModalVisible(true);
  }, []);

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
    async (progress: ServiceProgress) => {
      const todayDate = getVietnamDateKey(new Date());
      if (!canCheckInCaretakerProgress(progress, todayDate)) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('caretaker.checkInWindowHint', {
            defaultValue: 'Check-in is available from 30 minutes before your shift starts.',
          }),
        });
        return;
      }

      if (isLateCheckInCaretakerProgress(progress, todayDate)) {
        setIncidentProgress(progress);
        setIncidentReason('');
        setSelectedIncidentImage(null);
        setIncidentModalVisible(true);
        return;
      }

      setIsSubmittingAction(true);
      setProcessingProgressId(progress.id);

      try {
        await careService.checkInServiceProgress(progress.id);
        notify({
          title: t('common.success', { defaultValue: 'Success' }),
          message: t('caretaker.checkInSuccess', {
            defaultValue: 'Check-in successful.',
          }),
        });

        await loadDashboard({ background: true });
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
    [loadDashboard, t]
  );

  const closeIncidentModal = useCallback(() => {
    if (isSubmittingAction) {
      return;
    }

    setIncidentModalVisible(false);
    setIncidentProgress(null);
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
    if (!incidentProgress) {
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
    setProcessingProgressId(incidentProgress.id);

    try {
      await careService.reportServiceProgressIncident(incidentProgress.id, {
        IncidentReason: trimmedReason,
        incidentImage: selectedIncidentImage,
      });

      await careService.checkInServiceProgress(incidentProgress.id);

      notify({
        title: t('common.success', { defaultValue: 'Success' }),
        message: t('caretaker.checkInSuccess', {
          defaultValue: 'Check-in successful.',
        }),
      });

      closeIncidentModal();
      await loadDashboard({ background: true });
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
    incidentProgress,
    incidentReason,
    loadDashboard,
    selectedIncidentImage,
    t,
  ]);

  const submitCheckout = useCallback(async () => {
    if (!checkoutProgress) {
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
    setProcessingProgressId(checkoutProgress.id);

    try {
      const trimmedDescription = checkoutDescription.trim();
      await careService.checkOutServiceProgress(checkoutProgress.id, {
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
      await loadDashboard({ background: true });
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
  }, [
    checkoutDescription,
    checkoutProgress,
    closeCheckoutModal,
    loadDashboard,
    selectedEvidenceImage,
    t,
  ]);

  const renderTaskCard = useCallback(
    (progress: ServiceProgress, sectionType: 'in-progress' | 'assigned') => {
      const statusPalette = getCaretakerStatusPalette(progress.statusName);
      const isActionLoading = isSubmittingAction && processingProgressId === progress.id;
      const todayDate = getVietnamDateKey(new Date());
      const canPressCheckIn = canCheckInCaretakerProgress(progress, todayDate);
      const canPressCheckOut = canCheckOutCaretakerProgress(progress);

      return (
        <View style={styles.taskCard}>
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

          {typeof progress.evidenceImageUrl === 'string' && progress.evidenceImageUrl.trim().length > 0 ? (
            <View style={styles.evidenceWrap}>
              <Text style={styles.evidenceLabel}>
                {t('caretaker.checkOutImageLabel', { defaultValue: 'Evidence image' })}
              </Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setPreviewImageUri(progress.evidenceImageUrl?.trim() || null)}
              >
                <Image source={{ uri: progress.evidenceImageUrl.trim() }} style={styles.evidencePreviewImage} />
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.taskDetailButton}
            onPress={() =>
              navigation.navigate('CaretakerTaskDetail', {
                progressId: progress.id,
                serviceRegistrationId: progress.serviceRegistrationId,
              })
            }
          >
            <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
            <Text style={styles.taskDetailButtonText}>
              {t('caretaker.openTaskDetail', { defaultValue: 'Task detail' })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
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

          {sectionType === 'assigned' && !canPressCheckIn ? (
            <Text style={styles.assignedHint}>
              {t('caretaker.checkInWindowHint', {
                defaultValue: 'Check-in is available from 30 minutes before your shift starts.',
              })}
            </Text>
          ) : null}
        </View>
      );
    },
    [
      isSubmittingAction,
      locale,
      navigation,
      openCheckoutModal,
      processingProgressId,
      t,
    ]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={44}
        left={<View style={styles.headerPlaceholder} />}
        right={
          <TouchableOpacity
            style={[styles.headerActionButton, (isSigningOut || !isAuthenticated) && styles.disabledButton]}
            onPress={handleLogout}
            disabled={isSigningOut || !isAuthenticated}
          >
            {isSigningOut ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="log-out-outline" size={20} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        }
        brandVariant="logoWithText"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadDashboard({ refresh: true })}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            {t('caretaker.profileSectionTitle', { defaultValue: 'Caretaker profile' })}
          </Text>

          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <Ionicons name="person" size={26} color={COLORS.primary} />
            </View>

            <View style={styles.profileMeta}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.profileNursery} numberOfLines={1}>
                {t('shipperHome.nurseryLabel', {
                  defaultValue: 'Nursery: {{nursery}}',
                  nursery: nurseryName,
                })}
              </Text>
              <Text style={styles.profileContact} numberOfLines={1}>
                {displayEmail}
              </Text>
              {displayPhone ? (
                <Text style={styles.profileContact} numberOfLines={1}>
                  {displayPhone}
                </Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, (isSigningOut || !isAuthenticated) && styles.disabledButton]}
            activeOpacity={0.8}
            onPress={handleLogout}
            disabled={isSigningOut || !isAuthenticated}
          >
            {isSigningOut ? (
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            ) : (
              <>
                <Ionicons name="power-outline" size={16} color={COLORS.textPrimary} />
                <Text style={styles.secondaryButtonText}>
                  {t('caretaker.signOut', { defaultValue: 'Sign out' })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            {t('caretaker.inProgressSectionTitle', {
              defaultValue: 'In-progress task',
            })}
          </Text>

          {isLoading && !inProgressTask ? (
            <View style={styles.sectionLoaderWrap}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : inProgressTask ? (
            renderTaskCard(inProgressTask, 'in-progress')
          ) : (
            <View style={styles.emptyStateWrap}>
              <Ionicons name="leaf-outline" size={22} color={COLORS.gray500} />
              <Text style={styles.emptyStateText}>
                {t('caretaker.emptyInProgressTask', {
                  defaultValue: 'No in-progress task right now.',
                })}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            {t('caretaker.nextAssignedSectionTitle', {
              defaultValue: 'Next assigned task',
            })}
          </Text>

          {isLoading && !nextAssignedTask ? (
            <View style={styles.sectionLoaderWrap}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : nextAssignedTask ? (
            renderTaskCard(nextAssignedTask, 'assigned')
          ) : (
            <View style={styles.emptyStateWrap}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.gray500} />
              <Text style={styles.emptyStateText}>
                {t('caretaker.emptyNextAssignedTask', {
                  defaultValue: 'No upcoming assigned task in the current window.',
                })}
              </Text>
            </View>
          )}
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.stickyBottomBar,
          {
            paddingBottom: Math.max(insets.bottom, SPACING.sm),
          },
        ]}
      >
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.primaryCtaButton, styles.ctaButton]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CaretakerTasks')}
          >
            <Ionicons name="list-outline" size={18} color={COLORS.white} />
            <Text style={styles.primaryCtaButtonText}>
              {t('caretaker.openCareTaskBoard', { defaultValue: 'Care tasks' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryCtaButton, styles.ctaButton]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CaretakerDesignTasks')}
          >
            <Ionicons name="color-palette-outline" size={18} color={COLORS.primary} />
            <Text style={styles.secondaryCtaButtonText}>
              {t('caretaker.openDesignTaskBoard', { defaultValue: 'Design tasks' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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

            <View style={styles.uploadActionsRow}>
              <TouchableOpacity
                style={[styles.uploadButton, styles.uploadButtonHalf]}
                onPress={() => void handlePickIncidentImage()}
                disabled={isSubmittingAction}
              >
                <Ionicons name="images-outline" size={18} color={TEXT_DARK} />
                <Text style={styles.uploadButtonText}>
                  {t('caretaker.chooseImage', { defaultValue: 'Choose image' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, styles.uploadButtonHalf]}
                onPress={() => void handleCaptureIncidentImage()}
                disabled={isSubmittingAction}
              >
                <Ionicons name="camera-outline" size={18} color={TEXT_DARK} />
                <Text style={styles.uploadButtonText}>
                  {t('caretaker.takePhoto', { defaultValue: 'Take photo' })}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedIncidentImage ? (
              <View style={styles.selectedImageRow}>
                <Image
                  source={{ uri: selectedIncidentImage.uri }}
                  style={styles.selectedImagePreview}
                  resizeMode="cover"
                />
                <Text style={styles.selectedImageText} numberOfLines={2}>
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

            <View style={styles.uploadActionsRow}>
              <TouchableOpacity
                style={[styles.uploadButton, styles.uploadButtonHalf]}
                onPress={() => void handlePickEvidenceImage()}
                disabled={isSubmittingAction}
              >
                <Ionicons name="images-outline" size={18} color={TEXT_DARK} />
                <Text style={styles.uploadButtonText}>
                  {t('caretaker.chooseImage', { defaultValue: 'Choose image' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.uploadButton, styles.uploadButtonHalf]}
                onPress={() => void handleCaptureEvidenceImage()}
                disabled={isSubmittingAction}
              >
                <Ionicons name="camera-outline" size={18} color={TEXT_DARK} />
                <Text style={styles.uploadButtonText}>
                  {t('caretaker.takePhoto', { defaultValue: 'Take photo' })}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedEvidenceImage ? (
              <View style={styles.selectedImageRow}>
                <Image
                  source={{ uri: selectedEvidenceImage.uri }}
                  style={styles.selectedImagePreview}
                  resizeMode="cover"
                />
                <Text style={styles.selectedImageText} numberOfLines={2}>
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  headerPlaceholder: {
    width: 36,
    height: 36,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  sectionLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: '#E9FBEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMeta: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  profileNursery: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  profileContact: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
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
  sectionLoaderWrap: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateWrap: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyStateText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  taskCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
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
    height: 144,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    backgroundColor: '#DFE7E1',
  },
  taskDetailButton: {
    marginBottom: SPACING.xs,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  taskDetailButtonText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
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
  assignedHint: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.xs,
    color: '#854D0E',
    fontWeight: '600',
  },
  errorBanner: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(254, 226, 226, 0.85)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  errorBannerText: {
    fontSize: FONTS.sizes.sm,
    color: '#991B1B',
    fontWeight: '600',
  },
  stickyBottomBar: {
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  ctaButton: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  primaryCtaButton: {
    backgroundColor: COLORS.primary,
  },
  primaryCtaButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  secondaryCtaButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  secondaryCtaButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
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
  uploadActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D7E0D8',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#FAFCFA',
  },
  uploadButtonHalf: {
    flex: 1,
    justifyContent: 'center',
  },
  uploadButtonText: {
    marginLeft: 8,
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: FONTS.sizes.sm,
  },
  selectedImageRow: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#D7E0D8',
    backgroundColor: '#FAFCFA',
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  selectedImagePreview: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: '#DFE7E1',
  },
  selectedImageText: {
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
  disabledButton: {
    opacity: 0.6,
  },
});
