// src/screens/ReportsOverviewScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  Platform,
  FlatList,
  ViewToken,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format, subMonths, startOfYear, parseISO, differenceInDays } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../services/supabase';
import { getLoans } from '../services/api';
import { Spacing, BorderRadius } from '../constants/Colors';
import type { Settings } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 64; // 32px padding on each side
const TAX_CARD_WIDTH = (SCREEN_WIDTH - 56) / 2.3; // Smaller cards, 2+ visible with spacing

interface KPIMetrics {
  grossRevenue: number;
  creditNoteAmount: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  totalInvoiced: number;
  totalCollected: number;
  collectionRate: number;
  avgDaysToPayment: number;
  totalClients: number;
  activeClients: number;
  totalOutstanding: number;
  overdueAmount: number;
  taxCollected: number;
  taxPaid: number;
  revenueGrowth: number;
  expenseGrowth: number;
}

interface CategoryBreakdown {
  name: string;
  value: number;
  percentage: number;
  trend: number;
  count: number;
}

interface ClientMetrics {
  id: string;
  name: string;
  revenue: number;
  invoiceCount: number;
  avgInvoiceValue: number;
  outstandingAmount: number;
  lastActivity: string;
}

interface VendorSpending {
  id: string;
  name: string;
  totalSpent: number;
  expenseCount: number;
}

interface LoanSummary {
  id: string;
  loan_number: string;
  lender_name: string;
  principal_amount: number;
  current_balance: number;
  monthly_payment: number;
  interest_rate: number;
  status: string;
}

export default function ReportsOverviewScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { formatCurrency, baseCurrency, settings: userSettings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const [categoryView, setCategoryView] = useState<'income' | 'expense'>('income');
  const [activeKPIIndex, setActiveKPIIndex] = useState(0);
  const [activeTaxIndex, setActiveTaxIndex] = useState(0);

  // Custom date range
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Refs
  const kpiListRef = useRef<FlatList>(null);
  const taxListRef = useRef<FlatList>(null);

  // Data states
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetrics>({
    grossRevenue: 0,
    creditNoteAmount: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    totalInvoiced: 0,
    totalCollected: 0,
    collectionRate: 0,
    avgDaysToPayment: 0,
    totalClients: 0,
    activeClients: 0,
    totalOutstanding: 0,
    overdueAmount: 0,
    taxCollected: 0,
    taxPaid: 0,
    revenueGrowth: 0,
    expenseGrowth: 0,
  });

  const [categoryData, setCategoryData] = useState<{
    income: CategoryBreakdown[];
    expense: CategoryBreakdown[];
  }>({ income: [], expense: [] });

  const [clientMetrics, setClientMetrics] = useState<ClientMetrics[]>([]);
  const [topVendors, setTopVendors] = useState<VendorSpending[]>([]);
  const [loans, setLoans] = useState<LoanSummary[]>([]);

  const periods = [
    { id: '1month', label: '1M' },
    { id: '3months', label: '3M' },
    { id: '6months', label: '6M' },
    { id: '1year', label: '1Y' },
    { id: 'ytd', label: 'YTD' },
    { id: 'custom', label: 'Custom' },
  ];

  useEffect(() => {
    loadReportData();
  }, [selectedPeriod, customStartDate, customEndDate]);

  const loadReportData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Calculate date range
      const endDate = new Date();
      let startDate;
      let comparisonStartDate;

      switch (selectedPeriod) {
        case '1month':
          startDate = subMonths(endDate, 1);
          comparisonStartDate = subMonths(startDate, 1);
          break;
        case '3months':
          startDate = subMonths(endDate, 3);
          comparisonStartDate = subMonths(startDate, 3);
          break;
        case '6months':
          startDate = subMonths(endDate, 6);
          comparisonStartDate = subMonths(startDate, 6);
          break;
        case '1year':
          startDate = subMonths(endDate, 12);
          comparisonStartDate = subMonths(startDate, 12);
          break;
        case 'ytd':
          startDate = startOfYear(endDate);
          comparisonStartDate = startOfYear(subMonths(endDate, 12));
          break;
        case 'custom':
          if (!customStartDate || !customEndDate) {
            setLoading(false);
            return;
          }
          startDate = parseISO(customStartDate);
          const daysDiff = differenceInDays(parseISO(customEndDate), startDate);
          comparisonStartDate = subMonths(startDate, Math.ceil(daysDiff / 30));
          endDate.setTime(parseISO(customEndDate).getTime());
          break;
        default:
          startDate = subMonths(endDate, 6);
          comparisonStartDate = subMonths(startDate, 6);
      }

      // Call edge function
      const { data: reportData, error } = await supabase.functions.invoke('generate-report-data', {
        body: {
          userId: user.id,
          period: selectedPeriod,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          comparisonStartDate: format(comparisonStartDate, 'yyyy-MM-dd'),
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!reportData?.data) {
        throw new Error('No data returned from edge function');
      }

      // Set all state with processed data
      const { data } = reportData;
      setKpiMetrics(data.kpiMetrics);
      setCategoryData(data.categoryData);
      setClientMetrics(data.clientMetrics || []);
      setTopVendors(data.topVendors || []);

      // Fetch loans data separately
      const loansData = await getLoans(user.id);
      setLoans(loansData || []);

    } catch (err: any) {
      console.error('Error loading report data:', err);
      Alert.alert('Error', 'Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const handlePeriodChange = (periodId: string) => {
    if (periodId === 'custom') {
      setShowCustomDateModal(true);
    } else {
      setSelectedPeriod(periodId);
    }
  };

  const applyCustomDateRange = () => {
    if (!customStartDate || !customEndDate) {
      Alert.alert('Error', 'Please select both start and end dates');
      return;
    }
    if (new Date(customStartDate) > new Date(customEndDate)) {
      Alert.alert('Error', 'Start date cannot be after end date');
      return;
    }
    setSelectedPeriod('custom');
    setShowCustomDateModal(false);
  };

  const exportToCSV = async () => {
    try {
      // Create CSV content
      let csvContent = 'Category,Type,Amount,Percentage,Count\n';

      // Add income categories
      categoryData.income.forEach(cat => {
        csvContent += `${cat.name},Income,${cat.value},${cat.percentage.toFixed(2)}%,${cat.count}\n`;
      });

      // Add expense categories
      categoryData.expense.forEach(cat => {
        csvContent += `${cat.name},Expense,${cat.value},${cat.percentage.toFixed(2)}%,${cat.count}\n`;
      });

      // Add summary
      csvContent += '\nSummary\n';
      csvContent += `Total Revenue,${kpiMetrics.totalRevenue}\n`;
      csvContent += `Total Expenses,${kpiMetrics.totalExpenses}\n`;
      csvContent += `Net Profit,${kpiMetrics.netProfit}\n`;
      csvContent += `Profit Margin,${kpiMetrics.profitMargin.toFixed(2)}%\n`;

      // Save file
      const fileName = `report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', 'Report saved to documents');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export report');
    }
  };

  const exportToPDF = () => {
    Alert.alert(
      'PDF Export',
      'PDF export is available on the web dashboard. Would you like to open it?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Web', onPress: handleOpenWebDashboard },
      ]
    );
  };

  const handleOpenWebDashboard = async () => {
    const url = 'https://smartcfo.webcraftio.com/reports';
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Alert.alert('Error', 'Unable to open web dashboard');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open web dashboard');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setActiveKPIIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const onTaxViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setActiveTaxIndex(viewableItems[0].index || 0);
    }
  }).current;

  // KPI Cards data
  const kpiCards = [
    {
      id: 'profit',
      title: 'Net Profit',
      value: kpiMetrics.netProfit,
      subtitle: kpiMetrics.netProfit >= 0 ? 'Profitable' : 'Loss',
      badge: `${kpiMetrics.profitMargin.toFixed(1)}%`,
      icon: 'account-balance-wallet',
      colors: kpiMetrics.netProfit >= 0 ? ['#6366F1', '#4F46E5'] : ['#9CA3AF', '#6B7280'],
    },
    {
      id: 'revenue',
      title: 'Revenue',
      value: kpiMetrics.totalRevenue,
      subtitle: kpiMetrics.creditNoteAmount > 0 ? `${kpiMetrics.collectionRate.toFixed(0)}% collected` : '',
      badge: kpiMetrics.revenueGrowth !== 0 ? `${kpiMetrics.revenueGrowth > 0 ? '+' : ''}${kpiMetrics.revenueGrowth.toFixed(1)}%` : null,
      badgeColor: kpiMetrics.revenueGrowth > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.25)',
      icon: 'trending-up',
      colors: ['#10B981', '#059669'],
    },
    {
      id: 'expenses',
      title: 'Expenses',
      value: kpiMetrics.totalExpenses,
      subtitle: `${categoryData.expense.length} categories`,
      badge: kpiMetrics.expenseGrowth !== 0 ? `${kpiMetrics.expenseGrowth > 0 ? '+' : ''}${kpiMetrics.expenseGrowth.toFixed(1)}%` : null,
      badgeColor: 'rgba(255,255,255,0.25)',
      icon: 'trending-down',
      colors: ['#EF4444', '#DC2626'],
    },
    {
      id: 'outstanding',
      title: 'Outstanding',
      value: kpiMetrics.totalOutstanding,
      subtitle: `${kpiMetrics.avgDaysToPayment.toFixed(0)} days avg`,
      badge: kpiMetrics.overdueAmount > 0 ? 'Overdue' : null,
      badgeColor: 'rgba(239,68,68,0.3)',
      icon: 'receipt-long',
      colors: ['#F59E0B', '#D97706'],
    },
    {
      id: 'clients',
      title: 'Clients',
      value: kpiMetrics.totalClients,
      subtitle: `${kpiMetrics.activeClients} active`,
      badge: null,
      icon: 'people',
      colors: ['#8B5CF6', '#7C3AED'],
      isNumber: true,
    },
    {
      id: 'tax',
      title: 'Tax (Net)',
      value: kpiMetrics.taxCollected - kpiMetrics.taxPaid,
      subtitle: 'To remit',
      badge: null,
      icon: 'calculate',
      colors: ['#06B6D4', '#0891B2'],
    },
  ];

  const renderKPICard = ({ item }: { item: typeof kpiCards[0] }) => (
    <View style={styles.kpiCardWrapper}>
      <LinearGradient
        colors={item.colors}
        style={styles.kpiCard}
      >
        <View style={styles.kpiCardHeader}>
          <View style={styles.kpiIconContainer}>
            <MaterialIcons name={item.icon as any} size={24} color="#FFFFFF" />
          </View>
          {item.badge && (
            <View style={[styles.kpiBadge, item.badgeColor ? { backgroundColor: item.badgeColor } : {}]}>
              <Text style={styles.kpiBadgeText}>{item.badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.kpiLabel}>{item.title}</Text>
        <Text style={styles.kpiValue}>
          {item.isNumber ? item.value : formatCurrency(item.value)}
        </Text>
        {item.subtitle && (
          <Text style={styles.kpiSubtext}>{item.subtitle}</Text>
        )}
      </LinearGradient>
    </View>
  );

  // Tax Cards data
  const taxCards = [
    {
      id: 'collected',
      title: 'Collected',
      value: kpiMetrics.taxCollected,
      subtitle: 'From sales',
      icon: 'receipt',
      color: '#3B82F6',
    },
    {
      id: 'paid',
      title: 'Paid',
      value: kpiMetrics.taxPaid,
      subtitle: 'On expenses',
      icon: 'payment',
      color: '#8B5CF6',
    },
    {
      id: 'net',
      title: 'Net Tax',
      value: kpiMetrics.taxCollected - kpiMetrics.taxPaid,
      subtitle: 'To remit',
      icon: 'account-balance',
      color: '#10B981',
    },
    {
      id: 'rate',
      title: 'Avg Rate',
      value: kpiMetrics.totalRevenue > 0
        ? ((kpiMetrics.taxCollected / kpiMetrics.totalRevenue) * 100).toFixed(1)
        : '0',
      subtitle: 'Effective rate',
      icon: 'percent',
      color: '#F59E0B',
      isPercentage: true,
    },
  ];

  const renderTaxCard = ({ item }: { item: typeof taxCards[0] }) => (
    <View style={styles.taxCardWrapper}>
      <LinearGradient
        colors={[item.color + '08', item.color + '12']}
        style={styles.taxCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.taxIconBadge, { backgroundColor: item.color }]}>
          <MaterialIcons name={item.icon as any} size={16} color="#FFFFFF" />
        </View>
        <Text style={styles.taxCardTitle}>{item.title}</Text>
        <Text style={styles.taxCardValue}>
          {item.isPercentage ? `${item.value}%` : formatCurrency(item.value as number)}
        </Text>
        <Text style={styles.taxCardSubtitle}>{item.subtitle}</Text>
      </LinearGradient>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Financial Reports</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading report data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Financial Reports</Text>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Export Report',
                'Choose export format',
                [
                  { text: 'CSV', onPress: exportToCSV },
                  { text: 'PDF', onPress: exportToPDF },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
            style={styles.exportButton}
          >
            <Feather name="download" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B5CF6"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Period Selector */}
        <View style={styles.periodContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.periodScroll}
          >
            {periods.map(period => (
              <TouchableOpacity
                key={period.id}
                onPress={() => handlePeriodChange(period.id)}
                style={[
                  styles.periodButton,
                  selectedPeriod === period.id && styles.periodButtonActive,
                ]}
              >
                <Text style={[
                  styles.periodText,
                  selectedPeriod === period.id && styles.periodTextActive,
                ]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* KPI Metrics Carousel */}
        <View style={styles.metricsContainer}>
          <FlatList
            ref={kpiListRef}
            data={kpiCards}
            renderItem={renderKPICard}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 16}
            decelerationRate="fast"
            contentContainerStyle={styles.kpiCarousel}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />

          {/* Pagination Dots */}
          <View style={styles.paginationDots}>
            {kpiCards.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  activeKPIIndex === index && styles.dotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Category Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Breakdown</Text>

          <View style={styles.categoryToggle}>
            <TouchableOpacity
              onPress={() => setCategoryView('income')}
              style={[
                styles.toggleButton,
                categoryView === 'income' && styles.toggleButtonActive,
                { backgroundColor: categoryView === 'income' ? '#D1FAE5' : '#F3F4F6' }
              ]}
            >
              <MaterialIcons
                name="trending-up"
                size={14}
                color={categoryView === 'income' ? '#059669' : '#6B7280'}
              />
              <Text style={[
                styles.toggleText,
                { color: categoryView === 'income' ? '#059669' : '#6B7280' }
              ]}>
                Income
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setCategoryView('expense')}
              style={[
                styles.toggleButton,
                categoryView === 'expense' && styles.toggleButtonActive,
                { backgroundColor: categoryView === 'expense' ? '#FEE2E2' : '#F3F4F6' }
              ]}
            >
              <MaterialIcons
                name="trending-down"
                size={14}
                color={categoryView === 'expense' ? '#DC2626' : '#6B7280'}
              />
              <Text style={[
                styles.toggleText,
                { color: categoryView === 'expense' ? '#DC2626' : '#6B7280' }
              ]}>
                Expenses
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.categoryList}>
            {(categoryView === 'income' ? categoryData.income : categoryData.expense)
              .slice(0, 5)
              .map((category, index) => {
                const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
                return (
                  <View key={category.name} style={styles.categoryItem}>
                    <View style={styles.categoryLeft}>
                      <View style={[styles.categoryDot, { backgroundColor: colors[index] }]} />
                      <View style={styles.categoryInfo}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <Text style={styles.categoryCount}>
                          {category.count} transaction{category.count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.categoryRight}>
                      <Text style={styles.categoryValue}>{formatCurrency(category.value)}</Text>
                      <Text style={styles.categoryPercent}>{category.percentage.toFixed(1)}%</Text>
                    </View>
                  </View>
                );
              })}
          </View>
        </View>

        {/* Top Clients */}
        {clientMetrics.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Clients</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Clients' as never)}>
                <Text style={styles.viewAll}>View all →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.clientList}>
              {clientMetrics.slice(0, 5).map((client, index) => {
                const colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
                return (
                  <View key={client.id} style={styles.clientItem}>
                    <View style={[styles.clientAvatar, { backgroundColor: colors[index] }]}>
                      <Text style={styles.clientInitial}>
                        {client.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{client.name}</Text>
                      <Text style={styles.clientInvoices}>
                        {client.invoiceCount} invoice{client.invoiceCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.clientRight}>
                      <Text style={styles.clientRevenue}>{formatCurrency(client.revenue)}</Text>
                      {client.outstandingAmount > 0 && (
                        <Text style={styles.clientOutstanding}>
                          {formatCurrency(client.outstandingAmount)} due
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Top Vendors */}
        {topVendors.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Vendors</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Vendors' as never)}>
                <Text style={styles.viewAll}>View all →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.vendorList}>
              {topVendors.map((vendor, index) => {
                const gradients = [
                  ['#8B5CF6', '#7C3AED'],
                  ['#3B82F6', '#2563EB'],
                  ['#10B981', '#059669'],
                  ['#F59E0B', '#D97706'],
                  ['#EF4444', '#DC2626'],
                ];
                return (
                  <LinearGradient
                    key={vendor.id}
                    colors={gradients[index] || gradients[0]}
                    style={styles.vendorItem}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.vendorRank}>
                      <Text style={styles.vendorRankText}>#{index + 1}</Text>
                    </View>
                    <View style={styles.vendorInfo}>
                      <Text style={styles.vendorName}>{vendor.name}</Text>
                      <Text style={styles.vendorCount}>
                        {vendor.expenseCount} transaction{vendor.expenseCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={styles.vendorAmount}>{formatCurrency(vendor.totalSpent)}</Text>
                  </LinearGradient>
                );
              })}
            </View>
          </View>
        )}

        {/* Tax/VAT Analysis */}
        <View style={styles.taxSection}>
          <Text style={styles.sectionTitle}>
            {userSettings?.country === 'GB' ? 'VAT Analysis' : 'Tax Analysis'}
          </Text>

          <FlatList
            ref={taxListRef}
            data={taxCards}
            renderItem={renderTaxCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.taxCarousel}
            snapToInterval={TAX_CARD_WIDTH + 10}
            decelerationRate="fast"
            onViewableItemsChanged={onTaxViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
        </View>

        {/* Loans Overview */}
        {loans.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Loans Overview</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Loans' as never)}>
                <Text style={styles.viewAll}>View all →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.loansList}>
              {/* Summary Card */}
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                style={styles.loansSummaryCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.loansSummaryRow}>
                  <View style={styles.loansSummaryItem}>
                    <Text style={styles.loansSummaryLabel}>Total Debt</Text>
                    <Text style={styles.loansSummaryValue}>
                      {formatCurrency(loans.reduce((sum, loan) => sum + loan.current_balance, 0))}
                    </Text>
                  </View>
                  <View style={styles.loansSummaryDivider} />
                  <View style={styles.loansSummaryItem}>
                    <Text style={styles.loansSummaryLabel}>Monthly Payment</Text>
                    <Text style={styles.loansSummaryValue}>
                      {formatCurrency(
                        loans
                          .filter((l) => l.status === 'active')
                          .reduce((sum, loan) => sum + loan.monthly_payment, 0)
                      )}
                    </Text>
                  </View>
                </View>
                <View style={styles.loansCount}>
                  <MaterialIcons name="account-balance" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.loansCountText}>
                    {loans.length} loan{loans.length !== 1 ? 's' : ''} • {loans.filter(l => l.status === 'active').length} active
                  </Text>
                </View>
              </LinearGradient>

              {/* Individual Loans */}
              {loans.slice(0, 3).map((loan) => {
                const progress = ((loan.principal_amount - loan.current_balance) / loan.principal_amount) * 100;
                return (
                  <TouchableOpacity
                    key={loan.id}
                    style={styles.loanCard}
                    onPress={() => navigation.navigate('LoanDetail' as never, { loanId: loan.id } as never)}
                  >
                    <View style={styles.loanCardHeader}>
                      <View style={styles.loanCardLeft}>
                        <View style={styles.loanIconBadge}>
                          <MaterialIcons name="account-balance" size={16} color="#DC2626" />
                        </View>
                        <View>
                          <Text style={styles.loanCardNumber}>{loan.loan_number}</Text>
                          <Text style={styles.loanCardLender}>{loan.lender_name}</Text>
                        </View>
                      </View>
                      <View style={styles.loanCardRight}>
                        <Text style={styles.loanCardBalance}>{formatCurrency(loan.current_balance)}</Text>
                        <Text style={styles.loanCardLabel}>Amount Left</Text>
                      </View>
                    </View>
                    <View style={styles.loanProgressBar}>
                      <View style={styles.loanProgressTrack}>
                        <LinearGradient
                          colors={['#DC2626', '#F59E0B', '#10B981']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.loanProgressFill, { width: `${progress}%` }]}
                        />
                      </View>
                      <Text style={styles.loanProgressText}>{progress.toFixed(0)}% paid</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleOpenWebDashboard}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.floatingButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Feather name="external-link" size={20} color="#FFFFFF" />
          <Text style={styles.floatingButtonText}>Open in Web Dashboard</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Custom Date Range Modal */}
      <Modal
        visible={showCustomDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Date Range</Text>
              <TouchableOpacity onPress={() => setShowCustomDateModal(false)}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.dateInputs}>
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>Start Date</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  value={customStartDate}
                  onChangeText={setCustomStartDate}
                />
              </View>

              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>End Date</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  value={customEndDate}
                  onChangeText={setCustomEndDate}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setShowCustomDateModal(false);
                }}
              >
                <Text style={styles.modalButtonCancelText}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalButtonApply}
                onPress={applyCustomDateRange}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonApplyText}>Apply</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingBottom: 100,
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
  exportButton: {
    padding: Spacing.sm,
    marginRight: -Spacing.sm,
  },
  periodContainer: {
    paddingVertical: Spacing.md,
  },
  periodScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  periodButtonActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#8B5CF6',
  },
  periodText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  metricsContainer: {
    marginBottom: Spacing.lg,
  },
  kpiCarousel: {
    paddingHorizontal: 32,
    gap: 16,
  },
  kpiCardWrapper: {
    width: CARD_WIDTH,
  },
  kpiCard: {
    padding: 20,
    borderRadius: BorderRadius.lg,
    minHeight: 160,
  },
  kpiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  kpiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  kpiBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  kpiLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    fontWeight: '500',
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  kpiSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#8B5CF6',
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  viewAll: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  categoryToggle: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  toggleButtonActive: {
    // backgroundColor set dynamically
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryList: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  categoryCount: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryPercent: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  clientList: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  clientInvoices: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  clientRight: {
    alignItems: 'flex-end',
  },
  clientRevenue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  clientOutstanding: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 2,
  },
  taxSection: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  taxCarousel: {
    paddingLeft: 0,
    paddingVertical: 4,
    gap: 10,
  },
  taxCardWrapper: {
    width: TAX_CARD_WIDTH,
  },
  taxCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  taxIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  taxCardTitle: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  taxCardValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  taxCardSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '400',
  },
  vendorList: {
    gap: Spacing.sm,
  },
  vendorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  vendorRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vendorRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  vendorCount: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  vendorAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  dateInputs: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dateField: {
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: BorderRadius.md,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButtonCancel: {
    flex: 1,
    padding: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalButtonApply: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    padding: 14,
    alignItems: 'center',
  },
  modalButtonApplyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Floating Action Button Styles
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  floatingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  // Loans Widget Styles
  loansList: {
    gap: Spacing.sm,
  },
  loansSummaryCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  loansSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loansSummaryItem: {
    flex: 1,
  },
  loansSummaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 12,
  },
  loansSummaryLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  loansSummaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loansCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loansCountText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  loanCard: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  loanCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  loanCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  loanIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loanCardNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  loanCardLender: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  loanCardRight: {
    alignItems: 'flex-end',
  },
  loanCardBalance: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
  loanCardLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  loanProgressBar: {
    gap: 6,
  },
  loanProgressTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  loanProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  loanProgressText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
});
