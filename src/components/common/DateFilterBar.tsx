import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { Colors, BorderRadius, Spacing } from '../../constants/Colors';

interface DateFilterBarProps {
  selectedPeriod: string;
  onPeriodChange: (periodId: string) => void;
  customRange?: { start: Date; end: Date } | null;
  onClearCustom?: () => void;
}

const FILTER_PERIODS = [
  { id: '1w', label: '1W', description: 'Last 7 days' },
  { id: 'mtd', label: 'MTD', description: 'Month to Date' },
  { id: '1m', label: '1M', description: 'Last 30 days' },
  { id: '3m', label: '3M', description: 'Last 3 months' },
  { id: '6m', label: '6M', description: 'Last 6 months' },
  { id: '1y', label: '1Y', description: 'Last year' },
  { id: 'all', label: 'All', description: 'All time' },
  { id: 'custom', label: 'Custom', isIcon: true },
];

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  selectedPeriod,
  onPeriodChange,
  customRange,
  onClearCustom,
}) => {
  const handlePress = (periodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPeriodChange(periodId);
  };

  const handleClearCustom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClearCustom?.();
  };

  const renderButton = (period: typeof FILTER_PERIODS[0]) => {
    const isSelected = selectedPeriod === period.id;
    const isCustomActive = period.id === 'custom' && customRange;

    if (isSelected && period.id !== 'custom') {
      return (
        <LinearGradient
          key={period.id}
          colors={['#3B82F6', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.selectedButton}
        >
          <TouchableOpacity
            onPress={() => handlePress(period.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.selectedText}>{period.label}</Text>
          </TouchableOpacity>
        </LinearGradient>
      );
    }

    if (period.id === 'custom' && isCustomActive) {
      return (
        <LinearGradient
          key={period.id}
          colors={['#3B82F6', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.selectedButton}
        >
          <TouchableOpacity
            onPress={handleClearCustom}
            activeOpacity={0.8}
            style={styles.customButtonContent}
          >
            <Feather name="x" size={12} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>
      );
    }

    return (
      <TouchableOpacity
        key={period.id}
        onPress={() => handlePress(period.id)}
        activeOpacity={0.7}
        style={styles.unselectedButton}
      >
        {period.isIcon ? (
          <Feather name="calendar" size={14} color={Colors.light.textSecondary} />
        ) : (
          <Text style={styles.unselectedText}>{period.label}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTER_PERIODS.map(renderButton)}
      </ScrollView>
      {customRange && (
        <View style={styles.customRangeInfo}>
          <Text style={styles.customRangeText}>
            {format(customRange.start, 'MMM dd')} - {format(customRange.end, 'MMM dd, yyyy')}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  selectedButton: {
    borderRadius: BorderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unselectedButton: {
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unselectedText: {
    color: Colors.light.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  customButtonContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customRangeInfo: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  customRangeText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
});
