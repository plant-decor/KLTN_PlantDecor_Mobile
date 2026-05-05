import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { designService, orderService, paymentService } from '../../services';
import { DesignRegistration, DesignTask, RootStackParamList } from '../../types';
import {
  canContinueOrderPayment,
  formatVietnamDateTime,
  getDesignRegistrationStatusPalette,
  getDesignRoomTypeLabel,
  getDesignStyleLabel,
  getDesignTaskStatusPalette,
  isDesignRegistrationAwaitPaymentStatus,
  isDesignRegistrationCancellableStatus,
  notify,
  resolveImageUri,
  sortDesignTasks,
} from '../../utils';

type RouteProps = RouteProp<RootStackParamList, 'DesignRegistrationDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DesignRegistrationDetail'>;

const formatCurrency = (amount: number): string => `${(amount || 0).toLocaleString('vi-VN')} VND`;

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

export default function DesignRegistrationDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';

  const [registration, setRegistration] = useState<DesignRegistration | null>(null);
  const [tasks, setTasks] = useState<DesignTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const registrationId = route.params.registrationId;

  const loadDetail = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [registrationPayload, tasksPayload] = await Promise.all([
        designService.getDesignRegistrationDetail(registrationId),
        designService.getDesignTasksByRegistration(registrationId),
      ]);
      setRegistration(registrationPayload);
      setTasks(sortDesignTasks(tasksPayload ?? registrationPayload.designTasks ?? []));
      setCancelReason(registrationPayload.cancelReason ?? '');
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      setErrorMessage(
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('designService.registrationDetailLoadFailed', {
              defaultValue: 'Unable to load design registration detail. Please try again.',
            })
      );
    } finally {
      setIsLoading(false);
    }
  }, [registrationId, t]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const registrationPalette = useMemo(
    () => getDesignRegistrationStatusPalette(registration?.statusName ?? ''),
    [registration?.statusName]
  );

  const canCancel = useMemo(
    () => Boolean(registration && isDesignRegistrationCancellableStatus(registration.statusName ?? '')),
    [registration]
  );

  const canPay = useMemo(
    () => Boolean(registration && isDesignRegistrationAwaitPaymentStatus(registration.statusName ?? '')),
    [registration]
  );

  const hasRunningAction = isCancelling || isPaying;

  const handleContinuePayment = useCallback(async () => {
    if (!registration || hasRunningAction) {
      return;
    }

    if (typeof registration.orderId !== 'number' || registration.orderId <= 0) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('designService.paymentUnavailable', {
          defaultValue: 'Unable to continue payment because the order is not ready.',
        })
      );
      return;
    }

    try {
      setIsPaying(true);
      const orderPayload = await orderService.getOrderDetail(registration.orderId);
      const continuableInvoice = orderPayload.invoices.find((invoice) =>
        canContinueOrderPayment(orderPayload.statusName, invoice.statusName)
      );

      if (!continuableInvoice) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('designService.paymentInvoiceUnavailable', {
            defaultValue: 'No payable invoice was found for this design registration.',
          })
        );
        return;
      }

      const payment = await paymentService.continuePayment(continuableInvoice.id);
      if (!payment?.paymentUrl) {
        throw new Error('Missing payment URL');
      }

      navigation.navigate('PaymentWebView', {
        paymentUrl: payment.paymentUrl,
        orderId: orderPayload.id,
      });
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('designService.continuePaymentFailed', {
              defaultValue: 'Unable to continue payment. Please try again.',
            })
      );
    } finally {
      setIsPaying(false);
    }
  }, [hasRunningAction, navigation, registration, t]);

  const handleConfirmCancelRegistration = useCallback(async () => {
    if (!registration || hasRunningAction) {
      return;
    }

    try {
      setIsCancelling(true);
      const payload = await designService.cancelDesignRegistration(registration.id, cancelReason);
      setRegistration(payload);
      setTasks(sortDesignTasks(payload.designTasks ?? tasks));
      notify({
        title: t('common.success', { defaultValue: 'Success' }),
        message: t('designService.cancelRegistrationSuccess', {
          defaultValue: 'Design registration cancelled successfully.',
        }),
      });
    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        typeof apiMessage === 'string' && apiMessage.trim().length > 0
          ? apiMessage
          : t('designService.cancelRegistrationFailed', {
              defaultValue: 'Unable to cancel design registration. Please try again.',
            })
      );
    } finally {
      setIsCancelling(false);
    }
  }, [cancelReason, hasRunningAction, registration, t, tasks]);

  const handleCancelRegistration = useCallback(() => {
    if (!registration || !canCancel || hasRunningAction) {
      return;
    }

    Alert.alert(
      t('designService.cancelRegistrationTitle', {
        defaultValue: 'Cancel design registration?',
      }),
      t('designService.cancelRegistrationMessage', {
        defaultValue: 'Are you sure you want to cancel this design registration?',
      }),
      [
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: t('designService.cancelRegistrationAction', {
            defaultValue: 'Cancel registration',
          }),
          style: 'destructive',
          onPress: () => {
            void handleConfirmCancelRegistration();
          },
        },
      ]
    );
  }, [canCancel, handleConfirmCancelRegistration, hasRunningAction, registration, t]);

  const header = (
    <BrandedHeader
      brandVariant="none"
      containerStyle={styles.header}
      sideWidth={88}
      title={t('designService.registrationDetailHeader', {
        defaultValue: 'Registration detail',
      })}
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

  if (errorMessage || !registration) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {errorMessage ??
              t('designService.registrationDetailNotFound', {
                defaultValue: 'Design registration not found.',
              })}
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

  const templateImageUri = resolveBackendImageUri(registration.designTemplateTier?.designTemplate?.imageUrl);
  const surveyImageUri = resolveBackendImageUri(registration.currentStateImageUrl);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.codeText}>#{registration.id}</Text>
            <View style={[styles.registrationStatusBadge, { backgroundColor: registrationPalette.backgroundColor }]}>
              <Text style={[styles.statusText, { color: registrationPalette.textColor }]}>
                {registration.statusName}
              </Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>
            {registration.designTemplateTier?.designTemplate?.name ??
              t('designService.fallbackTemplateName', { defaultValue: 'Design template' })}
          </Text>

          {templateImageUri ? (
            <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImageUri(templateImageUri)}>
              <Image source={{ uri: templateImageUri }} style={styles.heroImage} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationCreatedAtLabel', { defaultValue: 'Created at' })}
            </Text>
            <Text style={styles.infoValue}>
              {formatVietnamDateTime(registration.createdAt, locale, { empty: '-' })}
            </Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationApprovedAtLabel', { defaultValue: 'Approved at' })}
            </Text>
            <Text style={styles.infoValue}>
              {formatVietnamDateTime(registration.approvedAt, locale, { empty: '-' })}
            </Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationTierLabel', { defaultValue: 'Tier' })}
            </Text>
            <Text style={styles.infoValueRight}>
              {registration.designTemplateTier?.tierName ?? '-'}
            </Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.styleLabel', { defaultValue: 'Style' })}
            </Text>
            <Text style={styles.infoValueRight}>
              {getDesignStyleLabel(registration.designTemplateTier?.designTemplate?.style ?? 0)}
            </Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.roomTypesLabel', { defaultValue: 'Room types' })}
            </Text>
            <Text style={styles.infoValueRight}>
              {(registration.designTemplateTier?.designTemplate?.roomTypes ?? [])
                .map((value) => getDesignRoomTypeLabel(value))
                .join(', ') || '-'}
            </Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.scopeLabel', { defaultValue: 'Scope' })}
            </Text>
            <Text style={styles.infoValueRight}>
              {registration.designTemplateTier?.scopedOfWork ?? '-'}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationTotalLabel', { defaultValue: 'Total' })}
            </Text>
            <Text style={styles.infoValueRight}>{formatCurrency(registration.totalPrice)}</Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationDepositLabel', { defaultValue: 'Deposit' })}
            </Text>
            <Text style={styles.infoValueRight}>{formatCurrency(registration.depositAmount)}</Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationNurseryLabel', { defaultValue: 'Nursery' })}
            </Text>
            <Text style={styles.infoValueRight}>{registration.nursery?.name ?? '-'}</Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationAddressLabel', { defaultValue: 'Address' })}
            </Text>
            <Text style={styles.infoValueRight}>{registration.address || '-'}</Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.registrationPhoneLabel', { defaultValue: 'Phone' })}
            </Text>
            <Text style={styles.infoValue}>{registration.phone || '-'}</Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.noteInputLabel', { defaultValue: 'Customer note' })}
            </Text>
            <Text style={styles.infoValueRight}>{registration.customerNote?.trim() || '-'}</Text>
          </View>
          {registration.cancelReason ? (
            <View style={styles.registrationInfoRow}>
              <Text style={styles.infoLabel}>
                {t('designService.cancelReasonLabel', { defaultValue: 'Cancel reason (optional)' })}
              </Text>
              <Text style={styles.infoValueRight}>{registration.cancelReason}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('designService.surveyInformationTitle', { defaultValue: 'Survey information' })}
          </Text>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.widthLabel', { defaultValue: 'Width' })}
            </Text>
            <Text style={styles.infoValue}>{registration.width ?? '-'}</Text>
          </View>
          <View style={styles.registrationInfoRow}>
            <Text style={styles.infoLabel}>
              {t('designService.lengthLabel', { defaultValue: 'Length' })}
            </Text>
            <Text style={styles.infoValue}>{registration.length ?? '-'}</Text>
          </View>
          {surveyImageUri ? (
            <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImageUri(surveyImageUri)}>
              <Image source={{ uri: surveyImageUri }} style={styles.surveyImage} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.emptyProgressText}>
              {t('designService.surveyImageEmpty', {
                defaultValue: 'No survey image has been uploaded yet.',
              })}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('designService.assignedCaretakerTitle', { defaultValue: 'Assigned caretaker' })}
          </Text>
          {registration.assignedCaretaker ? (
            <>
              <View style={styles.registrationInfoRow}>
                <Text style={styles.infoLabel}>
                  {t('careService.caretakerNameLabel', { defaultValue: 'Name' })}
                </Text>
                <Text style={styles.infoValueRight}>{registration.assignedCaretaker.fullName}</Text>
              </View>
              <View style={styles.registrationInfoRow}>
                <Text style={styles.infoLabel}>
                  {t('careService.caretakerPhoneLabel', { defaultValue: 'Phone' })}
                </Text>
                <Text style={styles.infoValueRight}>{registration.assignedCaretaker.phone || '-'}</Text>
              </View>
              <View style={styles.registrationInfoRow}>
                <Text style={styles.infoLabel}>
                  {t('careService.caretakerEmailLabel', { defaultValue: 'Email' })}
                </Text>
                <Text style={styles.infoValueRight}>{registration.assignedCaretaker.email || '-'}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyProgressText}>
              {t('designService.assignedCaretakerEmpty', { defaultValue: 'No caretaker assigned yet.' })}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('designService.registrationActionsTitle', { defaultValue: 'Registration actions' })}
          </Text>

          {canCancel ? (
            <View style={styles.cancelReasonBlock}>
              <Text style={styles.cancelReasonLabel}>
                {t('designService.cancelReasonLabel', { defaultValue: 'Cancel reason (optional)' })}
              </Text>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                style={[styles.cancelReasonInput, hasRunningAction && styles.actionInputDisabled]}
                editable={!hasRunningAction}
                placeholder={t('designService.cancelReasonPlaceholder', {
                  defaultValue: 'Enter cancellation reason',
                })}
                placeholderTextColor={COLORS.textLight}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ) : null}

          {canCancel || canPay ? (
            <View style={styles.actionRow}>
              {canCancel ? (
                <TouchableOpacity
                  style={[styles.cancelActionButton, hasRunningAction && styles.actionButtonDisabled]}
                  onPress={handleCancelRegistration}
                  disabled={hasRunningAction}
                >
                  {isCancelling ? (
                    <ActivityIndicator size="small" color={COLORS.error} />
                  ) : (
                    <Text style={styles.cancelActionButtonText}>
                      {t('designService.cancelRegistrationAction', {
                        defaultValue: 'Cancel registration',
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}

              {canPay ? (
                <TouchableOpacity
                  style={[styles.payActionButton, hasRunningAction && styles.actionButtonDisabled]}
                  onPress={() => {
                    void handleContinuePayment();
                  }}
                  disabled={hasRunningAction}
                >
                  {isPaying ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.payActionButtonText}>
                      {t('designService.continuePaymentAction', {
                        defaultValue: 'Continue payment',
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {t('designService.taskTimelineTitle', { defaultValue: 'Task timeline' })}
          </Text>
          {tasks.length === 0 ? (
            <Text style={styles.emptyProgressText}>
              {t('designService.taskTimelineEmpty', { defaultValue: 'No tasks found.' })}
            </Text>
          ) : (
            tasks.map((task) => {
              const palette = getDesignTaskStatusPalette(task.statusName ?? '');
              const reportImageUri = resolveBackendImageUri(task.reportImageUrl);

              return (
                <View key={task.id} style={styles.progressCard}>
                  <View style={styles.cardTopRow}>
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

                    <Text style={styles.taskDateText}>
                      {task.scheduledDate ?? t('designService.unscheduledLabel', { defaultValue: 'Unscheduled' })}
                    </Text>
                  </View>

                  <Text style={styles.taskTitle}>{task.taskTypeName}</Text>
                  <Text style={styles.metaText}>
                    {t('designService.registrationCreatedAtLabel', { defaultValue: 'Created at' })}:{' '}
                    {formatVietnamDateTime(task.createdAt, locale, { empty: '-' })}
                  </Text>
                  <Text style={styles.metaText}>
                    {t('designService.scheduledDateLabel', { defaultValue: 'Scheduled date' })}: {task.scheduledDate ?? '-'}
                  </Text>
                  <Text style={styles.metaText}>
                    {t('designService.assignedStaffLabel', { defaultValue: 'Assigned staff' })}: {task.assignedStaff?.fullName ?? '-'}
                  </Text>

                  {task.taskMaterialUsages?.length ? (
                    <View style={styles.materialList}>
                      <Text style={styles.evidenceLabel}>
                        {t('designService.materialUsageTitle', { defaultValue: 'Material usage' })}
                      </Text>
                      {task.taskMaterialUsages.map((item) => (
                        <Text key={item.id} style={styles.metaText}>
                          - {item.materialName} x{item.actualQuantity}
                          {item.note ? ` (${item.note})` : ''}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {reportImageUri ? (
                    <View style={styles.evidenceWrap}>
                      <Text style={styles.evidenceLabel}>
                        {t('designService.reportImageLabel', { defaultValue: 'Report image' })}
                      </Text>
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewImageUri(reportImageUri)}>
                        <Image source={{ uri: reportImageUri }} style={styles.evidencePreviewImage} resizeMode="cover" />
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.taskDetailButton}
                    onPress={() =>
                      navigation.navigate('DesignTaskDetail', {
                        taskId: task.id,
                      })
                    }
                  >
                    <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.taskDetailButtonText}>
                      {t('designService.viewTaskDetailAction', { defaultValue: 'View detail' })}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              );
            })
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
  errorText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.error,
    textAlign: 'center',
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  codeText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  registrationStatusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  surveyImage: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  registrationInfoRow: {
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
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  infoValueRight: {
    flex: 1,
    textAlign: 'right',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptyProgressText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
  },
  cancelReasonBlock: {
    gap: SPACING.xs,
  },
  cancelReasonLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  cancelReasonInput: {
    minHeight: 84,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
  },
  actionInputDisabled: {
    opacity: 0.65,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  cancelActionButton: {
    minHeight: 42,
    minWidth: 132,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  cancelActionButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.error,
  },
  payActionButton: {
    minHeight: 42,
    minWidth: 148,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  payActionButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  actionButtonDisabled: {
    opacity: 0.65,
  },
  progressCard: {
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
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
  taskDateText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  taskTitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  metaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  materialList: {
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  evidenceWrap: {
    marginTop: SPACING.sm,
  },
  evidenceLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  evidencePreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray200,
  },
  taskDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.secondaryLight,
    marginTop: SPACING.sm,
  },
  taskDetailButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
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
