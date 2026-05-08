import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import BrandedHeader from '../../components/branding/BrandedHeader';
import { plantService } from '../../services';
import { useUserPlantStore } from '../../stores/useUserPlantStore';
import { RootStackParamList, UserPlant, UpdateUserPlantRequest } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'UserPlants'>;

export default function UserPlantsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const {
    userPlants,
    isLoading,
    selectedGuide,
    isGuideLoading,
    isUpdating,
    fetchUserPlants,
    fetchPlantGuide,
    updateUserPlant,
  } = useUserPlantStore();

  const [refreshing, setRefreshing] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [guideImageUri, setGuideImageUri] = useState<string | null>(null);
  const [todayCareReminderCount, setTodayCareReminderCount] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingPlant, setEditingPlant] = useState<UserPlant | null>(null);
  const [editForm, setEditForm] = useState({
    location: '',
    currentHeight: '',
    currentTrunkDiameter: '',
    healthStatus: '',
    age: '',
  });

  useEffect(() => {
    void fetchUserPlants();
  }, [fetchUserPlants]);

  const loadTodayCareReminders = useCallback(async () => {
    try {
      const reminders = await plantService.getTodayCareReminders();
      setTodayCareReminderCount(reminders.length);
    } catch {
      setTodayCareReminderCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTodayCareReminders();
    }, [loadTodayCareReminders])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchUserPlants();
    } finally {
      setRefreshing(false);
    }
  }, [fetchUserPlants]);

  const openGuide = useCallback(async (plant: UserPlant) => {
    setGuideImageUri(plant.primaryImageUrl ?? null);
    setGuideVisible(true);
    await fetchPlantGuide(plant.plantId);
  }, [fetchPlantGuide]);

  const closeGuide = useCallback(() => {
    setGuideVisible(false);
    setGuideImageUri(null);
  }, []);

  const openCareReminders = useCallback(() => {
    navigation.navigate('CareReminders');
  }, [navigation]);

  const openEditModal = useCallback((plant: UserPlant) => {
    setEditingPlant(plant);
    setEditForm({
      location: plant.location || '',
      currentHeight: plant.currentHeight?.toString() || '',
      currentTrunkDiameter: plant.currentTrunkDiameter?.toString() || '',
      healthStatus: plant.healthStatus || '',
      age: plant.age?.toString() || '',
    });
    setEditModalVisible(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setEditingPlant(null);
    setEditForm({
      location: '',
      currentHeight: '',
      currentTrunkDiameter: '',
      healthStatus: '',
      age: '',
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingPlant) return;

    try {
      const updateData: UpdateUserPlantRequest = {
        location: editForm.location || null,
        currentHeight: editForm.currentHeight ? parseFloat(editForm.currentHeight) : null,
        currentTrunkDiameter: editForm.currentTrunkDiameter ? parseFloat(editForm.currentTrunkDiameter) : null,
        healthStatus: editForm.healthStatus || null,
        age: editForm.age ? parseInt(editForm.age, 10) : null,
      };

      const result = await updateUserPlant(editingPlant.id, updateData);
      
      if (result) {
        Alert.alert(
          t('userPlants.updateSuccess', { defaultValue: 'Success' }),
          t('userPlants.updateSuccessMessage', { defaultValue: 'Plant updated successfully' })
        );
        closeEditModal();
      }
    } catch (error) {
      Alert.alert(
        t('userPlants.updateError', { defaultValue: 'Error' }),
        t('userPlants.updateErrorMessage', { defaultValue: 'Failed to update plant' })
      );
    }
  }, [editingPlant, editForm, updateUserPlant, closeEditModal, t]);

  const getHealthColor = (status: string | undefined) => {
    if (!status) return COLORS.textSecondary;
    const lower = status.toLowerCase();
    if (lower.includes('good') || lower.includes('healthy') || lower.includes('tốt') || lower.includes('khỏe')) return COLORS.success;
    if (lower.includes('fair') || lower.includes('bình thường')) return COLORS.warning;
    if (lower.includes('poor') || lower.includes('yếu') || lower.includes('bad') || lower.includes('sick')) return COLORS.error;
    return COLORS.primary;
  };

  const renderItem = ({ item }: { item: UserPlant }) => (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.card}
        onPress={() => openGuide(item)}
      >
        <View style={styles.imageContainer}>
          {item.primaryImageUrl ? (
            <Image source={{ uri: item.primaryImageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="leaf" size={32} color={COLORS.gray400} />
            </View>
          )}
        </View>
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.plantName} numberOfLines={1}>{item.plantName}</Text>
          </View>
          
          {item.plantSpecificName ? (
            <Text style={styles.specificName} numberOfLines={1}>{item.plantSpecificName}</Text>
          ) : null}

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location || t('userPlants.noLocation', { defaultValue: 'No location' })}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="water-outline" size={14} color={COLORS.primary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.lastWateredDate 
                ? `${t('userPlants.lastWatered', { defaultValue: 'Watered:' })} ${item.lastWateredDate}`
                : t('userPlants.neverWatered', { defaultValue: 'Not watered yet' })}
            </Text>
          </View>

          {item.healthStatus ? (
            <View style={[styles.healthBadge, { backgroundColor: `${getHealthColor(item.healthStatus)}15` }]}>
              <View style={[styles.healthDot, { backgroundColor: getHealthColor(item.healthStatus) }]} />
              <Text style={[styles.healthText, { color: getHealthColor(item.healthStatus) }]}>
                {item.healthStatus}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.editButton}
        onPress={() => openEditModal(item)}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Ionicons name="create" size={13} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="leaf-outline" size={64} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>
        {t('userPlants.emptyTitle', { defaultValue: 'No plants yet' })}
      </Text>
      <Text style={styles.emptyDescription}>
        {t('userPlants.emptyDescription', { defaultValue: 'Your collection of plants will appear here.' })}
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.emptyButtonText}>
          {t('userPlants.explorePlants', { defaultValue: 'Explore Plants' })}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderGuideSection = (title: string, content: string | undefined | null, icon: keyof typeof Ionicons.glyphMap) => {
    if (!content) return null;
    return (
      <View style={styles.guideSection}>
        <View style={styles.guideSectionHeader}>
          <View style={styles.guideIconContainer}>
            <Ionicons name={icon} size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.guideSectionTitle}>{title}</Text>
        </View>
        <Text style={styles.guideSectionContent}>{content}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <BrandedHeader 
        title={t('userPlants.title', { defaultValue: 'My Garden' })} 
        brandVariant="none"
        left={
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        } 
        right={
          <TouchableOpacity style={styles.headerButton} onPress={openCareReminders}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
            {todayCareReminderCount > 0 ? <View style={styles.notificationDot} /> : null}
          </TouchableOpacity>
        }
      />

      {isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={userPlants}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={userPlants?.length ? styles.listContainer : styles.emptyListContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      <Modal 
        visible={guideVisible} 
        animationType="slide" 
        presentationStyle="pageSheet"
        onRequestClose={closeGuide}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {t('userPlants.guideTitle', { defaultValue: 'Care Guide' })}
          </Text>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={closeGuide}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="close-circle" size={28} color={COLORS.gray400} />
          </TouchableOpacity>
        </View>

        {isGuideLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {t('userPlants.loadingGuide', { defaultValue: 'Loading care guide...' })}
            </Text>
          </View>
        ) : selectedGuide ? (
          <ScrollView 
            contentContainerStyle={styles.guideScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.guideHeroSection}>
              {guideImageUri ? (
                <Image source={{ uri: guideImageUri }} style={styles.guideHeroImage} resizeMode="cover" />
              ) : (
                <View style={styles.guideHeroIcon}>
                  <Ionicons name="book-outline" size={32} color={COLORS.primary} />
                </View>
              )}
              <Text style={styles.guideHeroTitle}>{selectedGuide.plantName}</Text>
              <Text style={styles.guideHeroSubtitle}>
                {t('userPlants.guideSubtitle', { defaultValue: 'Essential care instructions for your plant to thrive.' })}
              </Text>
            </View>

            <View style={styles.guideContentCard}>
              {renderGuideSection(t('userPlants.watering', { defaultValue: 'Watering' }), selectedGuide.watering, 'water')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.temperature', { defaultValue: 'Temperature' }), selectedGuide.temperature, 'thermometer')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.humidity', { defaultValue: 'Humidity' }), selectedGuide.humidity, 'water-outline')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.soil', { defaultValue: 'Soil' }), selectedGuide.soil, 'leaf')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.fertilizing', { defaultValue: 'Fertilizing' }), selectedGuide.fertilizing, 'flask')}
              <View style={styles.divider} />
              {renderGuideSection(t('userPlants.pruning', { defaultValue: 'Pruning' }), selectedGuide.pruning, 'cut')}
              
              {selectedGuide.careNotes ? (
                <>
                  <View style={styles.divider} />
                  {renderGuideSection(t('userPlants.careNotes', { defaultValue: 'Care Notes' }), selectedGuide.careNotes, 'information-circle')}
                </>
              ) : null}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centerContainer}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.gray300} />
            <Text style={styles.errorText}>
              {t('userPlants.guideUnavailable', { defaultValue: 'Care guide is currently unavailable.' })}
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={closeGuide}
            >
              <Text style={styles.retryButtonText}>{t('common.goBack', { defaultValue: 'Go Back' })}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      <Modal 
        visible={editModalVisible} 
        animationType="slide" 
        presentationStyle="pageSheet"
        onRequestClose={closeEditModal}
      >
        <SafeAreaView style={styles.editModalContainer} edges={["top"]}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={closeEditModal}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close-circle" size={28} color={COLORS.gray400} />
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>
              {t('userPlants.editTitle', { defaultValue: 'Edit Plant' })}
            </Text>
            <TouchableOpacity 
              style={styles.saveButton}
              disabled={isUpdating}
              onPress={handleSaveEdit}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="checkmark" size={24} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={styles.editFormContent}
            showsVerticalScrollIndicator={false}
          >
            {editingPlant && (
              <View>
                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>
                    {t('userPlants.location', { defaultValue: 'Location' })}
                  </Text>
                  <TextInput
                    style={styles.editInput}
                    placeholder={t('userPlants.locationPlaceholder', { defaultValue: 'e.g., Living room shelf' })}
                    value={editForm.location}
                    onChangeText={(text) => setEditForm({ ...editForm, location: text })}
                    editable={!isUpdating}
                  />
                </View>

                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>
                    {t('userPlants.healthStatus', { defaultValue: 'Health Status' })}
                  </Text>
                  <TextInput
                    style={styles.editInput}
                    placeholder={t('userPlants.healthStatusPlaceholder', { defaultValue: 'e.g., Healthy, Fair, Poor' })}
                    value={editForm.healthStatus}
                    onChangeText={(text) => setEditForm({ ...editForm, healthStatus: text })}
                    editable={!isUpdating}
                  />
                </View>

                <View style={styles.twoColumnRow}>
                  <View style={[styles.editSection, styles.halfWidth]}>
                    <Text style={styles.editLabel}>
                      {t('userPlants.height', { defaultValue: 'Height (cm)' })}
                    </Text>
                    <TextInput
                      style={styles.editInput}
                      placeholder="0"
                      value={editForm.currentHeight}
                      onChangeText={(text) => setEditForm({ ...editForm, currentHeight: text })}
                      keyboardType="decimal-pad"
                      editable={!isUpdating}
                    />
                  </View>

                  <View style={[styles.editSection, styles.halfWidth]}>
                    <Text style={styles.editLabel}>
                      {t('userPlants.trunkDiameter', { defaultValue: 'Trunk Diameter (cm)' })}
                    </Text>
                    <TextInput
                      style={styles.editInput}
                      placeholder="0"
                      value={editForm.currentTrunkDiameter}
                      onChangeText={(text) => setEditForm({ ...editForm, currentTrunkDiameter: text })}
                      keyboardType="decimal-pad"
                      editable={!isUpdating}
                    />
                  </View>
                </View>

                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>
                    {t('userPlants.age', { defaultValue: 'Age (years)' })}
                  </Text>
                  <TextInput
                    style={styles.editInput}
                    placeholder="0"
                    value={editForm.age}
                    onChangeText={(text) => setEditForm({ ...editForm, age: text })}
                    keyboardType="number-pad"
                    editable={!isUpdating}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  cardWrapper: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  editButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
    elevation: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 9999,
    backgroundColor: COLORS.error,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  listContainer: { 
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  imageContainer: {
    width: 90,
    height: 100,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  image: { 
    width: '100%', 
    height: '100%', 
  },
  imagePlaceholder: {
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: { 
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  plantName: { 
    flex: 1,
    fontSize: FONTS.sizes.lg, 
    fontWeight: '700', 
    color: COLORS.textPrimary,
    marginRight: SPACING.sm,
  },
  specificName: { 
    fontSize: FONTS.sizes.sm, 
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: { 
    fontSize: FONTS.sizes.sm, 
    color: COLORS.textSecondary, 
    marginLeft: 6,
    flex: 1,
  },
  healthBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: SPACING.sm, 
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  healthText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  emptyContainer: { 
    flex: 1,
    padding: SPACING.xl, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    ...SHADOWS.sm,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  guideScrollContent: { 
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  guideHeroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingTop: SPACING.md,
  },
  guideHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  guideHeroImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.gray100,
  },
  guideHeroTitle: { 
    fontSize: FONTS.sizes['2xl'], 
    fontWeight: '700', 
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  guideHeroSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  guideContentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  guideSection: {
    paddingVertical: SPACING.xs,
  },
  guideSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  guideIconContainer: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  guideSectionTitle: { 
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  guideSectionContent: { 
    fontSize: FONTS.sizes.md,
    color: COLORS.gray700,
    lineHeight: 24,
    paddingLeft: 44,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray100,
    marginVertical: SPACING.md,
    marginLeft: 44,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.full,
  },
  retryButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  editModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  editModalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  editFormContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  editSection: {
    marginBottom: SPACING.lg,
  },
  twoColumnRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  halfWidth: {
    flex: 1,
    marginBottom: 0,
  },
  editLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  editInput: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
});