import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { useSettings } from "../../contexts/SettingsContext";
import { deleteIncome } from "../../services/api";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
} from "../../constants/Colors";
import { Button } from "../ui/Button";
import { Income } from "../../types";

interface IncomeDetailModalProps {
  visible: boolean;
  income: Income | null;
  onClose: () => void;
  onEdit: (income: Income) => void;
}

export const IncomeDetailModal: React.FC<IncomeDetailModalProps> = ({
  visible,
  income,
  onClose,
  onEdit,
}) => {
  const { formatCurrency } = useSettings();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteIncome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    },
  });

  const handleDelete = () => {
    if (!income) return;

    Alert.alert(
      "Delete Income",
      "Are you sure you want to delete this income entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(income.id),
        },
      ]
    );
  };

  if (!income) return null;

  // Display values
  const baseAmount = income.amount;
  const taxAmount = income.tax_amount || 0;
  const taxRate = income.tax_rate || 0;
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
            <Text style={styles.modalTitle}>Income Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsContainer}>
            {/* Amount Section */}
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Total Received</Text>
              <Text style={styles.amountValue}>
                {formatCurrency(totalAmount)}
              </Text>
              
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

            {/* Details Grid */}
            <View style={styles.detailsGrid}>
              {/* Date */}
              <View style={styles.detailItem}>
                <Feather
                  name="calendar"
                  size={20}
                  color={Colors.light.textSecondary}
                />
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {format(new Date(income.date), "MMMM dd, yyyy")}
                  </Text>
                </View>
              </View>

              {/* Category */}
              <View style={styles.detailItem}>
                <Feather
                  name="tag"
                  size={20}
                  color={Colors.light.textSecondary}
                />
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>
                    {income.category?.name || "Uncategorized"}
                  </Text>
                </View>
              </View>

              {/* Client */}
              {income.client && (
                <View style={styles.detailItem}>
                  <Feather
                    name="user"
                    size={20}
                    color={Colors.light.textSecondary}
                  />
                  <View style={styles.detailText}>
                    <Text style={styles.detailLabel}>Client</Text>
                    <Text style={styles.detailValue}>{income.client.name}</Text>
                  </View>
                </View>
              )}

              {/* Reference Number */}
              {income.reference_number && (
                <View style={styles.detailItem}>
                  <Feather
                    name="hash"
                    size={20}
                    color={Colors.light.textSecondary}
                  />
                  <View style={styles.detailText}>
                    <Text style={styles.detailLabel}>Reference</Text>
                    <Text style={styles.detailValue}>
                      {income.reference_number}
                    </Text>
                  </View>
                </View>
              )}

              {/* Tax Information - Only show if tax exists */}
              
            </View>

            {/* Description */}
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text style={styles.descriptionText}>{income.description}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title="Edit"
              onPress={() => onEdit(income)}
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    width: "90%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  amountSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  amountLabel: {
    ...Typography.caption1,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.light.success,
  },
  amountSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  detailsGrid: {
    gap: Spacing.md,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "500",
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
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  actionButton: {
    flex: 1,
  },
  deleteButton: {
    // Add any specific delete button styles
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