import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, BorderRadius, Typography, Spacing } from '../../constants/Colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: keyof typeof Feather.glyphMap;
  onIconPress?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  onIconPress,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.light.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {icon && (
          <TouchableOpacity
            onPress={onIconPress}
            disabled={!onIconPress}
            style={styles.iconContainer}
          >
            <Feather name={icon} size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.subhead,
    color: Colors.light.text,
    marginBottom: Spacing.sm,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  inputContainerFocused: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.background,
  },
  inputContainerError: {
    borderColor: Colors.light.error,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: Spacing.sm,
  },
  iconContainer: {
    marginLeft: Spacing.sm,
  },
  error: {
    ...Typography.caption1,
    color: Colors.light.error,
    marginTop: Spacing.xs,
  },
});