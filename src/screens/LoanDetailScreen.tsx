// src/screens/LoanDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useQueryClient } from '@tanstack/react-query';
import { getLoan, getLoanPayments, deleteLoan } from '../services/api';
import {
  calculateLoanProgress,
  generateAmortizationSchedule,
  calculateLoanDetails,
  AmortizationPayment,
} from '../services/loanService';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RecordPaymentModal } from '../components/loans/RecordPaymentModal';

type RootStackParamList = {
  Loans: undefined;
  LoanDetail: { loanId: string };
  CreateLoan: { loanId?: string } | undefined;
};

type LoanDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LoanDetail'>;
type LoanDetailRouteProp = RouteProp<RootStackParamList, 'LoanDetail'>;

export default function LoanDetailScreen() {
  const navigation = useNavigation<LoanDetailNavigationProp>();
  const route = useRoute<LoanDetailRouteProp>();
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const queryClient = useQueryClient();

  const [loan, setLoan] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [amortizationSchedule, setAmortizationSchedule] = useState<AmortizationPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loanId = route.params?.loanId;

  useEffect(() => {
    if (loanId && user) {
      loadLoanData();
    }
  }, [loanId, user]);

  const loadLoanData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [loanData, paymentsData] = await Promise.all([
        getLoan(loanId, user.id),
        getLoanPayments(loanId, user.id),
      ]);

      setLoan(loanData);
      setPayments(paymentsData);

      // Generate amortization schedule
      if (loanData) {
        const schedule = generateAmortizationSchedule(
          loanData.principal_amount,
          loanData.interest_rate,
          loanData.term_months,
          new Date(loanData.start_date),
          loanData.payment_frequency || 'monthly'
        );
        setAmortizationSchedule(schedule);
      }
    } catch (error) {
      console.error('Error loading loan:', error);
      Alert.alert('Error', 'Failed to load loan details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!loan || !user) return;

    try {
      await deleteLoan(loan.id, user.id);
      queryClient.invalidateQueries({ queryKey: ['loans', user.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Loan deleted successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting loan:', error);
      Alert.alert('Error', 'Failed to delete loan');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const handlePaymentRecorded = () => {
    // Reload loan data after payment is recorded
    loadLoanData();
  };

  // Get next payment from amortization schedule
  const nextPayment =
    amortizationSchedule.length > 0 && payments.length < amortizationSchedule.length
      ? amortizationSchedule[payments.length]
      : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#F59E0B';
      case 'paid_off':
        return '#10B981';
      case 'defaulted':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return 'trending-up';
      case 'paid_off':
        return 'check-circle';
      case 'defaulted':
        return 'error-outline';
      default:
        return 'help-outline';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      </SafeAreaView>
    );
  }

  if (!loan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Loan not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const loanDetails = calculateLoanDetails(
    loan.principal_amount,
    loan.interest_rate,
    loan.term_months
  );

  const progress = calculateLoanProgress(
    loan.principal_amount,
    loan.current_balance || loan.principal_amount
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBackButton}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Loan Details</Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateLoan', { loanId: loan.id })}
              style={styles.headerActionButton}
            >
              <Feather name="edit-2" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Loan Document Card */}
        <View style={styles.loanDocument}>
          {/* Header with Progress */}
          <View style={styles.documentHeader}>
            <View style={styles.patternOverlay} />

            <View style={styles.documentHeaderContent}>
              {/* Loan Title */}
              <View style={styles.loanHeader}>
                <Text style={styles.loanTitle}>{loan.lender_name || 'Loan'}</Text>
                {loan.vendor && (
                  <Text style={styles.vendorName}>via {loan.vendor.name}</Text>
                )}

                {/* Status Badge */}
                <View style={styles.statusBadge}>
                  <MaterialIcons
                    name={getStatusIcon(loan.status) as any}
                    size={16}
                    color={getStatusColor(loan.status)}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(loan.status) },
                    ]}
                  >
                    {loan.status.toUpperCase().replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Loan Progress</Text>
                  <Text style={styles.progressPercentage}>{progress.toFixed(1)}%</Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <LinearGradient
                      colors={['#DC2626', '#F59E0B', '#10B981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressBarFill, { width: `${progress}%` }]}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Document Body */}
          <View style={styles.documentBody}>
            {/* Loan Summary Cards */}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Loan Amount</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(loan.principal_amount)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Amount Left</Text>
                <Text style={[styles.summaryValue, { color: '#DC2626' }]}>
                  {formatCurrency(loan.current_balance || loan.principal_amount)}
                </Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Monthly Payment</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(loanDetails.monthlyPayment)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Interest Rate</Text>
                <Text style={styles.summaryValue}>{loan.interest_rate}%</Text>
              </View>
            </View>

            {/* Loan Details Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Loan Details</Text>
              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Start Date</Text>
                  <Text style={styles.detailValue}>
                    {format(new Date(loan.start_date), 'MMM dd, yyyy')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>End Date</Text>
                  <Text style={styles.detailValue}>
                    {format(
                      new Date(
                        new Date(loan.start_date).setMonth(
                          new Date(loan.start_date).getMonth() + loan.term_months
                        )
                      ),
                      'MMM dd, yyyy'
                    )}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Term</Text>
                  <Text style={styles.detailValue}>{loan.term_months} months</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Frequency</Text>
                  <Text style={styles.detailValue}>
                    {(loan.payment_frequency || 'monthly')
                      .charAt(0)
                      .toUpperCase() + (loan.payment_frequency || 'monthly').slice(1)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Interest</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(loanDetails.totalInterest)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Amount</Text>
                  <Text style={[styles.detailValue, { fontWeight: '700' }]}>
                    {formatCurrency(loanDetails.totalAmount)}
                  </Text>
                </View>
              </View>

              {loan.notes && (
                <View style={styles.notesCard}>
                  <Text style={styles.notesLabel}>Notes</Text>
                  <Text style={styles.notesText}>{loan.notes}</Text>
                </View>
              )}
            </View>

            {/* Payment History */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment History</Text>
              {payments.length > 0 ? (
                <View style={styles.paymentsContainer}>
                  {payments.map((payment) => (
                    <View key={payment.id} style={styles.paymentCard}>
                      <View style={styles.paymentHeader}>
                        <Text style={styles.paymentDate}>
                          {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                        </Text>
                        <Text style={styles.paymentAmount}>
                          {formatCurrency(payment.total_payment)}
                        </Text>
                      </View>
                      <View style={styles.paymentDetails}>
                        <View style={styles.paymentDetailRow}>
                          <Text style={styles.paymentDetailLabel}>Loan Amount:</Text>
                          <Text style={styles.paymentDetailValue}>
                            {formatCurrency(payment.principal_amount || 0)}
                          </Text>
                        </View>
                        <View style={styles.paymentDetailRow}>
                          <Text style={styles.paymentDetailLabel}>Interest:</Text>
                          <Text style={styles.paymentDetailValue}>
                            {formatCurrency(payment.interest_amount || 0)}
                          </Text>
                        </View>
                      </View>
                      {payment.notes && (
                        <Text style={styles.paymentNotes}>{payment.notes}</Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <MaterialIcons name="payment" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No payments recorded yet</Text>
                </View>
              )}
            </View>

            {/* Payment Schedule */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.scheduleHeader}
                onPress={() => {
                  setShowSchedule(!showSchedule);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={styles.sectionTitle}>Payment Schedule</Text>
                <Feather
                  name={showSchedule ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {showSchedule && (
                <View style={styles.scheduleContainer}>
                  <View style={styles.scheduleTable}>
                    {/* Table Header */}
                    <View style={styles.scheduleHeaderRow}>
                      <Text style={[styles.scheduleHeaderText, { flex: 0.8 }]}>#</Text>
                      <Text style={[styles.scheduleHeaderText, { flex: 1.5 }]}>
                        Date
                      </Text>
                      <Text style={[styles.scheduleHeaderText, { flex: 1.2 }]}>
                        Payment
                      </Text>
                      <Text style={[styles.scheduleHeaderText, { flex: 1.2 }]}>
                        Loan Amt
                      </Text>
                      <Text style={[styles.scheduleHeaderText, { flex: 1.2 }]}>
                        Interest
                      </Text>
                      <Text style={[styles.scheduleHeaderText, { flex: 1.3 }]}>
                        Left
                      </Text>
                    </View>

                    {/* Table Rows */}
                    <ScrollView
                      style={styles.scheduleScrollView}
                      nestedScrollEnabled
                    >
                      {amortizationSchedule.map((payment, index) => (
                        <View
                          key={payment.paymentNumber}
                          style={[
                            styles.scheduleRow,
                            index % 2 === 0 && styles.scheduleRowEven,
                          ]}
                        >
                          <Text style={[styles.scheduleCell, { flex: 0.8 }]}>
                            {payment.paymentNumber}
                          </Text>
                          <Text
                            style={[styles.scheduleCell, { flex: 1.5 }]}
                            numberOfLines={1}
                          >
                            {format(payment.paymentDate, 'MMM yyyy')}
                          </Text>
                          <Text
                            style={[styles.scheduleCell, { flex: 1.2 }]}
                            numberOfLines={1}
                          >
                            {formatCurrency(payment.totalPayment)}
                          </Text>
                          <Text
                            style={[styles.scheduleCell, { flex: 1.2 }]}
                            numberOfLines={1}
                          >
                            {formatCurrency(payment.principalPayment)}
                          </Text>
                          <Text
                            style={[styles.scheduleCell, { flex: 1.2 }]}
                            numberOfLines={1}
                          >
                            {formatCurrency(payment.interestPayment)}
                          </Text>
                          <Text
                            style={[styles.scheduleCell, { flex: 1.3 }]}
                            numberOfLines={1}
                          >
                            {formatCurrency(payment.remainingBalance)}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.recordPaymentButton}
            onPress={() => setShowRecordPaymentModal(true)}
            disabled={loan.status === 'paid_off'}
          >
            <LinearGradient
              colors={
                loan.status === 'paid_off'
                  ? ['#9CA3AF', '#6B7280']
                  : ['#10B981', '#059669']
              }
              style={styles.recordPaymentGradient}
            >
              <MaterialIcons name="payment" size={20} color="#FFFFFF" />
              <Text style={styles.recordPaymentText}>Record Payment</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('CreateLoan', { loanId: loan.id })}
            >
              <Feather name="edit-2" size={18} color="#6B7280" />
              <Text style={styles.actionButtonText}>Edit Loan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setShowDeleteConfirm(true)}
            >
              <Feather name="trash-2" size={18} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeleteConfirm(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={98} tint="light" style={styles.confirmModal}>
              <View style={styles.confirmContent}>
                <MaterialIcons name="warning" size={48} color="#EF4444" />
                <Text style={styles.confirmTitle}>Delete Loan?</Text>
                <Text style={styles.confirmMessage}>
                  This will permanently delete this loan and all its payment history.
                  This action cannot be undone.
                </Text>

                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowDeleteConfirm(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmDeleteButton}
                    onPress={handleDelete}
                  >
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </BlurView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        visible={showRecordPaymentModal}
        loan={loan}
        nextPayment={nextPayment}
        existingPayments={payments}
        onClose={() => setShowRecordPaymentModal(false)}
        onPaymentRecorded={handlePaymentRecorded}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
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
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loanDocument: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  documentHeader: {
    backgroundColor: '#DC2626',
    padding: 24,
    position: 'relative',
  },
  patternOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
    backgroundColor: '#000',
  },
  documentHeaderContent: {
    position: 'relative',
  },
  loanHeader: {
    marginBottom: 20,
  },
  loanTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  vendorName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  progressSection: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarBackground: {
    flex: 1,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  documentBody: {
    padding: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailsCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  notesCard: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350F',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  paymentsContainer: {
    gap: 12,
  },
  paymentCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  paymentDetails: {
    gap: 6,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  paymentDetailValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  paymentNotes: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scheduleTable: {
    maxHeight: 400,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  scheduleHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  scheduleScrollView: {
    maxHeight: 350,
  },
  scheduleRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  scheduleRowEven: {
    backgroundColor: '#FAFAFA',
  },
  scheduleCell: {
    fontSize: 11,
    color: '#374151',
  },
  actionsSection: {
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  recordPaymentButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  recordPaymentGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  recordPaymentText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModal: {
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
  },
  confirmContent: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
