import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Logo from '../../../assets/icons/logo.svg';
import LogoWithText from '../../../assets/icons/logo_with_text.svg';

export type BrandVariant = 'logo' | 'logoWithText';
export type BrandSizePreset = 'hero' | 'majorHeader' | 'compactHeader';

type BrandMarkProps = {
  variant?: BrandVariant;
  size?: BrandSizePreset;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const SIZE_PRESETS: Record<BrandSizePreset, { width: number; height: number }> = {
  hero: { width: 188, height: 56 },
  majorHeader: { width: 142, height: 34 },
  compactHeader: { width: 28, height: 28 },
};

export default function BrandMark({
  variant = 'logoWithText',
  size = 'majorHeader',
  width,
  height,
  style,
}: BrandMarkProps) {
  const BrandIcon = variant === 'logo' ? Logo : LogoWithText;
  const presetSize = SIZE_PRESETS[size];

  return (
    <BrandIcon
      width={width ?? presetSize.width}
      height={height ?? presetSize.height}
      style={style}
    />
  );
}
