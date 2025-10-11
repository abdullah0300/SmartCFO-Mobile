// src/screens/CreateLoanScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useQueryClient } from '@tanstack/react-query';
import { createLoan, updateLoan, getVendors, supabase, generateLoanNumber } from '../services/api';
import { calculateLoanDetails, calculateMonthlyPayment } from '../services/loanService';
import { Colors, Spacing, BorderRadius } from '../constants/Colors';
import { Button } from '../components/ui/Button';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

type RootStackParamList = {
  Loans: undefined;
  CreateLoan: { loanId?: string } | undefined;
};

type CreateLoanNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'CreateLoan'
>;
type CreateLoanRouteProp = RouteProp<RootStackParamList, 'CreateLoan'>;

export default function CreateLoanScreen() {
  const navigation = useNavigation<CreateLoanNavigationProp>();
  const route = useRoute<CreateLoanRouteProp>();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const queryClient = useQueryClient();

  const loanId = route.params?.loanId;
  const isEditMode = !!loanId;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Form fields
  const [lenderName, setLenderName] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [paymentFrequency, setPaymentFrequency] = useState<
    'monthly' | 'quarterly' | 'yearly'
  >('monthly');
  const [notes, setNotes] = useState('');

  // Data
  const [vendors, setVendors] = useState<any[]>([]);

  // Modals
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (isEditMode && loanId) {
      loadLoanForEdit();
    }
  }, [loanId]);

  const loadInitialData = async () => {
    if (!user) return;

    try {
      setLoadingData(true);
      const vendorsData = await getVendors(user.id);
      setVendors(vendorsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  const loadLoanForEdit = async () => {
    if (!loanId || !user) return;

    try {
      const { data: loan } = await supabase
        .from('loans')
        .select('*')
        .eq('id', loanId)
        .single();

      if (!loan) {
        Alert.alert('Error', 'Loan not found');
        navigation.goBack();
        return;
      }

      // Check if loan can be edited
      if (loan.status === 'paid_off') {
        Alert.alert('Cannot Edit', 'This loan is paid off and cannot be edited.');
        navigation.goBack();
        return;
      }

      // Load loan data into form
      setLenderName(loan.lender_name || '');
      setSelectedVendor(loan.vendor_id || '');
      setPrincipalAmount(loan.principal_amount.toString());
      setInterestRate(loan.interest_rate.toString());
      setTermMonths(loan.term_months.toString());
      setStartDate(new Date(loan.start_date));
      setPaymentFrequency(loan.payment_frequency || 'monthly');
      setNotes(loan.notes || '');
    } catch (error) {
      console.error('Error loading loan:', error);
      Alert.alert('Error', 'Failed to load loan');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!lenderName.trim()) {
      Alert.alert('Error', 'Please enter a lender name');
      return;
    }

    if (!principalAmount || parseFloat(principalAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid principal amount');
      return;
    }

    if (!interestRate || parseFloat(interestRate) < 0) {
      Alert.alert('Error', 'Please enter a valid interest rate');
      return;
    }

    if (!termMonths || parseInt(termMonths) <= 0) {
      Alert.alert('Error', 'Please enter a valid term in months');
      return;
    }

    if (!user) return;

    try {
      setLoading(true);

      // Calculate monthly payment
      const monthlyPayment = calculateMonthlyPayment(
        parseFloat(principalAmount),
        parseFloat(interestRate),
        parseInt(termMonths)
      );

      // Calculate end_date (start_date + term_months)
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + parseInt(termMonths));

      // Calculate first_payment_date (one payment period after start_date)
      const firstPaymentDate = new Date(startDate);
      if (paymentFrequency === 'monthly') {
        firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
      } else if (paymentFrequency === 'quarterly') {
        firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 3);
      } else if (paymentFrequency === 'yearly') {
        firstPaymentDate.setFullYear(firstPaymentDate.getFullYear() + 1);
      }

      // Generate loan number for new loans
      let loanNumber = '';
      if (!isEditMode) {
        loanNumber = await generateLoanNumber(user.id);
      }

      const loanData = {
        user_id: user.id,
        lender_name: lenderName,
        vendor_id: selectedVendor || null,
        principal_amount: parseFloat(principalAmount),
        interest_rate: parseFloat(interestRate),
        term_months: parseInt(termMonths),
        monthly_payment: monthlyPayment,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        first_payment_date: format(firstPaymentDate, 'yyyy-MM-dd'),
        payment_frequency: paymentFrequency,
        notes: notes || null,
        current_balance: parseFloat(principalAmount), // Initial balance equals principal
        status: 'active',
        ...(loanNumber && { loan_number: loanNumber }), // Add loan_number only for new loans
      };

      if (isEditMode) {
        // UPDATE existing loan
        await updateLoan(loanId, loanData, user.id);
        queryClient.invalidateQueries({ queryKey: ['loans', user.id] });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Loan updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // CREATE new loan
        await createLoan(loanData, user.id);
        queryClient.invalidateQueries({ queryKey: ['loans', user.id] });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Loan created successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error saving loan:', error);
      Alert.alert('Error', isEditMode ? 'Failed to update loan' : 'Failed to create loan');
    } finally {
      setLoading(false);
    }
  };

  const VendorSelector = () => {
    const selectedVendorData = vendors.find((v) => v.id === selectedVendor);

    return (
      <TouchableOpacity
        style={styles.vendorSelector}
        onPress={() => setShowVendorModal(true)}
      >
        <View style={styles.vendorSelectorContent}>
          {selectedVendorData ? (
            <View>
              <Text style={styles.selectedVendorName}>{selectedVendorData.name}</Text>
              {selectedVendorData.email && (
                <Text style={styles.selectedVendorEmail}>
                  {selectedVendorData.email}
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.vendorPlaceholder}>Select a vendor (optional)</Text>
          )}
        </View>
        <Feather name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>
    );
  };

  // Calculate preview values
  const getCalculatedValues = () => {
    const principal = parseFloat(principalAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const term = parseInt(termMonths) || 0;

    if (principal > 0 && term > 0) {
      const details = calculateLoanDetails(principal, rate, term);
      return details;
    }

    return null;
  };

  const calculatedValues = getCalculatedValues();

  if (loadingData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit Loan' : 'Add Loan'}
            </Text>

            <View style={styles.headerPlaceholder} />
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Lender Name */}
          <View style={styles.section}>
            <Text style={styles.label}>Lender Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Chase Bank, Wells Fargo"
              value={lenderName}
              onChangeText={setLenderName}
            />
          </View>

          {/* Vendor Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Lender/Vendor (Optional)</Text>
            <VendorSelector />
          </View>

          {/* Loan Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loan Details</Text>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.label}>Principal Amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  value={principalAmount}
                  onChangeText={setPrincipalAmount}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>Interest Rate (%)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.0"
                  value={interestRate}
                  onChangeText={setInterestRate}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.label}>Term (Months)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="12"
                  value={termMonths}
                  onChangeText={setTermMonths}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>Start Date</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Feather name="calendar" size={16} color="#6B7280" />
                  <Text style={styles.dateText}>
                    {format(startDate, 'MMM dd, yyyy')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Payment Frequency */}
          <View style={styles.section}>
            <Text style={styles.label}>Payment Frequency</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.frequencySelector}
            >
              {(['monthly', 'quarterly', 'yearly'] as const).map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.frequencyChip,
                    paymentFrequency === freq && styles.frequencyChipSelected,
                  ]}
                  onPress={() => setPaymentFrequency(freq)}
                >
                  <Text
                    style={[
                      styles.frequencyChipText,
                      paymentFrequency === freq && styles.frequencyChipTextSelected,
                    ]}
                  >
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add any notes about this loan..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Calculation Preview */}
          {calculatedValues && (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Loan Summary</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Monthly Payment</Text>
                  <Text style={styles.previewValue}>
                    {formatCurrency(calculatedValues.monthlyPayment)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Total Interest</Text>
                  <Text style={styles.previewValue}>
                    {formatCurrency(calculatedValues.totalInterest)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Total Amount</Text>
                  <Text style={[styles.previewValue, { color: '#DC2626' }]}>
                    {formatCurrency(calculatedValues.totalAmount)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <Button
              title={isEditMode ? 'Update Loan' : 'Create Loan'}
              onPress={handleSubmit}
              loading={loading}
              disabled={
                loading ||
                !lenderName.trim() ||
                !principalAmount ||
                !termMonths ||
                !interestRate
              }
              style={styles.submitButton}
            />
          </View>
        </ScrollView>

        {/* Date Picker */}
        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              setShowStartDatePicker(false);
              if (date) setStartDate(date);
            }}
          />
        )}

        {/* Vendor Selection Modal */}
        {showVendorModal && (
          <Modal
            visible={showVendorModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowVendorModal(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowVendorModal(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select Vendor</Text>
                  <ScrollView style={styles.vendorList}>
                    {/* None option */}
                    <TouchableOpacity
                      style={[
                        styles.vendorItem,
                        !selectedVendor && styles.vendorItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedVendor('');
                        setShowVendorModal(false);
                      }}
                    >
                      <Text style={styles.vendorItemName}>None</Text>
                      {!selectedVendor && (
                        <Feather name="check" size={20} color="#DC2626" />
                      )}
                    </TouchableOpacity>

                    {vendors.map((vendor) => (
                      <TouchableOpacity
                        key={vendor.id}
                        style={[
                          styles.vendorItem,
                          selectedVendor === vendor.id && styles.vendorItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedVendor(vendor.id);
                          setShowVendorModal(false);
                        }}
                      >
                        <View>
                          <Text style={styles.vendorItemName}>{vendor.name}</Text>
                          {vendor.email && (
                            <Text style={styles.vendorItemEmail}>{vendor.email}</Text>
                          )}
                        </View>
                        {selectedVendor === vendor.id && (
                          <Feather name="check" size={20} color="#DC2626" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vendorSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vendorSelectorContent: {
    flex: 1,
  },
  selectedVendorName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  selectedVendorEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  vendorPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  formField: {
    flex: 1,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateText: {
    fontSize: 14,
    color: '#1F2937',
  },
  frequencySelector: {
    marginTop: Spacing.sm,
  },
  frequencyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginRight: Spacing.sm,
  },
  frequencyChipSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  frequencyChipText: {
    fontSize: 14,
    color: '#6B7280',
  },
  frequencyChipTextSelected: {
    color: '#DC2626',
    fontWeight: '500',
  },
  notesInput: {
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  previewSection: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: Spacing.md,
  },
  previewCard: {
    backgroundColor: '#FEF2F2',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  previewLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  submitSection: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  submitButton: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
    paddingTop: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  vendorList: {
    paddingHorizontal: Spacing.lg,
  },
  vendorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  vendorItemSelected: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  vendorItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  vendorItemEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
});
