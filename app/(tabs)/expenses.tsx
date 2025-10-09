// app/(tabs)/expenses.tsx - Fixed with current month filter and search

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
import { getExpenses } from '../../src/services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/Colors';
import { AddExpenseModal } from '../../src/components/expense/AddExpenseModal';
import { EditExpenseModal } from '../../src/components/expense/EditExpenseModal';
import { ExpenseDetailModal } from '../../src/components/expense/ExpenseDetailModal';
import { DateFilterBar } from '../../src/components/common/DateFilterBar';
import { Expense, Vendor } from '../../src/types';

const ExpenseItem = ({ 
  item, 
  onPress 
}: { 
  item: Expense; 
  onPress: (expense: Expense) => void;
}) => {
  const { formatCurrency, getCurrencySymbol, baseCurrency } = useSettings();
  const displayAmount = item.amount; // Show amount WITHOUT tax like income list
  const isBaseCurrency = !item.currency || item.currency === baseCurrency;
  
  // Build meta text parts
  const metaParts = [];
  
  // Safely get vendor name
  const getVendorName = (): string => {
    if (!item.vendor) return '';
    if (typeof item.vendor === 'string') return item.vendor;
    if (typeof item.vendor === 'object' && item.vendor !== null && 'name' in item.vendor) {
      const vendorObj = item.vendor as Vendor;
      return vendorObj.name || '';
    }
    return '';
  };
  
  const vendorName = getVendorName();
  if (vendorName) {
    metaParts.push(vendorName);
  }
  metaParts.push(format(new Date(item.date), 'MMM d'));
  const metaText = metaParts.join(' • ');
  
  return (
    <TouchableOpacity 
      style={styles.expenseItem} 
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
            { backgroundColor: item.category?.color || '#EF4444' }
          ]} />
          <View style={styles.itemDetails}>
            <Text style={styles.itemDescription} numberOfLines={1}>
              {String(item.description)}
            </Text>
            <View style={styles.itemMeta}>
              <View style={[styles.categoryBadge, { backgroundColor: (item.category?.color || '#EF4444') + '15' }]}>
                <Text style={[styles.itemCategory, { color: item.category?.color || '#EF4444' }]}>
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

export default function ExpensesScreen() {
  const { user } = useAuth();
  const { formatCurrency, getCurrencySymbol, baseCurrency } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Date filtering states
  const [selectedDateRange, setSelectedDateRange] = useState('mtd');
  const [customStartDate, setCustomStartDate] = useState(startOfMonth(new Date()));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const { data: allExpenses, isLoading, refetch } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: () => getExpenses(user!.id, 100), // Get more records for better history
    enabled: !!user,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleExpensePress = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowDetailModal(true);
  };

  const handleEdit = (expense: Expense) => {
    setShowDetailModal(false);
    setSelectedExpense(expense);
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

  // Filter expenses by date range and search
  const filteredExpenses = useMemo(() => {
    if (!allExpenses) return [];

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
    let filtered = allExpenses;
    if (dateRange) {
      filtered = allExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return isWithinInterval(expenseDate, { start: dateRange.start, end: dateRange.end });
      });
    }

    // Then apply search filter if there's a search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(expense => {
        const vendorName = (() => {
          if (!expense.vendor) return '';
          if (typeof expense.vendor === 'string') return expense.vendor;
          if (typeof expense.vendor === 'object' && expense.vendor !== null && 'name' in expense.vendor) {
            const vendorObj = expense.vendor as Vendor;
            return vendorObj.name || '';
          }
          return '';
        })();

        return (
          expense.description.toLowerCase().includes(query) ||
          vendorName.toLowerCase().includes(query) ||
          (expense.category?.name || '').toLowerCase().includes(query)
        );
      });
    }

    // Sort by date (most recent first)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allExpenses, searchQuery, selectedDateRange, customStartDate, customEndDate]);

  // Calculate totals for filtered expenses
  const filteredTotal = filteredExpenses.reduce((sum, item) => {
    // Use base_amount WITHOUT tax for total (like income page)
    if (item.base_amount) {
      return sum + item.base_amount;
    }
    // Fallback to original amount WITHOUT tax
    return sum + item.amount;
  }, 0);
  const filteredCount = filteredExpenses.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#EF4444', '#DC2626'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Expenses</Text>
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
                <Feather name={showSearch ? "x" : "search"} size={20} color="#EF4444" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowAddModal(true)}
            >
              <View style={styles.headerButtonInner}>
                <Feather name="plus" size={24} color="#EF4444" />
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
                placeholder="Search by description, vendor, or category..."
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
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExpenseItem item={item} onPress={handleExpensePress} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#EF4444"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#FEE2E2', '#FECACA'] as const}
              style={styles.emptyIcon}
            >
              <Feather name="trending-down" size={48} color="#EF4444" />
            </LinearGradient>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No results found' : 'No expenses recorded yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery 
                ? 'Try adjusting your search terms' 
                : `Tap the + button to add your first expense for ${format(new Date(), 'MMMM')}`}
            </Text>
            {!searchQuery && (
              <View style={styles.emptyActions}>
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626'] as const}
                    style={styles.emptyButtonGradient}
                  >
                    <Feather name="plus" size={20} color="#FFFFFF" />
                    <Text style={styles.emptyButtonText}>Add Expense</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />

      <AddExpenseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <ExpenseDetailModal
        visible={showDetailModal}
        expense={selectedExpense}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedExpense(null);
        }}
        onEdit={handleEdit}
      />

      <EditExpenseModal
        visible={showEditModal}
        expense={selectedExpense}
        onClose={() => {
          setShowEditModal(false);
          setSelectedExpense(null);
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
                  colors={['#EF4444', '#DC2626']}
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
  expenseItem: {
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
  itemVendor: {
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
    gap: 6,
  },
  itemAmount: {
    fontSize: 18,
    color: '#DC2626',
    fontWeight: '700',
  },
  taxIndicator: {
    backgroundColor: '#EF4444' + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taxIndicatorText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600',
  },
  receiptIcon: {
    marginLeft: 4,
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
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.md,
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