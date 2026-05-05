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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants';
import { designService } from '../../services';
import { useAuthStore } from '../../stores';
import { DesignRegistration, DesignTask, RootStackParamList } from '../../types';
import {
  addDaysToIsoDateKey,
  addMonthsToMonthKey,
  formatVietnamDate,
  formatVietnamDateTime,
  getDesignRegistrationStatusPalette,
  getDesignTaskStatusPalette,
  getFirstDayOfMonthIsoDateKey,
  getLastDayOfMonthIsoDateKey,
  getMonthCalendarGridIsoWeeks,
  getMonthKeyFromIsoDateKey,
  getVietnamDateKey,
  getWeekDayIsoKeys,
  getWeekStartMondayIsoDateKey,
  sanitizeIsoDateKey,
  sortDesignTasks,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CaretakerDesignTasks'>;

type CaretakerSegment = 'today' | 'schedule' | 'assigned';
type ScheduleCalendarMode = 'week' | 'month';
type PageToken = number | 'left-ellipsis' | 'right-ellipsis';

const PAGE_SIZE = 10;
const TASK_PAGE_SIZE = 1000;
const SCREEN_BG = '#F6F8F6';
const TEXT_DARK = '#0D1B12';
const ACTION_GREEN = '#13EC5B';
const WEEK_DAY_COUNT = 7;

const buildRegistrationCode = (id: number): string => `DR-${String(id).padStart(4, '0')}`;

const formatDateLabel = (dateText: string | null | undefined, locale: string): string => {
  const dateKey = sanitizeIsoDateKey(dateText ?? '');
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

const buildMonthLabel = (monthKey: string, locale: string): string => {
  const firstDate = `${monthKey}-01`;
  const parsed = new Date(firstDate);
  if (Number.isNaN(parsed.getTime())) {
    return monthKey;
  }

  return parsed.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
};

const getDateDayNumber = (dateKey: string): string => {
  return dateKey.slice(8, 10);
};

const isDesignTaskCompletedStatus = (statusName: string): boolean => {
  return statusName.trim().toLowerCase().includes('completed');
};

const getRegistrationBadgePalette = (statusName: string) => {
  const base = getDesignRegistrationStatusPalette(statusName);
  return {
    ...base,
    borderColor: base.textColor,
  };
};

export default function CaretakerDesignTasksScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [activeSegment, setActiveSegment] = useState<CaretakerSegment>('today');
  const [scheduleMode, setScheduleMode] = useState<ScheduleCalendarMode>('week');
  const [todayTasks, setTodayTasks] = useState<DesignTask[]>([]);
  const [scheduleTasks, setScheduleTasks] = useState<DesignTask[]>([]);
  const [assignedRegistrations, setAssignedRegistrations] = useState<DesignRegistration[]>([]);

  const todayDateKey = useMemo(() => getVietnamDateKey(new Date()), []);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string>(todayDateKey);
  const [selectedWeekStartDate, setSelectedWeekStartDate] = useState<string>(() =>
    getWeekStartMondayIsoDateKey(todayDateKey)
  );
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    getMonthKeyFromIsoDateKey(todayDateKey)
  );

  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const weekDateKeys = useMemo(() => getWeekDayIsoKeys(selectedWeekStartDate), [selectedWeekStartDate]);

  const monthGridWeeks = useMemo(
    () => getMonthCalendarGridIsoWeeks(selectedMonthKey),
    [selectedMonthKey]
  );

  const scheduleRange = useMemo(() => {
    if (scheduleMode === 'month') {
      return {
        from: getFirstDayOfMonthIsoDateKey(selectedMonthKey),
        to: getLastDayOfMonthIsoDateKey(selectedMonthKey),
      };
    }

    return {
      from: selectedWeekStartDate,
      to: addDaysToIsoDateKey(selectedWeekStartDate, WEEK_DAY_COUNT - 1),
    };
  }, [scheduleMode, selectedMonthKey, selectedWeekStartDate]);

  const scheduleTaskCountByDate = useMemo(() => {
    const counter = new Map<string, number>();

    for (const task of scheduleTasks) {
      const dateKey = sanitizeIsoDateKey(task.scheduledDate ?? '');
      if (!dateKey) {
        continue;
      }

      counter.set(dateKey, (counter.get(dateKey) ?? 0) + 1);
    }

    return counter;
  }, [scheduleTasks]);

  const filteredScheduleTasks = useMemo(() => {
    return scheduleTasks.filter(
      (task) => sanitizeIsoDateKey(task.scheduledDate ?? '') === selectedScheduleDate
    );
  }, [scheduleTasks, selectedScheduleDate]);

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
        return t('caretaker.segmentSchedule', { defaultValue: 'Schedule' });
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
          const payload = await designService.getMyDesignTasks({
            PageNumber: 1,
            PageSize: TASK_PAGE_SIZE,
            from: todayDateKey,
            to: todayDateKey,
          });

          const items = sortDesignTasks(payload.items ?? []).filter(
            (task) => sanitizeIsoDateKey(task.scheduledDate ?? '') === todayDateKey
          );
          setTodayTasks(items);
          return;
        }

        if (segment === 'schedule') {
          if (!scheduleRange.from || !scheduleRange.to) {
            setScheduleTasks([]);
            return;
          }

          const payload = await designService.getMyDesignTasks({
            PageNumber: 1,
            PageSize: TASK_PAGE_SIZE,
            from: scheduleRange.from,
            to: scheduleRange.to,
          });

          const items = sortDesignTasks(payload.items ?? []).filter((task) =>
            Boolean(sanitizeIsoDateKey(task.scheduledDate ?? ''))
          );
          setScheduleTasks(items);
          return;
        }

        const payload = await designService.getMyCaretakerDesignRegistrations({
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
    [scheduleRange.from, scheduleRange.to, t, todayDateKey]
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

  const handleSelectScheduleMode = useCallback(
    (mode: ScheduleCalendarMode) => {
      setScheduleMode(mode);

      if (mode === 'week') {
        const weekStart = getWeekStartMondayIsoDateKey(selectedScheduleDate) || selectedWeekStartDate;
        setSelectedWeekStartDate(weekStart);
        return;
      }

      const monthKey = getMonthKeyFromIsoDateKey(selectedScheduleDate) || selectedMonthKey;
      setSelectedMonthKey(monthKey);
    },
    [selectedMonthKey, selectedScheduleDate, selectedWeekStartDate]
  );

  const handleSelectScheduleDate = useCallback((dateKey: string) => {
    setSelectedScheduleDate(dateKey);
  }, []);

  const handleNavigateWeek = useCallback(
    (direction: -1 | 1) => {
      const nextWeekStart = addDaysToIsoDateKey(selectedWeekStartDate, direction * WEEK_DAY_COUNT);
      if (!nextWeekStart) {
        return;
      }

      setSelectedWeekStartDate(nextWeekStart);
      setSelectedScheduleDate((currentSelectedDate) => {
        const currentWeekStart = getWeekStartMondayIsoDateKey(currentSelectedDate);
        if (currentWeekStart !== selectedWeekStartDate) {
          return nextWeekStart;
        }

        const dayOffset = weekDateKeys.findIndex((dateKey) => dateKey === currentSelectedDate);
        if (dayOffset < 0) {
          return nextWeekStart;
        }

        return addDaysToIsoDateKey(nextWeekStart, dayOffset);
      });
    },
    [selectedWeekStartDate, weekDateKeys]
  );

  const handleNavigateMonth = useCallback(
    (direction: -1 | 1) => {
      const nextMonthKey = addMonthsToMonthKey(selectedMonthKey, direction);
      if (!nextMonthKey) {
        return;
      }

      const currentDay = getDateDayNumber(selectedScheduleDate);
      const monthLastDateKey = getLastDayOfMonthIsoDateKey(nextMonthKey);
      if (!monthLastDateKey) {
        return;
      }

      const monthLastDay = Number(getDateDayNumber(monthLastDateKey));
      const nextDay = String(Math.min(Number(currentDay), monthLastDay)).padStart(2, '0');

      setSelectedMonthKey(nextMonthKey);
      setSelectedScheduleDate(`${nextMonthKey}-${nextDay}`);
    },
    [selectedMonthKey, selectedScheduleDate]
  );

  const scheduleWeekTitle = useMemo(() => {
    const start = scheduleRange.from;
    const end = scheduleRange.to;
    if (!start || !end) {
      return '--';
    }

    return `${formatVietnamDate(start, locale, { empty: start })} - ${formatVietnamDate(end, locale, { empty: end })}`;
  }, [locale, scheduleRange.from, scheduleRange.to]);

  const scheduleMonthTitle = useMemo(
    () => buildMonthLabel(selectedMonthKey, locale),
    [locale, selectedMonthKey]
  );

  const dayShortLabels = useMemo(
    () => [
      t('caretaker.dayMonShort', { defaultValue: 'Mon' }),
      t('caretaker.dayTueShort', { defaultValue: 'Tue' }),
      t('caretaker.dayWedShort', { defaultValue: 'Wed' }),
      t('caretaker.dayThuShort', { defaultValue: 'Thu' }),
      t('caretaker.dayFriShort', { defaultValue: 'Fri' }),
      t('caretaker.daySatShort', { defaultValue: 'Sat' }),
      t('caretaker.daySunShort', { defaultValue: 'Sun' }),
    ],
    [t]
  );

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
  }, [currentPage, hasNextPage, isLoading, isPageLoading, isRefreshing, loadSegmentData, totalPages]);

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

  const renderTaskCard = ({ item }: { item: DesignTask }) => {
    const statusPalette = getDesignTaskStatusPalette(item.statusName ?? '');
    const isCompleted = isDesignTaskCompletedStatus(item.statusName ?? '');

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

          <Text style={styles.taskDateText}>{formatDateLabel(item.scheduledDate, locale)}</Text>
        </View>

        <Text style={styles.registrationCodeText}>
          {t('caretaker.registrationCode', {
            defaultValue: 'Registration #{{code}}',
            code: buildRegistrationCode(item.designRegistrationId),
          })}
        </Text>

        <Text style={styles.packageNameText} numberOfLines={2}>
          {item.taskTypeName || t('caretaker.unnamedPackage', { defaultValue: 'Design task' })}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.assignedStaff?.fullName || '--'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={1}>
            {t('caretaker.createdAtLabel', { defaultValue: 'Created' })}: {formatDateTimeLabel(item.createdAt, locale)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={2}>
            {item.registration?.address || '--'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.registration?.phone || '--'}
          </Text>
        </View>

        <View style={styles.timeSummaryWrap}>
          <Text style={styles.timeSummaryLabel}>
            {t('caretaker.registrationStatusLabel', { defaultValue: 'Registration status' })}: {' '}
            <Text style={styles.timeSummaryValue}>{item.registration?.statusName || '--'}</Text>
          </Text>
          <Text style={styles.timeSummaryLabel}>
            {t('caretaker.assignedStaffLabel', { defaultValue: 'Assigned staff' })}: {' '}
            <Text style={styles.timeSummaryValue}>{item.assignedStaff?.fullName || '--'}</Text>
          </Text>
        </View>

        {typeof item.reportImageUrl === 'string' && item.reportImageUrl.trim().length > 0 ? (
          <View style={styles.evidenceWrap}>
            <Text style={styles.evidenceLabel}>
              {t('caretaker.checkOutImageLabel', { defaultValue: 'Evidence image' })}
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPreviewImageUri(item.reportImageUrl?.trim() || null)}
            >
              <Image source={{ uri: item.reportImageUrl.trim() }} style={styles.evidencePreviewImage} />
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.taskDetailButton}
          onPress={() =>
            navigation.navigate('CaretakerDesignTaskDetail', {
              taskId: item.id,
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
          <TouchableOpacity
            style={styles.detailButton}
            onPress={() =>
              navigation.navigate('CaretakerDesignRegistrationDetail', {
                registrationId: item.designRegistrationId,
                highlightedTaskId: item.id,
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
        </View>
      </View>
    );
  };

  const renderAssignedCard = ({ item }: { item: DesignRegistration }) => {
    const statusPalette = getRegistrationBadgePalette(item.statusName ?? '');
    const resolvedDate = item.approvedAt ?? item.createdAt;

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

          <Text style={styles.taskDateText}>{formatDateLabel(resolvedDate, locale)}</Text>
        </View>

        <Text style={styles.registrationCodeText}>
          {t('caretaker.registrationCode', {
            defaultValue: 'Registration #{{code}}',
            code: buildRegistrationCode(item.id),
          })}
        </Text>

        <Text style={styles.packageNameText} numberOfLines={2}>
          {item.designTemplateTier?.designTemplate?.name ||
            t('caretaker.unnamedPackage', { defaultValue: 'Design template' })}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={16} color={COLORS.gray600} />
          <Text style={styles.infoText} numberOfLines={1}>
            {item.nursery?.name || '--'}
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
          onPress={() =>
            navigation.navigate('CaretakerDesignRegistrationDetail', {
              registrationId: item.id,
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
      </View>
    );
  };

  const taskItems =
    activeSegment === 'today'
      ? todayTasks
      : activeSegment === 'schedule'
      ? filteredScheduleTasks
      : scheduleTasks;
  const activeCount = activeSegment === 'assigned' ? assignedRegistrations.length : taskItems.length;

  const getEmptyTitle = () => {
    if (activeSegment === 'today') {
      return t('caretaker.emptyTodayTitle', { defaultValue: 'No tasks for today' });
    }

    if (activeSegment === 'schedule') {
      return t('caretaker.emptyScheduleDateTitle', { defaultValue: 'No tasks on selected day' });
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
      return t('caretaker.emptyScheduleDateSubtitle', {
        defaultValue: 'Try another day or keep waiting for new assignments.',
      });
    }

    return t('caretaker.emptyAssignedSubtitle', {
      defaultValue: 'Assigned registrations will appear here.',
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
          <Text style={styles.emptySubtitle}>
            {t('common.redirectingToLogin', {
              defaultValue: 'Redirecting to login...',
            })}
          </Text>
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

      {activeSegment === 'schedule' ? (
        <View style={styles.calendarWrap}>
          <View style={styles.calendarModeToggleRow}>
            <TouchableOpacity
              style={[
                styles.calendarModeButton,
                scheduleMode === 'week' && styles.calendarModeButtonActive,
              ]}
              onPress={() => handleSelectScheduleMode('week')}
            >
              <Text
                style={[
                  styles.calendarModeButtonText,
                  scheduleMode === 'week' && styles.calendarModeButtonTextActive,
                ]}
              >
                {t('caretaker.calendarModeWeek', { defaultValue: 'Week' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.calendarModeButton,
                scheduleMode === 'month' && styles.calendarModeButtonActive,
              ]}
              onPress={() => handleSelectScheduleMode('month')}
            >
              <Text
                style={[
                  styles.calendarModeButtonText,
                  scheduleMode === 'month' && styles.calendarModeButtonTextActive,
                ]}
              >
                {t('caretaker.calendarModeMonth', { defaultValue: 'Month' })}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.calendarPeriodNavRow}>
            <TouchableOpacity
              style={styles.calendarArrowButton}
              onPress={() => {
                if (scheduleMode === 'week') {
                  handleNavigateWeek(-1);
                  return;
                }

                handleNavigateMonth(-1);
              }}
            >
              <Ionicons name="chevron-back" size={18} color={TEXT_DARK} />
            </TouchableOpacity>

            <Text style={styles.calendarPeriodTitle}>
              {scheduleMode === 'week'
                ? t('caretaker.calendarWeekOf', {
                    defaultValue: 'Week of {{value}}',
                    value: scheduleWeekTitle,
                  })
                : t('caretaker.calendarMonthOf', {
                    defaultValue: 'Month of {{value}}',
                    value: scheduleMonthTitle,
                  })}
            </Text>

            <TouchableOpacity
              style={styles.calendarArrowButton}
              onPress={() => {
                if (scheduleMode === 'week') {
                  handleNavigateWeek(1);
                  return;
                }

                handleNavigateMonth(1);
              }}
            >
              <Ionicons name="chevron-forward" size={18} color={TEXT_DARK} />
            </TouchableOpacity>
          </View>

          {scheduleMode === 'week' ? (
            <View style={styles.weekStripRow}>
              {weekDateKeys.map((dateKey, index) => {
                const isSelected = selectedScheduleDate === dateKey;
                const isToday = dateKey === todayDateKey;
                const taskCount = scheduleTaskCountByDate.get(dateKey) ?? 0;

                return (
                  <TouchableOpacity
                    key={dateKey}
                    style={[
                      styles.weekDayCell,
                      isSelected && styles.weekDayCellSelected,
                      isToday && styles.weekDayCellToday,
                    ]}
                    onPress={() => handleSelectScheduleDate(dateKey)}
                  >
                    <Text style={[styles.weekDayLabel, isSelected && styles.weekDayLabelSelected]}>
                      {dayShortLabels[index]}
                    </Text>
                    <Text style={[styles.weekDayNumber, isSelected && styles.weekDayNumberSelected]}>
                      {Number(getDateDayNumber(dateKey))}
                    </Text>
                    <View style={styles.weekTaskMetaWrap}>
                      {taskCount > 0 ? <View style={styles.taskDot} /> : <View style={styles.taskDotPlaceholder} />}
                      <Text style={styles.weekTaskCountText}>{taskCount}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.monthGridWrap}>
              <View style={styles.monthGridHeaderRow}>
                {dayShortLabels.map((dayLabel) => (
                  <View key={dayLabel} style={styles.monthGridHeaderCell}>
                    <Text style={styles.monthGridHeaderText}>{dayLabel}</Text>
                  </View>
                ))}
              </View>

              {monthGridWeeks.map((week, rowIndex) => (
                <View key={`week-${rowIndex}`} style={styles.monthGridWeekRow}>
                  {week.map((dateKey) => {
                    const isCurrentMonth = dateKey.startsWith(selectedMonthKey);
                    const isSelected = selectedScheduleDate === dateKey;
                    const isToday = dateKey === todayDateKey;
                    const taskCount = scheduleTaskCountByDate.get(dateKey) ?? 0;

                    return (
                      <TouchableOpacity
                        key={dateKey}
                        style={[
                          styles.monthGridDayCell,
                          isSelected && styles.monthGridDayCellSelected,
                          isToday && styles.monthGridDayCellToday,
                        ]}
                        onPress={() => handleSelectScheduleDate(dateKey)}
                      >
                        <Text
                          style={[
                            styles.monthGridDayNumber,
                            !isCurrentMonth && styles.monthGridDayNumberMuted,
                            isSelected && styles.monthGridDayNumberSelected,
                          ]}
                        >
                          {Number(getDateDayNumber(dateKey))}
                        </Text>
                        {taskCount > 0 ? <View style={styles.taskDot} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

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
                  (!hasPreviousPage || isLoading || isRefreshing || isPageLoading) && styles.pageButtonDisabled,
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
                      <Text style={[styles.pageTokenText, isActivePage && styles.pageTokenTextActive]}>
                        {token}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.pageNavButton,
                  (!hasNextPage || isLoading || isRefreshing || isPageLoading) && styles.pageButtonDisabled,
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
          data={taskItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTaskCard}
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
  calendarWrap: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#DFE6E0',
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
  },
  calendarModeToggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  calendarModeButton: {
    flex: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#D5DED7',
    backgroundColor: '#F6F8F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  calendarModeButtonActive: {
    borderColor: ACTION_GREEN,
    backgroundColor: '#E6FBEF',
  },
  calendarModeButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  calendarModeButtonTextActive: {
    color: '#0A7A36',
    fontWeight: '700',
  },
  calendarPeriodNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  calendarArrowButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D4DED6',
    backgroundColor: '#F7F9F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarPeriodTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginHorizontal: SPACING.sm,
  },
  weekStripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  weekDayCell: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DCE5DE',
    backgroundColor: '#F8FBF9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 74,
  },
  weekDayCellSelected: {
    borderColor: ACTION_GREEN,
    backgroundColor: '#E9FBEF',
  },
  weekDayCellToday: {
    borderColor: '#8CCDA3',
  },
  weekDayLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  weekDayLabelSelected: {
    color: '#0A7A36',
  },
  weekDayNumber: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  weekDayNumberSelected: {
    color: '#0A7A36',
  },
  weekTaskMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  weekTaskCountText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  taskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1B9B53',
  },
  taskDotPlaceholder: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D5DED7',
  },
  monthGridWrap: {
    borderWidth: 1,
    borderColor: '#E1E9E3',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  monthGridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F4F8F5',
  },
  monthGridHeaderCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  monthGridHeaderText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  monthGridWeekRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#EAF0EB',
  },
  monthGridDayCell: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#EAF0EB',
    backgroundColor: COLORS.white,
  },
  monthGridDayCellSelected: {
    backgroundColor: '#E9FBEF',
  },
  monthGridDayCellToday: {
    backgroundColor: '#F1FBF4',
  },
  monthGridDayNumber: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  monthGridDayNumberMuted: {
    color: COLORS.gray400,
  },
  monthGridDayNumberSelected: {
    color: '#0A7A36',
    fontWeight: '700',
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
    marginBottom: SPACING.sm,
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
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    padding: 10,
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
});
