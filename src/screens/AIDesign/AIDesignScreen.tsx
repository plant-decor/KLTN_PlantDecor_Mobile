import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
import { useAIDesignStore } from '../../stores';
import { RootStackParamList, AIDesignRequest } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ROOM_TYPES = [
  { key: 'living_room', label: 'Phòng khách', icon: 'home-outline' },
  { key: 'bedroom', label: 'Phòng ngủ', icon: 'bed-outline' },
  { key: 'office', label: 'Văn phòng', icon: 'desktop-outline' },
  { key: 'balcony', label: 'Ban công', icon: 'sunny-outline' },
  { key: 'garden', label: 'Sân vườn', icon: 'leaf-outline' },
] as const;

const STYLES = [
  { key: 'modern', label: 'Hiện đại' },
  { key: 'minimalist', label: 'Tối giản' },
  { key: 'tropical', label: 'Nhiệt đới' },
  { key: 'zen', label: 'Zen' },
  { key: 'classic', label: 'Cổ điển' },
] as const;

export default function AIDesignScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { isGenerating, generateDesign } = useAIDesignStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] =
    useState<AIDesignRequest['roomType']>('living_room');
  const [selectedStyle, setSelectedStyle] =
    useState<AIDesignRequest['style']>('modern');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage) {
      Alert.alert('Thiếu ảnh', 'Vui lòng chọn hoặc chụp ảnh không gian');
      return;
    }

    try {
      await generateDesign({
        roomImage: selectedImage,
        roomType: selectedRoom,
        style: selectedStyle,
      });
      // Navigate to result screen after generation
    } catch {
      Alert.alert('Lỗi', 'Không thể tạo thiết kế. Vui lòng thử lại.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Thiết kế AI 🪄</Text>
          <Text style={styles.headerSubtitle}>
            Chụp ảnh không gian, AI sẽ thiết kế cây cảnh phù hợp
          </Text>
        </View>

        {/* Image Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ảnh không gian</Text>
          {selectedImage ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: selectedImage }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={pickImage}
              >
                <Ionicons name="refresh" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePickerRow}>
              <TouchableOpacity style={styles.pickerOption} onPress={pickImage}>
                <Ionicons name="images-outline" size={32} color={COLORS.primary} />
                <Text style={styles.pickerOptionText}>Thư viện</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerOption} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                <Text style={styles.pickerOptionText}>Chụp ảnh</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Room Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Loại không gian</Text>
          <View style={styles.optionsGrid}>
            {ROOM_TYPES.map((room) => (
              <TouchableOpacity
                key={room.key}
                style={[
                  styles.optionChip,
                  selectedRoom === room.key && styles.optionChipActive,
                ]}
                onPress={() => setSelectedRoom(room.key)}
              >
                <Ionicons
                  name={room.icon}
                  size={18}
                  color={
                    selectedRoom === room.key ? COLORS.white : COLORS.gray700
                  }
                />
                <Text
                  style={[
                    styles.optionChipText,
                    selectedRoom === room.key && styles.optionChipTextActive,
                  ]}
                >
                  {room.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Style */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phong cách</Text>
          <View style={styles.optionsGrid}>
            {STYLES.map((style) => (
              <TouchableOpacity
                key={style.key}
                style={[
                  styles.optionChip,
                  selectedStyle === style.key && styles.optionChipActive,
                ]}
                onPress={() => setSelectedStyle(style.key)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    selectedStyle === style.key && styles.optionChipTextActive,
                  ]}
                >
                  {style.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={[
            styles.generateButton,
            (!selectedImage || isGenerating) && styles.generateButtonDisabled,
          ]}
          onPress={handleGenerate}
          disabled={!selectedImage || isGenerating}
        >
          <Ionicons name="sparkles" size={22} color={COLORS.white} />
          <Text style={styles.generateButtonText}>
            {isGenerating ? 'Đang tạo thiết kế...' : 'Tạo thiết kế'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: FONTS.sizes['3xl'],
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  imagePickerRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  pickerOption: {
    flex: 1,
    height: 120,
    backgroundColor: COLORS.secondaryLight,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.secondary,
    borderStyle: 'dashed',
  },
  pickerOptionText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  imagePreview: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.xl,
  },
  changeImageButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  optionChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionChipText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray700,
    fontWeight: '500',
  },
  optionChipTextActive: {
    color: COLORS.white,
  },
  generateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING['2xl'],
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    ...SHADOWS.md,
  },
  generateButtonDisabled: {
    backgroundColor: COLORS.gray400,
  },
  generateButtonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
});
