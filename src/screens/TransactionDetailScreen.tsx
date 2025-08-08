// src/screens/TransactionDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useQueryClient } from '@tanstack/react-query';
import { getIncome, getExpense, deleteIncome, deleteExpense } from '../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { EditIncomeModal } from '../components/income/EditIncomeModal';
import { EditExpenseModal } from '../components/expense/EditExpenseModal';

// Type definitions
type RootStackParamList = {
  Main: undefined;
  TransactionDetail: { transactionId: string; type: 'income' | 'expense' };
};

type TransactionDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TransactionDetail'>;
type TransactionDetailRouteProp = RouteProp<RootStackParamList, 'TransactionDetail'>;

export default function TransactionDetailScreen() {
  const navigation = useNavigation<TransactionDetailNavigationProp>();
  const route = useRoute<TransactionDetailRouteProp>();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const queryClient = useQueryClient();
  
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const { transactionId, type } = route.params;
  const isIncome = type === 'income';

  useEffect(() => {
    loadTransaction();
  }, [transactionId, type]);

  const loadTransaction = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      let data;
      
      if (isIncome) {
        data = await getIncome(transactionId, user.id);
      } else {
        data = await getExpense(transactionId, user.id);
      }
      
      setTransaction(data);
    } catch (error) {
      console.error('Error loading transaction:', error);
      Alert.alert('Error', 'Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete this ${type}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (!user) return;
    
    try {
      setDeleting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (isIncome) {
        await deleteIncome(transactionId);
      } else {
        await deleteExpense(transactionId);
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['recent-incomes'] });
      queryClient.invalidateQueries({ queryKey: ['recent-expenses'] });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      Alert.alert('Error', 'Failed to delete transaction');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleEditClose = () => {
    setShowEditModal(false);
    // Reload the transaction data after edit
    loadTransaction();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate total with tax
  const displayAmount = transaction.amount + (transaction.tax_amount || 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleEdit}
          >
            <Feather name="edit-2" size={20} color={Colors.light.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerButton, { marginLeft: 12 }]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={Colors.light.error} />
            ) : (
              <Feather name="trash-2" size={20} color={Colors.light.error} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount Card */}
        <LinearGradient
          colors={isIncome ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
          style={styles.amountCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.amountHeader}>
            <View style={styles.typeIcon}>
              <Feather 
                name={isIncome ? 'trending-up' : 'trending-down'} 
                size={24} 
                color="#FFFFFF" 
              />
            </View>
            <Text style={styles.typeLabel}>
              {isIncome ? 'Income' : 'Expense'}
            </Text>
          </View>
          <Text style={styles.amountValue}>
            {formatCurrency(displayAmount)}
          </Text>
          {transaction.tax_amount > 0 && (
            <Text style={styles.taxInfo}>
              Includes {formatCurrency(transaction.tax_amount)} tax
            </Text>
          )}
        </LinearGradient>

        {/* Details Section */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          {/* Description */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Feather name="file-text" size={18} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{transaction.description}</Text>
            </View>
          </View>

          {/* Date */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Feather name="calendar" size={18} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {format(new Date(transaction.date), 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>
          </View>

          {/* Category */}
          {transaction.category && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="tag" size={18} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>{transaction.category.name}</Text>
              </View>
            </View>
          )}

          {/* Client/Vendor */}
          {(transaction.client || transaction.vendor) && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather 
                  name={isIncome ? "user" : "shopping-bag"} 
                  size={18} 
                  color="#6B7280" 
                />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>
                  {isIncome ? 'Client' : 'Vendor'}
                </Text>
                <Text style={styles.detailValue}>
                  {isIncome ? transaction.client?.name : transaction.vendor?.name}
                </Text>
              </View>
            </View>
          )}

          {/* Reference Number */}
          {transaction.reference_number && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="hash" size={18} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Reference Number</Text>
                <Text style={styles.detailValue}>{transaction.reference_number}</Text>
              </View>
            </View>
          )}

          {/* Payment Method */}
          {transaction.payment_method && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="credit-card" size={18} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Payment Method</Text>
                <Text style={styles.detailValue}>
                  {transaction.payment_method.charAt(0).toUpperCase() + 
                   transaction.payment_method.slice(1)}
                </Text>
              </View>
            </View>
          )}

          {/* Recurring */}
          {transaction.is_recurring && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="refresh-cw" size={18} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Recurring</Text>
                <Text style={styles.detailValue}>Yes</Text>
              </View>
            </View>
          )}
        </View>

        {/* Notes */}
        {transaction.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{transaction.notes}</Text>
          </View>
        )}

        {/* Timestamps */}
        <View style={styles.timestampsCard}>
          <Text style={styles.timestampText}>
            Created {format(new Date(transaction.created_at), 'MMM d, yyyy \'at\' h:mm a')}
          </Text>
          {transaction.updated_at && transaction.updated_at !== transaction.created_at && (
            <Text style={styles.timestampText}>
              Updated {format(new Date(transaction.updated_at), 'MMM d, yyyy \'at\' h:mm a')}
            </Text>
          )}
        </View>
      </ScrollView>
      
      {/* Edit Modals */}
      {isIncome ? (
        <EditIncomeModal
          visible={showEditModal}
          income={transaction}
          onClose={handleEditClose}
        />
      ) : (
        <EditExpenseModal
          visible={showEditModal}
          expense={transaction}
          onClose={handleEditClose}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
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
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  amountCard: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  amountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  taxInfo: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  detailsCard: {
    margin: Spacing.lg,
    marginTop: 0,
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  notesCard: {
    margin: Spacing.lg,
    marginTop: 0,
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  notesText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  timestampsCard: {
    margin: Spacing.lg,
    marginTop: 0,
    marginBottom: Spacing.xl,
  },
  timestampText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    textAlign: 'center',
    marginBottom: 4,
  },
});