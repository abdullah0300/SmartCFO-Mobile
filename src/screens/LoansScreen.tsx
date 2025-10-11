// src/screens/LoansScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../hooks/useAuth';
import { getLoans } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import { Colors, Spacing, BorderRadius } from '../constants/Colors';
import { calculateLoanProgress } from '../services/loanService';

interface Loan {
  id: string;
  loan_number: string;
  lender_name: string;
  vendor?: { id: string; name: string };
  principal_amount: number;
  current_balance: number;
  interest_rate: number;
  monthly_payment: number;
  term_months: number;
  status: 'active' | 'paid_off' | 'defaulted';
  start_date: string;
  payment_frequency: string;
}

export default function LoansScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data: loans, isLoading, refetch } = useQuery({
    queryKey: ['loans', user?.id],
    queryFn: () => getLoans(user!.id),
    enabled: !!user,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Calculate summary metrics
  const totalDebt = loans?.reduce((sum, loan) => sum + loan.current_balance, 0) || 0;
  const monthlyPayment = loans
    ?.filter((l) => l.status === 'active')
    .reduce((sum, loan) => sum + loan.monthly_payment, 0) || 0;
  const activeLoans = loans?.filter((l) => l.status === 'active').length || 0;

  // Filter loans based on search
  const filteredLoans = loans?.filter((loan) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      loan.loan_number?.toLowerCase().includes(query) ||
      loan.lender_name?.toLowerCase().includes(query) ||
      loan.vendor?.name?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#DC2626';
      case 'paid_off':
        return '#10B981';
      case 'defaulted':
        return '#991B1B';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return 'trending-up';
      case 'paid_off':
        return 'check-circle';
      case 'defaulted':
        return 'alert-circle';
      default:
        return 'help-outline';
    }
  };

  const renderLoanCard = ({ item: loan }: { item: Loan }) => {
    const progress = calculateLoanProgress(loan.principal_amount, loan.current_balance);
    const lenderName = loan.vendor?.name || loan.lender_name || 'Unknown Lender';

    return (
      <TouchableOpacity
        style={styles.loanCard}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('LoanDetail', { loanId: loan.id });
        }}
        activeOpacity={0.7}
      >
        <View style={styles.loanCardHeader}>
          <View style={styles.loanIconContainer}>
            <MaterialIcons name="account-balance" size={20} color="#DC2626" />
          </View>
          <View style={styles.loanHeaderInfo}>
            <Text style={styles.loanNumber}>{loan.loan_number}</Text>
            <Text style={styles.lenderName}>{lenderName}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(loan.status) + '15' },
            ]}
          >
            <MaterialIcons
              name={getStatusIcon(loan.status) as any}
              size={12}
              color={getStatusColor(loan.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(loan.status) }]}>
              {loan.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.loanAmounts}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Amount Left</Text>
            <Text style={styles.amountValue}>{formatCurrency(loan.current_balance)}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Total Loan</Text>
            <Text style={styles.amountValueSecondary}>
              {formatCurrency(loan.principal_amount)}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={['#DC2626', '#F59E0B', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{progress.toFixed(0)}% paid off</Text>
        </View>

        <View style={styles.loanFooter}>
          <View style={styles.footerItem}>
            <MaterialIcons name="payments" size={14} color="#6B7280" />
            <Text style={styles.footerText}>
              {formatCurrency(loan.monthly_payment)}/mo
            </Text>
          </View>
          <View style={styles.footerItem}>
            <MaterialIcons name="percent" size={14} color="#6B7280" />
            <Text style={styles.footerText}>{loan.interest_rate}% APR</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="account-balance" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Loans Yet</Text>
      <Text style={styles.emptyText}>
        Add your first loan to start tracking payments and balances
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('CreateLoan')}
      >
        <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.emptyButtonGradient}>
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.emptyButtonText}>Add First Loan</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.headerGradient}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerSubtitle}>Manage your</Text>
              <Text style={styles.headerTitle}>Loans</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
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
                  <Feather name={showSearch ? 'x' : 'search'} size={18} color="#DC2626" />
                </View>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('CreateLoan')}
            >
              <BlurView intensity={80} tint="light" style={styles.addButtonBlur}>
                <View style={styles.addButtonInner}>
                  <Feather name="plus" size={18} color="#DC2626" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Feather name="search" size={16} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search loans..."
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
      </LinearGradient>

      {/* KPI Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kpiContainer}
        style={styles.kpiScrollView}
      >
        <View style={styles.kpiCard}>
          <LinearGradient
            colors={['#DC2626', '#EF4444']}
            style={styles.kpiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconContainer}>
                <MaterialIcons name="account-balance" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>Total Debt</Text>
                <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(totalDebt)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.kpiCard}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={styles.kpiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconContainer}>
                <MaterialIcons name="payments" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>Monthly Payment</Text>
                <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(monthlyPayment)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.kpiCard}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.kpiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconContainer}>
                <MaterialIcons name="trending-up" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>Active Loans</Text>
                <Text style={styles.kpiValue}>{activeLoans}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* Loans List */}
      <FlatList
        data={filteredLoans}
        renderItem={renderLoanCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#DC2626"
          />
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerGradient: {
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  addButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  addButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 20,
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
  kpiScrollView: {
    marginTop: 16,
    flexGrow: 0,
    flexShrink: 0,
  },
  kpiContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 16,
  },
  kpiCard: {
    borderRadius: 20,
  },
  kpiGradient: {
    width: 180,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  kpiIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  kpiTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  loanCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  loanCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loanIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  loanHeaderInfo: {
    flex: 1,
  },
  loanNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  lenderName: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loanAmounts: {
    gap: 8,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
  amountValueSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  loanFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
