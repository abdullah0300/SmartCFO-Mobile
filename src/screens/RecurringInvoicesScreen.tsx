// src/screens/RecurringInvoicesScreen.tsx
import React, { useState, useEffect } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { getRecurringInvoices, updateRecurringInvoice } from '../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { RecurringInvoice } from '../types';
import { RootStackParamList } from '../../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

export default function RecurringInvoicesScreen() {
    const navigation = useNavigation<NavigationProp>();

  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  useFocusEffect(
  React.useCallback(() => {
    loadRecurringInvoices();
  }, [user])
);

  const loadRecurringInvoices = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getRecurringInvoices(user.id);
      setRecurringInvoices(data);
    } catch (error) {
      console.error('Error loading recurring invoices:', error);
      Alert.alert('Error', 'Failed to load recurring invoices');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecurringInvoices();
    setRefreshing(false);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateRecurringInvoice(id, { is_active: !currentStatus });
      await loadRecurringInvoices();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels = {
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
    };
    return labels[frequency as keyof typeof labels] || frequency;
  };

  const filteredInvoices = recurringInvoices.filter(invoice => {
    if (filter === 'all') return true;
    if (filter === 'active') return invoice.is_active;
    if (filter === 'paused') return !invoice.is_active;
    return true;
  });

  const activeInvoices = recurringInvoices.filter(i => i.is_active);
  const monthlyValue = activeInvoices.reduce((sum, i) => sum + (i.template_data?.total || 0), 0);
  const dueThisWeek = filteredInvoices.filter(i => {
    const daysUntil = Math.ceil((new Date(i.next_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7 && i.is_active;
  }).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading recurring invoices...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Enhanced Header with Gradient */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6', '#A855F7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Recurring Invoices</Text>
            <Text style={styles.headerSubtitle}>Manage automated billing</Text>
          </View>
          
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Enhanced Statistics Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.statIconGradient}
          >
            <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.statValue}>{activeInvoices.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        
        <View style={[styles.statCard, styles.statCardMain]}>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            style={styles.statIconGradient}
          >
            <MaterialIcons name="attach-money" size={20} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.statValue, styles.statValueMain]}>
            {formatCurrency(monthlyValue)}
          </Text>
          <Text style={styles.statLabel}>Monthly Revenue</Text>
        </View>
        
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={styles.statIconGradient}
          >
            <Feather name="clock" size={20} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.statValue}>{dueThisWeek}</Text>
          <Text style={styles.statLabel}>Due This Week</Text>
        </View>
      </View>

      {/* Enhanced Filter Section */}
      <View style={styles.filterSection}>
        <View style={styles.filterContent}>
          {(['all', 'active', 'paused'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                filter === status && styles.filterChipActive
              ]}
              onPress={() => setFilter(status)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterText,
                filter === status && styles.filterTextActive
              ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status !== 'all' && (
                  <Text style={styles.filterCount}>
                    {' '}({status === 'active' ? activeInvoices.length : recurringInvoices.filter(i => !i.is_active).length})
                  </Text>
                )}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Enhanced Invoices List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredInvoices.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#F8FAFC', '#F1F5F9']}
              style={styles.emptyIconContainer}
            >
              <MaterialIcons name="refresh" size={32} color="#94A3B8" />
            </LinearGradient>
            <Text style={styles.emptyText}>No {filter === 'all' ? '' : filter + ' '}recurring invoices</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all' 
                ? 'Create recurring invoices to automate your billing process'
                : `No ${filter} invoices found. Try switching filters or create new recurring invoices.`
              }
            </Text>
          </View>
        ) : (
          filteredInvoices.map((recurring) => (
            <View
              key={recurring.id}
              style={[
                styles.recurringCard,
                !recurring.is_active && styles.recurringCardInactive
              ]}
            >
              {/* Enhanced Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.clientName}>
                    {recurring.client?.name || 'No Client Set'}
                  </Text>
                  <View style={styles.frequencyContainer}>
                    <MaterialIcons name="repeat" size={14} color="#6366F1" />
                    <Text style={styles.frequency}>
                      {getFrequencyLabel(recurring.frequency)}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.statusBadge,
                  recurring.is_active ? styles.statusBadgeActive : styles.statusBadgeInactive
                ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: recurring.is_active ? '#10B981' : '#94A3B8' }
                  ]} />
                  <Text style={[
                    styles.statusText,
                    { color: recurring.is_active ? '#065F46' : '#64748B' }
                  ]}>
                    {recurring.is_active ? 'Active' : 'Paused'}
                  </Text>
                </View>
              </View>

              {/* Enhanced Card Body */}
              <View style={styles.cardBody}>
                <View style={styles.infoGrid}>
                  <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                      <Feather name="calendar" size={16} color="#6366F1" />
                      <Text style={styles.infoLabel}>Next Invoice</Text>
                    </View>
                    <Text style={styles.infoValue}>
                      {format(parseISO(recurring.next_date), 'MMM dd, yyyy')}
                    </Text>
                  </View>
                  
                  <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                      <MaterialIcons name="attach-money" size={16} color="#10B981" />
                      <Text style={styles.infoLabel}>Amount</Text>
                    </View>
                    <Text style={[styles.infoValue, styles.infoValueAmount]}>
                      {formatCurrency(recurring.template_data.total)}
                    </Text>
                  </View>
                </View>

                {/* Additional Info */}
                <View style={styles.additionalInfo}>
                  {recurring.last_generated && (
                    <View style={styles.additionalInfoItem}>
                      <Feather name="check-circle" size={12} color="#10B981" />
                      <Text style={styles.additionalInfoText}>
                        Last generated: {format(parseISO(recurring.last_generated), 'MMM dd')}
                      </Text>
                    </View>
                  )}

                  {recurring.end_date && (
                    <View style={styles.additionalInfoItem}>
                      <MaterialIcons name="event-busy" size={12} color="#EF4444" />
                      <Text style={[styles.additionalInfoText, { color: '#EF4444' }]}>
                        Ends: {format(parseISO(recurring.end_date), 'MMM dd, yyyy')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Enhanced Actions */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionButtonSecondary
                  ]}
                  onPress={() => toggleStatus(recurring.id, recurring.is_active)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons 
                    name={recurring.is_active ? "pause" : "play-arrow"} 
                    size={18} 
                    color={recurring.is_active ? "#F59E0B" : "#10B981"}
                  />
                  <Text style={[
                    styles.actionButtonText,
                    { color: recurring.is_active ? "#F59E0B" : "#10B981" }
                  ]}>
                    {recurring.is_active ? 'Pause' : 'Resume'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={() => {
                    navigation.navigate('RecurringInvoiceEdit', { 
                      recurringId: recurring.id 
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="edit-2" size={18} color="#FFFFFF" />
                  <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                    Edit Settings
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
    fontWeight: '400',
  },

  // Enhanced Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -8,
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCardMain: {
    borderColor: '#D1D5DB',
  },
  statIconGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  statValueMain: {
    fontSize: 15,
    color: '#6366F1',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Enhanced Filters
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterContent: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterCount: {
    opacity: 0.8,
    fontSize: 12,
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Enhanced Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },

  // Enhanced Cards
  recurringCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recurringCardInactive: {
    opacity: 0.7,
    borderColor: '#F3F4F6',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FAFBFC',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  frequencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  frequency: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusBadgeInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  cardBody: {
    padding: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoValueAmount: {
    color: '#10B981',
  },

  additionalInfo: {
    gap: 8,
  },
  additionalInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  additionalInfoText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  cardActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFBFC',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionButtonSecondary: {
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  actionButtonPrimary: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
});