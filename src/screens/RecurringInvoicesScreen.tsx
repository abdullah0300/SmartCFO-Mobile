// src/screens/RecurringInvoicesScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

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

  const filteredInvoices = useMemo(() => {
    let filtered = recurringInvoices;

    // Apply status filter
    if (filter !== 'all') {
      if (filter === 'active') filtered = filtered.filter(i => i.is_active);
      if (filter === 'paused') filtered = filtered.filter(i => !i.is_active);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(invoice => {
        const clientName = invoice.client?.name?.toLowerCase() || '';
        const frequency = getFrequencyLabel(invoice.frequency).toLowerCase();
        const status = invoice.is_active ? 'active' : 'paused';
        const invoiceNumber = invoice.original_invoice?.invoice_number?.toLowerCase() || '';

        return (
          clientName.includes(query) ||
          frequency.includes(query) ||
          status.includes(query) ||
          invoiceNumber.includes(query)
        );
      });
    }

    return filtered;
  }, [recurringInvoices, filter, searchQuery]);

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
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED', '#6D28D9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                <Feather name="arrow-left" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerSubtitle}>Manage your</Text>
                <Text style={styles.headerTitle}>Recurring Invoices</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => {
                setShowSearch(!showSearch);
                if (showSearch) {
                  setSearchQuery('');
                  Keyboard.dismiss();
                }
              }}
            >
              <BlurView intensity={80} tint="light" style={styles.searchButtonBlur}>
                <View style={styles.searchButtonInner}>
                  <Feather name={showSearch ? "x" : "search"} size={18} color="#7C3AED" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          {showSearch && (
            <View style={styles.searchContainer}>
              <View style={styles.searchInputWrapper}>
                <Feather name="search" size={16} color="rgba(255,255,255,0.6)" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by client, invoice # or frequency..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  returnKeyType="search"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Feather name="x-circle" size={16} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Statistics Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.statIconGradient}
          >
            <MaterialIcons name="check-circle" size={14} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.statValue}>{activeInvoices.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>

        <View style={[styles.statCard, styles.statCardMain]}>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            style={styles.statIconGradient}
          >
            <MaterialIcons name="attach-money" size={14} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.statValue, styles.statValueMain]}>
            {formatCurrency(monthlyValue)}
          </Text>
          <Text style={styles.statLabel}>Monthly</Text>
        </View>

        <View style={styles.statCard}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={styles.statIconGradient}
          >
            <Feather name="clock" size={14} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.statValue}>{dueThisWeek}</Text>
          <Text style={styles.statLabel}>Due Week</Text>
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
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.invoiceNumberRow}>
                    {recurring.original_invoice?.invoice_number && (
                      <Text style={styles.invoiceNumber}>
                        #{recurring.original_invoice.invoice_number}
                      </Text>
                    )}
                    <Text style={styles.clientName}>
                      {recurring.client?.name || 'No Client Set'}
                    </Text>
                  </View>
                  <View style={styles.badgeRow}>
                    <View style={styles.frequencyContainer}>
                      <MaterialIcons name="repeat" size={12} color="#6366F1" />
                      <Text style={styles.frequency}>
                        {getFrequencyLabel(recurring.frequency)}
                      </Text>
                    </View>
                    {recurring.template_data.items && recurring.template_data.items.length > 0 && (
                      <View style={styles.itemsBadge}>
                        <Feather name="list" size={10} color="#6B7280" />
                        <Text style={styles.itemsText}>
                          {recurring.template_data.items.length} item{recurring.template_data.items.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
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

              {/* Card Body */}
              <View style={styles.cardBody}>
                {/* Amount Row */}
                <View style={styles.amountRow}>
                  <View style={styles.amountSection}>
                    <Text style={styles.amountLabel}>Subtotal</Text>
                    <Text style={styles.amountValue}>
                      {formatCurrency(recurring.template_data.subtotal)}
                    </Text>
                  </View>
                  {recurring.template_data.tax_rate > 0 && (
                    <View style={styles.amountSection}>
                      <Text style={styles.amountLabel}>Tax ({recurring.template_data.tax_rate}%)</Text>
                      <Text style={styles.amountValue}>
                        {formatCurrency(recurring.template_data.tax_amount)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.amountSection, styles.amountSectionTotal]}>
                    <Text style={styles.amountLabel}>Total</Text>
                    <Text style={styles.amountValueTotal}>
                      {formatCurrency(recurring.template_data.total)}
                    </Text>
                  </View>
                </View>

                {/* Info Grid */}
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Feather name="calendar" size={14} color="#6366F1" />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Next Invoice</Text>
                      <Text style={styles.infoValue}>
                        {format(parseISO(recurring.next_date), 'MMM dd, yyyy')}
                      </Text>
                    </View>
                  </View>

                  {recurring.last_generated && (
                    <View style={styles.infoItem}>
                      <Feather name="check-circle" size={14} color="#10B981" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Last Generated</Text>
                        <Text style={styles.infoValue}>
                          {format(parseISO(recurring.last_generated), 'MMM dd, yyyy')}
                        </Text>
                      </View>
                    </View>
                  )}

                  {recurring.end_date && (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="event-busy" size={14} color="#EF4444" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>End Date</Text>
                        <Text style={[styles.infoValue, { color: '#EF4444' }]}>
                          {format(parseISO(recurring.end_date), 'MMM dd, yyyy')}
                        </Text>
                      </View>
                    </View>
                  )}

                  {recurring.template_data.currency && (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="attach-money" size={14} color="#F59E0B" />
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Currency</Text>
                        <Text style={styles.infoValue}>
                          {recurring.template_data.currency}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Notes Preview */}
                {recurring.template_data.notes && (
                  <View style={styles.notesPreview}>
                    <Feather name="file-text" size={12} color="#6B7280" />
                    <Text style={styles.notesText} numberOfLines={1}>
                      {recurring.template_data.notes}
                    </Text>
                  </View>
                )}
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
  headerGradient: {
    paddingBottom: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  searchButtonBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  searchButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statCardMain: {
    borderColor: '#D1D5DB',
  },
  statIconGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 1,
  },
  statValueMain: {
    fontSize: 13,
    color: '#6366F1',
  },
  statLabel: {
    fontSize: 9,
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
  invoiceNumberRow: {
    marginBottom: 6,
  },
  invoiceNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 2,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  frequencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  frequency: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
  },
  itemsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  itemsText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
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
  amountRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 12,
  },
  amountSection: {
    flex: 1,
  },
  amountSectionTotal: {
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    paddingLeft: 12,
  },
  amountLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  amountValueTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6366F1',
  },
  infoGrid: {
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  notesPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  notesText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    flex: 1,
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