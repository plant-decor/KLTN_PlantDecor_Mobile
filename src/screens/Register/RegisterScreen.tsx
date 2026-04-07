import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { COLORS, ICONS, RADIUS, SPACING } from "../../constants";
import { RootStackParamList } from "../../types";
import { useAuthStore } from "../../stores/useAuthStore";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Register">;

const { width } = Dimensions.get("window");
const HERO_HEIGHT = 352;

const TOP_IMAGE =
  "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=1400&q=80";

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);

  const registerLabel = i18n.language?.startsWith("vi")
    ? "Đăng\u00A0ký"
    : t("common.register", { defaultValue: "Register" });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = async () => {
    // Basic validation
    if (
      !email ||
      !password ||
      !confirmPassword ||
      !fullName ||
      !username ||
      !phoneNumber
    ) {
      Alert.alert(
        t("common.error"),
        t("register.fillAllFields") || "Please fill in all fields",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        t("common.error"),
        t("register.passwordMismatch") || "Passwords do not match",
      );
      return;
    }

    try {
      const { message } = await register({
        email,
        password,
        confirmPassword,
        username,
        fullName,
        phoneNumber,
      });

      // Show success message
      Alert.alert(
        t("common.success"),
        message ||
          t("register.success") ||
          "Registration successful! Please verify your email.",
        [
          {
            text: "OK",
            onPress: () =>
              navigation.navigate("VerifyCode", { email, password }),
          },
        ],
      );
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        t("common.error") ||
        "Registration failed";
      Alert.alert(t("common.error"), errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      {/* Hero background */}
      <View style={styles.heroWrap}>
        <Image
          source={{ uri: TOP_IMAGE }}
          style={styles.topImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.10)", "rgba(0,0,0,0.20)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroOverlay}
        />

        <View style={styles.brandWrap}>
          <View style={styles.dotGrid}>
            {new Array(9).fill(null).map((_, i) => (
              <View
                key={i}
                style={[styles.brandDot, i % 2 === 0 && styles.brandDotMuted]}
              />
            ))}
          </View>
          <Text style={styles.brandText}>PlantDecor</Text>
        </View>
      </View>

      {/* Back to home button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.navigate("MainTabs")}
        activeOpacity={0.7}
      >
        <Ionicons name="home-outline" size={20} color={COLORS.white} />
        <Text style={styles.backBtnText}>{t("common.backToHome")}</Text>
      </TouchableOpacity>

      {/* Scrollable content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Spacer so card starts below the hero */}
          <View style={{ height: HERO_HEIGHT - 48 }} />

          <View style={styles.card}>
            <View style={styles.headerTexts}>
              <Text style={styles.title}>{t("register.title")}</Text>
              <Text style={styles.subtitle}>{t("register.subtitle")}</Text>
            </View>

            <View style={styles.switchRow}>
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.switchText} allowFontScaling={false}>
                  {t("common.login")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.switchBtn, styles.switchBtnActive]}
              >
                <Text
                  style={[styles.switchText, styles.switchTextActive]}
                  allowFontScaling={false}
                >
                  {registerLabel}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={20} color="#9CA3AF" />
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t("register.fullName")}
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="at-outline" size={20} color="#9CA3AF" />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder={t("register.username")}
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("register.emailOrPhone")}
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={20} color="#9CA3AF" />
                <TextInput
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder={t("register.phoneNumber")}
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#9CA3AF"
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("register.password")}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#9CA3AF"
                />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t("register.confirmPassword")}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  style={styles.input}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                isLoading && styles.primaryBtnDisabled,
              ]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              <Text style={styles.primaryBtnText}>
                {isLoading ? t("common.loading") : registerLabel}
              </Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.orText}>{t("common.or")}</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity style={styles.googleBtn}>
              <ICONS.google width={24} height={24} />
              <Text style={styles.googleText}>
                {t("common.continueWithGoogle")}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginHintWrap}>
              <Text style={styles.loginHintText}>
                {t("register.alreadyHaveAccount")}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.loginHintAction}>{t("common.login")}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.termsWrap}>
              <Text style={styles.termsText}>{t("common.termsPrefix")}</Text>
              <Text style={[styles.termsText, styles.termsBold]}>
                {t("common.terms")}
              </Text>
              <Text style={styles.termsText}>{t("common.and")}</Text>
              <Text style={[styles.termsText, styles.termsBold]}>
                {t("common.privacyPolicy")}
              </Text>
              <Text style={styles.termsText}>{t("common.termsSuffix")}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  heroWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  topImage: {
    width,
    height: HERO_HEIGHT,
    position: "absolute",
    top: 0,
    left: 0,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  brandWrap: {
    alignItems: "center",
  },
  dotGrid: {
    width: 48,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 5.33,
    marginBottom: 8,
  },
  brandDot: {
    width: 12,
    height: 12,
    borderRadius: RADIUS.full,
    backgroundColor: "#10B981",
  },
  brandDotMuted: {
    opacity: 0.6,
  },
  brandText: {
    color: COLORS.white,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "400",
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 38,
    left: SPACING.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.30)",
    zIndex: 10,
  },
  backBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    marginHorizontal: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 32,
    gap: 32,
  },
  headerTexts: {
    width: "100%",
    gap: 8,
    alignItems: "center",
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: "#6B7280",
    textAlign: "center",
  },
  switchRow: {
    width: "100%",
    backgroundColor: "#E5E7EB",
    borderRadius: RADIUS.full,
    padding: 4,
    flexDirection: "row",
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  switchBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  switchText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  switchTextActive: {
    color: "#0F172A",
  },
  inputGroup: {
    width: "100%",
    gap: 16,
  },
  inputWrap: {
    width: "100%",
    height: 56,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F8F9FD",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#0F172A",
  },
  primaryBtn: {
    width: "100%",
    height: 56,
    borderRadius: 24,
    backgroundColor: "#13EC5B",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#13EC5B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: "#102216",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  primaryBtnDisabled: {
    backgroundColor: "#9CA3AF",
    shadowColor: "#9CA3AF",
    opacity: 0.6,
  },
  dividerRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  orText: {
    paddingHorizontal: 16,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: "#9CA3AF",
  },
  googleBtn: {
    width: "100%",
    height: 56,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 13,
  },
  googleText: {
    color: "#102216",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  loginHintWrap: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  loginHintText: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
  loginHintAction: {
    color: "#10B981",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  termsWrap: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  termsText: {
    fontSize: 10,
    color: "#9CA3AF",
    textTransform: "uppercase",
    lineHeight: 16,
    letterSpacing: 1,
    textAlign: "center",
  },
  termsBold: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
