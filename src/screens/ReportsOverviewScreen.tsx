// src/screens/ReportsOverviewScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format, subMonths, startOfMonth, startOfYear } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';

import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../services/supabase';
import { Spacing, BorderRadius } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReportsOverviewScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
  });

  const periods = [
    { id: 'month', label: 'This Month' },
    { id: '3months', label: '3 Months' },
    { id: '6months', label: '6 Months' },
    { id: 'year', label: '1 Year' },
  ];

  useEffect(() => {
    loadReportData();
  }, [selectedPeriod]);

  const loadReportData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get date range
      const endDate = new Date();
      let startDate;
      
      switch (selectedPeriod) {
        case 'month':
          startDate = startOfMonth(endDate);
          break;
        case '3months':
          startDate = subMonths(endDate, 3);
          break;
        case '6months':
          startDate = subMonths(endDate, 6);
          break;
        case 'year':
          startDate = subMonths(endDate, 12);
          break;
        default:
          startDate = subMonths(endDate, 6);
      }
      
      // Load data
      const [incomeRes, expenseRes] = await Promise.all([
        supabase
          .from('income')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
        supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
      ]);
      
      const incomes = incomeRes.data || [];
      const expenses = expenseRes.data || [];
      
      // Calculate metrics
      const totalRevenue = incomes.reduce((sum, inc) => 
        sum + (inc.base_amount || inc.amount), 0);
      const totalExpenses = expenses.reduce((sum, exp) => 
        sum + (exp.base_amount || exp.amount), 0);
      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      
      setMetrics({
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
      });
      
      // Process monthly data
      processMonthlyData(incomes, expenses);
      
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processMonthlyData = (incomes: any[], expenses: any[]) => {
    const monthlyMap = new Map();
    const monthsToShow = selectedPeriod === 'month' ? 1 : 
                         selectedPeriod === '3months' ? 3 : 
                         selectedPeriod === '6months' ? 6 : 12;
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthKey = format(date, 'MMM');
      monthlyMap.set(monthKey, { income: 0, expenses: 0 });
    }
    
    incomes.forEach(inc => {
      const monthKey = format(new Date(inc.date), 'MMM');
      if (monthlyMap.has(monthKey)) {
        const current = monthlyMap.get(monthKey);
        current.income += inc.base_amount || inc.amount;
      }
    });
    
    expenses.forEach(exp => {
      const monthKey = format(new Date(exp.date), 'MMM');
      if (monthlyMap.has(monthKey)) {
        const current = monthlyMap.get(monthKey);
        current.expenses += exp.base_amount || exp.amount;
      }
    });
    
    setMonthlyData(Array.from(monthlyMap.entries()).map(([month, values]) => ({
      month,
      ...values,
    })));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#3B82F6', '#8B5CF6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Reports</Text>
          
          <TouchableOpacity
            onPress={() => Linking.openURL('https://yourdomain.com/reports')}
            style={styles.webButton}
          >
            <Feather name="external-link" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selector */}
        <View style={styles.periodContainer}>
          {periods.map(period => (
            <TouchableOpacity
              key={period.id}
              onPress={() => setSelectedPeriod(period.id)}
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
        </View>

        {/* Main Metrics */}
        <View style={styles.metricsContainer}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.metricCard}
          >
            <View style={styles.metricIcon}>
              <MaterialIcons name="trending-up" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.metricLabel}>Revenue</Text>
            <Text style={styles.metricValue}>{formatCurrency(metrics.totalRevenue)}</Text>
          </LinearGradient>

          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.metricCard}
          >
            <View style={styles.metricIcon}>
              <MaterialIcons name="trending-down" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.metricLabel}>Expenses</Text>
            <Text style={styles.metricValue}>{formatCurrency(metrics.totalExpenses)}</Text>
          </LinearGradient>
        </View>

        {/* Profit Card */}
        <View style={styles.profitCard}>
          <LinearGradient
            colors={metrics.netProfit >= 0 ? ['#6366F1', '#4F46E5'] : ['#9CA3AF', '#6B7280']}
            style={styles.profitGradient}
          >
            <View style={styles.profitHeader}>
              <View>
                <Text style={styles.profitLabel}>Net Profit</Text>
                <Text style={styles.profitValue}>
                  {formatCurrency(Math.abs(metrics.netProfit))}
                </Text>
              </View>
              <View style={styles.profitBadge}>
                <Text style={styles.profitBadgeText}>
                  {metrics.profitMargin >= 0 ? '+' : ''}{metrics.profitMargin.toFixed(1)}%
                </Text>
              </View>
            </View>
            {metrics.netProfit < 0 && (
              <Text style={styles.profitWarning}>Operating at a loss</Text>
            )}
          </LinearGradient>
        </View>

        {/* Chart */}
        {monthlyData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Monthly Trend</Text>
            <LineChart
              data={{
                labels: monthlyData.map(d => d.month),
                datasets: [
                  {
                    data: monthlyData.map(d => d.income),
                    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                    strokeWidth: 3,
                  },
                  {
                    data: monthlyData.map(d => d.expenses),
                    color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                    strokeWidth: 3,
                  },
                ],
              }}
              width={SCREEN_WIDTH - 40}
              height={200}
              chartConfig={{
                backgroundColor: '#FFFFFF',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                propsForDots: {
                  r: '5',
                  strokeWidth: '2',
                  stroke: '#FFFFFF',
                },
              }}
              bezier
              style={styles.chart}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={false}
            />
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>Revenue</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>Expenses</Text>
              </View>
            </View>
          </View>
        )}

        {/* Web Dashboard CTA */}
        <TouchableOpacity 
          style={styles.ctaCard}
          onPress={() => Linking.openURL('https://yourdomain.com/reports')}
        >
          <LinearGradient
            colors={['#F3F4F6', '#E5E7EB']}
            style={styles.ctaGradient}
          >
            <MaterialIcons name="monitor" size={24} color="#6B7280" />
            <View style={styles.ctaContent}>
              <Text style={styles.ctaTitle}>Need detailed analytics?</Text>
              <Text style={styles.ctaSubtitle}>
                Open web dashboard for full reports, custom date ranges, and export options
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  webButton: {
    padding: Spacing.sm,
    marginRight: -Spacing.sm,
  },
  periodContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  periodButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  periodText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#6366F1',
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profitCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  profitGradient: {
    padding: Spacing.lg,
  },
  profitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  profitLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  profitValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profitBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  profitBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profitWarning: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: Spacing.md,
  },
  chart: {
    marginLeft: -20,
    borderRadius: 8,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  ctaCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  ctaContent: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  ctaSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
});