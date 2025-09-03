// app/(tabs)/invoices.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../../src/hooks/useAuth';
import { useSettings } from '../../src/contexts/SettingsContext';
import { getInvoices } from '../../src/services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/Colors';
import { Invoice } from '../../src/types';



interface InvoiceItemProps {
  item: Invoice;
  onPress: (invoice: Invoice) => void;
  formatCurrency: (amount: number | undefined | null) => string;
  currencySymbol: string;
  getCurrencySymbol: (currency: string) => string;
  baseCurrency: string;
}



const InvoiceItem: React.FC<InvoiceItemProps> = ({ item, onPress, formatCurrency }) => {
  const { getCurrencySymbol, baseCurrency } = useSettings();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#10B981';
      case 'sent': return '#3B82F6';
      case 'overdue': return '#EF4444';
      case 'draft': return '#6B7280';
      case 'cancelled': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return 'check-circle';
      case 'sent': return 'send';
      case 'overdue': return 'error';
      case 'draft': return 'edit';
      default: return 'help';
    }
  };

  const amount = item.total || 0;
  const isBaseCurrency = !item.currency || item.currency === baseCurrency;
  const clientName = item.client?.name || 'Unknown Client';
  const dueDate = item.due_date || item.created_at || new Date().toISOString();
  const invoiceNumber = item.invoice_number || `INV-${item.id?.slice(0, 8)}` || 'N/A';
  const status = item.status || 'draft';
  const statusColor = getStatusColor(status);

  return (
    <TouchableOpacity
      style={styles.invoiceItem}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(item);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.invoiceContent}>
        <View style={styles.invoiceHeader}>
          <View style={styles.invoiceNumberRow}>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <MaterialIcons 
                name={getStatusIcon(status) as any} 
                size={12} 
                color={statusColor} 
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.invoiceAmount}>
            {isBaseCurrency 
              ? formatCurrency(amount)
              : `${getCurrencySymbol(item.currency || baseCurrency)} ${amount.toFixed(2)}`
            }
          </Text>
        </View>
        
        <View style={styles.invoiceFooter}>
          <View style={styles.clientRow}>
            <Feather name="user" size={14} color="#6B7280" />
            <Text style={styles.clientName} numberOfLines={1}>{clientName}</Text>
          </View>
          <View style={styles.dateRow}>
            <Feather name="calendar" size={14} color="#6B7280" />
            <Text style={styles.dueDate}>
              Due {format(new Date(dueDate), 'MMM d')}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.actionArrow}>
        <Feather name="chevron-right" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
};
export default function InvoicesScreen() {
  const { user } = useAuth();
  const { formatCurrency, currencySymbol, baseCurrency, getCurrencySymbol } = useSettings();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const { data: invoices, isLoading, refetch, error } = useQuery({
    queryKey: ['invoices', user?.id],
    queryFn: () => getInvoices(user!.id, 50),
    enabled: !!user,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleInvoicePress = (invoice: Invoice) => {
    navigation.navigate('InvoiceView', { invoiceId: invoice.id });
  };

  const handleCreateInvoice = () => {
    navigation.navigate('CreateInvoice');
  };

  // Filter invoices based on selected filter
  const filteredInvoices = invoices?.filter(invoice => {
    if (selectedFilter === 'all') return true;
    return invoice.status === selectedFilter;
  }) || [];

  // Calculate stats with safe defaults - Updated to use 'total' field
  const stats = invoices?.reduce((acc, invoice) => {
  // Use base_amount for multi-currency support
  const amount = invoice.base_amount || invoice.total || 0;
  acc.total += amount;
  if (invoice.status === 'paid') acc.paid += amount;
  if (invoice.status === 'overdue') acc.overdue += amount;
  if (invoice.status === 'sent') acc.pending += amount;
  if (invoice.status === 'draft') acc.draft += amount;
  return acc;
}, { total: 0, paid: 0, overdue: 0, pending: 0, draft: 0 }) || { total: 0, paid: 0, overdue: 0, pending: 0, draft: 0 };

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <LinearGradient
            colors={['#FEE2E2', '#FECACA'] as const}
            style={styles.errorIcon}
          >
            <Feather name="alert-circle" size={48} color="#EF4444" />
          </LinearGradient>
          <Text style={styles.errorText}>Failed to load invoices</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED'] as const}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED', '#6D28D9'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerSubtitle}>Manage your</Text>
              <Text style={styles.headerTitle}>Invoices</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleCreateInvoice}
            >
              <BlurView intensity={80} tint="light" style={styles.addButtonBlur}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)'] as const}
                  style={styles.addButtonInner}
                >
                  <Feather name="plus" size={24} color="#7C3AED" />
                </LinearGradient>
              </BlurView>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.statsContainer}
            contentContainerStyle={styles.statsContent}
          >
            <TouchableOpacity 
              onPress={() => setSelectedFilter('all')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={selectedFilter === 'all' 
                 ? ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'] as const
                  : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.1)'] as const}
                style={[styles.statCard, selectedFilter === 'all' && styles.statCardActive]}
              >
                <View style={styles.statIconContainer}>
                  <MaterialIcons name="receipt" size={20} color="rgba(255,255,255,0.9)" />
                </View>
                <Text style={styles.statLabel}>Total Revenue ({baseCurrency})</Text>
                <Text style={styles.statValue}>{formatCurrency(stats.total)}</Text>
                <Text style={styles.statCount}>{invoices?.length || 0} invoices</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setSelectedFilter('paid')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={selectedFilter === 'paid' 
                  ? ['rgba(16,185,129,0.3)', 'rgba(16,185,129,0.2)'] as const
                  : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.1)'] as const}
                style={[styles.statCard, selectedFilter === 'paid' && styles.statCardActive]}
              >
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16,185,129,0.3)' }]}>
                  <MaterialIcons name="check-circle" size={20} color="#10B981" />
                </View>
                <Text style={styles.statLabel}>Paid</Text>
                <Text style={[styles.statValue, { color: selectedFilter === 'paid' ? '#10B981' : '#FFFFFF' }]}>
                  {formatCurrency(stats.paid)}
                </Text>
                <Text style={styles.statCount}>
                  {invoices?.filter(i => i.status === 'paid').length || 0} invoices
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setSelectedFilter('sent')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={selectedFilter === 'sent' 
                  ? ['rgba(139,92,246,0.3)', 'rgba(139,92,246,0.2)'] as const
                  : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.1)'] as const}
                style={[styles.statCard, selectedFilter === 'sent' && styles.statCardActive]}
              >
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139,92,246,0.3)' }]}>
                  <MaterialIcons name="send" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.statLabel}>Pending</Text>
                <Text style={[styles.statValue, { color: selectedFilter === 'sent' ? '#8B5CF6' : '#FFFFFF' }]}>
                  {formatCurrency(stats.pending)}
                </Text>
                <Text style={styles.statCount}>
                  {invoices?.filter(i => i.status === 'sent').length || 0} invoices
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setSelectedFilter('overdue')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={selectedFilter === 'overdue' 
                  ? ['rgba(239,68,68,0.3)', 'rgba(239,68,68,0.2)'] as const
                  : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.1)'] as const}
                style={[styles.statCard, selectedFilter === 'overdue' && styles.statCardActive]}
              >
                <View style={[styles.statIconContainer, { backgroundColor: 'rgba(239,68,68,0.3)' }]}>
                  <MaterialIcons name="error" size={20} color="#EF4444" />
                </View>
                <Text style={styles.statLabel}>Overdue</Text>
                <Text style={[styles.statValue, { color: selectedFilter === 'overdue' ? '#EF4444' : '#FFFFFF' }]}>
                  {formatCurrency(stats.overdue)}
                </Text>
                <Text style={styles.statCount}>
                  {invoices?.filter(i => i.status === 'overdue').length || 0} invoices
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <FlatList
          data={filteredInvoices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InvoiceItem 
              item={item} 
              onPress={handleInvoicePress}
              formatCurrency={formatCurrency}
              currencySymbol={currencySymbol}
              getCurrencySymbol={getCurrencySymbol}
              baseCurrency={baseCurrency}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8B5CF6"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['#EDE9FE', '#DDD6FE'] as const}
                style={styles.emptyIcon}
              >
                <MaterialIcons name="receipt-long" size={48} color="#8B5CF6" />
              </LinearGradient>
              <Text style={styles.emptyText}>
                {selectedFilter === 'all' ? 'No invoices yet' : `No ${selectedFilter} invoices`}
              </Text>
              <Text style={styles.emptySubtext}>
                {selectedFilter === 'all' 
                  ? 'Create your first invoice to start tracking payments'
                  : `You don't have any ${selectedFilter} invoices`
                }
              </Text>
              {selectedFilter === 'all' && (
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={handleCreateInvoice}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED'] as const}
                    style={styles.emptyButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <MaterialIcons name="add" size={20} color="#FFFFFF" />
                    <Text style={styles.emptyButtonText}>Create Invoice</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ... (rest of the styles remain the same)
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerGradient: {
    paddingBottom: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsContainer: {
    marginTop: Spacing.sm,
  },
  statsContent: {
    paddingRight: Spacing.lg,
  },
  statCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginRight: Spacing.sm,
    minWidth: 140,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statCardActive: {
    borderColor: 'rgba(255,255,255,0.4)',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  addButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  addButtonBlur: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  invoiceItem: {
  backgroundColor: '#FFFFFF',
  marginHorizontal: 16,
  marginBottom: 12,
  borderRadius: 16,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 2,
  borderWidth: 1,
  borderColor: '#F3F4F6',
},
invoiceContent: {
  flex: 1,
},
invoiceHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 14,
},
invoiceNumberRow: {
  flex: 1,
  marginRight: 12,
},
invoiceNumber: {
  fontSize: 15,
  fontWeight: '600',
  color: '#1F2937',
  marginBottom: 6,
},
statusBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 8,
  alignSelf: 'flex-start',
  gap: 4,
},
statusText: {
  fontSize: 11,
  fontWeight: '600',
},
invoiceAmount: {
  fontSize: 22,
  fontWeight: '700',
  color: '#1F2937',
  textAlign: 'right',
},
invoiceFooter: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
clientRow: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
  gap: 6,
},
clientName: {
  fontSize: 13,
  color: '#6B7280',
  flex: 1,
},
dateRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
dueDate: {
  fontSize: 13,
  color: '#6B7280',
},
actionArrow: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: '#F9FAFB',
  justifyContent: 'center',
  alignItems: 'center',
  marginLeft: 12,
},
  addButtonInner: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
 
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  itemLeft: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 6,
  },

  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  amountContainer: {
    alignItems: 'flex-end',
    gap: 8,
  },
  itemAmount: {
    fontSize: 20,
    color: '#1F2937',
    fontWeight: '700',
  },
  arrowContainer: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  arrowGradient: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  errorIcon: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: 18,
    color: '#1F2937',
    marginBottom: Spacing.lg,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  retryText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 3,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  emptyButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  amountColumn: {
    alignItems: 'flex-end',
  },
  itemCurrency: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 2,
  },
});