import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BrandedHeader } from '../../components/branding';
import { API, COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../constants';
import { designService } from '../../services';
import { DesignTask, RootStackParamList } from '../../types';
import {
  formatVietnamDateTime,
  getDesignTaskStatusPalette,
  resolveImageUri,
} from '../../utils';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DesignTaskDetail'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'DesignTaskDetail'>;

const resolveBackendImageUri = (rawValue: string | null | undefined): string | null => {
  const resolved = resolveImageUri(rawValue);
  if (!resolved) {
    return null;
  }

  if (/^https?:\/\//i.test(resolved)) {
    return resolved;
  }

  const host = API.BASE_URL.replace(/\/api\/?$/i, '');
  const normalizedPath = resolved.startsWith('/') ? resolved : `/${resolved}`;
  return `${host}${normalizedPath}`;
};

export default function DesignTaskDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
  const taskId = route.params.taskId;

  const [task, setTask] = useState<DesignTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const payload = await designService.getDesignTaskDetail(taskId);
      setTask(payload);
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      setErrorMessage(
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('designService.taskDetailLoadFailed', {
              defaultValue: 'Unable to load design task detail. Please try again.',
            })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t, taskId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const palette = useMemo(
    () => getDesignTaskStatusPalette(task?.statusName ?? ''),
    [task?.statusName]
  );

  const reportImageUri = resolveBackendImageUri(task?.reportImageUrl);

  const header = (
    <BrandedHeader
      brandVariant="none"
      containerStyle={styles.header}
      sideWidth={88}
      title={t('designService.taskDetailHeader', { defaultValue: 'Task detail' })}
      left={
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      }
    />
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || !task) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {errorMessage ??
              t('designService.taskDetailNotFound', { defaultValue: 'Design task not found.' })}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void loadDetail()}>
            <Text style={styles.primaryButtonText}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
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
              <Text style={[styles.statusBadgeText, { color: palette.textColor }]}>
                {task.statusName || '--'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationCodeLabel', { defaultValue: 'Registration ID' })}
            </Text>
            <Text style={styles.infoValue}>#{task.designRegistrationId}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationStatusLabel', { defaultValue: 'Registration status' })}
            </Text>
            <Text style={styles.infoValue}>{task.registration?.statusName ?? '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.assignedStaffLabel', { defaultValue: 'Assigned staff' })}
            </Text>
            <Text style={styles.infoValue}>{task.assignedStaff?.fullName ?? '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationCreatedAtLabel', { defaultValue: 'Created at' })}
            </Text>
            <Text style={styles.infoValue}>
              {formatVietnamDateTime(task.createdAt, locale, { empty: '-' })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.scheduledDateLabel', { defaultValue: 'Scheduled date' })}
            </Text>
            <Text style={styles.infoValue}>{task.scheduledDate ?? '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationAddressLabel', { defaultValue: 'Address' })}
            </Text>
            <Text style={styles.infoValue}>{task.registration?.address ?? '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationPhoneLabel', { defaultValue: 'Phone' })}
            </Text>
            <Text style={styles.infoValue}>{task.registration?.phone ?? '-'}</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              navigation.navigate('DesignRegistrationDetail', {
                registrationId: task.designRegistrationId,
              })
            }
          >
            <Text style={styles.primaryButtonText}>
              {t('designService.openRegistrationDetailAction', {
                defaultValue: 'Open registration detail',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('designService.materialUsageTitle', { defaultValue: 'Material usage' })}
          </Text>
          {task.taskMaterialUsages?.length ? (
            task.taskMaterialUsages.map((item) => (
              <View key={item.id} style={styles.materialRow}>
                <Text style={styles.materialText}>
                  {item.materialName} x{item.actualQuantity}
                </Text>
                <Text style={styles.materialNote}>{item.note?.trim() || '-'}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              {t('designService.materialUsageEmpty', {
                defaultValue: 'No material usage has been reported for this task.',
              })}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('designService.reportImageLabel', { defaultValue: 'Report image' })}
          </Text>
          {reportImageUri ? (
            <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImageUri(reportImageUri)}>
              <Image source={{ uri: reportImageUri }} style={styles.reportImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : (
            <Text style={styles.emptyText}>
              {t('designService.reportImageEmpty', {
                defaultValue: 'No report image has been uploaded yet.',
              })}
            </Text>
          )}
        </View>
      </ScrollView>

      {previewImageUri ? (
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

            <Image source={{ uri: previewImageUri }} style={styles.fullImagePreview} resizeMode="contain" />
          </View>
        </Modal>
      ) : null}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING['4xl'],
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  infoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  materialRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  materialText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  materialNote: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  emptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
  },
  reportImage: {
    width: '100%',
    height: 240,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
  },
  fullImageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImagePreview: {
    width: '90%',
    height: '70%',
  },
});
