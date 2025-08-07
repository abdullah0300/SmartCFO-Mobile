// src/screens/RecurringInvoicesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function RecurringInvoicesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');

  useEffect(() => {
    loadRecurringInvoices();
  }, []);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED'] as const}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Recurring Invoices</Text>
          
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {/* Filters */}
      <View style={styles.filterSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {(['all', 'active', 'paused'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                filter === status && styles.filterChipActive
              ]}
              onPress={() => setFilter(status)}
            >
              <Text style={[
                styles.filterText,
                filter === status && styles.filterTextActive
              ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recurring Invoices List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B5CF6"
          />
        }
      >
        {filteredInvoices.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="refresh" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No recurring invoices</Text>
            <Text style={styles.emptySubtext}>
              Create recurring invoices to automate your billing
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
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.clientName}>
                    {recurring.client?.name || 'No Client'}
                  </Text>
                  <Text style={styles.frequency}>
                    {getFrequencyLabel(recurring.frequency)}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: recurring.is_active ? '#D1FAE5' : '#F3F4F6' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: recurring.is_active ? '#065F46' : '#6B7280' }
                  ]}>
                    {recurring.is_active ? 'Active' : 'Paused'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Feather name="calendar" size={14} color="#6B7280" />
                    <Text style={styles.infoLabel}>Next Invoice</Text>
                    <Text style={styles.infoValue}>
                      {format(parseISO(recurring.next_date), 'MMM dd, yyyy')}
                    </Text>
                  </View>
                  
                  <View style={styles.infoItem}>
                    <MaterialIcons name="attach-money" size={14} color="#6B7280" />
                    <Text style={styles.infoLabel}>Amount</Text>
                    <Text style={styles.infoValue}>
                      {formatCurrency(recurring.template_data.total)}
                    </Text>
                  </View>
                </View>

                {recurring.last_generated && (
                  <View style={styles.lastGenerated}>
                    <Feather name="clock" size={12} color="#9CA3AF" />
                    <Text style={styles.lastGeneratedText}>
                      Last generated: {format(parseISO(recurring.last_generated), 'MMM dd, yyyy')}
                    </Text>
                  </View>
                )}

                {recurring.end_date && (
                  <View style={styles.endDate}>
                    <MaterialIcons name="event-busy" size={12} color="#EF4444" />
                    <Text style={styles.endDateText}>
                      Ends: {format(parseISO(recurring.end_date), 'MMM dd, yyyy')}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    recurring.is_active ? styles.pauseButton : styles.resumeButton
                  ]}
                  onPress={() => toggleStatus(recurring.id, recurring.is_active)}
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
                  style={styles.actionButton}
                  onPress={() => {
                    // Navigate to edit or view details
                    Alert.alert('Coming Soon', 'Edit recurring invoice feature');
                  }}
                >
                  <Feather name="edit-2" size={18} color="#6B7280" />
                  <Text style={styles.actionButtonText}>Edit</Text>
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
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  filterChipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  recurringCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recurringCardInactive: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  frequency: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  lastGenerated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  lastGeneratedText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  endDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  endDateText: {
    fontSize: 12,
    color: '#EF4444',
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pauseButton: {
    borderColor: '#FEF3C7',
    backgroundColor: '#FEF3C7',
  },
  resumeButton: {
    borderColor: '#D1FAE5',
    backgroundColor: '#D1FAE5',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
});