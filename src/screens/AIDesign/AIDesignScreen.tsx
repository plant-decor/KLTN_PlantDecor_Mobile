// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Image,
//   ScrollView,
//   Alert,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { Ionicons } from '@expo/vector-icons';
// import { useNavigation } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { useTranslation } from 'react-i18next';
// import * as ImagePicker from 'expo-image-picker';
// import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../constants';
// import { useAIDesignStore } from '../../stores';
// import { RootStackParamList, AIDesignRequest } from '../../types';

// type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// export default function AIDesignScreen() {
//   const { t } = useTranslation();
//   const navigation = useNavigation<NavigationProp>();
//   const { isGenerating, generateDesign } = useAIDesignStore();
//   const [selectedImage, setSelectedImage] = useState<string | null>(null);
//   const [selectedRoom, setSelectedRoom] =
//     useState<AIDesignRequest['roomType']>('living_room');
//   const [selectedStyle, setSelectedStyle] =
//     useState<AIDesignRequest['style']>('modern');

//   const roomTypes = [
//     { key: 'living_room' as const, label: t('aiDesign.roomLivingRoom'), icon: 'home-outline' as const },
//     { key: 'bedroom' as const, label: t('aiDesign.roomBedroom'), icon: 'bed-outline' as const },
//     { key: 'office' as const, label: t('aiDesign.roomOffice'), icon: 'desktop-outline' as const },
//     { key: 'balcony' as const, label: t('aiDesign.roomBalcony'), icon: 'sunny-outline' as const },
//     { key: 'garden' as const, label: t('aiDesign.roomGarden'), icon: 'leaf-outline' as const },
//   ];

//   const styleOptions = [
//     { key: 'modern' as const, label: t('aiDesign.styleModern') },
//     { key: 'minimalist' as const, label: t('aiDesign.styleMinimalist') },
//     { key: 'tropical' as const, label: t('aiDesign.styleTropical') },
//     { key: 'zen' as const, label: t('aiDesign.styleZen') },
//     { key: 'classic' as const, label: t('aiDesign.styleClassic') },
//   ];

//   const pickImage = async () => {
//     const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
//     if (status !== 'granted') {
//       Alert.alert(t('aiDesign.permissionTitle'), t('aiDesign.mediaPermissionMessage'));
//       return;
//     }

//     const result = await ImagePicker.launchImageLibraryAsync({
//       mediaTypes: ['images'],
//       allowsEditing: true,
//       aspect: [16, 9],
//       quality: 0.8,
//     });

//     if (!result.canceled && result.assets[0]) {
//       setSelectedImage(result.assets[0].uri);
//     }
//   };

//   const takePhoto = async () => {
//     const { status } = await ImagePicker.requestCameraPermissionsAsync();
//     if (status !== 'granted') {
//       Alert.alert(t('aiDesign.permissionTitle'), t('aiDesign.cameraPermissionMessage'));
//       return;
//     }

//     const result = await ImagePicker.launchCameraAsync({
//       allowsEditing: true,
//       aspect: [16, 9],
//       quality: 0.8,
//     });

//     if (!result.canceled && result.assets[0]) {
//       setSelectedImage(result.assets[0].uri);
//     }
//   };

//   const handleGenerate = async () => {
//     if (!selectedImage) {
//       Alert.alert(t('aiDesign.missingImageTitle'), t('aiDesign.missingImageMessage'));
//       return;
//     }

//     try {
//       await generateDesign({
//         roomImage: selectedImage,
//         roomType: selectedRoom,
//         style: selectedStyle,
//       });
//       // Navigate to result screen after generation
//     } catch {
//       Alert.alert(t('aiDesign.errorTitle'), t('aiDesign.errorMessage'));
//     }
//   };

//   return (
//     <SafeAreaView style={styles.container} edges={['top']}>
//       <ScrollView showsVerticalScrollIndicator={false}>
//         <View style={styles.header}>
//           <Text style={styles.headerTitle}>{t('aiDesign.headerTitle')}</Text>
//           <Text style={styles.headerSubtitle}>{t('aiDesign.headerSubtitle')}</Text>
//         </View>

//         {/* Image Picker */}
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>{t('aiDesign.sectionImage')}</Text>
//           {selectedImage ? (
//             <View style={styles.imagePreview}>
//               <Image source={{ uri: selectedImage }} style={styles.previewImage} />
//               <TouchableOpacity
//                 style={styles.changeImageButton}
//                 onPress={pickImage}
//               >
//                 <Ionicons name="refresh" size={20} color={COLORS.white} />
//               </TouchableOpacity>
//             </View>
//           ) : (
//             <View style={styles.imagePickerRow}>
//               <TouchableOpacity style={styles.pickerOption} onPress={pickImage}>
//                 <Ionicons name="images-outline" size={32} color={COLORS.primary} />
//                 <Text style={styles.pickerOptionText}>{t('aiDesign.library')}</Text>
//               </TouchableOpacity>
//               <TouchableOpacity style={styles.pickerOption} onPress={takePhoto}>
//                 <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
//                 <Text style={styles.pickerOptionText}>{t('aiDesign.takePhoto')}</Text>
//               </TouchableOpacity>
//             </View>
//           )}
//         </View>

//         {/* Room Type */}
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>{t('aiDesign.sectionRoomType')}</Text>
//           <View style={styles.optionsGrid}>
//             {roomTypes.map((room) => (
//               <TouchableOpacity
//                 key={room.key}
//                 style={[
//                   styles.optionChip,
//                   selectedRoom === room.key && styles.optionChipActive,
//                 ]}
//                 onPress={() => setSelectedRoom(room.key)}
//               >
//                 <Ionicons
//                   name={room.icon}
//                   size={18}
//                   color={
//                     selectedRoom === room.key ? COLORS.white : COLORS.gray700
//                   }
//                 />
//                 <Text
//                   style={[
//                     styles.optionChipText,
//                     selectedRoom === room.key && styles.optionChipTextActive,
//                   ]}
//                 >
//                   {room.label}
//                 </Text>
//               </TouchableOpacity>
//             ))}
//           </View>
//         </View>

//         {/* Style */}
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>{t('aiDesign.sectionStyle')}</Text>
//           <View style={styles.optionsGrid}>
//             {styleOptions.map((style) => (
//               <TouchableOpacity
//                 key={style.key}
//                 style={[
//                   styles.optionChip,
//                   selectedStyle === style.key && styles.optionChipActive,
//                 ]}
//                 onPress={() => setSelectedStyle(style.key)}
//               >
//                 <Text
//                   style={[
//                     styles.optionChipText,
//                     selectedStyle === style.key && styles.optionChipTextActive,
//                   ]}
//                 >
//                   {style.label}
//                 </Text>
//               </TouchableOpacity>
//             ))}
//           </View>
//         </View>

//         {/* Generate Button */}
//         <TouchableOpacity
//           style={[
//             styles.generateButton,
//             (!selectedImage || isGenerating) && styles.generateButtonDisabled,
//           ]}
//           onPress={handleGenerate}
//           disabled={!selectedImage || isGenerating}
//         >
//           <Ionicons name="sparkles" size={22} color={COLORS.white} />
//           <Text style={styles.generateButtonText}>
//             {isGenerating ? t('aiDesign.generating') : t('aiDesign.generate')}
//           </Text>
//         </TouchableOpacity>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: COLORS.background,
//   },
//   header: {
//     paddingHorizontal: SPACING.lg,
//     paddingVertical: SPACING.md,
//   },
//   headerTitle: {
//     fontSize: FONTS.sizes['3xl'],
//     fontWeight: '700',
//     color: COLORS.textPrimary,
//   },
//   headerSubtitle: {
//     fontSize: FONTS.sizes.md,
//     color: COLORS.textSecondary,
//     marginTop: SPACING.xs,
//   },
//   section: {
//     paddingHorizontal: SPACING.lg,
//     marginTop: SPACING.xl,
//   },
//   sectionTitle: {
//     fontSize: FONTS.sizes.lg,
//     fontWeight: '700',
//     color: COLORS.textPrimary,
//     marginBottom: SPACING.md,
//   },
//   imagePickerRow: {
//     flexDirection: 'row',
//     gap: SPACING.md,
//   },
//   pickerOption: {
//     flex: 1,
//     height: 120,
//     backgroundColor: COLORS.secondaryLight,
//     borderRadius: RADIUS.xl,
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderWidth: 2,
//     borderColor: COLORS.secondary,
//     borderStyle: 'dashed',
//   },
//   pickerOptionText: {
//     fontSize: FONTS.sizes.md,
//     color: COLORS.primary,
//     fontWeight: '600',
//     marginTop: SPACING.sm,
//   },
//   imagePreview: {
//     borderRadius: RADIUS.xl,
//     overflow: 'hidden',
//     position: 'relative',
//   },
//   previewImage: {
//     width: '100%',
//     height: 200,
//     borderRadius: RADIUS.xl,
//   },
//   changeImageButton: {
//     position: 'absolute',
//     top: SPACING.sm,
//     right: SPACING.sm,
//     width: 36,
//     height: 36,
//     borderRadius: RADIUS.full,
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   optionsGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: SPACING.sm,
//   },
//   optionChip: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: SPACING.xs,
//     paddingHorizontal: SPACING.lg,
//     paddingVertical: SPACING.sm,
//     borderRadius: RADIUS.full,
//     backgroundColor: COLORS.white,
//     borderWidth: 1.5,
//     borderColor: COLORS.border,
//     ...SHADOWS.sm,
//   },
//   optionChipActive: {
//     backgroundColor: COLORS.primary,
//     borderColor: COLORS.primary,
//   },
//   optionChipText: {
//     fontSize: FONTS.sizes.md,
//     color: COLORS.gray700,
//     fontWeight: '500',
//   },
//   optionChipTextActive: {
//     color: COLORS.white,
//   },
//   generateButton: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//     gap: SPACING.sm,
//     marginHorizontal: SPACING.lg,
//     marginVertical: SPACING['2xl'],
//     paddingVertical: SPACING.lg,
//     borderRadius: RADIUS.xl,
//     backgroundColor: COLORS.primary,
//     ...SHADOWS.md,
//   },
//   generateButtonDisabled: {
//     backgroundColor: COLORS.gray400,
//   },
//   generateButtonText: {
//     color: COLORS.white,
//     fontSize: FONTS.sizes.lg,
//     fontWeight: '700',
//   },
// });

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../../constants';

export default function AIDesignScreen() {
	const { t } = useTranslation();

	return (
		<SafeAreaView style={styles.container} edges={['top']}>
			<View style={styles.centered}>
				<Text style={styles.title}>{t('aiDesign.headerTitle')}</Text>
				<Text style={styles.subtitle}>
					{t('common.updating', { defaultValue: 'Updating...' })}
				</Text>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: COLORS.background,
	},
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 24,
	},
	title: {
		fontSize: FONTS.sizes['3xl'],
		fontWeight: '700',
		color: COLORS.textPrimary,
	},
	subtitle: {
		marginTop: 8,
		fontSize: FONTS.sizes.md,
		color: COLORS.textSecondary,
		textAlign: 'center',
	},
});
