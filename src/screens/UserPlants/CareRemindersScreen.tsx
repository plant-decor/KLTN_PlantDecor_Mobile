import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { plantService } from '../../services';
import { useEnumStore, useUserPlantStore } from '../../stores';
import {
  CareReminder,
  GetCareRemindersRequest,
  RootStackParamList,
  SystemEnumValue,
} from '../../types';
import {
  formatDateToIsoKey,
  formatVietnamDate,
  isIsoDateKey,
  parseIsoDateKeyToDate,
  resolveImageUri,
} from '../../utils';
import { notify } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CareReminders'>;

type CareTypeOption = {
  value: number;
  label: string;
};

type ReminderFormState = {
  userPlantId: number | null;
  careType: number | null;
  reminderDate: string;
  content: string;
};

const CARE_REMINDER_PAGE_SIZE = 10;

const toPositiveInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const normalizeCareTypeOptions = (values: SystemEnumValue[]): CareTypeOption[] =>
  values
    .map((entry) => {
      const numericValue = toPositiveInt(entry.value);
      if (!numericValue) {
        return null;
      }

      return {
        value: numericValue,
        label: entry.name,
      };
    })
    .filter((entry): entry is CareTypeOption => Boolean(entry));

const resolveReminderContent = (reminder: CareReminder): string =>
  reminder.message ?? reminder.content ?? '';

const resolveReminderTitle = (reminder: CareReminder, fallback: string): string =>
  reminder.title ?? reminder.careTypeName ?? fallback;

const resolveReminderDate = (value: string, locale: string): string =>
  formatVietnamDate(value, locale, { empty: value });

const buildDefaultFormState = (): ReminderFormState => ({
  userPlantId: null,
  careType: null,
  reminderDate: formatDateToIsoKey(new Date()),
  content: '',
});

export default function CareRemindersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t, i18n } = useTranslation();

  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const { userPlants, isLoading: isUserPlantsLoading, fetchUserPlants } =
    useUserPlantStore();
  const loadEnumResource = useEnumStore((state) => state.loadResource);
  const getEnumValues = useEnumStore((state) => state.getEnumValues);

  const [reminders, setReminders] = useState<CareReminder[]>([]);
  const [todayReminders, setTodayReminders] = useState<CareReminder[]>([]);
  const [selectedCareType, setSelectedCareType] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isTodayLoading, setIsTodayLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isPlantPickerVisible, setIsPlantPickerVisible] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<CareReminder | null>(null);
  const [formState, setFormState] = useState<ReminderFormState>(() =>
    buildDefaultFormState()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadEnumResource('care-reminders');
  }, [loadEnumResource]);

  useEffect(() => {
    if (userPlants.length === 0) {
      void fetchUserPlants();
    }
  }, [fetchUserPlants, userPlants.length]);

  const careTypeOptions = useMemo(() => {
    const enumValues = getEnumValues(['CareReminderType']);
    return normalizeCareTypeOptions(enumValues);
  }, [getEnumValues]);

  const careTypeLabelByValue = useMemo(() => {
    return careTypeOptions.reduce<Record<number, string>>((accumulator, option) => {
      accumulator[option.value] = option.label;
      return accumulator;
    }, {});
  }, [careTypeOptions]);

  const loadCareReminders = useCallback(
    async (options?: {
      page?: number;
      append?: boolean;
      refresh?: boolean;
      careType?: number | null;
    }) => {
      const targetPage = options?.page ?? 1;
      const careType = options?.careType ?? selectedCareType;

      if (options?.refresh) {
        setIsRefreshing(true);
      } else if (options?.append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        setErrorMessage(null);
        const request: GetCareRemindersRequest = {
          careType: careType ?? undefined,
          pageNumber: targetPage,
          pageSize: CARE_REMINDER_PAGE_SIZE,
        };
        const payload = await plantService.getCareReminders(request);

        setReminders((current) =>
          options?.append ? [...current, ...payload.items] : payload.items
        );
        setPageNumber(payload.pageNumber);
        setHasNext(payload.hasNext);
        setTotalCount(payload.totalCount ?? payload.items.length);
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        setErrorMessage(
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('careReminders.loadFailed', {
                defaultValue: 'Unable to load care reminders. Please try again.',
              })
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [selectedCareType, t]
  );

  const loadTodayReminders = useCallback(async () => {
    setIsTodayLoading(true);
    try {
      const payload = await plantService.getTodayCareReminders();
      setTodayReminders(payload ?? []);
    } catch (error: any) {
      setTodayReminders([]);
    } finally {
      setIsTodayLoading(false);
    }
  }, []);

  const reloadData = useCallback(async () => {
    await Promise.all([
      loadCareReminders({ page: 1, refresh: true, careType: selectedCareType }),
      loadTodayReminders(),
    ]);
  }, [loadCareReminders, loadTodayReminders, selectedCareType]);

  useFocusEffect(
    useCallback(() => {
      void loadCareReminders({ page: 1, careType: selectedCareType });
      void loadTodayReminders();
    }, [loadCareReminders, loadTodayReminders, selectedCareType])
  );

  const handleRefresh = useCallback(() => {
    void reloadData();
  }, [reloadData]);

  const handleLoadMore = useCallback(() => {
    if (!hasNext || isLoadingMore || isLoading) {
      return;
    }

    void loadCareReminders({ page: pageNumber + 1, append: true });
  }, [hasNext, isLoading, isLoadingMore, loadCareReminders, pageNumber]);

  const handleSelectCareType = useCallback(
    (value: number | null) => {
      setSelectedCareType(value);
      void loadCareReminders({ page: 1, careType: value });
    },
    [loadCareReminders]
  );

  const handleOpenCreateForm = useCallback(() => {
    setEditingReminder(null);
    setFormState(buildDefaultFormState());
    setIsFormVisible(true);
  }, []);

  const handleOpenEditForm = useCallback((reminder: CareReminder) => {
    setEditingReminder(reminder);
    setFormState({
      userPlantId: reminder.userPlantId,
      careType: reminder.careType,
      reminderDate: reminder.reminderDate,
      content: resolveReminderContent(reminder),
    });
    setIsFormVisible(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormVisible(false);
    setEditingReminder(null);
    setIsPlantPickerVisible(false);
    setIsDatePickerVisible(false);
  }, []);

  const handlePickPlant = useCallback(
    (plantId: number) => {
      setFormState((current) => ({ ...current, userPlantId: plantId }));
      setIsPlantPickerVisible(false);
    },
    []
  );

  const handlePickDate = useCallback(
    (value: Date) => {
      setFormState((current) => ({
        ...current,
        reminderDate: formatDateToIsoKey(value),
      }));
    },
    []
  );

  const handleOpenDatePicker = useCallback(() => {
    const defaultDate = isIsoDateKey(formState.reminderDate)
      ? parseIsoDateKeyToDate(formState.reminderDate)
      : new Date();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: defaultDate,
        onChange: (_, selectedDate) => {
          if (selectedDate) {
            handlePickDate(selectedDate);
          }
        },
        mode: 'date',
      });
      return;
    }

    setIsDatePickerVisible(true);
  }, [formState.reminderDate, handlePickDate]);

  const handleSubmitForm = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    if (!formState.userPlantId || !formState.careType || !formState.reminderDate) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careReminders.requiredFields', {
          defaultValue: 'Please fill in all required fields.',
        })
      );
      return;
    }

    if (!isIsoDateKey(formState.reminderDate)) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careReminders.invalidDate', {
          defaultValue: 'Please choose a valid date.',
        })
      );
      return;
    }

    const content = formState.content.trim();
    if (!content) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careReminders.requiredContent', {
          defaultValue: 'Please enter a reminder note.',
        })
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingReminder) {
        await plantService.updateCareReminder(editingReminder.id, {
          userPlantId: formState.userPlantId,
          careType: formState.careType,
          content,
          reminderDate: formState.reminderDate,
        });

        notify({
          title: t('common.success', { defaultValue: 'Success' }),
          message: t('careReminders.updateSuccess', {
            defaultValue: 'Care reminder updated successfully.',
          }),
        });
      } else {
        await plantService.createCareReminder({
          userPlantId: formState.userPlantId,
          careType: formState.careType,
          content,
          reminderDate: formState.reminderDate,
        });

        notify({
          title: t('common.success', { defaultValue: 'Success' }),
          message: t('careReminders.createSuccess', {
            defaultValue: 'Care reminder created successfully.',
          }),
        });
      }

      handleCloseForm();
      await reloadData();
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('careReminders.saveFailed', {
              defaultValue: 'Unable to save reminder. Please try again.',
            })
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editingReminder,
    formState,
    handleCloseForm,
    isSubmitting,
    reloadData,
    t,
  ]);

  const handleDeleteReminder = useCallback(
    (reminder: CareReminder) => {
      Alert.alert(
        t('careReminders.deleteTitle', { defaultValue: 'Delete reminder?' }),
        t('careReminders.deleteMessage', {
          defaultValue: 'Are you sure you want to delete this reminder?',
        }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('careReminders.deleteAction', { defaultValue: 'Delete' }),
            style: 'destructive',
            onPress: async () => {
              try {
                await plantService.deleteCareReminder(reminder.id);
                notify({
                  title: t('common.success', { defaultValue: 'Success' }),
                  message: t('careReminders.deleteSuccess', {
                    defaultValue: 'Care reminder deleted successfully.',
                  }),
                });
                await reloadData();
              } catch (error: any) {
                const apiMessage = error?.response?.data?.message;
                Alert.alert(
                  t('common.error', { defaultValue: 'Error' }),
                  typeof apiMessage === 'string' && apiMessage.trim().length > 0
                    ? apiMessage
                    : t('careReminders.deleteFailed', {
                        defaultValue: 'Unable to delete reminder. Please try again.',
                      })
                );
              }
            },
          },
        ]
      );
    },
    [reloadData, t]
  );

  const handleCompleteReminder = useCallback(
    (reminder: CareReminder) => {
      if (reminder.isCompleted) {
        return;
      }

      Alert.alert(
        t('careReminders.completeTitle', {
          defaultValue: 'Mark as completed?',
        }),
        t('careReminders.completeMessage', {
          defaultValue: 'Mark this care reminder as completed?',
        }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('careReminders.completeAction', { defaultValue: 'Complete' }),
            onPress: async () => {
              try {
                await plantService.completeCareReminder(reminder.id);
                notify({
                  title: t('common.success', { defaultValue: 'Success' }),
                  message: t('careReminders.completeSuccess', {
                    defaultValue: 'Care reminder completed successfully.',
                  }),
                });
                await reloadData();
              } catch (error: any) {
                const apiMessage = error?.response?.data?.message;
                Alert.alert(
                  t('common.error', { defaultValue: 'Error' }),
                  typeof apiMessage === 'string' && apiMessage.trim().length > 0
                    ? apiMessage
                    : t('careReminders.completeFailed', {
                        defaultValue: 'Unable to complete reminder. Please try again.',
                      })
                );
              }
            },
          },
        ]
      );
    },
    [reloadData, t]
  );

  const resolveCareTypeLabel = useCallback(
    (reminder: CareReminder): string => {
      if (reminder.careTypeName) {
        return reminder.careTypeName;
      }

      return careTypeLabelByValue[reminder.careType] ??
        t('careReminders.unknownCareType', { defaultValue: 'Care task' });
    },
    [careTypeLabelByValue, t]
  );

  const resolvePlantName = useCallback(
    (reminder: CareReminder): string => {
      if (reminder.plantName) {
        return reminder.plantName;
      }

      const plant = userPlants.find((item) => item.id === reminder.userPlantId);
      return plant?.plantName ?? t('careReminders.unknownPlant', { defaultValue: 'Plant' });
    },
    [t, userPlants]
  );

  const resolveSelectedPlant = useMemo(() => {
    if (!formState.userPlantId) {
      return null;
    }

    return userPlants.find((item) => item.id === formState.userPlantId) ?? null;
  }, [formState.userPlantId, userPlants]);

  const renderTodaySection = () => {
    if (isTodayLoading) {
      return (
        <View style={styles.todayLoadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    if (todayReminders.length === 0) {
      return (
        <View style={styles.emptyTodayCard}>
          <Text style={styles.emptyTitle}>
            {t('careReminders.emptyTodayTitle', {
              defaultValue: 'No reminders today',
            })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('careReminders.emptyTodaySubtitle', {
              defaultValue: 'Enjoy your calm day with your plants.',
            })}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.todayList}
      >
        {todayReminders.map((reminder) => {
          const imageUri = resolveImageUri(reminder.plantImageUrl);
          const isCompleted = reminder.isCompleted;
          return (
            <View
              key={`today-${reminder.id}`}
              style={styles.todayCard}
            >
              <View style={styles.todayHeaderRow}>
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>
                    {resolveCareTypeLabel(reminder)}
                  </Text>
                </View>
                {isCompleted ? (
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                ) : null}
              </View>
              <View style={styles.todayPlantRow}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.todayImage} />
                ) : (
                  <View style={styles.todayImagePlaceholder}>
                    <Ionicons name="leaf" size={18} color={COLORS.gray400} />
                  </View>
                )}
                <View style={styles.todayPlantInfo}>
                  <Text style={styles.todayPlantName} numberOfLines={1}>
                    {resolvePlantName(reminder)}
                  </Text>
                  <Text style={styles.todayDate}>
                    {resolveReminderDate(reminder.reminderDate, locale)}
                  </Text>
                </View>
              </View>
              <Text style={styles.todayContent} numberOfLines={3}>
                {resolveReminderContent(reminder)}
              </Text>
              <View style={styles.todayActions}>
                {!isCompleted ? (
                  <TouchableOpacity
                    style={styles.todayActionPrimary}
                    onPress={() => handleCompleteReminder(reminder)}
                  >
                    <Ionicons name="checkmark" size={14} color={COLORS.white} />
                    <Text style={styles.todayActionPrimaryText}>
                      {t('careReminders.completeAction', { defaultValue: 'Complete' })}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.todayActionSpacer} />
                )}
                <TouchableOpacity
                  style={styles.todayActionIcon}
                  onPress={() => handleOpenEditForm(reminder)}
                >
                  <Ionicons name="create-outline" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.todayActionIcon}
                  onPress={() => handleDeleteReminder(reminder)}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderReminderCard = ({ item }: { item: CareReminder }) => {
    const imageUri = resolveImageUri(item.plantImageUrl);
    const isCompleted = item.isCompleted;
    const statusLabel = isCompleted
      ? t('careReminders.completed', { defaultValue: 'Completed' })
      : t('careReminders.pending', { defaultValue: 'Pending' });

    return (
      <View style={styles.reminderCard}>
        <View style={styles.reminderHeader}>
          <View style={styles.reminderTitleRow}>
            <View style={styles.reminderPlantImageWrap}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.reminderPlantImage} />
              ) : (
                <View style={styles.reminderPlantPlaceholder}>
                  <Ionicons name="leaf" size={18} color={COLORS.gray400} />
                </View>
              )}
            </View>
            <View style={styles.reminderHeaderInfo}>
              <Text style={styles.reminderPlantName} numberOfLines={1}>
                {resolvePlantName(item)}
              </Text>
              <Text style={styles.reminderType}>{resolveCareTypeLabel(item)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, isCompleted && styles.statusBadgeCompleted]}>
            <Text style={[styles.statusText, isCompleted && styles.statusTextCompleted]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.reminderTitle}>
          {resolveReminderTitle(
            item,
            t('careReminders.defaultTitle', {
              defaultValue: 'Plant care reminder',
            })
          )}
        </Text>
        <Text style={styles.reminderContent}>{resolveReminderContent(item)}</Text>

        <View style={styles.reminderMetaRow}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.reminderMetaText}>
            {resolveReminderDate(item.reminderDate, locale)}
          </Text>
        </View>

        <View style={styles.reminderActions}>
          {!isCompleted ? (
            <TouchableOpacity
              style={styles.actionPrimary}
              onPress={() => handleCompleteReminder(item)}
            >
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
              <Text style={styles.actionPrimaryText}>
                {t('careReminders.completeAction', { defaultValue: 'Complete' })}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.actionSpacer} />
          )}

          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => handleOpenEditForm(item)}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => handleDeleteReminder(item)}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderListHeader = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t('careReminders.todayTitle', { defaultValue: 'Today' })}
        </Text>
      </View>
      {renderTodaySection()}

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {t('careReminders.listTitle', { defaultValue: 'All reminders' })}
        </Text>
        <Text style={styles.sectionCaption}>
          {t('careReminders.totalCount', {
            defaultValue: '{{count}} reminders',
            count: Math.max(totalCount, reminders.length),
          })}
        </Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>
          {t('careReminders.filterLabel', { defaultValue: 'Care type' })}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterChips}>
            <TouchableOpacity
              style={[styles.filterChip, selectedCareType === null && styles.filterChipSelected]}
              onPress={() => handleSelectCareType(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCareType === null && styles.filterChipTextSelected,
                ]}
              >
                {t('common.all', { defaultValue: 'All' })}
              </Text>
            </TouchableOpacity>
            {careTypeOptions.map((option) => {
              const selected = selectedCareType === option.value;
              return (
                <TouchableOpacity
                  key={`care-type-${option.value}`}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                  onPress={() => handleSelectCareType(option.value)}
                >
                  <Text
                    style={[styles.filterChipText, selected && styles.filterChipTextSelected]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );

  const renderListEmpty = () => {
    if (isLoading || isRefreshing) {
      return null;
    }

    return (
      <View style={styles.emptyListCard}>
        <Text style={styles.emptyTitle}>
          {t('careReminders.emptyListTitle', {
            defaultValue: 'No reminders yet',
          })}
        </Text>
        <Text style={styles.emptySubtitle}>
          {t('careReminders.emptyListSubtitle', {
            defaultValue: 'Create a reminder to stay on track with plant care.',
          })}
        </Text>
        <TouchableOpacity style={styles.emptyAction} onPress={handleOpenCreateForm}>
          <Text style={styles.emptyActionText}>
            {t('careReminders.createAction', { defaultValue: 'Create reminder' })}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPlantPicker = () => (
    <Modal
      visible={isPlantPickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setIsPlantPickerVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>
              {t('careReminders.selectPlant', { defaultValue: 'Select plant' })}
            </Text>
            <TouchableOpacity onPress={() => setIsPlantPickerVisible(false)}>
              <Ionicons name="close" size={20} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>
          {isUserPlantsLoading ? (
            <View style={styles.pickerLoading}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : userPlants.length === 0 ? (
            <Text style={styles.pickerEmpty}>
              {t('careReminders.noPlants', { defaultValue: 'No plants available.' })}
            </Text>
          ) : (
            <FlatList
              data={userPlants}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => handlePickPlant(item.id)}
                >
                  <Text style={styles.pickerItemText}>{item.plantName}</Text>
                  {formState.userPlantId === item.id ? (
                    <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.pickerDivider} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <BrandedHeader
        title={t('careReminders.title', { defaultValue: 'Care Reminders' })}
        brandVariant="none"
        left={
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity style={styles.headerButton} onPress={handleOpenCreateForm}>
            <Ionicons name="add" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
      />

      {isLoading && reminders.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderReminderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderListEmpty}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.listFooter}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        />
      )}

      <Modal
        visible={isFormVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseForm}
      >
        <SafeAreaView style={styles.formSafeArea} edges={['top']}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingReminder
                ? t('careReminders.editTitle', { defaultValue: 'Edit reminder' })
                : t('careReminders.createTitle', { defaultValue: 'Create reminder' })}
            </Text>
            <TouchableOpacity onPress={handleCloseForm}>
              <Ionicons name="close" size={22} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.formLabel}>
              {t('careReminders.plantLabel', { defaultValue: 'Plant' })}
            </Text>
            <TouchableOpacity
              style={styles.formSelect}
              onPress={() => setIsPlantPickerVisible(true)}
            >
              <Text style={styles.formSelectText}>
                {resolveSelectedPlant?.plantName ??
                  t('careReminders.selectPlant', { defaultValue: 'Select plant' })}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
            </TouchableOpacity>

            <Text style={styles.formLabel}>
              {t('careReminders.careTypeLabel', { defaultValue: 'Care type' })}
            </Text>
            <View style={styles.formChips}>
              {careTypeOptions.map((option) => {
                const selected = formState.careType === option.value;
                return (
                  <TouchableOpacity
                    key={`form-care-type-${option.value}`}
                    style={[
                      styles.formChip,
                      selected && styles.formChipSelected,
                      styles.formChipSpacing,
                    ]}
                    onPress={() =>
                      setFormState((current) => ({ ...current, careType: option.value }))
                    }
                  >
                    <Text style={[styles.formChipText, selected && styles.formChipTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.formLabel}>
              {t('careReminders.dateLabel', { defaultValue: 'Reminder date' })}
            </Text>
            <TouchableOpacity style={styles.formSelect} onPress={handleOpenDatePicker}>
              <Text style={styles.formSelectText}>
                {isIsoDateKey(formState.reminderDate)
                  ? resolveReminderDate(formState.reminderDate, locale)
                  : t('careReminders.pickDate', { defaultValue: 'Pick a date' })}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={COLORS.gray400} />
            </TouchableOpacity>

            <Text style={styles.formLabel}>
              {t('careReminders.contentLabel', { defaultValue: 'Reminder note' })}
            </Text>
            <TextInput
              style={styles.formInput}
              multiline
              placeholder={t('careReminders.contentPlaceholder', {
                defaultValue: 'Add a note for this care task...',
              })}
              placeholderTextColor={COLORS.gray400}
              value={formState.content}
              onChangeText={(value) =>
                setFormState((current) => ({ ...current, content: value }))
              }
            />

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmitForm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingReminder
                    ? t('careReminders.updateAction', { defaultValue: 'Update reminder' })
                    : t('careReminders.createAction', { defaultValue: 'Create reminder' })}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {Platform.OS === 'ios' && isDatePickerVisible ? (
        <View style={styles.iosDatePickerWrap}>
          <DateTimePicker
            value={
              isIsoDateKey(formState.reminderDate)
                ? parseIsoDateKeyToDate(formState.reminderDate)
                : new Date()
            }
            mode="date"
            display="spinner"
            onChange={(_, selectedDate) => {
              if (selectedDate) {
                handlePickDate(selectedDate);
              }
            }}
          />
          <TouchableOpacity
            style={styles.iosDatePickerDoneButton}
            onPress={() => setIsDatePickerVisible(false)}
          >
            <Text style={styles.iosDatePickerDoneText}>
              {t('common.done', { defaultValue: 'Done' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {renderPlantPicker()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  formSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  sectionHeader: {
    marginBottom: SPACING.sm,
  },
  sectionHeaderRow: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionCaption: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  todayLoadingContainer: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  todayList: {
    paddingBottom: SPACING.sm,
  },
  todayCard: {
    width: 240,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    marginRight: SPACING.md,
    ...SHADOWS.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  todayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  todayBadge: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  todayBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  todayPlantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  todayImage: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.gray100,
  },
  todayImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayPlantInfo: {
    flex: 1,
  },
  todayPlantName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  todayDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  todayContent: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray700,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  todayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  todayActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  todayActionPrimaryText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  todayActionSpacer: {
    flex: 1,
  },
  todayActionIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
  },
  emptyTodayCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  emptyListCard: {
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  emptyAction: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  emptyActionText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  filterSection: {
    marginBottom: SPACING.lg,
  },
  filterLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  filterChips: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray100,
    marginRight: SPACING.sm,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  filterChipTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  reminderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderPlantImageWrap: {
    width: 48,
    height: 48,
    marginRight: SPACING.sm,
  },
  reminderPlantImage: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.md,
  },
  reminderPlantPlaceholder: {
    flex: 1,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderHeaderInfo: {
    flex: 1,
  },
  reminderPlantName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  reminderType: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: `${COLORS.warning}25`,
  },
  statusBadgeCompleted: {
    backgroundColor: `${COLORS.success}20`,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: COLORS.success,
  },
  reminderTitle: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  reminderContent: {
    marginTop: 4,
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray700,
    lineHeight: 20,
  },
  reminderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  reminderMetaText: {
    marginLeft: 6,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    justifyContent: 'flex-end',
  },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  actionPrimaryText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionSpacer: {
    flex: 1,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  listFooter: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.sm,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
  },
  formTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  formContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  formLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  formSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  formSelectText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  formChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.md,
  },
  formChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray100,
  },
  formChipSpacing: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  formChipSelected: {
    backgroundColor: COLORS.primary,
  },
  formChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  formChipTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  formInput: {
    minHeight: 120,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    textAlignVertical: 'top',
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  submitButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  pickerModal: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    maxHeight: '80%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  pickerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pickerLoading: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  pickerEmpty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingVertical: SPACING.lg,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  pickerItemText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  pickerDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  iosDatePickerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  iosDatePickerDoneButton: {
    marginTop: SPACING.md,
    alignSelf: 'flex-end',
  },
  iosDatePickerDoneText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
});
