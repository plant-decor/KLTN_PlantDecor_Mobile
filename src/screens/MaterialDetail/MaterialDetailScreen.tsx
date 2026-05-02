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
  Animated,
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { COLORS, FONTS, SHADOWS, SPACING } from "../../constants";
import {
  CheckoutItem,
  NurseryPlantComboAndMaterialAvailability,
  RootStackParamList,
  ShopSearchMaterialSummary,
} from "../../types";
import {
  useAuthStore,
  useCartStore,
  usePlantStore,
  useWishlistStore,
} from "../../stores";
import { plantService } from "../../services";
import { getWishlistKey, notify, resolveImageUris } from "../../utils";
import DetailImageGallery from "../../components/media/DetailImageGallery";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, "MaterialDetail">;

const PLACEHOLDER_IMAGE = "https://via.placeholder.com/600x400?text=Material";
const IMAGE_HEIGHT = 396;
const ATTR_CARD_WIDTH =
  (Dimensions.get("window").width - SPACING.xl * 2 - 12) / 2;
const RELATED_CARD_WIDTH = 196;
const RELATED_CARD_GAP = 16;
const RELATED_IMAGE_HEIGHT = 210;

const getImageUri = (imageValue: unknown): string | null => {
  if (typeof imageValue === "string") {
    const trimmed = imageValue.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!imageValue || typeof imageValue !== "object") {
    return null;
  }

  const imageRecord = imageValue as Record<string, unknown>;
  const candidate = imageRecord.imageUrl ?? imageRecord.url ?? imageRecord.uri;

  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type AttributeProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
};

function AttributeCard({
  icon,
  iconColor,
  iconBg,
  label,
  value,
}: AttributeProps) {
  return (
    <View style={styles.attrCard}>
      <View style={[styles.attrIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.attrTextWrap}>
        <Text style={styles.attrLabel}>{label}</Text>
        <Text style={styles.attrValue}>{value}</Text>
      </View>
    </View>
  );
}

// Lightweight HTML-to-plain-text helper: decodes common entities and strips tags.
function decodeHtmlEntities(input: unknown): string {
  if (input == null) return "";
  let text = String(input);

  // Preserve simple block breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p\s*>/gi, "\n");
  text = text.replace(/<p[^>]*>/gi, "");

  // Decode named entities (common ones)
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
  };

  for (const [k, v] of Object.entries(entities)) {
    text = text.split(k).join(v);
  }

  // Decode numeric entities
  text = text.replace(/&#(\d+);/g, (_m, dec) =>
    String.fromCharCode(parseInt(dec, 10)),
  );
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

  // Strip any remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Normalize whitespace but preserve single newlines
  text = text.replace(/[ \t\u00A0]+/g, " ");
  text = text.replace(/\n{2,}/g, "\n\n");
  text = text.trim();

  return text;
}

export default function MaterialDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { materialId } = route.params;
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthStore();
  const addCartItem = useCartStore((state) => state.addCartItem);
  const cartItemCount = useCartStore((state) => state.totalItems());
  const fetchNurseriesGotMaterialByMaterialId = usePlantStore(
    (state) => state.fetchNurseriesGotMaterialByMaterialId,
  );

  const wishlistStatus = useWishlistStore((state) => state.statusByKey);
  const ensureStatus = useWishlistStore((state) => state.ensureStatus);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const [material, setMaterial] = useState<Awaited<
    ReturnType<typeof plantService.getMaterialDetail>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relatedMaterials, setRelatedMaterials] = useState<
    ShopSearchMaterialSummary[]
  >([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);
  const [relatedListWidth, setRelatedListWidth] = useState(0);
  const [relatedContentWidth, setRelatedContentWidth] = useState(0);
  const [relatedScrollX, setRelatedScrollX] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  const contentLayerScrollY = useRef(new Animated.Value(0)).current;
  const [isNurseryLoading, setIsNurseryLoading] = useState(false);
  const [availableNurseryOptions, setAvailableNurseryOptions] = useState<
    NurseryPlantComboAndMaterialAvailability[]
  >([]);
  const [showAllNurseries, setShowAllNurseries] = useState(false);
  const [selectedNurseryMaterialId, setSelectedNurseryMaterialId] = useState<
    number | null
  >(null);

  const wishlistItemId = materialId;
  const wishlistKey = getWishlistKey("Material", wishlistItemId);

  const contentLayerTranslateY = useMemo(
    () =>
      contentLayerScrollY.interpolate({
        inputRange: [0, IMAGE_HEIGHT - 24],
        outputRange: [IMAGE_HEIGHT - 24, 0],
        extrapolate: "clamp",
      }),
    [contentLayerScrollY],
  );

  const contentInnerTranslateY = useMemo(
    () =>
      contentLayerScrollY.interpolate({
        inputRange: [0, IMAGE_HEIGHT - 24],
        outputRange: [0, IMAGE_HEIGHT - 24],
        extrapolate: "clamp",
      }),
    [contentLayerScrollY],
  );

  const handleContentLayerScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: contentLayerScrollY } } }],
        { useNativeDriver: true },
      ),
    [contentLayerScrollY],
  );

  const resolveMaterialEntityId = useCallback(
    (item: ShopSearchMaterialSummary) => {
      return Number.isInteger(item.materialId) && item.materialId > 0
        ? item.materialId
        : item.id;
    },
    [],
  );

  const requireAuth = useCallback(
    (onSuccess?: () => void): boolean => {
      if (isAuthenticated) {
        onSuccess?.();
        return true;
      }

      Alert.alert(
        t("common.loginRequiredTitle", { defaultValue: "Login required" }),
        t("common.loginRequiredMessage", {
          defaultValue: "Please login to continue.",
        }),
        [
          {
            text: t("common.cancel", { defaultValue: "Cancel" }),
            style: "cancel",
          },
          {
            text: t("common.login", { defaultValue: "Login" }),
            onPress: () => navigation.navigate("Login"),
          },
        ],
      );
      return false;
    },
    [isAuthenticated, navigation, t],
  );

  useEffect(() => {
    let isMounted = true;

    const loadMaterial = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await plantService.getMaterialDetail(materialId);
        if (isMounted) {
          setMaterial(payload);
        }
      } catch (loadError: any) {
        if (isMounted) {
          setError(
            loadError?.response?.data?.message ||
              t("materialDetail.loadFailed", {
                defaultValue: "Unable to load material details.",
              }),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadMaterial();

    return () => {
      isMounted = false;
    };
  }, [materialId, refreshKey, t]);

  useEffect(() => {
    setQuantity(1);
    setSelectedNurseryMaterialId(null);
    setShowAllNurseries(false);
  }, [materialId]);

  useEffect(() => {
    let isMounted = true;

    const loadNurseries = async () => {
      setIsNurseryLoading(true);

      try {
        const options = await fetchNurseriesGotMaterialByMaterialId(materialId);
        const normalizedOptions = options ?? [];

        if (!isMounted) {
          return;
        }

        setAvailableNurseryOptions(normalizedOptions);
        setSelectedNurseryMaterialId((current) => {
          const preferredFromState =
            current &&
            normalizedOptions.some(
              (option) => option.nurseryMaterialId === current,
            )
              ? current
              : null;

          return (
            preferredFromState ??
            normalizedOptions[0]?.nurseryMaterialId ??
            null
          );
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setAvailableNurseryOptions([]);
        setSelectedNurseryMaterialId(null);
      } finally {
        if (isMounted) {
          setIsNurseryLoading(false);
        }
      }
    };

    void loadNurseries();

    return () => {
      isMounted = false;
    };
  }, [fetchNurseriesGotMaterialByMaterialId, materialId, refreshKey]);

  useEffect(() => {
    if (!material) {
      setRelatedMaterials([]);
      setRelatedScrollX(0);
      setRelatedContentWidth(0);
      return;
    }

    let isMounted = true;

    const extractMaterials = (
      items: Awaited<
        ReturnType<typeof plantService.searchShop>
      >["items"]["items"],
    ) => {
      const map = new Map<number, ShopSearchMaterialSummary>();

      items.forEach((entry) => {
        if (entry.type !== "Material" || !entry.material) {
          return;
        }

        const key =
          Number.isInteger(entry.material.materialId) &&
          entry.material.materialId > 0
            ? entry.material.materialId
            : entry.material.id;

        if (!map.has(key)) {
          map.set(key, entry.material);
        }
      });

      return Array.from(map.values());
    };

    const loadRelatedMaterials = async () => {
      setIsLoadingRelated(true);

      try {
        const primaryPayload = await plantService.searchShop({
          pagination: {
            pageNumber: 1,
            pageSize: 24,
          },
          keyword: material.name,
          includePlants: false,
          includeMaterials: true,
          includeCombos: false,
          sortBy: "CreatedAt",
          sortDirection: "Desc",
        });

        let merged = extractMaterials(primaryPayload.items.items);

        if (merged.length < 6) {
          const fallbackPayload = await plantService.searchShop({
            pagination: {
              pageNumber: 1,
              pageSize: 24,
            },
            includePlants: false,
            includeMaterials: true,
            includeCombos: false,
            sortBy: "CreatedAt",
            sortDirection: "Desc",
          });

          const combinedMap = new Map<number, ShopSearchMaterialSummary>();
          [...merged, ...extractMaterials(fallbackPayload.items.items)].forEach(
            (entry) => {
              const key =
                Number.isInteger(entry.materialId) && entry.materialId > 0
                  ? entry.materialId
                  : entry.id;
              if (!combinedMap.has(key)) {
                combinedMap.set(key, entry);
              }
            },
          );

          merged = Array.from(combinedMap.values());
        }

        if (isMounted) {
          setRelatedMaterials(
            merged
              .filter((entry) => resolveMaterialEntityId(entry) !== materialId)
              .slice(0, 6),
          );
        }
      } catch {
        if (isMounted) {
          setRelatedMaterials([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingRelated(false);
        }
      }
    };

    void loadRelatedMaterials();

    return () => {
      isMounted = false;
    };
  }, [material, materialId, refreshKey, resolveMaterialEntityId]);

  const wishlistTargets = useMemo(() => {
    const uniqueIds = Array.from(
      new Set(
        [
          wishlistItemId,
          ...relatedMaterials.map((entry) => resolveMaterialEntityId(entry)),
        ].filter((itemId) => Number.isInteger(itemId) && itemId > 0),
      ),
    );

    return uniqueIds.map((itemId) => ({
      itemType: "Material" as const,
      itemId,
    }));
  }, [relatedMaterials, resolveMaterialEntityId, wishlistItemId]);

  useEffect(() => {
    if (!isAuthenticated || wishlistTargets.length === 0) {
      return;
    }

    void ensureStatus(wishlistTargets);
  }, [ensureStatus, isAuthenticated, wishlistTargets]);

  const isWishlisted = wishlistStatus[wishlistKey] ?? false;
  const heroImages = useMemo(() => {
    const resolved = resolveImageUris(material?.images);
    return resolved.length > 0 ? resolved : [PLACEHOLDER_IMAGE];
  }, [material?.images]);
  const hasMoreRelatedItems = relatedMaterials.length > 1;
  const showRelatedArrowLeft = relatedScrollX > 4;
  const showRelatedArrowRight = hasMoreRelatedItems
    ? relatedContentWidth === 0 ||
      relatedContentWidth - relatedListWidth - relatedScrollX > 4
    : false;
  const bottomBarPaddingBottom = useMemo(
    () => Math.max(SPACING.lg, insets.bottom + SPACING.sm),
    [insets.bottom],
  );
  const bottomSpacerHeight = useMemo(
    () =>
      Math.max(
        (bottomBarHeight > 0 ? bottomBarHeight : 112) + SPACING.sm,
        120 + insets.bottom,
      ),
    [bottomBarHeight, insets.bottom],
  );
  const formatMoney = useCallback(
    (value: number) => `${Math.max(0, value).toLocaleString(locale)}₫`,
    [locale],
  );
  const selectedNursery = useMemo(
    () =>
      availableNurseryOptions.find(
        (option) => option.nurseryMaterialId === selectedNurseryMaterialId,
      ) ?? null,
    [availableNurseryOptions, selectedNurseryMaterialId],
  );
  const hasExtraNurseries = availableNurseryOptions.length > 3;
  const visibleNurseryOptions = useMemo(
    () =>
      showAllNurseries
        ? availableNurseryOptions
        : availableNurseryOptions.slice(0, 3),
    [availableNurseryOptions, showAllNurseries],
  );

  // Parse material.specifications which may be a JSON string or an object
  const parsedSpecifications = useMemo(() => {
    const raw = material?.specifications;
    if (raw == null) return null;

    // If already an object, return as-is
    if (typeof raw === "object") return raw as Record<string, any>;

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length === 0) return null;

      try {
        // Most backends return a JSON-encoded string here
        return JSON.parse(trimmed) as Record<string, any>;
      } catch {
        // If parsing fails, attempt a best-effort unescape and parse
        try {
          const unescaped = trimmed.replace(/\\"/g, '"');
          return JSON.parse(unescaped) as Record<string, any>;
        } catch {
          // Fallback to showing the raw string
          return trimmed;
        }
      }
    }

    return String(raw);
  }, [material?.specifications]);

  const formatSpecLabel = useCallback(
    (key: string) => {
      switch (key) {
        case "ph":
          return "pH";
        case "drainage":
          return t("materialDetail.spec.drainage", {
            defaultValue: "Drainage",
          });
        case "waterRetention":
          return t("materialDetail.spec.waterRetention", {
            defaultValue: "Water retention",
          });
        case "organic":
          return t("materialDetail.spec.organic", { defaultValue: "Organic" });
        case "weightKg":
          return t("materialDetail.spec.weight", { defaultValue: "Weight" });
        case "suitableFor":
          return t("materialDetail.spec.suitableFor", {
            defaultValue: "Suitable for",
          });
        default:
          // Pretty-print camelCase keys
          return key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s) => s.toUpperCase());
      }
    },
    [t],
  );

  const formatSpecValue = useCallback(
    (key: string, value: any) => {
      if (value == null) return "-";
      if (key === "organic")
        return value
          ? t("common.yes", { defaultValue: "Yes" })
          : t("common.no", { defaultValue: "No" });
      if (key === "weightKg") return `${value} kg`;
      if (Array.isArray(value))
        return value.length > 0
          ? value
              .map((v) =>
                typeof v === "string" ? decodeHtmlEntities(v) : String(v),
              )
              .join(", ")
          : "-";
      if (typeof value === "string") return decodeHtmlEntities(value);
      return String(value);
    },
    [t],
  );
  const getSpecIcon = useCallback(
    (key: string): { name: keyof typeof Ionicons.glyphMap; color: string } => {
      switch (key) {
        case "ph":
          return { name: "flask-outline", color: "#8B5CF6" };
        case "drainage":
          return { name: "water-outline", color: "#0EA5E9" };
        case "waterRetention":
          return { name: "leaf-outline", color: "#10B981" };
        case "organic":
          return { name: "nutrition-outline", color: "#84CC16" };
        case "weightKg":
          return { name: "barbell-outline", color: "#F59E0B" };
        case "suitableFor":
          return { name: "flower-outline", color: "#EC4899" };
        default:
          return { name: "checkmark-circle-outline", color: "#6B7280" };
      }
    },
    [],
  );

  // Render a single spec row with icon, label and formatted value
  const SpecRow = useCallback(
    ({ specKey, specValue }: { specKey: string; specValue: any }) => {
      const icon = getSpecIcon(specKey);

      return (
        <View style={styles.specRow} key={specKey}>
          <View style={styles.specLeft}>
            <View
              style={[
                styles.specIconWrap,
                { backgroundColor: `${icon.color}20` },
              ]}
            >
              <Ionicons name={icon.name} size={16} color={icon.color} />
            </View>
            <Text style={styles.specKey}>{formatSpecLabel(specKey)}</Text>
          </View>

          <View style={styles.specRight}>
            {specKey === "ph" ? (
              <View style={styles.phBadge}>
                <Text style={styles.phText}>{String(specValue)}</Text>
              </View>
            ) : specKey === "suitableFor" && Array.isArray(specValue) ? (
              <View style={styles.chipsContainer}>
                {specValue.length > 0 ? (
                  specValue.map((v: string, i: number) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>
                        {decodeHtmlEntities(v)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.specText}>-</Text>
                )}
              </View>
            ) : (
              <Text style={styles.specText}>
                {formatSpecValue(specKey, specValue)}
              </Text>
            )}
          </View>
        </View>
      );
    },
    [formatSpecLabel, formatSpecValue, getSpecIcon],
  );

  const handleBottomBarLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setBottomBarHeight((previousHeight) =>
      Math.abs(previousHeight - nextHeight) > 1 ? nextHeight : previousHeight,
    );
  }, []);

  const handleToggleWishlist = useCallback(async () => {
    if (!requireAuth()) {
      return;
    }

    const wasInWishlist = wishlistStatus[wishlistKey] ?? false;

    try {
      await toggleWishlist("Material", wishlistItemId);
      notify({
        message: wasInWishlist
          ? t("wishlist.removeSuccess", {
              defaultValue: "Removed from wishlist.",
            })
          : t("wishlist.addedMessage", { defaultValue: "Added to wishlist." }),
      });
    } catch (wishlistError: any) {
      notify({
        message:
          wishlistError?.response?.data?.message ||
          t("wishlist.actionFailed", {
            defaultValue: "Wishlist action failed.",
          }),
      });
    }
  }, [
    requireAuth,
    t,
    toggleWishlist,
    wishlistItemId,
    wishlistKey,
    wishlistStatus,
  ]);

  const handleToggleRelatedWishlist = useCallback(
    async (item: ShopSearchMaterialSummary) => {
      if (!requireAuth()) {
        return;
      }

      const relatedMaterialId = resolveMaterialEntityId(item);
      const relatedWishlistKey = getWishlistKey("Material", relatedMaterialId);
      const wasInWishlist = wishlistStatus[relatedWishlistKey] ?? false;

      try {
        await toggleWishlist("Material", relatedMaterialId);
        notify({
          message: wasInWishlist
            ? t("wishlist.removeSuccess", {
                defaultValue: "Removed from wishlist.",
              })
            : t("wishlist.addedMessage", {
                defaultValue: "Added to wishlist.",
              }),
        });
      } catch (wishlistError: any) {
        notify({
          message:
            wishlistError?.response?.data?.message ||
            t("wishlist.actionFailed", {
              defaultValue: "Wishlist action failed.",
            }),
        });
      }
    },
    [requireAuth, resolveMaterialEntityId, t, toggleWishlist, wishlistStatus],
  );

  const handleOpenRelatedMaterial = useCallback(
    (item: ShopSearchMaterialSummary) => {
      const relatedMaterialId = resolveMaterialEntityId(item);
      navigation.push("MaterialDetail", {
        materialId: relatedMaterialId,
      });
    },
    [navigation, resolveMaterialEntityId],
  );

  const handleConfirmNurseryAction = useCallback(
    async (goToCheckout = false) => {
      if (!requireAuth() || !material || !selectedNursery?.nurseryMaterialId) {
        if (material && !selectedNursery?.nurseryMaterialId) {
          notify({
            message: t("cart.addFailed", {
              defaultValue: "Unable to add to cart.",
            }),
          });
        }
        return;
      }

      const finalQuantity = Math.max(1, quantity);

      if (goToCheckout) {
        const checkoutItem: CheckoutItem = {
          id: selectedNursery.nurseryMaterialId,
          name: material.name,
          image: getImageUri(material.images?.[0]) ?? undefined,
          price: material.basePrice,
          quantity: finalQuantity,
          buyNowItemId: selectedNursery.nurseryMaterialId,
          buyNowItemTypeName: "NurseryMaterial",
          isUniqueInstance: false,
        };
        navigation.navigate("Checkout", {
          source: "buy-now",
          items: [checkoutItem],
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const payload = await addCartItem({
          commonPlantId: null,
          nurseryPlantComboId: null,
          nurseryMaterialId: selectedNursery.nurseryMaterialId,
          quantity: finalQuantity,
        });

        if (!payload) {
          notify({
            message: t("cart.addFailed", {
              defaultValue: "Unable to add to cart.",
            }),
          });
          return;
        }

        notify({
          message: t("cart.addedMessage", { defaultValue: "Added to cart." }),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      addCartItem,
      material,
      navigation,
      quantity,
      requireAuth,
      selectedNursery,
      t,
    ],
  );

  const handleAddToCart = useCallback(() => {
    void handleConfirmNurseryAction(false);
  }, [handleConfirmNurseryAction]);

  const handleBuyNow = useCallback(() => {
    void handleConfirmNurseryAction(true);
  }, [handleConfirmNurseryAction]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    setRefreshKey((current) => current + 1);
  }, [isRefreshing]);

  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    if (!isLoading && !isNurseryLoading && !isLoadingRelated) {
      setIsRefreshing(false);
    }
  }, [isLoading, isLoadingRelated, isNurseryLoading, isRefreshing]);

  const isNurseryActionDisabled =
    isSubmitting || isNurseryLoading || !selectedNursery?.nurseryMaterialId;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!material || error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={54} color={COLORS.error} />
          <Text style={styles.errorTitle}>
            {t("materialDetail.title", { defaultValue: "Material detail" })}
          </Text>
          <Text style={styles.errorText}>
            {error ||
              t("materialDetail.notFound", {
                defaultValue: "Material not found.",
              })}
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryText}>
              {t("common.goBack", { defaultValue: "Go back" })}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.heroWrap}>
        <DetailImageGallery
          images={heroImages}
          height={IMAGE_HEIGHT}
          placeholderIcon="cube-outline"
        />
      </View>

      <View style={styles.heroOverlay} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color="#0D1B12" />
        </TouchableOpacity>

        <View style={styles.heroActions}>
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={() => void handleToggleWishlist()}
          >
            <Ionicons
              name={isWishlisted ? "heart" : "heart-outline"}
              size={20}
              color={isWishlisted ? COLORS.error : COLORS.white}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cartBtn}
            onPress={() => requireAuth(() => navigation.navigate("Cart"))}
          >
            <Ionicons name="cart-outline" size={20} color={COLORS.white} />
            {cartItemCount > 0 ? <View style={styles.cartDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View
        style={[
          styles.scrollLayer,
          {
            transform: [{ translateY: contentLayerTranslateY }],
          },
        ]}
      >
        <Animated.ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleContentLayerScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          <Animated.View
            style={{
              transform: [{ translateY: contentInnerTranslateY }],
            }}
          >
            <View style={styles.contentCard}>
              <View style={styles.dragHandleWrap}>
                <View style={styles.dragHandle} />
              </View>

              <View style={styles.nameRow}>
                <View style={styles.nameWrap}>
                  <Text style={styles.name}>{material.name}</Text>
                  <Text style={styles.code}>{material.materialCode}</Text>
                </View>
                <View style={styles.titleBadge}>
                  <Ionicons name="cube-outline" size={14} color="#14532D" />
                  <Text style={styles.titleBadgeText}>
                    {t("catalog.typeMaterial", { defaultValue: "Material" })}
                  </Text>
                </View>
              </View>

              <Text
                style={styles.price}
              >{`${formatMoney(material.basePrice)}`}</Text>

              <View style={styles.metaRow}>
                {material.brand ? (
                  <View style={styles.metaBadge}>
                    <Ionicons
                      name="pricetag-outline"
                      size={14}
                      color="#4C9A66"
                    />
                    <Text style={styles.metaBadgeText}>{material.brand}</Text>
                  </View>
                ) : null}
                <View style={styles.metaBadge}>
                  <Ionicons name="cube-outline" size={14} color="#4C9A66" />
                  <Text style={styles.metaBadgeText}>{material.unit}</Text>
                </View>
                <View style={styles.metaBadge}>
                  <Ionicons
                    name="checkmark-done-outline"
                    size={14}
                    color="#4C9A66"
                  />
                  <Text style={styles.metaBadgeText}>
                    {material.isActive
                      ? t("common.available", { defaultValue: "Available" })
                      : t("common.unavailable", {
                          defaultValue: "Unavailable",
                        })}
                  </Text>
                </View>
              </View>

              <Text style={styles.description}>
                {material.description
                  ? decodeHtmlEntities(material.description)
                  : "-"}
              </Text>

              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>
                  {t("materialDetail.highlights", {
                    defaultValue: "Material highlights",
                  })}
                </Text>
                <View style={styles.attrGrid}>
                  <AttributeCard
                    icon="pricetag-outline"
                    iconColor="#15803D"
                    iconBg="#DCFCE7"
                    label={t("materialDetail.brand", { defaultValue: "Brand" })}
                    value={material.brand || "-"}
                  />
                  <AttributeCard
                    icon="cube-outline"
                    iconColor="#1D4ED8"
                    iconBg="#DBEAFE"
                    label={t("materialDetail.unit", { defaultValue: "Unit" })}
                    value={material.unit || "-"}
                  />
                  <AttributeCard
                    icon="calendar-outline"
                    iconColor="#B45309"
                    iconBg="#FEF3C7"
                    label={t("materialDetail.expiryMonths", {
                      defaultValue: "Expiry",
                    })}
                    value={
                      material.expiryMonths && material.expiryMonths > 0
                        ? t("materialDetail.expiryMonthsValue", {
                            defaultValue: "{{count}} months",
                            count: material.expiryMonths,
                          })
                        : t("materialDetail.noExpiry", {
                            defaultValue: "Not specified",
                          })
                    }
                  />
                </View>
              </View>

              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>
                  {t("materialDetail.specifications", {
                    defaultValue: "Specifications",
                  })}
                </Text>
                <View style={styles.specCard}>
                  {parsedSpecifications == null ? (
                    <Text style={styles.specText}>-</Text>
                  ) : typeof parsedSpecifications === "string" ? (
                    <Text style={styles.specText}>
                      {decodeHtmlEntities(parsedSpecifications)}
                    </Text>
                  ) : (
                    <View>
                      {parsedSpecifications.type ? (
                        <Text
                          style={[
                            styles.specText,
                            { fontWeight: "700", marginBottom: 8 },
                          ]}
                        >
                          {decodeHtmlEntities(
                            String(parsedSpecifications.type),
                          )}
                        </Text>
                      ) : null}

                      {parsedSpecifications.properties &&
                      typeof parsedSpecifications.properties === "object" &&
                      Object.keys(parsedSpecifications.properties).length >
                        0 ? (
                        Object.entries(parsedSpecifications.properties).map(
                          ([key, value]) => (
                            // render a nicer row for each property
                            <SpecRow
                              key={key}
                              specKey={key}
                              specValue={value}
                            />
                          ),
                        )
                      ) : (
                        <Text style={styles.specText}>-</Text>
                      )}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>
                  {t("materialDetail.categories", {
                    defaultValue: "Categories",
                  })}
                </Text>
                {material.categories.length > 0 ? (
                  <View style={styles.tagsContainer}>
                    {material.categories.map((category) => (
                      <View key={category.id} style={styles.tagBadge}>
                        <Text style={styles.tagText}>{category.name}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>-</Text>
                )}
              </View>

              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>
                  {t("materialDetail.tags", { defaultValue: "Tags" })}
                </Text>
                {material.tags.length > 0 ? (
                  <View style={styles.tagsContainer}>
                    {material.tags.map((tag) => (
                      <View key={tag.id} style={styles.tagBadge}>
                        <Text style={styles.tagText}>{tag.tagName}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>-</Text>
                )}
              </View>

              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>
                  {t("plantDetail.availableNurseries", {
                    defaultValue: "Available nurseries",
                  })}
                </Text>
                {isNurseryLoading ? (
                  <View style={styles.nurseryLoadingWrap}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : availableNurseryOptions.length > 0 ? (
                  <View style={styles.nurseryList}>
                    {visibleNurseryOptions.map((nursery) => {
                      const isSelected =
                        nursery.nurseryMaterialId === selectedNurseryMaterialId;

                      return (
                        <TouchableOpacity
                          key={`${nursery.id}-${nursery.nurseryMaterialId}`}
                          style={[
                            styles.nurseryCard,
                            isSelected && styles.nurseryCardSelected,
                          ]}
                          activeOpacity={0.82}
                          onPress={() =>
                            setSelectedNurseryMaterialId(
                              nursery.nurseryMaterialId ?? null,
                            )
                          }
                        >
                          <View style={styles.nurseryHeader}>
                            <Ionicons
                              name="business-outline"
                              size={18}
                              color="#15803D"
                            />
                            <Text style={styles.nurseryName}>
                              {nursery.name}
                            </Text>
                            {isSelected ? (
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color="#13EC5B"
                              />
                            ) : null}
                          </View>
                          <Text style={styles.nurseryAddress}>
                            {nursery.address}
                          </Text>
                          <View style={styles.nurseryMetaRow}>
                            <Ionicons
                              name="call-outline"
                              size={14}
                              color={COLORS.textSecondary}
                            />
                            <Text style={styles.nurseryMetaText}>
                              {nursery.phone ||
                                t("common.updating", {
                                  defaultValue: "Updating",
                                })}
                            </Text>
                          </View>
                          <View style={styles.nurseryFooter}>
                            <Text style={styles.nurseryAvailability}>
                              {`${t("catalog.stock", { defaultValue: "Stock" })}: ${Math.max(
                                0,
                                nursery.quantity ?? 0,
                              )}`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {hasExtraNurseries ? (
                      <TouchableOpacity
                        style={styles.loadMoreBtn}
                        onPress={() =>
                          setShowAllNurseries((previous) => !previous)
                        }
                      >
                        <Text style={styles.loadMoreText}>
                          {showAllNurseries
                            ? t("plantDetail.collapseNurseries", {
                                defaultValue: "Show less",
                              })
                            : t("plantDetail.loadMoreNurseries", {
                                defaultValue: "Load more",
                              })}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>
                    {t("catalog.noNurseryAvailableForItem", {
                      defaultValue:
                        "No nursery is currently available for this item.",
                    })}
                  </Text>
                )}
              </View>

              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>
                  {t("plantDetail.youMayAlsoLike", {
                    defaultValue: "You may also like",
                  })}
                </Text>
                {isLoadingRelated ? (
                  <View style={styles.relatedLoaderWrap}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                ) : relatedMaterials.length > 0 ? (
                  <View
                    style={styles.relatedSliderWrap}
                    onLayout={(event) =>
                      setRelatedListWidth(event.nativeEvent.layout.width)
                    }
                  >
                    <FlatList
                      data={relatedMaterials}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(item) => `related-material-${item.id}`}
                      contentContainerStyle={styles.relatedList}
                      ItemSeparatorComponent={() => (
                        <View style={styles.relatedSeparator} />
                      )}
                      snapToInterval={RELATED_CARD_WIDTH + RELATED_CARD_GAP}
                      snapToAlignment="start"
                      decelerationRate="fast"
                      onContentSizeChange={(contentWidth) =>
                        setRelatedContentWidth(contentWidth)
                      }
                      onScroll={(event) =>
                        setRelatedScrollX(event.nativeEvent.contentOffset.x)
                      }
                      scrollEventThrottle={16}
                      renderItem={({ item }) => {
                        const relatedImageUrl = getImageUri(
                          item.primaryImageUrl,
                        );
                        const relatedMaterialId = resolveMaterialEntityId(item);
                        const relatedWishlistKey = getWishlistKey(
                          "Material",
                          relatedMaterialId,
                        );
                        const isRelatedWishlisted =
                          wishlistStatus[relatedWishlistKey] ?? false;

                        return (
                          <TouchableOpacity
                            style={styles.relatedCard}
                            activeOpacity={0.84}
                            onPress={() => handleOpenRelatedMaterial(item)}
                          >
                            <View style={styles.relatedImageWrap}>
                              {relatedImageUrl ? (
                                <Image
                                  source={{ uri: relatedImageUrl }}
                                  style={styles.relatedImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={styles.relatedImagePlaceholder}>
                                  <Ionicons
                                    name="cube-outline"
                                    size={30}
                                    color={COLORS.gray500}
                                  />
                                </View>
                              )}
                              <TouchableOpacity
                                style={styles.relatedHeartBtn}
                                onPress={(event) => {
                                  event.stopPropagation();
                                  void handleToggleRelatedWishlist(item);
                                }}
                              >
                                <Ionicons
                                  name={
                                    isRelatedWishlisted
                                      ? "heart"
                                      : "heart-outline"
                                  }
                                  size={18}
                                  color={
                                    isRelatedWishlisted
                                      ? COLORS.error
                                      : COLORS.white
                                  }
                                />
                              </TouchableOpacity>
                            </View>
                            <Text style={styles.relatedName} numberOfLines={1}>
                              {item.materialName}
                            </Text>
                            <Text style={styles.relatedSub} numberOfLines={1}>
                              {`${item.unit}`}
                            </Text>
                            <View style={styles.relatedPriceRow}>
                              <Text
                                style={styles.relatedPrice}
                                numberOfLines={1}
                              >
                                {formatMoney(item.basePrice)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                    />

                    {(showRelatedArrowLeft || showRelatedArrowRight) && (
                      <View
                        style={styles.relatedArrowOverlay}
                        pointerEvents="none"
                      >
                        {showRelatedArrowLeft ? (
                          <View
                            style={[
                              styles.relatedArrow,
                              styles.relatedArrowLeft,
                            ]}
                          >
                            <Ionicons
                              name="chevron-back"
                              size={18}
                              color="#13EC5B"
                            />
                          </View>
                        ) : null}
                        {showRelatedArrowRight ? (
                          <View
                            style={[
                              styles.relatedArrow,
                              styles.relatedArrowRight,
                            ]}
                          >
                            <Ionicons
                              name="chevron-forward"
                              size={18}
                              color="#13EC5B"
                            />
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.emptyText}>
                    {t("catalog.noResults", {
                      defaultValue:
                        "No products found for the current filters.",
                    })}
                  </Text>
                )}
              </View>

              <View
                style={[styles.bottomSpacer, { height: bottomSpacerHeight }]}
              />
            </View>
          </Animated.View>
        </Animated.ScrollView>
      </Animated.View>

      <View
        style={[styles.bottomBar, { paddingBottom: bottomBarPaddingBottom }]}
        onLayout={handleBottomBarLayout}
      >
        <View style={styles.quantityControl}>
          <Text style={styles.quantityLabel}>
            {t("cart.quantityLabel", { defaultValue: "Quantity" })}
          </Text>
          <View style={styles.quantityStepper}>
            <TouchableOpacity
              style={[
                styles.quantityBtn,
                quantity <= 1 && styles.quantityBtnDisabled,
              ]}
              disabled={quantity <= 1 || isSubmitting}
              onPress={() =>
                setQuantity((previous) => Math.max(1, previous - 1))
              }
            >
              <Ionicons name="remove" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityBtn}
              disabled={isSubmitting}
              onPress={() =>
                setQuantity((previous) => Math.min(99, previous + 1))
              }
            >
              <Ionicons name="add" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomActionRow}>
          <TouchableOpacity
            style={[
              styles.buyNowButton,
              isNurseryActionDisabled && styles.actionDisabled,
            ]}
            disabled={isNurseryActionDisabled}
            onPress={handleBuyNow}
          >
            <Text style={styles.buyNowText}>
              {t("plantDetail.buyNow", { defaultValue: "Buy now" })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.addToCartButton,
              isNurseryActionDisabled && styles.actionDisabled,
            ]}
            disabled={isNurseryActionDisabled}
            onPress={() => void handleAddToCart()}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.addToCartText}>
                {t("plantDetail.addToCart", { defaultValue: "Add to cart" })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F8F6",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F6F8F6",
    paddingHorizontal: SPACING.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: "#F6F8F6",
    paddingHorizontal: SPACING.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0D1B12",
  },
  errorText: {
    textAlign: "center",
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: "#13EC5B",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
  },
  retryText: {
    color: "#102216",
    fontWeight: "700",
  },
  heroWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: IMAGE_HEIGHT,
    backgroundColor: COLORS.gray200,
    zIndex: 1,
    elevation: 1,
  },
  heroImage: {
    width: "100%",
    height: IMAGE_HEIGHT,
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    zIndex: 6,
    elevation: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  cartBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  cartDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  scrollLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    overflow: "visible",
    zIndex: 3,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
    overflow: "visible",
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: IMAGE_HEIGHT - 24,
  },
  contentCard: {
    backgroundColor: "#F6F8F6",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 32,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 0,
  },
  dragHandleWrap: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dragHandle: {
    width: 48,
    height: 4,
    borderRadius: 9999,
    backgroundColor: "#D1D5DB",
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  nameWrap: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0D1B12",
    lineHeight: 30,
  },
  code: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  titleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#14532D",
  },
  price: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "700",
    color: "#13EC5B",
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E7F3EB",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4C9A66",
  },
  description: {
    marginTop: SPACING.lg,
    fontSize: 16,
    fontWeight: "400",
    color: "#4B5563",
    lineHeight: 26,
  },
  sectionWrap: {
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0D1B12",
    lineHeight: 28,
  },
  attrGrid: {
    marginTop: SPACING.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  attrCard: {
    width: ATTR_CARD_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F5F5F5",
    ...SHADOWS.sm,
  },
  attrIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  attrTextWrap: {
    flex: 1,
    flexShrink: 1,
  },
  attrLabel: {
    fontSize: 12,
    fontWeight: "400",
    color: "#6B7280",
    marginBottom: 4,
  },
  attrValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0D1B12",
    lineHeight: 20,
  },
  specCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F5F5F5",
    padding: 14,
    ...SHADOWS.sm,
  },
  specText: {
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  specLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  specIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  specKey: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  specRight: {
    alignItems: "flex-end",
    marginLeft: 12,
    minWidth: 80,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  chip: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 6,
    marginBottom: 6,
  },
  chipText: {
    fontSize: 12,
    color: "#1E293B",
    fontWeight: "600",
  },
  phBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  phText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3730A3",
  },
  tagsContainer: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagBadge: {
    backgroundColor: "#DBEAFE",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#2563EB",
  },
  emptyText: {
    marginTop: SPACING.sm,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  relatedLoaderWrap: {
    marginTop: SPACING.md,
    alignItems: "flex-start",
  },
  relatedSliderWrap: {
    marginTop: SPACING.md,
    position: "relative",
    marginHorizontal: -SPACING.xl,
  },
  relatedList: {
    paddingHorizontal: SPACING.xl,
  },
  relatedSeparator: {
    width: RELATED_CARD_GAP,
  },
  relatedCard: {
    width: RELATED_CARD_WIDTH,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    ...SHADOWS.sm,
  },
  relatedImageWrap: {
    width: RELATED_CARD_WIDTH - 24,
    height: RELATED_IMAGE_HEIGHT,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    overflow: "hidden",
    position: "relative",
  },
  relatedImage: {
    width: "100%",
    height: "100%",
  },
  relatedImagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.gray200,
  },
  relatedHeartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  relatedName: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#0D1B12",
    lineHeight: 22,
  },
  relatedSub: {
    fontSize: 12,
    fontWeight: "400",
    color: "#4C9A66",
    lineHeight: 16,
  },
  relatedPriceRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  relatedPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#13EC5B",
    flex: 1,
  },
  relatedArrowOverlay: {
    position: "absolute",
    top: 0,
    height: RELATED_IMAGE_HEIGHT,
    left: SPACING.xl,
    right: SPACING.xl,
    alignItems: "center",
  },
  relatedArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: COLORS.gray200,
    justifyContent: "center",
    alignItems: "center",
  },
  relatedArrowLeft: {
    position: "absolute",
    left: 4,
    top: "50%",
    marginTop: -14,
  },
  relatedArrowRight: {
    position: "absolute",
    right: 4,
    top: "50%",
    marginTop: -14,
  },
  bottomSpacer: {
    height: 104,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    paddingBottom: SPACING.lg,
    zIndex: 3,
    elevation: 3,
    gap: 10,
  },
  quantityControl: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#13EC5B",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0D1B12",
  },
  quantityStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  quantityBtnDisabled: {
    opacity: 0.4,
  },
  quantityValue: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "#0D1B12",
  },
  bottomActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  buyNowButton: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#13EC5B",
    backgroundColor: "#F0FDF4",
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  buyNowText: {
    fontSize: 16,
    color: "#13EC5B",
    fontWeight: "700",
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: "#13EC5B",
    borderRadius: 24,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  actionDisabled: {
    opacity: 0.7,
  },
  addToCartText: {
    fontSize: 16,
    color: "#102216",
    fontWeight: "700",
  },
  nurseryLoadingWrap: {
    marginTop: SPACING.md,
    alignItems: "flex-start",
  },
  nurseryList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  nurseryCard: {
    borderWidth: 1,
    borderColor: "#D7E4DB",
    borderRadius: 12,
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  nurseryCardSelected: {
    borderColor: "#13EC5B",
    backgroundColor: "#EDFEF3",
  },
  nurseryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  nurseryName: {
    fontSize: FONTS.sizes.md,
    fontWeight: "700",
    color: COLORS.textPrimary,
    flex: 1,
    marginHorizontal: 8,
  },
  nurseryAddress: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  nurseryMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  nurseryMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  nurseryFooter: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  nurseryAvailability: {
    fontSize: FONTS.sizes.sm,
    color: "#4C9A66",
    fontWeight: "600",
  },
  loadMoreBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#E7FDF0",
    borderWidth: 1,
    borderColor: "#13EC5B",
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#13EC5B",
  },
});
