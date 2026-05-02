import React, { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { aiChatService } from '../../services';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { AIChatSessionSummary, RootStackParamList } from '../../types';
import { formatVietnamDateTime } from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AIChatSessions'>;
type RouteProps = RouteProp<RootStackParamList, 'AIChatSessions'>;

const formatSessionDate = (value: string | null | undefined, locale: string) => {
  if (!value) {
    return '';
  }

  const formatted = formatVietnamDateTime(value, locale, { empty: '', hour12: false });
  return formatted || value;
};

const statusLabel = (status: AIChatSessionSummary['status']) => {
  if (status === 1 || String(status).toLowerCase() === 'active') {
    return 'Active';
  }

  if (status === 2 || String(status).toLowerCase() === 'closed') {
    return 'Closed';
  }

  return String(status);
};

export default function AIChatSessionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US';
  const [sessions, setSessions] = useState<AIChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<number | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  const loadSessions = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const response = await aiChatService.getSessions({ pageNumber: 1, pageSize: 20 });
      setSessions(response.payload.items);
    } catch (loadError: any) {
      console.error('Failed to load AI chat sessions:', loadError);
      setError(
        loadError?.response?.data?.message ??
          loadError?.message ??
          t('common.error', { defaultValue: 'Something went wrong.' })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const handleSelectSession = (sessionId: number) => {
    navigation.popTo('AIChat', { sessionId, createNew: false });
  };

  const handleNewChat = () => {
    navigation.popTo('AIChat', { createNew: true });
  };

  const openRenameModal = (session: AIChatSessionSummary) => {
    setRenameSessionId(session.sessionId);
    setRenameTitle(
      session.title?.trim().length
        ? session.title
        : t('chat.untitledSession', { defaultValue: 'Untitled chat' })
    );
    setRenameModalVisible(true);
  };

  const handleRenameSession = async () => {
    if (!renameSessionId) {
      return;
    }

    const nextTitle = renameTitle.trim();
    if (!nextTitle.length) {
      return;
    }

    try {
      setRenameSaving(true);
      const response = await aiChatService.renameSession(renameSessionId, { title: nextTitle });
      setSessions((currentSessions) =>
        currentSessions.map((session) =>
          session.sessionId === renameSessionId ? response.payload : session
        )
      );
      setRenameModalVisible(false);
      setRenameSessionId(null);
      setRenameTitle('');
    } catch (renameError: any) {
      console.error('Failed to rename AI chat session:', renameError);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        renameError?.response?.data?.message ??
          renameError?.message ??
          t('common.error', { defaultValue: 'Something went wrong.' })
      );
    } finally {
      setRenameSaving(false);
    }
  };

  const handleCloseSession = (session: AIChatSessionSummary) => {
    Alert.alert(
      t('chat.closeSession', { defaultValue: 'Close session' }),
      t('chat.closeSessionConfirm', {
        defaultValue: 'Are you sure you want to close this session?',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('chat.closeSession', { defaultValue: 'Close session' }),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await aiChatService.closeSession(session.sessionId);
                setSessions((currentSessions) =>
                  currentSessions.map((item) =>
                    item.sessionId === session.sessionId
                      ? {
                          ...item,
                          status: 2,
                          endedAt: item.endedAt ?? new Date().toISOString(),
                        }
                      : item
                  )
                );
              } catch (closeError: any) {
                console.error('Failed to close AI chat session:', closeError);
                Alert.alert(
                  t('common.error', { defaultValue: 'Error' }),
                  closeError?.response?.data?.message ??
                    closeError?.message ??
                    t('common.error', { defaultValue: 'Something went wrong.' })
                );
              }
            })();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AIChatSessionSummary }) => {
    const selected = item.sessionId === route.params?.selectedSessionId;
    const isClosed = item.status === 2 || String(item.status).toLowerCase() === 'closed';

    return (
      <TouchableOpacity
        style={[styles.sessionCard, selected && styles.sessionCardSelected]}
        onPress={() => handleSelectSession(item.sessionId)}
      >
        <View style={styles.sessionHeader}>
          <View style={styles.sessionHeaderLeft}>
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {item.title?.trim().length
                ? item.title
                : t('chat.untitledSession', { defaultValue: 'Untitled chat' })}
            </Text>
            <View style={[styles.badge, selected && styles.badgeSelected]}>
              <Text style={[styles.badgeText, selected && styles.badgeTextSelected]}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </View>
          {!isClosed ? (
            <View style={styles.sessionActions}>
              <TouchableOpacity
                style={styles.sessionActionButton}
                onPress={() => openRenameModal(item)}
              >
                <Ionicons name="pencil-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sessionActionButton, styles.sessionActionButtonDanger]}
                onPress={() => handleCloseSession(item)}
              >
                <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        <Text style={styles.sessionMeta}>
          {t('chat.updatedAt', { defaultValue: 'Updated' })}:{' '}
          {formatSessionDate(item.updatedAt ?? item.startedAt, locale)}
        </Text>
        {item.endedAt ? (
          <Text style={styles.sessionMeta}>
            {t('chat.endedAt', { defaultValue: 'Ended' })}: {formatSessionDate(item.endedAt, locale)}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('chat.sessionsTitle', { defaultValue: 'AI chat sessions' })}
        </Text>
        <TouchableOpacity style={styles.iconButton} onPress={handleNewChat}>
          <Ionicons name="add-outline" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && sessions.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void loadSessions()}>
            <Text style={styles.primaryButtonText}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.sessionId)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadSessions(true);
              }}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            <TouchableOpacity style={styles.newChatCard} onPress={handleNewChat}>
              <Ionicons name="sparkles-outline" size={22} color={COLORS.primary} />
              <Text style={styles.newChatText}>
                {t('chat.newChat', { defaultValue: 'Start a new chat' })}
              </Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="time-outline" size={48} color={COLORS.gray400} />
              <Text style={styles.emptyText}>
                {t('chat.noSessions', { defaultValue: 'No AI chat sessions yet.' })}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => {
        setRenameModalVisible(false);
        setRenameSessionId(null);
        setRenameTitle('');
      }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {t('chat.renameSession', { defaultValue: 'Rename session' })}
            </Text>
            <Text style={styles.modalSubtitle}>
              {t('chat.renameSessionHint', {
                defaultValue: 'Enter a new title for this chat session.',
              })}
            </Text>
            <TextInput
              value={renameTitle}
              onChangeText={setRenameTitle}
              placeholder={t('chat.sessionTitle', { defaultValue: 'Session title' })}
              placeholderTextColor={COLORS.textSecondary}
              style={styles.modalInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleRenameSession();
              }}
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setRenameModalVisible(false);
                  setRenameSessionId(null);
                  setRenameTitle('');
                }}
                disabled={renameSaving}
              >
                <Text style={styles.modalButtonSecondaryText}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  void handleRenameSession();
                }}
                disabled={renameSaving || !renameTitle.trim().length}
              >
                <Text style={styles.modalButtonPrimaryText}>
                  {renameSaving
                    ? t('common.loading', { defaultValue: 'Saving...' })
                    : t('common.save', { defaultValue: 'Save' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  listContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING['3xl'],
  },
  newChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  newChatText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sessionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  sessionCardSelected: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  sessionHeaderLeft: {
    flex: 1,
    gap: SPACING.xs,
  },
  sessionTitle: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sessionActionButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray50,
  },
  sessionActionButtonDanger: {
    backgroundColor: COLORS.gray100,
  },
  badge: {
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeSelected: {
    backgroundColor: COLORS.secondaryLight,
  },
  badgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  badgeTextSelected: {
    color: COLORS.primaryDark,
  },
  sessionMeta: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.error,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  modalInput: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.gray50,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  modalButton: {
    minWidth: 96,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: COLORS.gray100,
  },
  modalButtonSecondaryText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  modalButtonPrimaryText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
});
