import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../constants';
import { supportRealtimeService, supportService } from '../../services';
import {
  SupportConversation,
  SupportConversationRealtimeUpdate,
  SupportMessage,
  RootStackParamList,
  SupportRealtimeConnectionState,
} from '../../types';
import { useAuthStore } from '../../stores';
import { format } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const sortMessagesNewestFirst = (items: SupportMessage[]) =>
  [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

const upsertMessages = (
  current: SupportMessage[],
  incoming: SupportMessage[]
) => {
  const map = new Map<number, SupportMessage>();

  current.forEach((message) => {
    map.set(message.id, message);
  });

  incoming.forEach((message) => {
    map.set(message.id, {
      ...(map.get(message.id) ?? {}),
      ...message,
    });
  });

  return sortMessagesNewestFirst(Array.from(map.values()));
};

export default function SupportChatScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top : 0;

  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [realtimeState, setRealtimeState] =
    useState<SupportRealtimeConnectionState>('disconnected');

  const flatListRef = useRef<FlatList>(null);
  const activeConversationIdRef = useRef<number | null>(null);
  const realtimeStateRef = useRef<SupportRealtimeConnectionState>('disconnected');

  useEffect(() => {
    const unsubscribeMessage = supportRealtimeService.onMessage((message) => {
      if (message.chatSessionId !== activeConversationIdRef.current) {
        return;
      }

      setMessages((prev) => upsertMessages(prev, [message]));
      setConversation((prev) => {
        if (!prev || prev.id !== message.chatSessionId) {
          return prev;
        }

        return {
          ...prev,
          latestMessage: message,
        };
      });
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });

    const unsubscribeConversation = supportRealtimeService.onConversationUpdated(
      (update) => {
        if (update.conversationId !== activeConversationIdRef.current) {
          return;
        }

        applyConversationUpdate(update);
      }
    );

    const unsubscribeConnection = supportRealtimeService.onConnectionStateChange(
      (state) => {
        realtimeStateRef.current = state;
        setRealtimeState(state);
      }
    );

    fetchLatestConversation();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (
        nextState === 'active' &&
        activeConversationIdRef.current !== null &&
        realtimeStateRef.current !== 'connected'
      ) {
        supportRealtimeService
          .joinConversation(activeConversationIdRef.current)
          .catch((error) =>
            console.error('Failed to reconnect support chat:', error)
          );
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeConversation();
      unsubscribeConnection();
      appStateSubscription.remove();

      const activeConversationId = activeConversationIdRef.current;
      activeConversationIdRef.current = null;

      if (activeConversationId !== null) {
        supportRealtimeService
          .leaveConversation(activeConversationId)
          .catch((error) =>
            console.error('Failed to leave support conversation:', error)
          )
          .finally(() => {
            supportRealtimeService.disconnect().catch((error) =>
              console.error('Failed to disconnect support realtime:', error)
            );
          });
      } else {
        supportRealtimeService.disconnect().catch((error) =>
          console.error('Failed to disconnect support realtime:', error)
        );
      }
    };
  }, []);

  useEffect(() => {
    const nextConversationId = conversation?.id ?? null;
    const previousConversationId = activeConversationIdRef.current;

    if (previousConversationId === nextConversationId) {
      return;
    }

    activeConversationIdRef.current = nextConversationId;

    if (previousConversationId !== null) {
      supportRealtimeService.leaveConversation(previousConversationId).catch((error) => {
        console.error('Failed to leave previous support conversation:', error);
      });
    }

    if (nextConversationId !== null) {
      supportRealtimeService.joinConversation(nextConversationId).catch((error) => {
        console.error('Failed to join support conversation:', error);
      });
    }
  }, [conversation?.id]);

  useEffect(() => {
    if (realtimeState === 'connected' && activeConversationIdRef.current !== null) {
      fetchMessages(activeConversationIdRef.current, true);
    }
  }, [realtimeState]);

  const fetchLatestConversation = async () => {
    try {
      setLoading(true);
      const res = await supportService.getLatestActive();
      if (res.success && res.payload) {
        // Load full conversation detail (includes paginated messages)
        const detail = await supportService.getConversationDetail(res.payload.id, 1, 50);
        if (detail.success && detail.payload) {
          setConversation(detail.payload);
          const msgs = Array.isArray(detail.payload.messages)
            ? detail.payload.messages
            : [];
          setMessages(sortMessagesNewestFirst(msgs));
        } else {
          setConversation(res.payload);
          await fetchMessages(res.payload.id);
        }
      } else {
        setConversation(null);
        setMessages([]);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to fetch conversation:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: number, silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const res = await supportService.getConversationDetail(conversationId, 1, 50);
      if (res.success && res.payload) {
        const payload = res.payload;
        setConversation((prev) =>
          prev
            ? {
                ...prev,
                ...payload,
              }
            : payload
        );
        const msgs = Array.isArray(payload.messages) ? payload.messages : [];
        setMessages((prev) => upsertMessages(prev, msgs));
      }
    } catch (error) {
      console.error('Failed to fetch conversation detail:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const applyConversationUpdate = (update: SupportConversationRealtimeUpdate) => {
    setConversation((prev) => {
      if (!prev || prev.id !== update.conversationId) {
        return prev;
      }

      if (update.conversation) {
        return {
          ...prev,
          ...update.conversation,
        };
      }

      return {
        ...prev,
        ...(update.status !== undefined ? { status: update.status } : {}),
        ...(update.endedAt !== undefined ? { endedAt: update.endedAt } : {}),
        ...(update.latestMessage !== undefined
          ? { latestMessage: update.latestMessage }
          : {}),
      };
    });

    if (update.latestMessage) {
      setMessages((prev) => upsertMessages(prev, [update.latestMessage!]));
    }
  };

  const handleStartChat = async () => {
    if (!text.trim()) return;

    try {
      setSending(true);
      const res = await supportService.startConversation(text.trim());
      if (res.success && res.payload) {
        setConversation(res.payload);
        setText('');
        setMessages([]);
        await fetchMessages(res.payload.id);
      } else {
        Alert.alert(t('common.error'), res.message || 'Failed to start chat');
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || 'Failed to start chat');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;

    if (!conversation) {
      // If there's no conversation, starting chat will send the first message
      return handleStartChat();
    }

    try {
      Keyboard.dismiss();
      setSending(true);
      await supportRealtimeService.sendMessage(conversation.id, text.trim());
      setText('');
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const isMyMessage = (msg: SupportMessage) => {
    // If backend sets isFromConsultant, we can use it.
    // But since this is the customer app, we can also check senderId.
    if (msg.isFromConsultant !== undefined) {
      return !msg.isFromConsultant;
    }
    return String(msg.senderId) === String(user?.id);
  };

  const renderItem = ({ item }: { item: SupportMessage }) => {
    const mine = isMyMessage(item);

    return (
      <View style={[styles.messageRow, mine ? styles.myMessageRow : styles.otherMessageRow]}>
        <View style={[styles.messageBubble, mine ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, mine ? styles.myText : styles.otherText]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, mine ? styles.myTime : styles.otherTime]}>
            {item.createdAt ? format(new Date(item.createdAt), 'HH:mm') : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <SafeAreaView style={styles.flex1} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('profile.supportChat', { defaultValue: 'Support Chat' })}
          </Text>
          <View style={styles.headerRight}>
            {realtimeState === 'connecting' || realtimeState === 'reconnecting' ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : null}
          </View>
        </View>

        <View style={styles.flex1}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <>
              {!conversation ? (
                <View style={styles.centerContainer}>
                  <Ionicons name="chatbubbles-outline" size={64} color={COLORS.gray400} />
                  <Text style={styles.noChatText}>
                    {t('chat.noActivePrompt', { defaultValue: 'Send a message to start a conversation with our support team.' })}
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
              {/* Input */}
              <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
                <TextInput
                  style={styles.input}
                  placeholder={t('chat.placeholder', { defaultValue: 'Type a message...' })}
                  placeholderTextColor={COLORS.gray400}
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
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
            </>
          )}
        </View>
      </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
    zIndex: 10,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING['3xl'],
  },
  noChatText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
  },
  startBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
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
  messageTime: {
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.xs,
    alignSelf: 'flex-end',
  },
  myTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTime: {
    color: COLORS.textLight,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.md,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.gray400,
  },
});
