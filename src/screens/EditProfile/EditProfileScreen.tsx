import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { BrandedHeader } from '../../components/branding';
import {
  RootStackParamList,
  UpdateProfileRequest,
  UserGenderCode,
} from '../../types';
import { useAuthStore, useEnumStore } from '../../stores';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProfile'>;

const CURRENT_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = 1900;
const ADDRESS_SUGGESTION_MIN_LENGTH = 3;
const ADDRESS_SUGGESTION_LIMIT = 5;
const ADDRESS_SUGGESTION_DEBOUNCE_MS = 350;

const normalizeGenderCode = (rawCode: unknown): UserGenderCode | null => {
  if (typeof rawCode === 'number' && Number.isInteger(rawCode)) {
    return rawCode;
  }

  if (typeof rawCode === 'string' && /^-?\d+$/.test(rawCode.trim())) {
    const numeric = Number(rawCode.trim());
    if (Number.isInteger(numeric)) {
      return numeric;
    }
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

type ReverseGeocodeAddress = {
  name?: string | null;
  street?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
};

type GeocodeCoordinates = {
  latitude: number;
  longitude: number;
};

type AddressSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

type NominatimSearchItem = {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
};

const formatReverseGeocodeAddress = (rawAddress: ReverseGeocodeAddress): string => {
  const parts = [
    rawAddress.name,
    rawAddress.street,
    rawAddress.district,
    rawAddress.subregion,
    rawAddress.city,
    rawAddress.region,
    rawAddress.country,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0);

  return Array.from(new Set(parts)).join(', ');
};

const formatCoordinateValue = (rawCoordinate: string): string | null => {
  const normalizedCoordinate = normalizeCoordinate(rawCoordinate);
  if (normalizedCoordinate === null) {
    return null;
  }

  return normalizedCoordinate.toFixed(6);
};

export default function EditProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t, i18n } = useTranslation();

  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changeAvatar = useAuthStore((state) => state.changeAvatar);
  const isLoading = useAuthStore((state) => state.isLoading);
  const loadEnumResource = useEnumStore((state) => state.loadResource);
  const getEnumValues = useEnumStore((state) => state.getEnumValues);
  const enumGroups = useEnumStore((state) => state.groups);

  useEffect(() => {
    void loadEnumResource('users');
  }, [loadEnumResource]);

  const genderOptions = useMemo(() => {
    const values = getEnumValues(['Gender']);

    return values
      .map((option) => {
        const normalizedCode = normalizeGenderCode(option.value);
        if (normalizedCode === null) {
          return null;
        }

        const normalizedName = option.name.trim().toLowerCase();
        let label = option.name;

        if (normalizedName === 'male') {
          label = t('profile.editFormGenderMale', { defaultValue: option.name });
        } else if (normalizedName === 'female') {
          label = t('profile.editFormGenderFemale', { defaultValue: option.name });
        } else if (normalizedName === 'other') {
          label = t('profile.editFormGenderOther', { defaultValue: option.name });
        }

        return {
          value: normalizedCode,
          label,
          rawName: option.name,
        };
      })
      .filter(
        (
          option
        ): option is {
          value: UserGenderCode;
          label: string;
          rawName: string;
        } => Boolean(option)
      );
  }, [enumGroups, getEnumValues, t]);

  const preferredGenderCode = useMemo(() => {
    const normalizedCode = normalizeGenderCode(user?.genderCode);
    if (normalizedCode !== null) {
      return normalizedCode;
    }

    if (typeof user?.gender !== 'string') {
      return null;
    }

    const normalizedGenderName = user.gender.trim().toLowerCase();
    if (!normalizedGenderName) {
      return null;
    }

    const matchedOption = genderOptions.find(
      (option) => option.rawName.trim().toLowerCase() === normalizedGenderName
    );

    return matchedOption?.value ?? null;
  }, [genderOptions, user?.gender, user?.genderCode]);

  const [username, setUsername] = useState(user?.username ?? '');
  const [phoneNumber, setPhoneNumber] = useState(
    user?.phoneNumber ?? user?.phone ?? ''
  );
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [address, setAddress] = useState(
    typeof user?.address === 'string' ? user.address : user?.address?.fullAddress ?? ''
  );
  const [latitude, setLatitude] = useState(() => {
    const normalizedLatitude = normalizeCoordinate(user?.latitude);
    return normalizedLatitude !== null ? String(normalizedLatitude) : '';
  });
  const [longitude, setLongitude] = useState(() => {
    const normalizedLongitude = normalizeCoordinate(user?.longitude);
    return normalizedLongitude !== null ? String(normalizedLongitude) : '';
  });
  const [birthYear, setBirthYear] = useState(
    typeof user?.birthYear === 'number' ? String(user.birthYear) : ''
  );
  const [gender, setGender] = useState<UserGenderCode>(() =>
    normalizeGenderCode(user?.genderCode) ?? 1
  );
  const [receiveNotifications, setReceiveNotifications] = useState(
    user?.receiveNotifications ?? user?.receiveNotification ?? false
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isLoadingAddressSuggestions, setIsLoadingAddressSuggestions] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);

  const lastGeocodedAddressRef = useRef<string>(
    normalizeCoordinate(user?.latitude) !== null &&
      normalizeCoordinate(user?.longitude) !== null
      ? (
          typeof user?.address === 'string'
            ? user.address
            : user?.address?.fullAddress ?? ''
        ).trim()
      : ''
  );
  const addressSuggestionRequestIdRef = useRef(0);
  const isSelectingAddressSuggestionRef = useRef(false);

  const avatarUri =
    typeof user?.avatar === 'string' && user.avatar.trim().length > 0
      ? user.avatar.trim()
      : null;

  const handleChangeAvatar = async () => {
    if (isUploadingAvatar) {
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('aiDesign.mediaPermissionMessage', {
          defaultValue: 'Please grant photo library access',
        })
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const selectedAsset = result.assets?.[0];
    const selectedUri = selectedAsset?.uri?.trim();
    if (!selectedUri) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('aiDesign.missingImageMessage', {
          defaultValue: 'Please choose an image',
        })
      );
      return;
    }

    const fallbackFileName = selectedUri.split('/').pop() || `avatar-${Date.now()}.jpg`;
    const fileName = selectedAsset?.fileName?.trim() || fallbackFileName;
    const mimeType =
      selectedAsset?.mimeType?.trim() ||
      (fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

    try {
      setIsUploadingAvatar(true);
      await changeAvatar(selectedUri, fileName, mimeType);

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('profile.editAvatarSuccess', {
          defaultValue: 'Avatar uploaded successfully.',
        })
      );
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('profile.editAvatarFailed', {
              defaultValue: 'Unable to upload avatar. Please try again.',
            })
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (preferredGenderCode !== null) {
      setGender((previousGender) =>
        previousGender === preferredGenderCode ? previousGender : preferredGenderCode
      );
      return;
    }

    if (genderOptions.length === 0) {
      return;
    }

    setGender((previousGender) => {
      const hasCurrentGender = genderOptions.some(
        (option) => option.value === previousGender
      );
      return hasCurrentGender ? previousGender : genderOptions[0].value;
    });
  }, [genderOptions, preferredGenderCode]);

  const resolveAddressFromCoordinates = useCallback(
    async (resolvedLatitude: number, resolvedLongitude: number): Promise<string | null> => {
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
        });

        const primaryAddress = addresses[0] as ReverseGeocodeAddress | undefined;
        if (!primaryAddress) {
          return null;
        }

        const formattedAddress = formatReverseGeocodeAddress(primaryAddress);
        return formattedAddress.length > 0 ? formattedAddress : null;
      } catch {
        return null;
      }
    },
    []
  );

  const resolveCoordinatesFromAddress = useCallback(
    async (rawAddress: string): Promise<GeocodeCoordinates | null> => {
      const trimmedAddress = rawAddress.trim();
      if (!trimmedAddress) {
        return null;
      }

      try {
        const geocodedLocations = await Location.geocodeAsync(trimmedAddress);
        const firstLocation = geocodedLocations[0];
        if (!firstLocation) {
          return null;
        }

        return {
          latitude: Number(firstLocation.latitude.toFixed(6)),
          longitude: Number(firstLocation.longitude.toFixed(6)),
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

      try {
        const queryParams = new URLSearchParams({
          format: 'jsonv2',
          limit: String(ADDRESS_SUGGESTION_LIMIT),
          addressdetails: '1',
          q: trimmedQuery,
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${queryParams.toString()}`,
          {
            headers: {
              Accept: 'application/json',
              'Accept-Language': i18n.language === 'vi' ? 'vi' : 'en',
              'User-Agent': 'PlantDecorMobile/1.0',
            },
          }
        );

        if (!response.ok) {
          return [];
        }

        const payload = (await response.json()) as NominatimSearchItem[];
        if (!Array.isArray(payload)) {
          return [];
        }

        const seenLabels = new Set<string>();

        return payload
          .map((item) => {
            const label =
              typeof item.display_name === 'string' ? item.display_name.trim() : '';
            const latitudeValue = normalizeCoordinate(item.lat);
            const longitudeValue = normalizeCoordinate(item.lon);

            if (!label || latitudeValue === null || longitudeValue === null) {
              return null;
            }

            if (seenLabels.has(label)) {
              return null;
            }

            seenLabels.add(label);

            const id =
              typeof item.place_id === 'string' || typeof item.place_id === 'number'
                ? String(item.place_id)
                : `${label}-${latitudeValue}-${longitudeValue}`;

            return {
              id,
              label,
              latitude: Number(latitudeValue.toFixed(6)),
              longitude: Number(longitudeValue.toFixed(6)),
            };
          })
          .filter((item): item is AddressSuggestion => Boolean(item));
      } catch {
        return [];
      }
    },
    [i18n.language]
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
      setLatitude('');
      setLongitude('');
      setAddressSuggestions([]);
      lastGeocodedAddressRef.current = '';
      return;
    }

    if (trimmedNextAddress !== lastGeocodedAddressRef.current) {
      setLatitude('');
      setLongitude('');
    }
  }, []);

  const handleSelectAddressSuggestion = useCallback((selectedItem: AddressSuggestion) => {
    isSelectingAddressSuggestionRef.current = false;

    setAddress(selectedItem.label);
    setLatitude(String(selectedItem.latitude));
    setLongitude(String(selectedItem.longitude));
    setAddressSuggestions([]);
    setIsAddressFocused(false);
    lastGeocodedAddressRef.current = selectedItem.label.trim();
  }, []);

  const handleAddressBlur = useCallback(async () => {
    if (isSelectingAddressSuggestionRef.current) {
      return;
    }

    setIsAddressFocused(false);
    setAddressSuggestions([]);

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

      setLatitude(String(resolvedCoordinates.latitude));
      setLongitude(String(resolvedCoordinates.longitude));
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
    address.trim().length >= ADDRESS_SUGGESTION_MIN_LENGTH &&
    (isLoadingAddressSuggestions || addressSuggestions.length > 0);

  const selectedGenderName = useMemo(() => {
    const selectedOption = genderOptions.find((option) => option.value === gender);
    if (selectedOption?.rawName.trim()) {
      return selectedOption.rawName.trim();
    }

    return String(gender);
  }, [gender, genderOptions]);

  const latitudeDisplayValue = useMemo(
    () => formatCoordinateValue(latitude),
    [latitude]
  );
  const longitudeDisplayValue = useMemo(
    () => formatCoordinateValue(longitude),
    [longitude]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    if (isResolvingLocation || isLoading || isGeocodingAddress) {
      return;
    }

    try {
      setIsResolvingLocation(true);

      const isLocationServiceEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationServiceEnabled) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('profile.editFormLocationServiceDisabled', {
            defaultValue: 'Please enable location services and try again.',
          })
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('profile.editFormLocationPermissionDenied', {
            defaultValue: 'Location permission is required to use current coordinates.',
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
          t('profile.editFormLocationUnavailable', {
            defaultValue: 'Unable to determine your current location. Please move to an open area and try again.',
          })
        );
        return;
      }

      const resolvedLatitude = Number(position.coords.latitude.toFixed(6));
      const resolvedLongitude = Number(position.coords.longitude.toFixed(6));

      setLatitude(String(resolvedLatitude));
      setLongitude(String(resolvedLongitude));

      const reverseGeocodedAddress = await resolveAddressFromCoordinates(
        resolvedLatitude,
        resolvedLongitude
      );

      if (reverseGeocodedAddress) {
        setAddress(reverseGeocodedAddress);
        lastGeocodedAddressRef.current = reverseGeocodedAddress.trim();
      }
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('profile.editFormLocationFailed', {
          defaultValue: 'Unable to fetch current location. Please try again.',
        })
      );
    } finally {
      setIsResolvingLocation(false);
    }
  }, [
    isGeocodingAddress,
    isLoading,
    isResolvingLocation,
    resolveAddressFromCoordinates,
    t,
  ]);

  const handleUpdateProfile = async () => {
    if (isLoading || isGeocodingAddress) {
      return;
    }

    const trimmedUsername = username.trim();
    const trimmedPhoneNumber = phoneNumber.trim();
    const trimmedFullName = fullName.trim();
    let trimmedAddress = address.trim();
    let resolvedLatitude = normalizeCoordinate(latitude);
    let resolvedLongitude = normalizeCoordinate(longitude);
    const parsedBirthYear = Number(birthYear);

    if (
      !trimmedAddress &&
      resolvedLatitude !== null &&
      resolvedLongitude !== null
    ) {
      const reverseGeocodedAddress = await resolveAddressFromCoordinates(
        resolvedLatitude,
        resolvedLongitude
      );

      if (reverseGeocodedAddress) {
        trimmedAddress = reverseGeocodedAddress;
        setAddress(reverseGeocodedAddress);
        lastGeocodedAddressRef.current = reverseGeocodedAddress.trim();
      }
    }

    if (
      !trimmedUsername ||
      !trimmedPhoneNumber ||
      !trimmedFullName ||
      !trimmedAddress ||
      !birthYear.trim()
    ) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('profile.editFormRequired', {
          defaultValue: 'Please fill in all required fields.',
        })
      );
      return;
    }

    if (
      !Number.isInteger(parsedBirthYear) ||
      parsedBirthYear < MIN_BIRTH_YEAR ||
      parsedBirthYear > CURRENT_YEAR
    ) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('profile.editFormBirthYearInvalid', {
          min: MIN_BIRTH_YEAR,
          max: CURRENT_YEAR,
          defaultValue: `Birth year must be between ${MIN_BIRTH_YEAR} and ${CURRENT_YEAR}.`,
        })
      );
      return;
    }

    const shouldResolveCoordinatesFromAddress =
      trimmedAddress.length > 0 &&
      (resolvedLatitude === null ||
        resolvedLongitude === null ||
        trimmedAddress !== lastGeocodedAddressRef.current);

    if (shouldResolveCoordinatesFromAddress) {
      try {
        setIsGeocodingAddress(true);

        const geocodedCoordinates = await resolveCoordinatesFromAddress(trimmedAddress);
        if (!geocodedCoordinates) {
          Alert.alert(
            t('common.error', { defaultValue: 'Error' }),
            t('profile.editFormAddressGeocodeFailed', {
              defaultValue:
                'Unable to determine coordinates from this address. Please verify your address or use current location.',
            })
          );
          return;
        }

        resolvedLatitude = geocodedCoordinates.latitude;
        resolvedLongitude = geocodedCoordinates.longitude;

        setLatitude(String(geocodedCoordinates.latitude));
        setLongitude(String(geocodedCoordinates.longitude));
        lastGeocodedAddressRef.current = trimmedAddress;
      } finally {
        setIsGeocodingAddress(false);
      }
    }

    const payloadLatitude = resolvedLatitude ?? normalizeCoordinate(user?.latitude) ?? 0;
    const payloadLongitude = resolvedLongitude ?? normalizeCoordinate(user?.longitude) ?? 0;

    const payload: UpdateProfileRequest = {
      userName: trimmedUsername,
      phoneNumber: trimmedPhoneNumber,
      fullName: trimmedFullName,
      address: trimmedAddress,
      birthYear: parsedBirthYear,
      gender: selectedGenderName,
      latitude: payloadLatitude,
      longitude: payloadLongitude,
      receiveNotifications,
    };

    try {
      await updateProfile(payload);

      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('profile.editFormUpdateSuccess', {
          defaultValue: 'Profile updated successfully.',
        }),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;

      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('profile.editFormUpdateFailed', {
              defaultValue: 'Unable to update profile. Please try again.',
            })
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <BrandedHeader
          brandVariant="none"
          containerStyle={styles.header}
          sideWidth={44}
          title={t('profile.editProfile')}
          left={
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
            >
              <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          }
          right={<View style={styles.headerButtonPlaceholder} />}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>{t('profile.editFormSectionTitle')}</Text>

            <View style={styles.avatarSection}>
              <View style={styles.avatarPreviewWrap}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>
                      {user?.fullName?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.avatarActionButton, isUploadingAvatar && styles.avatarActionButtonDisabled]}
                onPress={() => void handleChangeAvatar()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={16} color={COLORS.white} />
                    <Text style={styles.avatarActionText}>
                      {t('profile.editAvatarAction', { defaultValue: 'Change avatar' })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormUsername')}</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder={t('profile.editFormUsernamePlaceholder')}
                placeholderTextColor={COLORS.gray500}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t('profile.editFormPhoneNumber', { defaultValue: 'Phone number' })}
              </Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder={t('profile.editFormPhoneNumberPlaceholder', {
                  defaultValue: 'Enter your phone number',
                })}
                placeholderTextColor={COLORS.gray500}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormFullName')}</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('profile.editFormFullNamePlaceholder')}
                placeholderTextColor={COLORS.gray500}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormAddress')}</Text>
              <TextInput
                style={[styles.input, styles.addressInput]}
                value={address}
                onChangeText={handleChangeAddress}
                onFocus={() => setIsAddressFocused(true)}
                onBlur={() => {
                  void handleAddressBlur();
                }}
                placeholder={t('profile.editFormAddressPlaceholder')}
                placeholderTextColor={COLORS.gray500}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!isLoading && !isGeocodingAddress}
              />

              {shouldShowAddressSuggestionPanel ? (
                <View style={styles.addressSuggestionList}>
                  {isLoadingAddressSuggestions ? (
                    <View style={styles.addressSuggestionStateRow}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={styles.addressSuggestionStateText}>
                        {t('profile.editFormAddressSuggestionLoading', {
                          defaultValue: 'Searching address suggestions...',
                        })}
                      </Text>
                    </View>
                  ) : (
                    addressSuggestions.map((item, itemIndex) => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.addressSuggestionItem,
                          itemIndex === addressSuggestions.length - 1 &&
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
                  )}
                </View>
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormBirthYear')}</Text>
              <TextInput
                style={styles.input}
                value={birthYear}
                onChangeText={setBirthYear}
                placeholder={t('profile.editFormBirthYearPlaceholder')}
                placeholderTextColor={COLORS.gray500}
                keyboardType="number-pad"
                maxLength={4}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t('profile.editFormLocation', { defaultValue: 'Location' })}
              </Text>
              <View style={styles.coordinateRow}>
                <View style={[styles.input, styles.coordinateInput, styles.coordinateDisplay]}>
                  <Text
                    style={[
                      styles.coordinateValueText,
                      !latitudeDisplayValue && styles.coordinatePlaceholderText,
                    ]}
                  >
                    {latitudeDisplayValue ??
                      t('profile.editFormLatitudePlaceholder', {
                        defaultValue: 'Latitude',
                      })}
                  </Text>
                </View>
                <View style={[styles.input, styles.coordinateInput, styles.coordinateDisplay]}>
                  <Text
                    style={[
                      styles.coordinateValueText,
                      !longitudeDisplayValue && styles.coordinatePlaceholderText,
                    ]}
                  >
                    {longitudeDisplayValue ??
                      t('profile.editFormLongitudePlaceholder', {
                        defaultValue: 'Longitude',
                      })}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.locationButton,
                  (isLoading || isResolvingLocation || isGeocodingAddress) &&
                    styles.locationButtonDisabled,
                ]}
                onPress={() => void handleUseCurrentLocation()}
                activeOpacity={0.8}
                disabled={isLoading || isResolvingLocation || isGeocodingAddress}
              >
                {isResolvingLocation ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="locate-outline" size={16} color={COLORS.primary} />
                )}
                <Text style={styles.locationButtonText}>
                  {isResolvingLocation
                    ? t('profile.editFormLocationLoading', {
                        defaultValue: 'Getting current location...',
                      })
                    : t('profile.editFormUseCurrentLocation', {
                        defaultValue: 'Use current location',
                      })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('profile.editFormGender')}</Text>
              <View style={styles.genderRow}>
                {genderOptions.map((option) => {
                  const isSelected = gender === option.value;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.genderOption,
                        isSelected && styles.genderOptionSelected,
                      ]}
                      onPress={() => setGender(option.value)}
                      disabled={isLoading}
                    >
                      <Text
                        style={[
                          styles.genderOptionText,
                          isSelected && styles.genderOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={styles.notificationRow}
              onPress={() => setReceiveNotifications((prev) => !prev)}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <View style={styles.notificationTextWrap}>
                <Text style={styles.inputLabel}>{t('profile.editFormReceiveNotification')}</Text>
                <Text style={styles.notificationHint}>
                  {t('profile.editFormReceiveNotificationHint')}
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  receiveNotifications && styles.toggleEnabled,
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    receiveNotifications && styles.toggleThumbEnabled,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (isLoading || isGeocodingAddress) && styles.saveButtonDisabled,
            ]}
            onPress={handleUpdateProfile}
            disabled={isLoading || isGeocodingAddress}
            activeOpacity={0.85}
          >
            {isLoading || isGeocodingAddress ? (
              <Text style={styles.saveButtonText}>{t('common.updating')}</Text>
            ) : (
              <Text style={styles.saveButtonText}>{t('profile.editFormSaveButton')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  headerButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['2xl'],
  },
  formCard: {
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  avatarSection: {
    marginBottom: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatarPreviewWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  avatarPlaceholderText: {
    color: COLORS.white,
    fontSize: FONTS.sizes['2xl'],
    fontWeight: '700',
  },
  avatarActionButton: {
    minHeight: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  avatarActionButtonDisabled: {
    opacity: 0.7,
  },
  avatarActionText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: SPACING.md,
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
    minHeight: 84,
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
  coordinateRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  coordinateInput: {
    flex: 1,
  },
  coordinateDisplay: {
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  coordinateValueText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  coordinatePlaceholderText: {
    color: COLORS.textLight,
  },
  locationButton: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.secondaryLight,
  },
  locationButtonDisabled: {
    opacity: 0.7,
  },
  locationButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '700',
  },
  genderRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  genderOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  genderOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  genderOptionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  genderOptionTextSelected: {
    color: COLORS.primaryDark,
  },
  notificationRow: {
    marginTop: SPACING.xs,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTextWrap: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  notificationHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 999,
    backgroundColor: COLORS.gray300,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleEnabled: {
    backgroundColor: COLORS.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    transform: [{ translateX: 0 }],
  },
  toggleThumbEnabled: {
    transform: [{ translateX: 22 }],
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  saveButton: {
    height: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.white,
  },
});
