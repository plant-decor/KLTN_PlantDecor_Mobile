import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { aiChatService } from "../../services";
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from "../../constants";
import { BrandMark } from "../../components/branding";
import { useAuthStore } from "../../stores";
import {
  AIChatEnumGroup,
  AIChatHistoryMessage,
  AIChatMessage,
  AIChatSessionSummary,
  AIChatSuggestedPlant,
  RootStackParamList,
  SystemEnumValue,
} from "../../types";
import { formatVietnamDateTime, toVietnamTimestamp } from "../../utils";
import { resolveImageUri } from "../../utils/image";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "AIChat">;
type RouteProps = RouteProp<RootStackParamList, "AIChat">;

type FilterState = {
  preferredRoom?: string | null;
  fengShuiElement?: string | null;
  maxBudget: string;
  limit: string;
  petSafe: boolean;
  childSafe: boolean;
  onlyPurchasable: boolean;
  roomDescription?: string | null;
};

const DEFAULT_FILTERS: FilterState = {
  preferredRoom: null,
  fengShuiElement: null,
  maxBudget: "",
  limit: "",
  petSafe: false,
  childSafe: false,
  onlyPurchasable: true,
  roomDescription: "",
};

const TYPING_MESSAGE_ID = "assistant-typing";

const upsertMessages = (
  current: AIChatMessage[],
  incoming: AIChatMessage[],
): AIChatMessage[] => {
  const map = new Map<string, AIChatMessage>();

  current.forEach((message) => {
    map.set(String(message.id), message);
  });

  incoming.forEach((message) => {
    map.set(String(message.id), {
      ...(map.get(String(message.id)) ?? {}),
      ...message,
    });
  });

  return [...map.values()].sort(
    (a, b) => toVietnamTimestamp(b.createdAt) - toVietnamTimestamp(a.createdAt),
  );
};

const normalizeStatusLabel = (status: AIChatSessionSummary["status"]) => {
  if (status === 1 || String(status).toLowerCase() === "active") {
    return "Active";
  }

  if (status === 2 || String(status).toLowerCase() === "closed") {
    return "Closed";
  }

  return String(status);
};

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return `${value.toLocaleString("vi-VN")} VND`;
};

const formatRelativeTime = (
  value: string | null | undefined,
  locale: string,
) => {
  if (!value) {
    return "";
  }

  const formatted = formatVietnamDateTime(value, locale, {
    empty: "",
    hour12: false,
  });
  return formatted || value;
};

const parsePositiveNumber = (value: string): number | null => {
  const normalized = Number(value.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
};

const buildSessionTitle = (message: string) => message.trim().slice(0, 60);

const resolveInitial = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "?";
  }

  return trimmed[0]?.toUpperCase() ?? "?";
};

const mapHistoryMessageToChatMessage = (
  message: AIChatHistoryMessage,
): AIChatMessage => ({
  id: message.messageId,
  role: message.role,
  content: message.content,
  intent: message.intent,
  isFallback: message.isFallback,
  isPolicyResponse: message.isPolicyResponse,
  createdAt: message.createdAt,
  suggestedPlants: message.suggestedPlants,
  careTips: message.careTips,
});

export default function AIChatScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("vi") ? "vi-VN" : "en-US";
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const skipNextSessionLoadRef = useRef(false);
  const user = useAuthStore((state) => state.user);

  const [activeSession, setActiveSession] =
    useState<AIChatSessionSummary | null>(null);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [headerLoading, setHeaderLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [enumGroups, setEnumGroups] = useState<AIChatEnumGroup[]>([]);
  const [expandedSuggested, setExpandedSuggested] = useState<
    Record<string, boolean>
  >({});
  const [expandedCareTips, setExpandedCareTips] = useState<
    Record<string, boolean>
  >({});

  const userAvatarUri = useMemo(
    () => resolveImageUri(user?.avatar ?? user?.avatarUrl),
    [user?.avatar, user?.avatarUrl],
  );
  const userInitial = useMemo(
    () =>
      resolveInitial(
        user?.fullName ?? user?.username ?? user?.email ?? user?.phone ?? null,
      ),
    [user?.fullName, user?.username, user?.email, user?.phone],
  );
  const typingDots = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.3),
    new Animated.Value(0.3),
  ]).current;
  const typingLoopsRef = useRef<Animated.CompositeAnimation[]>([]);
  const hasTypingMessage = useMemo(
    () => messages.some((message) => String(message.id) === TYPING_MESSAGE_ID),
    [messages],
  );

  const roomTypeOptions = useMemo(
    () =>
      enumGroups.find((group) => group.enumName === "RoomType")?.values ?? [],
    [enumGroups],
  );
  const fengShuiOptions = useMemo(
    () =>
      enumGroups.find((group) => group.enumName === "FengShuiElement")
        ?.values ?? [],
    [enumGroups],
  );

  const loadSessionHistory = async (sessionId: number) => {
    const response = await aiChatService.getSessionHistory(sessionId, {
      pageNumber: 1,
      pageSize: 50,
    });

    setActiveSession({
      sessionId: response.payload.sessionId,
      title: response.payload.title,
      status: response.payload.status,
      startedAt: response.payload.startedAt,
      endedAt: response.payload.endedAt,
      updatedAt:
        response.payload.messages[0]?.createdAt ?? response.payload.startedAt,
    });
    setMessages(
      response.payload.messages.map((message) =>
        mapHistoryMessageToChatMessage(message),
      ),
    );
  };

  const loadEnums = async () => {
    try {
      const response = await aiChatService.getEnums();
      setEnumGroups(response);
    } catch (loadError) {
      console.error("Failed to load AI chat enums:", loadError);
    }
  };

  const loadInitialSession = async () => {
    try {
      setLoadingHistory(true);
      setError(null);

      if (route.params?.createNew) {
        setActiveSession(null);
        setMessages([]);
        return;
      }

      if (route.params?.sessionId) {
        await loadSessionHistory(route.params.sessionId);
        return;
      }

      const response = await aiChatService.getSessions({
        pageNumber: 1,
        pageSize: 20,
      });
      const nextSession = response.payload.items[0] ?? null;

      if (!nextSession) {
        setActiveSession(null);
        setMessages([]);
        return;
      }

      await loadSessionHistory(nextSession.sessionId);
    } catch (loadError: any) {
      setError(
        loadError?.response?.data?.message ??
          loadError?.message ??
          t("common.error", { defaultValue: "Something went wrong." }),
      );
      setActiveSession(null);
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadEnums();
  }, []);

  useEffect(() => {
    if (skipNextSessionLoadRef.current) {
      skipNextSessionLoadRef.current = false;
      return;
    }

    void loadInitialSession();
  }, [route.params?.sessionId, route.params?.createNew]);

  useEffect(() => {
    typingLoopsRef.current.forEach((loop) => loop.stop());
    typingLoopsRef.current = [];

    if (!hasTypingMessage) {
      typingDots.forEach((dot) => dot.setValue(0.3));
      return;
    }

    typingDots.forEach((dot, index) => {
      dot.setValue(0.3);

      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, {
            toValue: 1,
            duration: 240,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 240,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(360),
        ]),
      );

      typingLoopsRef.current.push(loop);
      loop.start();
    });

    return () => {
      typingLoopsRef.current.forEach((loop) => loop.stop());
      typingLoopsRef.current = [];
    };
  }, [hasTypingMessage, typingDots]);

  const createNewDraftSession = () => {
    setActiveSession(null);
    setMessages([]);
    setError(null);
    navigation.setParams?.({ sessionId: undefined, createNew: true });
  };

  const handleOpenSessions = () => {
    navigation.navigate("AIChatSessions", {
      selectedSessionId: activeSession?.sessionId,
    });
  };

  const handleRetryHistory = () => {
    void loadInitialSession();
  };

  const buildTypingMessage = (): AIChatMessage => ({
    id: TYPING_MESSAGE_ID,
    role: "assistant",
    content: "",
    createdAt: new Date(Date.now() + 1).toISOString(),
    pending: true,
  });

  const removeTypingMessage = (items: AIChatMessage[]) =>
    items.filter((message) => String(message.id) !== TYPING_MESSAGE_ID);

  const sendMessage = async (
    rawText: string,
    options?: { clearInput?: boolean },
  ) => {
    const trimmedText = rawText.trim();
    if (!trimmedText || sending) {
      return;
    }

    Keyboard.dismiss();
    setSending(true);
    setError(null);

    const optimisticUserMessage: AIChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: trimmedText,
      createdAt: new Date().toISOString(),
    };

    const currentMessages = upsertMessages(messages, [optimisticUserMessage]);
    const messagesWithTyping = upsertMessages(currentMessages, [
      buildTypingMessage(),
    ]);
    setMessages(messagesWithTyping);
    if (options?.clearInput ?? true) {
      setText("");
    }
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

    try {
      let session = activeSession;

      if (!session) {
        setHeaderLoading(false);
        const sessionResponse = await aiChatService.createSession({
          title: buildSessionTitle(trimmedText),
        });
        session = sessionResponse.payload;
        setActiveSession(session);
        skipNextSessionLoadRef.current = true;
        navigation.setParams?.({
          sessionId: session.sessionId,
          createNew: false,
        });
      }

      const conversationHistory = currentMessages
        .filter(
          (message) => !message.failed && message.content.trim().length > 0,
        )
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const response = await aiChatService.sendMessage({
        sessionId: session.sessionId,
        message: trimmedText,
        preferredRooms: filters.preferredRoom
          ? [filters.preferredRoom]
          : undefined,
        roomDescription: filters.roomDescription ?? undefined,
        fengShuiElement: filters.fengShuiElement ?? undefined,
        maxBudget: parsePositiveNumber(filters.maxBudget),
        limit: parsePositiveNumber(filters.limit),
        petSafe: filters.petSafe ? true : null,
        childSafe: filters.childSafe ? true : null,
        onlyPurchasable: filters.onlyPurchasable,
        conversationHistory,
      });

      const assistantMessage: AIChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.payload.reply,
        intent: response.payload.intent,
        isFallback: response.payload.usedFallback ?? false,
        isPolicyResponse: false,
        createdAt: new Date().toISOString(),
        suggestedPlants: response.payload.suggestedPlants ?? [],
        careTips: response.payload.careTips ?? [],
        followUpQuestions: response.payload.followUpQuestions ?? [],
        disclaimer: response.payload.disclaimer ?? null,
      };

      setMessages((previousMessages) =>
        upsertMessages(
          removeTypingMessage(previousMessages).map((message) =>
            String(message.id) === String(optimisticUserMessage.id)
              ? { ...message, pending: false }
              : message,
          ),
          [assistantMessage],
        ),
      );

      setActiveSession((previousSession) =>
        previousSession
          ? {
              ...previousSession,
              title: previousSession.title ?? buildSessionTitle(trimmedText),
              updatedAt: assistantMessage.createdAt,
            }
          : previousSession,
      );
    } catch (sendError: any) {
      console.error("Failed to send AI chat message:", sendError);
      setMessages((previousMessages) =>
        removeTypingMessage(previousMessages).map((message) =>
          String(message.id) === String(optimisticUserMessage.id)
            ? {
                ...message,
                pending: false,
                failed: true,
              }
            : message,
        ),
      );
      setError(
        sendError?.response?.data?.message ??
          sendError?.message ??
          t("common.error", { defaultValue: "Something went wrong." }),
      );
    } finally {
      setSending(false);
      setHeaderLoading(false);
    }
  };

  const handleSend = async () => {
    await sendMessage(text, { clearInput: true });
  };

  const handleFollowUpPress = (question: string) => {
    void sendMessage(question, { clearInput: false });
  };

  const isSectionExpanded = (map: Record<string, boolean>, key: string) =>
    map[key] !== false;

  const toggleSection = (
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    key: string,
  ) => {
    setter((current) => {
      const isExpanded = current[key] !== false;
      return { ...current, [key]: !isExpanded };
    });
  };

  const renderFilterOption = (
    label: string,
    options: SystemEnumValue[],
    selectedValue: string | null | undefined,
    onSelect: (value: string | null) => void,
  ) => (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterChips}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            !selectedValue && styles.filterChipSelected,
          ]}
          onPress={() => onSelect(null)}
        >
          <Text
            style={[
              styles.filterChipText,
              !selectedValue && styles.filterChipTextSelected,
            ]}
          >
            {t("common.all", { defaultValue: "All" })}
          </Text>
        </TouchableOpacity>
        {options.map((option) => {
          const optionValue = String(option.name);
          const selected = selectedValue === optionValue;

          return (
            <TouchableOpacity
              key={`${label}-${optionValue}`}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
              onPress={() => onSelect(optionValue)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selected && styles.filterChipTextSelected,
                ]}
              >
                {option.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderSuggestedPlant = (plant: AIChatSuggestedPlant) => {
    const isPlantInstance = plant.entityType === "PlantInstance";
    const priceLabel = formatCurrency(plant.price);

    return (
      <TouchableOpacity
        key={`${plant.entityType}-${plant.entityId}`}
        style={styles.suggestedCard}
        disabled={false}
        onPress={() => {
          // Navigate based on available IDs
          if (isPlantInstance && plant.plantId) {
            navigation.navigate("PlantInstanceDetail", {
              plantId: plant.plantId,
              plantInstanceId: plant.entityId,
            });
            return;
          }

          if (plant.plantId) {
            navigation.navigate("PlantDetail", { plantId: plant.plantId });
            return;
          }

          if (plant.plantComboId) {
            navigation.navigate("ComboDetail", {
              comboId: plant.plantComboId,
            });
            return;
          }

          if (plant.materialId) {
            navigation.navigate("MaterialDetail", {
              materialId: plant.materialId,
            });
            return;
          }
        }}
      >
        {/* Row 1: Thumbnail + Name & Description */}
        <View style={styles.suggestedRow}>
          {plant.imageUrl ? (
            <Image
              source={{
                uri: resolveImageUri(plant.imageUrl) as string | undefined,
              }}
              style={styles.suggestedThumb}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.suggestedThumbPlaceholder} />
          )}

          <View style={styles.suggestedContent}>
            <Text style={styles.suggestedName}>{plant.name}</Text>
            {plant.description ? (
              <Text style={styles.suggestedDescription} numberOfLines={2}>
                {plant.description}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.suggestedDivider} />

        {/* Row 2: Nursery Info & Price */}
        <View style={styles.suggestedFooterRow}>
          {plant.nurseryName || plant.nurseryAddress ? (
            <View style={styles.nurseryInfo}>
              <View style={styles.nurseryNameRow}>
                {plant.nurseryName ? (
                  <Text style={styles.nurseryName} numberOfLines={1}>
                    {plant.nurseryName}
                  </Text>
                ) : null}
                {plant.isPurchasable ? (
                  <View style={styles.badgeCompact}>
                    <Text style={styles.badgeCompactText}>
                      {t("chat.Purchasable", { defaultValue: "Purchasable" })}
                    </Text>
                  </View>
                ) : null}
              </View>
              {plant.nurseryAddress ? (
                <Text style={styles.nurseryAddress} numberOfLines={1}>
                  {plant.nurseryAddress}
                </Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.suggestedFooterSpacer}>
            <Text style={styles.suggestedMeta}>
              {priceLabel ??
                t("chat.priceUnavailable", {
                  defaultValue: "Price unavailable",
                })}
            </Text>
            <Text style={styles.suggestedMetaText}>View details</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: AIChatMessage }) => {
    const mine = item.role === "user";
    const isTyping = !mine && item.pending && item.content.trim().length === 0;
    const suggestedKey = `${item.id}-suggested`;
    const careTipsKey = `${item.id}-caretips`;
    const suggestedExpanded = isSectionExpanded(
      expandedSuggested,
      suggestedKey,
    );
    const careTipsExpanded = isSectionExpanded(expandedCareTips, careTipsKey);
    const sectionTitleStyle = [
      styles.sectionTitle,
      mine ? styles.sectionTitleOnDark : styles.sectionTitleOnLight,
    ];
    const sectionTextStyle = [
      styles.sectionText,
      mine ? styles.sectionTextOnDark : styles.sectionTextOnLight,
    ];

    return (
      <View
        style={[
          styles.messageRow,
          mine ? styles.myMessageRow : styles.otherMessageRow,
        ]}
      >
        {!mine ? (
          <View style={styles.avatarColumn}>
            <View style={[styles.avatarCircle, styles.botAvatarCircle]}>
              <BrandMark variant="logo" size="compactHeader" />
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.bubbleStack,
            mine ? styles.bubbleStackRight : styles.bubbleStackLeft,
          ]}
        >
          {isTyping ? (
            <View
              style={[
                styles.messageBubble,
                styles.otherBubble,
                styles.typingBubble,
              ]}
            >
              <View style={styles.typingDots}>
                {typingDots.map((dot, index) => (
                  <Animated.View
                    key={`typing-dot-${index}`}
                    style={[
                      styles.typingDot,
                      {
                        opacity: dot,
                        transform: [
                          {
                            scale: dot.interpolate({
                              inputRange: [0.3, 1],
                              outputRange: [0.7, 1.25],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : mine ? (
            <View
              style={[
                styles.messageBubble,
                styles.myBubble,
                item.failed && styles.failedBubble,
              ]}
            >
              <Text style={[styles.messageText, styles.myText]}>
                {item.content}
              </Text>
              <View style={styles.messageMetaRow}>
                <Text style={[styles.messageTime, styles.myTime]}>
                  {formatRelativeTime(item.createdAt, locale)}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.messageBubble,
                  styles.otherBubble,
                  item.failed && styles.failedBubble,
                ]}
              >
                <Text style={[styles.messageText, styles.otherText]}>
                  {item.content}
                </Text>
                {item.suggestedPlants && item.suggestedPlants.length > 0 ? (
                  <View style={styles.sectionToggleWrap}>
                    <TouchableOpacity
                      style={styles.sectionToggle}
                      onPress={() =>
                        toggleSection(setExpandedSuggested, suggestedKey)
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.sectionToggleText}>
                        {t("chat.suggestedPlants", {
                          defaultValue: "Suggested plants",
                        })}
                      </Text>
                      <Ionicons
                        name={suggestedExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                    {suggestedExpanded ? (
                      <View style={styles.suggestedList}>
                        {item.suggestedPlants.map((plant) =>
                          renderSuggestedPlant(plant),
                        )}
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {item.disclaimer ? (
                  <Text style={styles.disclaimerText}>{item.disclaimer}</Text>
                ) : null}
                <View style={styles.messageMetaRow}>
                  {item.isFallback ? (
                    <Text
                      style={[styles.messageMetaText, styles.otherMetaText]}
                    >
                      {t("chat.fallback", { defaultValue: "Fallback reply" })}
                    </Text>
                  ) : null}
                  <Text style={[styles.messageTime, styles.otherTime]}>
                    {formatRelativeTime(item.createdAt, locale)}
                  </Text>
                </View>
              </View>

              {item.careTips && item.careTips.length > 0 ? (
                <View style={[styles.sectionBubble, styles.careTipsBubble]}>
                  <TouchableOpacity
                    style={styles.sectionToggle}
                    onPress={() =>
                      toggleSection(setExpandedCareTips, careTipsKey)
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={[sectionTitleStyle, styles.careTipsTitle]}>
                      {t("chat.careTips", { defaultValue: "Care tips" })}
                    </Text>
                    <Ionicons
                      name={careTipsExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                  {careTipsExpanded ? (
                    <View style={styles.sectionList}>
                      {item.careTips.map((tip, index) => (
                        <Text
                          key={`${item.id}-caretip-${index}`}
                          style={[sectionTextStyle, styles.careTipsText]}
                        >
                          - {tip}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {item.followUpQuestions && item.followUpQuestions.length > 0 ? (
                <View style={styles.followUpSection}>
                  <Text style={[sectionTitleStyle, styles.followUpTitle]}>
                    {t("chat.followUpQuestions", {
                      defaultValue: "Follow-up questions",
                    })}
                  </Text>
                  <View style={styles.sectionList}>
                    {item.followUpQuestions.map((question, index) => (
                      <TouchableOpacity
                        key={`${item.id}-question-${index}`}
                        style={[
                          styles.followUpButton,
                          styles.followUpButtonOnLight,
                          sending && styles.followUpButtonDisabled,
                        ]}
                        onPress={() => handleFollowUpPress(question)}
                        disabled={sending}
                        activeOpacity={0.75}
                      >
                        <Text style={[sectionTextStyle, styles.followUpText]}>
                          {question}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>

        {mine ? (
          <View style={styles.avatarColumn}>
            <View style={styles.avatarCircle}>
              {userAvatarUri ? (
                <Image
                  source={{ uri: userAvatarUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarInitial}>{userInitial}</Text>
              )}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.flex1} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {t("profile.aiAssistant", { defaultValue: "AI Assistant" })}
            </Text>
            <Text style={styles.headerSubtitle}>
              {activeSession
                ? `${normalizeStatusLabel(activeSession.status)} | ${formatRelativeTime(
                    activeSession.updatedAt ?? activeSession.startedAt,
                    locale,
                  )}`
                : t("chat.aiSubtitle", {
                    defaultValue: "Plant selection and care guidance",
                  })}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {headerLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : null}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setFiltersVisible(true)}
            >
              <Ionicons
                name="options-outline"
                size={22}
                color={COLORS.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleOpenSessions}
            >
              <Ionicons
                name="time-outline"
                size={22}
                color={COLORS.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={createNewDraftSession}
            >
              <Ionicons
                name="add-outline"
                size={22}
                color={COLORS.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.flex1}>
          {loadingHistory ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : error && messages.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={COLORS.error}
              />
              <Text style={styles.emptyText}>{error}</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRetryHistory}
              >
                <Text style={styles.primaryButtonText}>
                  {t("common.retry", { defaultValue: "Retry" })}
                </Text>
              </TouchableOpacity>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons
                name="sparkles-outline"
                size={64}
                color={COLORS.gray400}
              />
              <Text style={styles.emptyTitle}>
                {t("chat.aiEmptyTitle", {
                  defaultValue: "Ask about plants, rooms, or care.",
                })}
              </Text>
              <Text style={styles.emptyText}>
                {t("chat.aiEmptyPrompt", {
                  defaultValue:
                    "Describe your room, budget, or plant-care needs and the AI assistant will help.",
                })}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              inverted
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {error && messages.length > 0 ? (
            <View style={styles.inlineErrorContainer}>
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}

          <View
            style={[
              styles.inputContainer,
              { paddingBottom: Math.max(insets.bottom, SPACING.md) },
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder={t("chat.placeholder", {
                defaultValue: "Type a message...",
              })}
              placeholderTextColor={COLORS.gray400}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={800}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!text.trim() || sending) && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!text.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="send" size={20} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <Modal
        animationType="slide"
        transparent
        visible={filtersVisible}
        onRequestClose={() => setFiltersVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("chat.filters", { defaultValue: "Chat filters" })}
              </Text>
              <TouchableOpacity onPress={() => setFiltersVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {renderFilterOption(
                t("chat.roomType", { defaultValue: "Room type" }),
                roomTypeOptions,
                filters.preferredRoom,
                (value) =>
                  setFilters((current) => ({
                    ...current,
                    preferredRoom: value,
                  })),
              )}

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>
                  {t("chat.roomDescription", {
                    defaultValue: "Room description",
                  })}
                </Text>
                <TextInput
                  style={styles.filterInput}
                  value={filters.roomDescription ?? ""}
                  onChangeText={(value) =>
                    setFilters((current) => ({
                      ...current,
                      roomDescription: value,
                    }))
                  }
                  placeholder={t("chat.roomDescriptionPlaceholder", {
                    defaultValue: "e.g. bright living room with large windows",
                  })}
                />
              </View>

              {renderFilterOption(
                t("chat.fengShuiElement", {
                  defaultValue: "Feng shui element",
                }),
                fengShuiOptions,
                filters.fengShuiElement,
                (value) =>
                  setFilters((current) => ({
                    ...current,
                    fengShuiElement: value,
                  })),
              )}

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>
                  {t("chat.maxBudget", { defaultValue: "Max budget" })}
                </Text>
                <TextInput
                  style={styles.filterInput}
                  value={filters.maxBudget}
                  onChangeText={(value) =>
                    setFilters((current) => ({ ...current, maxBudget: value }))
                  }
                  keyboardType="numeric"
                  placeholder="500000"
                />
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>
                  {t("chat.resultLimit", { defaultValue: "Result limit" })}
                </Text>
                <TextInput
                  style={styles.filterInput}
                  value={filters.limit}
                  onChangeText={(value) =>
                    setFilters((current) => ({ ...current, limit: value }))
                  }
                  keyboardType="numeric"
                  placeholder="5"
                />
              </View>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    petSafe: !current.petSafe,
                  }))
                }
              >
                <Text style={styles.toggleLabel}>
                  {t("chat.petSafe", { defaultValue: "Pet safe" })}
                </Text>
                <Ionicons
                  name={filters.petSafe ? "checkbox" : "square-outline"}
                  size={22}
                  color={filters.petSafe ? COLORS.primary : COLORS.gray500}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    childSafe: !current.childSafe,
                  }))
                }
              >
                <Text style={styles.toggleLabel}>
                  {t("chat.childSafe", { defaultValue: "Child safe" })}
                </Text>
                <Ionicons
                  name={filters.childSafe ? "checkbox" : "square-outline"}
                  size={22}
                  color={filters.childSafe ? COLORS.primary : COLORS.gray500}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    onlyPurchasable: !current.onlyPurchasable,
                  }))
                }
              >
                <Text style={styles.toggleLabel}>
                  {t("chat.onlyPurchasable", {
                    defaultValue: "Only purchasable",
                  })}
                </Text>
                <Ionicons
                  name={filters.onlyPurchasable ? "checkbox" : "square-outline"}
                  size={22}
                  color={
                    filters.onlyPurchasable ? COLORS.primary : COLORS.gray500
                  }
                />
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setFilters(DEFAULT_FILTERS)}
              >
                <Text style={styles.secondaryButtonText}>
                  {t("common.reset", { defaultValue: "Reset" })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setFiltersVisible(false)}
              >
                <Text style={styles.primaryButtonText}>
                  {t("common.apply", { defaultValue: "Apply" })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING["3xl"],
  },
  emptyTitle: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.xl,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  emptyText: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: SPACING.md,
    alignItems: "flex-end",
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  otherMessageRow: {
    justifyContent: "flex-start",
  },
  avatarColumn: {
    width: 36,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  botAvatarCircle: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarInitial: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  bubbleStack: {
    maxWidth: "74%",
    flexShrink: 1,
    gap: SPACING.sm,
  },
  bubbleStackLeft: {
    marginLeft: SPACING.xs,
    alignItems: "flex-start",
  },
  bubbleStackRight: {
    marginRight: SPACING.xs,
    alignItems: "flex-end",
    maxWidth: "66%",
  },
  messageBubble: {
    width: "100%",
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
  },
  typingBubble: {
    paddingVertical: SPACING.sm,
  },
  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.xs,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gray400,
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: RADIUS.sm,
  },
  otherBubble: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: RADIUS.sm,
    ...SHADOWS.sm,
  },
  failedBubble: {
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  messageText: {
    fontSize: FONTS.sizes.md,
    lineHeight: FONTS.sizes.md * FONTS.lineHeights.normal,
  },
  myText: {
    color: COLORS.white,
  },
  otherText: {
    color: COLORS.textPrimary,
  },
  messageMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  messageMetaText: {
    fontSize: FONTS.sizes.xs,
  },
  myMetaText: {
    color: "rgba(255,255,255,0.78)",
  },
  otherMetaText: {
    color: COLORS.warning,
  },
  messageTime: {
    fontSize: FONTS.sizes.xs,
  },
  myTime: {
    color: "rgba(255,255,255,0.78)",
  },
  otherTime: {
    color: COLORS.textLight,
  },
  suggestedList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  sectionToggleWrap: {
    marginTop: SPACING.sm,
  },
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  sectionToggleText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  suggestedCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.gray50,
  },
  suggestedRow: {
    flexDirection: "row",
    gap: SPACING.md,
    alignItems: "flex-start",
  },
  suggestedDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  suggestedThumb: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
  },
  suggestedThumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.border,
  },
  suggestedContent: {
    flex: 1,
  },
  suggestedName: {
    fontSize: FONTS.sizes.md,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  suggestedDescription: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.sm * FONTS.lineHeights.normal,
  },
  suggestedFooterRow: {
    flexDirection: "column",
    gap: SPACING.xs,
  },
  nurseryInfo: {
    marginBottom: SPACING.xs,
  },
  nurseryNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  nurseryName: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  nurseryAddress: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  suggestedFooterSpacer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  suggestedMeta: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryDark,
    fontWeight: "600",
  },
  suggestedMetaText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: "700",
    marginRight: SPACING.sm,
  },
  badgeCompact: {
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  badgeCompactText: {
    color: COLORS.primaryDark,
    fontSize: FONTS.sizes.xs,
    fontWeight: "700",
  },
  badge: {
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    color: COLORS.primaryDark,
    fontSize: FONTS.sizes.xs,
    fontWeight: "700",
  },
  suggestedLink: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: "700",
  },
  sectionBubble: {
    width: "100%",
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  careTipsBubble: {
    backgroundColor: COLORS.secondaryLight,
    borderColor: COLORS.secondary,
  },
  followUpSection: {
    width: "100%",
  },
  sectionList: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  followUpButton: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
  },
  followUpButtonOnDark: {
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  followUpButtonOnLight: {
    borderColor: COLORS.info,
    backgroundColor: "transparent",
  },
  followUpButtonDisabled: {
    opacity: 0.6,
  },
  careTipsTitle: {
    color: COLORS.primary,
  },
  careTipsText: {
    color: COLORS.primaryDark,
  },
  followUpTitle: {
    color: COLORS.info,
  },
  followUpText: {
    color: COLORS.info,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "700",
  },
  sectionTitleOnDark: {
    color: "rgba(255,255,255,0.9)",
  },
  sectionTitleOnLight: {
    color: COLORS.textPrimary,
  },
  sectionText: {
    fontSize: FONTS.sizes.sm,
  },
  sectionTextOnDark: {
    color: "rgba(255,255,255,0.82)",
  },
  sectionTextOnLight: {
    color: COLORS.textSecondary,
  },
  disclaimerText: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.warning,
    fontStyle: "italic",
  },
  inlineErrorContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: "#FDECEC",
    borderRadius: RADIUS.lg,
  },
  inlineErrorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 44,
    maxHeight: 120,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: SPACING.md,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.gray400,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "88%",
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  filterSection: {
    marginBottom: SPACING.lg,
  },
  filterLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  filterChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  filterChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
  },
  filterChipTextSelected: {
    color: COLORS.white,
    fontWeight: "700",
  },
  filterInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  toggleLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  modalFooter: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  primaryButton: {
    flex: 1,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: "700",
  },
});
