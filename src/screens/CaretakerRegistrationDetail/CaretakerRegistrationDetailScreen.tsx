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
import { RootStackParamList, ServiceProgress, ServiceRegistration } from '../../types';
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
  sortCaretakerProgressesByTaskDate,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CaretakerRegistrationDetail'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'CaretakerRegistrationDetail'>;
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

const formatDateLabel = (value: string, locale: string): string => {
  if (!value || value.trim().length === 0) {
    return '--';
  }

  return formatVietnamDate(value, locale, { empty: '--' });
};

const formatDateTimeLabel = (value: string | null | undefined, locale: string): string => {
  return formatVietnamDateTime(value, locale, {
    empty: '--',
    hour12: false,
  });
};

const formatCurrency = (amount: number): string => `${amount.toLocaleString('vi-VN')}đ`;

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

export default function CaretakerRegistrationDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { registrationId, highlightedProgressId } = route.params;
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [registration, setRegistration] = useState<ServiceRegistration | null>(null);
  const [progresses, setProgresses] = useState<ServiceProgress[]>([]);
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

  const preferredShift = useMemo(() => {
    if (!registration) {
      return null;
    }

    return registration.preferredShift ?? registration.prefferedShift ?? null;
  }, [registration]);

  const scheduleDaysLabel = useMemo(() => {
    if (!registration?.scheduleDaysOfWeek) {
      return '--';
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

    try {
      const parsed = JSON.parse(registration.scheduleDaysOfWeek);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return '--';
      }

      const labels = parsed
        .map((dayValue) => {
          if (typeof dayValue !== 'number') {
            return null;
          }

          return dayMap[dayValue] ?? null;
        })
        .filter((label): label is string => Boolean(label));

      return labels.length > 0 ? labels.join(', ') : '--';
    } catch {
      return registration.scheduleDaysOfWeek;
    }
  }, [registration?.scheduleDaysOfWeek, t]);

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

        const [registrationPayload, progressesPayload] = await Promise.all([
          careService.getServiceRegistrationDetail(registrationId),
          careService.getServiceProgressesByRegistration(registrationId),
        ]);

        setRegistration(registrationPayload);
        setProgresses(sortCaretakerProgressesByTaskDate(progressesPayload ?? []));
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
    [isAuthenticated, registrationId, t]
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
    setCheckoutProgress(null);
    setCheckoutDescription('');
    setSelectedEvidenceImage(null);
  }, [isSubmittingAction]);

  const openCheckoutModal = useCallback((targetProgress: ServiceProgress) => {
    if (!canCheckOutCaretakerProgress(targetProgress)) {
      return;
    }

    setCheckoutProgress(targetProgress);
    setCheckoutDescription(targetProgress.description ?? '');
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
        setIncidentProgress(targetProgress);
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
    incidentProgress,
    incidentReason,
    loadDetail,
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
  }, [checkoutDescription, checkoutProgress, closeCheckoutModal, loadDetail, selectedEvidenceImage, t]);

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

  const statusColors = getRegistrationStatusColors(registration?.statusName ?? '');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={44}
        title={t('caretaker.registrationDetailTitle', { defaultValue: 'Registration detail' })}
        left={
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
        }
        right={<View style={styles.headerPlaceholder} />}
        brandVariant="none"
      />

      {isLoading && !registration ? (
        <View style={styles.centerStateWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : !registration ? (
        <View style={styles.centerStateWrap}>
          <Ionicons name="alert-circle-outline" size={70} color={COLORS.gray300} />
          <Text style={styles.centerTitle}>
            {t('caretaker.detailNotFoundTitle', {
              defaultValue: 'Task not found',
            })}
          </Text>
          <Text style={styles.centerSubtitle}>{errorMessage}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              void loadDetail();
            }}
          >
            <Text style={styles.retryButtonText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
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
              <View style={styles.cardTopRow}>
                <Text style={styles.registrationCodeText}>#{buildRegistrationCode(registration.id)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColors.backgroundColor, borderColor: statusColors.backgroundColor }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColors.textColor }]}>{registration.statusName || '--'}</Text>
                </View>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationServiceDateLabel', { defaultValue: 'Service date' })}</Text>
                <Text style={styles.infoValue}>{formatDateLabel(registration.serviceDate, locale)}</Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationCreatedAtLabel', { defaultValue: 'Created at' })}</Text>
                <Text style={styles.infoValue}>{formatDateTimeLabel(registration.createdAt, locale)}</Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationApprovedAtLabel', { defaultValue: 'Approved at' })}</Text>
                <Text style={styles.infoValue}>{formatDateTimeLabel(registration.approvedAt, locale)}</Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationTotalSessionsLabel', { defaultValue: 'Total sessions' })}</Text>
                <Text style={styles.infoValue}>{registration.totalSessions ?? '--'}</Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('caretaker.orderIdLabel', { defaultValue: 'Order ID' })}</Text>
                <Text style={styles.infoValue}>{registration.orderId ?? '--'}</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationPackageLabel', { defaultValue: 'Package' })}</Text>
                <Text style={styles.infoValue}>{registration.nurseryCareService?.careServicePackage?.name || '--'}</Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationNurseryLabel', { defaultValue: 'Nursery' })}</Text>
                <Text style={styles.infoValue}>{registration.nurseryCareService?.nurseryName || '--'}</Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationUnitPriceLabel', { defaultValue: 'Unit price' })}</Text>
                <Text style={styles.infoValue}>{formatCurrency(registration.nurseryCareService?.careServicePackage?.unitPrice ?? 0)}</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationAddressLabel', { defaultValue: 'Address' })}</Text>
                <Text style={styles.infoValue}>{registration.address || '--'}</Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationPhoneLabel', { defaultValue: 'Phone' })}</Text>
                <Text style={styles.infoValue}>{registration.phone || '--'}</Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationScheduleLabel', { defaultValue: 'Schedule days' })}</Text>
                <Text style={styles.infoValue}>{scheduleDaysLabel}</Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationShiftLabel', { defaultValue: 'Preferred shift' })}</Text>
                <Text style={styles.infoValue}>
                  {preferredShift
                    ? `${preferredShift.shiftName} (${preferredShift.startTime.slice(0, 5)} - ${preferredShift.endTime.slice(0, 5)})`
                    : '--'}
                </Text>
              </View>

              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('careService.registrationNoteLabel', { defaultValue: 'Note' })}</Text>
                <Text style={styles.infoValue}>{registration.note || '--'}</Text>
              </View>

              <View style={styles.separator} />

              <Text style={styles.sectionSubTitle}>{t('caretaker.customerSectionTitle', { defaultValue: 'Customer' })}</Text>
              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('caretaker.fullNameLabel', { defaultValue: 'Full name' })}</Text>
                <Text style={styles.infoValue}>{registration.customer?.fullName || '--'}</Text>
              </View>
              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('caretaker.emailLabel', { defaultValue: 'Email' })}</Text>
                <Text style={styles.infoValue}>{registration.customer?.email || '--'}</Text>
              </View>
              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('caretaker.phoneLabel', { defaultValue: 'Phone' })}</Text>
                <Text style={styles.infoValue}>{registration.customer?.phone || '--'}</Text>
              </View>

              <Text style={styles.sectionSubTitle}>{t('caretaker.caretakerSectionTitle', { defaultValue: 'Caretaker' })}</Text>
              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('caretaker.mainCaretakerLabel', { defaultValue: 'Main caretaker' })}</Text>
                <Text style={styles.infoValue}>{registration.mainCaretaker?.fullName || '--'}</Text>
              </View>
              <View style={styles.infoRowTextOnly}>
                <Text style={styles.infoLabel}>{t('caretaker.currentCaretakerLabel', { defaultValue: 'Current caretaker' })}</Text>
                <Text style={styles.infoValue}>{registration.currentCaretaker?.fullName || '--'}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {t('caretaker.progressListTitle', { defaultValue: 'Registration progresses' })}
              </Text>

              {progresses.length === 0 ? (
                <Text style={styles.emptyProgressText}>
                  {t('caretaker.progressListEmpty', {
                    defaultValue: 'No progresses found for this registration.',
                  })}
                </Text>
              ) : (
                progresses.map((item) => {
                  const itemStatusPalette = getCaretakerStatusPalette(item.statusName || '--');
                  const isHighlighted = highlightedProgressId === item.id;
                  const canPressCheckIn = canCheckInCaretakerProgress(item, getVietnamDateKey(new Date()));
                  const canPressCheckOut = canCheckOutCaretakerProgress(item);
                  const isActionLoading = isSubmittingAction && processingProgressId === item.id;
                  const hasIncidentData =
                    Boolean(item.hasIncidents) ||
                    (typeof item.incidentReason === 'string' && item.incidentReason.trim().length > 0) ||
                    (typeof item.incidentImageUrl === 'string' && item.incidentImageUrl.trim().length > 0);

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.progressCard,
                        isHighlighted ? styles.progressCardHighlighted : null,
                      ]}
                    >
                      <View style={styles.cardTopRow}>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: itemStatusPalette.backgroundColor,
                              borderColor: itemStatusPalette.borderColor,
                            },
                          ]}
                        >
                          <Text style={[styles.statusBadgeText, { color: itemStatusPalette.textColor }]}> 
                            {item.statusName || '--'}
                          </Text>
                        </View>

                        <Text style={styles.taskDateText}>{formatDateLabel(item.taskDate, locale)}</Text>
                      </View>

                      <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={16} color={COLORS.gray600} />
                        <Text style={styles.infoText} numberOfLines={1}>
                          {item.shift?.shiftName || '--'} ({item.shift?.startTime || '--'} - {item.shift?.endTime || '--'})
                        </Text>
                      </View>

                      <View style={styles.timeSummaryWrap}>
                        <Text style={styles.timeSummaryLabel}>
                          {t('caretaker.startTimeLabel', { defaultValue: 'Start time' })}:{' '}
                          <Text style={styles.timeSummaryValue}>{formatDateTimeLabel(item.actualStartTime, locale)}</Text>
                        </Text>
                        <Text style={styles.timeSummaryLabel}>
                          {t('caretaker.endTimeLabel', { defaultValue: 'End time' })}:{' '}
                          <Text style={styles.timeSummaryValue}>{formatDateTimeLabel(item.actualEndTime, locale)}</Text>
                        </Text>
                      </View>

                      {typeof item.description === 'string' && item.description.trim().length > 0 ? (
                        <View style={styles.descriptionWrap}>
                          <Ionicons name="document-text-outline" size={15} color={COLORS.gray600} />
                          <Text style={styles.descriptionText}>{item.description.trim()}</Text>
                        </View>
                      ) : null}

                      {hasIncidentData ? (
                        <View style={styles.incidentWrap}>
                          <Text style={styles.incidentTitle}>
                            {t('caretaker.incidentSectionTitle', { defaultValue: 'Incident report' })}
                          </Text>

                          <Text style={styles.incidentText}>
                            {t('caretaker.hasIncidentLabel', { defaultValue: 'Has incidents' })}:{' '}
                            {item.hasIncidents
                              ? t('common.yes', { defaultValue: 'Yes' })
                              : t('common.no', { defaultValue: 'No' })}
                          </Text>

                          {typeof item.incidentReason === 'string' && item.incidentReason.trim().length > 0 ? (
                            <Text style={styles.incidentText}>
                              {t('caretaker.incidentReasonLabel', { defaultValue: 'Reason' })}: {item.incidentReason.trim()}
                            </Text>
                          ) : null}

                          {typeof item.incidentImageUrl === 'string' && item.incidentImageUrl.trim().length > 0 ? (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => setPreviewImageUri(item.incidentImageUrl?.trim() || null)}
                            >
                              <Image
                                source={{ uri: item.incidentImageUrl.trim() }}
                                style={styles.evidencePreviewImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ) : null}

                      {typeof item.evidenceImageUrl === 'string' && item.evidenceImageUrl.trim().length > 0 ? (
                        <View style={styles.evidenceWrap}>
                          <Text style={styles.evidenceLabel}>
                            {t('caretaker.checkOutImageLabel', { defaultValue: 'Evidence image' })}
                          </Text>
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => setPreviewImageUri(item.evidenceImageUrl?.trim() || null)}
                          >
                            <Image
                              source={{ uri: item.evidenceImageUrl.trim() }}
                              style={styles.evidencePreviewImage}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      <TouchableOpacity
                        style={styles.taskDetailButton}
                        onPress={() =>
                          navigation.navigate('CaretakerTaskDetail', {
                            progressId: item.id,
                            serviceRegistrationId: item.serviceRegistrationId,
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
                            onPress={() => void handleCheckIn(item)}
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
                            onPress={() => openCheckoutModal(item)}
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

                        {isCaretakerCompletedStatus(item.statusName) ? (
                          <View style={styles.completedPill}>
                            <Ionicons name="checkmark-circle-outline" size={16} color={'#1E7040'} />
                            <Text style={styles.completedPillText}>
                              {t('caretaker.completedLabel', { defaultValue: 'Completed' })}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
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
  retryButton: {
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['2xl'],
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  progressCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: '#FBFDFC',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  progressCardHighlighted: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FBF4',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  sectionSubTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.sm,
    marginBottom: 6,
    textTransform: 'uppercase',
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
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 6,
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
  infoRowTextOnly: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  infoValue: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
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
  emptyProgressText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
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
