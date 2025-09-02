import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../services/supabase';
import { Spacing, BorderRadius } from '../constants/Colors';
import { RootStackParamList } from '../../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Invoice {
  id: string;
  invoice_number: string;
  date: string;
  total: number;
  currency?: string;
  status: 'paid' | 'sent' | 'overdue' | 'draft' | 'canceled';
  base_amount?: number;
  exchange_rate?: number;
}

interface Income {
  id: string;
  amount: number;
  base_amount?: number;
  currency?: string;
  credit_note_id?: string;
  date: string;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at: string;
}

export default function ClientDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { clientId } = route.params as { clientId: string };
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingAmount: 0,
    creditAmount: 0,
    recentInvoices: [] as Invoice[],
    recentIncomes: [] as Income[],
  });

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const loadClientData = async () => {
    if (!user || !clientId) return;
    
    try {
      setLoading(true);
      
      // Load client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (clientError) throw clientError;
      setClient(clientData);
      
      // Load invoices
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (invoicesError) throw invoicesError;
      
      // Load income entries
      const { data: incomes, error: incomesError } = await supabase
        .from('income')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: false });
      
      if (incomesError) throw incomesError;
      
      // Calculate stats with proper multi-currency support
      
      // Total revenue from income entries (properly handles credits)
      const totalRevenue = incomes?.reduce((sum, inc) => {
        // Use base_amount if available for proper currency conversion
        const amount = inc.base_amount || inc.amount;
        return sum + amount;
      }, 0) || 0;
      
      // Calculate credit amount separately
      const creditAmount = Math.abs(incomes?.filter(inc => inc.credit_note_id)
        .reduce((sum, inc) => {
          const amount = inc.base_amount || inc.amount;
          return sum + amount;
        }, 0) || 0);
      
      // Pending amount calculation with currency conversion
      const pendingAmount = invoices?.reduce((sum, inv) => {
        if (['sent', 'overdue'].includes(inv.status)) {
          // Use base_amount for consistent currency
          return sum + (inv.base_amount || inv.total);
        }
        return sum;
      }, 0) || 0;
      
      const paidInvoices = invoices?.filter(inv => inv.status === 'paid').length || 0;
      
      setStats({
        totalRevenue,
        totalInvoices: invoices?.length || 0,
        paidInvoices,
        pendingAmount,
        creditAmount,
        recentInvoices: invoices?.slice(0, 5) || [],
        recentIncomes: incomes?.slice(0, 5) || [],
      });
      
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClientData();
    setRefreshing(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid':
        return { backgroundColor: '#D1FAE5', color: '#065F46' };
      case 'sent':
        return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
      case 'overdue':
        return { backgroundColor: '#FEE2E2', color: '#991B1B' };
      case 'draft':
        return { backgroundColor: '#F3F4F6', color: '#6B7280' };
      case 'canceled':
        return { backgroundColor: '#FEF3C7', color: '#92400E' };
      default:
        return { backgroundColor: '#F3F4F6', color: '#6B7280' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading client details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Client not found</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Client Details</Text>
          <View style={styles.headerButton} />
        </View>
      </LinearGradient>

      <ScrollView
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Client Info Card */}
        <View style={styles.clientCard}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {client.name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </View>
          <Text style={styles.clientName}>{client.name}</Text>
          
          <View style={styles.contactInfo}>
            {client.email && (
              <View style={styles.contactRow}>
                <Feather name="mail" size={16} color="#6B7280" />
                <Text style={styles.contactText}>{client.email}</Text>
              </View>
            )}
            {client.phone && (
              <View style={styles.contactRow}>
                <Feather name="phone" size={16} color="#6B7280" />
                <Text style={styles.contactText}>{client.phone}</Text>
              </View>
            )}
            {client.address && (
              <View style={styles.contactRow}>
                <Feather name="map-pin" size={16} color="#6B7280" />
                <Text style={styles.contactText} numberOfLines={2}>
                  {client.address}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
            <MaterialIcons name="attach-money" size={24} color="#10B981" />
            <Text style={styles.statValue}>
              {formatCurrency(stats.totalRevenue)}
            </Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
            {stats.creditAmount > 0 && (
              <Text style={styles.creditNote}>
                (Credits: {formatCurrency(stats.creditAmount)})
              </Text>
            )}
          </View>
          
          <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
            <Feather name="file-text" size={24} color="#6366F1" />
            <Text style={styles.statValue}>{stats.totalInvoices}</Text>
            <Text style={styles.statLabel}>Total Invoices</Text>
            <Text style={styles.statSubtext}>
              {stats.paidInvoices} paid
            </Text>
          </View>
        </View>

        {/* Pending Amount Card */}
        {stats.pendingAmount > 0 && (
          <View style={styles.pendingCard}>
            <MaterialIcons name="error-outline" size={20} color="#92400E" />
            <View style={styles.pendingContent}>
              <Text style={styles.pendingLabel}>Pending Amount</Text>
              <Text style={styles.pendingValue}>
                {formatCurrency(stats.pendingAmount)}
              </Text>
            </View>
          </View>
        )}

        {/* Recent Invoices */}
        {stats.recentInvoices.length > 0 && (
          <View style={styles.section}>
            
            
            {stats.recentInvoices.map((invoice) => {
              const statusStyle = getStatusStyle(invoice.status);
              return (
                <TouchableOpacity
                  key={invoice.id}
                  style={styles.invoiceItem}
                  onPress={() => navigation.navigate('InvoiceView', { invoiceId: invoice.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.invoiceLeft}>
                    <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
                    <Text style={styles.invoiceDate}>
                      {format(parseISO(invoice.date), 'MMM dd, yyyy')}
                    </Text>
                  </View>
                  <View style={styles.invoiceRight}>
                    <Text style={styles.invoiceAmount}>
                      {formatCurrency(invoice.total)}
                    </Text>
                    {invoice.currency && invoice.currency !== baseCurrency && (
                      <Text style={styles.exchangeRate}>
                         ({formatCurrency(invoice.base_amount || invoice.total)})
                      </Text>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.backgroundColor }]}>
                      <Text style={[styles.statusText, { color: statusStyle.color }]}>
                        {invoice.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('CreateInvoice', { clientId })}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              style={styles.actionGradient}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.actionText}>Create Invoice</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clientCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clientName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  contactInfo: {
    gap: 12,
    width: '100%',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  creditNote: {
    fontSize: 10,
    color: '#EF4444',
    marginTop: 2,
  },
  pendingCard: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingContent: {
    flex: 1,
  },
  pendingLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  pendingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 4,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  viewAll: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  invoiceItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  invoiceLeft: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  invoiceDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  exchangeRate: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  actions: {
    padding: 20,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});