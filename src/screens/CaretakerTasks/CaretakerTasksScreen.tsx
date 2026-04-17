import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants';
import { careService } from '../../services';
import { useAuthStore } from '../../stores';
import { RootStackParamList, ServiceProgress, ServiceRegistration } from '../../types';
import { notify } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CaretakerTasks'>;
type CaretakerSegment = 'today' | 'schedule' | 'assigned';
type PageToken = number | 'left-ellipsis' | 'right-ellipsis';

type SelectedEvidenceImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

const PAGE_SIZE = 10;
const SCREEN_BG = '#F6F8F6';
const TEXT_DARK = '#0D1B12';
const ACTION_GREEN = '#13EC5B';
const SCHEDULE_WINDOW_DAYS = 7;

const normalizeToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const isAssignedStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('assigned') || token.includes('pending');
};

const isInProgressStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('inprogress') || token.includes('processing');
};

const isCompletedStatus = (statusName: string): boolean => {
  const token = normalizeToken(statusName);
  return token.includes('completed') || token.includes('done') || token.includes('finished');
};

const toLocalDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toApiDate = (value: Date): string => toLocalDateKey(value);

const sanitizeDateKey = (value?: string | null): string => {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 10);
};

const buildRegistrationCode = (id: number): string => `DV-${String(id).padStart(4, '0')}`;

const getStatusPalette = (statusName: string) => {
  if (isCompletedStatus(statusName)) {
    return {
      backgroundColor: '#E8FAEF',
      borderColor: '#BCEBCB',
      textColor: '#1E7040',
    };
  }

  if (isInProgressStatus(statusName)) {
    return {
      backgroundColor: '#FFF8E5',
      borderColor: '#FFE6A5',
      textColor: '#9A6A00',
    };
  }

  if (isAssignedStatus(statusName)) {
    return {
      backgroundColor: '#E8F4FF',
      borderColor: '#B8DAFF',
      textColor: '#1D5FA7',
    };
  }

  return {
    backgroundColor: '#EEF1F4',
    borderColor: '#D8E0E8',
    textColor: '#4D6173',
  };
};

const sortProgresses = (items: ServiceProgress[]): ServiceProgress[] => {
  return [...items].sort((left, right) => {
    const leftDate = sanitizeDateKey(left.taskDate);
    const rightDate = sanitizeDateKey(right.taskDate);

    if (leftDate === rightDate) {
      return left.id - right.id;
    }

    return leftDate.localeCompare(rightDate);
  });
};

const formatDateLabel = (dateText: string, locale: string): string => {
  const dateKey = sanitizeDateKey(dateText);
  if (!dateKey) {
    return '--';
  }

  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }

  return parsed.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatDateTimeLabel = (value: string | null | undefined, locale: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '--';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(locale, {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildScheduleRange = () => {
  const fromDate = new Date();
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + (SCHEDULE_WINDOW_DAYS - 1));

  return {
    from: toApiDate(fromDate),
    to: toApiDate(toDate),
  };
};

export default function CaretakerTasksScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated } = useAuthStore();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [activeSegment, setActiveSegment] = useState<CaretakerSegment>('today');
  const [todayProgresses, setTodayProgresses] = useState<ServiceProgress[]>([]);
  const [scheduleProgresses, setScheduleProgresses] = useState<ServiceProgress[]>([]);
  const [assignedRegistrations, setAssignedRegistrations] = useState<ServiceRegistration[]>([]);

  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [processingProgressId, setProcessingProgressId] = useState<number | null>(null);

  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutProgress, setCheckoutProgress] = useState<ServiceProgress | null>(null);
  const [checkoutDescription, setCheckoutDescription] = useState('');
  const [selectedEvidenceImage, setSelectedEvidenceImage] = useState<SelectedEvidenceImage | null>(null);

  const scheduleRange = useMemo(() => buildScheduleRange(), []);

  const visiblePageTokens = useMemo<PageToken[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const tokens: PageToken[] = [1];
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    if (startPage > 2) {
      tokens.push('left-ellipsis');
    }

    for (let page = startPage; page <= endPage; page += 1) {
      tokens.push(page);
    }

    if (endPage < totalPages - 1) {
      tokens.push('right-ellipsis');
    }

    tokens.push(totalPages);
    return tokens;
  }, [currentPage, totalPages]);

  const getSegmentLabel = useCallback(
    (segment: CaretakerSegment) => {
      if (segment === 'today') {
        return t('caretaker.segmentToday', { defaultValue: 'Today' });
      }

      if (segment === 'schedule') {
        return t('caretaker.segmentSchedule', { defaultValue: '7-day schedule' });
      }

      return t('caretaker.segmentAssigned', { defaultValue: 'Assigned registrations' });
    },
    [t]
  );

  const loadSegmentData = useCallback(
    async (
      segment: CaretakerSegment,
      options?: {
        refresh?: boolean;
        pageNumber?: number;
        pageChange?: boolean;
        background?: boolean;
      }
    ) => {
      const targetPage = Math.max(1, options?.pageNumber ?? 1);
      const isBackground = options?.background === true;

      if (!isBackground) {
        if (options?.refresh) {
          setIsRefreshing(true);
        } else if (options?.pageChange) {
          setIsPageLoading(true);
        } else {
          setIsLoading(true);
        }
      }

      try {
        setErrorMessage(null);

        if (segment === 'today') {
          const payload = await careService.getServiceProgressToday();
          setTodayProgresses(sortProgresses(payload ?? []));
          return;
        }

        if (segment === 'schedule') {
          const payload = await careService.getServiceProgressMySchedule(scheduleRange);
          setScheduleProgresses(sortProgresses(payload ?? []));
          return;
        }

        const payload = await careService.getCaretakerAssignedServiceRegistrations({
          PageNumber: targetPage,
          PageSize: PAGE_SIZE,
        });

        const sortedItems = [...(payload.items ?? [])].sort((left, right) => right.id - left.id);
        const resolvedPage = Math.max(1, payload.pageNumber ?? targetPage);
        const resolvedTotalPages = Math.max(1, payload.totalPages ?? 1);

        setAssignedRegistrations(sortedItems);
        setTotalCount(payload.totalCount ?? sortedItems.length);
        setCurrentPage(resolvedPage);
        setTotalPages(resolvedTotalPages);
        setHasPreviousPage(payload.hasPrevious ?? resolvedPage > 1);
        setHasNextPage(payload.hasNext ?? resolvedPage < resolvedTotalPages);
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
        setIsPageLoading(false);
      }
    },
    [scheduleRange, t]
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        return;
      }

      void loadSegmentData(activeSegment, {
        pageNumber: activeSegment === 'assigned' ? currentPage : 1,
      });
    }, [activeSegment, currentPage, isAuthenticated, loadSegmentData])
  );

  const refreshAfterTaskAction = useCallback(async () => {
    await Promise.all([
      loadSegmentData('today', { background: true }),
      loadSegmentData('schedule', { background: true }),
      loadSegmentData('assigned', {
        background: true,
        pageNumber: currentPage,
      }),
    ]);
  }, [currentPage, loadSegmentData]);

  const canCheckIn = useCallback((progress: ServiceProgress): boolean => {
    const todayDate = toLocalDateKey(new Date());
    const taskDate = sanitizeDateKey(progress.taskDate);

    return isAssignedStatus(progress.statusName) && taskDate === todayDate && !progress.actualStartTime;
  }, []);

  const canCheckOut = useCallback((progress: ServiceProgress): boolean => {
    return (
      isInProgressStatus(progress.statusName) &&
      Boolean(progress.actualStartTime) &&
      !progress.actualEndTime
    );
  }, []);

  const handleCheckIn = useCallback(
    async (progress: ServiceProgress) => {
      if (!canCheckIn(progress)) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('caretaker.todayOnlyHint', {
            defaultValue: 'Check-in is available only for today assigned tasks.',
          }),
        });
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

        await refreshAfterTaskAction();
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
    [canCheckIn, refreshAfterTaskAction, t]
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

  const openCheckoutModal = useCallback(
    (progress: ServiceProgress) => {
      if (!canCheckOut(progress)) {
        return;
      }

      setCheckoutProgress(progress);
      setCheckoutDescription(progress.description ?? '');
      setSelectedEvidenceImage(null);
      setCheckoutModalVisible(true);
    },
    [canCheckOut]
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

    const selectedAsset = result.assets?.[0];
    const selectedUri = selectedAsset?.uri?.trim();

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
    const fileName = selectedAsset?.fileName?.trim() || fallbackFileName;
    const mimeType =
      selectedAsset?.mimeType?.trim() ||
      (fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

    setSelectedEvidenceImage({
      uri: selectedUri,
      fileName,
      mimeType,
    });
  }, [isSubmittingAction, t]);

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

      setCheckoutModalVisible(false);
      setCheckoutProgress(null);
      setCheckoutDescription('');
      setSelectedEvidenceImage(null);

      await refreshAfterTaskAction();
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
    refreshAfterTaskAction,
    selectedEvidenceImage,
    t,
  ]);

  const handlePrevPage = useCallback(() => {
    if (isLoading || isRefreshing || isPageLoading || !hasPreviousPage || currentPage <= 1) {
      return;
    }

    void loadSegmentData('assigned', {
      pageNumber: currentPage - 1,
      pageChange: true,
    });
  }, [currentPage, hasPreviousPage, isLoading, isPageLoading, isRefreshing, loadSegmentData]);

  const handleNextPage = useCallback(() => {
    if (isLoading || isRefreshing || isPageLoading || !hasNextPage || currentPage >= totalPages) {
      return;
    }

    void loadSegmentData('assigned', {
      pageNumber: currentPage + 1,
      pageChange: true,
    });
  }, [
    currentPage,
    hasNextPage,
    isLoading,
    isPageLoading,
    isRefreshing,
    loadSegmentData,
    totalPages,
  ]);

  const handlePageSelect = useCallback(
    (page: number) => {
      if (
        page < 1 ||
        page > totalPages ||
        page === currentPage ||
        isLoading ||
        isRefreshing ||
        isPageLoading
      ) {
        return;
      }

      void loadSegmentData('assigned', {
        pageNumber: page,
        pageChange: true,
      });
    },
    [currentPage, isLoading, isPageLoading, isRefreshing, loadSegmentData, totalPages]
  );

  const renderProgressCard = ({ item }: { item: ServiceProgress }) => {
    const statusPalette = getStatusPalette(item.statusName);
    const isActionLoading = isSubmittingAction && processingProgressId === item.id;
    const canPressCheckIn = canCheckIn(item);
    const canPressCheckOut = canCheckOut(item);

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
              {item.statusName || '--'}
            </Text>
          </View>

          <Text style={styles.taskDateText}>
            {formatDateLabel(item.taskDate, locale)}
          </Text>
        </View>

        <Text style={styles.registrationCodeText}>
          {t('caretaker.registrationCode', {
            defaultValue: 'Registration #{{code}}',
            code: buildRegistrationCode(item.serviceRegistrationId),
          })}
        </Text>

        <Text style={styles.packageNameText} numberOfLines={2}>
          {item.serviceRegistration?.nurseryCareService?.careServicePackage?.name ||
            t('caretaker.unnamedPackage', { defaultValue: 'Care service package' })}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.serviceRegistration?.nurseryCareService?.nurseryName || '--'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.shift?.shiftName || '--'} ({item.shift?.startTime || '--'} - {item.shift?.endTime || '--'})
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={2}>
            {item.serviceRegistration?.address || '--'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.serviceRegistration?.phone || '--'}
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

        {typeof item.evidenceImageUrl === 'string' && item.evidenceImageUrl.trim().length > 0 ? (
          <Image source={{ uri: item.evidenceImageUrl.trim() }} style={styles.evidencePreviewImage} />
        ) : null}

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

          {isCompletedStatus(item.statusName) ? (
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
  };

  const renderAssignedCard = ({ item }: { item: ServiceRegistration }) => {
    const statusPalette = getStatusPalette(item.statusName);

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
              {item.statusName || '--'}
            </Text>
          </View>

          <Text style={styles.taskDateText}>{formatDateLabel(item.serviceDate, locale)}</Text>
        </View>

        <Text style={styles.registrationCodeText}>
          {t('caretaker.registrationCode', {
            defaultValue: 'Registration #{{code}}',
            code: buildRegistrationCode(item.id),
          })}
        </Text>

        <Text style={styles.packageNameText} numberOfLines={2}>
          {item.nurseryCareService?.careServicePackage?.name ||
            t('caretaker.unnamedPackage', { defaultValue: 'Care service package' })}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.nurseryCareService?.nurseryName || '--'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={2}>
            {item.address || '--'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.phone || '--'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.detailButton}
          onPress={() => navigation.navigate('ServiceRegistrationDetail', { registrationId: item.id })}
        >
          <Ionicons name="eye-outline" size={16} color={COLORS.white} />
          <Text style={styles.detailButtonText}>
            {t('caretaker.openRegistrationDetail', {
              defaultValue: 'Registration detail',
            })}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const progressItems = activeSegment === 'today' ? todayProgresses : scheduleProgresses;
  const activeCount = activeSegment === 'assigned' ? assignedRegistrations.length : progressItems.length;

  const getEmptyTitle = () => {
    if (activeSegment === 'today') {
      return t('caretaker.emptyTodayTitle', { defaultValue: 'No tasks for today' });
    }

    if (activeSegment === 'schedule') {
      return t('caretaker.emptyScheduleTitle', { defaultValue: 'No tasks in this range' });
    }

    return t('caretaker.emptyAssignedTitle', { defaultValue: 'No assigned registrations' });
  };

  const getEmptySubtitle = () => {
    if (errorMessage) {
      return errorMessage;
    }

    if (activeSegment === 'today') {
      return t('caretaker.emptyTodaySubtitle', {
        defaultValue: 'Tasks scheduled for today will appear here.',
      });
    }

    if (activeSegment === 'schedule') {
      return t('caretaker.emptyScheduleSubtitle', {
        defaultValue: 'Try refreshing or waiting for new assignments.',
      });
    }

    return t('caretaker.emptyAssignedSubtitle', {
      defaultValue: 'Assigned service registrations will appear here.',
    });
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-circle-outline" size={76} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>
            {t('common.loginRequiredTitle', { defaultValue: 'Login required' })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('common.loginRequiredMessage', {
              defaultValue: 'Please login to continue.',
            })}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.replace('Login')}>
            <Text style={styles.retryButtonText}>{t('common.login', { defaultValue: 'Login' })}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        containerStyle={styles.header}
        sideWidth={52}
        title={t('caretaker.screenTitle', { defaultValue: 'Caretaker tasks' })}
        left={
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
        }
        right={
          <View style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={20} color={TEXT_DARK} />
            <View style={styles.notificationDot} />
          </View>
        }
        brandVariant="none"
      />

      <View style={styles.segmentWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentContent}
        >
          {(['today', 'schedule', 'assigned'] as CaretakerSegment[]).map((segment) => {
            const isActive = activeSegment === segment;
            return (
              <TouchableOpacity
                key={segment}
                style={[styles.segmentChip, isActive && styles.segmentChipActive]}
                onPress={() => setActiveSegment(segment)}
              >
                <Text style={[styles.segmentChipText, isActive && styles.segmentChipTextActive]}>
                  {getSegmentLabel(segment)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading && activeCount === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : activeCount === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={70} color={COLORS.gray300} />
          <Text style={styles.emptyTitle}>{getEmptyTitle()}</Text>
          <Text style={styles.emptySubtitle}>{getEmptySubtitle()}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              void loadSegmentData(activeSegment, {
                pageNumber: activeSegment === 'assigned' ? currentPage : 1,
              })
            }
          >
            <Text style={styles.retryButtonText}>{t('common.retry', { defaultValue: 'Retry' })}</Text>
          </TouchableOpacity>
        </View>
      ) : activeSegment === 'assigned' ? (
        <>
          <FlatList
            data={assignedRegistrations}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderAssignedCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() =>
                  void loadSegmentData('assigned', {
                    refresh: true,
                    pageNumber: currentPage,
                  })
                }
                tintColor={COLORS.primary}
              />
            }
          />

          <View style={styles.paginationWrap}>
            <Text style={styles.paginationSummary}>
              {t('caretaker.paginationMeta', {
                defaultValue: 'Page {{current}}/{{total}} • {{count}} registrations',
                current: currentPage,
                total: totalPages,
                count: totalCount,
              })}
            </Text>

            <View style={styles.paginationControls}>
              <TouchableOpacity
                style={[
                  styles.pageNavButton,
                  (!hasPreviousPage || isLoading || isRefreshing || isPageLoading) &&
                    styles.pageButtonDisabled,
                ]}
                onPress={handlePrevPage}
                disabled={!hasPreviousPage || isLoading || isRefreshing || isPageLoading}
              >
                <Ionicons name="chevron-back" size={16} color={TEXT_DARK} />
              </TouchableOpacity>

              <View style={styles.pageTokensWrap}>
                {visiblePageTokens.map((token, index) => {
                  if (token === 'left-ellipsis' || token === 'right-ellipsis') {
                    return (
                      <View key={`${token}-${index}`} style={styles.pageEllipsisWrap}>
                        <Text style={styles.pageEllipsis}>...</Text>
                      </View>
                    );
                  }

                  const isActivePage = token === currentPage;
                  return (
                    <TouchableOpacity
                      key={token}
                      style={[styles.pageTokenButton, isActivePage && styles.pageTokenButtonActive]}
                      onPress={() => handlePageSelect(token)}
                    >
                      <Text
                        style={[styles.pageTokenText, isActivePage && styles.pageTokenTextActive]}
                      >
                        {token}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.pageNavButton,
                  (!hasNextPage || isLoading || isRefreshing || isPageLoading) &&
                    styles.pageButtonDisabled,
                ]}
                onPress={handleNextPage}
                disabled={!hasNextPage || isLoading || isRefreshing || isPageLoading}
              >
                <Ionicons name="chevron-forward" size={16} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>

            {isPageLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
          </View>
        </>
      ) : (
        <FlatList
          data={progressItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProgressCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() =>
                void loadSegmentData(activeSegment, {
                  refresh: true,
                })
              }
              tintColor={COLORS.primary}
            />
          }
        />
      )}

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

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => void handlePickEvidenceImage()}
              disabled={isSubmittingAction}
            >
              <Ionicons name="images-outline" size={18} color={TEXT_DARK} />
              <Text style={styles.uploadButtonText}>
                {t('caretaker.chooseImage', { defaultValue: 'Choose image' })}
              </Text>
            </TouchableOpacity>

            {selectedEvidenceImage ? (
              <Text style={styles.selectedImageText} numberOfLines={2}>
                {t('caretaker.selectedImage', {
                  defaultValue: 'Selected: {{name}}',
                  name: selectedEvidenceImage.fileName,
                })}
              </Text>
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
    backgroundColor: SCREEN_BG,
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
  notificationButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E9EFEA',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF7A00',
  },
  segmentWrap: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  segmentContent: {
    paddingVertical: SPACING.xs,
  },
  segmentChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#DCE5DE',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    marginRight: SPACING.sm,
  },
  segmentChipActive: {
    borderColor: ACTION_GREEN,
    backgroundColor: '#E6FBEF',
  },
  segmentChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  segmentChipTextActive: {
    color: '#0A7A36',
    fontWeight: '700',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['2xl'],
  },
  taskCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E3EAE4',
    padding: SPACING.md,
    marginBottom: SPACING.md,
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
  evidencePreviewImage: {
    width: '100%',
    height: 144,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    backgroundColor: '#DFE7E1',
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
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    marginTop: SPACING.sm,
  },
  detailButtonText: {
    marginLeft: 6,
    color: COLORS.white,
    fontWeight: '700',
    fontSize: FONTS.sizes.sm,
  },
  paginationWrap: {
    borderTopWidth: 1,
    borderColor: '#DFE6E0',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: '#F1F5F2',
  },
  paginationSummary: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#C7D4C9',
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageTokensWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  pageTokenButton: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5DED7',
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    paddingHorizontal: 8,
  },
  pageTokenButtonActive: {
    backgroundColor: '#E6FBEF',
    borderColor: ACTION_GREEN,
  },
  pageTokenText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  pageTokenTextActive: {
    color: '#0A7A36',
    fontWeight: '700',
  },
  pageEllipsisWrap: {
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  pageEllipsis: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING['2xl'],
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 21,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: SPACING.xl,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
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
  uploadButtonText: {
    marginLeft: 8,
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: FONTS.sizes.sm,
  },
  selectedImageText: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.sm,
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
