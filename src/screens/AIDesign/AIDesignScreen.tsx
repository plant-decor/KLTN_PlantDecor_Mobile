import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { API, COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { enumService, plantService, roomDesignService } from '../../services';
import { useAuthStore, useCartStore } from '../../stores';
import {
  Nursery,
  RootStackParamList,
  RoomDesignAllergyPlant,
  RoomDesignAnalyzeResult,
  RoomDesignGeneratedImage,
  RoomDesignImageFile,
  RoomDesignRecommendation,
  RoomDesignUploadedImage,
  RoomDesignAnalyzePayload,
} from '../../types';
import { isCustomerRole } from '../../utils/authFlow';
import { notify, resolveImageUris } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type StaticOption<Value extends string> = {
  value: Value;
  apiValue: string;
  labelKey: string;
  fallbackLabel: string;
};

type FengShuiValue = 'Kim' | 'Moc' | 'Thuy' | 'Hoa' | 'Tho';
type FengShuiSelection = 'omit' | FengShuiValue;
type CareLevelValue = 'Easy' | 'Medium' | 'Hard';
type CareLevelSelection = 'omit' | CareLevelValue;
type AllergySendMode = 'omit' | 'no' | 'yes';
type TriBool = 'omit' | 'yes' | 'no';

const FALLBACK_ROOM_TYPE_NAMES: readonly string[] = [
  'LivingRoom',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'HomeOffice',
  'Balcony',
  'Corridor',
  'DiningRoom',
];

const FALLBACK_ROOM_STYLE_NAMES: readonly string[] = [
  'Minimalist',
  'Scandinavian',
  'Tropical',
  'Industrial',
  'Bohemian',
  'Modern',
  'Japanese',
  'Mediterranean',
  'Rustic',
];

const FALLBACK_LIGHT_DIRECTIONS: readonly string[] = ['North', 'South', 'East', 'West', 'NorthEast', 'NorthWest', 'SouthEast', 'SouthWest'];
const FALLBACK_DOMINANT_DIRECTIONS: readonly string[] = ['North', 'South', 'East', 'West', 'NorthEast', 'NorthWest', 'SouthEast', 'SouthWest'];
const FALLBACK_NATURAL_LIGHT_LEVELS: readonly string[] = ['LowLight', 'MediumLight', 'BrightLight', 'DirectSun'];

const ALLERGY_SEARCH_TAKE = 50;
const ALLERGY_SEARCH_DEBOUNCE_MS = 350;
const GENERATED_IMAGES_POLL_INTERVAL_MS = 3000;
const GENERATED_IMAGES_MAX_ATTEMPTS = 8;

const FENG_SHUI_OPTIONS: StaticOption<FengShuiSelection>[] = [
  {
    value: 'omit',
    apiValue: '',
    labelKey: 'aiDesign.filterUnspecified',
    fallbackLabel: 'Any',
  },
  {
    value: 'Kim',
    apiValue: 'Kim',
    labelKey: 'catalog.fengShuiMetal',
    fallbackLabel: 'Metal',
  },
  {
    value: 'Moc',
    apiValue: 'Mộc',
    labelKey: 'catalog.fengShuiWood',
    fallbackLabel: 'Wood',
  },
  {
    value: 'Thuy',
    apiValue: 'Thủy',
    labelKey: 'catalog.fengShuiWater',
    fallbackLabel: 'Water',
  },
  {
    value: 'Hoa',
    apiValue: 'Hỏa',
    labelKey: 'catalog.fengShuiFire',
    fallbackLabel: 'Fire',
  },
  {
    value: 'Tho',
    apiValue: 'Thổ',
    labelKey: 'catalog.fengShuiEarth',
    fallbackLabel: 'Earth',
  },
];

const CARE_LEVEL_OPTIONS: StaticOption<CareLevelSelection>[] = [
  {
    value: 'omit',
    apiValue: '',
    labelKey: 'aiDesign.filterUnspecified',
    fallbackLabel: 'Any',
  },
  {
    value: 'Easy',
    apiValue: 'Easy',
    labelKey: 'plantDetail.careEasy',
    fallbackLabel: 'Easy',
  },
  {
    value: 'Medium',
    apiValue: 'Medium',
    labelKey: 'plantDetail.careMedium',
    fallbackLabel: 'Medium',
  },
  {
    value: 'Hard',
    apiValue: 'Hard',
    labelKey: 'plantDetail.careHard',
    fallbackLabel: 'Hard',
  },
];

const ALLERGY_SEND_OPTIONS: StaticOption<AllergySendMode>[] = [
  {
    value: 'omit',
    apiValue: '',
    labelKey: 'aiDesign.allergySendOmit',
    fallbackLabel: 'Not specified',
  },
  {
    value: 'no',
    apiValue: '',
    labelKey: 'aiDesign.allergySendNo',
    fallbackLabel: 'No allergies',
  },
  {
    value: 'yes',
    apiValue: '',
    labelKey: 'aiDesign.allergySendYes',
    fallbackLabel: 'Exclude plants',
  },
];

const TRI_BOOL_OPTIONS: StaticOption<TriBool>[] = [
  {
    value: 'omit',
    apiValue: '',
    labelKey: 'aiDesign.filterUnspecified',
    fallbackLabel: 'Not specified',
  },
  {
    value: 'yes',
    apiValue: '',
    labelKey: 'aiDesign.filterYes',
    fallbackLabel: 'Yes',
  },
  {
    value: 'no',
    apiValue: '',
    labelKey: 'aiDesign.filterNo',
    fallbackLabel: 'No',
  },
];

type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

function SectionCard({ title, subtitle, children, collapsible, defaultCollapsed }: SectionCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed ?? false);

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity 
        style={styles.sectionHeader} 
        onPress={() => collapsible && setIsCollapsed(!isCollapsed)}
        disabled={!collapsible}
        activeOpacity={0.7}
      >
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {collapsible ? (
            <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={20} color={COLORS.textPrimary} />
          ) : null}
        </View>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </TouchableOpacity>
      {!isCollapsed ? <View style={styles.sectionContent}>{children}</View> : null}
    </View>
  );
}

type OptionChipGroupProps<Value extends string> = {
  options: StaticOption<Value>[];
  selectedValue: Value;
  onSelect: (value: Value) => void;
  getLabel: (option: StaticOption<Value>) => string;
};

function OptionChipGroup<Value extends string>({
  options,
  selectedValue,
  onSelect,
  getLabel,
}: OptionChipGroupProps<Value>) {
  return (
    <View style={styles.chipGroup}>
      {options.map((option) => {
        const isSelected = option.value === selectedValue;

        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionChip, isSelected && styles.optionChipActive]}
            onPress={() => onSelect(option.value)}
          >
            <Text
              style={[
                styles.optionChipText,
                isSelected && styles.optionChipTextActive,
              ]}
            >
              {getLabel(option)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const formatEnumNameDefault = (name: string): string =>
  name.replace(/([A-Z])/g, ' $1').replace(/^\s+/, '').trim();

type StringChipOption = { value: string; label: string };

function DynamicOptionChipGroup({
  options,
  selectedValue,
  onSelect,
}: {
  options: StringChipOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chipGroup}>
      {options.map((option) => {
        const isSelected = option.value === selectedValue;

        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionChip, isSelected && styles.optionChipActive]}
            onPress={() => onSelect(option.value)}
          >
            <Text
              style={[
                styles.optionChipText,
                isSelected && styles.optionChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const resolveApiMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    const maybeResponseError = error as Error & {
      response?: { data?: { message?: string } };
    };
    const apiMessage = maybeResponseError.response?.data?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
      return apiMessage;
    }

    return error.message;
  }

  const responseError = error as {
    response?: { data?: { message?: string } };
  };
  const apiMessage = responseError?.response?.data?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
    return apiMessage;
  }

  return fallbackMessage;
};

const parseBudgetValue = (value: string): number | null => {
  const normalized = value.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatBudgetPreview = (value: string, locale: string): string => {
  const parsed = parseBudgetValue(value);
  if (parsed === null) {
    return value;
  }

  return parsed.toLocaleString(locale);
};

const dedupeImageList = (images: Array<string | null | undefined>): string[] => {
  const uniqueImages: string[] = [];
  const seen = new Set<string>();

  images.forEach((image) => {
    if (!image || seen.has(image)) {
      return;
    }

    seen.add(image);
    uniqueImages.push(image);
  });

  return uniqueImages;
};

export default function AIDesignScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userRole = useAuthStore((state) => state.user?.role);
  const addCartItem = useCartStore((state) => state.addCartItem);

  const isCustomer = isCustomerRole(userRole);

  const [selectedImage, setSelectedImage] = useState<RoomDesignImageFile | null>(null);
  type LocalRoomImage = {
    viewAngle: string;
    roomImageId?: number | null;
    imageUrl?: string | null;
    moderationStatus?: string | null;
    moderationReason?: string | null;
    uploadedAt?: string | null;
    uploading?: boolean;
    error?: string | null;
  };

  const [uploadedRoomImages, setUploadedRoomImages] = useState<LocalRoomImage[]>(() => [
    { viewAngle: 'Front' },
    { viewAngle: 'Left' },
    { viewAngle: 'Right' },
    { viewAngle: 'Back' },
  ]);
  const [fengShuiSelection, setFengShuiSelection] = useState<FengShuiSelection>('omit');
  const [roomTypeNames, setRoomTypeNames] = useState<string[]>(() => [
    ...FALLBACK_ROOM_TYPE_NAMES,
  ]);
  const [roomStyleNames, setRoomStyleNames] = useState<string[]>(() => [
    ...FALLBACK_ROOM_STYLE_NAMES,
  ]);
  const [roomType, setRoomType] = useState('LivingRoom');
  const [roomStyle, setRoomStyle] = useState('Minimalist');
  const [roomArea, setRoomArea] = useState('');

  const [lightDirectionNames, setLightDirectionNames] = useState<string[]>(() => [...FALLBACK_LIGHT_DIRECTIONS]);
  const [dominantDirectionNames, setDominantDirectionNames] = useState<string[]>(() => [...FALLBACK_DOMINANT_DIRECTIONS]);
  const [naturalLightLevelNames, setNaturalLightLevelNames] = useState<string[]>(() => [...FALLBACK_NATURAL_LIGHT_LEVELS]);

  const [lightDirection, setLightDirection] = useState('omit');
  const [dominantDirection, setDominantDirection] = useState('omit');
  const [naturalLightLevel, setNaturalLightLevel] = useState('omit');

  const [careLevelSelection, setCareLevelSelection] = useState<CareLevelSelection>('omit');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [allergySend, setAllergySend] = useState<AllergySendMode>('omit');
  const [petSafeTri, setPetSafeTri] = useState<TriBool>('omit');
  const [childSafeTri, setChildSafeTri] = useState<TriBool>('omit');
  const [preferredNurseries, setPreferredNurseries] = useState<Nursery[]>([]);
  const [isLoadingPreferredNurseries, setIsLoadingPreferredNurseries] = useState(false);
  const [preferredNurseriesError, setPreferredNurseriesError] = useState<string | null>(
    null
  );
  const [selectedPreferredNurseryIds, setSelectedPreferredNurseryIds] = useState<
    number[]
  >([]);
  const [allergyNote, setAllergyNote] = useState('');
  const [allergyKeyword, setAllergyKeyword] = useState('');
  const [allergyPlants, setAllergyPlants] = useState<RoomDesignAllergyPlant[]>([]);
  const [selectedAllergyPlants, setSelectedAllergyPlants] = useState<
    RoomDesignAllergyPlant[]
  >([]);
  const [isLoadingAllergyPlants, setIsLoadingAllergyPlants] = useState(false);
  const [allergyError, setAllergyError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<RoomDesignAnalyzeResult | null>(
    null
  );
  const [activeRecommendationActionId, setActiveRecommendationActionId] = useState<
    string | null
  >(null);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isLoadingGeneratedImages, setIsLoadingGeneratedImages] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<RoomDesignGeneratedImage[]>(
    []
  );
  const [generatedImagesError, setGeneratedImagesError] = useState<string | null>(
    null
  );
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const allergySearchRequestId = useRef(0);
  const generatedImagesPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const selectedAllergyPlantIds = useMemo(
    () => new Set(selectedAllergyPlants.map((plant) => plant.id)),
    [selectedAllergyPlants]
  );

  const preferredNurseryIdSet = useMemo(
    () => new Set(selectedPreferredNurseryIds),
    [selectedPreferredNurseryIds]
  );

  const roomTypeChipOptions = useMemo(
    () =>
      roomTypeNames.map((name) => ({
        value: name,
        label: t(`aiDesign.roomType.${name}`, {
          defaultValue: formatEnumNameDefault(name),
        }),
      })),
    [roomTypeNames, t]
  );

  const roomStyleChipOptions = useMemo(
    () =>
      roomStyleNames.map((name) => ({
        value: name,
        label: t(`aiDesign.roomStyle.${name}`, {
          defaultValue: formatEnumNameDefault(name),
        }),
      })),
    [roomStyleNames, t]
  );

  const lightDirectionChipOptions = useMemo(
    () => [
      { value: 'omit', label: t('aiDesign.filterUnspecified', { defaultValue: 'Any' }) },
      ...lightDirectionNames.map((name) => ({
        value: name,
        label: t(`aiDesign.lightDirection.${name}`, {
          defaultValue: formatEnumNameDefault(name),
        }),
      }))
    ],
    [lightDirectionNames, t]
  );

  const dominantDirectionChipOptions = useMemo(
    () => [
      { value: 'omit', label: t('aiDesign.filterUnspecified', { defaultValue: 'Any' }) },
      ...dominantDirectionNames.map((name) => ({
        value: name,
        label: t(`aiDesign.dominantDirection.${name}`, {
          defaultValue: formatEnumNameDefault(name),
        }),
      }))
    ],
    [dominantDirectionNames, t]
  );

  const naturalLightLevelChipOptions = useMemo(
    () => [
      { value: 'omit', label: t('aiDesign.filterUnspecified', { defaultValue: 'Any' }) },
      ...naturalLightLevelNames.map((name) => ({
        value: name,
        label: t(`aiDesign.naturalLightLevel.${name}`, {
          defaultValue: formatEnumNameDefault(name),
        }),
      }))
    ],
    [naturalLightLevelNames, t]
  );

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) {
      return;
    }

    let cancelled = false;

    void enumService
      .getByName(API.ENDPOINTS.ROOM_DESIGN_ENUM_GROUP)
      .then((groups) => {
        if (cancelled) {
          return;
        }

        const roomTypeGroup = groups.find((g) => g.enumName === 'RoomType');
        const roomStyleGroup = groups.find((g) => g.enumName === 'RoomStyle');
        const lightDirGroup = groups.find((g) => g.enumName === 'LightDirection');
        const domDirGroup = groups.find((g) => g.enumName === 'DominantDirection');
        const natLightGroup = groups.find((g) => g.enumName === 'NaturalLightLevel');

        const rt =
          roomTypeGroup?.values
            .map((v) => v.name.trim())
            .filter((n) => n.length > 0) ?? [];
        const rs =
          roomStyleGroup?.values
            .map((v) => v.name.trim())
            .filter((n) => n.length > 0) ?? [];
        const ld =
          lightDirGroup?.values
            .map((v) => v.name.trim())
            .filter((n) => n.length > 0) ?? [];
        const dd =
          domDirGroup?.values
            .map((v) => v.name.trim())
            .filter((n) => n.length > 0) ?? [];
        const nl =
          natLightGroup?.values
            .map((v) => v.name.trim())
            .filter((n) => n.length > 0) ?? [];

        setRoomTypeNames(rt.length > 0 ? rt : [...FALLBACK_ROOM_TYPE_NAMES]);
        setRoomStyleNames(rs.length > 0 ? rs : [...FALLBACK_ROOM_STYLE_NAMES]);
        setLightDirectionNames(ld.length > 0 ? ld : [...FALLBACK_LIGHT_DIRECTIONS]);
        setDominantDirectionNames(dd.length > 0 ? dd : [...FALLBACK_DOMINANT_DIRECTIONS]);
        setNaturalLightLevelNames(nl.length > 0 ? nl : [...FALLBACK_NATURAL_LIGHT_LEVELS]);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setRoomTypeNames([...FALLBACK_ROOM_TYPE_NAMES]);
        setRoomStyleNames([...FALLBACK_ROOM_STYLE_NAMES]);
        setLightDirectionNames([...FALLBACK_LIGHT_DIRECTIONS]);
        setDominantDirectionNames([...FALLBACK_DOMINANT_DIRECTIONS]);
        setNaturalLightLevelNames([...FALLBACK_NATURAL_LIGHT_LEVELS]);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isCustomer]);

  useEffect(() => {
    if (!isAuthenticated || !isCustomer) {
      return;
    }

    let cancelled = false;

    setIsLoadingPreferredNurseries(true);
    setPreferredNurseriesError(null);

    void plantService
      .searchNurseries({
        pagination: { pageNumber: 1, pageSize: 200 },
        isActive: true,
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setPreferredNurseries(payload.items ?? []);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setPreferredNurseriesError(
          resolveApiMessage(
            error,
            t('aiDesign.preferredNurseriesLoadFailed', {
              defaultValue: 'Unable to load nurseries.',
            })
          )
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPreferredNurseries(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isCustomer, t]);

  useEffect(() => {
    if (roomTypeNames.includes(roomType)) {
      return;
    }

    setRoomType(roomTypeNames[0] ?? 'LivingRoom');
  }, [roomTypeNames, roomType]);

  useEffect(() => {
    if (roomStyleNames.includes(roomStyle)) {
      return;
    }

    setRoomStyle(roomStyleNames[0] ?? 'Minimalist');
  }, [roomStyleNames, roomStyle]);

  const analysisPreviewImages = useMemo(
    () =>
      dedupeImageList([
        analysisResult?.previewImageUrl,
        analysisResult?.plantCollageUrl,
        analysisResult?.aiResponseImageUrl,
      ]),
    [
      analysisResult?.aiResponseImageUrl,
      analysisResult?.plantCollageUrl,
      analysisResult?.previewImageUrl,
    ]
  );

  const bottomContentInset = insets.bottom + 120;

  const getStaticOptionLabel = useCallback(
    <Value extends string,>(option: StaticOption<Value>) =>
      t(option.labelKey, { defaultValue: option.fallbackLabel }),
    [t]
  );

  const clearGeneratedImagesPolling = useCallback(() => {
    if (generatedImagesPollTimeoutRef.current) {
      clearTimeout(generatedImagesPollTimeoutRef.current);
      generatedImagesPollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearGeneratedImagesPolling(), [clearGeneratedImagesPolling]);

  useEffect(() => {
    if (allergySend === 'yes') {
      return;
    }

    setAllergyKeyword('');
    setAllergyNote('');
    setAllergyPlants([]);
    setSelectedAllergyPlants([]);
    setAllergyError(null);
    setIsLoadingAllergyPlants(false);
  }, [allergySend]);

  useEffect(() => {
    if (allergySend !== 'yes') {
      return;
    }

    const requestId = allergySearchRequestId.current + 1;
    allergySearchRequestId.current = requestId;
    const timeout = setTimeout(() => {
      setIsLoadingAllergyPlants(true);
      setAllergyError(null);

      void roomDesignService
        .searchAllergyPlants(allergyKeyword, ALLERGY_SEARCH_TAKE)
        .then((items) => {
          if (allergySearchRequestId.current !== requestId) {
            return;
          }

          setAllergyPlants(items);
        })
        .catch((error: unknown) => {
          if (allergySearchRequestId.current !== requestId) {
            return;
          }

          setAllergyError(
            resolveApiMessage(
              error,
              t('aiDesign.allergyLoadFailed', {
                defaultValue: 'Unable to load allergy plants.',
              })
            )
          );
        })
        .finally(() => {
          if (allergySearchRequestId.current === requestId) {
            setIsLoadingAllergyPlants(false);
          }
        });
    }, ALLERGY_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [allergyKeyword, allergySend, t]);

  const handleSelectImageAsset = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    const normalizedUri = asset.uri?.trim();
    if (!normalizedUri) {
      return;
    }

    const fileName =
      asset.fileName?.trim() || normalizedUri.split('/').pop() || `room-${Date.now()}.jpg`;
    const mimeType = asset.mimeType?.trim() || 'image/jpeg';

    setSelectedImage({
      uri: normalizedUri,
      fileName,
      mimeType,
    });
  }, []);

  const pickImageFromLibrary = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        t('aiDesign.permissionTitle', { defaultValue: 'Permission required' }),
        t('aiDesign.mediaPermissionMessage', {
          defaultValue: 'Please grant photo library access.',
        })
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      handleSelectImageAsset(result.assets[0]);
    }
  }, [handleSelectImageAsset, t]);

  const takePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        t('aiDesign.permissionTitle', { defaultValue: 'Permission required' }),
        t('aiDesign.cameraPermissionMessage', {
          defaultValue: 'Please grant camera access.',
        })
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      handleSelectImageAsset(result.assets[0]);
    }
  }, [handleSelectImageAsset, t]);

  const uploadRoomImageForAngle = useCallback(
    async (imageFile: RoomDesignImageFile, angle: string) => {
      setUploadedRoomImages((current) =>
        current.map((item) =>
          item.viewAngle === angle ? { ...item, uploading: true, error: undefined } : item
        )
      );

      try {
        const uploaded = await roomDesignService.uploadRoomImage(imageFile, angle);
        const first = uploaded[0];

        if (first) {
          setUploadedRoomImages((current) =>
            current.map((item) =>
              item.viewAngle === angle
                ? {
                    ...item,
                    roomImageId: first.roomImageId,
                    imageUrl: first.imageUrl ?? null,
                    moderationStatus: first.moderationStatus ?? null,
                    uploadedAt: first.uploadedAt ?? null,
                    uploading: false,
                    error: undefined,
                  }
                : item
            )
          );
        } else {
          setUploadedRoomImages((current) =>
            current.map((item) =>
              item.viewAngle === angle
                ? { ...item, uploading: false, error: t('aiDesign.uploadNoResponse') }
                : item
            )
          );
        }

        return uploaded;
      } catch (error: unknown) {
        setUploadedRoomImages((current) =>
          current.map((item) =>
            item.viewAngle === angle
              ? {
                  ...item,
                  uploading: false,
                  error: resolveApiMessage(
                    error,
                    t('aiDesign.uploadFailed', { defaultValue: 'Upload failed' })
                  ),
                }
              : item
          )
        );

        throw error;
      }
    },
    [t]
  );

  const handlePickForAngle = useCallback(
    async (angle: string) => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          t('aiDesign.permissionTitle', { defaultValue: 'Permission required' }),
          t('aiDesign.mediaPermissionMessage', {
            defaultValue: 'Please grant photo library access.',
          })
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const normalizedUri = asset.uri?.trim();
        if (!normalizedUri) return;

        const fileName =
          asset.fileName?.trim() || normalizedUri.split('/').pop() || `room-${Date.now()}.jpg`;
        const mimeType = asset.mimeType?.trim() || 'image/jpeg';

        await uploadRoomImageForAngle({ uri: normalizedUri, fileName, mimeType }, angle);
      }
    },
    [uploadRoomImageForAngle, t]
  );

  const handleTakePhotoForAngle = useCallback(
    async (angle: string) => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          t('aiDesign.permissionTitle', { defaultValue: 'Permission required' }),
          t('aiDesign.cameraPermissionMessage', {
            defaultValue: 'Please grant camera access.',
          })
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const normalizedUri = asset.uri?.trim();
        if (!normalizedUri) return;

        const fileName =
          asset.fileName?.trim() || normalizedUri.split('/').pop() || `room-${Date.now()}.jpg`;
        const mimeType = asset.mimeType?.trim() || 'image/jpeg';

        await uploadRoomImageForAngle({ uri: normalizedUri, fileName, mimeType }, angle);
      }
    },
    [uploadRoomImageForAngle, t]
  );

  const toggleAllergyPlant = useCallback((plant: RoomDesignAllergyPlant) => {
    setSelectedAllergyPlants((currentPlants) => {
      if (currentPlants.some((item) => item.id === plant.id)) {
        return currentPlants.filter((item) => item.id !== plant.id);
      }

      return [...currentPlants, plant];
    });
  }, []);

  const togglePreferredNursery = useCallback((nursery: Nursery) => {
    setSelectedPreferredNurseryIds((current) => {
      if (current.includes(nursery.id)) {
        return current.filter((id) => id !== nursery.id);
      }

      return [...current, nursery.id];
    });
  }, []);

  const pollGeneratedImages = useCallback(
    async (layoutDesignId: number, attempt = 0) => {
      clearGeneratedImagesPolling();

      if (attempt === 0) {
        setIsLoadingGeneratedImages(true);
        setGeneratedImagesError(null);
        setGeneratedImages([]);
      }

      try {
        const images = await roomDesignService.getGeneratedImages(layoutDesignId);
        setGeneratedImages(images);

        if (images.length > 0) {
          setGeneratedImagesError(null);
          setIsLoadingGeneratedImages(false);
          return;
        }

        if (attempt >= GENERATED_IMAGES_MAX_ATTEMPTS - 1) {
          setGeneratedImagesError(
            t('aiDesign.generatedImagesEmpty', {
              defaultValue: 'No generated images are available yet.',
            })
          );
          setIsLoadingGeneratedImages(false);
          return;
        }

        generatedImagesPollTimeoutRef.current = setTimeout(() => {
          void pollGeneratedImages(layoutDesignId, attempt + 1);
        }, GENERATED_IMAGES_POLL_INTERVAL_MS);
      } catch (error: unknown) {
        if (attempt >= GENERATED_IMAGES_MAX_ATTEMPTS - 1) {
          setGeneratedImagesError(
            resolveApiMessage(
              error,
              t('aiDesign.generatedImagesLoadFailed', {
                defaultValue: 'Unable to load generated images.',
              })
            )
          );
          setIsLoadingGeneratedImages(false);
          return;
        }

        generatedImagesPollTimeoutRef.current = setTimeout(() => {
          void pollGeneratedImages(layoutDesignId, attempt + 1);
        }, GENERATED_IMAGES_POLL_INTERVAL_MS);
      }
    },
    [clearGeneratedImagesPolling, t]
  );

  const handleAnalyzeRoom = useCallback(async () => {
    const roomImageIds = uploadedRoomImages
      .map((it) => it.roomImageId)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id));

    if (roomImageIds.length === 0) {
      Alert.alert(
        t('aiDesign.missingImageTitle', { defaultValue: 'Missing image' }),
        t('aiDesign.missingImageMessage', {
          defaultValue: 'Please upload at least one room image (Front/Left/Right/Back).',
        })
      );
      return;
    }

    const minTrim = minBudget.trim();
    const maxTrim = maxBudget.trim();
    let minBudgetPayload: number | undefined;
    let maxBudgetPayload: number | undefined;

    if (minTrim === '' && maxTrim === '') {
      minBudgetPayload = undefined;
      maxBudgetPayload = undefined;
    } else {
      const parsedMinBudget = parseBudgetValue(minBudget);
      const parsedMaxBudget = parseBudgetValue(maxBudget);

      if (parsedMinBudget === null || parsedMaxBudget === null) {
        Alert.alert(
          t('aiDesign.errorTitle', { defaultValue: 'Error' }),
          t('aiDesign.invalidBudgetMessage', {
            defaultValue: 'Please enter a valid budget range.',
          })
        );
        return;
      }

      if (parsedMinBudget > parsedMaxBudget) {
        Alert.alert(
          t('aiDesign.errorTitle', { defaultValue: 'Error' }),
          t('aiDesign.invalidBudgetRangeMessage', {
            defaultValue: 'Minimum budget cannot be greater than maximum budget.',
          })
        );
        return;
      }

      minBudgetPayload = parsedMinBudget;
      maxBudgetPayload = parsedMaxBudget;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setGeneratedImages([]);
    setGeneratedImagesError(null);
    setIsLoadingGeneratedImages(false);
    clearGeneratedImagesPolling();

    try {
      const fengShuiApi =
        fengShuiSelection === 'omit'
          ? undefined
          : FENG_SHUI_OPTIONS.find((option) => option.value === fengShuiSelection)?.apiValue;

      const careLevelApi =
        careLevelSelection === 'omit'
          ? undefined
          : CARE_LEVEL_OPTIONS.find((option) => option.value === careLevelSelection)?.apiValue;

      const hasAllergyPayload =
        allergySend === 'omit' ? undefined : allergySend === 'yes';

      const payload: RoomDesignAnalyzePayload = {
        roomImageIds,
        roomType,
        roomStyle,
        roomArea: roomArea.trim() ? Number(roomArea.trim()) : undefined,
        lightDirection: lightDirection === 'omit' ? undefined : lightDirection,
        dominantDirection: dominantDirection === 'omit' ? undefined : dominantDirection,
        naturalLightLevel: naturalLightLevel === 'omit' ? undefined : naturalLightLevel,
        fengShuiElement: fengShuiApi?.trim() ? fengShuiApi : undefined,
        minBudget: minBudgetPayload,
        maxBudget: maxBudgetPayload,
        careLevelType: careLevelApi?.trim() ? careLevelApi : undefined,
        hasAllergy: hasAllergyPayload,
        allergyNote:
          allergySend === 'yes' && allergyNote.trim() ? allergyNote.trim() : undefined,
        allergicPlantIds:
          allergySend === 'yes' ? selectedAllergyPlants.map((plant) => plant.id) : undefined,
        petSafe: petSafeTri === 'omit' ? undefined : petSafeTri === 'yes',
        childSafe: childSafeTri === 'omit' ? undefined : childSafeTri === 'yes',
        preferredNurseryIds:
          selectedPreferredNurseryIds.length > 0
            ? selectedPreferredNurseryIds
            : undefined,
      };

      const result = await roomDesignService.analyze(payload);

      setAnalysisResult(result);
    } catch (error: unknown) {
      setAnalysisError(
        resolveApiMessage(
          error,
          t('aiDesign.errorMessage', {
            defaultValue: 'Unable to generate design. Please try again.',
          })
        )
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    allergyNote,
    allergySend,
    careLevelSelection,
    childSafeTri,
    clearGeneratedImagesPolling,
    fengShuiSelection,
    maxBudget,
    minBudget,
    petSafeTri,
    selectedPreferredNurseryIds,
    roomStyle,
    roomType,
    roomArea,
    lightDirection,
    dominantDirection,
    naturalLightLevel,
    selectedAllergyPlants,
    t,
    uploadedRoomImages,
  ]);

  const handleAddRecommendationToCart = useCallback(
    async (
      entity: RoomDesignRecommendation | RoomDesignGeneratedImage,
      isGeneratedImage = false
    ) => {
      const commonPlantId = isGeneratedImage
        ? (entity as RoomDesignGeneratedImage).commonPlantId
        : (entity as RoomDesignRecommendation).commonPlantId;

      if (!commonPlantId) {
        return;
      }

      setActiveRecommendationActionId(`cart-${entity.id}`);

      try {
        const payload = await addCartItem({
          commonPlantId,
          nurseryPlantComboId: null,
          nurseryMaterialId: null,
          quantity: 1,
        });

        notify({
          message: payload
            ? t('aiDesign.addToCartSuccess', {
                defaultValue: 'Added to cart.',
              })
            : t('aiDesign.addToCartFailed', {
                defaultValue: 'Unable to add this plant to cart.',
              }),
        });
      } catch (error: unknown) {
        notify({
          message: resolveApiMessage(
            error,
            t('aiDesign.addToCartFailed', {
              defaultValue: 'Unable to add this plant to cart.',
            })
          ),
          useAlert: true,
        });
      } finally {
        setActiveRecommendationActionId(null);
      }
    },
    [addCartItem, t]
  );

  const handleBuyRecommendationNow = useCallback(
    async (
      entity: RoomDesignRecommendation | RoomDesignGeneratedImage,
      isGeneratedImage = false
    ) => {
      const plantInstanceId = isGeneratedImage
        ? (entity as RoomDesignGeneratedImage).plantInstanceId
        : (entity as RoomDesignRecommendation).plantInstanceId;

      if (!plantInstanceId) {
        return;
      }

      setActiveRecommendationActionId(`buy-${entity.id}`);

      try {
        const detail = await plantService.getPlantInstanceDetail(plantInstanceId);
        const detailImages = resolveImageUris(detail.images);
        
        let primaryImage: string | undefined;
        let checkoutPrice = 0;
        let fallbackName = '';

        if (isGeneratedImage) {
          const genEntity = entity as RoomDesignGeneratedImage;
          primaryImage = detailImages[0] ?? genEntity.imageUrl ?? undefined;
          checkoutPrice = detail.specificPrice ?? 0;
          fallbackName = detail.plantName ?? `Plant Instance #${plantInstanceId}`;
        } else {
          const recEntity = entity as RoomDesignRecommendation;
          primaryImage = detailImages[0] ?? recEntity.imageUrl ?? undefined;
          checkoutPrice =
            detail.specificPrice ?? recEntity.specificPrice ?? recEntity.price ?? 0;
          fallbackName = detail.plantName ?? recEntity.name;
        }

        navigation.navigate('Checkout', {
          source: 'buy-now',
          items: [
            {
              id: detail.id,
              name: fallbackName,
              size:
                detail.height != null
                  ? `${detail.height} cm`
                  : t('common.updating', { defaultValue: 'Updating' }),
              image: primaryImage,
              price: checkoutPrice,
              quantity: 1,
              plantInstanceId: detail.id,
              isUniqueInstance: true,
            },
          ],
        });
      } catch (error: unknown) {
        notify({
          message: resolveApiMessage(
            error,
            t('aiDesign.buyNowFailed', {
              defaultValue: 'Unable to open buy now for this plant instance.',
            })
          ),
          useAlert: true,
        });
      } finally {
        setActiveRecommendationActionId(null);
      }
    },
    [navigation, t]
  );

  const handleGenerateImages = useCallback(async () => {
    const layoutDesignId = analysisResult?.layoutDesignId ?? null;
    if (!layoutDesignId || isGeneratingImages) {
      return;
    }

    clearGeneratedImagesPolling();
    setIsGeneratingImages(true);
    setGeneratedImages([]);
    setGeneratedImagesError(null);

    try {
      await roomDesignService.generateImages(layoutDesignId);
      setIsGeneratingImages(false);
      void pollGeneratedImages(layoutDesignId, 0);
    } catch (error: unknown) {
      setIsGeneratingImages(false);
      setGeneratedImagesError(
        resolveApiMessage(
          error,
          t('aiDesign.generateImagesFailed', {
            defaultValue: 'Unable to generate layout images.',
          })
        )
      );
      setIsLoadingGeneratedImages(false);
    }
  }, [analysisResult?.layoutDesignId, clearGeneratedImagesPolling, isGeneratingImages, pollGeneratedImages, t]);

  const handleRetryGeneratedImages = useCallback(() => {
    const layoutDesignId = analysisResult?.layoutDesignId ?? null;
    if (!layoutDesignId) {
      return;
    }

    void pollGeneratedImages(layoutDesignId, 0);
  }, [analysisResult?.layoutDesignId, pollGeneratedImages]);

  const renderGuestGate = () => (
    <View style={styles.gateWrap}>
      <View style={styles.gateCard}>
        <Ionicons name="lock-closed-outline" size={40} color={COLORS.primary} />
        <Text style={styles.gateTitle}>
          {t('aiDesign.guestTitle', {
            defaultValue: 'Login to use AI RoomDesign',
          })}
        </Text>
        <Text style={styles.gateMessage}>
          {t('aiDesign.guestMessage', {
            defaultValue:
              'Please login first to upload your room and receive plant recommendations.',
          })}
        </Text>
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.primaryActionButtonText}>
            {t('common.login', { defaultValue: 'Login' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRoleBlockedState = () => (
    <View style={styles.gateWrap}>
      <View style={styles.gateCard}>
        <Ionicons name="person-circle-outline" size={40} color={COLORS.accent} />
        <Text style={styles.gateTitle}>
          {t('aiDesign.customerOnlyTitle', {
            defaultValue: 'RoomDesign is available for customer accounts only',
          })}
        </Text>
        <Text style={styles.gateMessage}>
          {t('aiDesign.customerOnlyMessage', {
            defaultValue:
              'This feature is currently limited to customers. Please switch to a customer account to continue.',
          })}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BrandedHeader
        title={t('aiDesign.headerTitle', { defaultValue: 'AI RoomDesign' })}
        brandVariant="none"
        containerStyle={styles.header}
      />

      {!isAuthenticated ? (
        renderGuestGate()
      ) : !isCustomer ? (
        renderRoleBlockedState()
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomContentInset },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SectionCard
            title={t('aiDesign.sectionImage', { defaultValue: 'Room image' })}
            subtitle={t('aiDesign.imageHint', {
              defaultValue: 'Upload a room photo to let AI analyze your space.',
            })}
          >
            <View style={styles.imageGrid}>
              <View style={styles.imageGridRow}>
                {['Front', 'Back'].map((angle) => {
                  const item = uploadedRoomImages.find((it) => it.viewAngle === angle) ?? { viewAngle: angle };
                  return (
                    <View key={angle} style={[styles.imagePickerCard, styles.imageGridCard]}>
                      {item.imageUrl ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setFullScreenImage(item.imageUrl!)}
                          style={{ width: '100%' }}
                        >
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.selectedImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="images-outline" size={30} color={COLORS.primary} />
                      )}
                      <Text style={styles.imagePickerCardTitle}>{item.viewAngle}</Text>
                      <View style={styles.selectedImageActions}>
                        <TouchableOpacity
                          style={[styles.imageSecondaryButton, styles.imageSecondaryButtonSmall]}
                          onPress={() => handlePickForAngle(item.viewAngle)}
                        >
                          <Ionicons name="images-outline" size={16} color={COLORS.primary} />
                          <Text style={[styles.imageSecondaryButtonText, { fontSize: FONTS.sizes.sm }]}> 
                            {t('aiDesign.library', { defaultValue: 'Library' })}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.imageSecondaryButton, styles.imageSecondaryButtonSmall]}
                          onPress={() => handleTakePhotoForAngle(item.viewAngle)}
                        >
                          <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
                          <Text style={[styles.imageSecondaryButtonText, { fontSize: FONTS.sizes.sm }]}> 
                            {t('aiDesign.takePhoto', { defaultValue: 'Take photo' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {item.uploading ? <ActivityIndicator /> : null}
                      {item.error ? (
                        <Text style={[styles.imagePickerCardTitle, { color: COLORS.error }]}> 
                          {item.error}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <View style={styles.imageGridRow}>
                {['Left', 'Right'].map((angle) => {
                  const item = uploadedRoomImages.find((it) => it.viewAngle === angle) ?? { viewAngle: angle };
                  return (
                    <View key={angle} style={[styles.imagePickerCard, styles.imageGridCard]}>
                      {item.imageUrl ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setFullScreenImage(item.imageUrl!)}
                          style={{ width: '100%' }}
                        >
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={styles.selectedImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="images-outline" size={30} color={COLORS.primary} />
                      )}
                      <Text style={styles.imagePickerCardTitle}>{item.viewAngle}</Text>
                      <View style={styles.selectedImageActions}>
                        <TouchableOpacity
                          style={[styles.imageSecondaryButton, styles.imageSecondaryButtonSmall]}
                          onPress={() => handlePickForAngle(item.viewAngle)}
                        >
                          <Ionicons name="images-outline" size={16} color={COLORS.primary} />
                          <Text style={[styles.imageSecondaryButtonText, { fontSize: FONTS.sizes.sm }]}> 
                            {t('aiDesign.library', { defaultValue: 'Library' })}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.imageSecondaryButton, styles.imageSecondaryButtonSmall]}
                          onPress={() => handleTakePhotoForAngle(item.viewAngle)}
                        >
                          <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
                          <Text style={[styles.imageSecondaryButtonText, { fontSize: FONTS.sizes.sm }]}> 
                            {t('aiDesign.takePhoto', { defaultValue: 'Take photo' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {item.uploading ? <ActivityIndicator /> : null}
                      {item.error ? (
                        <Text style={[styles.imagePickerCardTitle, { color: COLORS.error }]}> 
                          {item.error}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </SectionCard>

          <SectionCard
            title={t('aiDesign.preferencesTitle', {
              defaultValue: 'Design preferences',
            })}
            subtitle={t('aiDesign.preferencesSubtitle', {
              defaultValue:
                'Only room type and style are required. Leave other fields empty to omit them from the request.',
            })}
          >
            <Text style={styles.fieldLabel}>
              {t('aiDesign.fengShuiElementLabel', {
                defaultValue: 'Feng Shui element',
              })}
            </Text>
            <OptionChipGroup
              options={FENG_SHUI_OPTIONS}
              selectedValue={fengShuiSelection}
              onSelect={setFengShuiSelection}
              getLabel={getStaticOptionLabel}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.sectionRoomType', { defaultValue: 'Room type' })}
            </Text>
            <DynamicOptionChipGroup
              options={roomTypeChipOptions}
              selectedValue={roomType}
              onSelect={setRoomType}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.sectionStyle', { defaultValue: 'Style' })}
            </Text>
            <DynamicOptionChipGroup
              options={roomStyleChipOptions}
              selectedValue={roomStyle}
              onSelect={setRoomStyle}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.roomAreaLabel', { defaultValue: 'Room area (m²)' })}
            </Text>
            <TextInput
              style={styles.textInput}
              value={roomArea}
              onChangeText={setRoomArea}
              keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              placeholder={t('aiDesign.roomAreaPlaceholder', {
                defaultValue: 'Optional',
              })}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.lightDirectionLabel', { defaultValue: 'Light direction' })}
            </Text>
            <DynamicOptionChipGroup
              options={lightDirectionChipOptions}
              selectedValue={lightDirection}
              onSelect={setLightDirection}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.dominantDirectionLabel', { defaultValue: 'Dominant direction' })}
            </Text>
            <DynamicOptionChipGroup
              options={dominantDirectionChipOptions}
              selectedValue={dominantDirection}
              onSelect={setDominantDirection}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.naturalLightLevelLabel', { defaultValue: 'Natural light level' })}
            </Text>
            <DynamicOptionChipGroup
              options={naturalLightLevelChipOptions}
              selectedValue={naturalLightLevel}
              onSelect={setNaturalLightLevel}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.careLevelLabel', { defaultValue: 'Care level' })}
            </Text>
            <OptionChipGroup
              options={CARE_LEVEL_OPTIONS}
              selectedValue={careLevelSelection}
              onSelect={setCareLevelSelection}
              getLabel={getStaticOptionLabel}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.petSafeLabel', { defaultValue: 'Pet safe' })}
            </Text>
            <OptionChipGroup
              options={TRI_BOOL_OPTIONS}
              selectedValue={petSafeTri}
              onSelect={setPetSafeTri}
              getLabel={getStaticOptionLabel}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.childSafeLabel', { defaultValue: 'Child safe' })}
            </Text>
            <OptionChipGroup
              options={TRI_BOOL_OPTIONS}
              selectedValue={childSafeTri}
              onSelect={setChildSafeTri}
              getLabel={getStaticOptionLabel}
            />

            <Text style={styles.fieldLabel}>
              {t('aiDesign.preferredNurseriesLabel', {
                defaultValue: 'Preferred Nurseries',
              })}
            </Text>
            <Text style={styles.helperText}>
              {t('aiDesign.preferredNurseriesHint', {
                defaultValue: 'Optional. Tap nurseries to include them in the request.',
              })}
            </Text>

            {selectedPreferredNurseryIds.length > 0 ? (
              <View style={styles.selectedAllergyList}>
                {selectedPreferredNurseryIds.map((id) => {
                  const nursery = preferredNurseries.find((n) => n.id === id);
                  const label = nursery?.name ?? `#${id}`;

                  return (
                    <TouchableOpacity
                      key={id}
                      style={styles.selectedAllergyChip}
                      onPress={() => {
                        if (nursery) {
                          togglePreferredNursery(nursery);
                        } else {
                          setSelectedPreferredNurseryIds((prev) =>
                            prev.filter((item) => item !== id)
                          );
                        }
                      }}
                    >
                      <Text style={styles.selectedAllergyChipText}>{label}</Text>
                      <Ionicons name="close" size={14} color={COLORS.primaryDark} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {isLoadingPreferredNurseries ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>
                  {t('common.loading', { defaultValue: 'Loading...' })}
                </Text>
              </View>
            ) : preferredNurseriesError ? (
              <Text style={styles.errorInlineText}>{preferredNurseriesError}</Text>
            ) : preferredNurseries.length === 0 ? (
              <Text style={styles.helperText}>
                {t('aiDesign.preferredNurseriesEmpty', {
                  defaultValue: 'No nurseries available.',
                })}
              </Text>
            ) : (
              <ScrollView
                style={styles.preferredNurseryList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {preferredNurseries.map((nursery) => {
                  const isSelected = preferredNurseryIdSet.has(nursery.id);

                  return (
                    <TouchableOpacity
                      key={nursery.id}
                      style={[
                        styles.allergyPlantItem,
                        isSelected && styles.allergyPlantItemSelected,
                      ]}
                      onPress={() => togglePreferredNursery(nursery)}
                    >
                      <View style={styles.allergyPlantInfo}>
                        <Text style={styles.allergyPlantName}>{nursery.name}</Text>
                        {nursery.address ? (
                          <Text
                            style={styles.allergyPlantScientificName}
                            numberOfLines={2}
                          >
                            {nursery.address}
                          </Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={isSelected ? COLORS.primary : COLORS.gray500}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.budgetRow}>
              <View style={styles.budgetField}>
                <Text style={styles.fieldLabel}>
                  {t('aiDesign.minBudgetLabel', { defaultValue: 'Minimum budget' })}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={minBudget}
                  onChangeText={setMinBudget}
                  keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  placeholder={t('aiDesign.budgetOptionalPlaceholder', {
                    defaultValue: 'Optional',
                  })}
                  placeholderTextColor={COLORS.textLight}
                />
                <Text style={styles.helperText}>
                  {formatBudgetPreview(minBudget, locale)}
                </Text>
              </View>

              <View style={styles.budgetField}>
                <Text style={styles.fieldLabel}>
                  {t('aiDesign.maxBudgetLabel', { defaultValue: 'Maximum budget' })}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={maxBudget}
                  onChangeText={setMaxBudget}
                  keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  placeholder={t('aiDesign.budgetOptionalPlaceholder', {
                    defaultValue: 'Optional',
                  })}
                  placeholderTextColor={COLORS.textLight}
                />
                <Text style={styles.helperText}>
                  {formatBudgetPreview(maxBudget, locale)}
                </Text>
              </View>
            </View>
          </SectionCard>

          <SectionCard
            title={t('aiDesign.allergyTitle', {
              defaultValue: 'Allergy preferences',
            })}
            subtitle={t('aiDesign.allergySubtitle', {
              defaultValue:
                'Turn this on only if you want AI to avoid plants that may trigger your allergy.',
            })}
          >
            <Text style={styles.fieldLabel}>
              {t('aiDesign.allergySendLabel', { defaultValue: 'Allergies' })}
            </Text>
            <OptionChipGroup
              options={ALLERGY_SEND_OPTIONS}
              selectedValue={allergySend}
              onSelect={setAllergySend}
              getLabel={getStaticOptionLabel}
            />

            {allergySend === 'yes' ? (
              <View style={styles.allergySection}>
                <Text style={styles.fieldLabel}>
                  {t('aiDesign.allergyNoteLabel', { defaultValue: 'Allergy note' })}
                </Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  value={allergyNote}
                  onChangeText={setAllergyNote}
                  multiline
                  placeholder={t('aiDesign.allergyNotePlaceholder', {
                    defaultValue: 'Add any note about your allergy if needed.',
                  })}
                  placeholderTextColor={COLORS.textLight}
                />

                <Text style={styles.fieldLabel}>
                  {t('aiDesign.allergySearchLabel', {
                    defaultValue: 'Select allergic plants',
                  })}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={allergyKeyword}
                  onChangeText={setAllergyKeyword}
                  placeholder={t('aiDesign.allergySearchPlaceholder', {
                    defaultValue: 'Search active plants to exclude...',
                  })}
                  placeholderTextColor={COLORS.textLight}
                />

                {selectedAllergyPlants.length > 0 ? (
                  <View style={styles.selectedAllergyList}>
                    {selectedAllergyPlants.map((plant) => (
                      <TouchableOpacity
                        key={plant.id}
                        style={styles.selectedAllergyChip}
                        onPress={() => toggleAllergyPlant(plant)}
                      >
                        <Text style={styles.selectedAllergyChipText}>{plant.name}</Text>
                        <Ionicons name="close" size={14} color={COLORS.primaryDark} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.helperText}>
                    {t('aiDesign.allergySelectionEmpty', {
                      defaultValue: 'No allergic plants selected yet.',
                    })}
                  </Text>
                )}

                {isLoadingAllergyPlants ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loadingText}>
                      {t('common.loading', { defaultValue: 'Loading...' })}
                    </Text>
                  </View>
                ) : allergyError ? (
                  <Text style={styles.errorInlineText}>{allergyError}</Text>
                ) : allergyPlants.length === 0 ? (
                  <Text style={styles.helperText}>
                    {t('aiDesign.allergyEmpty', {
                      defaultValue: 'No active plants found for this search.',
                    })}
                  </Text>
                ) : (
                  <View style={styles.allergyResultsList}>
                    {allergyPlants.map((plant) => {
                      const isSelected = selectedAllergyPlantIds.has(plant.id);

                      return (
                        <TouchableOpacity
                          key={plant.id}
                          style={[
                            styles.allergyPlantItem,
                            isSelected && styles.allergyPlantItemSelected,
                          ]}
                          onPress={() => toggleAllergyPlant(plant)}
                        >
                          <View style={styles.allergyPlantInfo}>
                            <Text style={styles.allergyPlantName}>{plant.name}</Text>
                            {plant.scientificName ? (
                              <Text style={styles.allergyPlantScientificName}>
                                {plant.scientificName}
                              </Text>
                            ) : null}
                          </View>
                          <Ionicons
                            name={
                              isSelected ? 'checkmark-circle' : 'ellipse-outline'
                            }
                            size={18}
                            color={isSelected ? COLORS.primary : COLORS.gray500}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}
          </SectionCard>

          {analysisError ? (
            <View style={styles.feedbackCard}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
              <Text style={styles.feedbackErrorText}>{analysisError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryActionButton,
              isAnalyzing && styles.primaryActionButtonDisabled,
            ]}
            onPress={() => void handleAnalyzeRoom()}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="sparkles-outline" size={20} color={COLORS.white} />
            )}
            <Text style={styles.primaryActionButtonText}>
              {isAnalyzing
                ? t('aiDesign.analyzing', {
                    defaultValue: 'Analyzing room...',
                  })
                : t('aiDesign.analyzeButton', {
                    defaultValue: 'Analyze room',
                  })}
            </Text>
          </TouchableOpacity>

          {analysisResult ? (
            <>
              <SectionCard
                title={t('aiDesign.resultsTitle', {
                  defaultValue: 'Analysis result',
                })}
                subtitle={
                  analysisResult.summary ??
                  t('aiDesign.resultsSubtitle', {
                    defaultValue:
                      'Recommended plants are ready. You can shop right away or generate layout images.',
                  })
                }
              >
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t('aiDesign.layoutDesignIdLabel', {
                      defaultValue: 'Layout design ID',
                    })}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {analysisResult.layoutDesignId ?? '-'}
                  </Text>
                </View>

                {analysisResult.roomAnalysis?.availableSpace ? (
                  <Text style={styles.recommendationMeta}>
                    {`${t('aiDesign.roomAnalysisAvailableSpace', {
                      defaultValue: 'Available space',
                    })}: ${analysisResult.roomAnalysis.availableSpace}`}
                  </Text>
                ) : null}
                {analysisResult.roomAnalysis?.colorPalette &&
                analysisResult.roomAnalysis.colorPalette.length > 0 ? (
                  <Text style={styles.recommendationMeta}>
                    {`${t('aiDesign.roomAnalysisColorPalette', {
                      defaultValue: 'Color palette',
                    })}: ${analysisResult.roomAnalysis.colorPalette.join(', ')}`}
                  </Text>
                ) : null}
                {analysisResult.processingTimeMs != null ? (
                  <Text style={styles.helperText}>
                    {`${t('aiDesign.processingTimeLabel', {
                      defaultValue: 'Processing time',
                    })}: ${analysisResult.processingTimeMs} ms`}
                  </Text>
                ) : null}

                {analysisPreviewImages.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.analysisImageList}
                  >
                    {analysisPreviewImages.map((imageUrl) => (
                      <TouchableOpacity
                        key={imageUrl}
                        onPress={() => setFullScreenImage(imageUrl)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.analysisPreviewImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : null}
              </SectionCard>

              <SectionCard
                title={t('aiDesign.generatedImagesTitle', {
                  defaultValue: 'Generated layout images',
                })}
                subtitle={t('aiDesign.generatedImagesSubtitle', { 
                  defaultValue:
                    'Generate images after analysis to visualize the recommendations in your room. Generated images are based on the layout design created by AI, which may take a few minutes to be ready after analysis.',
                })}
                collapsible
              >
                <TouchableOpacity
                  style={[
                    styles.primaryActionButton,
                    (!analysisResult.layoutDesignId || isGeneratingImages) &&
                      styles.primaryActionButtonDisabled,
                  ]}
                  onPress={() => void handleGenerateImages()}
                  disabled={!analysisResult.layoutDesignId || isGeneratingImages}
                >
                  {isGeneratingImages ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={COLORS.white} />
                  )}
                  <Text style={styles.primaryActionButtonText}>
                    {isGeneratingImages
                      ? t('aiDesign.generatingImages', {
                          defaultValue: 'Generating images...',
                        })
                      : t('aiDesign.generateImagesButton', {
                          defaultValue: 'Generate images',
                        })}
                  </Text>
                </TouchableOpacity>

                {analysisResult.layoutDesignId ? (
                  <TouchableOpacity
                    style={styles.retryGeneratedImagesButton}
                    onPress={handleRetryGeneratedImages}
                    disabled={isLoadingGeneratedImages}
                  >
                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.retryGeneratedImagesButtonText}>
                      {t('common.retry', { defaultValue: 'Retry' })}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {isLoadingGeneratedImages ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loadingText}>
                      {t('aiDesign.generatedImagesLoading', {
                        defaultValue: 'Checking generated images...',
                      })}
                    </Text>
                  </View>
                ) : null}

                {generatedImagesError ? (
                  <Text style={styles.errorInlineText}>{generatedImagesError}</Text>
                ) : null}

                {generatedImages.length > 0 ? (
                  <View style={styles.generatedImageList}>
                    {generatedImages.map((item) => {
                      const isAddingToCart =
                        activeRecommendationActionId === `cart-${item.id}`;
                      const isBuyingNow =
                        activeRecommendationActionId === `buy-${item.id}`;
                      const canAddToCart =
                        typeof item.commonPlantId === 'number' && item.commonPlantId > 0;
                      const canBuyNow =
                        typeof item.plantInstanceId === 'number' && item.plantInstanceId > 0;

                      return (
                        <View key={item.id} style={styles.generatedImageCard}>
                          <TouchableOpacity
                            onPress={() => setFullScreenImage(item.imageUrl)}
                            activeOpacity={0.85}
                          >
                            <Image
                              source={{ uri: item.imageUrl }}
                              style={styles.generatedImage}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>

                          {(item.placementPosition || canAddToCart || canBuyNow) ? (
                            <View style={styles.recommendationBody}>
                              {item.placementPosition ? (
                                <Text style={styles.recommendationMeta}>
                                  {`${t('aiDesign.placementPositionLabel', {
                                    defaultValue: 'Placement',
                                  })}: ${item.placementPosition}`}
                                </Text>
                              ) : null}

                              <View style={styles.recommendationActions}>
                                {canAddToCart ? (
                                  <TouchableOpacity
                                    style={[
                                      styles.secondaryActionButton,
                                      isAddingToCart && styles.secondaryActionButtonDisabled,
                                    ]}
                                    onPress={() => void handleAddRecommendationToCart(item, true)}
                                    disabled={isAddingToCart}
                                  >
                                    {isAddingToCart ? (
                                      <ActivityIndicator size="small" color={COLORS.primary} />
                                    ) : null}
                                    <Text style={styles.secondaryActionButtonText}>
                                      {t('plantDetail.addToCart', {
                                        defaultValue: 'Add to cart',
                                      })}
                                    </Text>
                                  </TouchableOpacity>
                                ) : null}

                                {canBuyNow ? (
                                  <TouchableOpacity
                                    style={[
                                      styles.primaryCompactButton,
                                      isBuyingNow && styles.primaryCompactButtonDisabled,
                                    ]}
                                    onPress={() => void handleBuyRecommendationNow(item, true)}
                                    disabled={isBuyingNow}
                                  >
                                    {isBuyingNow ? (
                                      <ActivityIndicator size="small" color={COLORS.white} />
                                    ) : null}
                                    <Text style={styles.primaryCompactButtonText}>
                                      {t('plantDetail.buyNow', {
                                        defaultValue: 'Buy now',
                                      })}
                                    </Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </SectionCard>

              <SectionCard
                title={t('aiDesign.recommendationsTitle', {
                  defaultValue: 'Recommended plants',
                })}
                subtitle={t('aiDesign.recommendationsSubtitle', {
                  defaultValue:
                    'Add to cart or buy now when a recommendation includes a common plant or plant instance. Shown below generated layout images.',
                })}
              >
                {analysisResult.recommendations.length === 0 ? (
                  <Text style={styles.helperText}>
                    {t('aiDesign.recommendationsEmpty', {
                      defaultValue: 'No recommendations were returned for this room.',
                    })}
                  </Text>
                ) : (
                  <View style={styles.recommendationList}>
                    {analysisResult.recommendations.map((recommendation) => {
                      const isAddingToCart =
                        activeRecommendationActionId === `cart-${recommendation.id}`;
                      const isBuyingNow =
                        activeRecommendationActionId === `buy-${recommendation.id}`;
                      const purchasable = recommendation.isPurchasable !== false;
                      const canAddToCart =
                        purchasable &&
                        typeof recommendation.commonPlantId === 'number' &&
                        recommendation.commonPlantId > 0;
                      const canBuyNow =
                        purchasable &&
                        typeof recommendation.plantInstanceId === 'number' &&
                        recommendation.plantInstanceId > 0;

                      return (
                        <View
                          key={recommendation.id}
                          style={styles.recommendationCard}
                        >
                          {recommendation.imageUrl ? (
                            <TouchableOpacity
                              activeOpacity={0.85}
                              onPress={() => setFullScreenImage(recommendation.imageUrl!)}
                              style={{ width: '100%' }}
                            >
                              <Image
                                source={{ uri: recommendation.imageUrl }}
                                style={styles.recommendationImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.recommendationImagePlaceholder}>
                              <Ionicons
                                name="leaf-outline"
                                size={28}
                                color={COLORS.primary}
                              />
                            </View>
                          )}

                          <View style={styles.recommendationBody}>
                            <Text style={styles.recommendationName}>
                              {recommendation.name}
                            </Text>
                            {recommendation.plantReason || recommendation.description ? (
                              <Text style={styles.recommendationReason}>
                                {recommendation.plantReason ?? recommendation.description}
                              </Text>
                            ) : null}
                            {recommendation.placementPosition ? (
                              <Text style={styles.recommendationMeta}>
                                {`${t('aiDesign.placementPositionLabel', {
                                  defaultValue: 'Placement',
                                })}: ${recommendation.placementPosition}`}
                              </Text>
                            ) : null}
                            {recommendation.placementReason ? (
                              <Text style={styles.recommendationMeta}>
                                {`${t('aiDesign.placementReasonLabel', {
                                  defaultValue: 'Placement reason',
                                })}: ${recommendation.placementReason}`}
                              </Text>
                            ) : null}
                            {recommendation.price != null ||
                            recommendation.specificPrice != null ? (
                              <Text style={styles.recommendationPrice}>
                                {`${(
                                  recommendation.specificPrice ??
                                  recommendation.price ??
                                  0
                                ).toLocaleString(locale)}d`}
                              </Text>
                            ) : null}

                            <View style={styles.recommendationActions}>
                              {canAddToCart ? (
                                <TouchableOpacity
                                  style={[
                                    styles.secondaryActionButton,
                                    isAddingToCart &&
                                      styles.secondaryActionButtonDisabled,
                                  ]}
                                  onPress={() =>
                                    void handleAddRecommendationToCart(recommendation)
                                  }
                                  disabled={isAddingToCart}
                                >
                                  {isAddingToCart ? (
                                    <ActivityIndicator
                                      size="small"
                                      color={COLORS.primary}
                                    />
                                  ) : null}
                                  <Text style={styles.secondaryActionButtonText}>
                                    {t('plantDetail.addToCart', {
                                      defaultValue: 'Add to cart',
                                    })}
                                  </Text>
                                </TouchableOpacity>
                              ) : null}

                              {canBuyNow ? (
                                <TouchableOpacity
                                  style={[
                                    styles.primaryCompactButton,
                                    isBuyingNow && styles.primaryCompactButtonDisabled,
                                  ]}
                                  onPress={() =>
                                    void handleBuyRecommendationNow(recommendation)
                                  }
                                  disabled={isBuyingNow}
                                >
                                  {isBuyingNow ? (
                                    <ActivityIndicator
                                      size="small"
                                      color={COLORS.white}
                                    />
                                  ) : null}
                                  <Text style={styles.primaryCompactButtonText}>
                                    {t('plantDetail.buyNow', {
                                      defaultValue: 'Buy now',
                                    })}
                                  </Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>

                            {!canAddToCart && !canBuyNow ? (
                              <Text style={styles.helperText}>
                                {t('aiDesign.recommendationActionUnavailable', {
                                  defaultValue:
                                    'Purchase action is unavailable for this recommendation.',
                                })}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </SectionCard>
            </>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(fullScreenImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View style={styles.fullImageModalOverlay}>
          <TouchableOpacity
            style={styles.fullImageCloseButton}
            onPress={() => setFullScreenImage(null)}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          {fullScreenImage ? (
            <Image
              source={{ uri: fullScreenImage }}
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
    backgroundColor: '#F6F8F6',
  },
  header: {
    paddingHorizontal: SPACING.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  gateWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  gateCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOWS.md,
  },
  gateTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  gateMessage: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS['2xl'],
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  sectionHeader: {
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  sectionContent: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  selectedImageWrap: {
    gap: SPACING.md,
  },
  selectedImage: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.gray100,
  },
  selectedImageActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  imageSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  imageSecondaryButtonSmall: {
    flex: 0,
    minWidth: 84,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  imageSecondaryButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  imagePickerRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  imageGrid: {
    gap: SPACING.md,
  },
  imageGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  imageGridCard: {
    flexBasis: '48%',
  },
  imagePickerCard: {
    flex: 1,
    minHeight: 148,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderStyle: 'dashed',
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  imagePickerCardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  optionChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionChipText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  optionChipTextActive: {
    color: COLORS.white,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  budgetField: {
    flex: 1,
    gap: SPACING.xs,
  },
  textInput: {
    minHeight: 46,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    paddingHorizontal: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  multilineInput: {
    minHeight: 92,
    paddingTop: SPACING.md,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  toggleLabel: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  allergySection: {
    gap: SPACING.md,
  },
  selectedAllergyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  selectedAllergyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  selectedAllergyChipText: {
    color: COLORS.primaryDark,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  allergyResultsList: {
    gap: SPACING.sm,
  },
  preferredNurseryList: {
    maxHeight: 280,
    marginTop: SPACING.sm,
  },
  allergyPlantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  allergyPlantItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  allergyPlantInfo: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  allergyPlantName: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  allergyPlantScientificName: {
    marginTop: 2,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  primaryActionButton: {
    minHeight: 52,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.md,
  },
  primaryActionButtonDisabled: {
    opacity: 0.6,
  },
  primaryActionButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#FFC9C5',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  feedbackErrorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  summaryLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  analysisImageList: {
    gap: SPACING.sm,
  },
  analysisPreviewImage: {
    width: 150,
    height: 110,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  recommendationList: {
    gap: SPACING.md,
  },
  recommendationCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    overflow: 'hidden',
  },
  recommendationImage: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.gray100,
  },
  recommendationImagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationBody: {
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  recommendationName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  recommendationReason: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  recommendationMeta: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 19,
    color: COLORS.gray700,
  },
  recommendationPrice: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  recommendationActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  secondaryActionButtonDisabled: {
    opacity: 0.65,
  },
  secondaryActionButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  primaryCompactButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  primaryCompactButtonDisabled: {
    opacity: 0.75,
  },
  primaryCompactButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  retryGeneratedImagesButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  retryGeneratedImagesButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  errorInlineText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  generatedImageList: {
    gap: SPACING.md,
  },
  generatedImageCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    overflow: 'hidden',
  },
  generatedImage: {
    width: '100%',
    height: 220,
    backgroundColor: COLORS.gray100,
  },
  generatedImageMeta: {
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  generatedImagePrompt: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  generatedImageSource: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
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
    zIndex: 10,
  },
  fullImagePreview: {
    width: '100%',
    height: '100%',
  },
});
