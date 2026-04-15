import React, { useEffect, useMemo, useState } from 'react';
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
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [address, setAddress] = useState(
    typeof user?.address === 'string' ? user.address : user?.address?.fullAddress ?? ''
  );
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
      setGender(preferredGenderCode);
      return;
    }

    if (genderOptions.length === 0) {
      return;
    }

    const hasCurrentGender = genderOptions.some((option) => option.value === gender);
    if (!hasCurrentGender) {
      setGender(genderOptions[0].value);
    }
  }, [gender, genderOptions, preferredGenderCode]);

  const handleUpdateProfile = async () => {
    const trimmedUsername = username.trim();
    const trimmedFullName = fullName.trim();
    const trimmedAddress = address.trim();
    const parsedBirthYear = Number(birthYear);

    if (!trimmedUsername || !trimmedFullName || !trimmedAddress || !birthYear.trim()) {
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

    const payload: UpdateProfileRequest = {
      username: trimmedUsername,
      fullName: trimmedFullName,
      address: trimmedAddress,
      birthYear: parsedBirthYear,
      gender,
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
