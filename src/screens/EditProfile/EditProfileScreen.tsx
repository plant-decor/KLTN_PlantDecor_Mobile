import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const { t } = useTranslation();

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
    if (isResolvingLocation || isLoading) {
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
  }, [isLoading, isResolvingLocation, resolveAddressFromCoordinates, t]);

  const handleUpdateProfile = async () => {
    const trimmedUsername = username.trim();
    const trimmedPhoneNumber = phoneNumber.trim();
    const trimmedFullName = fullName.trim();
    let trimmedAddress = address.trim();
    const normalizedLatitude = normalizeCoordinate(latitude);
    const normalizedLongitude = normalizeCoordinate(longitude);
    const parsedBirthYear = Number(birthYear);

    if (
      !trimmedAddress &&
      normalizedLatitude !== null &&
      normalizedLongitude !== null
    ) {
      const reverseGeocodedAddress = await resolveAddressFromCoordinates(
        normalizedLatitude,
        normalizedLongitude
      );

      if (reverseGeocodedAddress) {
        trimmedAddress = reverseGeocodedAddress;
        setAddress(reverseGeocodedAddress);
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

    const payloadLatitude = normalizedLatitude ?? normalizeCoordinate(user?.latitude) ?? 0;
    const payloadLongitude = normalizedLongitude ?? normalizeCoordinate(user?.longitude) ?? 0;

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
                onChangeText={setAddress}
                placeholder={t('profile.editFormAddressPlaceholder')}
                placeholderTextColor={COLORS.gray500}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!isLoading}
              />
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
                  (isLoading || isResolvingLocation) && styles.locationButtonDisabled,
                ]}
                onPress={() => void handleUseCurrentLocation()}
                activeOpacity={0.8}
                disabled={isLoading || isResolvingLocation}
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
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleUpdateProfile}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
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
