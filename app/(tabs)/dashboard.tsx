import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather, Ionicons , MaterialIcons} from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../../src/hooks/useAuth';
import { useSettings } from '../../src/contexts/SettingsContext';
import { getDashboardData, getIncomes, getExpenses, getNotifications, getProfile } from '../../src/services/api';
import { getAIInsights } from '../../src/services/aiInsightsService';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/Colors';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { AIInsightsModal } from '../../src/components/dashboard/AIInsightsModal';

const { width } = Dimensions.get('window');

// Navigation types
type TabParamList = {
  Dashboard: undefined;
  Income: undefined;
  Expenses: undefined;
  Invoices: undefined;
  Profile: undefined;
  Notifications: undefined;
};

type DashboardNavigationProp = BottomTabNavigationProp<TabParamList, 'Dashboard'>;

// Dynamic Greeting Component
const DynamicGreeting = ({ userName }: { userName: string }) => {
  const [greeting, setGreeting] = useState('');
  
  useEffect(() => {
    const hour = new Date().getHours();
    const name = userName || 'there';
    
    if (hour < 5) {
      setGreeting(`Still working, ${name}? 🌙`);
    } else if (hour < 12) {
      setGreeting(`Good morning, ${name} ☀️`);
    } else if (hour < 17) {
      setGreeting(`Good afternoon, ${name} 👋`);
    } else if (hour < 21) {
      setGreeting(`Good evening, ${name} 🌆`);
    } else {
      setGreeting(`Working late, ${name}? 🌃`);
    }
  }, [userName]);

  return <Text style={styles.greeting}>{greeting}</Text>;
};

// Recent Transaction Component
const RecentTransaction = ({ item, type }: { item: any; type: 'income' | 'expense' }) => {
  const { formatCurrency } = useSettings();
  const isIncome = type === 'income';
  // Calculate total with tax
  const displayAmount = item.amount + (item.tax_amount || 0);
  
  return (
    <TouchableOpacity style={styles.transactionItem} activeOpacity={0.7}>
      <View style={styles.transactionLeft}>
        <View style={[
          styles.transactionIcon,
          { backgroundColor: isIncome ? '#E8F5E9' : '#FFEBEE' }
        ]}>
          <Feather 
            name={isIncome ? 'trending-up' : 'trending-down'} 
            size={18} 
            color={isIncome ? Colors.light.success : Colors.light.error} 
          />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.transactionDate}>
            {format(new Date(item.date), 'MMM dd, yyyy')}
          </Text>
        </View>
      </View>
      <Text style={[
        styles.transactionAmount,
        { color: isIncome ? Colors.light.success : Colors.light.text }
      ]}>
        {isIncome ? '+' : ''}{formatCurrency(displayAmount)}
      </Text>
    </TouchableOpacity>
  );
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const navigation = useNavigation<DashboardNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  // Check network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Queries with offline support
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      try {
        const data = await getProfile(user!.id);
        await AsyncStorage.setItem('@profile_cache', JSON.stringify(data));
        return data;
      } catch (error) {
        const cached = await AsyncStorage.getItem('@profile_cache');
        if (cached) return JSON.parse(cached);
        throw error;
      }
    },
    enabled: !!user,
  });

  const { data: dashboardData, isLoading, refetch } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: async () => {
      try {
        const data = await getDashboardData(user!.id);
        await AsyncStorage.setItem('@dashboard_cache', JSON.stringify(data));
        return data;
      } catch (error) {
        const cached = await AsyncStorage.getItem('@dashboard_cache');
        if (cached) return JSON.parse(cached);
        throw error;
      }
    },
    enabled: !!user,
  });

  const { data: recentIncomes } = useQuery({
    queryKey: ['recent-incomes', user?.id],
    queryFn: () => getIncomes(user!.id, 3),
    enabled: !!user,
  });

  const { data: recentExpenses } = useQuery({
    queryKey: ['recent-expenses', user?.id],
    queryFn: () => getExpenses(user!.id, 3),
    enabled: !!user,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => getNotifications(user!.id),
    enabled: !!user,
  });

 const { data: aiInsights, isLoading: aiLoading, refetch: refetchInsights } = useQuery({
  queryKey: ['ai-insights', user?.id],
  queryFn: async () => {
    if (!user?.id) return [];
    return await getAIInsights(user.id);
  },
  enabled: !!user && showAIInsights,
  retry: 1, // Only retry once
});

const handleRefreshInsights = async () => {
  await refetchInsights();
};

const handleOpenInsights = async () => {
  setShowAIInsights(true);
  // Refetch when opening
  if (user?.id) {
    await refetchInsights();
  }
};

  useEffect(() => {
    if (notifications) {
      const unreadCount = notifications.filter((n: any) => !n.is_read).length;
      setNotificationCount(unreadCount);
    }
  }, [notifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Combine and sort recent transactions
  const recentTransactions = [
    ...(recentIncomes?.map(item => ({ ...item, type: 'income' })) || []),
    ...(recentExpenses?.map(item => ({ ...item, type: 'expense' })) || [])
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const netProfit = (dashboardData?.totalIncome || 0) - (dashboardData?.totalExpenses || 0);
  const userName = profile?.full_name?.split(' ')[0] || profile?.first_name || 'there';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Offline Banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Feather name="wifi-off" size={16} color="#FFFFFF" />
            <Text style={styles.offlineText}>You're offline - showing cached data</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <DynamicGreeting userName={userName} />
            <Text style={styles.date}>{format(new Date(), 'EEEE, MMM d')}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Feather name="bell" size={22} color={Colors.light.text} />
              {notificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              {profile?.company_logo ? (
                <Image 
                  source={{ uri: profile.company_logo }} 
                  style={styles.profileImage}
                  resizeMode="contain"
                />
              ) : (
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6'] as const}
                  style={styles.profileGradient}
                >
                  <Text style={styles.profileInitial}>
                    {userName[0]?.toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Insights Card */}
        <TouchableOpacity onPress={() => setShowAIInsights(true)} activeOpacity={0.8}>
          <LinearGradient
            colors={['#3B82F6', '#8B5CF6'] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiCard}
          >
            <View style={styles.aiCardContent}>
              <View style={styles.aiCardLeft}>
                <Ionicons name="sparkles" size={24} color="#FFFFFF" />
                <View style={styles.aiCardText}>
                  <Text style={styles.aiCardTitle}>AI Insights Ready</Text>
                  <Text style={styles.aiCardSubtitle}>
                    See what SmartCFO discovered for you
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.checkNowButton} onPress={() => setShowAIInsights(true)}>
                <Text style={styles.checkNowText}>Check Now</Text>
                <Feather name="arrow-right" size={16} color="#3B82F6" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Monthly Overview Card */}
        <LinearGradient
          colors={['#4F46E5', '#7C3AED'] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.overviewCard}
        >
          <View style={styles.overviewPattern}>
            <Text style={styles.overviewTitle}>Monthly Overview</Text>
            <Text style={styles.overviewLabel}>Net Profit</Text>
            <Text style={[
              styles.overviewValue,
              { color: netProfit >= 0 ? '#FFFFFF' : '#FCA5A5' }
            ]}>
              {netProfit >= 0 ? '' : '-'}{formatCurrency(Math.abs(netProfit))}
            </Text>
            
            <View style={styles.overviewStatsContainer}>
              <View style={styles.overviewStat}>
                <Feather name="trending-up" size={18} color="#10B981" />
                <Text style={styles.overviewStatLabel}>Income</Text>
                <Text style={styles.overviewStatValue}>
                  {formatCurrency(dashboardData?.totalIncome || 0)}
                </Text>
              </View>
              
              <View style={styles.overviewDivider} />
              
              <View style={styles.overviewStat}>
                <Feather name="trending-down" size={18} color="#EF4444" />
                <Text style={styles.overviewStatLabel}>Expenses</Text>
                <Text style={styles.overviewStatValue}>
                  {formatCurrency(dashboardData?.totalExpenses || 0)}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Metrics Grid - Updated Design */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricRow}>
            <TouchableOpacity style={[styles.metricCard, styles.incomeCard]} activeOpacity={0.7}>
              <View style={styles.metricHeader}>
                <Feather name="trending-up" size={20} color="#10B981" />
                <View style={styles.trendBadge}>
                  <Feather name="trending-up" size={12} color="#10B981" />
                  <Text style={[styles.trendValue, { color: '#10B981' }]}>12%</Text>
                </View>
              </View>
              <Text style={styles.metricTitle}>Income</Text>
              <Text style={styles.metricValue}>{formatCurrency(dashboardData?.totalIncome || 0)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.metricCard, styles.expenseCard]} activeOpacity={0.7}>
              <View style={styles.metricHeader}>
                <Feather name="trending-down" size={20} color="#EF4444" />
                <View style={styles.trendBadge}>
                  <Feather name="trending-down" size={12} color="#EF4444" />
                  <Text style={[styles.trendValue, { color: '#EF4444' }]}>5%</Text>
                </View>
              </View>
              <Text style={styles.metricTitle}>Expenses</Text>
              <Text style={styles.metricValue}>{formatCurrency(dashboardData?.totalExpenses || 0)}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metricRow}>
            <TouchableOpacity style={[styles.metricCard, styles.pendingCard]} activeOpacity={0.7}>
              <View style={styles.metricHeader}>
                <Feather name="clock" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.metricTitle}>Pending</Text>
              <Text style={styles.metricValue}>{formatCurrency(dashboardData?.pendingInvoices || 0)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.metricCard, styles.invoiceCard]} activeOpacity={0.7}>
              <View style={styles.metricHeader}>
                <Feather name="file-text" size={20} color="#6366F1" />
              </View>
              <Text style={styles.metricTitle}>Invoices</Text>
              <Text style={styles.metricValue}>{dashboardData?.invoiceCount || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
           
          </View>
          
          <View style={styles.transactionsList}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map((item) => (
                <RecentTransaction 
                  key={item.id} 
                  item={item} 
                  type={item.type as 'income' | 'expense'} 
                />
              ))
            ) : (
              <View style={styles.emptyTransactions}>
                <Text style={styles.emptyText}>No transactions yet</Text>
                <Text style={styles.emptySubtext}>
                  Add your first income or expense to get started
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* AI Insights Modal */}
     <AIInsightsModal
  visible={showAIInsights}
  onClose={() => setShowAIInsights(false)}
  insights={aiInsights || []}
  loading={aiLoading}
  onRefresh={handleRefreshInsights}
/>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  quickActions: {
  paddingHorizontal: Spacing.lg,
  marginBottom: Spacing.lg,
},
quickActionsGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: Spacing.sm,
  marginTop: Spacing.sm,
},
quickActionCard: {
  width: (width - Spacing.lg * 2 - Spacing.sm * 3) / 4,
  aspectRatio: 1,
  borderRadius: BorderRadius.lg,
  overflow: 'hidden',
},
quickActionGradient: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: Spacing.sm,
},
quickActionText: {
  fontSize: 11,
  fontWeight: '500',
  color: Colors.light.text,
  marginTop: 4,
  textAlign: 'center',
},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: Spacing.md, // Added margin on top
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
    marginTop: 10,
  },
  date: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: BorderRadius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.background,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    backgroundColor: Colors.light.background,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // AI Card
  aiCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  aiCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  aiCardText: {
    flex: 1,
  },
  aiCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  aiCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  checkNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  checkNowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  
  // Overview Card
  overviewCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  overviewPattern: {
    padding: Spacing.lg,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: Spacing.sm,
  },
  overviewLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: Spacing.md,
  },
  overviewStatsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  overviewStat: {
    flex: 1,
    alignItems: 'center',
  },
  overviewStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    marginBottom: 2,
  },
  overviewStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  overviewDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: Spacing.md,
  },
  
  // Metrics
  metricsGrid: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    height: 100,
  },
  incomeCard: {
    backgroundColor: '#D1FAE5',
  },
  expenseCard: {
    backgroundColor: '#FEE2E2',
  },
  pendingCard: {
    backgroundColor: '#FEF3C7',
  },
  invoiceCard: {
    backgroundColor: '#E0E7FF',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricTitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  
  // Recent Transactions
  recentSection: {
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.light.primary,
  },
  transactionsList: {
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyTransactions: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    textAlign: 'center',
  },
});
 