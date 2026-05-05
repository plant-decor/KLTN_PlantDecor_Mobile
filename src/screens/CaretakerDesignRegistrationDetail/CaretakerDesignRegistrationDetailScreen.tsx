import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { BrandedHeader } from "../../components/branding";
import { API, COLORS, FONTS, RADIUS, SHADOWS, SPACING } from "../../constants";
import { designService } from "../../services";
import {
  DesignRegistration,
  DesignTask,
  RootStackParamList,
} from "../../types";
import {
  formatVietnamDateTime,
  getDesignRegistrationStatusPalette,
  getDesignTaskStatusPalette,
  resolveImageUri,
  sortDesignTasks,
} from "../../utils";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "CaretakerDesignRegistrationDetail"
>;
type ScreenRouteProp = RouteProp<
  RootStackParamList,
  "CaretakerDesignRegistrationDetail"
>;

const formatCurrency = (amount: number): string =>
  `${(amount || 0).toLocaleString("vi-VN")} VND`;

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

export default function CaretakerDesignRegistrationDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  const { registrationId, highlightedTaskId } = route.params;

  const [registration, setRegistration] = useState<DesignRegistration | null>(
    null,
  );
  const [tasks, setTasks] = useState<DesignTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [registrationPayload, taskPayload] = await Promise.all([
        designService.getDesignRegistrationDetail(registrationId),
        designService.getDesignTasksByRegistration(registrationId),
      ]);
      setRegistration(registrationPayload);
      setTasks(sortDesignTasks(taskPayload ?? []));
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      setErrorMessage(
        typeof apiMessage === "string" && apiMessage.trim().length > 0
          ? apiMessage
          : "Unable to load design registration detail. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const registrationPalette = useMemo(
    () => getDesignRegistrationStatusPalette(registration?.statusName ?? ""),
    [registration?.statusName],
  );

  const header = (
    <BrandedHeader
      brandVariant="none"
      containerStyle={styles.header}
      sideWidth={88}
      title={t("designService.registrationDetailHeader", {
        defaultValue: "Registration detail",
      })}
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || !registration) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {errorMessage ?? "Design registration not found."}
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

  const templateImageUri = resolveBackendImageUri(
    registration.designTemplateTier?.designTemplate?.imageUrl,
  );
  const surveyImageUri = resolveBackendImageUri(
    registration.currentStateImageUrl,
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {header}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>
              {registration.designTemplateTier?.designTemplate?.name ??
                "Design template"}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: registrationPalette.backgroundColor },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: registrationPalette.textColor },
                ]}
              >
                {registration.statusName}
              </Text>
            </View>
          </View>
          {templateImageUri ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPreviewImageUri(templateImageUri)}
            >
              <Image
                source={{ uri: templateImageUri }}
                style={styles.heroImage}
              />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.metaText}>
            Tier: {registration.designTemplateTier?.tierName ?? "-"}
          </Text>
          <Text style={styles.metaText}>
            Total: {formatCurrency(registration.totalPrice)}
          </Text>
          <Text style={styles.metaText}>
            Deposit: {formatCurrency(registration.depositAmount)}
          </Text>
          <Text style={styles.metaText}>
            Nursery: {registration.nursery?.name ?? "-"}
          </Text>
          <Text style={styles.metaText}>Address: {registration.address}</Text>
          <Text style={styles.metaText}>Phone: {registration.phone}</Text>
          <Text style={styles.metaText}>
            Approved:{" "}
            {formatVietnamDateTime(registration.approvedAt, locale, {
              empty: "-",
            })}
          </Text>
          <Text style={styles.metaText}>
            Width: {registration.width ?? "-"}
          </Text>
          <Text style={styles.metaText}>
            Length: {registration.length ?? "-"}
          </Text>
          {surveyImageUri ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPreviewImageUri(surveyImageUri)}
            >
              <Image
                source={{ uri: surveyImageUri }}
                style={styles.surveyImage}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <Text style={styles.metaText}>
            Name: {registration.customer?.fullName ?? "-"}
          </Text>
          <Text style={styles.metaText}>
            Phone: {registration.customer?.phone ?? "-"}
          </Text>
          <Text style={styles.metaText}>
            Email: {registration.customer?.email ?? "-"}
          </Text>
          <Text style={styles.metaText}>
            Customer note: {registration.customerNote?.trim() || "-"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Task history</Text>
          {tasks.length === 0 ? (
            <Text style={styles.metaText}>No tasks found.</Text>
          ) : null}

          {tasks.map((task) => {
            const palette = getDesignTaskStatusPalette(task.statusName ?? "");
            const reportImageUri = resolveBackendImageUri(task.reportImageUrl);
            const isHighlighted = highlightedTaskId === task.id;

            return (
              <View
                key={task.id}
                style={[
                  styles.taskCard,
                  isHighlighted && styles.highlightedTaskCard,
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitleSmall}>{task.taskTypeName}</Text>
                  <View
                    style={[
                      styles.taskStatusBadge,
                      {
                        backgroundColor: palette.backgroundColor,
                        borderColor: palette.borderColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.taskStatusText,
                        { color: palette.textColor },
                      ]}
                    >
                      {task.statusName}
                    </Text>
                  </View>
                </View>
                <Text style={styles.metaText}>
                  Created:{" "}
                  {formatVietnamDateTime(task.createdAt, locale, {
                    empty: "-",
                  })}
                </Text>
                <Text style={styles.metaText}>
                  Scheduled date: {task.scheduledDate ?? "-"}
                </Text>
                {task.taskMaterialUsages?.map((usage) => (
                  <Text key={usage.id} style={styles.metaText}>
                    - {usage.materialName} x{usage.actualQuantity}
                    {usage.note ? ` (${usage.note})` : ""}
                  </Text>
                ))}
                {reportImageUri ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setPreviewImageUri(reportImageUri)}
                  >
                    <Image
                      source={{ uri: reportImageUri }}
                      style={styles.reportImage}
                    />
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() =>
                    navigation.navigate("CaretakerDesignTaskDetail", {
                      taskId: task.id,
                    })
                  }
                >
                  <Text style={styles.primaryButtonText}>Open task detail</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
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
    flex: 1,
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
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  statusText: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.xs,
  },
  heroImage: {
    width: "100%",
    height: 180,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  surveyImage: {
    width: "100%",
    height: 180,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  taskCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  highlightedTaskCard: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondaryLight,
  },
  taskStatusBadge: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  taskStatusText: {
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.xs,
  },
  reportImage: {
    width: "100%",
    height: 160,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: FONTS.sizes.md,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: FONTS.medium,
    fontSize: FONTS.sizes.md,
    textAlign: "center",
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
});
