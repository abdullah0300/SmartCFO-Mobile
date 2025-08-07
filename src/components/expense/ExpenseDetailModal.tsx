import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { useSettings } from '../../contexts/SettingsContext';
import { deleteExpense } from '../../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/Colors';
import { Button } from '../ui/Button';
import { Expense } from '../../types';

interface ExpenseDetailModalProps {
  visible: boolean;
  expense: Expense | null;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
}

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  visible,
  expense,
  onClose,
  onEdit,
}) => {
  const { formatCurrency } = useSettings();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    },
  });

  const handleDelete = () => {
    if (!expense) return;

    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(expense.id),
        },
      ]
    );
  };

  if (!expense) return null;
  // Display values
  const baseAmount = expense.amount;
  const taxAmount = expense.tax_amount || 0;
  const taxRate = expense.tax_rate || 0;
  const totalAmount = baseAmount + taxAmount;
  const hasTax = taxRate > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Expense Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
            {expense.receipt_url && (
              <View style={styles.receiptSection}>
                <Image source={{ uri: expense.receipt_url }} style={styles.receiptImage} />
              </View>
            )}

            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Total Paid</Text>
              <Text style={styles.amountValue}>{formatCurrency(totalAmount)}</Text>
              
              {/* Show breakdown if tax exists */}
              {hasTax && (
                <View style={styles.amountBreakdown}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Base Amount:</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(baseAmount)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Tax ({taxRate}%):</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(taxAmount)}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Feather name="calendar" size={20} color={Colors.light.textSecondary} />
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {format(new Date(expense.date), 'MMMM dd, yyyy')}
                  </Text>
                </View>
              </View>

              <View style={styles.detailItem}>
                <Feather name="tag" size={20} color={Colors.light.textSecondary} />
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>
                    {expense.category?.name || 'Uncategorized'}
                  </Text>
                </View>
              </View>

                {expense.vendor && (
  <View style={styles.detailItem}>
    <Feather name="shopping-bag" size={20} color={Colors.light.textSecondary} />
    <View style={styles.detailText}>
      <Text style={styles.detailLabel}>Vendor</Text>
      <Text style={styles.detailValue}>
        {typeof expense.vendor === 'string' 
          ? expense.vendor 
          : (expense.vendor as any)?.name || 'Unknown'}
      </Text>
    </View>
  </View>
)}
            </View>

            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text style={styles.descriptionText}>{expense.description}</Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Button
              title="Edit"
              onPress={() => onEdit(expense)}
              variant="secondary"
              style={styles.actionButton}
            />
            <Button
              title="Delete"
              onPress={handleDelete}
              variant="ghost"
              style={[styles.actionButton, styles.deleteButton]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    ...Typography.title3,
    color: Colors.light.text,
  },
  detailsContainer: {
    padding: Spacing.lg,
  },
  receiptSection: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  receiptImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  amountLabel: {
    ...Typography.caption1,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#DC2626',
  },
  detailsGrid: {
    gap: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    ...Typography.caption1,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.light.text,
    fontWeight: '500',
  },
  descriptionSection: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
  },
  descriptionLabel: {
    ...Typography.caption1,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xs,
  },
  descriptionText: {
    ...Typography.body,
    color: Colors.light.text,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  actionButton: {
    flex: 1,
  },
  deleteButton: {
    // Add specific styles if needed
  },
  amountBreakdown: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border + '30',
    width: '100%',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  breakdownValue: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
});