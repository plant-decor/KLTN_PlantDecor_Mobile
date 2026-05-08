import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../constants";
import { RootStackParamList, PolicyContent } from "../../types";
import { policyService } from "../../services";
import BrandedHeader from "../../components/branding/BrandedHeader";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "PolicyDetail"
>;
type PolicyDetailRouteProp = RouteProp<RootStackParamList, "PolicyDetail">;

export default function PolicyDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PolicyDetailRouteProp>();
  const { policyId, title } = route.params;

  const [policy, setPolicy] = useState<PolicyContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPolicyDetail();
  }, [policyId]);

  const fetchPolicyDetail = async () => {
    try {
      setLoading(true);
      const res = await policyService.getPolicyDetail(policyId);
      if (res.success) {
        setPolicy(res.payload);
      }
    } catch (error) {
      console.error("Failed to fetch policy detail", error);
    } finally {
      setLoading(false);
    }
  };
  const TEXT_DARK = "#0D1B12";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <BrandedHeader
        title={title || "Policy Detail"}
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
      ) : !policy ? (
        <View style={styles.centerContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={COLORS.gray300}
          />
          <Text style={styles.errorText}>Failed to load policy content</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>{policy.title}</Text>
            {policy.updatedAt && (
              <Text style={styles.date}>
                Last updated: {new Date(policy.updatedAt).toLocaleDateString()}
              </Text>
            )}
            <View style={styles.divider} />
            <Text style={styles.content}>{policy.content}</Text>
          </View>
        </ScrollView>
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
  contentContainer: {
    flex: 1,
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING["3xl"],
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  date: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
  },
  content: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
});
