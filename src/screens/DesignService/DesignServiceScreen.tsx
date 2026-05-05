import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { API, COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { designService } from '../../services';
import { useAuthStore, useEnumStore } from '../../stores';
import {
  DesignRegistration,
  DesignTemplate,
  DesignTemplateTier,
  DesignTemplateTierNursery,
  RootStackParamList,
} from '../../types';
import {
  formatVietnamDateTime,
  getDesignRegistrationStatusPalette,
  getDesignRoomTypeLabel,
  getDesignStyleLabel,
  notify,
  resolveImageUri,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DesignService'>;
type DesignCustomerTab = 'register' | 'registrations';
type DesignStep = 1 | 2 | 3;

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

type NominatimSearchItem = {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
};

const PAGINATION_SIZE = 10;
const ADDRESS_SUGGESTION_MIN_LENGTH = 3;
const ADDRESS_SUGGESTION_LIMIT = 5;
const ADDRESS_SUGGESTION_DEBOUNCE_MS = 350;
const ADDRESS_SUGGESTION_REQUEST_TIMEOUT_MS = 7000;

const resolveBackendImageUri = (rawValue: string | null | undefined): string | null => {
  const resolved = resolveImageUri(rawValue);
  if (!resolved) {
    return null;
  }

  if (/^https?:\/\//i.test(resolved)) {
    return resolved;
  }

  const host = API.BASE_URL.replace(/\/api\/?$/i, '');
  const normalizedPath = resolved.startsWith('/') ? resolved : `/${resolved}`;
  return `${host}${normalizedPath}`;
};

const formatCurrency = (amount: number): string => `${(amount || 0).toLocaleString('vi-VN')} VND`;

const formatRoomTypes = (roomTypes: number[]): string =>
  roomTypes.map((roomType) => getDesignRoomTypeLabel(roomType)).join(', ');

const buildStatusOptions = (
  values: Array<{ value: string | number; name: string }>,
  allLabel: string
): Array<{ key: string; value: number | null; label: string }> => {
  const dynamicOptions = values
    .map((item) => {
      const numericValue =
        typeof item.value === 'number'
          ? item.value
          : typeof item.value === 'string' && /^\d+$/.test(item.value.trim())
          ? Number(item.value.trim())
          : null;

      if (numericValue === null) {
        return null;
      }

      return {
        key: `status-${numericValue}`,
        value: numericValue,
        label: item.name,
      };
    })
    .filter((item): item is { key: string; value: number; label: string } => Boolean(item));

  return [{ key: 'all', value: null, label: allLabel }, ...dynamicOptions];
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

const formatCoordinate = (coordinate: number | null): string => {
  if (coordinate === null) {
    return '-';
  }

  return coordinate.toFixed(6);
};

export default function DesignServiceScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loadEnumResource = useEnumStore((state) => state.loadResource);
  const getEnumValues = useEnumStore((state) => state.getEnumValues);

  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const initialAddress =
    typeof user?.address === 'string' ? user.address : user?.address?.fullAddress ?? '';
  const initialLatitude = normalizeCoordinate(user?.latitude);
  const initialLongitude = normalizeCoordinate(user?.longitude);
  const initialPhone = user?.phoneNumber ?? user?.phone ?? '';

  const [activeTab, setActiveTab] = useState<DesignCustomerTab>('register');
  const [step, setStep] = useState<DesignStep>(1);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [tierItemLabels, setTierItemLabels] = useState<Record<number, string[]>>({});

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [selectedTierDetail, setSelectedTierDetail] = useState<DesignTemplateTier | null>(null);
  const [tierNurseries, setTierNurseries] = useState<DesignTemplateTierNursery[]>([]);
  const [selectedNurseryId, setSelectedNurseryId] = useState<number | null>(null);
  const [isLoadingTierDetail, setIsLoadingTierDetail] = useState(false);

  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState<number | null>(initialLatitude);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude);
  const [phone, setPhone] = useState(initialPhone);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isLoadingAddressSuggestions, setIsLoadingAddressSuggestions] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [hasAddressSuggestionQueryFinished, setHasAddressSuggestionQueryFinished] =
    useState(false);

  const [registrations, setRegistrations] = useState<DesignRegistration[]>([]);
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(false);
  const [isRefreshingRegistrations, setIsRefreshingRegistrations] = useState(false);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);
  const [registrationPage, setRegistrationPage] = useState(1);
  const [registrationTotalPages, setRegistrationTotalPages] = useState(1);
  const [registrationHasPrevious, setRegistrationHasPrevious] = useState(false);
  const [registrationHasNext, setRegistrationHasNext] = useState(false);
  const [registrationTotalCount, setRegistrationTotalCount] = useState(0);
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState<number | null>(null);

  const lastGeocodedAddressRef = useRef<string>(
    initialLatitude !== null && initialLongitude !== null ? initialAddress.trim() : ''
  );
  const addressSuggestionRequestIdRef = useRef(0);
  const isSelectingAddressSuggestionRef = useRef(false);

  useEffect(() => {
    void loadEnumResource('design-flow');
  }, [loadEnumResource]);

  const statusOptions = useMemo(
    () =>
      buildStatusOptions(
        getEnumValues(['DesignRegistrationStatus']),
        t('designService.registrationsStatusAll', { defaultValue: 'All' })
      ),
    [getEnumValues, t]
  );

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('MainTabs', { screen: 'ServiceTab' });
  }, [navigation]);

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoadingTemplates(true);
      setTemplatesError(null);
      const payload = await designService.getDesignTemplates();
      setTemplates(payload);

      void Promise.all(
        payload.flatMap((template) =>
          template.tiers.map(async (tier) => {
            const labels = await designService.resolveTierItemLabels(tier.items ?? []);
            setTierItemLabels((current) => ({
              ...current,
              [tier.id]: labels,
            }));
          })
        )
      );
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      setTemplatesError(
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('designService.templatesLoadFailed', {
              defaultValue: 'Unable to load design templates. Please try again.',
            })
      );
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [t]);

  const loadRegistrations = useCallback(
    async (pageNumber: number, status: number | null, refresh?: boolean) => {
      if (!isAuthenticated) {
        setRegistrations([]);
        setRegistrationTotalCount(0);
        return;
      }

      try {
        if (refresh) {
          setIsRefreshingRegistrations(true);
        } else {
          setIsLoadingRegistrations(true);
        }
        setRegistrationsError(null);

        const payload = await designService.getMyDesignRegistrations({
          PageNumber: pageNumber,
          PageSize: PAGINATION_SIZE,
          status: status ?? undefined,
        });

        setRegistrations(payload.items ?? []);
        setRegistrationPage(payload.pageNumber ?? pageNumber);
        setRegistrationTotalPages(payload.totalPages ?? 1);
        setRegistrationHasPrevious(payload.hasPrevious ?? false);
        setRegistrationHasNext(payload.hasNext ?? false);
        setRegistrationTotalCount(payload.totalCount ?? 0);
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        setRegistrationsError(
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('designService.registrationsLoadFailed', {
                defaultValue: 'Unable to load your design registrations. Please try again.',
              })
        );
      } finally {
        setIsLoadingRegistrations(false);
        setIsRefreshingRegistrations(false);
      }
    },
    [isAuthenticated, t]
  );

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'registrations') {
        void loadRegistrations(registrationPage, registrationStatusFilter, true);
      }
    }, [activeTab, loadRegistrations, registrationPage, registrationStatusFilter])
  );

  useEffect(() => {
    if (activeTab !== 'registrations') {
      return;
    }

    void loadRegistrations(registrationPage, registrationStatusFilter);
  }, [activeTab, loadRegistrations, registrationPage, registrationStatusFilter]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  );

  const stepTitle = useMemo(() => {
    if (step === 1) {
      return t('designService.stepTemplateTitle', {
        defaultValue: 'Step 1: Choose template',
      });
    }

    if (step === 2) {
      return t('designService.stepTierTitle', {
        defaultValue: 'Step 2: Choose tier',
      });
    }

    return t('designService.stepInformationTitle', {
      defaultValue: 'Step 3: Enter your information',
    });
  }, [step, t]);

  const handleSelectTemplate = useCallback((templateId: number) => {
    setSelectedTemplateId(templateId);
    setSelectedTierId(null);
    setSelectedTierDetail(null);
    setTierNurseries([]);
    setSelectedNurseryId(null);
    setStep(1);
  }, []);

  const handleSelectTier = useCallback(
    async (tierId: number) => {
      try {
        setSelectedTierId(tierId);
        setSelectedNurseryId(null);
        setIsLoadingTierDetail(true);
        const [tierDetail, nurseries] = await Promise.all([
          designService.getDesignTemplateTierDetail(tierId),
          designService.getDesignTemplateTierNurseries(tierId),
        ]);
        setSelectedTierDetail(tierDetail);
        setTierNurseries(nurseries);

        if (!tierItemLabels[tierId]) {
          const labels = await designService.resolveTierItemLabels(tierDetail.items ?? []);
          setTierItemLabels((current) => ({
            ...current,
            [tierId]: labels,
          }));
        }
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message:
            typeof apiMessage === 'string' && apiMessage.trim().length > 0
              ? apiMessage
              : t('designService.tierDetailLoadFailed', {
                  defaultValue: 'Unable to load tier detail. Please try again.',
                }),
        });
      } finally {
        setIsLoadingTierDetail(false);
      }
    },
    [t, tierItemLabels]
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

  const resolveCoordinatesFromAddress = useCallback(async (rawAddress: string) => {
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
      } as ResolvedCoordinates;
    } catch {
      return null;
    }
  }, []);

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
  }, [address, isGeocodingAddress, isResolvingLocation, resolveCoordinatesFromAddress]);

  const handleUseCurrentLocation = useCallback(async () => {
    if (isResolvingLocation || isSubmitting || isGeocodingAddress) {
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
  }, [isGeocodingAddress, isResolvingLocation, isSubmitting, resolveAddressFromCoordinates, t]);

  const handleUseProfileAddress = useCallback(async () => {
    if (!initialAddress) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('designService.profileAddressMissing', {
          defaultValue: 'No profile address available in your profile.',
        })
      );
      return;
    }

    setAddress(initialAddress);
    setAddressSuggestions([]);
    setIsAddressFocused(false);
    lastGeocodedAddressRef.current = initialAddress.trim();

    if (initialLatitude !== null && initialLongitude !== null) {
      setLatitude(initialLatitude);
      setLongitude(initialLongitude);
      return;
    }

    try {
      setIsGeocodingAddress(true);
      const resolvedCoordinates = await resolveCoordinatesFromAddress(initialAddress);
      if (resolvedCoordinates) {
        setLatitude(resolvedCoordinates.lat);
        setLongitude(resolvedCoordinates.lng);
      }
    } finally {
      setIsGeocodingAddress(false);
    }
  }, [initialAddress, initialLatitude, initialLongitude, resolveCoordinatesFromAddress, t]);

  const resolveCoordinatesForSubmit = useCallback(async () => {
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

    if (!trimmedAddress) {
      return null;
    }

    const resolvedCoordinates = await resolveCoordinatesFromAddress(trimmedAddress);
    if (!resolvedCoordinates) {
      return null;
    }

    setLatitude(resolvedCoordinates.lat);
    setLongitude(resolvedCoordinates.lng);
    lastGeocodedAddressRef.current = trimmedAddress;

    return resolvedCoordinates;
  }, [address, latitude, longitude, resolveCoordinatesFromAddress]);

  const resetCreateFlow = useCallback(() => {
    setStep(1);
    setSelectedTemplateId(null);
    setSelectedTierId(null);
    setSelectedTierDetail(null);
    setTierNurseries([]);
    setSelectedNurseryId(null);
    setAddress(initialAddress);
    setLatitude(initialLatitude);
    setLongitude(initialLongitude);
    setPhone(initialPhone);
    setNote('');
    setIsAddressFocused(false);
    setAddressSuggestions([]);
    setHasAddressSuggestionQueryFinished(false);
    lastGeocodedAddressRef.current =
      initialLatitude !== null && initialLongitude !== null ? initialAddress.trim() : '';
  }, [initialAddress, initialLatitude, initialLongitude, initialPhone]);

  const handleSubmitRegistration = useCallback(async () => {
    if (!isAuthenticated) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('common.loginRequiredMessage', { defaultValue: 'Please login to continue.' })
      );
      return;
    }

    if (!selectedTierDetail || !selectedTierId) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('designService.tierRequired', {
          defaultValue: 'Please select a design tier first.',
        }),
      });
      return;
    }

    const trimmedAddress = address.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedAddress) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('designService.addressRequired', {
          defaultValue: 'Please enter your address.',
        }),
      });
      return;
    }

    if (!trimmedPhone) {
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message: t('designService.phoneRequired', {
          defaultValue: 'Please enter your phone number.',
        }),
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const resolvedCoordinates = await resolveCoordinatesForSubmit();
      if (!resolvedCoordinates) {
        notify({
          title: t('common.error', { defaultValue: 'Error' }),
          message: t('designService.coordinatesResolveFailed', {
            defaultValue: 'Unable to resolve coordinates from the selected address.',
          }),
        });
        return;
      }

      const payload = await designService.createDesignRegistration({
        nurseryId: selectedNurseryId,
        designTemplateTierId: selectedTierId,
        latitude: resolvedCoordinates.lat,
        longitude: resolvedCoordinates.lng,
        address: trimmedAddress,
        phone: trimmedPhone,
        customerNote: note.trim() || undefined,
      });

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('designService.registrationSubmittedMessage', {
          defaultValue: 'Design registration submitted.\nTotal: {{total}}\nDeposit: {{deposit}}',
          total: formatCurrency(payload.totalPrice),
          deposit: formatCurrency(payload.depositAmount),
        }),
        [
          {
            text: t('designService.viewDetailAction', { defaultValue: 'View detail' }),
            onPress: () => {
              navigation.navigate('DesignRegistrationDetail', {
                registrationId: payload.id,
              });
            },
          },
          {
            text: t('common.close', { defaultValue: 'Close' }),
            style: 'cancel',
          },
        ]
      );

      resetCreateFlow();
      setActiveTab('registrations');
      void loadRegistrations(1, registrationStatusFilter, true);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      notify({
        title: t('common.error', { defaultValue: 'Error' }),
        message:
          typeof apiMessage === 'string' && apiMessage.trim().length > 0
            ? apiMessage
            : t('designService.registrationSubmitFailed', {
                defaultValue: 'Unable to submit design registration. Please try again.',
              }),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    address,
    isAuthenticated,
    loadRegistrations,
    navigation,
    note,
    phone,
    registrationStatusFilter,
    resetCreateFlow,
    resolveCoordinatesForSubmit,
    selectedNurseryId,
    selectedTierDetail,
    selectedTierId,
    t,
  ]);

  const handleRefreshRegister = useCallback(async () => {
    await loadTemplates();

    if (selectedTierId && step >= 2) {
      await handleSelectTier(selectedTierId);
    }
  }, [handleSelectTier, loadTemplates, selectedTierId, step]);

  const renderRegisterTab = () => {
    const shouldShowAddressSuggestionPanel =
      step === 3 &&
      isAddressFocused &&
      address.trim().length >= ADDRESS_SUGGESTION_MIN_LENGTH;

    return (
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
                {t('designService.registerTabLabel', {
                  defaultValue: 'Create registration',
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
            const stepValue = item as DesignStep;
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
                refreshing={isLoadingTemplates}
                onRefresh={() => void handleRefreshRegister()}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
          >
            {step === 1 ? (
              <View style={styles.sectionCard}>
                {templatesError ? (
                  <View style={styles.stateCard}>
                    <Text style={styles.warningText}>{templatesError}</Text>
                    <TouchableOpacity
                      style={styles.secondaryActionButton}
                      onPress={() => void loadTemplates()}
                    >
                      <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.secondaryActionText}>
                        {t('common.retry', { defaultValue: 'Retry' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : isLoadingTemplates ? (
                  <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  </View>
                ) : templates.length === 0 ? (
                  <Text style={styles.helperText}>
                    {t('designService.templatesEmpty', {
                      defaultValue: 'No design templates found.',
                    })}
                  </Text>
                ) : (
                  <View style={styles.optionList}>
                    {templates.map((template) => {
                      const imageUri = resolveBackendImageUri(template.imageUrl);
                      const isSelected = selectedTemplateId === template.id;

                      return (
                        <TouchableOpacity
                          key={template.id}
                          style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                          onPress={() => handleSelectTemplate(template.id)}
                          activeOpacity={0.9}
                        >
                          {imageUri ? (
                            <TouchableOpacity
                              activeOpacity={0.95}
                              onPress={() => setPreviewImageUri(imageUri)}
                            >
                              <Image source={{ uri: imageUri }} style={styles.templateImage} />
                            </TouchableOpacity>
                          ) : null}
                          <View style={styles.optionHeaderRow}>
                            <Text style={styles.optionTitle}>{template.name}</Text>
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={20}
                              color={isSelected ? COLORS.primary : COLORS.gray500}
                            />
                          </View>
                          <Text style={styles.optionDescription}>{template.description}</Text>
                          <Text style={styles.optionMeta}>
                            {t('designService.styleLabel', { defaultValue: 'Style' })}:{' '}
                            {getDesignStyleLabel(template.style)}
                          </Text>
                          <Text style={styles.optionMeta}>
                            {t('designService.roomTypesLabel', { defaultValue: 'Room types' })}:{' '}
                            {formatRoomTypes(template.roomTypes ?? [])}
                          </Text>
                          <Text style={styles.optionMeta}>
                            {t('designService.specializationsLabel', {
                              defaultValue: 'Specializations',
                            })}
                            : {template.specializations.map((item) => item.name).join(', ') || '-'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            {step === 2 ? (
              <View style={styles.sectionCard}>
                {selectedTemplate ? (
                  <View style={styles.selectedInfoWrap}>
                    <Text style={styles.selectedInfoLabel}>
                      {t('designService.selectedTemplateLabel', {
                        defaultValue: 'Selected template',
                      })}
                    </Text>
                    <Text style={styles.selectedInfoValue}>{selectedTemplate.name}</Text>
                  </View>
                ) : null}

                {!selectedTemplate ? (
                  <Text style={styles.helperText}>
                    {t('designService.templateRequired', {
                      defaultValue: 'Please choose a template first.',
                    })}
                  </Text>
                ) : selectedTemplate.tiers?.length ? (
                  <View style={styles.optionList}>
                    {selectedTemplate.tiers.map((tier) => {
                      const isSelected = selectedTierId === tier.id;
                      const labels = tierItemLabels[tier.id] ?? [];

                      return (
                        <TouchableOpacity
                          key={tier.id}
                          style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                          onPress={() => void handleSelectTier(tier.id)}
                          activeOpacity={0.9}
                        >
                          <View style={styles.optionHeaderRow}>
                            <Text style={styles.optionTitle}>{tier.tierName}</Text>
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={20}
                              color={isSelected ? COLORS.primary : COLORS.gray500}
                            />
                          </View>
                          <Text style={styles.optionMeta}>
                            {t('designService.registrationTotalLabel', { defaultValue: 'Total' })}:{' '}
                            {formatCurrency(tier.packagePrice)}
                          </Text>
                          <Text style={styles.optionMeta}>
                            {t('designService.areaLabel', { defaultValue: 'Area' })}: {tier.minArea}{' '}
                            - {tier.maxArea} m2
                          </Text>
                          <Text style={styles.optionMeta}>
                            {t('designService.estimatedDaysLabel', {
                              defaultValue: 'Estimated days',
                            })}
                            : {tier.estimatedDays}
                          </Text>
                          <Text style={styles.optionDescription}>
                            {t('designService.scopeLabel', { defaultValue: 'Scope' })}:{' '}
                            {tier.scopedOfWork}
                          </Text>
                          {labels.length > 0 ? (
                            <View style={styles.itemList}>
                              {labels.map((label) => (
                                <Text key={`${tier.id}-${label}`} style={styles.itemText}>
                                  - {label}
                                </Text>
                              ))}
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.helperText}>
                    {t('designService.tiersEmpty', {
                      defaultValue: 'No tiers found for the selected template.',
                    })}
                  </Text>
                )}

                {isLoadingTierDetail ? (
                  <View style={styles.inlineLoaderRow}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.inlineLoaderText}>
                      {t('designService.tierLoading', {
                        defaultValue: 'Loading tier detail...',
                      })}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {step === 3 ? (
              <View style={styles.sectionCard}>
                {selectedTemplate ? (
                  <View style={styles.selectedInfoWrap}>
                    <Text style={styles.selectedInfoLabel}>
                      {t('designService.selectedTemplateLabel', {
                        defaultValue: 'Selected template',
                      })}
                    </Text>
                    <Text style={styles.selectedInfoValue}>{selectedTemplate.name}</Text>
                  </View>
                ) : null}

                {selectedTierDetail ? (
                  <View style={styles.selectedInfoWrap}>
                    <Text style={styles.selectedInfoLabel}>
                      {t('designService.selectedTierLabel', {
                        defaultValue: 'Selected tier',
                      })}
                    </Text>
                    <Text style={styles.selectedInfoValue}>
                      {selectedTierDetail.tierName} - {formatCurrency(selectedTierDetail.packagePrice)}
                    </Text>
                    <Text style={styles.optionMeta}>
                      {t('designService.scopeLabel', { defaultValue: 'Scope' })}:{' '}
                      {selectedTierDetail.scopedOfWork}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.inputLabel}>
                  {t('designService.addressInputLabel', { defaultValue: 'Address' })}
                </Text>
                <TextInput
                  style={[styles.input, styles.addressInput]}
                  value={address}
                  onChangeText={handleChangeAddress}
                  onFocus={() => setIsAddressFocused(true)}
                  onBlur={() => {
                    void handleAddressBlur();
                  }}
                  placeholder={t('designService.addressPlaceholder', {
                    defaultValue: 'Enter project address',
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
                          {t('designService.addressSuggestionLoading', {
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
                          {t('designService.addressSuggestionEmpty', {
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
                    {t('designService.latitudeLabel', {
                      defaultValue: 'Latitude',
                    })}
                    : {formatCoordinate(latitude)}
                  </Text>
                  <Text style={styles.coordinateInfoText}>
                    {t('designService.longitudeLabel', {
                      defaultValue: 'Longitude',
                    })}
                    : {formatCoordinate(longitude)}
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
                        ? t('designService.locationLoading', {
                            defaultValue: 'Getting current location...',
                          })
                        : t('designService.useCurrentLocation', {
                            defaultValue: 'Use current location',
                          })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryActionButton,
                      (isResolvingLocation || isGeocodingAddress) && styles.disabledActionButton,
                    ]}
                    onPress={() => void handleUseProfileAddress()}
                    disabled={isResolvingLocation || isGeocodingAddress}
                  >
                    {isGeocodingAddress ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Ionicons name="person-outline" size={16} color={COLORS.primary} />
                    )}
                    <Text style={styles.secondaryActionText}>
                      {t('designService.useProfileAddress', {
                        defaultValue: 'Use profile address',
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, styles.topSpacing]}>
                  {t('designService.preferredNurseryLabel', {
                    defaultValue: 'Preferred nursery (optional)',
                  })}
                </Text>
                <View style={styles.chipWrap}>
                  <TouchableOpacity
                    style={[
                      styles.dayChip,
                      selectedNurseryId === null && styles.dayChipSelected,
                    ]}
                    onPress={() => setSelectedNurseryId(null)}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        selectedNurseryId === null && styles.dayChipTextSelected,
                      ]}
                    >
                      {t('designService.autoAssignLabel', { defaultValue: 'Auto assign' })}
                    </Text>
                  </TouchableOpacity>
                  {tierNurseries.map((nursery) => {
                    const isSelected = selectedNurseryId === nursery.nurseryId;
                    return (
                      <TouchableOpacity
                        key={nursery.id}
                        style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                        onPress={() => setSelectedNurseryId(nursery.nurseryId)}
                      >
                        <Text
                          style={[
                            styles.dayChipText,
                            isSelected && styles.dayChipTextSelected,
                          ]}
                        >
                          {nursery.nurseryName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, styles.topSpacing]}>
                  {t('designService.phoneInputLabel', { defaultValue: 'Phone number' })}
                </Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t('designService.phonePlaceholder', {
                    defaultValue: 'Enter phone number',
                  })}
                  placeholderTextColor={COLORS.gray500}
                  keyboardType="phone-pad"
                />

                <Text style={[styles.inputLabel, styles.topSpacing]}>
                  {t('designService.noteInputLabel', { defaultValue: 'Customer note' })}
                </Text>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('designService.notePlaceholder', {
                    defaultValue: 'Add a note for this project',
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
                      {t('designService.backButton', { defaultValue: 'Back' })}
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
                        {t('designService.submitRegistrationAction', {
                          defaultValue: 'Submit registration',
                        })}
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
                  disabled={isLoadingTierDetail}
                >
                  <Text style={styles.ghostActionText}>
                    {t('designService.backButton', { defaultValue: 'Back' })}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  step === 1 && styles.fullWidthAction,
                  step === 2 && styles.stepContinueAction,
                  ((step === 1 && !selectedTemplateId) || (step === 2 && !selectedTierId)) &&
                    styles.disabledActionButton,
                ]}
                onPress={() => {
                  if (step === 1 && selectedTemplateId) {
                    setStep(2);
                    return;
                  }

                  if (step === 2 && selectedTierId) {
                    setStep(3);
                  }
                }}
                disabled={(step === 1 && !selectedTemplateId) || (step === 2 && !selectedTierId)}
              >
                <Text style={styles.primaryActionText}>
                  {t('designService.continueButton', { defaultValue: 'Continue' })}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </>
    );
  };

  const renderRegistrationsTab = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshingRegistrations}
          onRefresh={() => void loadRegistrations(registrationPage, registrationStatusFilter, true)}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      <View style={styles.sectionCard}>
        <View style={styles.registrationsHeaderRow}>
          <Text style={styles.stepTitle}>
            {t('designService.myRegistrationsTitle', { defaultValue: 'My design registrations' })}
          </Text>
          <Text style={styles.registrationsCountText}>
            {t('designService.myRegistrationsCount', {
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
            {statusOptions.map((option) => {
              const isActive = option.value === registrationStatusFilter;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => {
                    setRegistrationStatusFilter(option.value);
                    setRegistrationPage(1);
                  }}
                  disabled={isLoadingRegistrations}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {option.label}
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
        ) : registrationsError ? (
          <View style={styles.stateCard}>
            <Text style={styles.warningText}>{registrationsError}</Text>
            <TouchableOpacity
              style={styles.secondaryActionButton}
              onPress={() => void loadRegistrations(registrationPage, registrationStatusFilter)}
            >
              <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
              <Text style={styles.secondaryActionText}>
                {t('common.retry', { defaultValue: 'Retry' })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : registrations.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.helperText}>
              {t('designService.myRegistrationsEmpty', {
                defaultValue: 'You do not have any design registration yet.',
              })}
            </Text>
          </View>
        ) : (
          <View style={styles.registrationList}>
            {registrations.map((registration) => {
              const palette = getDesignRegistrationStatusPalette(registration.statusName ?? '');

              return (
                <View key={registration.id} style={styles.registrationCard}>
                  <View style={styles.registrationTopRow}>
                    <Text style={styles.registrationCode}>#{registration.id}</Text>
                    <View
                      style={[
                        styles.registrationStatusBadge,
                        { backgroundColor: palette.backgroundColor },
                      ]}
                    >
                      <Text
                        style={[styles.registrationStatusText, { color: palette.textColor }]}
                      >
                        {registration.statusName}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.registrationName}>
                    {registration.designTemplateTier?.designTemplate?.name ??
                      t('designService.fallbackTemplateName', {
                        defaultValue: 'Design template',
                      })}
                  </Text>
                  <Text style={styles.registrationMetaText}>
                    {t('designService.registrationTierLabel', { defaultValue: 'Tier' })}:{' '}
                    {registration.designTemplateTier?.tierName ?? '-'}
                  </Text>
                  <Text style={styles.registrationMetaText}>
                    {t('designService.registrationTotalLabel', { defaultValue: 'Total' })}:{' '}
                    {formatCurrency(registration.totalPrice)}
                  </Text>
                  <Text style={styles.registrationMetaText}>
                    {t('designService.registrationDepositLabel', { defaultValue: 'Deposit' })}:{' '}
                    {formatCurrency(registration.depositAmount)}
                  </Text>
                  <Text style={styles.registrationMetaText}>
                    {t('designService.registrationNurseryLabel', { defaultValue: 'Nursery' })}:{' '}
                    {registration.nursery?.name ?? '-'}
                  </Text>
                  <Text style={styles.registrationMetaText}>
                    {t('designService.registrationCreatedAtLabel', {
                      defaultValue: 'Created at',
                    })}
                    : {formatVietnamDateTime(registration.createdAt, locale, { empty: '-' })}
                  </Text>
                  <Text style={styles.registrationMetaText}>
                    {t('designService.registrationAddressLabel', { defaultValue: 'Address' })}:{' '}
                    {registration.address}
                  </Text>

                  <TouchableOpacity
                    style={styles.primaryActionButton}
                    onPress={() =>
                      navigation.navigate('DesignRegistrationDetail', {
                        registrationId: registration.id,
                      })
                    }
                  >
                    <Text style={styles.primaryActionText}>
                      {t('designService.viewRegistrationDetailAction', {
                        defaultValue: 'View registration detail',
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.paginationRow}>
          <TouchableOpacity
            style={[styles.secondaryActionButton, !registrationHasPrevious && styles.disabledButton]}
            disabled={!registrationHasPrevious}
            onPress={() => setRegistrationPage((current) => Math.max(1, current - 1))}
          >
            <Text style={styles.secondaryActionText}>
              {t('careService.paginationPrevious', { defaultValue: 'Previous' })}
            </Text>
          </TouchableOpacity>
          <Text style={styles.cardMetaText}>
            {t('careService.paginationSummary', {
              defaultValue: 'Page {{current}}/{{total}}',
              current: registrationPage,
              total: registrationTotalPages,
            })}
          </Text>
          <TouchableOpacity
            style={[styles.secondaryActionButton, !registrationHasNext && styles.disabledButton]}
            disabled={!registrationHasNext}
            onPress={() => setRegistrationPage((current) => current + 1)}
          >
            <Text style={styles.secondaryActionText}>
              {t('careService.paginationNext', { defaultValue: 'Next' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        brandVariant="none"
        containerStyle={styles.header}
        sideWidth={44}
        centerStyle={styles.headerCenter}
        titleStyle={styles.headerTitle}
        title={t('designService.headerTitle', { defaultValue: 'Design service' })}
        left={
          <TouchableOpacity style={styles.headerIconBtn} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.mainTabWrap}>
        <TouchableOpacity
          style={[styles.mainTabChip, activeTab === 'register' && styles.mainTabChipActive]}
          onPress={() => setActiveTab('register')}
        >
          <Text style={[styles.mainTabText, activeTab === 'register' && styles.mainTabTextActive]}>
            {t('designService.registerTabLabel', { defaultValue: 'Create registration' })}
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
            {t('designService.myRegistrationsTabLabel', { defaultValue: 'My registrations' })}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'register' ? renderRegisterTab() : renderRegistrationsTab()}

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
            <Image
              source={{ uri: previewImageUri }}
              style={styles.fullImagePreview}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.lg,
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
  registerContentWrap: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['4xl'],
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  stateCard: {
    gap: SPACING.sm,
  },
  loaderWrap: {
    paddingVertical: SPACING['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
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
  stepTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  helperText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  warningText: {
    fontFamily: FONTS.medium,
    fontSize: FONTS.sizes.sm,
    color: COLORS.error,
  },
  optionList: {
    gap: SPACING.md,
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
  templateImage: {
    width: '100%',
    height: 180,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
    marginBottom: SPACING.sm,
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
  itemList: {
    gap: 4,
    marginTop: SPACING.xs,
  },
  itemText: {
    fontFamily: FONTS.regular,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
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
  addressInput: {
    minHeight: 80,
  },
  noteInput: {
    minHeight: 100,
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
  topSpacing: {
    marginTop: SPACING.md,
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
    textAlign: 'center',
  },
  flexAction: {
    flex: 1,
  },
  fullWidthAction: {
    width: '100%',
  },
  stepContinueAction: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  disabledActionButton: {
    opacity: 0.6,
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
  registrationList: {
    gap: SPACING.md,
  },
  registrationCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  registrationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  registrationCode: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
  },
  registrationStatusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  registrationStatusText: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.xs,
  },
  registrationName: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  registrationMetaText: {
    fontFamily: FONTS.regular,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  cardMetaText: {
    fontFamily: FONTS.regular,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  flex: {
    flex: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
