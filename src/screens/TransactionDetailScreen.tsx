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
import { Colors, Spacing, BorderRadius } from '../constants/Colors';
import { EditIncomeModal } from '../components/income/EditIncomeModal';
import { EditExpenseModal } from '../components/expense/EditExpenseModal';
import { RootStackParamList } from '../../App';

type TransactionDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TransactionDetail'>;
type TransactionDetailRouteProp = RouteProp<RootStackParamList, 'TransactionDetail'>;

export default function TransactionDetailScreen() {
 const navigation = useNavigation<TransactionDetailNavigationProp>();
 const route = useRoute<TransactionDetailRouteProp>();
 const { user } = useAuth();
 const { formatCurrency, baseCurrency } = useSettings();
 const queryClient = useQueryClient();
 
 const [transaction, setTransaction] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [deleting, setDeleting] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 
 const { transactionId, type } = route.params;
 const isIncome = type === 'income';

 // Currency formatter that handles different currency symbols
 const formatAmountWithCurrency = (amount: number, currencyCode?: string) => {
   const code = currencyCode || baseCurrency;
   
   try {
     return new Intl.NumberFormat('en-US', {
       style: 'currency',
       currency: code,
       minimumFractionDigits: 2,
       maximumFractionDigits: 2,
     }).format(amount);
   } catch (error) {
     // Fallback for unsupported currencies
     const currencySymbols: { [key: string]: string } = {
       'USD': '$',
       'EUR': '€',
       'GBP': '£',
       'INR': '₹',
       'JPY': '¥',
       'AUD': 'A$',
       'CAD': 'C$',
       'CHF': 'CHF',
       'CNY': '¥',
       'SEK': 'kr',
       'NZD': 'NZ$',
       'MXN': '$',
       'SGD': 'S$',
       'HKD': 'HK$',
       'NOK': 'kr',
       'KRW': '₩',
       'TRY': '₺',
       'RUB': '₽',
       'BRL': 'R$',
       'ZAR': 'R',
       'AED': 'د.إ',
       'SAR': '﷼',
       'PKR': '₨',
       'BDT': '৳',
       'PHP': '₱',
       'VND': '₫',
       'THB': '฿',
       'MYR': 'RM',
       'IDR': 'Rp',
     };
     
     const symbol = currencySymbols[code] || code + ' ';
     const formattedAmount = amount.toLocaleString('en-US', {
       minimumFractionDigits: 2,
       maximumFractionDigits: 2,
     });
     
     // Position symbol based on currency convention
     if (['EUR', 'SEK', 'NOK', 'VND'].includes(code)) {
       return `${formattedAmount} ${symbol}`;
     }
     return `${symbol}${formattedAmount}`;
   }
 };

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
     
     queryClient.invalidateQueries({ queryKey: ['incomes'] });
     queryClient.invalidateQueries({ queryKey: ['expenses'] });
     queryClient.invalidateQueries({ queryKey: ['dashboard'] });
     
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
   loadTransaction();
 };

 if (loading) {
   return (
     <SafeAreaView style={styles.container}>
       <View style={styles.loadingContainer}>
         <ActivityIndicator size="large" color="#6366F1" />
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

 // Calculate amounts
 const baseAmount = transaction.base_amount || transaction.amount;
 const displayAmount = transaction.amount;
 const taxAmount = transaction.tax_amount || 0;
 const baseTaxAmount = transaction.base_tax_amount || taxAmount;
 const totalAmount = displayAmount + taxAmount;
 const totalBaseAmount = baseAmount + baseTaxAmount;
 const currency = transaction.currency || baseCurrency;
 const isMultiCurrency = currency !== baseCurrency;

 return (
   <SafeAreaView style={styles.container} edges={['top']}>
     {/* Header */}
     <LinearGradient
       colors={['#3B82F6', '#8B5CF6']}
       style={styles.header}
     >
       <TouchableOpacity 
         style={styles.backButton}
         onPress={() => navigation.goBack()}
       >
         <Feather name="arrow-left" size={24} color="#FFFFFF" />
       </TouchableOpacity>
       <Text style={styles.headerTitle}>Transaction Details</Text>
       <View style={styles.headerActions}>
         <TouchableOpacity 
           style={styles.headerButton}
           onPress={handleEdit}
         >
           <Feather name="edit-2" size={20} color="#FFFFFF" />
         </TouchableOpacity>
         <TouchableOpacity 
           style={styles.headerButton}
           onPress={handleDelete}
           disabled={deleting}
         >
           {deleting ? (
             <ActivityIndicator size="small" color="#FFFFFF" />
           ) : (
             <Feather name="trash-2" size={20} color="#FFFFFF" />
           )}
         </TouchableOpacity>
       </View>
     </LinearGradient>

     <ScrollView 
       style={styles.content}
       showsVerticalScrollIndicator={false}
     >
       {/* Amount Card */}
       <LinearGradient
         colors={isIncome ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
         style={styles.amountCard}
       >
         <View style={styles.amountHeader}>
           <View style={styles.typeIcon}>
             <MaterialIcons 
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
           {formatAmountWithCurrency(totalAmount, currency)}
         </Text>
         
         {/* Currency Badge for non-base currencies */}
         {currency && currency !== baseCurrency && (
           <View style={styles.currencyBadge}>
             <Text style={styles.currencyText}>{currency}</Text>
           </View>
         )}
         
         {/* Multi-currency display */}
         {isMultiCurrency && (
           <Text style={styles.baseAmountText}>
             {formatAmountWithCurrency(totalBaseAmount, baseCurrency)} in {baseCurrency}
           </Text>
         )}
         
         {/* Tax breakdown */}
         {taxAmount > 0 && (
           <View style={styles.taxBreakdown}>
             <Text style={styles.taxLabel}>
               Includes {formatAmountWithCurrency(taxAmount, currency)} tax
             </Text>
             {transaction.tax_rate && (
               <Text style={styles.taxRate}>
                 ({transaction.tax_rate}%)
               </Text>
             )}
           </View>
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

         {/* Exchange Rate if multi-currency */}
         {isMultiCurrency && transaction.exchange_rate && (
           <View style={styles.detailRow}>
             <View style={styles.detailIcon}>
               <MaterialIcons name="swap-horiz" size={18} color="#6B7280" />
             </View>
             <View style={styles.detailContent}>
               <Text style={styles.detailLabel}>Exchange Rate</Text>
               <Text style={styles.detailValue}>
                 1 {currency} = {transaction.exchange_rate.toFixed(4)} {baseCurrency}
               </Text>
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

         {/* Recurring Status */}
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
   backgroundColor: '#F9FAFB',
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
   color: '#6B7280',
 },
 header: {
   flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'space-between',
   paddingHorizontal: Spacing.lg,
   paddingVertical: Spacing.md,
 },
 backButton: {
   padding: 8,
   marginLeft: -8,
 },
 headerTitle: {
   fontSize: 18,
   fontWeight: '600',
   color: '#FFFFFF',
   flex: 1,
   textAlign: 'center',
 },
 headerActions: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
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
   marginBottom: Spacing.sm,
 },
 typeIcon: {
   width: 40,
   height: 40,
   borderRadius: 20,
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
   fontSize: 32,
   fontWeight: '700',
   color: '#FFFFFF',
   marginBottom: Spacing.xs,
 },
 currencyBadge: {
   backgroundColor: 'rgba(255, 255, 255, 0.2)',
   paddingHorizontal: 12,
   paddingVertical: 4,
   borderRadius: 12,
   marginBottom: 8,
 },
 currencyText: {
   fontSize: 12,
   fontWeight: '600',
   color: '#FFFFFF',
 },
 baseAmountText: {
   fontSize: 14,
   color: 'rgba(255, 255, 255, 0.9)',
   marginBottom: 8,
 },
 taxBreakdown: {
   flexDirection: 'row',
   alignItems: 'center',
   gap: 8,
   marginTop: 8,
 },
 taxLabel: {
   fontSize: 14,
   color: 'rgba(255, 255, 255, 0.9)',
 },
 taxRate: {
   fontSize: 14,
   color: 'rgba(255, 255, 255, 0.8)',
 },
 detailsCard: {
   margin: Spacing.lg,
   marginTop: 0,
   backgroundColor: '#FFFFFF',
   borderRadius: BorderRadius.lg,
   padding: Spacing.lg,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 1 },
   shadowOpacity: 0.05,
   shadowRadius: 2,
   elevation: 1,
 },
 sectionTitle: {
   fontSize: 16,
   fontWeight: '600',
   color: '#1F2937',
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
   borderRadius: 8,
   backgroundColor: '#F3F4F6',
   justifyContent: 'center',
   alignItems: 'center',
   marginRight: Spacing.md,
 },
 detailContent: {
   flex: 1,
 },
 detailLabel: {
   fontSize: 12,
   color: '#6B7280',
   marginBottom: 2,
 },
 detailValue: {
   fontSize: 14,
   fontWeight: '500',
   color: '#1F2937',
 },
 notesCard: {
   margin: Spacing.lg,
   marginTop: 0,
   backgroundColor: '#FFFFFF',
   borderRadius: BorderRadius.lg,
   padding: Spacing.lg,
   shadowColor: '#000',
   shadowOffset: { width: 0, height: 1 },
   shadowOpacity: 0.05,
   shadowRadius: 2,
   elevation: 1,
 },
 notesText: {
   fontSize: 14,
   color: '#4B5563',
   lineHeight: 20,
 },
 timestampsCard: {
   margin: Spacing.lg,
   marginTop: 0,
   marginBottom: Spacing.xl,
 },
 timestampText: {
   fontSize: 12,
   color: '#9CA3AF',
   textAlign: 'center',
   marginBottom: 4,
 },
});