// src/screens/BudgetScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format, startOfMonth } from 'date-fns';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { supabase } from '../services/supabase';

interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  category?: { name: string; type: string };
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  created_at: string;
}

interface BudgetProgress {
  category: string;
  budgeted: number;
  actual: number;
  remaining: number;
  percentage: number;
  categoryId: string;
}

export default function BudgetScreen() {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();
  
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [budgetProgress, setBudgetProgress] = useState<BudgetProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    period: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    start_date: new Date(),
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load budgets with categories
      const { data: budgetsData } = await supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .eq('user_id', user.id);
      
      // Load all categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);
      
      setBudgets(budgetsData || []);
      setCategories(categoriesData || []);
      
      // Calculate progress
      await calculateBudgetProgress(budgetsData || []);
      
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBudgetProgress = async (budgetList: Budget[]) => {
    if (!user || budgetList.length === 0) {
      setBudgetProgress([]);
      return;
    }
    
    try {
      const startDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');
      
      // Load transactions
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);
      
      const { data: incomes } = await supabase
        .from('income')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);
      
      const progress: BudgetProgress[] = budgetList.map(budget => {
        let actualAmount = 0;
        
        if (budget.category?.type === 'expense') {
          actualAmount = expenses
            ?.filter(exp => exp.category_id === budget.category_id)
            .reduce((sum, exp) => sum + (exp.base_amount || exp.amount), 0) || 0;
        } else {
          actualAmount = incomes
            ?.filter(inc => inc.category_id === budget.category_id)
            .reduce((sum, inc) => sum + (inc.base_amount || inc.amount), 0) || 0;
        }
        
        const percentage = budget.amount > 0 ? Math.round((actualAmount / budget.amount) * 100) : 0;
        
        return {
          category: budget.category?.name || 'Unknown',
          categoryId: budget.category_id,
          budgeted: budget.amount,
          actual: actualAmount,
          remaining: budget.amount - actualAmount,
          percentage: Math.min(percentage, 100),
        };
      });
      
      setBudgetProgress(progress);
    } catch (error) {
      console.error('Error calculating progress:', error);
      setBudgetProgress([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    if (!user || !formData.category_id || !formData.amount) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    
    try {
      const budgetData = {
        user_id: user.id,
        category_id: formData.category_id,
        amount: parseFloat(formData.amount),
        period: formData.period,
        start_date: format(formData.start_date, 'yyyy-MM-dd'),
      };
      
      if (editingBudget) {
        await supabase
          .from('budgets')
          .update(budgetData)
          .eq('id', editingBudget.id);
      } else {
        await supabase
          .from('budgets')
          .insert([budgetData]);
      }
      
      resetForm();
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete this budget?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('budgets').delete().eq('id', id);
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete budget');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      amount: '',
      period: 'monthly',
      start_date: new Date(),
    });
    setEditingBudget(null);
    setShowAddModal(false);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '#EF4444';
    if (percentage >= 70) return '#F59E0B';
    return '#10B981';
  };

  // Calculate totals
  const totalBudgeted = budgetProgress.reduce((sum, item) => sum + item.budgeted, 0);
  const totalActual = budgetProgress.reduce((sum, item) => sum + item.actual, 0);
  const totalRemaining = totalBudgeted - totalActual;
  const overallPercentage = totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0;

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
        colors={['#6366F1', '#8B5CF6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Budget Planning</Text>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={styles.addButton}
          >
            <Feather name="plus" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
            <MaterialIcons name="attach-money" size={24} color="#3B82F6" />
            <Text style={styles.summaryValue}>{formatCurrency(totalBudgeted)}</Text>
            <Text style={styles.summaryLabel}>Total Budget</Text>
          </View>
          
          <View style={[styles.summaryCard, { backgroundColor: '#F0FDF4' }]}>
            <MaterialIcons name="trending-up" size={24} color="#10B981" />
            <Text style={styles.summaryValue}>{formatCurrency(totalActual)}</Text>
            <Text style={styles.summaryLabel}>Actual Spent</Text>
          </View>
        </View>

        <View style={styles.remainingCard}>
          <View style={styles.remainingHeader}>
            <Text style={styles.remainingLabel}>Remaining Budget</Text>
            <View style={[styles.badge, totalRemaining >= 0 ? styles.badgeSuccess : styles.badgeDanger]}>
              <Text style={styles.badgeText}>{overallPercentage}% Used</Text>
            </View>
          </View>
          <Text style={[styles.remainingValue, { color: totalRemaining >= 0 ? '#10B981' : '#EF4444' }]}>
            {formatCurrency(Math.abs(totalRemaining))}
          </Text>
        </View>

        {/* Budget Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget Progress</Text>
          
          {budgetProgress.map((item, index) => {
            const budget = budgets.find(b => b.category_id === item.categoryId);
            return (
              <View key={index} style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.categoryName}>{item.category}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (budget) {
                        setEditingBudget(budget);
                        setFormData({
                          category_id: budget.category_id,
                          amount: budget.amount.toString(),
                          period: budget.period,
                          start_date: new Date(budget.start_date),
                        });
                        setShowAddModal(true);
                      }
                    }}
                  >
                    <Feather name="edit-2" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.progressInfo}>
                  <Text style={styles.progressText}>
                    {formatCurrency(item.actual)} / {formatCurrency(item.budgeted)}
                  </Text>
                  <Text style={[styles.percentageText, { color: getProgressColor(item.percentage) }]}>
                    {item.percentage}%
                  </Text>
                </View>
                
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(item.percentage, 100)}%`,
                        backgroundColor: getProgressColor(item.percentage),
                      },
                    ]}
                  />
                </View>
                
                {item.percentage >= 90 && (
                  <View style={styles.warningBox}>
                    <MaterialIcons name="warning" size={16} color="#EF4444" />
                    <Text style={styles.warningText}>
                      Budget {item.percentage >= 100 ? 'exceeded!' : 'limit approaching!'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
          
          {budgetProgress.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="account-balance-wallet" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No budgets set</Text>
              <Text style={styles.emptySubtext}>Add budgets to track your spending</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={resetForm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBudget ? 'Edit Budget' : 'Add Budget'}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  style={styles.picker}
                >
                  <Picker.Item label="Select category" value="" />
                  {categories.map(cat => (
                    <Picker.Item key={cat.id} label={`${cat.name} (${cat.type})`} value={cat.id} />
                  ))}
                </Picker>
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Amount ({baseCurrency})</Text>
              <TextInput
                style={styles.input}
                value={formData.amount}
                onChangeText={(text) => setFormData({ ...formData, amount: text })}
                keyboardType="numeric"
                placeholder="0.00"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Period</Text>
              <View style={styles.periodButtons}>
                {(['monthly', 'quarterly', 'yearly'] as const).map(period => (
                  <TouchableOpacity
                    key={period}
                    style={[
                      styles.periodButton,
                      formData.period === period && styles.periodButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, period })}
                  >
                    <Text style={[
                      styles.periodButtonText,
                      formData.period === period && styles.periodButtonTextActive,
                    ]}>
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={resetForm}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSubmit}
              >
                <Text style={styles.saveButtonText}>
                  {editingBudget ? 'Update' : 'Create'}
                </Text>
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
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  remainingCard: {
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 20,
  },
  remainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  remainingLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  remainingValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  badgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#6366F1',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});