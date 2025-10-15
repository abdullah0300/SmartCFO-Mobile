// app/(tabs)/income.tsx - Fixed with current month filter and search

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Keyboard,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { format, startOfMonth, endOfMonth, isWithinInterval, subDays, subMonths, subYears, startOfYear, endOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAuth } from '../../src/hooks/useAuth';
import { useSettings } from '../../src/contexts/SettingsContext';
import { getIncomes } from '../../src/services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/Colors';
import { AddIncomeModal } from '../../src/components/income/AddIncomeModal';
import { EditIncomeModal } from '../../src/components/income/EditIncomeModal';
import { IncomeDetailModal } from '../../src/components/income/IncomeDetailModal';
import { DateFilterBar } from '../../src/components/common/DateFilterBar';
import { FloatingCalculator } from '../../src/components/common/FloatingCalculator';
import { Income } from '../../src/types';

// Income Item Component
const IncomeItem = ({ 
  item, 
  onPress 
}: { 
  item: Income; 
  onPress: (income: Income) => void;
}) => {
  const { formatCurrency, getCurrencySymbol, baseCurrency } = useSettings();
  const displayAmount = item.amount; 
  const isBaseCurrency = !item.currency || item.currency === baseCurrency;
  
  // Build meta text parts
  const metaParts = [];
  if (item.client?.name) {
    metaParts.push(item.client.name);
  }
  metaParts.push(format(new Date(item.date), 'MMM d'));
  const metaText = metaParts.join(' • ');
  
  return (
    <TouchableOpacity 
      style={styles.incomeItem} 
      activeOpacity={0.7}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(item);
      }}
    >
      <View style={styles.itemContent}>
        <View style={styles.itemLeft}>
          <View style={[
            styles.categoryDot, 
            { backgroundColor: item.category?.color || '#10B981' }
          ]} />
          <View style={styles.itemDetails}>
            <Text style={styles.itemDescription} numberOfLines={1}>
              {String(item.description)}
            </Text>
            <View style={styles.itemMeta}>
              <View style={[styles.categoryBadge, { backgroundColor: (item.category?.color || '#10B981') + '15' }]}>
                <Text style={[styles.itemCategory, { color: item.category?.color || '#10B981' }]}>
                  {String(item.category?.name || 'Uncategorized')}
                </Text>
              </View>
              <Text style={styles.itemDate}>
                {metaText}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.amountContainer}>
        <View style={styles.amountColumn}>
          <Text style={styles.itemAmount}>
            {isBaseCurrency 
              ? formatCurrency(displayAmount)
              : `${getCurrencySymbol(item.currency || baseCurrency)} ${displayAmount.toFixed(2)}`
            }
          </Text>
          {!isBaseCurrency && item.currency && (
            <Text style={styles.itemCurrency}>{item.currency}</Text>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={Colors.light.textTertiary} />
      </View>
      </View>
    </TouchableOpacity>
  );
};

export default function IncomeScreen() {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Date filtering states
  const [selectedDateRange, setSelectedDateRange] = useState('mtd');
  const [customStartDate, setCustomStartDate] = useState(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const { data: allIncomes, isLoading, refetch } = useQuery({
    queryKey: ['incomes', user?.id],
    queryFn: () => getIncomes(user!.id, 100), // Get more records for better history
    enabled: !!user,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleIncomePress = (income: Income) => {
    setSelectedIncome(income);
    setShowDetailModal(true);
  };

  const handleEdit = (income: Income) => {
    setShowDetailModal(false);
    setSelectedIncome(income);
    setShowEditModal(true);
  };

  // Handle date range selection
  const handleDateRangeSelect = (rangeId: string) => {
    if (rangeId === 'custom') {
      setShowCustomModal(true);
      return;
    }
    setSelectedDateRange(rangeId);
  };

  // Filter incomes by date range and search
  const filteredIncomes = useMemo(() => {
    if (!allIncomes) return [];

    // Get date range based on selection
    const now = new Date();
    let dateRange;

    switch (selectedDateRange) {
      case 'mtd':
        dateRange = { start: startOfMonth(now), end: endOfMonth(now) };
        break;
      case '1w':
        dateRange = { start: subDays(now, 7), end: endOfDay(now) };
        break;
      case '4w':
        dateRange = { start: subDays(now, 28), end: endOfDay(now) };
        break;
      case '1m':
        dateRange = { start: subDays(now, 30), end: endOfDay(now) };
        break;
      case '3m':
        dateRange = { start: subMonths(now, 3), end: endOfDay(now) };
        break;
      case '6m':
        dateRange = { start: subMonths(now, 6), end: endOfDay(now) };
        break;
      case '1y':
        dateRange = { start: subYears(now, 1), end: endOfDay(now) };
        break;
      case 'all':
        dateRange = null;
        break;
      case 'custom':
        dateRange = { start: customStartDate, end: customEndDate };
        break;
      default:
        dateRange = { start: startOfMonth(now), end: endOfMonth(now) };
    }

    // First filter by date range
    let filtered = allIncomes;
    if (dateRange) {
      filtered = allIncomes.filter(income => {
        const incomeDate = new Date(income.date);
        return isWithinInterval(incomeDate, { start: dateRange.start, end: dateRange.end });
      });
    }

    // Then apply search filter if there's a search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(income => {
        const clientName = (() => {
          if (!income.client) return '';
          if (typeof income.client === 'string') return income.client;
          if (typeof income.client === 'object' && income.client !== null && 'name' in income.client) {
            return income.client.name || '';
          }
          return '';
        })();

        return (
          income.description.toLowerCase().includes(query) ||
          clientName.toLowerCase().includes(query) ||
          (income.category?.name || '').toLowerCase().includes(query) ||
          (income.reference_number || '').toLowerCase().includes(query)
        );
      });
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allIncomes, searchQuery, selectedDateRange, customStartDate, customEndDate]);

  // Calculate totals for filtered incomes
  const filteredTotal = filteredIncomes.reduce((sum, item) => {
    // Use base_amount WITHOUT tax for total (like web app)
    if (item.base_amount) {
      return sum + item.base_amount;
    }
    // Fallback to original amount WITHOUT tax
    return sum + item.amount;
  }, 0);
  const filteredCount = filteredIncomes.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with gradient */}
      <LinearGradient
        colors={['#10B981', '#059669'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Income</Text>
            <View style={styles.headerStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total ({baseCurrency})</Text>
                <Text style={styles.statValue}>{formatCurrency(filteredTotal)}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Transactions</Text>
                <Text style={styles.statValue}>{filteredCount}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                setShowSearch(!showSearch);
                if (showSearch) {
                  setSearchQuery('');
                  Keyboard.dismiss();
                }
              }}
            >
              <View style={styles.headerButtonInner}>
                <Feather name={showSearch ? "x" : "search"} size={20} color="#10B981" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowAddModal(true)}
            >
              <View style={styles.headerButtonInner}>
                <Feather name="plus" size={24} color="#10B981" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Feather name="search" size={18} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by description, client, or category..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x-circle" size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Date Filter Bar */}
      <DateFilterBar
        selectedPeriod={selectedDateRange}
        onPeriodChange={handleDateRangeSelect}
        customRange={selectedDateRange === 'custom' ? { start: customStartDate, end: customEndDate } : null}
        onClearCustom={() => {
          setSelectedDateRange('mtd');
          setCustomStartDate(startOfMonth(new Date()));
          setCustomEndDate(new Date());
        }}
      />

      <FlatList
        data={filteredIncomes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <IncomeItem item={item} onPress={handleIncomePress} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#D1FAE5', '#A7F3D0'] as const}
              style={styles.emptyIcon}
            >
              <Feather name="trending-up" size={48} color="#10B981" />
            </LinearGradient>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No results found' : 'No income recorded yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery 
                ? 'Try adjusting your search terms' 
                : `Tap the + button to add your first income for ${format(new Date(), 'MMMM')}`}
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => setShowAddModal(true)}
              >
                <LinearGradient
                  colors={['#10B981', '#059669'] as const}
                  style={styles.emptyButtonGradient}
                >
                  <Feather name="plus" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Add Income</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <AddIncomeModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <IncomeDetailModal
        visible={showDetailModal}
        income={selectedIncome}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedIncome(null);
        }}
        onEdit={handleEdit}
      />

      <EditIncomeModal
        visible={showEditModal}
        income={selectedIncome}
        onClose={() => {
          setShowEditModal(false);
          setSelectedIncome(null);
        }}
      />

      {/* Custom Date Range Modal */}
      <Modal
        visible={showCustomModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customModalContainer}>
            <View style={styles.customModalHeader}>
              <Text style={styles.customModalTitle}>Custom Date Range</Text>
              <TouchableOpacity onPress={() => setShowCustomModal(false)}>
                <Feather name="x" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.customModalContent}>
              <View style={styles.datePickerSection}>
                <Text style={styles.dateLabel}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Feather name="calendar" size={20} color={Colors.light.primary} />
                  <Text style={styles.dateButtonText}>
                    {format(customStartDate, 'MMM dd, yyyy')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerSection}>
                <Text style={styles.dateLabel}>End Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Feather name="calendar" size={20} color={Colors.light.primary} />
                  <Text style={styles.dateButtonText}>
                    {format(customEndDate, 'MMM dd, yyyy')}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => {
                  setSelectedDateRange('custom');
                  setShowCustomModal(false);
                }}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.applyButtonGradient}
                >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={customStartDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) {
              setCustomStartDate(selectedDate);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={customEndDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) {
              setCustomEndDate(selectedDate);
            }
          }}
        />
      )}

      {/* Floating Calculator */}
      <FloatingCalculator position="right" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerGradient: {
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    marginRight: Spacing.lg,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: Spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  headerButton: {
    marginLeft: 8,
  },
  headerButtonInner: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  amountColumn: {
  alignItems: 'flex-end',
  marginRight: 8,
  },
  itemCurrency: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  customModalContainer: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl,
  },
  customModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  customModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
  },
  customModalContent: {
    padding: Spacing.lg,
  },
  datePickerSection: {
    marginBottom: Spacing.lg,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  dateButtonText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
  },
  applyButton: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  applyButtonGradient: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: 100,
  },
  incomeItem: {
    backgroundColor: Colors.light.background,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  itemDetails: {
    flex: 1,
  },
  itemDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: 6,
  },
  itemCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  itemClient: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  itemDot: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    marginHorizontal: 6,
  },
  itemDate: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemAmount: {
    fontSize: 18,
    color: '#10B981',
    fontWeight: '700',
  },
  taxIndicator: {
    backgroundColor: '#10B981' + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taxIndicatorText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  separator: {
    height: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 3,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    overflow: 'hidden',
    borderRadius: BorderRadius.full,
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});