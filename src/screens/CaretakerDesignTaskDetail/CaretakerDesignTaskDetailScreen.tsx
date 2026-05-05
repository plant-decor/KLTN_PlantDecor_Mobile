import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { BrandedHeader } from "../../components/branding";
import { API, COLORS, FONTS, RADIUS, SHADOWS, SPACING } from "../../constants";
import { designService } from "../../services";
import {
  DesignPackageMaterial,
  DesignTask,
  RootStackParamList,
} from "../../types";
import {
  formatVietnamDateTime,
  getDesignTaskStatusPalette,
  notify,
  resolveImageUri,
} from "../../utils";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "CaretakerDesignTaskDetail"
>;
type ScreenRouteProp = RouteProp<
  RootStackParamList,
  "CaretakerDesignTaskDetail"
>;

type SelectedImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

type MaterialUsageDraft = {
  actualQuantity: string;
  note: string;
};

const resolveBackendImageUri = (
  rawValue: string | null | undefined,
): string | null => {
  const resolved = resolveImageUri(rawValue);
  if (!resolved) {
    return null;
  }

  if (/^https?:\/\//i.test(resolved)) {
    return resolved;
  }

  const host = API.BASE_URL.replace(/\/api\/?$/i, "");
  const normalizedPath = resolved.startsWith("/") ? resolved : `/${resolved}`;
  return `${host}${normalizedPath}`;
};

const resolveImageMimeType = (fileName: string): string => {
  const normalizedName = fileName.toLowerCase();

  if (normalizedName.endsWith(".png")) {
    return "image/png";
  }
  if (normalizedName.endsWith(".webp")) {
    return "image/webp";
  }
  if (normalizedName.endsWith(".heic") || normalizedName.endsWith(".heif")) {
    return "image/heic";
  }

  return "image/jpeg";
};

export default function CaretakerDesignTaskDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  const taskId = route.params.taskId;

  const [task, setTask] = useState<DesignTask | null>(null);
  const [packageMaterials, setPackageMaterials] = useState<
    DesignPackageMaterial[]
  >([]);
  const [materialUsageDrafts, setMaterialUsageDrafts] = useState<
    Record<number, MaterialUsageDraft>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [surveyWidth, setSurveyWidth] = useState("");
  const [surveyLength, setSurveyLength] = useState("");
  const [surveyImage, setSurveyImage] = useState<SelectedImage | null>(null);
  const [reportImage, setReportImage] = useState<SelectedImage | null>(null);
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);
  const [isSubmittingMaterials, setIsSubmittingMaterials] = useState(false);
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const palette = getDesignTaskStatusPalette(task?.statusName ?? "");
  const reportImageUri = resolveBackendImageUri(task?.reportImageUrl);

  const isTaskCompleted = useMemo(() => {
    const normalized = task?.statusName?.trim().toLowerCase() ?? "";
    return normalized.includes("completed");
  }, [task?.statusName]);

  const loadDetail = useCallback(
    async (refresh?: boolean) => {
      try {
        if (refresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setErrorMessage(null);
        const [taskPayload, materialsPayload] = await Promise.all([
          designService.getDesignTaskDetail(taskId),
          designService.getDesignTaskPackageMaterials(taskId),
        ]);
        setTask(taskPayload);
        setPackageMaterials(materialsPayload);
        setMaterialUsageDrafts((current) => {
          const next = { ...current };
          materialsPayload.forEach((item) => {
            next[item.materialId] = next[item.materialId] ?? {
              actualQuantity:
                item.suggestedQuantity > 0
                  ? String(item.suggestedQuantity)
                  : "",
              note: "",
            };
          });
          return next;
        });
      } catch (error: any) {
        const apiMessage = error?.response?.data?.message;
        setErrorMessage(
          typeof apiMessage === "string" && apiMessage.trim().length > 0
            ? apiMessage
            : "Unable to load design task detail. Please try again.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [taskId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
    }, [loadDetail]),
  );

  useEffect(() => {
    if (task?.registration) {
      setSurveyWidth(
        (task.registration as any).width
          ? String((task.registration as any).width)
          : "",
      );
      setSurveyLength(
        (task.registration as any).length
          ? String((task.registration as any).length)
          : "",
      );
    }
  }, [task?.registration]);

  const isSurveyTask = useMemo(() => {
    const normalized = task?.taskTypeName?.trim().toLowerCase() ?? "";
    return normalized === "survey";
  }, [task?.taskTypeName]);

  const selectImage = useCallback(
    async (
      mode: "library" | "camera",
      onSelect: (image: SelectedImage) => void,
    ) => {
      const permission =
        mode === "library"
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== "granted") {
        notify({
          title: t("common.error", { defaultValue: "Error" }),
          message:
            mode === "library"
              ? "Please grant photo library access to continue."
              : "Please grant camera access to continue.",
        });
        return;
      }

      const result =
        mode === "library"
          ? await ImagePicker.launchImageLibraryAsync({
              allowsEditing: false,
              quality: 0.8,
            })
          : await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.8,
            });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      const uri = asset?.uri?.trim();
      if (!uri) {
        return;
      }

      const fileName =
        asset?.fileName?.trim() ||
        uri.split("/").pop() ||
        `image-${Date.now()}.jpg`;
      onSelect({
        uri,
        fileName,
        mimeType: asset?.mimeType?.trim() || resolveImageMimeType(fileName),
      });
    },
    [t],
  );

  const handleSubmitSurvey = useCallback(async () => {
    if (!task?.registration?.id) {
      return;
    }

    const width = Number(surveyWidth);
    const length = Number(surveyLength);
    if (!Number.isFinite(width) || !Number.isFinite(length)) {
      notify({
        title: t("common.error", { defaultValue: "Error" }),
        message: "Width and length must be valid numbers.",
      });
      return;
    }

    if (!surveyImage) {
      notify({
        title: t("common.error", { defaultValue: "Error" }),
        message: "Please select the current site image first.",
      });
      return;
    }

    try {
      setIsSubmittingSurvey(true);
      await designService.updateDesignSurveyInfo(task.registration.id, {
        Width: width,
        Length: length,
        currentStateImage: surveyImage,
      });
      notify({
        title: t("common.success", { defaultValue: "Success" }),
        message: "Survey information updated successfully.",
      });
      setSurveyImage(null);
      await loadDetail(true);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      notify({
        title: t("common.error", { defaultValue: "Error" }),
        message:
          typeof apiMessage === "string" && apiMessage.trim().length > 0
            ? apiMessage
            : "Unable to submit survey information. Please try again.",
      });
    } finally {
      setIsSubmittingSurvey(false);
    }
  }, [
    loadDetail,
    surveyImage,
    surveyLength,
    surveyWidth,
    t,
    task?.registration?.id,
  ]);

  const handleSubmitMaterialUsage = useCallback(async () => {
    const materialUsages = packageMaterials
      .map((item) => {
        const draft = materialUsageDrafts[item.materialId];
        const actualQuantity = Number(draft?.actualQuantity ?? "");
        if (!Number.isFinite(actualQuantity) || actualQuantity <= 0) {
          return null;
        }

        return {
          materialId: item.materialId,
          actualQuantity,
          note: draft?.note?.trim() || undefined,
        };
      })
      .filter(
        (
          item,
        ): item is {
          materialId: number;
          actualQuantity: number;
          note: string | undefined;
        } => item !== null,
      );

    if (materialUsages.length === 0) {
      notify({
        title: t("common.error", { defaultValue: "Error" }),
        message:
          "Enter at least one material usage quantity greater than zero.",
      });
      return;
    }

    try {
      setIsSubmittingMaterials(true);
      const payload = await designService.reportDesignTaskMaterialUsage(
        taskId,
        {
          materialUsages,
        },
      );
      setTask(payload);
      notify({
        title: t("common.success", { defaultValue: "Success" }),
        message: "Material usage reported successfully.",
      });
      await loadDetail(true);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      notify({
        title: t("common.error", { defaultValue: "Error" }),
        message:
          typeof apiMessage === "string" && apiMessage.trim().length > 0
            ? apiMessage
            : "Unable to report material usage. Please try again.",
      });
    } finally {
      setIsSubmittingMaterials(false);
    }
  }, [loadDetail, materialUsageDrafts, packageMaterials, t, taskId]);

  const handleCompleteTask = useCallback(async () => {
    if (!reportImage) {
      notify({
        title: t("common.error", { defaultValue: "Error" }),
        message: "Please select a completion report image first.",
      });
      return;
    }

    try {
      setIsSubmittingComplete(true);
      const payload = await designService.completeDesignTask(taskId, {
        reportImage,
      });
      setTask(payload);
      setReportImage(null);
      notify({
        title: t("common.success", { defaultValue: "Success" }),
        message: "Task completed successfully.",
      });
      await loadDetail(true);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      notify({
        title: t("common.error", { defaultValue: "Error" }),
        message:
          typeof apiMessage === "string" && apiMessage.trim().length > 0
            ? apiMessage
            : "Unable to complete task. Please try again.",
      });
    } finally {
      setIsSubmittingComplete(false);
    }
  }, [loadDetail, reportImage, t, taskId]);

  const header = (
    <BrandedHeader
      brandVariant="none"
      containerStyle={styles.header}
      sideWidth={88}
      title="Design task detail"
      left={
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      }
    />
  );

  if (isLoading && !task) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || !task) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {errorMessage ?? "Design task not found."}
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => void loadDetail()}
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {header}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contentContainer}
      >
        {isRefreshing ? <ActivityIndicator color={COLORS.primary} /> : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{task.taskTypeName}</Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: palette.backgroundColor,
                  borderColor: palette.borderColor,
                },
              ]}
            >
              <Text style={[styles.statusText, { color: palette.textColor }]}>
                {task.statusName}
              </Text>
            </View>
          </View>
          <Text style={styles.metaText}>
            Registration #{task.designRegistrationId}
          </Text>
          <Text style={styles.metaText}>
            Registration status: {task.registration?.statusName ?? "-"}
          </Text>
          <Text style={styles.metaText}>
            Assigned staff: {task.assignedStaff?.fullName ?? "-"}
          </Text>
          <Text style={styles.metaText}>
            Created:{" "}
            {formatVietnamDateTime(task.createdAt, locale, { empty: "-" })}
          </Text>
          <Text style={styles.metaText}>
            Scheduled date: {task.scheduledDate ?? "-"}
          </Text>
          <Text style={styles.metaText}>
            Address: {task.registration?.address ?? "-"}
          </Text>
          <Text style={styles.metaText}>
            Phone: {task.registration?.phone ?? "-"}
          </Text>

          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() =>
              navigation.navigate("CaretakerDesignRegistrationDetail", {
                registrationId: task.designRegistrationId,
                highlightedTaskId: task.id,
              })
            }
          >
            <Text style={styles.ghostButtonText}>Open registration detail</Text>
          </TouchableOpacity>
        </View>

        {isSurveyTask ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Survey update</Text>
            <View style={styles.rowGap}>
              <View style={styles.flex}>
                <Text style={styles.inputLabel}>Width</Text>
                <TextInput
                  style={styles.input}
                  value={surveyWidth}
                  onChangeText={setSurveyWidth}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.inputLabel}>Length</Text>
                <TextInput
                  style={styles.input}
                  value={surveyLength}
                  onChangeText={setSurveyLength}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
            </View>

            <View style={styles.rowGap}>
              <TouchableOpacity
                style={[styles.ghostButton, styles.flex]}
                onPress={() => void selectImage("library", setSurveyImage)}
              >
                <Text style={styles.ghostButtonText}>Choose site image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ghostButton, styles.flex]}
                onPress={() => void selectImage("camera", setSurveyImage)}
              >
                <Text style={styles.ghostButtonText}>Take photo</Text>
              </TouchableOpacity>
            </View>

            {surveyImage ? (
              <Text style={styles.metaText}>
                Selected: {surveyImage.fileName}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isSubmittingSurvey && styles.disabledButton,
              ]}
              onPress={() => void handleSubmitSurvey()}
              disabled={isSubmittingSurvey}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmittingSurvey
                  ? "Submitting survey..."
                  : "Submit survey info"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Package material suggestions</Text>
          {packageMaterials.length === 0 ? (
            <Text style={styles.metaText}>No suggested materials.</Text>
          ) : null}

          {packageMaterials.map((item) => {
            const draft = materialUsageDrafts[item.materialId] ?? {
              actualQuantity: "",
              note: "",
            };

            return (
              <View key={item.materialId} style={styles.materialCard}>
                <Text style={styles.cardTitleSmall}>{item.materialName}</Text>
                <Text style={styles.metaText}>
                  Suggested: {item.suggestedQuantity}
                </Text>
                <Text style={styles.metaText}>
                  Available in nursery:{" "}
                  {item.isAvailableInNursery ? "Yes" : "No"}
                </Text>
                <Text style={styles.metaText}>
                  Available quantity: {item.availableQuantity}
                </Text>

                <Text style={styles.inputLabel}>Actual quantity</Text>
                <TextInput
                  style={styles.input}
                  value={draft.actualQuantity}
                  onChangeText={(value) =>
                    setMaterialUsageDrafts((current) => ({
                      ...current,
                      [item.materialId]: {
                        ...draft,
                        actualQuantity: value,
                      },
                    }))
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textLight}
                />

                <Text style={styles.inputLabel}>Note</Text>
                <TextInput
                  style={styles.input}
                  value={draft.note}
                  onChangeText={(value) =>
                    setMaterialUsageDrafts((current) => ({
                      ...current,
                      [item.materialId]: {
                        ...draft,
                        note: value,
                      },
                    }))
                  }
                  placeholder="Optional note"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
            );
          })}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              isSubmittingMaterials && styles.disabledButton,
            ]}
            onPress={() => void handleSubmitMaterialUsage()}
            disabled={isSubmittingMaterials}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmittingMaterials
                ? "Submitting materials..."
                : "Report material usage"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Complete task</Text>

          {!isTaskCompleted ? (
            <View style={styles.rowGap}>
              <TouchableOpacity
                style={[styles.ghostButton, styles.flex]}
                onPress={() => void selectImage("library", setReportImage)}
              >
                <Text style={styles.ghostButtonText}>Choose report image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ghostButton, styles.flex]}
                onPress={() => void selectImage("camera", setReportImage)}
              >
                <Text style={styles.ghostButtonText}>Take photo</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!isTaskCompleted && reportImage ? (
            <Text style={styles.metaText}>Selected: {reportImage.fileName}</Text>
          ) : null}

          {reportImageUri ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPreviewImageUri(reportImageUri)}
            >
              <Image source={{ uri: reportImageUri }} style={styles.reportImage} />
            </TouchableOpacity>
          ) : null}

          {!isTaskCompleted ? (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                isSubmittingComplete && styles.disabledButton,
              ]}
              onPress={() => void handleCompleteTask()}
              disabled={isSubmittingComplete}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmittingComplete ? "Completing task..." : "Complete task"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {task.taskMaterialUsages?.length ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reported material usage</Text>
            {task.taskMaterialUsages.map((item) => (
              <Text key={item.id} style={styles.metaText}>
                - {item.materialName} x{item.actualQuantity}
                {item.note ? ` (${item.note})` : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

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
    zIndex: 2,
  },
  fullImagePreview: {
    width: "100%",
    height: "82%",
  },
  header: {
    paddingHorizontal: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  flex: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
  },
  cardTitleSmall: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
  },
  metaText: {
    fontFamily: FONTS.regular,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.sm,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  statusText: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.xs,
  },
  ghostButton: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostButtonText: {
    color: COLORS.primary,
    fontFamily: FONTS.medium,
    fontSize: FONTS.sizes.md,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.md,
  },
  inputLabel: {
    fontFamily: FONTS.medium,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    color: COLORS.textPrimary,
    fontFamily: FONTS.regular,
  },
  rowGap: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  materialCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  reportImage: {
    width: "100%",
    height: 180,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: FONTS.medium,
    fontSize: FONTS.sizes.md,
    textAlign: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
