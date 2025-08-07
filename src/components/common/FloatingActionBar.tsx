// src/components/common/FloatingActionBar.tsx

import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const FloatingActionBar: React.FC = () => {
  const navigation = useNavigation<any>();
  const [isExpanded, setIsExpanded] = useState(false);

  const actions = [
    { icon: 'people', screen: 'Clients', color: '#3B82F6', label: 'Clients' },
    { icon: 'label', screen: 'Categories', color: '#6366F1', label: 'Categories' },
    { icon: 'store', screen: 'Vendors', color: '#EF4444', label: 'Vendors' },
    { icon: 'refresh', screen: 'RecurringInvoices', color: '#10B981', label: 'Recurring' },
  ];

  const toggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  const handleAction = (screen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screen);
    setIsExpanded(false);
  };

  return (
    <View style={[styles.container, isExpanded && styles.containerExpanded]}>
      {isExpanded && (
        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.screen}
              style={styles.actionItem}
              onPress={() => handleAction(action.screen)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionButton, { backgroundColor: action.color + '20' }]}>
                <MaterialIcons name={action.icon as any} size={22} color={action.color} />
              </View>
              <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.9}>
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
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
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 999,
  },
  containerExpanded: {
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});