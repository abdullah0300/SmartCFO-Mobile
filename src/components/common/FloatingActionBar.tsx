import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const FloatingActionBar: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Calculate bottom position based on tab bar + safe area
  const bottomPosition = 90 + (insets.bottom || 0);

  const actions = [
    { icon: 'people', screen: 'Clients', color: '#3B82F6', label: 'Clients' },
    { icon: 'account-balance-wallet', screen: 'Budget', color: '#8B5CF6', label: 'Budget' },
    { icon: 'bar-chart', screen: 'ReportsOverview', color: '#F59E0B', label: 'Reports' },
    { icon: 'label', screen: 'Categories', color: '#6366F1', label: 'Categories' },
    { icon: 'refresh', screen: 'RecurringInvoices', color: '#10B981', label: 'Recurring' },
    { icon: 'store', screen: 'Vendors', color: '#EF4444', label: 'Vendors' },
  ];

  const toggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isExpanded) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setIsExpanded(false));
    } else {
      setIsExpanded(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleAction = (screen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screen);
    toggleExpand();
  };

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1}
          onPress={toggleExpand}
        >
          <Animated.View 
            style={[
              styles.backdropOverlay,
              { opacity: fadeAnim }
            ]} 
          />
        </TouchableOpacity>
      )}

      {/* Actions Grid */}
      {isExpanded && (
        <Animated.View 
          style={[
            styles.actionsContainer,
            {
              bottom: bottomPosition + 70, // Adjust for FAB button height
              opacity: fadeAnim,
              transform: [{
                scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              }],
            },
          ]}
        >
          <BlurView intensity={98} tint="light" style={styles.actionsBlur}>
            <View style={styles.actionsGrid}>
              {actions.map((action) => (
                <TouchableOpacity
                  key={action.screen}
                  style={styles.actionItem}
                  onPress={() => handleAction(action.screen)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                    <MaterialIcons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>
        </Animated.View>
      )}

      {/* Main Button */}
      <View style={[styles.mainButtonContainer, { bottom: bottomPosition }]}>
        <TouchableOpacity onPress={toggleExpand} activeOpacity={0.9}>
          <LinearGradient
            colors={isExpanded ? ['#6B7280', '#4B5563'] : ['#3B82F6', '#8B5CF6']}
            style={styles.mainButton}
          >
            <MaterialIcons 
              name={isExpanded ? 'close' : 'apps'} 
              size={24} 
              color="#FFFFFF" 
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  backdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  actionsContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 999,
  },
  actionsBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  actionItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 15,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  mainButtonContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 1000,
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});