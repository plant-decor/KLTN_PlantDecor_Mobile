import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { aiChatService } from '../../services';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { AIChatSessionSummary, RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AIChatSessions'>;
type RouteProps = RouteProp<RootStackParamList, 'AIChatSessions'>;

const formatSessionDate = (value?: string | null) => {
  if (!value) {
    return '';
  }

  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return value;
  }
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
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<AIChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const renderItem = ({ item }: { item: AIChatSessionSummary }) => {
    const selected = item.sessionId === route.params?.selectedSessionId;

    return (
      <TouchableOpacity
        style={[styles.sessionCard, selected && styles.sessionCardSelected]}
        onPress={() => handleSelectSession(item.sessionId)}
      >
        <View style={styles.sessionHeader}>
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
        <Text style={styles.sessionMeta}>
          {t('chat.updatedAt', { defaultValue: 'Updated' })}:{' '}
          {formatSessionDate(item.updatedAt ?? item.startedAt)}
        </Text>
        {item.endedAt ? (
          <Text style={styles.sessionMeta}>
            {t('chat.endedAt', { defaultValue: 'Ended' })}: {formatSessionDate(item.endedAt)}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  sessionTitle: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
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
});
