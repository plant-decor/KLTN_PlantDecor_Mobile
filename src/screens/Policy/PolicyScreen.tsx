import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  SectionList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { RootStackParamList, PolicyContent, PolicyEnum } from "../../types";
import { policyService } from "../../services";
import BrandedHeader from "../../components/branding/BrandedHeader";
import { useTranslation } from "react-i18next";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PolicyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  const [policies, setPolicies] = useState<PolicyContent[]>([]);
  const [categories, setCategories] = useState<
    { value: number; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [policiesRes, enumsRes] = await Promise.all([
        policyService.getAllActivePolicies(),
        policyService.getPolicyEnums(),
      ]);

      if (policiesRes.success) {
        setPolicies(policiesRes.payload);
      }
      if (enumsRes.success) {
        const catEnum = enumsRes.payload.find(
          (e) => e.enumName === "PolicyContentCategory",
        );
        if (catEnum) {
          setCategories(catEnum.values);
        }
      }
    } catch (error) {
      console.error("Failed to fetch policies", error);
    } finally {
      setLoading(false);
    }
  };

  const sections = useMemo(() => {
    const grouped = categories
      .map((category) => {
        const categoryPolicies = policies
          .filter((p) => p.category === category.value)
          .sort((a, b) => a.displayOrder - b.displayOrder);
        return {
          title: category.name, // Later, can be localized or mapped if needed
          data: categoryPolicies,
        };
      })
      .filter((section) => section.data.length > 0);
    return grouped;
  }, [policies, categories]);

  const handlePolicyPress = (policy: PolicyContent) => {
    navigation.navigate("PolicyDetail", {
      policyId: policy.id,
      title: policy.title,
    });
  };

  const renderItem = ({ item }: { item: PolicyContent }) => (
    <TouchableOpacity
      style={styles.policyItem}
      onPress={() => handlePolicyPress(item)}
    >
      <View style={styles.policyItemContent}>
        <Text style={styles.policyTitle}>{item.title}</Text>
        <Text style={styles.policySummary} numberOfLines={2}>
          {item.summary}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: { title: string } }) => {
    // Basic formatting for enum name if needed (e.g., "UserPolicy" -> "User Policy")
    const formattedTitle = section.title.replace(/([A-Z])/g, " $1").trim();

    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{formattedTitle}</Text>
      </View>
    );
  };
  const TEXT_DARK = "#0D1B12";
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <BrandedHeader
        title={t("common.policy", { defaultValue: "Policies" })}
        left={
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
        }
        brandVariant="none"
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : policies.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons
            name="document-text-outline"
            size={64}
            color={COLORS.gray300}
          />
          <Text style={styles.emptyText}>
            {t("policy.empty", { defaultValue: "No policies available" })}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  listContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING["3xl"],
  },
  sectionHeader: {
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  policyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  policyItemContent: {
    flex: 1,
    marginRight: SPACING.md,
  },
  policyTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  policySummary: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
});
