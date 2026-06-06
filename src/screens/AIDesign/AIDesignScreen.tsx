import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Switch,
  View,
  Modal,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { BrandedHeader } from "../../components/branding";
import { API, COLORS, FONTS, RADIUS, SHADOWS, SPACING } from "../../constants";
import { enumService, plantService, roomDesignService } from "../../services";
import { useAuthStore, useCartStore } from "../../stores";
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
} from "../../types";
import { isCustomerRole } from "../../utils/authFlow";
import { notify, resolveImageUris } from "../../utils";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type AIDesignRouteProp = RouteProp<RootStackParamList, "AIDesign">;

type StaticOption<Value extends string> = {
  value: Value;
  apiValue: string;
  labelKey: string;
  fallbackLabel: string;
};

type FengShuiValue = "Metal" | "Wood" | "Water" | "Fire" | "Earth";
type FengShuiSelection = "omit" | FengShuiValue;
type CareLevelValue = "Easy" | "Medium" | "Hard";
type CareLevelSelection = "omit" | CareLevelValue;
type AllergySendMode = "no" | "yes";

const FALLBACK_ROOM_TYPE_NAMES: readonly string[] = [
  "LivingRoom",
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "HomeOffice",
  "Balcony",
  "Corridor",
  "DiningRoom",
];

const FALLBACK_ROOM_STYLE_NAMES: readonly string[] = [
  "Minimalist",
  "Scandinavian",
  "Tropical",
  "Industrial",
  "Bohemian",
  "Modern",
  "Japanese",
  "Mediterranean",
  "Rustic",
];

const FALLBACK_LIGHT_DIRECTIONS: readonly string[] = [
  "North",
  "South",
  "East",
  "West",
  "NorthEast",
  "NorthWest",
  "SouthEast",
  "SouthWest",
];
const FALLBACK_NATURAL_LIGHT_LEVELS: readonly string[] = [
  "LowLight",
  "IndirectLight",
  "PartialSun",
  "FullSun",
];

const ALLERGY_SEARCH_TAKE = 50;
const ALLERGY_SEARCH_DEBOUNCE_MS = 350;
const GENERATED_IMAGES_POLL_INTERVAL_MS = 3000;
const GENERATED_IMAGES_MAX_ATTEMPTS = 8;
const MAX_ROOM_PHOTOS = 4;

const FENG_SHUI_OPTIONS: StaticOption<FengShuiSelection>[] = [
  {
    value: "omit",
    apiValue: "",
    labelKey: "aiDesign.filterUnspecified",
    fallbackLabel: "Any",
  },
  {
    value: "Metal",
    apiValue: "Metal",
    labelKey: "catalog.fengShuiMetal",
    fallbackLabel: "Metal",
  },
  {
    value: "Wood",
    apiValue: "Wood",
    labelKey: "catalog.fengShuiWood",
    fallbackLabel: "Wood",
  },
  {
    value: "Water",
    apiValue: "Water",
    labelKey: "catalog.fengShuiWater",
    fallbackLabel: "Water",
  },
  {
    value: "Fire",
    apiValue: "Fire",
    labelKey: "catalog.fengShuiFire",
    fallbackLabel: "Fire",
  },
  {
    value: "Earth",
    apiValue: "Earth",
    labelKey: "catalog.fengShuiEarth",
    fallbackLabel: "Earth",
  },
];

const CARE_LEVEL_OPTIONS: StaticOption<CareLevelSelection>[] = [
  {
    value: "omit",
    apiValue: "",
    labelKey: "aiDesign.filterUnspecified",
    fallbackLabel: "Any",
  },
  {
    value: "Easy",
    apiValue: "Easy",
    labelKey: "plantDetail.careEasy",
    fallbackLabel: "Easy",
  },
  {
    value: "Medium",
    apiValue: "Medium",
    labelKey: "plantDetail.careMedium",
    fallbackLabel: "Medium",
  },
  {
    value: "Hard",
    apiValue: "Hard",
    labelKey: "plantDetail.careHard",
    fallbackLabel: "Hard",
  },
];

const ALLERGY_SEND_OPTIONS: StaticOption<AllergySendMode>[] = [
  {
    value: "no",
    apiValue: "",
    labelKey: "aiDesign.allergySendNo",
    fallbackLabel: "No allergies",
  },
  {
    value: "yes",
    apiValue: "",
    labelKey: "aiDesign.allergySendYes",
    fallbackLabel: "Exclude plants",
  },
];

const FENG_SHUI_ELEMENT_NOTES: Record<FengShuiValue, string> = {
  Metal: "Metal element suits clean, bright, and structured spaces.",
  Wood: "Wood element suits fresh, growing, and natural spaces.",
  Water: "Water element suits calm, flowing, and soft spaces.",
  Fire: "Fire element suits energetic, warm, and expressive spaces.",
  Earth: "Earth element suits stable, grounded, and balanced spaces.",
};

type SectionCardProps = {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

function SectionCard({
  title,
  subtitle,
  headerRight,
  children,
  collapsible,
  defaultCollapsed,
}: SectionCardProps) {
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
          {headerRight ? (
            <View style={styles.sectionHeaderRight}>{headerRight}</View>
          ) : null}
          {collapsible ? (
            <Ionicons
              name={isCollapsed ? "chevron-down" : "chevron-up"}
              size={20}
              color={COLORS.textPrimary}
            />
          ) : null}
        </View>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </TouchableOpacity>
      {!isCollapsed ? (
        <View style={styles.sectionContent}>{children}</View>
      ) : null}
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
  name
    .replace(/([A-Z])/g, " $1")
    .replace(/^\s+/, "")
    .trim();

const normalizeRoomTypeToken = (value: string | null | undefined): string =>
  (value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();

const isNotRelatedRoomType = (value: string | null | undefined): boolean =>
  normalizeRoomTypeToken(value) === "notrelated";

type StringChipOption = { value: string; label: string };

type WizardStep = {
  id: 1 | 2 | 3 | 4 | 5;
  label: string;
};

type RoomSelectField =
  | "roomType"
  | "roomStyle"
  | "fengShuiElement"
  | "preferredNursery";

function SelectListField({
  label,
  valueLabel,
  placeholder,
  onPress,
  disabled,
}: {
  label: string;
  valueLabel: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const hasValue = valueLabel.trim().length > 0;

  return (
    <View style={styles.selectFieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.selectListButton,
          disabled && styles.selectListButtonDisabled,
        ]}
        onPress={() => {
          if (!disabled) onPress();
        }}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.selectListButtonText,
            !hasValue && styles.selectListPlaceholderText,
            disabled && styles.selectListButtonTextDisabled,
          ]}
          numberOfLines={1}
        >
          {hasValue ? valueLabel : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

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

function WizardStepper({
  steps,
  currentStep,
  onStepPress,
}: {
  steps: WizardStep[];
  currentStep: number;
  onStepPress: (stepId: number) => void;
}) {
  return (
    <View style={styles.stepperWrap}>
      {steps.map((step, index) => {
        const isCompleted = step.id < currentStep;
        const isCurrent = step.id === currentStep;
        const canPress = step.id <= currentStep;

        return (
          <View key={step.id} style={styles.stepperItem}>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!canPress}
              onPress={() => onStepPress(step.id)}
              style={[
                styles.stepCircle,
                isCompleted && styles.stepCircleCompleted,
                isCurrent && styles.stepCircleCurrent,
              ]}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={14} color={COLORS.white} />
              ) : (
                <Text
                  style={[
                    styles.stepCircleText,
                    (isCompleted || isCurrent) && styles.stepCircleTextActive,
                  ]}
                >
                  {step.id}
                </Text>
              )}
            </TouchableOpacity>

            <Text
              style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent]}
              numberOfLines={1}
            >
              {step.label}
            </Text>

            {index < steps.length - 1 ? (
              <View
                style={[
                  styles.stepConnector,
                  step.id < currentStep && styles.stepConnectorCompleted,
                ]}
              />
            ) : null}
          </View>
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
    if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
      return apiMessage;
    }

    return error.message;
  }

  const responseError = error as {
    response?: { data?: { message?: string } };
  };
  const apiMessage = responseError?.response?.data?.message;
  if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
    return apiMessage;
  }

  return fallbackMessage;
};

const parseBudgetValue = (value: string): number | null => {
  const normalized = value.replace(/[^0-9.,]/g, "").replace(/,/g, "");
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

const dedupeImageList = (
  images: Array<string | null | undefined>,
): string[] => {
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
  const route = useRoute<AIDesignRouteProp>();
  const insets = useSafeAreaInsets();
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userProfile = useAuthStore((state) => state.user);
  const userRole = useAuthStore((state) => state.user?.role);
  const addCartItem = useCartStore((state) => state.addCartItem);

  const isCustomer = isCustomerRole(userRole);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  type RoomPhotoSlot = {
    slotIndex: number;
    localImage?: RoomDesignImageFile | null;
    previewUri?: string | null;
    roomImageId?: number | null;
    imageUrl?: string | null;
    moderationStatus?: string | null;
    moderationReason?: string | null;
    uploadedAt?: string | null;
    uploading?: boolean;
    error?: string | null;
  };

  const createEmptyRoomPhotoSlots = useCallback(
    (): RoomPhotoSlot[] =>
      Array.from({ length: MAX_ROOM_PHOTOS }, (_, index) => ({
        slotIndex: index + 1,
        localImage: null,
        previewUri: null,
        roomImageId: null,
        imageUrl: null,
        moderationStatus: null,
        moderationReason: null,
        uploadedAt: null,
        uploading: false,
        error: null,
      })),
    [],
  );

  const [roomPhotos, setRoomPhotos] = useState<RoomPhotoSlot[]>(() =>
    createEmptyRoomPhotoSlots(),
  );
  const [fengShuiSelection, setFengShuiSelection] =
    useState<FengShuiSelection>("omit");
  const [roomTypeNames, setRoomTypeNames] = useState<string[]>(() => [
    ...FALLBACK_ROOM_TYPE_NAMES,
  ]);
  const [roomStyleNames, setRoomStyleNames] = useState<string[]>(() => [
    ...FALLBACK_ROOM_STYLE_NAMES,
  ]);
  const [roomType, setRoomType] = useState("LivingRoom");
  const [roomStyle, setRoomStyle] = useState("Minimalist");
  const [roomArea, setRoomArea] = useState("");

  const [useProfileFengShui, setUseProfileFengShui] = useState(true);

  const [detectedRoomType, setDetectedRoomType] = useState<string | null>(null);
  const [isDetectingRoomType, setIsDetectingRoomType] = useState(false);
  const [userOverrodeRoomType, setUserOverrodeRoomType] = useState(false);

  const [lightDirectionNames, setLightDirectionNames] = useState<string[]>(
    () => [...FALLBACK_LIGHT_DIRECTIONS],
  );
  const [naturalLightLevelNames, setNaturalLightLevelNames] = useState<
    string[]
  >(() => [...FALLBACK_NATURAL_LIGHT_LEVELS]);

  const [lightDirection, setLightDirection] = useState("omit");
  const [naturalLightLevel, setNaturalLightLevel] = useState("omit");

  const [careLevelSelection, setCareLevelSelection] =
    useState<CareLevelSelection>("omit");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [allergySend, setAllergySend] = useState<AllergySendMode>("no");
  const [petSafe, setPetSafe] = useState(false);
  const [childSafe, setChildSafe] = useState(false);
  const [preferredNurseries, setPreferredNurseries] = useState<Nursery[]>([]);
  const [isLoadingPreferredNurseries, setIsLoadingPreferredNurseries] =
    useState(false);
  const [preferredNurseriesError, setPreferredNurseriesError] = useState<
    string | null
  >(null);
  const [selectedPreferredNurseryIds, setSelectedPreferredNurseryIds] =
    useState<number[]>([]);
  const [allergyNote, setAllergyNote] = useState("");
  const [allergyKeyword, setAllergyKeyword] = useState("");
  const [allergyPlants, setAllergyPlants] = useState<RoomDesignAllergyPlant[]>(
    [],
  );
  const [selectedAllergyPlants, setSelectedAllergyPlants] = useState<
    RoomDesignAllergyPlant[]
  >([]);
  const [isLoadingAllergyPlants, setIsLoadingAllergyPlants] = useState(false);
  const [allergyError, setAllergyError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<RoomDesignAnalyzeResult | null>(null);
  const [activeRecommendationActionId, setActiveRecommendationActionId] =
    useState<string | null>(null);
  const [isRoomPhotoSourceModalVisible, setIsRoomPhotoSourceModalVisible] =
    useState(false);
  const [pendingRoomPhotoSlotIndex, setPendingRoomPhotoSlotIndex] = useState<
    number | null
  >(null);
  const [activeRoomSelectField, setActiveRoomSelectField] =
    useState<RoomSelectField | null>(null);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isLoadingGeneratedImages, setIsLoadingGeneratedImages] =
    useState(false);
  const [generatedImages, setGeneratedImages] = useState<
    RoomDesignGeneratedImage[]
  >([]);
  const [generatedImagesError, setGeneratedImagesError] = useState<
    string | null
  >(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const allergySearchRequestId = useRef(0);
  const generatedImagesPollTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const selectedAllergyPlantIds = useMemo(
    () => new Set(selectedAllergyPlants.map((plant) => plant.id)),
    [selectedAllergyPlants],
  );

  const preferredNurseryIdSet = useMemo(
    () => new Set(selectedPreferredNurseryIds),
    [selectedPreferredNurseryIds],
  );

  const preferredNurserySummaryLabel = useMemo(() => {
    if (selectedPreferredNurseryIds.length === 0) {
      return "";
    }

    const selectedNames = selectedPreferredNurseryIds
      .map((id) => preferredNurseries.find((nursery) => nursery.id === id)?.name)
      .filter((name): name is string => Boolean(name && name.trim().length > 0));

    if (selectedNames.length === 0) {
      return t("aiDesign.preferredNurseriesSelectedCount", {
        defaultValue: `${selectedPreferredNurseryIds.length} selected`,
        count: selectedPreferredNurseryIds.length,
      });
    }

    if (selectedNames.length === 1) {
      return selectedNames[0];
    }

    return t("aiDesign.preferredNurseriesSelectedCount", {
      defaultValue: `${selectedNames.length} selected`,
      count: selectedNames.length,
    });
  }, [preferredNurseries, selectedPreferredNurseryIds, t]);

  const roomTypeChipOptions = useMemo(
    () =>
      roomTypeNames.map((name) => ({
        value: name,
        label: t(`aiDesign.roomType.${name}`, {
          defaultValue: formatEnumNameDefault(name),
        }),
      })),
    [roomTypeNames, t],
  );

  const roomStyleChipOptions = useMemo(
    () =>
      roomStyleNames.map((name) => ({
        value: name,
        label: t(`aiDesign.roomStyle.${name}`, {
          defaultValue: formatEnumNameDefault(name),
        }),
      })),
    [roomStyleNames, t],
  );

  const roomTypeDisplayLabel = useMemo(
    () =>
      roomTypeChipOptions.find((option) => option.value === roomType)?.label ??
      formatEnumNameDefault(roomType),
    [roomType, roomTypeChipOptions],
  );

  const roomStyleDisplayLabel = useMemo(
    () =>
      roomStyleChipOptions.find((option) => option.value === roomStyle)
        ?.label ?? formatEnumNameDefault(roomStyle),
    [roomStyle, roomStyleChipOptions],
  );

  const userFengShuiElement = useMemo<FengShuiValue | null>(() => {
    const rawValue = userProfile?.fengShuiElementName ?? userProfile?.fengShuiElement;
    if (typeof rawValue === "string") {
      const normalized = rawValue.trim().toLowerCase();
      if (!normalized) {
        return null;
      }

      const matched = FENG_SHUI_OPTIONS.find(
        (option) => option.value.toLowerCase() === normalized,
      );
      return (matched?.value as FengShuiValue | undefined) ?? null;
    }

    if (typeof rawValue === "number") {
      const matched = FENG_SHUI_OPTIONS.find(
        (option) => option.apiValue.toLowerCase() === String(rawValue).toLowerCase(),
      );
      return (matched?.value as FengShuiValue | undefined) ?? null;
    }

    return null;
  }, [userProfile?.fengShuiElement, userProfile?.fengShuiElementName]);

  const userFengShuiElementLabel = useMemo(
    () => {
      const matchedOption = FENG_SHUI_OPTIONS.find(
        (option) => option.value === userFengShuiElement,
      );

      return matchedOption
        ? t(matchedOption.labelKey, { defaultValue: matchedOption.fallbackLabel })
        : userFengShuiElement
          ? formatEnumNameDefault(userFengShuiElement)
          : "";
    },
    [t, userFengShuiElement],
  );

  const resolvedFengShuiElement = useMemo(() => {
    if (useProfileFengShui && userFengShuiElement) {
      return userFengShuiElement;
    }

    return fengShuiSelection === "omit" ? null : fengShuiSelection;
  }, [fengShuiSelection, useProfileFengShui, userFengShuiElement]);

  const resolvedFengShuiLabel = useMemo(() => {
    if (useProfileFengShui && userFengShuiElement) {
      return userFengShuiElementLabel;
    }

    return fengShuiSelection === "omit"
      ? ""
      : t(
          FENG_SHUI_OPTIONS.find((option) => option.value === fengShuiSelection)
            ?.labelKey ?? "aiDesign.filterUnspecified",
          {
            defaultValue:
              FENG_SHUI_OPTIONS.find((option) => option.value === fengShuiSelection)
                ?.fallbackLabel ?? formatEnumNameDefault(fengShuiSelection),
          },
        );
  }, [fengShuiSelection, t, userFengShuiElement, userFengShuiElementLabel, useProfileFengShui]);

  const isUsingProfileFengShui = useProfileFengShui && Boolean(userFengShuiElement);

  const lightDirectionChipOptions = useMemo(
    () => [
      {
        value: "omit",
        label: t("aiDesign.filterUnspecified", { defaultValue: "Any" }),
      },
      ...lightDirectionNames.map((name) => ({
        value: name,
        label: t(`aiDesign.lightDirection.${name}`, {
          defaultValue: formatEnumNameDefault(name),
        }),
      })),
    ],
    [lightDirectionNames, t],
  );

  const naturalLightLevelChipOptions = useMemo(
    () => [
      {
        value: "omit",
        label: t("aiDesign.filterUnspecified", { defaultValue: "Any" }),
      },
      ...naturalLightLevelNames.map((name) => ({
        value: name,
        label: t(`aiDesign.naturalLightLevel.${name}`, {
          defaultValue: formatEnumNameDefault(name),
        }),
      })),
    ],
    [naturalLightLevelNames, t],
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

        const roomTypeGroup = groups.find((g) => g.enumName === "RoomType");
        const roomStyleGroup = groups.find((g) => g.enumName === "RoomStyle");
        const lightDirGroup = groups.find(
          (g) => g.enumName === "LightDirection",
        );
        const natLightGroup = groups.find(
          (g) =>
            g.enumName === "LightRequirement" ||
            g.enumName === "NaturalLightLevel",
        );

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
        const nl =
          natLightGroup?.values
            .map((v) => v.name.trim())
            .filter((n) => n.length > 0) ?? [];

        setRoomTypeNames(rt.length > 0 ? rt : [...FALLBACK_ROOM_TYPE_NAMES]);
        setRoomStyleNames(rs.length > 0 ? rs : [...FALLBACK_ROOM_STYLE_NAMES]);
        setLightDirectionNames(
          ld.length > 0 ? ld : [...FALLBACK_LIGHT_DIRECTIONS],
        );
        setNaturalLightLevelNames(
          nl.length > 0 ? nl : [...FALLBACK_NATURAL_LIGHT_LEVELS],
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setRoomTypeNames([...FALLBACK_ROOM_TYPE_NAMES]);
        setRoomStyleNames([...FALLBACK_ROOM_STYLE_NAMES]);
        setLightDirectionNames([...FALLBACK_LIGHT_DIRECTIONS]);
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
            t("aiDesign.preferredNurseriesLoadFailed", {
              defaultValue: "Unable to load nurseries.",
            }),
          ),
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

    setRoomType(roomTypeNames[0] ?? "LivingRoom");
  }, [roomTypeNames, roomType]);

  useEffect(() => {
    if (roomStyleNames.includes(roomStyle)) {
      return;
    }

    setRoomStyle(roomStyleNames[0] ?? "Minimalist");
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
    ],
  );

  const selectedRoomPhotoCount = useMemo(
    () =>
      roomPhotos.filter((it) => Boolean(it.localImage || it.roomImageId))
        .length,
    [roomPhotos],
  );

  const selectedRoomPhotos = useMemo(
    () => roomPhotos.filter((it) => Boolean(it.localImage || it.roomImageId)),
    [roomPhotos],
  );

  const isDetectedRoomTypeNotRelated = useMemo(
    () => isNotRelatedRoomType(detectedRoomType),
    [detectedRoomType],
  );

  const nextEmptyRoomPhotoSlot = useMemo(
    () => roomPhotos.find((it) => !it.localImage && !it.roomImageId) ?? null,
    [roomPhotos],
  );

  const wizardSteps = useMemo<WizardStep[]>(
    () => [
      {
        id: 1,
        label: t("aiDesign.stepRoomImages", { defaultValue: "Room Images" }),
      },
      {
        id: 2,
        label: t("aiDesign.stepFengShui", { defaultValue: "Feng Shui" }),
      },
      {
        id: 3,
        label: t("aiDesign.stepLighting", { defaultValue: "Lighting" }),
      },
      {
        id: 4,
        label: t("aiDesign.stepBudgetCare", { defaultValue: "Budget & Care" }),
      },
      {
        id: 5,
        label: t("aiDesign.stepResults", { defaultValue: "Results" }),
      },
    ],
    [t],
  );

  const bottomContentInset = insets.bottom + 120;

  const goBackStep = useCallback(() => {
    setCurrentStep((prev) =>
      prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4 | 5) : prev,
    );
  }, []);

  const goToStep = useCallback(
    (stepId: number) => {
      if (stepId < 1 || stepId > 5) {
        return;
      }

      if (stepId > currentStep && !(stepId === 5 && analysisResult)) {
        return;
      }

      setCurrentStep(stepId as 1 | 2 | 3 | 4 | 5);
    },
    [analysisResult, currentStep],
  );

  const getStaticOptionLabel = useCallback(
    <Value extends string>(option: StaticOption<Value>) =>
      t(option.labelKey, { defaultValue: option.fallbackLabel }),
    [t],
  );

  const clearGeneratedImagesPolling = useCallback(() => {
    if (generatedImagesPollTimeoutRef.current) {
      clearTimeout(generatedImagesPollTimeoutRef.current);
      generatedImagesPollTimeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => () => clearGeneratedImagesPolling(),
    [clearGeneratedImagesPolling],
  );

  const handleStartOver = useCallback(() => {
    clearGeneratedImagesPolling();
    setCurrentStep(1);
    setRoomPhotos(createEmptyRoomPhotoSlots());
    setFengShuiSelection("omit");
    setUseProfileFengShui(true);
    setRoomType(roomTypeNames[0] ?? "LivingRoom");
    setRoomStyle(roomStyleNames[0] ?? "Minimalist");
    setRoomArea("");
    setDetectedRoomType(null);
    setIsDetectingRoomType(false);
    setUserOverrodeRoomType(false);
    setLightDirection("omit");
    setNaturalLightLevel("omit");
    setCareLevelSelection("omit");
    setMinBudget("");
    setMaxBudget("");
    setAllergySend("no");
    setPetSafe(false);
    setChildSafe(false);
    setSelectedPreferredNurseryIds([]);
    setAllergyNote("");
    setAllergyKeyword("");
    setAllergyPlants([]);
    setSelectedAllergyPlants([]);
    setIsLoadingAllergyPlants(false);
    setAllergyError(null);
    setIsAnalyzing(false);
    setAnalysisError(null);
    setAnalysisResult(null);
    setActiveRecommendationActionId(null);
    setGeneratedImages([]);
    setGeneratedImagesError(null);
    setIsGeneratingImages(false);
    setIsLoadingGeneratedImages(false);
    setFullScreenImage(null);
  }, [
    clearGeneratedImagesPolling,
    createEmptyRoomPhotoSlots,
    roomStyleNames,
    roomTypeNames,
  ]);

  useEffect(() => {
    if (allergySend === "yes") {
      return;
    }

    setAllergyKeyword("");
    setAllergyNote("");
    setAllergyPlants([]);
    setSelectedAllergyPlants([]);
    setAllergyError(null);
    setIsLoadingAllergyPlants(false);
  }, [allergySend]);

  useEffect(() => {
    if (allergySend !== "yes") {
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
              t("aiDesign.allergyLoadFailed", {
                defaultValue: "Unable to load allergy plants.",
              }),
            ),
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

  const handleSelectImageAsset = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      const normalizedUri = asset.uri?.trim();
      if (!normalizedUri) {
        return null;
      }

      const fileName =
        asset.fileName?.trim() ||
        normalizedUri.split("/").pop() ||
        `room-${Date.now()}.jpg`;
      const mimeType = asset.mimeType?.trim() || "image/jpeg";

      return {
        uri: normalizedUri,
        fileName,
        mimeType,
      };
    },
    [],
  );

  const pickImageFromLibrary =
    useCallback(async (): Promise<RoomDesignImageFile | null> => {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          t("aiDesign.permissionTitle", {
            defaultValue: "Permission required",
          }),
          t("aiDesign.mediaPermissionMessage", {
            defaultValue: "Please grant photo library access.",
          }),
        );
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        return handleSelectImageAsset(result.assets[0]);
      }

      return null;
    }, [handleSelectImageAsset, t]);

  const updateRoomPhotoSlot = useCallback(
    (slotIndex: number, imageFile: RoomDesignImageFile | null) => {
      setRoomPhotos((current) =>
        current.map((slot) =>
          slot.slotIndex === slotIndex
            ? {
                ...slot,
                localImage: imageFile,
                previewUri: imageFile?.uri ?? null,
                roomImageId: null,
                imageUrl: null,
                moderationStatus: null,
                moderationReason: null,
                uploadedAt: null,
                uploading: false,
                error: null,
              }
            : slot,
        ),
      );
    },
    [],
  );

  const clearRoomPhotoSlot = useCallback((slotIndex: number) => {
    setRoomPhotos((current) =>
      current.map((slot) =>
        slot.slotIndex === slotIndex
          ? {
              slotIndex,
              localImage: null,
              previewUri: null,
              roomImageId: null,
              imageUrl: null,
              moderationStatus: null,
              moderationReason: null,
              uploadedAt: null,
              uploading: false,
              error: null,
            }
          : slot,
      ),
    );
  }, []);

  const selectRoomPhotoFromLibrary = useCallback(
    async (slotIndex: number) => {
      const imageFile = await pickImageFromLibrary();
      if (!imageFile) {
        return;
      }

      updateRoomPhotoSlot(slotIndex, imageFile);
    },
    [pickImageFromLibrary, updateRoomPhotoSlot],
  );

  const selectRoomPhotoFromCamera = useCallback(
    async (slotIndex: number) => {
      navigation.navigate("AIDesignCamera", { slotIndex });
    },
    [navigation],
  );

  const openRoomPhotoSourcePicker = useCallback((slotIndex: number) => {
    setPendingRoomPhotoSlotIndex(slotIndex);
    setIsRoomPhotoSourceModalVisible(true);
  }, []);

  const closeRoomPhotoSourcePicker = useCallback(() => {
    setIsRoomPhotoSourceModalVisible(false);
    setPendingRoomPhotoSlotIndex(null);
  }, []);

  const handleRoomPhotoSourceChoice = useCallback(
    async (source: "library" | "camera") => {
      const slotIndex = pendingRoomPhotoSlotIndex;
      if (!slotIndex) {
        closeRoomPhotoSourcePicker();
        return;
      }

      closeRoomPhotoSourcePicker();

      if (source === "library") {
        await selectRoomPhotoFromLibrary(slotIndex);
        return;
      }

      await selectRoomPhotoFromCamera(slotIndex);
    },
    [
      closeRoomPhotoSourcePicker,
      pendingRoomPhotoSlotIndex,
      selectRoomPhotoFromCamera,
      selectRoomPhotoFromLibrary,
    ],
  );

  useEffect(() => {
    const capturedRoomPhoto = route.params?.capturedRoomPhoto;
    if (!capturedRoomPhoto) {
      return;
    }

    updateRoomPhotoSlot(
      capturedRoomPhoto.slotIndex,
      capturedRoomPhoto.imageFile,
    );
    navigation.setParams({ capturedRoomPhoto: undefined });
  }, [navigation, route.params?.capturedRoomPhoto, updateRoomPhotoSlot]);

  const openRoomSelectField = useCallback((field: RoomSelectField) => {
    setActiveRoomSelectField(field);
  }, []);

  const closeRoomSelectField = useCallback(() => {
    setActiveRoomSelectField(null);
  }, []);

  const handleRoomSelectValue = useCallback(
    (value: string) => {
      if (activeRoomSelectField === "roomType") {
        setRoomType(value);
        setUserOverrodeRoomType(true);
      } else if (activeRoomSelectField === "roomStyle") {
        setRoomStyle(value);
      } else if (activeRoomSelectField === "fengShuiElement") {
        setFengShuiSelection(value as FengShuiSelection);
        setUseProfileFengShui(false);
      } else if (activeRoomSelectField === "preferredNursery") {
        const nurseryId = Number(value);
        setSelectedPreferredNurseryIds((current) =>
          current.includes(nurseryId)
            ? current.filter((item) => item !== nurseryId)
            : [...current, nurseryId],
        );
        return;
      }

      closeRoomSelectField();
    },
    [activeRoomSelectField, closeRoomSelectField],
  );

  const selectedLocalImageUrisKey = useMemo(
    () =>
      selectedRoomPhotos
        .map((s) => s.localImage?.uri ?? "")
        .filter((u) => u.length > 0)
        .join("|") ?? "",
    [selectedRoomPhotos],
  );
  const performDetectRoomType = useCallback(
    async (forceLocalImages?: RoomDesignImageFile[]) => {
      const localImages =
        forceLocalImages ??
        selectedRoomPhotos
          .map((s) => s.localImage)
          .filter((it): it is RoomDesignImageFile => Boolean(it));

      if (localImages.length === 0) {
        setDetectedRoomType(null);
        setIsDetectingRoomType(false);
        return null;
      }

      setIsDetectingRoomType(true);
      try {
        const res = await roomDesignService.analyzeRoomOnlyUpload(localImages);
        const rt = res?.roomType?.trim() || null;
        setDetectedRoomType(rt);
        // only set the form value if the user hasn't manually overridden
        if (rt && !isNotRelatedRoomType(rt) && !userOverrodeRoomType) {
          setRoomType(rt);
        }
        // A new detection should clear any previous override so users can accept suggestion
        setUserOverrodeRoomType(false);
        return rt;
      } catch (e) {
        // ignore errors for detection
        return null;
      } finally {
        setIsDetectingRoomType(false);
      }
    },
    [selectedRoomPhotos, userOverrodeRoomType],
  );

  const handleNextStep = useCallback(async () => {
    if (currentStep === 1) {
      if (selectedRoomPhotoCount === 0) {
        Alert.alert(
          t("aiDesign.missingImageTitle", { defaultValue: "Missing image" }),
          t("aiDesign.missingImageMessage", {
            defaultValue: "Please upload at least one room photo.",
          }),
        );
        return;
      }

      const localImages = selectedRoomPhotos
        .map((slot) => slot.localImage)
        .filter((image): image is RoomDesignImageFile => Boolean(image));
      let analyzedRoomType = detectedRoomType;

      if (localImages.length > 0 && (!analyzedRoomType || isDetectingRoomType)) {
        analyzedRoomType = await performDetectRoomType(localImages);
      }

      if (isNotRelatedRoomType(analyzedRoomType)) {
        Alert.alert(
          t("aiDesign.notRelatedRoomTitle", {
            defaultValue: "Photo is not a room",
          }),
          t("aiDesign.notRelatedRoomMessage", {
            defaultValue:
              "Please upload a room or indoor space photo before continuing.",
          }),
        );
        return;
      }

      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      setCurrentStep(4);
    }
  }, [
    currentStep,
    detectedRoomType,
    isDetectingRoomType,
    performDetectRoomType,
    selectedRoomPhotoCount,
    selectedRoomPhotos,
    t,
  ]);

  useEffect(() => {
    // auto-detect when local images change and user hasn't overridden
    if (userOverrodeRoomType) return;
    void performDetectRoomType();
  }, [selectedLocalImageUrisKey, userOverrodeRoomType, performDetectRoomType]);

  const uploadRoomPhotos = useCallback(async (): Promise<number[]> => {
    const selectedSlots = roomPhotos.filter((slot) => Boolean(slot.localImage));

    if (selectedSlots.length === 0) {
      throw new Error("Please upload at least one room photo.");
    }

    setRoomPhotos((current) =>
      current.map((slot) =>
        slot.localImage
          ? {
              ...slot,
              uploading: true,
              error: null,
            }
          : slot,
      ),
    );

    try {
      const uploadedImages = await roomDesignService.uploadRoomImages(
        selectedSlots.map((slot) => slot.localImage!),
      );

      const uploadedBySlotIndex = new Map<
        number,
        (typeof uploadedImages)[number]
      >();
      selectedSlots.forEach((slot, index) => {
        const uploadedImage = uploadedImages[index];
        if (uploadedImage) {
          uploadedBySlotIndex.set(slot.slotIndex, uploadedImage);
        }
      });

      setRoomPhotos((current) =>
        current.map((slot) => {
          const uploadedImage = uploadedBySlotIndex.get(slot.slotIndex);
          if (!uploadedImage) {
            return slot.localImage
              ? {
                  ...slot,
                  uploading: false,
                  error: t("aiDesign.uploadNoResponse", {
                    defaultValue: "Upload completed without a response.",
                  }),
                }
              : slot;
          }

          return {
            ...slot,
            roomImageId: uploadedImage.roomImageId,
            imageUrl: uploadedImage.imageUrl ?? slot.previewUri ?? null,
            moderationStatus: uploadedImage.moderationStatus ?? null,
            moderationReason: uploadedImage.moderationReason ?? null,
            uploadedAt: uploadedImage.uploadedAt ?? null,
            uploading: false,
            error: null,
          };
        }),
      );

      return uploadedImages.map((item) => item.roomImageId);
    } catch (error: unknown) {
      const message = resolveApiMessage(
        error,
        t("aiDesign.uploadFailed", { defaultValue: "Upload failed" }),
      );

      setRoomPhotos((current) =>
        current.map((slot) =>
          slot.localImage
            ? {
                ...slot,
                uploading: false,
                error: message,
              }
            : slot,
        ),
      );

      throw error;
    }
  }, [roomPhotos, t]);

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
        const images =
          await roomDesignService.getGeneratedImages(layoutDesignId);
        setGeneratedImages(images);

        if (images.length > 0) {
          setGeneratedImagesError(null);
          setIsLoadingGeneratedImages(false);
          return;
        }

        if (attempt >= GENERATED_IMAGES_MAX_ATTEMPTS - 1) {
          setGeneratedImagesError(
            t("aiDesign.generatedImagesEmpty", {
              defaultValue: "No generated images are available yet.",
            }),
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
              t("aiDesign.generatedImagesLoadFailed", {
                defaultValue: "Unable to load generated images.",
              }),
            ),
          );
          setIsLoadingGeneratedImages(false);
          return;
        }

        generatedImagesPollTimeoutRef.current = setTimeout(() => {
          void pollGeneratedImages(layoutDesignId, attempt + 1);
        }, GENERATED_IMAGES_POLL_INTERVAL_MS);
      }
    },
    [clearGeneratedImagesPolling, t],
  );

  const handleAnalyzeRoom = useCallback(async (): Promise<boolean> => {
    if (selectedRoomPhotoCount === 0) {
      Alert.alert(
        t("aiDesign.missingImageTitle", { defaultValue: "Missing image" }),
        t("aiDesign.missingImageMessage", {
          defaultValue: "Please upload at least one room photo.",
        }),
      );
      return false;
    }

    const minTrim = minBudget.trim();
    const maxTrim = maxBudget.trim();
    let minBudgetPayload: number | undefined;
    let maxBudgetPayload: number | undefined;

    if (minTrim === "" && maxTrim === "") {
      minBudgetPayload = undefined;
      maxBudgetPayload = undefined;
    } else {
      const parsedMinBudget = parseBudgetValue(minBudget);
      const parsedMaxBudget = parseBudgetValue(maxBudget);

      if (parsedMinBudget === null || parsedMaxBudget === null) {
        Alert.alert(
          t("aiDesign.errorTitle", { defaultValue: "Error" }),
          t("aiDesign.invalidBudgetMessage", {
            defaultValue: "Please enter a valid budget range.",
          }),
        );
        return false;
      }

      if (parsedMinBudget > parsedMaxBudget) {
        Alert.alert(
          t("aiDesign.errorTitle", { defaultValue: "Error" }),
          t("aiDesign.invalidBudgetRangeMessage", {
            defaultValue:
              "Minimum budget cannot be greater than maximum budget.",
          }),
        );
        return false;
      }

      minBudgetPayload = parsedMinBudget;
      maxBudgetPayload = parsedMaxBudget;
    }

    setCurrentStep(5);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setGeneratedImages([]);
    setGeneratedImagesError(null);
    setIsLoadingGeneratedImages(false);
    clearGeneratedImagesPolling();

    try {
      const roomImageIds = await uploadRoomPhotos();

      if (roomImageIds.length === 0) {
        throw new Error(
          t("aiDesign.missingImageMessage", {
            defaultValue: "Please upload at least one room photo.",
          }),
        );
      }

      const careLevelApi =
        careLevelSelection === "omit"
          ? undefined
          : CARE_LEVEL_OPTIONS.find(
              (option) => option.value === careLevelSelection,
            )?.apiValue;

      const hasAllergyPayload = allergySend === "yes";

      const payload: RoomDesignAnalyzePayload = {
        roomImageIds,
        roomType,
        roomStyle,
        roomArea: roomArea.trim() ? Number(roomArea.trim()) : undefined,
        lightDirection: lightDirection === "omit" ? undefined : lightDirection,
        naturalLightLevel:
          naturalLightLevel === "omit" ? undefined : naturalLightLevel,
        fengShuiElement: resolvedFengShuiElement ?? undefined,
        minBudget: minBudgetPayload,
        maxBudget: maxBudgetPayload,
        careLevelType: careLevelApi?.trim() ? careLevelApi : undefined,
        hasAllergy: hasAllergyPayload,
        allergyNote:
          allergySend === "yes" && allergyNote.trim()
            ? allergyNote.trim()
            : undefined,
        allergicPlantIds:
          allergySend === "yes"
            ? selectedAllergyPlants.map((plant) => plant.id)
            : undefined,
        petSafe,
        childSafe: childSafe,
        preferredNurseryIds:
          selectedPreferredNurseryIds.length > 0
            ? selectedPreferredNurseryIds
            : undefined,
      };
      const result = await roomDesignService.analyze(payload);

      setAnalysisResult(result);

      if (result.layoutDesignId) {
        void handleGenerateImages(result.layoutDesignId);
      }

      return true;
    } catch (error: unknown) {
      setAnalysisError(
        resolveApiMessage(
          error,
          t("aiDesign.errorMessage", {
            defaultValue: "Unable to generate design. Please try again.",
          }),
        ),
      );
      return false;
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    allergyNote,
    allergySend,
    careLevelSelection,
    clearGeneratedImagesPolling,
    fengShuiSelection,
    maxBudget,
    minBudget,
    petSafe,
    selectedPreferredNurseryIds,
    roomStyle,
    roomType,
    roomArea,
    lightDirection,
    naturalLightLevel,
    selectedRoomPhotoCount,
    selectedAllergyPlants,
    t,
    uploadRoomPhotos,
    resolvedFengShuiElement,
    childSafe,
  ]);

  const handleAddRecommendationToCart = useCallback(
    async (
      entity: RoomDesignRecommendation | RoomDesignGeneratedImage,
      isGeneratedImage = false,
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
            ? t("aiDesign.addToCartSuccess", {
                defaultValue: "Added to cart.",
              })
            : t("aiDesign.addToCartFailed", {
                defaultValue: "Unable to add this plant to cart.",
              }),
        });
      } catch (error: unknown) {
        notify({
          message: resolveApiMessage(
            error,
            t("aiDesign.addToCartFailed", {
              defaultValue: "Unable to add this plant to cart.",
            }),
          ),
          useAlert: true,
        });
      } finally {
        setActiveRecommendationActionId(null);
      }
    },
    [addCartItem, t],
  );

  const handleBuyRecommendationNow = useCallback(
    async (
      entity: RoomDesignRecommendation | RoomDesignGeneratedImage,
      isGeneratedImage = false,
    ) => {
      const plantInstanceId = isGeneratedImage
        ? (entity as RoomDesignGeneratedImage).plantInstanceId
        : (entity as RoomDesignRecommendation).plantInstanceId;

      if (!plantInstanceId) {
        return;
      }

      setActiveRecommendationActionId(`buy-${entity.id}`);

      try {
        const detail =
          await plantService.getPlantInstanceDetail(plantInstanceId);
        const detailImages = resolveImageUris(detail.images);

        let primaryImage: string | undefined;
        let checkoutPrice = 0;
        let fallbackName = "";

        if (isGeneratedImage) {
          const genEntity = entity as RoomDesignGeneratedImage;
          primaryImage = detailImages[0] ?? genEntity.imageUrl ?? undefined;
          checkoutPrice = detail.specificPrice ?? 0;
          fallbackName =
            detail.plantName ?? `Plant Instance #${plantInstanceId}`;
        } else {
          const recEntity = entity as RoomDesignRecommendation;
          primaryImage = detailImages[0] ?? recEntity.imageUrl ?? undefined;
          checkoutPrice =
            detail.specificPrice ??
            recEntity.specificPrice ??
            recEntity.price ??
            0;
          fallbackName = detail.plantName ?? recEntity.name;
        }

        navigation.navigate("Checkout", {
          source: "buy-now",
          items: [
            {
              id: detail.id,
              name: fallbackName,
              size:
                detail.height != null
                  ? `${detail.height} cm`
                  : t("common.updating", { defaultValue: "Updating" }),
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
            t("aiDesign.buyNowFailed", {
              defaultValue: "Unable to open buy now for this plant instance.",
            }),
          ),
          useAlert: true,
        });
      } finally {
        setActiveRecommendationActionId(null);
      }
    },
    [navigation, t],
  );

  const handleGenerateImages = useCallback(
    async (layoutDesignId?: number | null) => {
      const resolvedLayoutDesignId =
        layoutDesignId ?? analysisResult?.layoutDesignId ?? null;
      if (!resolvedLayoutDesignId || isGeneratingImages) {
        return;
      }

      clearGeneratedImagesPolling();
      setIsGeneratingImages(true);
      setGeneratedImages([]);
      setGeneratedImagesError(null);

      try {
        await roomDesignService.generateImages(resolvedLayoutDesignId);
        setIsGeneratingImages(false);
        void pollGeneratedImages(resolvedLayoutDesignId, 0);
      } catch (error: unknown) {
        setIsGeneratingImages(false);
        setGeneratedImagesError(
          resolveApiMessage(
            error,
            t("aiDesign.generateImagesFailed", {
              defaultValue: "Unable to generate layout images.",
            }),
          ),
        );
        setIsLoadingGeneratedImages(false);
      }
    },
    [
      analysisResult?.layoutDesignId,
      clearGeneratedImagesPolling,
      isGeneratingImages,
      pollGeneratedImages,
      t,
    ],
  );

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
          {t("aiDesign.guestTitle", {
            defaultValue: "Login to use AI RoomDesign",
          })}
        </Text>
        <Text style={styles.gateMessage}>
          {t("aiDesign.guestMessage", {
            defaultValue:
              "Please login first to upload your room and receive plant recommendations.",
          })}
        </Text>
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.primaryActionButtonText}>
            {t("common.login", { defaultValue: "Login" })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRoleBlockedState = () => (
    <View style={styles.gateWrap}>
      <View style={styles.gateCard}>
        <Ionicons
          name="person-circle-outline"
          size={40}
          color={COLORS.accent}
        />
        <Text style={styles.gateTitle}>
          {t("aiDesign.customerOnlyTitle", {
            defaultValue: "RoomDesign is available for customer accounts only",
          })}
        </Text>
        <Text style={styles.gateMessage}>
          {t("aiDesign.customerOnlyMessage", {
            defaultValue:
              "This feature is currently limited to customers. Please switch to a customer account to continue.",
          })}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <BrandedHeader
        title={t("aiDesign.headerTitle", {
          defaultValue: "AI Plant Recommendation",
        })}
        brandVariant="none"
        containerStyle={styles.header}
        sideWidth={52}
        titleStyle={styles.headerTitle}
        right={
          <TouchableOpacity
            onPress={() => navigation.navigate("MyDesign")}
            style={styles.headerActionButton}
            accessibilityRole="button"
            accessibilityLabel={t("profile.myDesign", {
              defaultValue: "My Design",
            })}
          >
            <Ionicons name="images-outline" size={19} color={COLORS.primaryDark} />
          </TouchableOpacity>
        }
      />

      {!isAuthenticated ? (
        renderGuestGate()
      ) : !isCustomer ? (
        renderRoleBlockedState()
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomContentInset },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <WizardStepper
            steps={wizardSteps}
            currentStep={currentStep}
            onStepPress={goToStep}
          />

          {currentStep === 1 ? (
            <>
              <SectionCard
                title={t("aiDesign.sectionImage", {
                  defaultValue: "Room photos",
                })}
                subtitle={t("aiDesign.imageHint", {
                  defaultValue:
                    "Upload 1–4 photos of your room. At least one photo is required.",
                })}
                headerRight={
                  <Text style={styles.roomPhotoCountText}>
                    {t("aiDesign.roomPhotoCount", {
                      count: selectedRoomPhotoCount,
                      defaultValue: `${selectedRoomPhotoCount}/${MAX_ROOM_PHOTOS} photo${selectedRoomPhotoCount === 1 ? "" : "s"}`,
                    })}
                  </Text>
                }
              >
                <View style={styles.roomPhotoGrid}>
                  {selectedRoomPhotos.map((slot, index) => {
                    const isFilled = Boolean(slot.previewUri || slot.imageUrl);

                    return (
                      <View
                        key={slot.slotIndex}
                        style={[
                          styles.roomPhotoCard,
                          isFilled && styles.roomPhotoCardFilled,
                        ]}
                      >
                        <Text style={styles.roomPhotoCardTitle}>
                          {t("aiDesign.roomPhotoSlotLabel", {
                            defaultValue: `Photo ${slot.slotIndex}`,
                            slot: slot.slotIndex,
                          })}
                        </Text>

                        {isFilled ? (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() =>
                              setFullScreenImage(
                                slot.imageUrl ?? slot.previewUri ?? null,
                              )
                            }
                            style={styles.roomPhotoPreviewWrap}
                          >
                            <Image
                              source={{
                                uri: slot.imageUrl ?? slot.previewUri ?? "",
                              }}
                              style={styles.roomPhotoPreview}
                              resizeMode="cover"
                            />
                            {index === 0 ? (
                              <View style={styles.roomPhotoMainBadge}>
                                <Text style={styles.roomPhotoMainBadgeText}>
                                  {t("common.main", { defaultValue: "Main" })}
                                </Text>
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.roomPhotoEmptyState}>
                            <Ionicons
                              name="image-outline"
                              size={28}
                              color={COLORS.primary}
                            />
                            <Text style={styles.roomPhotoEmptyText}>
                              {t("aiDesign.roomPhotoEmpty", {
                                defaultValue: "Add a room photo",
                              })}
                            </Text>
                          </View>
                        )}

                        {slot.uploading ? (
                          <View style={styles.roomPhotoStatusRow}>
                            <ActivityIndicator
                              size="small"
                              color={COLORS.primary}
                            />
                            <Text style={styles.roomPhotoStatusText}>
                              {t("common.uploading", {
                                defaultValue: "Uploading...",
                              })}
                            </Text>
                          </View>
                        ) : null}

                        {slot.error ? (
                          <Text style={styles.roomPhotoErrorText}>
                            {slot.error}
                          </Text>
                        ) : null}

                        {isFilled ? (
                          <TouchableOpacity
                            style={styles.roomPhotoRemoveButton}
                            onPress={() => clearRoomPhotoSlot(slot.slotIndex)}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={14}
                              color={COLORS.error}
                            />
                            <Text style={styles.roomPhotoRemoveText}>
                              {t("common.remove", { defaultValue: "Remove" })}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}

                  {selectedRoomPhotoCount < MAX_ROOM_PHOTOS &&
                  nextEmptyRoomPhotoSlot ? (
                    <TouchableOpacity
                      style={styles.roomPhotoAddCard}
                      activeOpacity={0.85}
                      onPress={() =>
                        openRoomPhotoSourcePicker(
                          nextEmptyRoomPhotoSlot.slotIndex,
                        )
                      }
                    >
                      <View style={styles.roomPhotoAddIconWrap}>
                        <Ionicons
                          name="image-outline"
                          size={18}
                          color={COLORS.textSecondary}
                        />
                        <Ionicons
                          name="add"
                          size={14}
                          color={COLORS.textSecondary}
                          style={styles.roomPhotoAddIconPlus}
                        />
                      </View>
                      <Text style={styles.roomPhotoAddText}>
                        {t("aiDesign.addMore", { defaultValue: "Add more" })}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.recheckWrap}>
                  <TouchableOpacity
                    style={styles.recheckButton}
                    onPress={() => void performDetectRoomType()}
                    disabled={
                      selectedRoomPhotos.length === 0 || isDetectingRoomType
                    }
                  >
                    {isDetectingRoomType ? (
                      <>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={[styles.recheckButtonText, { marginLeft: 8 }]}> 
                          {t("aiDesign.detectingRoomType", {
                            defaultValue: "Detecting room type...",
                          })}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          name="sparkles"
                          size={16}
                          color={COLORS.textPrimary}
                        />
                        <Text style={styles.recheckButtonText}>
                          {t("aiDesign.recheckRoomType", {
                            defaultValue: "RE-CHECK ROOM TYPE",
                          })}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {detectedRoomType ? (
                  <View
                    style={[
                      styles.detectedContainer,
                      isDetectedRoomTypeNotRelated &&
                        styles.detectedContainerError,
                    ]}
                  >
                    <View style={styles.detectedLeft}>
                      <Ionicons
                        name={
                          isDetectedRoomTypeNotRelated
                            ? "alert-circle"
                            : "sparkles"
                        }
                        size={16}
                        color={
                          isDetectedRoomTypeNotRelated
                            ? COLORS.error
                            : COLORS.primary
                        }
                      />
                      <Text style={styles.detectedLabelText}>
                        {isDetectedRoomTypeNotRelated
                          ? t("aiDesign.notRelatedRoomDetected", {
                              defaultValue: "This photo is not a room:",
                            })
                          : t("aiDesign.aiDetected", {
                              defaultValue: "AI detected:",
                            })}
                      </Text>
                      <View
                        style={[
                          styles.detectedBadge,
                          isDetectedRoomTypeNotRelated &&
                            styles.detectedBadgeError,
                        ]}
                      >
                        <Text
                          style={[
                            styles.detectedBadgeText,
                            isDetectedRoomTypeNotRelated &&
                              styles.detectedBadgeTextError,
                          ]}
                        >
                          {roomTypeChipOptions.find(
                            (o) => o.value === detectedRoomType,
                          )?.label ?? formatEnumNameDefault(detectedRoomType)}
                        </Text>
                      </View>
                    </View>

                    {!isDetectedRoomTypeNotRelated ? (
                      <TouchableOpacity
                        style={styles.detectedOverride}
                        onPress={() => {
                          setUserOverrodeRoomType(true);
                          openRoomSelectField("roomType");
                        }}
                      >
                        <Ionicons
                          name="pencil"
                          size={16}
                          color={COLORS.primaryDark}
                        />
                        <Text style={styles.detectedOverrideText}>
                          {t("aiDesign.override", { defaultValue: "OVERRIDE" })}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.roomDetailsBlock}>
                  <SelectListField
                    label={t("aiDesign.sectionRoomType", {
                      defaultValue: "Room type",
                    })}
                    valueLabel={roomTypeDisplayLabel}
                    placeholder={t("aiDesign.selectRoomType", {
                      defaultValue: "Select room type",
                    })}
                    onPress={() => openRoomSelectField("roomType")}
                    disabled={!userOverrodeRoomType}
                  />

                  <SelectListField
                    label={t("aiDesign.sectionStyle", {
                      defaultValue: "Style",
                    })}
                    valueLabel={roomStyleDisplayLabel}
                    placeholder={t("aiDesign.selectRoomStyle", {
                      defaultValue: "Select style",
                    })}
                    onPress={() => openRoomSelectField("roomStyle")}
                  />
                  <Text style={styles.fieldLabel}>
                    {t("aiDesign.roomAreaLabel", {
                      defaultValue: "Room area (m²)",
                    })}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={roomArea}
                    onChangeText={setRoomArea}
                    keyboardType={
                      Platform.OS === "ios" ? "decimal-pad" : "numeric"
                    }
                    placeholder={t("aiDesign.roomAreaPlaceholder", {
                      defaultValue: "Optional",
                    })}
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
              </SectionCard>

              <View style={styles.stepActionRowSingle}>
                <TouchableOpacity
                  style={[
                    styles.wizardPrimaryButton,
                    (isDetectingRoomType || isDetectedRoomTypeNotRelated) &&
                      styles.primaryActionButtonDisabled,
                  ]}
                  onPress={() => {
                    void handleNextStep();
                  }}
                  disabled={isDetectingRoomType || isDetectedRoomTypeNotRelated}
                >
                  <Text style={styles.wizardPrimaryButtonText}>
                    {t("common.next", { defaultValue: "Next" }).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {currentStep >= 2 && currentStep <= 4 ? (
            <SectionCard
              title={t("aiDesign.preferencesTitle", {
                defaultValue:
                  currentStep === 2
                    ? "Feng Shui Information"
                    : currentStep === 3
                      ? "Lighting Conditions"
                      : "Budget & Care Level",
              })}
              subtitle={t("aiDesign.preferencesSubtitle", {
                defaultValue:
                  currentStep === 2
                    ? "AI will analyze feng shui data to recommend plants that align with the owner's element."
                    : currentStep === 3
                      ? "Lighting information helps AI recommend plants that suit your space."
                      : "Set your budget and care preferences so AI can filter suitable recommendations.",
              })}
            >
              {currentStep === 2 ? (
                <>
                  <TouchableOpacity
                    style={styles.profileToggleRow}
                    onPress={() => {
                      if (userFengShuiElement) {
                        setUseProfileFengShui((value) => !value);
                      }
                    }}
                    activeOpacity={userFengShuiElement ? 0.8 : 1}
                  >
                    <Ionicons
                      name={isUsingProfileFengShui ? "checkbox" : "square-outline"}
                      size={22}
                      color={COLORS.primary}
                    />
                    <Text style={styles.profileToggleText}>
                      {t("aiDesign.useUserProfileInformation", {
                        defaultValue: "Use user profile information",
                      })}
                    </Text>
                  </TouchableOpacity>

                  <SelectListField
                    label={t("aiDesign.fengShuiElementLabel", {
                      defaultValue: "Feng Shui element",
                    })}
                    valueLabel={resolvedFengShuiLabel}
                    placeholder={t("aiDesign.selectFengShuiElement", {
                      defaultValue: "Select feng shui element",
                    })}
                    onPress={() => openRoomSelectField("fengShuiElement")}
                    disabled={isUsingProfileFengShui}
                  />

                  <Text style={styles.profilePullText}>
                    {isUsingProfileFengShui && userFengShuiElement
                      ? t("aiDesign.pulledFromProfile", {
                          defaultValue: "Pulled from your profile",
                        })
                      : t("aiDesign.selectFengShuiManualHint", {
                          defaultValue: "Select manually if you prefer another element",
                        })}
                  </Text>

                  {resolvedFengShuiLabel ? (
                    <View style={styles.fengShuiInfoCard}>
                      <Text style={styles.fengShuiInfoTitle}>
                        {t("aiDesign.fiveElements", { defaultValue: "Five Elements" })}
                      </Text>
                      <View style={styles.fengShuiInfoBadge}>
                        <Text style={styles.fengShuiInfoBadgeText}>
                          {resolvedFengShuiLabel}
                        </Text>
                      </View>
                      <Text style={styles.fengShuiInfoDescription}>
                        {FENG_SHUI_ELEMENT_NOTES[
                          (resolvedFengShuiElement ?? userFengShuiElement ?? "Water") as FengShuiValue
                        ]}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}

              {currentStep === 3 ? (
                <>
                  <Text style={styles.fieldLabel}>
                    {t("aiDesign.lightDirectionLabel", {
                      defaultValue: "Window / Light direction",
                    })}
                  </Text>
                  <DynamicOptionChipGroup
                    options={lightDirectionChipOptions}
                    selectedValue={lightDirection}
                    onSelect={setLightDirection}
                  />

                  <Text style={styles.fieldLabel}>
                    {t("aiDesign.naturalLightLevelLabel", {
                      defaultValue: "Natural light level",
                    })}
                  </Text>
                  <DynamicOptionChipGroup
                    options={naturalLightLevelChipOptions}
                    selectedValue={naturalLightLevel}
                    onSelect={setNaturalLightLevel}
                  />
                </>
              ) : null}

              {currentStep === 4 ? (
                <>
                  <Text style={styles.fieldLabel}>
                    {t("aiDesign.careLevelLabel", {
                      defaultValue: "Care level",
                    })}
                  </Text>
                  <OptionChipGroup
                    options={CARE_LEVEL_OPTIONS}
                    selectedValue={careLevelSelection}
                    onSelect={setCareLevelSelection}
                    getLabel={getStaticOptionLabel}
                  />

                  <View style={styles.booleanToggleRow}>
                    <View style={styles.booleanToggleTextWrap}>
                      <Text style={styles.fieldLabel}>
                        {t("aiDesign.petSafeLabel", { defaultValue: "Pet safe" })}
                      </Text>
                      <Text style={styles.helperText}>
                        {petSafe
                          ? t("aiDesign.booleanYes", { defaultValue: "Yes" })
                          : t("aiDesign.booleanNo", { defaultValue: "No" })}
                      </Text>
                    </View>
                    <Switch
                      value={petSafe}
                      onValueChange={setPetSafe}
                      trackColor={{ false: COLORS.gray300, true: COLORS.secondary }}
                      thumbColor={petSafe ? COLORS.primary : COLORS.gray100}
                    />
                  </View>

                  <View style={styles.booleanToggleRow}>
                    <View style={styles.booleanToggleTextWrap}>
                      <Text style={styles.fieldLabel}>
                        {t("aiDesign.childSafeLabel", {
                          defaultValue: "Child safe",
                        })}
                      </Text>
                      <Text style={styles.helperText}>
                        {childSafe
                          ? t("aiDesign.booleanYes", { defaultValue: "Yes" })
                          : t("aiDesign.booleanNo", { defaultValue: "No" })}
                      </Text>
                    </View>
                    <Switch
                      value={childSafe}
                      onValueChange={setChildSafe}
                      trackColor={{ false: COLORS.gray300, true: COLORS.secondary }}
                      thumbColor={childSafe ? COLORS.primary : COLORS.gray100}
                    />
                  </View>

                  <SelectListField
                    label={t("aiDesign.preferredNurseriesLabel", {
                      defaultValue: "Preferred Nurseries",
                    })}
                    valueLabel={preferredNurserySummaryLabel}
                    placeholder={t("aiDesign.preferredNurseriesPlaceholder", {
                      defaultValue: "Select preferred nurseries",
                    })}
                    onPress={() => openRoomSelectField("preferredNursery")}
                  />
                  <Text style={styles.helperText}>
                    {t("aiDesign.preferredNurseriesHint", {
                      defaultValue:
                        "Optional. Select one or more nurseries to include in the request.",
                    })}
                  </Text>

                  {isLoadingPreferredNurseries ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={styles.loadingText}>
                        {t("common.loading", { defaultValue: "Loading..." })}
                      </Text>
                    </View>
                  ) : preferredNurseriesError ? (
                    <Text style={styles.errorInlineText}>
                      {preferredNurseriesError}
                    </Text>
                  ) : null}

                  <View style={styles.budgetRow}>
                    <View style={styles.budgetField}>
                      <Text style={styles.fieldLabel}>
                        {t("aiDesign.minBudgetLabel", {
                          defaultValue: "Minimum budget",
                        })}
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        value={minBudget}
                        onChangeText={setMinBudget}
                        keyboardType={
                          Platform.OS === "ios" ? "decimal-pad" : "numeric"
                        }
                        placeholder={t("aiDesign.budgetOptionalPlaceholder", {
                          defaultValue: "Optional",
                        })}
                        placeholderTextColor={COLORS.textLight}
                      />
                      <Text style={styles.helperText}>
                        {formatBudgetPreview(minBudget, locale)}
                      </Text>
                    </View>

                    <View style={styles.budgetField}>
                      <Text style={styles.fieldLabel}>
                        {t("aiDesign.maxBudgetLabel", {
                          defaultValue: "Maximum budget",
                        })}
                      </Text>
                      <TextInput
                        style={styles.textInput}
                        value={maxBudget}
                        onChangeText={setMaxBudget}
                        keyboardType={
                          Platform.OS === "ios" ? "decimal-pad" : "numeric"
                        }
                        placeholder={t("aiDesign.budgetOptionalPlaceholder", {
                          defaultValue: "Optional",
                        })}
                        placeholderTextColor={COLORS.textLight}
                      />
                      <Text style={styles.helperText}>
                        {formatBudgetPreview(maxBudget, locale)}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}
            </SectionCard>
          ) : null}

          {currentStep === 4 ? (
            <SectionCard
              title={t("aiDesign.allergyTitle", {
                defaultValue: "Allergy preferences",
              })}
              subtitle={t("aiDesign.allergySubtitle", {
                defaultValue:
                  "Turn this on only if you want AI to avoid plants that may trigger your allergy.",
              })}
            >
              <Text style={styles.fieldLabel}>
                {t("aiDesign.allergySendLabel", { defaultValue: "Allergies" })}
              </Text>
              <OptionChipGroup
                options={ALLERGY_SEND_OPTIONS}
                selectedValue={allergySend}
                onSelect={setAllergySend}
                getLabel={getStaticOptionLabel}
              />

              {allergySend === "yes" ? (
                <View style={styles.allergySection}>
                  <Text style={styles.fieldLabel}>
                    {t("aiDesign.allergyNoteLabel", {
                      defaultValue: "Allergy note",
                    })}
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.multilineInput]}
                    value={allergyNote}
                    onChangeText={setAllergyNote}
                    multiline
                    placeholder={t("aiDesign.allergyNotePlaceholder", {
                      defaultValue:
                        "Add any note about your allergy if needed.",
                    })}
                    placeholderTextColor={COLORS.textLight}
                  />

                  <Text style={styles.fieldLabel}>
                    {t("aiDesign.allergySearchLabel", {
                      defaultValue: "Select allergic plants",
                    })}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={allergyKeyword}
                    onChangeText={setAllergyKeyword}
                    placeholder={t("aiDesign.allergySearchPlaceholder", {
                      defaultValue: "Search active plants to exclude...",
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
                          <Text style={styles.selectedAllergyChipText}>
                            {plant.name}
                          </Text>
                          <Ionicons
                            name="close"
                            size={14}
                            color={COLORS.primaryDark}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.helperText}>
                      {t("aiDesign.allergySelectionEmpty", {
                        defaultValue: "No allergic plants selected yet.",
                      })}
                    </Text>
                  )}

                  {isLoadingAllergyPlants ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={styles.loadingText}>
                        {t("common.loading", { defaultValue: "Loading..." })}
                      </Text>
                    </View>
                  ) : allergyError ? (
                    <Text style={styles.errorInlineText}>{allergyError}</Text>
                  ) : allergyPlants.length === 0 ? (
                    <Text style={styles.helperText}>
                      {t("aiDesign.allergyEmpty", {
                        defaultValue: "No active plants found for this search.",
                      })}
                    </Text>
                  ) : (
                    <ScrollView
                      style={styles.allergyResultsList}
                      contentContainerStyle={
                        styles.allergyResultsListContent
                      }
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      {allergyPlants.map((plant) => {
                        const isSelected = selectedAllergyPlantIds.has(
                          plant.id,
                        );

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
                              <Text style={styles.allergyPlantName}>
                                {plant.name}
                              </Text>
                              {plant.scientificName ? (
                                <Text style={styles.allergyPlantScientificName}>
                                  {plant.scientificName}
                                </Text>
                              ) : null}
                            </View>
                            <Ionicons
                              name={
                                isSelected
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                              size={18}
                              color={
                                isSelected ? COLORS.primary : COLORS.gray500
                              }
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              ) : null}
            </SectionCard>
          ) : null}

          {currentStep === 4 && analysisError ? (
            <View style={styles.feedbackCard}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.error}
              />
              <Text style={styles.feedbackErrorText}>{analysisError}</Text>
            </View>
          ) : null}

          {currentStep === 4 ? (
            <View style={styles.stepActionRowBetween}>
              <TouchableOpacity
                style={styles.wizardSecondaryButton}
                onPress={goBackStep}
              >
                <Text style={styles.wizardSecondaryButtonText}>
                  {t("common.back", { defaultValue: "Back" }).toUpperCase()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.wizardPrimaryButton,
                  isAnalyzing && styles.primaryActionButtonDisabled,
                ]}
                onPress={() => void handleAnalyzeRoom()}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : null}
                <Text style={styles.wizardPrimaryButtonText}>
                  {isAnalyzing
                    ? t("aiDesign.analyzing", {
                        defaultValue: "Analyzing room...",
                      })
                    : t("aiDesign.analyzeButton", {
                        defaultValue: "Analyze & Recommend",
                      }).toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {currentStep === 5 ? (
            <>
              {!analysisResult ? (
                <SectionCard
                  title={t("aiDesign.resultsTitle", {
                    defaultValue: "Results",
                  })}
                  subtitle={
                    isAnalyzing
                      ? t("aiDesign.analyzing", {
                          defaultValue: "Analyzing room...",
                        })
                      : analysisError
                        ? t("aiDesign.errorTitle", {
                            defaultValue: "Error",
                          })
                        : t("aiDesign.resultsWaitingSubtitle", {
                            defaultValue:
                              "Run Analyze & Recommend in step 4 to see results.",
                          })
                  }
                >
                  {isAnalyzing ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator
                        size="small"
                        color={COLORS.primary}
                      />
                      <Text style={styles.loadingText}>
                        {t("aiDesign.analyzing", {
                          defaultValue: "Analyzing room...",
                        })}
                      </Text>
                    </View>
                  ) : analysisError ? (
                    <View style={styles.feedbackCard}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={18}
                        color={COLORS.error}
                      />
                      <Text style={styles.feedbackErrorText}>
                        {analysisError}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.helperText}>
                      {t("aiDesign.resultsWaitingHelper", {
                        defaultValue:
                          "Go back to Budget & Care and run analysis first.",
                      })}
                    </Text>
                  )}
                </SectionCard>
              ) : null}

              {analysisResult ? (
                <>
                  <SectionCard
                    title={t("aiDesign.resultsTitle", {
                      defaultValue: "Analysis result",
                    })}
                    subtitle={
                      analysisResult.summary ??
                      t("aiDesign.resultsSubtitle", {
                        defaultValue:
                          "Recommended plants are ready. You can shop right away or generate layout images.",
                      })
                    }
                  >
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>
                        {t("aiDesign.layoutDesignIdLabel", {
                          defaultValue: "Layout design ID",
                        })}
                      </Text>
                      <Text style={styles.summaryValue}>
                        {analysisResult.layoutDesignId ?? "-"}
                      </Text>
                    </View>

                    {analysisResult.roomAnalysis?.availableSpace ? (
                      <Text style={styles.recommendationMeta}>
                        {`${t("aiDesign.roomAnalysisAvailableSpace", {
                          defaultValue: "Available space",
                        })}: ${analysisResult.roomAnalysis.availableSpace}`}
                      </Text>
                    ) : null}
                    {analysisResult.roomAnalysis?.colorPalette &&
                    analysisResult.roomAnalysis.colorPalette.length > 0 ? (
                      <Text style={styles.recommendationMeta}>
                        {`${t("aiDesign.roomAnalysisColorPalette", {
                          defaultValue: "Color palette",
                        })}: ${analysisResult.roomAnalysis.colorPalette.join(", ")}`}
                      </Text>
                    ) : null}
                    {analysisResult.processingTimeMs != null ? (
                      <Text style={styles.helperText}>
                        {`${t("aiDesign.processingTimeLabel", {
                          defaultValue: "Processing time",
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
                    title={t("aiDesign.generatedImagesTitle", {
                      defaultValue: "Generated layout images",
                    })}
                    subtitle={t("aiDesign.generatedImagesSubtitle", {
                      defaultValue:
                        "Generate images after analysis to visualize the recommendations in your room. Generated images are based on the layout design created by AI, which may take a few minutes to be ready after analysis.",
                    })}
                    collapsible
                  >
                    <TouchableOpacity
                      style={[
                        styles.primaryActionButton,
                        (!analysisResult.layoutDesignId ||
                          isGeneratingImages) &&
                          styles.primaryActionButtonDisabled,
                      ]}
                      onPress={() => void handleGenerateImages()}
                      disabled={
                        !analysisResult.layoutDesignId || isGeneratingImages
                      }
                    >
                      {isGeneratingImages ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      ) : (
                        <Ionicons
                          name="image-outline"
                          size={20}
                          color={COLORS.white}
                        />
                      )}
                      <Text style={styles.primaryActionButtonText}>
                        {isGeneratingImages
                          ? t("aiDesign.generatingImages", {
                              defaultValue: "Generating images...",
                            })
                          : t("aiDesign.generateImagesButton", {
                              defaultValue: "Generate images",
                            })}
                      </Text>
                    </TouchableOpacity>

                    {analysisResult.layoutDesignId ? (
                      <TouchableOpacity
                        style={styles.retryGeneratedImagesButton}
                        onPress={handleRetryGeneratedImages}
                        disabled={isLoadingGeneratedImages}
                      >
                        <Ionicons
                          name="refresh-outline"
                          size={16}
                          color={COLORS.primary}
                        />
                        <Text style={styles.retryGeneratedImagesButtonText}>
                          {t("common.retry", { defaultValue: "Retry" })}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {isLoadingGeneratedImages ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator
                          size="small"
                          color={COLORS.primary}
                        />
                        <Text style={styles.loadingText}>
                          {t("aiDesign.generatedImagesLoading", {
                            defaultValue: "Checking generated images...",
                          })}
                        </Text>
                      </View>
                    ) : null}

                    {generatedImagesError ? (
                      <Text style={styles.errorInlineText}>
                        {generatedImagesError}
                      </Text>
                    ) : null}

                    {generatedImages.length > 0 ? (
                      <View style={styles.generatedImageList}>
                        {generatedImages.map((item) => {
                          const isAddingToCart =
                            activeRecommendationActionId === `cart-${item.id}`;
                          const isBuyingNow =
                            activeRecommendationActionId === `buy-${item.id}`;
                          const canAddToCart =
                            typeof item.commonPlantId === "number" &&
                            item.commonPlantId > 0;
                          const canBuyNow =
                            typeof item.plantInstanceId === "number" &&
                            item.plantInstanceId > 0;

                          return (
                            <View
                              key={item.id}
                              style={styles.generatedImageCard}
                            >
                              <TouchableOpacity
                                onPress={() =>
                                  setFullScreenImage(item.imageUrl)
                                }
                                activeOpacity={0.85}
                              >
                                <Image
                                  source={{ uri: item.imageUrl }}
                                  style={styles.generatedImage}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>

                              {item.name ||
                              item.placementPosition ||
                              item.price != null ||
                              canAddToCart ||
                              canBuyNow ? (
                                <View style={styles.recommendationBody}>
                                  {item.name ? (
                                    <Text style={styles.recommendationName}>
                                      {item.name}
                                    </Text>
                                  ) : null}

                                  {item.price != null ? (
                                    <Text style={styles.recommendationPrice}>
                                      {`${item.price.toLocaleString(locale)}đ`}
                                    </Text>
                                  ) : null}

                                  {item.placementPosition ? (
                                    <Text style={styles.recommendationMeta}>
                                      {`${t("aiDesign.placementPositionLabel", {
                                        defaultValue: "Placement",
                                      })}: ${item.placementPosition}`}
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
                                          void handleAddRecommendationToCart(
                                            item,
                                            true,
                                          )
                                        }
                                        disabled={isAddingToCart}
                                      >
                                        {isAddingToCart ? (
                                          <ActivityIndicator
                                            size="small"
                                            color={COLORS.primary}
                                          />
                                        ) : null}
                                        <Text
                                          style={
                                            styles.secondaryActionButtonText
                                          }
                                        >
                                          {t("plantDetail.addToCart", {
                                            defaultValue: "Add to cart",
                                          })}
                                        </Text>
                                      </TouchableOpacity>
                                    ) : null}

                                    {canBuyNow ? (
                                      <TouchableOpacity
                                        style={[
                                          styles.primaryCompactButton,
                                          isBuyingNow &&
                                            styles.primaryCompactButtonDisabled,
                                        ]}
                                        onPress={() =>
                                          void handleBuyRecommendationNow(
                                            item,
                                            true,
                                          )
                                        }
                                        disabled={isBuyingNow}
                                      >
                                        {isBuyingNow ? (
                                          <ActivityIndicator
                                            size="small"
                                            color={COLORS.white}
                                          />
                                        ) : null}
                                        <Text
                                          style={
                                            styles.primaryCompactButtonText
                                          }
                                        >
                                          {t("plantDetail.buyNow", {
                                            defaultValue: "Buy now",
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
                    title={t("aiDesign.recommendationsTitle", {
                      defaultValue: "Recommended plants",
                    })}
                  >
                    {analysisResult.recommendations.length === 0 ? (
                      <Text style={styles.helperText}>
                        {t("aiDesign.recommendationsEmpty", {
                          defaultValue:
                            "No recommendations were returned for this room.",
                        })}
                      </Text>
                    ) : (
                      <View style={styles.recommendationList}>
                        {analysisResult.recommendations.map(
                          (recommendation) => {
                            const isAddingToCart =
                              activeRecommendationActionId ===
                              `cart-${recommendation.id}`;
                            const isBuyingNow =
                              activeRecommendationActionId ===
                              `buy-${recommendation.id}`;
                            const purchasable =
                              recommendation.isPurchasable !== false;
                            const canAddToCart =
                              purchasable &&
                              typeof recommendation.commonPlantId ===
                                "number" &&
                              recommendation.commonPlantId > 0;
                            const canBuyNow =
                              purchasable &&
                              typeof recommendation.plantInstanceId ===
                                "number" &&
                              recommendation.plantInstanceId > 0;

                            return (
                              <View
                                key={recommendation.id}
                                style={styles.recommendationCard}
                              >
                                {recommendation.imageUrl ? (
                                  <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() =>
                                      setFullScreenImage(
                                        recommendation.imageUrl!,
                                      )
                                    }
                                    style={{ width: "100%" }}
                                  >
                                    <Image
                                      source={{ uri: recommendation.imageUrl }}
                                      style={styles.recommendationImage}
                                      resizeMode="cover"
                                    />
                                  </TouchableOpacity>
                                ) : (
                                  <View
                                    style={
                                      styles.recommendationImagePlaceholder
                                    }
                                  >
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
                                  {recommendation.plantReason ||
                                  recommendation.description ? (
                                    <Text style={styles.recommendationReason}>
                                      {recommendation.plantReason ??
                                        recommendation.description}
                                    </Text>
                                  ) : null}
                                  {recommendation.placementReason ? (
                                    <Text style={styles.recommendationMeta}>
                                      {`${t("aiDesign.placementReasonLabel", {
                                        defaultValue: "Placement reason",
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
                                          void handleAddRecommendationToCart(
                                            recommendation,
                                          )
                                        }
                                        disabled={isAddingToCart}
                                      >
                                        {isAddingToCart ? (
                                          <ActivityIndicator
                                            size="small"
                                            color={COLORS.primary}
                                          />
                                        ) : null}
                                        <Text
                                          style={
                                            styles.secondaryActionButtonText
                                          }
                                        >
                                          {t("plantDetail.addToCart", {
                                            defaultValue: "Add to cart",
                                          })}
                                        </Text>
                                      </TouchableOpacity>
                                    ) : null}

                                    {canBuyNow ? (
                                      <TouchableOpacity
                                        style={[
                                          styles.primaryCompactButton,
                                          isBuyingNow &&
                                            styles.primaryCompactButtonDisabled,
                                        ]}
                                        onPress={() =>
                                          void handleBuyRecommendationNow(
                                            recommendation,
                                          )
                                        }
                                        disabled={isBuyingNow}
                                      >
                                        {isBuyingNow ? (
                                          <ActivityIndicator
                                            size="small"
                                            color={COLORS.white}
                                          />
                                        ) : null}
                                        <Text
                                          style={
                                            styles.primaryCompactButtonText
                                          }
                                        >
                                          {t("plantDetail.buyNow", {
                                            defaultValue: "Buy now",
                                          })}
                                        </Text>
                                      </TouchableOpacity>
                                    ) : null}
                                  </View>

                                  {!canAddToCart && !canBuyNow ? (
                                    <Text style={styles.helperText}>
                                      {t(
                                        "aiDesign.recommendationActionUnavailable",
                                        {
                                          defaultValue:
                                            "Purchase action is unavailable for this recommendation.",
                                        },
                                      )}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            );
                          },
                        )}
                      </View>
                    )}
                  </SectionCard>
                </>
              ) : null}

              <View style={styles.stepActionRowBetween}>
                <TouchableOpacity
                  style={styles.wizardSecondaryButton}
                  onPress={goBackStep}
                >
                  <Text style={styles.wizardSecondaryButtonText}>
                    {t("common.back", { defaultValue: "Back" }).toUpperCase()}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.wizardPrimaryButton}
                  onPress={handleStartOver}
                >
                  <Text style={styles.wizardPrimaryButtonText}>
                    {t("aiDesign.startOverButton", {
                      defaultValue: "Start over",
                    }).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {currentStep === 2 || currentStep === 3 ? (
            <View style={styles.stepActionRowBetween}>
              <TouchableOpacity
                style={styles.wizardSecondaryButton}
                onPress={goBackStep}
              >
                <Text style={styles.wizardSecondaryButtonText}>
                  {t("common.back", { defaultValue: "Back" }).toUpperCase()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.wizardPrimaryButton}
                onPress={handleNextStep}
              >
                <Text style={styles.wizardPrimaryButtonText}>
                  {t("common.next", { defaultValue: "Next" }).toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={isRoomPhotoSourceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRoomPhotoSourcePicker}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.roomPhotoSourceOverlay}
          onPress={closeRoomPhotoSourcePicker}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.roomPhotoSourceSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.roomPhotoSourceTitle}>
              {t("aiDesign.addPhoto", { defaultValue: "Add photo" })}
            </Text>
            <Text style={styles.roomPhotoSourceSubtitle}>
              {t("aiDesign.choosePhotoSource", {
                defaultValue: "Choose how you want to add a room photo.",
              })}
            </Text>

            <TouchableOpacity
              style={styles.roomPhotoSourceButton}
              onPress={() => void handleRoomPhotoSourceChoice("library")}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={18}
                color={COLORS.primaryDark}
              />
              <Text style={styles.roomPhotoSourceButtonText}>
                {t("aiDesign.library", { defaultValue: "Library" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.roomPhotoSourceButton}
              onPress={() => void handleRoomPhotoSourceChoice("camera")}
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={COLORS.primaryDark}
              />
              <Text style={styles.roomPhotoSourceButtonText}>
                {t("aiDesign.takePhoto", { defaultValue: "Take photo" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.roomPhotoSourceCancelButton}
              onPress={closeRoomPhotoSourcePicker}
            >
              <Text style={styles.roomPhotoSourceCancelText}>
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={activeRoomSelectField !== null}
        transparent
        animationType="fade"
        onRequestClose={closeRoomSelectField}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.roomSelectOverlay}
          onPress={closeRoomSelectField}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.roomSelectSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.roomSelectTitle}>
              {activeRoomSelectField === "roomType"
                ? t("aiDesign.sectionRoomType", { defaultValue: "Room type" })
                : activeRoomSelectField === "roomStyle"
                  ? t("aiDesign.sectionStyle", { defaultValue: "Style" })
                  : activeRoomSelectField === "fengShuiElement"
                    ? t("aiDesign.fengShuiElementLabel", { defaultValue: "Feng Shui element" })
                    : t("aiDesign.preferredNurseriesLabel", { defaultValue: "Preferred Nurseries" })}
            </Text>

            {activeRoomSelectField === "preferredNursery" ? (
              <ScrollView
                style={styles.roomSelectList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {preferredNurseries.length === 0 ? (
                  <Text style={styles.helperText}>
                    {t("aiDesign.preferredNurseriesEmpty", {
                      defaultValue: "No nurseries available.",
                    })}
                  </Text>
                ) : (
                  preferredNurseries.map((nursery) => {
                    const isSelected = preferredNurseryIdSet.has(nursery.id);

                    return (
                      <TouchableOpacity
                        key={nursery.id}
                        style={[
                          styles.roomSelectItem,
                          isSelected && styles.roomSelectItemSelected,
                        ]}
                        onPress={() => togglePreferredNursery(nursery)}
                      >
                        <View style={styles.allergyPlantInfo}>
                          <Text style={styles.allergyPlantName}>
                            {nursery.name}
                          </Text>
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
                          name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                          size={18}
                          color={isSelected ? COLORS.primary : COLORS.gray500}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            ) : (
              <ScrollView
                style={styles.roomSelectList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {(activeRoomSelectField === "roomType"
                  ? roomTypeChipOptions
                  : activeRoomSelectField === "roomStyle"
                    ? roomStyleChipOptions
                    : FENG_SHUI_OPTIONS
                ).map((option) => {
                  const optionLabel =
                    "label" in option
                      ? option.label
                      : getStaticOptionLabel(option as StaticOption<FengShuiSelection>);
                  const currentValue =
                    activeRoomSelectField === "roomType"
                      ? roomType
                      : activeRoomSelectField === "roomStyle"
                        ? roomStyle
                        : isUsingProfileFengShui && userFengShuiElement
                          ? userFengShuiElement
                          : fengShuiSelection;
                  const isSelected = currentValue === option.value;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.roomSelectItem,
                        isSelected && styles.roomSelectItemSelected,
                      ]}
                      onPress={() => handleRoomSelectValue(option.value)}
                    >
                      <Text
                        style={[
                          styles.roomSelectItemText,
                          isSelected && styles.roomSelectItemTextSelected,
                        ]}
                      >
                        {optionLabel}
                      </Text>
                      {isSelected ? (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={COLORS.primary}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.roomSelectCancelButton}
              onPress={closeRoomSelectField}
            >
              <Text style={styles.roomSelectCancelText}>
                {activeRoomSelectField === "preferredNursery"
                  ? t("common.done", { defaultValue: "Done" })
                  : t("common.cancel", { defaultValue: "Cancel" })}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
    backgroundColor: "#F6F8F6",
  },
  header: {
    paddingHorizontal: SPACING.lg,
  },
  headerTitle: {
    maxWidth: "100%",
    fontSize: FONTS.sizes.md,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(47, 128, 237, 0.22)",
    ...SHADOWS.sm,
  },
  headerActionText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: "800",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
    paddingTop: SPACING.md,
  },
  stepperWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(25,118,210,0.08)",
    marginBottom: SPACING.xs,
  },
  stepperItem: {
    flex: 1,
    alignItems: "center",
    position: "relative",
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.gray300,
    zIndex: 2,
  },
  stepCircleCompleted: {
    backgroundColor: "#1976D2",
    borderColor: "#1976D2",
  },
  stepCircleCurrent: {
    backgroundColor: "#1976D2",
    borderColor: "#1976D2",
  },
  stepCircleText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
    fontWeight: "800",
  },
  stepCircleTextActive: {
    color: COLORS.white,
  },
  stepConnector: {
    position: "absolute",
    top: 15,
    left: "60%",
    width: "80%",
    height: 2,
    backgroundColor: COLORS.gray300,
  },
  stepConnectorCompleted: {
    backgroundColor: "#1976D2",
  },
  stepLabel: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  stepLabelCurrent: {
    color: COLORS.textPrimary,
    fontWeight: "700",
  },
  stepActionRowSingle: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  stepActionRowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  wizardPrimaryButton: {
    minHeight: 48,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    minWidth: 116,
    ...SHADOWS.sm,
  },
  wizardPrimaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: "800",
  },
  wizardSecondaryButton: {
    minHeight: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#60A5FA",
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    minWidth: 88,
  },
  wizardSecondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: "700",
  },
  gateWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  gateCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS["2xl"],
    padding: SPACING["2xl"],
    alignItems: "center",
    gap: SPACING.md,
    ...SHADOWS.md,
  },
  gateTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  gateMessage: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS["2xl"],
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...SHADOWS.sm,
  },
  sectionHeader: {
    gap: SPACING.xs,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  sectionHeaderRight: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sectionTitle: {
    flex: 1,
    fontSize: FONTS.sizes.xl,
    lineHeight: 28,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },
  sectionContent: {
    marginTop: SPACING.xl,
    gap: SPACING.lg,
  },
  selectedImageWrap: {
    gap: SPACING.md,
  },
  selectedImage: {
    width: "100%",
    height: 220,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.gray100,
  },
  selectedImageActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  imageSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  imageSecondaryButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
  },
  smallPrimaryButton: {
    minHeight: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  smallPrimaryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
  },
  smallSecondaryButton: {
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  smallSecondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
  },
  smallPrimaryOutlineButton: {
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  smallPrimaryOutlineButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "800",
    color: COLORS.gray700,
    letterSpacing: 0.2,
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    fontWeight: "600",
    color: COLORS.gray700,
  },
  optionChipTextActive: {
    color: COLORS.white,
  },
  budgetRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  budgetField: {
    flex: 1,
    gap: SPACING.xs,
  },
  textInput: {
    minHeight: 50,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  selectFieldWrap: {
    gap: SPACING.xs,
  },
  selectListButton: {
    minHeight: 50,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  selectListButtonText: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: "700",
  },
  selectListPlaceholderText: {
    color: COLORS.textLight,
    fontWeight: "500",
  },
  selectListButtonDisabled: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.border,
  },
  selectListButtonTextDisabled: {
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  booleanToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  booleanToggleTextWrap: {
    flex: 1,
    gap: 2,
  },
  profileToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  profileToggleText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  profilePullText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: -2,
  },
  fengShuiInfoCard: {
    borderWidth: 1,
    borderColor: "#5E8CFF",
    backgroundColor: "#EEF4FF",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  fengShuiInfoTitle: {
    color: "#2450E6",
    fontSize: FONTS.sizes.md,
    fontWeight: "700",
  },
  fengShuiInfoBadge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: "#5E8CFF",
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  fengShuiInfoBadgeText: {
    color: "#2450E6",
    fontWeight: "700",
  },
  fengShuiInfoDescription: {
    color: COLORS.gray700,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  multilineInput: {
    minHeight: 104,
    paddingTop: SPACING.md,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
  roomPhotoCountText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  roomPhotoActionsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  roomPhotoToolbarButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  roomPhotoToolbarButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryDark,
    fontWeight: "700",
  },
  roomPhotoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    alignItems: "stretch",
  },
  roomPhotoCard: {
    width: "48%",
    minHeight: 276,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderStyle: "dashed",
    backgroundColor: COLORS.secondaryLight,
    padding: SPACING.md,
    gap: SPACING.sm,
    position: "relative",
  },
  roomPhotoCardFilled: {
    borderStyle: "solid",
  },
  roomPhotoCardTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  roomPhotoPreviewWrap: {
    width: "100%",
    position: "relative",
  },
  roomPhotoPreview: {
    width: "100%",
    height: 200,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  roomPhotoEmptyState: {
    minHeight: 200,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    padding: SPACING.md,
  },
  roomPhotoEmptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: "600",
    textAlign: "center",
  },
  roomPhotoStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  roomPhotoStatusText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  roomPhotoErrorText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.error,
    fontWeight: "600",
  },
  roomPhotoActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  roomPhotoActionButton: {
    flex: 1,
    minWidth: 0,
  },
  roomPhotoMainBadge: {
    position: "absolute",
    left: SPACING.sm,
    bottom: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: "#2F80ED",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  roomPhotoMainBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    fontWeight: "700",
  },
  roomPhotoAddCard: {
    width: "48%",
    minHeight: 276,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.gray300,
    borderStyle: "dashed",
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  roomPhotoAddIconWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  roomPhotoAddIconPlus: {
    marginLeft: -2,
    marginTop: -2,
  },
  roomPhotoAddText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryDark,
    fontWeight: "600",
  },
  recheckWrap: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.secondary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  recheckButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  recheckButtonText: {
    marginLeft: 8,
    fontSize: FONTS.sizes.md,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  detectedContainer: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.success,
    backgroundColor: "rgba(64,192,87,0.05)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detectedContainerError: {
    borderColor: COLORS.error,
    backgroundColor: "#FFF1F0",
  },
  detectedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  detectedLabelText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: "700",
  },
  detectedBadge: {
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  detectedBadgeError: {
    borderColor: COLORS.error,
  },
  detectedBadgeText: {
    color: COLORS.success,
    fontWeight: "700",
  },
  detectedBadgeTextError: {
    color: COLORS.error,
  },
  detectedOverride: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  detectedOverrideText: {
    color: COLORS.primaryDark,
    fontWeight: "700",
  },
  roomPhotoSourceOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  roomPhotoSourceSheet: {
    width: "100%",
    maxWidth: 420,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  roomPhotoSourceTitle: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: "700",
  },
  roomPhotoSourceSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  roomPhotoSourceButton: {
    minHeight: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  roomPhotoSourceButtonText: {
    color: COLORS.primaryDark,
    fontSize: FONTS.sizes.md,
    fontWeight: "700",
  },
  roomPhotoSourceCancelButton: {
    minHeight: 44,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  roomPhotoSourceCancelText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
  },
  roomSelectOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  roomSelectSheet: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "78%",
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  roomSelectTitle: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: "700",
  },
  roomSelectList: {
    maxHeight: 360,
  },
  roomSelectItem: {
    minHeight: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.gray50,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  roomSelectItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  roomSelectItemText: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  roomSelectItemTextSelected: {
    color: COLORS.primaryDark,
  },
  roomSelectCancelButton: {
    minHeight: 44,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  roomSelectCancelText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
  },
  roomDetailsBlock: {
    gap: SPACING.md,
  },
  roomPhotoRemoveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    alignSelf: "center",
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  roomPhotoRemoveText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.error,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  toggleLabel: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  allergySection: {
    gap: SPACING.md,
  },
  selectedAllergyList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  selectedAllergyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  selectedAllergyChipText: {
    color: COLORS.primaryDark,
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
  },
  allergyResultsList: {
    maxHeight: 280,
    marginTop: SPACING.xs,
  },
  allergyResultsListContent: {
    gap: SPACING.sm,
  },
  preferredNurseryList: {
    maxHeight: 280,
    marginTop: SPACING.sm,
  },
  allergyPlantItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "700",
  },
  feedbackCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: "#FFF1F0",
    borderWidth: 1,
    borderColor: "#FFC9C5",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(25,118,210,0.1)",
    backgroundColor: "#F7FBFF",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  summaryLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: "800",
    color: COLORS.primaryDark,
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
    borderColor: "rgba(15, 23, 42, 0.08)",
    backgroundColor: COLORS.white,
    overflow: "hidden",
  },
  recommendationImage: {
    width: "100%",
    height: 180,
    backgroundColor: COLORS.gray100,
  },
  recommendationImagePlaceholder: {
    width: "100%",
    height: 180,
    backgroundColor: COLORS.secondaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendationBody: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  recommendationName: {
    fontSize: FONTS.sizes.lg,
    lineHeight: 26,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  recommendationReason: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },
  recommendationMeta: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 21,
    color: COLORS.gray700,
  },
  recommendationPrice: {
    marginTop: 2,
    fontSize: FONTS.sizes.md,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  recommendationActions: {
    flexDirection: "row",
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
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  secondaryActionButtonDisabled: {
    opacity: 0.65,
  },
  secondaryActionButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
  },
  primaryCompactButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  primaryCompactButtonDisabled: {
    opacity: 0.75,
  },
  primaryCompactButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
  },
  retryGeneratedImagesButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  retryGeneratedImagesButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
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
    overflow: "hidden",
  },
  generatedImage: {
    width: "100%",
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
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  fullImageCloseButton: {
    position: "absolute",
    top: SPACING["3xl"],
    right: SPACING.lg,
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(17, 24, 39, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  fullImagePreview: {
    width: "100%",
    height: "100%",
  },
});
