import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const icons = {
  Dashboard: 'home',
  Income: 'trending-up',
  Expenses: 'trending-down',
  Invoices: 'file-text',
};

export const TabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  
  // Modern approach: Use insets directly without complex calculations
  // React Native SafeArea now handles this better
  const bottomSpace = insets.bottom || 0;
  
  // Fixed height for tab content + dynamic bottom padding
  const TAB_BAR_HEIGHT = 60;
  
  return (
    <View style={[styles.wrapper, { paddingBottom: bottomSpace }]}>
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB']}
        style={[styles.container, { height: TAB_BAR_HEIGHT }]}
      >
        {state.routes.map((route, index) => {
          if (route.name === 'Profile' || route.name === 'Notifications') return null;
          
          const isFocused = state.index === index;
          const icon = icons[route.name as keyof typeof icons];

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => !isFocused && navigation.navigate(route.name)}
              style={styles.tab}
            >
              <Feather
                name={icon as any}
                size={22}
                color={isFocused ? '#3B82F6' : '#9CA3AF'}
              />
              <Text style={[styles.label, { color: isFocused ? '#3B82F6' : '#9CA3AF' }]}>
                {route.name === 'Dashboard' ? 'Home' : route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  container: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});