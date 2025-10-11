// src/components/loans/RecordPaymentModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../contexts/SettingsContext';
import { supabase } from '../../services/supabase';
import { Spacing, BorderRadius } from '../../constants/Colors';
import { AmortizationPayment } from '../../services/loanService';

interface Loan {
  id: string;
  loan_number: string;
  lender_name: string;
  current_balance: number;
  principal_amount: number;
  interest_rate: number;
}

interface LoanPayment {
  id: string;
  payment_number: number;
  payment_date: string;
  total_payment: number;
}

interface RecordPaymentModalProps {
  visible: boolean;
  loan: Loan;
  nextPayment: AmortizationPayment | null;
  existingPayments: LoanPayment[];
  onClose: () => void;
  onPaymentRecorded: () => void;
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
  { value: 'wire', label: 'Wire Transfer' },
  { value: 'other', label: 'Other' },
];

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  visible,
  loan,
  nextPayment,
  existingPayments,
  onClose,
  onPaymentRecorded,
}) => {
  const { user } = useAuth();
  const { formatCurrency, baseCurrency } = useSettings();

  // Calculate payment number
  const paymentNumber = existingPayments.length + 1;

  // Calculate scheduled amounts from next payment or current balance
  const scheduledPrincipal = nextPayment?.principalPayment || loan.current_balance;
  const scheduledInterest = nextPayment?.interestPayment || 0;

  // Form state
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [principalAmount, setPrincipalAmount] = useState(scheduledPrincipal.toFixed(2));
  const [interestAmount] = useState(scheduledInterest);
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setPaymentDate(new Date());
      setPaymentMethod('bank_transfer');
      setPrincipalAmount(scheduledPrincipal.toFixed(2));
      setNotes('');
      setProofFile(null);
      setError('');
    }
  }, [visible, scheduledPrincipal]);

  // Calculate derived values
  const principal = parseFloat(principalAmount) || 0;
  const totalPayment = principal + interestAmount;
  const newBalance = Math.max(0, loan.current_balance - principal);

  const pickPaymentProof = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to photos');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        // Validate size (max 5MB)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('File too large', 'Please select a file under 5MB');
          return;
        }

        setProofFile(asset);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadProof = async (file: any): Promise<string | null> => {
    try {
      const fileExt = file.uri.split('.').pop();
      const fileName = `${user!.id}/loan-${loan.id}-${Date.now()}.${fileExt}`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to binary
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, byteArray, {
          contentType: file.mimeType || `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('receipts').getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      console.error('Error uploading proof:', err);
      throw err;
    }
  };

  const validatePayment = (): string[] => {
    const errors = [];

    if (!paymentDate) {
      errors.push('Payment date is required');
    }

    if (totalPayment <= 0) {
      errors.push('Payment amount must be greater than 0');
    }

    if (principal > loan.current_balance) {
      errors.push(
        `Loan amount cannot exceed amount left of ${formatCurrency(loan.current_balance)}`
      );
    }

    if (principal <= 0) {
      errors.push('Loan amount must be greater than 0');
    }

    return errors;
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validate
    const errors = validatePayment();
    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    try {
      setLoading(true);
      setError('');

      // 1. Upload proof if exists
      let proofUrl: string | null = null;
      if (proofFile) {
        proofUrl = await uploadProof(proofFile);
      }

      // 2. Get due date from schedule or use payment date
      const dueDate = nextPayment
        ? format(nextPayment.paymentDate, 'yyyy-MM-dd')
        : format(paymentDate, 'yyyy-MM-dd');

      // 3. Create payment record
      const paymentData = {
        loan_id: loan.id,
        user_id: user.id,
        payment_number: paymentNumber,
        payment_date: format(paymentDate, 'yyyy-MM-dd'),
        due_date: dueDate,
        principal_amount: principal,
        interest_amount: interestAmount,
        total_payment: totalPayment,
        remaining_balance: newBalance,
        status: 'paid',
        paid_date: format(paymentDate, 'yyyy-MM-dd'),
        payment_method: paymentMethod,
        payment_proof_url: proofUrl,
        notes: notes || null,
      };

      const { data: payment, error: paymentError } = await supabase
        .from('loan_payments')
        .insert([paymentData])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // 4. Create interest expense automatically if interest > 0
      if (interestAmount > 0) {
        // Find or create "Loan Interest" category
        let { data: category } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', user.id)
          .eq('name', 'Loan Interest')
          .eq('type', 'expense')
          .single();

        // Create category if it doesn't exist
        if (!category) {
          const { data: newCategory, error: categoryError } = await supabase
            .from('categories')
            .insert([
              {
                user_id: user.id,
                name: 'Loan Interest',
                type: 'expense',
                color: '#DC2626',
              },
            ])
            .select()
            .single();

          if (categoryError) throw categoryError;
          category = newCategory;
        }

        // Create expense record
        const expenseData = {
          user_id: user.id,
          category_id: category.id,
          amount: interestAmount,
          currency: baseCurrency, // Use user's base currency
          date: format(paymentDate, 'yyyy-MM-dd'),
          description: `Interest payment for ${loan.loan_number} - ${loan.lender_name} (Payment #${paymentNumber})`,
        };

        const { data: expense, error: expenseError } = await supabase
          .from('expenses')
          .insert([expenseData])
          .select()
          .single();

        if (expenseError) throw expenseError;

        // Link expense to payment
        await supabase
          .from('loan_payments')
          .update({ expense_id: expense.id })
          .eq('id', payment.id);
      }

      // 5. Update loan totals
      const updatedLoanData = {
        current_balance: newBalance,
        total_paid: (loan.principal_amount - loan.current_balance) + totalPayment,
        total_principal_paid:
          (loan.principal_amount - loan.current_balance - interestAmount * existingPayments.length) +
          principal,
        total_interest_paid:
          interestAmount * existingPayments.length + interestAmount,
        status: newBalance <= 0 ? 'paid_off' : 'active',
      };

      const { error: updateError } = await supabase
        .from('loans')
        .update(updatedLoanData)
        .eq('id', loan.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Payment recorded successfully');
      onPaymentRecorded();
      onClose();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      setError(err.message || 'Failed to record payment');
      Alert.alert('Error', 'Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Record Payment</Text>
              <Text style={styles.headerSubtitle}>
                {loan.loan_number} - {loan.lender_name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={20} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Payment Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Payment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment #:</Text>
              <Text style={styles.summaryValue}>{paymentNumber}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Loan Amount:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(principal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Interest:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(interestAmount)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryRowTotal]}>
              <Text style={styles.summaryLabelTotal}>Total Amount:</Text>
              <Text style={styles.summaryValueTotal}>{formatCurrency(totalPayment)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount Left After:</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                {formatCurrency(newBalance)}
              </Text>
            </View>
          </View>

          {/* Payment Date */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Payment Date <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Feather name="calendar" size={16} color="#6B7280" />
              <Text style={styles.dateText}>{format(paymentDate, 'MMM dd, yyyy')}</Text>
            </TouchableOpacity>
          </View>

          {/* Payment Method */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Payment Method <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowMethodPicker(!showMethodPicker)}
            >
              <Text style={styles.pickerText}>
                {PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}
              </Text>
              <Feather name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
            {showMethodPicker && (
              <View style={styles.pickerList}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.value}
                    style={styles.pickerItem}
                    onPress={() => {
                      setPaymentMethod(method.value);
                      setShowMethodPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        paymentMethod === method.value && styles.pickerItemTextActive,
                      ]}
                    >
                      {method.label}
                    </Text>
                    {paymentMethod === method.value && (
                      <Feather name="check" size={18} color="#6366F1" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Loan Amount */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Loan Amount <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={principalAmount}
              onChangeText={setPrincipalAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <Text style={styles.helpText}>
              Scheduled: {formatCurrency(scheduledPrincipal)}
            </Text>
          </View>

          {/* Total Payment Display */}
          <View style={styles.totalPaymentCard}>
            <Text style={styles.totalPaymentLabel}>Total Payment</Text>
            <Text style={styles.totalPaymentValue}>{formatCurrency(totalPayment)}</Text>
            <Text style={styles.totalPaymentHelp}>Loan Amount + Interest (auto)</Text>
          </View>

          {/* Payment Proof */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Payment Proof (Optional)</Text>
            {proofFile ? (
              <View style={styles.proofPreview}>
                <Image source={{ uri: proofFile.uri }} style={styles.proofImage} />
                <View style={styles.proofInfo}>
                  <Text style={styles.proofName}>
                    {proofFile.fileName || 'receipt.jpg'}
                  </Text>
                  <Text style={styles.proofSize}>
                    {((proofFile.fileSize || 0) / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setProofFile(null)}
                  style={styles.proofRemove}
                >
                  <Feather name="x" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadButton} onPress={pickPaymentProof}>
                <Feather name="upload" size={18} color="#6366F1" />
                <Text style={styles.uploadText}>Upload Receipt/Screenshot</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Notes */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this payment..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
                style={styles.submitButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Record Payment</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={paymentDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) setPaymentDate(date);
            }}
          />
        )}

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Recording payment...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
  },
  summaryCard: {
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryRowTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#C7D2FE',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  summaryLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
  summaryValueTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4F46E5',
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#DC2626',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  dateText: {
    fontSize: 14,
    color: '#1F2937',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  pickerText: {
    fontSize: 14,
    color: '#1F2937',
  },
  pickerList: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#1F2937',
  },
  pickerItemTextActive: {
    fontWeight: '600',
    color: '#6366F1',
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    fontSize: 14,
    color: '#1F2937',
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  totalPaymentCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalPaymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  totalPaymentValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  totalPaymentHelp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366F1',
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  proofPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  proofImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  proofInfo: {
    flex: 1,
  },
  proofName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  proofSize: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  proofRemove: {
    padding: 4,
  },
  notesInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    fontSize: 14,
    color: '#1F2937',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
