import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { careService, enumService } from '../../services';
import { useAuthStore } from '../../stores';
import {
  formatDateToIsoKey,
  formatVietnamDate,
  formatVietnamDateTime,
  getMinimumVietnamDateKeyForLeadHours,
  isIsoDateKey,
  isVietnamDateKeyMeetingLeadHours,
  parseIsoDateKeyToDate,
} from '../../utils';
import {
  CareServicePackage,
  CreateServiceRegistrationRequest,
  Nursery,
  NurseryNearby,
  RootStackParamList,
  ServiceRegistration,
  SystemEnumGroup,
  SystemEnumValue,
} from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type CareStep = 1 | 2 | 3;

type CareTab = 'register' | 'registrations';

type ShiftOption = {
  id: number;
  label: string;
};

type RegistrationStatusOption = {
  key: string;
  statusCode: number;
  label: string;
};

type RegistrationStatusFilterOption = {
  key: string;
  statusCode: number | null;
  label: string;
};

const DEFAULT_RADIUS_KM = 20;
const DEFAULT_REGISTRATION_PAGE_SIZE = 10;
const ONE_TIME_MIN_LEAD_HOURS = 24;
const PERIOD_MIN_LEAD_HOURS = 48;
const ADDRESS_SUGGESTION_MIN_LENGTH = 3;
const ADDRESS_SUGGESTION_LIMIT = 5;
const ADDRESS_SUGGESTION_DEBOUNCE_MS = 350;
const ADDRESS_SUGGESTION_REQUEST_TIMEOUT_MS = 7000;

type ResolvedCoordinates = {
  lat: number;
  lng: number;
};

type AddressSuggestion = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

type CareRegistrationNursery = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  distanceKm: number | null;
};

type NominatimSearchItem = {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
};

const normalizeEnumCode = (rawCode: unknown): number | null => {
  if (typeof rawCode === 'number' && Number.isInteger(rawCode)) {
    return rawCode;
  }

  if (typeof rawCode === 'string' && /^-?\d+$/.test(rawCode.trim())) {
    const parsed = Number(rawCode.trim());
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
};

const normalizeCoordinate = (rawCoordinate: unknown): number | null => {
  if (typeof rawCoordinate === 'number' && Number.isFinite(rawCoordinate)) {
    return rawCoordinate;
  }

  if (typeof rawCoordinate === 'string' && rawCoordinate.trim().length > 0) {
    const parsed = Number(rawCoordinate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const isValidIsoDate = (rawDate: string): boolean => isIsoDateKey(rawDate);

const formatLocalIsoDate = (dateValue: Date): string => {
  return formatDateToIsoKey(dateValue);
};

const parseIsoDateToLocalDate = (rawDate: string): Date => {
  return parseIsoDateKeyToDate(rawDate);
};

const normalizeEnumName = (rawName: string): string =>
  rawName.replace(/[^a-z0-9]/gi, '').toLowerCase();

const getMinimumDateForLeadHours = (leadHours: number): Date =>
  parseIsoDateToLocalDate(getMinimumVietnamDateKeyForLeadHours(leadHours));

const isIsoDateMeetingLeadTime = (rawDate: string, leadHours: number): boolean => {
  return isVietnamDateKeyMeetingLeadHours(rawDate, leadHours);
};

const formatCurrency = (amount: number): string => {
  return `${(amount || 0).toLocaleString('vi-VN')}đ`;
};

const formatDistance = (distanceKm: number): string => {
  return `${distanceKm.toFixed(2)} km`;
};

const mapShopNurseryToCareRegistrationNursery = (nursery: Nursery): CareRegistrationNursery => {
  return {
    id: nursery.id,
    name: nursery.name,
    address: nursery.address,
    phone: typeof nursery.phone === 'string' ? nursery.phone : null,
    distanceKm: null,
  };
};

const mapNearbyNurseryToCareRegistrationNursery = (
  nursery: NurseryNearby
): CareRegistrationNursery => {
  return {
    id: nursery.id,
    name: nursery.name,
    address: nursery.address,
    phone: nursery.phone,
    distanceKm:
      typeof nursery.distanceKm === 'number' && Number.isFinite(nursery.distanceKm)
        ? nursery.distanceKm
        : null,
  };
};

const formatCoordinate = (coordinate: number | null): string => {
  if (coordinate === null) {
    return '-';
  }

  return coordinate.toFixed(6);
};

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

export default function CareServiceRegistrationScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const initialAddress =
    typeof user?.address === 'string'
      ? user.address
      : user?.address?.fullAddress ?? '';
  const initialLatitude = normalizeCoordinate(user?.latitude);
  const initialLongitude = normalizeCoordinate(user?.longitude);

  const [activeTab, setActiveTab] = useState<CareTab>('register');
  const [step, setStep] = useState<CareStep>(1);
  const [packages, setPackages] = useState<CareServicePackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [selectedPackageDetail, setSelectedPackageDetail] = useState<CareServicePackage | null>(null);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);

  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState<number | null>(initialLatitude);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isLoadingAddressSuggestions, setIsLoadingAddressSuggestions] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [hasAddressSuggestionQueryFinished, setHasAddressSuggestionQueryFinished] =
    useState(false);

  const [nurseries, setNurseries] = useState<CareRegistrationNursery[]>([]);
  const [selectedNurseryId, setSelectedNurseryId] = useState<number | null>(null);
  const [isLoadingNurseries, setIsLoadingNurseries] = useState(false);

  const [serviceDate, setServiceDate] = useState(() =>
    formatLocalIsoDate(getMinimumDateForLeadHours(PERIOD_MIN_LEAD_HOURS))
  );
  const [isShowingServiceDatePicker, setIsShowingServiceDatePicker] = useState(false);
  const [selectedScheduleDays, setSelectedScheduleDays] = useState<number[]>([]);
  const [preferredShiftId, setPreferredShiftId] = useState<number | null>(null);
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [serviceFlowGroups, setServiceFlowGroups] = useState<SystemEnumGroup[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);
  const [shiftsErrorMessage, setShiftsErrorMessage] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.phoneNumber ?? user?.phone ?? '');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [registrations, setRegistrations] = useState<ServiceRegistration[]>([]);
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(false);
  const [registrationsErrorMessage, setRegistrationsErrorMessage] = useState<string | null>(null);
  const [registrationPageNumber, setRegistrationPageNumber] = useState(1);
  const [registrationTotalPages, setRegistrationTotalPages] = useState(1);
  const [registrationHasPreviousPage, setRegistrationHasPreviousPage] = useState(false);
  const [registrationHasNextPage, setRegistrationHasNextPage] = useState(false);
  const [registrationTotalCount, setRegistrationTotalCount] = useState(0);
  const [activeRegistrationStatus, setActiveRegistrationStatus] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const lastGeocodedAddressRef = useRef<string>(
    initialLatitude !== null && initialLongitude !== null ? initialAddress.trim() : ''
  );
  const addressSuggestionRequestIdRef = useRef(0);
  const isSelectingAddressSuggestionRef = useRef(false);
  const addressInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const loadPackages = async () => {
      try {
        setIsLoadingPackages(true);
        const response = await careService.getCareServicePackages();
        setPackages(response);
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('careService.packagesLoadFailed', {
                defaultValue: 'Unable to load care service packages. Please try again.',
              })
        );
      } finally {
        setIsLoadingPackages(false);
      }
    };

    void loadPackages();
  }, [isAuthenticated, t]);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedPackageId) ?? null,
    [packages, selectedPackageId]
  );

  const formatShiftTime = useCallback((timeValue: string): string => {
    if (typeof timeValue !== 'string') {
      return '';
    }

    return timeValue.length >= 5 ? timeValue.slice(0, 5) : timeValue;
  }, []);

  const getServiceFlowEnumValues = useCallback(
    (groupNames: string[]): SystemEnumValue[] => {
      for (const groupName of groupNames) {
        const normalizedGroupName = normalizeEnumName(groupName);
        const matchedGroup = serviceFlowGroups.find(
          (group) => normalizeEnumName(group.enumName) === normalizedGroupName
        );

        if (matchedGroup && matchedGroup.values.length > 0) {
          return matchedGroup.values;
        }
      }

      return [];
    },
    [serviceFlowGroups]
  );

  const loadServiceFlow = useCallback(async () => {
    try {
      setIsLoadingShifts(true);
      setShiftsErrorMessage(null);

      const { groups, shifts } = await enumService.getServiceFlow();
      setServiceFlowGroups(groups);

      const mappedOptions = shifts
        .filter((shift) => Number.isInteger(shift.id) && shift.id > 0)
        .map((shift) => ({
          id: shift.id,
          label: `${shift.shiftName.trim()} (${formatShiftTime(shift.startTime)} - ${formatShiftTime(
            shift.endTime
          )})`,
        }));

      setShiftOptions(mappedOptions);

      if (mappedOptions.length === 0) {
        setShiftsErrorMessage(
          t('careService.noShiftsAvailable', {
            defaultValue: 'No shifts available at the moment.',
          })
        );
      }
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      const fallbackMessage = t('careService.shiftsLoadFailed', {
        defaultValue: 'Unable to load shifts. Please try again.',
      });
      const resolvedMessage =
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : fallbackMessage;

      setServiceFlowGroups([]);
      setShiftOptions([]);
      setShiftsErrorMessage(resolvedMessage);
    } finally {
      setIsLoadingShifts(false);
    }
  }, [formatShiftTime, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void loadServiceFlow();
  }, [isAuthenticated, loadServiceFlow]);

  useEffect(() => {
    if (shiftOptions.length === 0) {
      setPreferredShiftId(null);
      return;
    }

    setPreferredShiftId((previousValue) => {
      if (previousValue && shiftOptions.some((option) => option.id === previousValue)) {
        return previousValue;
      }

      return shiftOptions[0].id;
    });
  }, [shiftOptions]);

  const resolveScheduleDayLabel = useCallback(
    (dayValue: number, fallbackLabel: string): string => {
      if (dayValue === 0) {
        return t('careService.daySun', { defaultValue: 'Sun' });
      }

      if (dayValue === 1) {
        return t('careService.dayMon', { defaultValue: 'Mon' });
      }

      if (dayValue === 2) {
        return t('careService.dayTue', { defaultValue: 'Tue' });
      }

      if (dayValue === 3) {
        return t('careService.dayWed', { defaultValue: 'Wed' });
      }

      if (dayValue === 4) {
        return t('careService.dayThu', { defaultValue: 'Thu' });
      }

      if (dayValue === 5) {
        return t('careService.dayFri', { defaultValue: 'Fri' });
      }

      if (dayValue === 6) {
        return t('careService.daySat', { defaultValue: 'Sat' });
      }

      return fallbackLabel;
    },
    [t]
  );

  const scheduleDayOptions = useMemo(() => {
    const dayOfWeekValues = getServiceFlowEnumValues(['DayOfWeek']);

    const mappedOptions = dayOfWeekValues
      .map((enumValue) => {
        const dayValue = normalizeEnumCode(enumValue.value);
        if (dayValue === null) {
          return null;
        }

        const fallbackLabel =
          typeof enumValue.name === 'string' && enumValue.name.trim().length > 0
            ? enumValue.name.trim()
            : String(dayValue);

        return {
          value: dayValue,
          label: resolveScheduleDayLabel(dayValue, fallbackLabel),
        };
      })
      .filter((option): option is { value: number; label: string } => Boolean(option))
      .sort((left, right) => left.value - right.value);

    const uniqueOptions = Array.from(
      mappedOptions
        .reduce<Map<number, { value: number; label: string }>>((accumulator, option) => {
          if (!accumulator.has(option.value)) {
            accumulator.set(option.value, option);
          }

          return accumulator;
        }, new Map())
        .values()
    );

    if (uniqueOptions.length > 0) {
      return uniqueOptions;
    }

    return [
      {
        value: 0,
        label: t('careService.daySun', { defaultValue: 'Sun' }),
      },
      {
        value: 1,
        label: t('careService.dayMon', { defaultValue: 'Mon' }),
      },
      {
        value: 2,
        label: t('careService.dayTue', { defaultValue: 'Tue' }),
      },
      {
        value: 3,
        label: t('careService.dayWed', { defaultValue: 'Wed' }),
      },
      {
        value: 4,
        label: t('careService.dayThu', { defaultValue: 'Thu' }),
      },
      {
        value: 5,
        label: t('careService.dayFri', { defaultValue: 'Fri' }),
      },
      {
        value: 6,
        label: t('careService.daySat', { defaultValue: 'Sat' }),
      },
    ];
  }, [getServiceFlowEnumValues, resolveScheduleDayLabel, t]);

  const oneTimeServiceTypeValue = useMemo(() => {
    const careServiceTypeValues = getServiceFlowEnumValues(['CareServiceType']);
    const oneTimeValue = careServiceTypeValues.find(
      (enumValue) => normalizeEnumName(enumValue.name) === 'onetime'
    );

    return normalizeEnumCode(oneTimeValue?.value) ?? null;
  }, [getServiceFlowEnumValues]);

  const isOneTimeSelectedPackage = useMemo(() => {
    if (!selectedPackage) {
      return false;
    }

    const resolvedOneTimeValue = oneTimeServiceTypeValue ?? 1;
    return selectedPackage.serviceType === resolvedOneTimeValue;
  }, [oneTimeServiceTypeValue, selectedPackage]);

  const serviceDateLeadHours = isOneTimeSelectedPackage
    ? ONE_TIME_MIN_LEAD_HOURS
    : PERIOD_MIN_LEAD_HOURS;

  useEffect(() => {
    if (!isOneTimeSelectedPackage || selectedScheduleDays.length === 0) {
      return;
    }

    setSelectedScheduleDays([]);
  }, [isOneTimeSelectedPackage, selectedScheduleDays]);

  useEffect(() => {
    if (isIsoDateMeetingLeadTime(serviceDate, serviceDateLeadHours)) {
      return;
    }

    setServiceDate(formatLocalIsoDate(getMinimumDateForLeadHours(serviceDateLeadHours)));
  }, [serviceDate, serviceDateLeadHours]);

  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const formatDisplayDate = useCallback(
    (value: string) => formatVietnamDate(value, locale, { empty: value }),
    [locale]
  );

  const formatDisplayDateTime = useCallback(
    (value: string) => formatVietnamDateTime(value, locale, { empty: value }),
    [locale]
  );

  const enumRegistrationStatusOptions = useMemo<RegistrationStatusOption[]>(() => {
    const enumValues = getServiceFlowEnumValues([
      'ServiceRegistrationStatus',
      'RegistrationStatus',
      'ServiceRegistrationState',
    ]);

    const mapped: RegistrationStatusOption[] = [];

    enumValues.forEach((enumValue) => {
      const statusCode = normalizeEnumCode(enumValue.value);
      if (statusCode === null) {
        return;
      }

      const label =
        typeof enumValue.name === 'string' && enumValue.name.trim().length > 0
          ? enumValue.name.trim()
          : String(statusCode);

      mapped.push({
        key: `status-${statusCode}`,
        statusCode,
        label,
      });
    });

    return Array.from(
      mapped.reduce<Map<number, RegistrationStatusOption>>((accumulator, option) => {
        if (!accumulator.has(option.statusCode)) {
          accumulator.set(option.statusCode, option);
        }
        return accumulator;
      }, new Map()).values()
    );
  }, [getServiceFlowEnumValues]);

  const fallbackRegistrationStatusOptions = useMemo<RegistrationStatusOption[]>(() => {
    return Array.from(
      registrations
        .reduce<Map<number, RegistrationStatusOption>>((accumulator, registration) => {
          if (!Number.isInteger(registration.status)) {
            return accumulator;
          }

          if (accumulator.has(registration.status)) {
            return accumulator;
          }

          const fallbackLabel =
            typeof registration.statusName === 'string' && registration.statusName.trim().length > 0
              ? registration.statusName.trim()
              : `#${registration.status}`;

          accumulator.set(registration.status, {
            key: `status-${registration.status}`,
            statusCode: registration.status,
            label: fallbackLabel,
          });

          return accumulator;
        }, new Map())
        .values()
    );
  }, [registrations]);

  const registrationStatusOptions = useMemo<RegistrationStatusFilterOption[]>(() => {
    const dynamicOptions =
      enumRegistrationStatusOptions.length > 0
        ? enumRegistrationStatusOptions
        : fallbackRegistrationStatusOptions;

    return [
      {
        key: 'all',
        statusCode: null,
        label: t('careService.registrationsStatusAll', {
          defaultValue: 'All',
        }),
      },
      ...dynamicOptions,
    ];
  }, [enumRegistrationStatusOptions, fallbackRegistrationStatusOptions, t]);

  useEffect(() => {
    if (activeRegistrationStatus === null) {
      return;
    }

    if (registrationStatusOptions.some((option) => option.statusCode === activeRegistrationStatus)) {
      return;
    }

    setActiveRegistrationStatus(null);
  }, [activeRegistrationStatus, registrationStatusOptions]);

  const loadMyRegistrations = useCallback(
    async (targetPage: number, statusCode: number | null) => {
      if (!isAuthenticated) {
        return;
      }

      try {
        setIsLoadingRegistrations(true);
        setRegistrationsErrorMessage(null);

        const payload = await careService.getMyServiceRegistrations({
          PageNumber: Math.max(1, targetPage),
          PageSize: DEFAULT_REGISTRATION_PAGE_SIZE,
          status: typeof statusCode === 'number' ? statusCode : undefined,
        });

        const items = Array.isArray(payload.items) ? payload.items : [];
        const resolvedPageNumber = Math.max(1, payload.pageNumber ?? targetPage);
        const resolvedTotalPages = Math.max(1, payload.totalPages ?? 1);

        setRegistrations(items);
        setRegistrationTotalCount(payload.totalCount ?? items.length);
        setRegistrationPageNumber(resolvedPageNumber);
        setRegistrationTotalPages(resolvedTotalPages);
        setRegistrationHasPreviousPage(payload.hasPrevious ?? resolvedPageNumber > 1);
        setRegistrationHasNextPage(payload.hasNext ?? resolvedPageNumber < resolvedTotalPages);
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;

        setRegistrationsErrorMessage(
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('careService.registrationsLoadFailed', {
                defaultValue: 'Unable to load your service registrations. Please try again.',
              })
        );
        setRegistrations([]);
        setRegistrationTotalCount(0);
        setRegistrationHasPreviousPage(false);
        setRegistrationHasNextPage(false);
      } finally {
        setIsLoadingRegistrations(false);
      }
    },
    [isAuthenticated, t]
  );

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'registrations') {
      return;
    }

    void loadMyRegistrations(1, activeRegistrationStatus);
  }, [activeRegistrationStatus, activeTab, isAuthenticated, loadMyRegistrations]);

  const handleRetryRegistrations = useCallback(() => {
    void loadMyRegistrations(registrationPageNumber, activeRegistrationStatus);
  }, [activeRegistrationStatus, loadMyRegistrations, registrationPageNumber]);

  const handlePreviousRegistrationsPage = useCallback(() => {
    if (!registrationHasPreviousPage || registrationPageNumber <= 1 || isLoadingRegistrations) {
      return;
    }

    void loadMyRegistrations(registrationPageNumber - 1, activeRegistrationStatus);
  }, [
    activeRegistrationStatus,
    isLoadingRegistrations,
    loadMyRegistrations,
    registrationHasPreviousPage,
    registrationPageNumber,
  ]);

  const handleNextRegistrationsPage = useCallback(() => {
    if (
      !registrationHasNextPage ||
      registrationPageNumber >= registrationTotalPages ||
      isLoadingRegistrations
    ) {
      return;
    }

    void loadMyRegistrations(registrationPageNumber + 1, activeRegistrationStatus);
  }, [
    activeRegistrationStatus,
    isLoadingRegistrations,
    loadMyRegistrations,
    registrationHasNextPage,
    registrationPageNumber,
    registrationTotalPages,
  ]);

  const handleOpenRegistrationDetail = useCallback(
    (registrationId: number) => {
      navigation.navigate('ServiceRegistrationDetail', { registrationId });
    },
    [navigation]
  );

  const handleOpenPackageDetail = useCallback(
    (packageId: number | null) => {
      if (typeof packageId !== 'number' || !Number.isInteger(packageId) || packageId <= 0) {
        return;
      }

      navigation.navigate('CareServicePackageDetail', { packageId });
    },
    [navigation]
  );

  const resolveAddressFromCoordinates = useCallback(
    async (resolvedLatitude: number, resolvedLongitude: number): Promise<string | null> => {
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
        });

        const primaryAddress = addresses[0];
        if (!primaryAddress) {
          return null;
        }

        const formatted = [
          primaryAddress.name,
          primaryAddress.street,
          primaryAddress.district,
          primaryAddress.subregion,
          primaryAddress.city,
          primaryAddress.region,
          primaryAddress.country,
        ]
          .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
          .join(', ');

        return formatted.trim().length > 0 ? formatted : null;
      } catch {
        return null;
      }
    },
    []
  );

  const resolveCoordinatesFromAddress = useCallback(
    async (rawAddress: string): Promise<ResolvedCoordinates | null> => {
      const trimmedAddress = rawAddress.trim();
      if (!trimmedAddress) {
        return null;
      }

      try {
        const geocoded = await Location.geocodeAsync(trimmedAddress);
        const firstResult = geocoded[0];
        if (!firstResult) {
          return null;
        }

        return {
          lat: Number(firstResult.latitude.toFixed(6)),
          lng: Number(firstResult.longitude.toFixed(6)),
        };
      } catch {
        return null;
      }
    },
    []
  );

  const searchAddressSuggestions = useCallback(
    async (query: string): Promise<AddressSuggestion[]> => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length < ADDRESS_SUGGESTION_MIN_LENGTH) {
        return [];
      }

      let mappedSuggestions: AddressSuggestion[] = [];

      try {
        const endpoint =
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1` +
          `&limit=${ADDRESS_SUGGESTION_LIMIT}&q=${encodeURIComponent(trimmedQuery)}`;

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          abortController.abort();
        }, ADDRESS_SUGGESTION_REQUEST_TIMEOUT_MS);

        let response: Response | null = null;

        try {
          response = await fetch(endpoint, {
            headers: {
              Accept: 'application/json',
              'Accept-Language': i18n.language === 'vi' ? 'vi' : 'en',
            },
            signal: abortController.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (response?.ok) {
          const payload = (await response.json()) as NominatimSearchItem[];
          if (Array.isArray(payload)) {
            const seenLabels = new Set<string>();

            mappedSuggestions = payload
              .map((item) => {
                const label =
                  typeof item.display_name === 'string' ? item.display_name.trim() : '';
                const lat = normalizeCoordinate(item.lat);
                const lng = normalizeCoordinate(item.lon);

                if (!label || lat === null || lng === null) {
                  return null;
                }

                if (seenLabels.has(label)) {
                  return null;
                }

                seenLabels.add(label);

                const id =
                  typeof item.place_id === 'string' || typeof item.place_id === 'number'
                    ? String(item.place_id)
                    : `${label}-${lat}-${lng}`;

                return {
                  id,
                  label,
                  lat: Number(lat.toFixed(6)),
                  lng: Number(lng.toFixed(6)),
                };
              })
              .filter((item): item is AddressSuggestion => Boolean(item));
          }
        }
      } catch {
        mappedSuggestions = [];
      }

      if (mappedSuggestions.length > 0) {
        return mappedSuggestions;
      }

      const fallbackCoordinates = await resolveCoordinatesFromAddress(trimmedQuery);
      if (!fallbackCoordinates) {
        return [];
      }

      const fallbackAddress = await resolveAddressFromCoordinates(
        fallbackCoordinates.lat,
        fallbackCoordinates.lng
      );
      const fallbackLabel =
        typeof fallbackAddress === 'string' && fallbackAddress.trim().length > 0
          ? fallbackAddress.trim()
          : trimmedQuery;

      return [
        {
          id: `fallback-${fallbackCoordinates.lat}-${fallbackCoordinates.lng}`,
          label: fallbackLabel,
          lat: fallbackCoordinates.lat,
          lng: fallbackCoordinates.lng,
        },
      ];
    },
    [i18n.language, resolveAddressFromCoordinates, resolveCoordinatesFromAddress]
  );

  useEffect(() => {
    const trimmedAddress = address.trim();

    if (
      !isAddressFocused ||
      trimmedAddress.length < ADDRESS_SUGGESTION_MIN_LENGTH ||
      trimmedAddress === lastGeocodedAddressRef.current
    ) {
      setAddressSuggestions([]);
      setIsLoadingAddressSuggestions(false);
      setHasAddressSuggestionQueryFinished(false);
      return;
    }

    const currentRequestId = addressSuggestionRequestIdRef.current + 1;
    addressSuggestionRequestIdRef.current = currentRequestId;
    setIsLoadingAddressSuggestions(true);

    const debounceTimeout = setTimeout(() => {
      void (async () => {
        const suggestions = await searchAddressSuggestions(trimmedAddress);

        if (addressSuggestionRequestIdRef.current !== currentRequestId) {
          return;
        }

        setAddressSuggestions(suggestions);
        setIsLoadingAddressSuggestions(false);
        setHasAddressSuggestionQueryFinished(true);
      })();
    }, ADDRESS_SUGGESTION_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimeout);
    };
  }, [address, isAddressFocused, searchAddressSuggestions]);

  const handleChangeAddress = useCallback((nextAddress: string) => {
    const trimmedNextAddress = nextAddress.trim();

    setAddress(nextAddress);

    if (!trimmedNextAddress) {
      setLatitude(null);
      setLongitude(null);
      setAddressSuggestions([]);
      setHasAddressSuggestionQueryFinished(false);
      lastGeocodedAddressRef.current = '';
      return;
    }

    if (trimmedNextAddress !== lastGeocodedAddressRef.current) {
      setLatitude(null);
      setLongitude(null);
    }
  }, []);

  const handleSelectAddressSuggestion = useCallback((selectedItem: AddressSuggestion) => {
    isSelectingAddressSuggestionRef.current = false;

    setAddress(selectedItem.label);
    setLatitude(selectedItem.lat);
    setLongitude(selectedItem.lng);
    setAddressSuggestions([]);
    setHasAddressSuggestionQueryFinished(false);
    setIsAddressFocused(false);
    lastGeocodedAddressRef.current = selectedItem.label.trim();
  }, []);

  const handleAddressBlur = useCallback(async () => {
    if (isSelectingAddressSuggestionRef.current) {
      return;
    }

    setIsAddressFocused(false);
    setAddressSuggestions([]);
    setHasAddressSuggestionQueryFinished(false);

    const trimmedAddress = address.trim();

    if (!trimmedAddress || isGeocodingAddress || isResolvingLocation) {
      return;
    }

    if (trimmedAddress === lastGeocodedAddressRef.current) {
      return;
    }

    try {
      setIsGeocodingAddress(true);

      const resolvedCoordinates = await resolveCoordinatesFromAddress(trimmedAddress);
      if (!resolvedCoordinates) {
        return;
      }

      setLatitude(resolvedCoordinates.lat);
      setLongitude(resolvedCoordinates.lng);
      lastGeocodedAddressRef.current = trimmedAddress;
    } finally {
      setIsGeocodingAddress(false);
    }
  }, [
    address,
    isGeocodingAddress,
    isResolvingLocation,
    resolveCoordinatesFromAddress,
  ]);

  const shouldShowAddressSuggestionPanel =
    isAddressFocused &&
    address.trim().length >= ADDRESS_SUGGESTION_MIN_LENGTH;

  const resolveCoordinatesForNurserySearch = useCallback(async () => {
    const trimmedAddress = address.trim();

    if (
      latitude !== null &&
      longitude !== null &&
      (trimmedAddress.length === 0 || trimmedAddress === lastGeocodedAddressRef.current)
    ) {
      return {
        lat: latitude,
        lng: longitude,
      };
    }

    if (trimmedAddress.length > 0) {
      const resolvedCoordinates = await resolveCoordinatesFromAddress(trimmedAddress);
      if (!resolvedCoordinates) {
        return null;
      }

      setLatitude(resolvedCoordinates.lat);
      setLongitude(resolvedCoordinates.lng);
      lastGeocodedAddressRef.current = trimmedAddress;

      return resolvedCoordinates;
    }

    const profileLatitude = normalizeCoordinate(user?.latitude);
    const profileLongitude = normalizeCoordinate(user?.longitude);

    if (profileLatitude !== null && profileLongitude !== null) {
      setLatitude(profileLatitude);
      setLongitude(profileLongitude);

      return {
        lat: profileLatitude,
        lng: profileLongitude,
      };
    }

    return null;
  }, [
    address,
    latitude,
    longitude,
    resolveCoordinatesFromAddress,
    user?.latitude,
    user?.longitude,
  ]);

  const handleUseCurrentLocation = useCallback(async () => {
    if (isResolvingLocation || isLoadingNurseries || isSubmitting || isGeocodingAddress) {
      return;
    }

    try {
      setIsResolvingLocation(true);

      const isLocationServiceEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationServiceEnabled) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('careService.locationServiceDisabled', {
            defaultValue: 'Please enable location services and try again.',
          })
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('careService.locationPermissionDenied', {
            defaultValue: 'Location permission is required to use your current location.',
          })
        );
        return;
      }

      let position: Location.LocationObject | null = null;

      try {
        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch {
        position = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 150,
        });
      }

      if (!position) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('careService.locationUnavailable', {
            defaultValue:
              'Unable to determine your current location. Please move to an open area and try again.',
          })
        );
        return;
      }

      const resolvedLatitude = Number(position.coords.latitude.toFixed(6));
      const resolvedLongitude = Number(position.coords.longitude.toFixed(6));

      setLatitude(resolvedLatitude);
      setLongitude(resolvedLongitude);

      const resolvedAddress = await resolveAddressFromCoordinates(
        resolvedLatitude,
        resolvedLongitude
      );

      if (resolvedAddress) {
        setAddress(resolvedAddress);
        setAddressSuggestions([]);
        setIsAddressFocused(false);
        lastGeocodedAddressRef.current = resolvedAddress.trim();
      }
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.locationFailed', {
          defaultValue: 'Unable to fetch current location. Please try again.',
        })
      );
    } finally {
      setIsResolvingLocation(false);
    }
  }, [
    isGeocodingAddress,
    isLoadingNurseries,
    isResolvingLocation,
    isSubmitting,
    resolveAddressFromCoordinates,
    t,
  ]);

  const handleUseProfileAddress = useCallback(async () => {
    const profileAddress =
      typeof user?.address === 'string' ? user.address : user?.address?.fullAddress ?? '';

    if (!profileAddress) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.profileAddressMissing', {
          defaultValue: 'No profile address available in your profile.',
        })
      );
      return;
    }

    setAddress(profileAddress);
    setAddressSuggestions([]);
    setIsAddressFocused(false);
    lastGeocodedAddressRef.current = profileAddress.trim();

    const profileLatitude = normalizeCoordinate(user?.latitude);
    const profileLongitude = normalizeCoordinate(user?.longitude);

    if (profileLatitude !== null && profileLongitude !== null) {
      setLatitude(profileLatitude);
      setLongitude(profileLongitude);
      return;
    }

    try {
      setIsGeocodingAddress(true);
      const resolvedCoordinates = await resolveCoordinatesFromAddress(profileAddress);
      if (resolvedCoordinates) {
        setLatitude(resolvedCoordinates.lat);
        setLongitude(resolvedCoordinates.lng);
      }
    } finally {
      setIsGeocodingAddress(false);
    }
  }, [user, resolveCoordinatesFromAddress, t]);
  const resetRegistrationState = useCallback(() => {
    setStep(1);
    setSelectedPackageId(null);
    setSelectedPackageDetail(null);
    setNurseries([]);
    setSelectedNurseryId(null);

    setAddress(initialAddress);
    setLatitude(initialLatitude);
    setLongitude(initialLongitude);
    setIsAddressFocused(false);
    setAddressSuggestions([]);
    setHasAddressSuggestionQueryFinished(false);
    lastGeocodedAddressRef.current =
      initialLatitude !== null && initialLongitude !== null ? initialAddress.trim() : '';

    setServiceDate(formatLocalIsoDate(getMinimumDateForLeadHours(PERIOD_MIN_LEAD_HOURS)));
    setSelectedScheduleDays([]);
    setPreferredShiftId(null);
    setShiftOptions([]);

    setNote('');
    setPhone(user?.phoneNumber ?? user?.phone ?? '');

    setIsSubmitting(false);
    setIsResolvingLocation(false);
    setIsGeocodingAddress(false);
    setIsLoadingNurseries(false);
  }, [initialAddress, initialLatitude, initialLongitude, user]);

  const handleRefresh = useCallback(async () => {
    // reset registration UI/form state
    resetRegistrationState();

    setIsRefreshing(true);
    try {
      if (isAuthenticated) {
        try {
          const pkgs = await careService.getCareServicePackages();
          setPackages(pkgs);
        } catch (e) {
          // ignore package load errors on refresh
        }
      }

      // reload service flow (shifts, enums)
      try {
        await loadServiceFlow();
      } catch (e) {
        // ignore
      }

      // if on registrations tab, reload registrations
      if (activeTab === 'registrations') {
        try {
          await loadMyRegistrations(registrationPageNumber, activeRegistrationStatus);
        } catch (e) {
          // ignore
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isAuthenticated, loadServiceFlow, loadMyRegistrations, activeTab, registrationPageNumber, activeRegistrationStatus, resetRegistrationState]);

  

  const handleSelectNursery = useCallback((nursery: CareRegistrationNursery) => {
    setSelectedNurseryId(nursery.id);
  }, []);

  const handleToggleScheduleDay = useCallback((dayValue: number) => {
    setSelectedScheduleDays((previousDays) => {
      if (previousDays.includes(dayValue)) {
        return previousDays.filter((value) => value !== dayValue);
      }

      return [...previousDays, dayValue].sort((left, right) => left - right);
    });
  }, []);

  const serviceDateValue = useMemo(() => parseIsoDateToLocalDate(serviceDate), [serviceDate]);
  const minimumServiceDate = useMemo(
    () => getMinimumDateForLeadHours(serviceDateLeadHours),
    [serviceDateLeadHours]
  );
  const pickerServiceDateValue =
    serviceDateValue.getTime() < minimumServiceDate.getTime()
      ? minimumServiceDate
      : serviceDateValue;

  const handleSelectServiceDate = useCallback((selectedDate: Date) => {
    setServiceDate(formatLocalIsoDate(selectedDate));
  }, []);

  const handleOpenServiceDatePicker = useCallback(() => {
    const minimumDate = minimumServiceDate;
    const pickerValue =
      serviceDateValue.getTime() < minimumDate.getTime() ? minimumDate : serviceDateValue;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerValue,
        mode: 'date',
        minimumDate,
        onChange: (event, selectedDate) => {
          if (event.type !== 'set' || !selectedDate) {
            return;
          }

          handleSelectServiceDate(selectedDate);
        },
      });

      return;
    }

    setIsShowingServiceDatePicker(true);
  }, [handleSelectServiceDate, minimumServiceDate, serviceDateValue]);

  useEffect(() => {
    if (step !== 3 && isShowingServiceDatePicker) {
      setIsShowingServiceDatePicker(false);
    }
  }, [isShowingServiceDatePicker, step]);

  const handleContinueFromPackages = useCallback(async () => {
    if (!selectedPackageId) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.selectPackageRequired', {
          defaultValue: 'Please select a care service package first.',
        })
      );
      return;
    }

    try {
      setIsLoadingNurseries(true);

      const pkgWithNurseries = await careService.getCareServicePackageWithNurseries(
        selectedPackageId
      );

      if (pkgWithNurseries) {
        setSelectedPackageDetail(pkgWithNurseries);
      }

      if (Array.isArray(pkgWithNurseries?.nurseryCareServices)) {
        setNurseries(
          pkgWithNurseries.nurseryCareServices.map((item) => ({
            id: item.nurseryId,
            name: item.nurseryName,
            address:
              typeof (item as any).nurseryAddress === 'string' && (item as any).nurseryAddress.trim().length > 0
                ? (item as any).nurseryAddress
                : '',
            phone:
              typeof (item as any).nurseryPhone === 'string' && (item as any).nurseryPhone.trim().length > 0
                ? (item as any).nurseryPhone
                : null,
            distanceKm: null,
          }))
        );
      } else {
        setNurseries([]);
      }

      setSelectedNurseryId(null);

      // Prefill address and coordinates from user profile if the address field is empty
      try {
        const profileAddress =
          typeof user?.address === 'string'
            ? user.address
            : user?.address?.fullAddress ?? '';

        const profileLat = normalizeCoordinate(user?.latitude);
        const profileLng = normalizeCoordinate(user?.longitude);

        if ((!address || address.trim().length === 0) && profileAddress) {
          setAddress(profileAddress);

          if (profileLat !== null && profileLng !== null) {
            setLatitude(profileLat);
            setLongitude(profileLng);
            lastGeocodedAddressRef.current = profileAddress.trim();
          } else {
            // Try geocoding the profile address if coords are not present
            try {
              setIsGeocodingAddress(true);
              const resolved = await resolveCoordinatesFromAddress(profileAddress);
              if (resolved) {
                setLatitude(resolved.lat);
                setLongitude(resolved.lng);
                lastGeocodedAddressRef.current = profileAddress.trim();
              }
            } finally {
              setIsGeocodingAddress(false);
            }
          }
        }
      } catch {
        // ignore profile prefill errors, user can still edit manually
      }

      setStep(2);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('careService.nurseriesLoadFailed', {
              defaultValue: 'Unable to load nearby nurseries. Please try again.',
            })
      );
    } finally {
      setIsLoadingNurseries(false);
    }
  }, [selectedPackageId, t]);

  const handleContinueFromNurseries = useCallback(() => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.addressRequired', {
          defaultValue: 'Please enter the service address.',
        }),
        [
          {
            text: 'OK',
            onPress: () => {
              addressInputRef.current?.focus();
            },
          },
        ]
      );
      return;
    }

    setStep(3);
  }, [address, t]);

  const handleSkipNurseryPreference = useCallback(() => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.addressRequired', {
          defaultValue: 'Please enter the service address.',
        }),
        [
          {
            text: 'OK',
            onPress: () => {
              addressInputRef.current?.focus();
            },
          },
        ]
      );
      return;
    }

    setSelectedNurseryId(null);
    setStep(3);
  }, [address, t]);

  const handleSubmitRegistration = useCallback(async () => {
    if (!selectedPackageId) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.selectPackageRequired', {
          defaultValue: 'Please select a care service package first.',
        })
      );
      setStep(1);
      return;
    }

    const trimmedAddress = address.trim();
    const trimmedPhone = phone.trim();
    const trimmedNote = note.trim();

    if (!trimmedAddress) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.addressRequired', {
          defaultValue: 'Please enter the service address.',
        })
      );
      return;
    }

    if (!trimmedPhone) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.phoneRequired', {
          defaultValue: 'Please enter your phone number.',
        })
      );
      return;
    }

    if (!isValidIsoDate(serviceDate)) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.serviceDateInvalid', {
          defaultValue: 'Please enter service date in YYYY-MM-DD format.',
        })
      );
      return;
    }

    if (!isIsoDateMeetingLeadTime(serviceDate, serviceDateLeadHours)) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.serviceDateLeadTimeInvalid', {
          defaultValue:
            'Please choose a date at least {{hours}} hours from now for {{type}} service.',
          hours: serviceDateLeadHours,
          type: isOneTimeSelectedPackage ? 'OneTime' : 'Period',
        })
      );
      return;
    }

    if (!isOneTimeSelectedPackage && selectedScheduleDays.length === 0) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.scheduleDaysRequired', {
          defaultValue: 'Please select at least one service day.',
        })
      );
      return;
    }

    if (preferredShiftId === null) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.preferredShiftRequired', {
          defaultValue: 'Please select your preferred shift.',
        })
      );
      return;
    }

    if (shiftOptions.length === 0) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        shiftsErrorMessage ??
          t('careService.noShiftsAvailable', {
            defaultValue: 'No shifts available at the moment.',
          })
      );
      return;
    }

    const coordinates = await resolveCoordinatesForNurserySearch();
    if (!coordinates) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('careService.locationUnavailable', {
          defaultValue:
            'Unable to determine your current location. Please move to an open area and try again.',
        })
      );
      return;
    }

    const requestPayload: CreateServiceRegistrationRequest = {
      careServicePackageId: selectedPackageId,
      preferredNurseryId: selectedNurseryId,
      serviceDate,
      scheduleDaysOfWeek: isOneTimeSelectedPackage ? [] : [...selectedScheduleDays],
      preferredShiftId,
      address: trimmedAddress,
      phone: trimmedPhone,
      note: trimmedNote.length > 0 ? trimmedNote : undefined,
      latitude: coordinates.lat,
      longitude: coordinates.lng,
    };

    try {
      setIsSubmitting(true);
      await careService.createServiceRegistration(requestPayload);

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('careService.registrationSuccess', {
          defaultValue: 'Service registration submitted successfully.',
        }),
        [
          {
            text: 'OK',
            onPress: () => {
              setStep(1);
              setSelectedPackageId(null);
              setNurseries([]);
              setSelectedNurseryId(null);
              setSelectedScheduleDays([]);
              setNote('');
              setActiveRegistrationStatus(null);
              setActiveTab('registrations');
            },
          },
        ]
      );
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('careService.registrationFailed', {
              defaultValue: 'Unable to submit service registration. Please try again.',
            })
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    address,
    note,
    phone,
    preferredShiftId,
    resolveCoordinatesForNurserySearch,
    selectedNurseryId,
    selectedPackageId,
    selectedScheduleDays,
    serviceDate,
    serviceDateLeadHours,
    isOneTimeSelectedPackage,
    shiftOptions.length,
    shiftsErrorMessage,
    t,
  ]);

  const stepTitle = useMemo(() => {
    if (step === 1) {
      return t('careService.stepPackagesTitle', {
        defaultValue: 'Step 1: Choose a package',
      });
    }

    if (step === 2) {
      return t('careService.stepNurseriesTitle', {
        defaultValue: 'Step 2: Choose a nearby nursery (optional)',
      });
    }

    return t('careService.stepRegistrationTitle', {
      defaultValue: 'Step 3: Complete registration',
    });
  }, [step, t]);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs', { screen: 'Home' });
  }, [navigation]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyStateContainer}>
          <Ionicons name="person-circle-outline" size={82} color={COLORS.gray300} />
          <Text style={styles.emptyStateTitle}>
            {t('common.loginRequiredTitle', { defaultValue: 'Login required' })}
          </Text>
          <Text style={styles.emptyStateDescription}>
            {t('common.loginRequiredMessage', {
              defaultValue: 'Please login to continue.',
            })}
          </Text>
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.primaryActionText}>
              {t('common.login', { defaultValue: 'Login' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryActionText}>
              {t('common.goBack', { defaultValue: 'Go Back' })}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        brandVariant="none"
        containerStyle={styles.header}
        sideWidth={44}
        centerStyle={styles.headerCenter}
        titleStyle={styles.headerTitle}
        title={t('careService.headerTitle', { defaultValue: 'Care service' })}
        left={
          <TouchableOpacity style={styles.headerIconBtn} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.mainTabWrap}>
        <TouchableOpacity
          style={[
            styles.mainTabChip,
            activeTab === 'register' && styles.mainTabChipActive,
          ]}
          onPress={() => setActiveTab('register')}
        >
          <Text
            style={[
              styles.mainTabText,
              activeTab === 'register' && styles.mainTabTextActive,
            ]}
          >
            {t('careService.registerTabLabel', {
              defaultValue: 'Register service',
            })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.mainTabChip,
            activeTab === 'registrations' && styles.mainTabChipActive,
          ]}
          onPress={() => setActiveTab('registrations')}
        >
          <Text
            style={[
              styles.mainTabText,
              activeTab === 'registrations' && styles.mainTabTextActive,
            ]}
          >
            {t('careService.myRegistrationsTabLabel', {
              defaultValue: 'My registrations',
            })}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'register' ? (
        <>
          <View style={styles.flowHeaderCard}>
            <BrandedHeader
              brandVariant="none"
              sideWidth={104}
              containerStyle={styles.flowHeaderBar}
              title={stepTitle}
              titleStyle={styles.flowHeaderTitle}
              left={
                <Text style={styles.flowHeaderLabel}>
                  {t('careService.registerTabLabel', {
                    defaultValue: 'Register service',
                  })}
                </Text>
              }
              right={
                <View style={styles.flowProgressBadge}>
                  <Text style={styles.flowProgressText}>{`${step}/3`}</Text>
                </View>
              }
            />
          </View>

          <View style={styles.stepperRow}>
            {[1, 2, 3].map((item) => {
              const stepValue = item as CareStep;
              const isActive = step === stepValue;
              const isCompleted = step > stepValue;

              return (
                <View
                  key={stepValue}
                  style={[
                    styles.stepBadge,
                    isActive && styles.stepBadgeActive,
                    isCompleted && styles.stepBadgeCompleted,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepBadgeText,
                      (isActive || isCompleted) && styles.stepBadgeTextActive,
                    ]}
                  >
                    {stepValue}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.registerContentWrap}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[
                styles.contentContainer,
                (step === 1 || step === 2) && {
                  paddingBottom: Math.max(SPACING['5xl'], insets.bottom + 112),
                },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  colors={[COLORS.primary]}
                  tintColor={COLORS.primary}
                />
              }
            >

            {step === 1 ? (
              <View style={styles.sectionCard}>
                {isLoadingPackages ? (
                  <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  </View>
                ) : packages.length === 0 ? (
                  <Text style={styles.helperText}>
                    {t('careService.noPackages', {
                      defaultValue: 'No care service package found.',
                    })}
                  </Text>
                ) : (
                  <View style={styles.optionList}>
                    {packages.map((item) => {
                      const isSelected = selectedPackageId === item.id;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.optionCard,
                            isSelected && styles.optionCardSelected,
                          ]}
                          onPress={() => {
                            setSelectedPackageId(item.id);
                            setSelectedNurseryId(null);
                            setNurseries([]);
                          }}
                          activeOpacity={0.9}
                        >
                          <View style={styles.optionHeaderRow}>
                            <Text style={styles.optionTitle}>{item.name}</Text>
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={20}
                              color={isSelected ? COLORS.primary : COLORS.gray500}
                            />
                          </View>
                          <Text style={styles.optionDescription}>{item.description}</Text>
                          <Text style={styles.optionMeta}>
                            {t('careService.packagePrice', {
                              defaultValue: 'Price: {{value}}',
                              value: formatCurrency(item.unitPrice),
                            })}
                          </Text>
                          <Text style={styles.optionMeta}>
                            {t('careService.packageDuration', {
                              defaultValue: 'Duration: {{days}} days',
                              days: item.durationDays,
                            })}
                          </Text>
                          <Text style={styles.optionMeta}>
                            {`${t('careService.packageVisitPerWeek', {
                              defaultValue: 'Visits/week',
                            })}: ${
                              typeof item.visitPerWeek === 'number' ? item.visitPerWeek : '-'
                            }`}
                          </Text>
                          <TouchableOpacity
                            style={styles.inlinePackageDetailButton}
                            onPress={(event) => {
                              event.stopPropagation();
                              handleOpenPackageDetail(item.id);
                            }}
                          >
                            <Text style={styles.inlinePackageDetailButtonText}>
                              {t('careService.viewPackageDetailButton', {
                                defaultValue: 'View package detail',
                              })}
                            </Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

        {step === 2 ? (
          <View style={styles.sectionCard}>
            {selectedPackage ? (
              <View style={styles.selectedInfoWrap}>
                <Text style={styles.selectedInfoLabel}>
                  {t('careService.selectedPackage', {
                    defaultValue: 'Selected package',
                  })}
                </Text>
                <Text style={styles.selectedInfoValue}>{selectedPackage.name}</Text>
              </View>
            ) : null}

            <Text style={styles.nurseryOptionalHint}>
              {t('careService.nurseryOptionalHint', {
                defaultValue:
                  'Selecting a preferred nursery is optional. If skipped, the system will auto-select a suitable nursery.',
              })}
            </Text>

            

            <Text style={styles.inputLabel}>
              {t('careService.addressLabel', { defaultValue: 'Service address' })}
            </Text>
            <TextInput
              style={[styles.input, styles.addressInput]}
              ref={addressInputRef}
              value={address}
              onChangeText={handleChangeAddress}
              onFocus={() => setIsAddressFocused(true)}
              onBlur={() => {
                void handleAddressBlur();
              }}
              placeholder={t('careService.addressPlaceholder', {
                defaultValue: 'Enter your address',
              })}
              placeholderTextColor={COLORS.gray500}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {shouldShowAddressSuggestionPanel ? (
              <View style={styles.addressSuggestionList}>
                {isLoadingAddressSuggestions ? (
                  <View style={styles.addressSuggestionStateRow}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.addressSuggestionStateText}>
                      {t('careService.addressSuggestionLoading', {
                        defaultValue: 'Searching address suggestions...',
                      })}
                    </Text>
                  </View>
                ) : addressSuggestions.length > 0 ? (
                  addressSuggestions.map((item, index) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.addressSuggestionItem,
                        index === addressSuggestions.length - 1 &&
                          styles.addressSuggestionItemLast,
                      ]}
                      activeOpacity={0.8}
                      onPressIn={() => {
                        isSelectingAddressSuggestionRef.current = true;
                      }}
                      onPress={() => handleSelectAddressSuggestion(item)}
                    >
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color={COLORS.primary}
                        style={styles.addressSuggestionIcon}
                      />
                      <Text style={styles.addressSuggestionText} numberOfLines={2}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : hasAddressSuggestionQueryFinished ? (
                  <View style={styles.addressSuggestionStateRow}>
                    <Text style={styles.addressSuggestionStateText}>
                      {t('careService.addressSuggestionEmpty', {
                        defaultValue: 'No address suggestions found.',
                      })}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.addressSuggestionStateRow} />
                )}
              </View>
            ) : null}

            <View style={styles.coordinateInfoWrap}>
              <Text style={styles.coordinateInfoText}>
                {t('careService.latitudeLabel', {
                  defaultValue: 'Latitude: {{value}}',
                  value: formatCoordinate(latitude),
                })}
              </Text>
              <Text style={styles.coordinateInfoText}>
                {t('careService.longitudeLabel', {
                  defaultValue: 'Longitude: {{value}}',
                  value: formatCoordinate(longitude),
                })}
              </Text>
            </View>

            <View style={styles.secondaryActionRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  (isResolvingLocation || isGeocodingAddress) && styles.disabledActionButton,
                ]}
                onPress={() => void handleUseCurrentLocation()}
                disabled={isResolvingLocation || isGeocodingAddress}
              >
                {isResolvingLocation ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="locate-outline" size={16} color={COLORS.primary} />
                )}
                <Text style={styles.secondaryActionText}>
                  {isResolvingLocation
                    ? t('careService.locationLoading', {
                        defaultValue: 'Getting current location...',
                      })
                    : t('careService.useCurrentLocation', {
                        defaultValue: 'Use current location',
                      })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  (isLoadingNurseries || isGeocodingAddress) && styles.disabledActionButton,
                ]}
                onPress={() => void handleUseProfileAddress()}
                disabled={isLoadingNurseries || isGeocodingAddress}
              >
                {isGeocodingAddress ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="person-outline" size={16} color={COLORS.primary} />
                )}
                <Text style={styles.secondaryActionText}>
                  {t('careService.useProfileAddress', {
                    defaultValue: 'Use profile address',
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            

            <TouchableOpacity
              style={styles.stepTwoSkipButton}
              onPress={handleSkipNurseryPreference}
              disabled={isLoadingNurseries || isGeocodingAddress}
            >
              <Ionicons name="play-skip-forward-outline" size={16} color={COLORS.primary} />
              <Text style={styles.stepTwoSkipButtonText}>
                {t('careService.skipNurseryButton', {
                  defaultValue: 'Skip nursery preference',
                })}
              </Text>
            </TouchableOpacity>

            {isLoadingNurseries ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : nurseries.length === 0 ? (
              <Text style={styles.helperText}>
                {t('careService.noNurseriesForPackage', {
                  defaultValue: 'No nurseries found for the selected package.',
                })}
              </Text>
            ) : (
              <View style={styles.optionList}>
                {nurseries.map((nursery) => {
                  const isSelected = selectedNurseryId === nursery.id;

                  return (
                    <TouchableOpacity
                      key={nursery.id}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => handleSelectNursery(nursery)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.optionHeaderRow}>
                        <Text style={styles.optionTitle}>{nursery.name}</Text>
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? COLORS.primary : COLORS.gray500}
                        />
                      </View>
                      <Text style={styles.optionDescription}>{nursery.address}</Text>
                      <Text style={styles.optionMeta}>
                        {t('careService.nurseryPhone', {
                          defaultValue: 'Phone: {{phone}}',
                          phone: nursery.phone ?? '--',
                        })}
                      </Text>
                      {typeof nursery.distanceKm === 'number' ? (
                        <Text style={styles.optionMeta}>
                          {t('careService.nurseryDistance', {
                            defaultValue: 'Distance: {{distance}}',
                            distance: formatDistance(nursery.distanceKm),
                          })}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.sectionCard}>
            {selectedPackage ? (
              <View style={styles.selectedInfoWrap}>
                <Text style={styles.selectedInfoLabel}>
                  {t('careService.selectedPackage', {
                    defaultValue: 'Selected package',
                  })}
                </Text>
                <Text style={styles.selectedInfoValue}>{selectedPackage.name}</Text>
                <Text style={styles.optionMeta}>
                  {`${t('careService.packageVisitPerWeek', {
                    defaultValue: 'Visits/week',
                  })}: ${
                    typeof selectedPackage.visitPerWeek === 'number'
                      ? selectedPackage.visitPerWeek
                      : '-'
                  }`}
                </Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>
              {t('careService.serviceDateLabel', { defaultValue: 'Service date' })}
            </Text>
            <TouchableOpacity
              style={[styles.input, styles.datePickerTrigger]}
              onPress={handleOpenServiceDatePicker}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.datePickerTriggerText,
                  !isValidIsoDate(serviceDate) && styles.datePickerPlaceholderText,
                ]}
              >
                {isValidIsoDate(serviceDate)
                  ? formatDisplayDate(serviceDate)
                  : t('careService.serviceDatePlaceholder', {
                      defaultValue: 'YYYY-MM-DD',
                    })}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>

            {Platform.OS === 'ios' && isShowingServiceDatePicker ? (
              <View style={styles.iosDatePickerWrap}>
                <DateTimePicker
                  value={pickerServiceDateValue}
                  mode="date"
                  display="spinner"
                  minimumDate={minimumServiceDate}
                  onChange={(_, selectedDate) => {
                    if (!selectedDate) {
                      return;
                    }

                    handleSelectServiceDate(selectedDate);
                  }}
                />
                <TouchableOpacity
                  style={styles.iosDatePickerDoneButton}
                  onPress={() => setIsShowingServiceDatePicker(false)}
                >
                  <Text style={styles.iosDatePickerDoneText}>
                    {t('common.done', { defaultValue: 'Done' })}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={styles.serviceDateLeadNote}>
              {t('careService.serviceDateLeadTimeNote', {
                defaultValue:
                  "CareService with type 'OneTime' needs date at least {{oneTimeHours}} hours from now; 'Period' needs at least {{periodHours}} hours.",
                oneTimeHours: ONE_TIME_MIN_LEAD_HOURS,
                periodHours: PERIOD_MIN_LEAD_HOURS,
              })}
            </Text>

            {!isOneTimeSelectedPackage ? (
              <>
                <Text style={[styles.inputLabel, styles.topSpacing]}>
                  {t('careService.scheduleDaysLabel', {
                    defaultValue: 'Schedule days',
                  })}
                </Text>
                <View style={styles.chipWrap}>
                  {scheduleDayOptions.map((dayOption) => {
                    const isSelected = selectedScheduleDays.includes(dayOption.value);

                    return (
                      <TouchableOpacity
                        key={dayOption.value}
                        style={[
                          styles.dayChip,
                          isSelected && styles.dayChipSelected,
                        ]}
                        onPress={() => handleToggleScheduleDay(dayOption.value)}
                      >
                        <Text
                          style={[
                            styles.dayChipText,
                            isSelected && styles.dayChipTextSelected,
                          ]}
                        >
                          {dayOption.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={[styles.inputLabel, styles.topSpacing]}>
              {t('careService.shiftLabel', { defaultValue: 'Preferred shift' })}
            </Text>
            {isLoadingShifts ? (
              <View style={styles.inlineLoaderRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.inlineLoaderText}>
                  {t('careService.shiftsLoading', {
                    defaultValue: 'Loading shifts...',
                  })}
                </Text>
              </View>
            ) : shiftOptions.length === 0 ? (
              <View style={styles.topSpacing}>
                <Text style={styles.warningMeta}>
                  {shiftsErrorMessage ??
                    t('careService.noShiftsAvailable', {
                      defaultValue: 'No shifts available at the moment.',
                    })}
                </Text>
                <TouchableOpacity
                  style={[styles.secondaryActionButton, styles.singleSecondaryActionButton]}
                  onPress={() => void loadServiceFlow()}
                  disabled={isSubmitting || isLoadingShifts}
                >
                  <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.secondaryActionText}>
                    {t('careService.reloadShiftsButton', {
                      defaultValue: 'Reload shifts',
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.chipWrap}>
                {shiftOptions.map((shiftOption) => {
                  const isSelected = preferredShiftId === shiftOption.id;

                  return (
                    <TouchableOpacity
                      key={shiftOption.id}
                      style={[styles.shiftChip, isSelected && styles.shiftChipSelected]}
                      onPress={() => setPreferredShiftId(shiftOption.id)}
                    >
                      <Text
                        style={[
                          styles.shiftChipText,
                          isSelected && styles.shiftChipTextSelected,
                        ]}
                      >
                        {shiftOption.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={[styles.inputLabel, styles.topSpacing]}>
              {t('careService.phoneLabel', { defaultValue: 'Phone number' })}
            </Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('careService.phonePlaceholder', {
                defaultValue: 'Enter your phone number',
              })}
              placeholderTextColor={COLORS.gray500}
              keyboardType="phone-pad"
            />

            <Text style={[styles.inputLabel, styles.topSpacing]}>
              {t('careService.noteLabel', { defaultValue: 'Note (optional)' })}
            </Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              placeholder={t('careService.notePlaceholder', {
                defaultValue: 'Add any additional note',
              })}
              placeholderTextColor={COLORS.gray500}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.ghostActionButton}
                onPress={() => setStep(2)}
                disabled={isSubmitting}
              >
                <Text style={styles.ghostActionText}>
                  {t('careService.backButton', { defaultValue: 'Back' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  isSubmitting && styles.disabledActionButton,
                  styles.flexAction,
                ]}
                onPress={() => void handleSubmitRegistration()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryActionText}>
                    {t('careService.submitButton', { defaultValue: 'Submit registration' })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
            </ScrollView>

            {step === 1 || step === 2 ? (
              <View
                key={`fixed-action-bar-${step}`}
                style={[
                  styles.fixedActionBar,
                  {
                    paddingBottom: Math.max(SPACING.sm, insets.bottom + SPACING.xs),
                  },
                ]}
              >
                {step === 2 ? (
                  <TouchableOpacity
                    style={styles.ghostActionButton}
                    onPress={() => setStep(1)}
                    disabled={isLoadingNurseries}
                  >
                    <Text style={styles.ghostActionText}>
                      {t('careService.backButton', { defaultValue: 'Back' })}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.primaryActionButton,
                    step === 1 && styles.fullWidthAction,
                    step === 2 && styles.stepTwoContinueAction,
                    step === 1 && !selectedPackageId && styles.disabledActionButton,
                  ]}
                  onPress={step === 1 ? handleContinueFromPackages : handleContinueFromNurseries}
                  disabled={step === 1 ? !selectedPackageId : false}
                >
                  <Text style={styles.primaryActionText}>
                    {t('careService.continueButton', { defaultValue: 'Continue' })}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          <View style={styles.sectionCard}>
            <View style={styles.registrationsHeaderRow}>
              <Text style={styles.stepTitle}>
                {t('careService.myRegistrationsTitle', {
                  defaultValue: 'My service registrations',
                })}
              </Text>
              <Text style={styles.registrationsCountText}>
                {t('careService.myRegistrationsCount', {
                  defaultValue: '{{count}} items',
                  count: registrationTotalCount,
                })}
              </Text>
            </View>

            <View style={styles.filterWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
              >
                {registrationStatusOptions.map((statusOption) => {
                  const isActive = activeRegistrationStatus === statusOption.statusCode;

                  return (
                    <TouchableOpacity
                      key={statusOption.key}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => setActiveRegistrationStatus(statusOption.statusCode)}
                      disabled={isLoadingRegistrations}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          isActive && styles.filterChipTextActive,
                        ]}
                      >
                        {statusOption.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {isLoadingRegistrations ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : registrationsErrorMessage ? (
              <View style={styles.registrationStateWrap}>
                <Text style={styles.warningMeta}>{registrationsErrorMessage}</Text>
                <TouchableOpacity
                  style={[styles.secondaryActionButton, styles.singleSecondaryActionButton]}
                  onPress={handleRetryRegistrations}
                >
                  <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.secondaryActionText}>
                    {t('common.retry', { defaultValue: 'Retry' })}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : registrations.length === 0 ? (
              <View style={styles.registrationStateWrap}>
                <Text style={styles.helperText}>
                  {t('careService.myRegistrationsEmpty', {
                    defaultValue: 'You do not have any service registration yet.',
                  })}
                </Text>
              </View>
            ) : (
              <View style={styles.registrationList}>
                {registrations.map((registration) => {
                  const packageId =
                    registration.nurseryCareService?.careServicePackage?.id ?? null;
                  const statusColors = getRegistrationStatusColors(
                    registration.statusName ?? ''
                  );

                  return (
                    <View key={registration.id} style={styles.registrationCard}>
                      <View style={styles.registrationTopRow}>
                        <Text style={styles.registrationCode}>#{registration.id}</Text>
                        <View
                          style={[
                            styles.registrationStatusBadge,
                            {
                              backgroundColor: statusColors.backgroundColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.registrationStatusText,
                              {
                                color: statusColors.textColor,
                              },
                            ]}
                          >
                            {registration.statusName}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.registrationMetaText}>
                        {t('careService.registrationServiceDateLabel', {
                          defaultValue: 'Service date',
                        })}
                        : {formatDisplayDate(registration.serviceDate)}
                      </Text>
                      <Text style={styles.registrationMetaText}>
                        {t('careService.registrationCreatedAtLabel', {
                          defaultValue: 'Created at',
                        })}
                        : {formatDisplayDateTime(registration.createdAt)}
                      </Text>
                      <Text style={styles.registrationPackageName}>
                        {registration.nurseryCareService?.careServicePackage?.name ?? '-'}
                      </Text>
                      <Text style={styles.registrationMetaText}>
                        {t('careService.registrationNurseryLabel', {
                          defaultValue: 'Nursery',
                        })}
                        : {registration.nurseryCareService?.nurseryName ?? '-'}
                      </Text>
                      <Text style={styles.registrationMetaText}>
                        {t('careService.registrationPhoneLabel', {
                          defaultValue: 'Phone',
                        })}
                        : {registration.phone}
                      </Text>

                      <View style={styles.registrationActionRow}>
                        <TouchableOpacity
                          style={[styles.registrationActionButton, styles.registrationActionPrimary]}
                          onPress={() => handleOpenRegistrationDetail(registration.id)}
                        >
                          <Text style={styles.registrationActionPrimaryText}>
                            {t('careService.viewRegistrationDetailButton', {
                              defaultValue: 'View registration detail',
                            })}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.registrationActionButton,
                            styles.registrationActionSecondary,
                            (typeof packageId !== 'number' || packageId <= 0) &&
                              styles.disabledActionButton,
                          ]}
                          onPress={() => handleOpenPackageDetail(packageId)}
                          disabled={typeof packageId !== 'number' || packageId <= 0}
                        >
                          <Text style={styles.registrationActionSecondaryText}>
                            {t('careService.viewPackageDetailButton', {
                              defaultValue: 'View package detail',
                            })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.paginationRowWrap}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  (!registrationHasPreviousPage || isLoadingRegistrations) &&
                    styles.paginationButtonDisabled,
                ]}
                onPress={handlePreviousRegistrationsPage}
                disabled={!registrationHasPreviousPage || isLoadingRegistrations}
              >
                <Ionicons name="chevron-back" size={16} color={COLORS.textPrimary} />
                <Text style={styles.paginationButtonText}>
                  {t('careService.paginationPrevious', {
                    defaultValue: 'Previous',
                  })}
                </Text>
              </TouchableOpacity>

              <Text style={styles.paginationMetaText}>
                {t('careService.paginationSummary', {
                  defaultValue: 'Page {{current}}/{{total}}',
                  current: registrationPageNumber,
                  total: registrationTotalPages,
                })}
              </Text>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  (!registrationHasNextPage || isLoadingRegistrations) &&
                    styles.paginationButtonDisabled,
                ]}
                onPress={handleNextRegistrationsPage}
                disabled={!registrationHasNextPage || isLoadingRegistrations}
              >
                <Text style={styles.paginationButtonText}>
                  {t('careService.paginationNext', {
                    defaultValue: 'Next',
                  })}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textPrimary} />
              </TouchableOpacity>
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
    height: 56,
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
  mainTabWrap: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  mainTabChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  mainTabChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  mainTabText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  mainTabTextActive: {
    color: COLORS.white,
  },
  flowHeaderCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  flowHeaderBar: {
    paddingVertical: 0,
  },
  flowHeaderLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  flowProgressBadge: {
    minWidth: 44,
    height: 24,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  flowProgressText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  flowHeaderTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    maxWidth: '100%',
    textAlign: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray200,
  },
  stepBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  stepBadgeCompleted: {
    backgroundColor: COLORS.success,
  },
  stepBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  stepBadgeTextActive: {
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  registerContentWrap: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['4xl'],
  },
  contentContainerWithFixedActions: {
    paddingBottom: SPACING['2xl'],
  },
  stepTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  loaderWrap: {
    paddingVertical: SPACING['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  registrationsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  registrationsCountText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterWrap: {
    marginBottom: SPACING.md,
  },
  filterScrollContent: {
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  filterChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  optionList: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  registrationStateWrap: {
    marginBottom: SPACING.md,
  },
  registrationList: {
    gap: SPACING.md,
  },
  registrationCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  registrationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  registrationCode: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  registrationStatusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  registrationStatusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  registrationMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  registrationPackageName: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  registrationActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  registrationActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  registrationActionPrimary: {
    backgroundColor: COLORS.primary,
  },
  registrationActionPrimaryText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    fontWeight: '700',
    textAlign: 'center',
  },
  registrationActionSecondary: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  registrationActionSecondaryText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  paginationRowWrap: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  paginationButton: {
    minHeight: 36,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  paginationMetaText: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  optionCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  optionCardDisabled: {
    opacity: 0.7,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  optionTitle: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  optionDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  optionMeta: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  inlinePackageDetailButton: {
    marginTop: SPACING.xs,
    minHeight: 36,
    width: '100%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  inlinePackageDetailButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  warningMeta: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.warning,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  primaryActionButton: {
    height: 46,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  primaryActionText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    paddingHorizontal: SPACING.md,
  },
  disabledActionButton: {
    opacity: 0.6,
  },
  selectedInfoWrap: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
  },
  selectedInfoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  selectedInfoValue: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  nurseryOptionalHint: {
    marginBottom: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  stepTwoSkipButton: {
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  stepTwoSkipButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  resetNurseriesButton: {
    marginBottom: SPACING.md,
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  resetNurseriesButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerTriggerText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  datePickerPlaceholderText: {
    color: COLORS.gray500,
    fontWeight: '400',
  },
  serviceDateLeadNote: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  iosDatePickerWrap: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  iosDatePickerDoneButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.secondaryLight,
  },
  iosDatePickerDoneText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  addressInput: {
    minHeight: 80,
  },
  addressSuggestionList: {
    marginTop: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    maxHeight: 220,
    overflow: 'hidden',
  },
  addressSuggestionStateRow: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  addressSuggestionStateText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  addressSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  addressSuggestionItemLast: {
    borderBottomWidth: 0,
  },
  addressSuggestionIcon: {
    marginTop: 2,
  },
  addressSuggestionText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
  },
  noteInput: {
    minHeight: 100,
  },
  coordinateInfoWrap: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
    gap: SPACING.xs,
  },
  coordinateInfoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
  },
  secondaryActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  secondaryActionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  singleSecondaryActionButton: {
    marginTop: SPACING.sm,
  },
  inlineLoaderRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  inlineLoaderText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  actionRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  fixedActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  ghostActionButton: {
    minHeight: 46,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    flexShrink: 0,
  },
  ghostActionText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  flexAction: {
    flex: 1,
  },
  stepTwoContinueAction: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  fullWidthAction: {
    width: '100%',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
  },
  dayChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  dayChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  dayChipTextSelected: {
    color: COLORS.primary,
  },
  shiftChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
  },
  shiftChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  shiftChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  shiftChipTextSelected: {
    color: COLORS.primary,
  },
  topSpacing: {
    marginTop: SPACING.md,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING['3xl'],
    gap: SPACING.sm,
  },
  emptyStateTitle: {
    fontSize: FONTS.sizes['2xl'],
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  emptyStateDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
});
