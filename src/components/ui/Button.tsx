import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Typography, Spacing } from '../../constants/Colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'large' | 'medium' | 'small';
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'large',
  style,
}) => {
  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const getButtonContent = () => {
    if (loading) {
      return <ActivityIndicator color={
        variant === 'primary' ? '#FFFFFF' : 
        variant === 'secondary' ? Colors.light.primary : 
        Colors.light.primary
      } />;
    }
    
    return (
      <Text style={[
        styles.text,
        variant === 'secondary' && styles.secondaryText,
        variant === 'ghost' && styles.ghostText,
        size === 'medium' && styles.mediumText,
        size === 'small' && styles.smallText,
      ]}>
        {title}
      </Text>
    );
  };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={style}
      >
        <LinearGradient
          colors={disabled 
            ? ['#CBD5E1', '#94A3B8'] 
            : [Colors.light.primary, Colors.light.primaryDark]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.button,
            size === 'medium' && styles.mediumButton,
            size === 'small' && styles.smallButton,
          ]}
        >
          {getButtonContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'ghost' && styles.ghostButton,
        size === 'medium' && styles.mediumButton,
        size === 'small' && styles.smallButton,
        disabled && styles.disabledButton,
        style,
      ]}
    >
      {getButtonContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  mediumButton: {
    height: 48,
    paddingHorizontal: Spacing.md,
  },
  smallButton: {
    height: 40,
    paddingHorizontal: Spacing.md,
  },
  secondaryButton: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  disabledButton: {
    opacity: 0.5,
  },
  text: {
    ...Typography.headline,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  secondaryText: {
    color: Colors.light.text, // Fixed: now text is visible
  },
  mediumText: {
    ...Typography.callout,
  },
  smallText: {
    ...Typography.subhead,
  },
  ghostText: {
    color: Colors.light.primary,
  },
});