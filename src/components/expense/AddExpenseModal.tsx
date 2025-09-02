// src/components/expense/AddExpenseModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../contexts/SettingsContext';
import { createExpense, getCategories, getVendors, supabase } from '../../services/api';
import { OCRService } from '../../services/ocrService';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/Colors';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ visible, onClose }) => {
  const { user } = useAuth();
  const { currencySymbol, formatCurrency, baseCurrency, isUKBusiness, convertToBaseCurrency, getCurrencySymbol, enabledCurrencies, taxRates } = useSettings();
  const queryClient = useQueryClient();
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingOCR, setProcessingOCR] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState<any>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  const [taxRate, setTaxRate] = useState("0");
  const [includeTax, setIncludeTax] = useState(false);

  const [currency, setCurrency] = useState(baseCurrency);
const [showCurrencySelector, setShowCurrencySelector] = useState(false);
const [convertedPreview, setConvertedPreview] = useState(0);
const [availableCurrencies, setAvailableCurrencies] = useState<Array<{code: string, symbol: string, name: string}>>([]);

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  PKR: 'Pakistani Rupee',
  INR: 'Indian Rupee',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
  JPY: 'Japanese Yen',
  CNY: 'Chinese Yuan',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
};
  
  // Quick add vendor modal states
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [newVendorData, setNewVendorData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ['categories', user?.id, 'expense'],
    queryFn: () => getCategories(user!.id, 'expense'),
    enabled: !!user,
  });
  // Add these after your other states
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#EF4444");

  const CATEGORY_COLORS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
    '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  ];

  

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setSelectedVendor('');
    setSelectedCategory('');
    setSelectedDate(new Date());
    setReceiptUri(null);
    setSuggestedCategory(null);
    setTaxRate("0");
    setIncludeTax(false);
    setNewCategoryName("");  // ADD THIS
    setNewCategoryColor("#EF4444");  // ADD THIS
  };

  // Load enabled currencies from settings
React.useEffect(() => {
  if (visible && enabledCurrencies) {
    const currencies = enabledCurrencies.map(code => ({
      code,
      symbol: getCurrencySymbol(code),
      name: CURRENCY_NAMES[code] || code
    }));
    setAvailableCurrencies(currencies);
    setCurrency(baseCurrency);
  }
}, [visible, enabledCurrencies, baseCurrency, getCurrencySymbol]);

// Preview conversion
React.useEffect(() => {
  if (currency !== baseCurrency && amount) {
    convertToBaseCurrency(parseFloat(amount || '0'), currency)
      .then(({ baseAmount }) => setConvertedPreview(baseAmount))
      .catch(() => setConvertedPreview(0));
  } else {
    setConvertedPreview(0);
  }
}, [amount, currency, baseCurrency]);

  // AI categorization using your edge function
  // src/components/expense/AddExpenseModal.tsx
// Update the AI categorization effect to use your existing edge function

useEffect(() => {
  if (description && amount && !isProcessingAI && categories && categories.length > 0) {
    const timeoutId = setTimeout(async () => {
      try {
        setIsProcessingAI(true);
        
        const selectedVendorData = vendors?.find(v => v.id === selectedVendor);
        const vendorName = selectedVendorData?.name || '';
        
        // Call your existing AI assistant edge function
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            feature: 'expense_category',
            userId: user?.id,
            data: {
              description,
              vendor: vendorName,
              amount: parseFloat(amount) || 0,
              categories: categories.map(c => ({ 
                id: c.id, 
                name: c.name,
                color: c.color 
              }))
            }
          }
        });

        if (!error && data?.suggestion) {
          // Map the response to match your format
          setSuggestedCategory({
            categoryId: data.suggestion.categoryId,
            category: data.suggestion.category,
            confidence: data.suggestion.confidence,
            reasoning: data.suggestion.reasoning,
            color: categories.find(c => c.id === data.suggestion.categoryId)?.color || '#EF4444'
          });
        }
      } catch (error) {
        console.error('AI categorization error:', error);
      } finally {
        setIsProcessingAI(false);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }
}, [description, amount, selectedVendor, categories, user]);

  const handleCameraPress = async () => {
    const uri = await OCRService.pickImageFromCamera();
    if (uri) {
      setReceiptUri(uri);
      processReceipt(uri);
    }
  };

  const handleGalleryPress = async () => {
    const uri = await OCRService.pickImageFromGallery();
    if (uri) {
      setReceiptUri(uri);
      processReceipt(uri);
    }
  };

// In AddExpenseModal.tsx, update the processReceipt function
const processReceipt = async (uri: string) => {
  setProcessingOCR(true);
  try {
    const result = await OCRService.processReceipt(uri);
    
    // Set amount
    if (result.amount) setAmount(result.amount.toString());
    
    // Set description
    if (result.description) setDescription(result.description);
    
    // Set date - IMPORTANT: Check if date was extracted
    if (result.date) {
      // If we got a date from OCR, use it
      const extractedDate = new Date(result.date);
      if (!isNaN(extractedDate.getTime())) {
        setSelectedDate(extractedDate);
      }
    }
    // If no date from OCR, keep the current date (today)
    
    // Try to match vendor - Fixed the type check
    if (result.vendor && vendors) {
      const vendorLower = result.vendor.toLowerCase();
      const matchedVendor = vendors.find(v => 
        v.name.toLowerCase().includes(vendorLower) ||
        vendorLower.includes(v.name.toLowerCase())
      );
      if (matchedVendor) {
        setSelectedVendor(matchedVendor.id);
      }
    }
    
    // After OCR completes and we have description and amount,
    // the useEffect for AI categorization will automatically trigger
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    Alert.alert('Error', 'Failed to process receipt');
  } finally {
    setProcessingOCR(false);
  }
};

const { data: vendors, refetch: refetchVendors } = useQuery({
    queryKey: ['vendors', user?.id],
    queryFn: () => getVendors(user!.id),
    enabled: !!user,
  });
  const handleQuickAddVendor = async () => {
    if (!newVendorData.name.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert([{
          user_id: user.id,
          name: newVendorData.name.trim(),
          email: newVendorData.email.trim() || null,
          phone: newVendorData.phone.trim() || null,
          address: newVendorData.address.trim() || null,
        }])
        .select()
        .single();

      if (error) throw error;

      await refetchVendors();
      setSelectedVendor(data.id);
      setShowAddVendor(false);
      setNewVendorData({ name: "", email: "", phone: "", address: "" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to add vendor');
    }
  };


    const handleQuickAddCategory = async () => {
    if (!newCategoryName.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          user_id: user.id,
          name: newCategoryName.trim(),
          type: 'expense',
          color: newCategoryColor,
        }])
        .select()
        .single();

      if (error) throw error;

      await refetchCategories();
      setSelectedCategory(data.id);
      setShowAddCategory(false);
      setNewCategoryName("");
      setNewCategoryColor("#EF4444");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to add category');
    }
  };
  const handleSubmit = async () => {
  if (!amount || !description || !user) return;

  setLoading(true);
  
  try {
    const amountNum = parseFloat(amount);
    const taxRateNum = includeTax ? (parseFloat(taxRate) || 0) : 0;
    const taxAmountCalc = taxRateNum > 0 ? (amountNum * taxRateNum) / 100 : 0;

    // Convert to base currency
    const { baseAmount, exchangeRate } = await convertToBaseCurrency(amountNum, currency);
    const baseTaxAmount = taxRateNum > 0 ? (baseAmount * taxRateNum) / 100 : 0;

    const expenseData: any = {
      user_id: user.id,
      amount: amountNum,
      description,
      vendor_id: selectedVendor || null,
      category_id: selectedCategory || suggestedCategory?.categoryId || null,
      date: format(selectedDate, 'yyyy-MM-dd'),
      receipt_url: receiptUri || null,
      tax_rate: taxRateNum || null,
      tax_amount: taxAmountCalc || null,
      currency: currency,
      base_amount: baseAmount,
      exchange_rate: exchangeRate,
    };

    await createMutation.mutateAsync(expenseData);
  } catch (error) {
    console.error('Error creating expense:', error);
    Alert.alert('Error', 'Failed to create expense');
  } finally {
    setLoading(false);
  }
};

  const useDropdownForVendors = vendors && vendors.length > 5;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#FFFFFF', '#FEF2F2']}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={onClose}>
                <Feather name="x" size={24} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Receipt Scanner Section */}
              <View style={styles.scannerSection}>
                <Text style={styles.sectionTitle}>Scan Receipt</Text>
                <View style={styles.scannerButtons}>
                  <TouchableOpacity 
                    style={styles.scanButton}
                    onPress={handleCameraPress}
                  >
                    <Feather name="camera" size={24} color="#EF4444" />
                    <Text style={styles.scanButtonText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.scanButton}
                    onPress={handleGalleryPress}
                  >
                    <Feather name="image" size={24} color="#EF4444" />
                    <Text style={styles.scanButtonText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
                
                {receiptUri && (
                  <View style={styles.receiptPreview}>
                    <Image source={{ uri: receiptUri }} style={styles.receiptImage} />
                    {processingOCR && (
                      <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                        <Text style={styles.processingText}>Processing receipt...</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Amount Input with Currency Selector */}
              <View style={styles.amountSection}>
                <Text style={styles.inputLabel}>Amount</Text>
                <View style={styles.amountRow}>
                  <TouchableOpacity 
                    style={styles.currencySelector}
                    onPress={() => setShowCurrencySelector(true)}
                  >
                    <Text style={styles.currencySelectorText}>
                      {getCurrencySymbol(currency)} {currency}
                    </Text>
                    <Feather name="chevron-down" size={16} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                  <View style={styles.amountInputContainer}>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      placeholderTextColor={Colors.light.textTertiary}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                {currency !== baseCurrency && amount && convertedPreview > 0 && (
                  <Text style={styles.conversionNote}>
                    ≈ {formatCurrency(convertedPreview)} (will be converted at current rate)
                  </Text>
                )}
              </View>

              {/* Description */}
              <Input
                label="Description"
                placeholder="What was this expense for?"
                value={description}
                onChangeText={setDescription}
                icon="edit-3"
              />
              
                {/* Tax Section */}
<TouchableOpacity
  style={styles.taxToggle}
  onPress={() => setIncludeTax(!includeTax)}
>
  <MaterialIcons 
    name={includeTax ? "check-box" : "check-box-outline-blank"} 
    size={24} 
    color="#EF4444" 
  />
  <Text style={styles.taxToggleText}>
    {isUKBusiness ? 'Apply VAT' : 'Apply Tax'}
  </Text>
</TouchableOpacity>

{includeTax && (
  <View style={styles.taxSection}>
    <Text style={styles.inputLabel}>{isUKBusiness ? 'VAT Rate' : 'Tax Rate'}</Text>
    
    {/* Show saved tax rates as buttons */}
    {taxRates && Object.keys(taxRates).length > 0 ? (
      <View style={styles.taxRateButtons}>
        {Object.entries(taxRates).map(([name, rate]) => (
          <TouchableOpacity
            key={name}
            style={[
              styles.taxRateButton,
              taxRate === String(rate) && styles.taxRateButtonSelected
            ]}
            onPress={() => setTaxRate(String(rate))}
          >
            <Text style={[
              styles.taxRateButtonText,
              taxRate === String(rate) && styles.taxRateButtonTextSelected
            ]}>
              {name}
            </Text>
            <Text style={[
              styles.taxRatePercent,
              taxRate === String(rate) && styles.taxRatePercentSelected
            ]}>
              {rate}%
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.taxRateButton,
            !Object.values(taxRates).includes(Number(taxRate)) && taxRate !== "0" && styles.taxRateButtonSelected
          ]}
          onPress={() => setTaxRate("0")}
        >
          <Text style={styles.taxRateButtonText}>Custom</Text>
        </TouchableOpacity>
      </View>
    ) : null}
    
    {/* Show input for custom rate or if no saved rates */}
    {(!taxRates || Object.keys(taxRates).length === 0 || !Object.values(taxRates).includes(Number(taxRate))) && (
      <View style={styles.taxInputContainer}>
        <TextInput
          style={styles.taxInput}
          placeholder="0"
          value={taxRate}
          onChangeText={setTaxRate}
          keyboardType="decimal-pad"
        />
        <Text style={styles.taxPercent}>%</Text>
      </View>
    )}
    
    {parseFloat(taxRate) > 0 && parseFloat(amount) > 0 && (
      <View style={styles.taxCalculation}>
        <Text style={styles.taxCalcText}>
          Tax: {getCurrencySymbol(currency)} {(parseFloat(amount) * parseFloat(taxRate) / 100).toFixed(2)}
        </Text>
        <Text style={styles.taxCalcText}>
          Total: {getCurrencySymbol(currency)} {(parseFloat(amount) * (1 + parseFloat(taxRate) / 100)).toFixed(2)}
        </Text>
      </View>
    )}
  </View>
)}

                {/* Vendor Selection */}
              <View style={styles.selectionSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.inputLabel}>Vendor (Optional)</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddVendor(true)}
                  >
                    <Feather name="plus" size={16} color="#EF4444" />
                    <Text style={styles.addButtonText}>Add New</Text>
                  </TouchableOpacity>
                </View>
                
                {vendors && vendors.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[
                        styles.selectionChip,
                        !selectedVendor && styles.selectionChipSelected,
                      ]}
                      onPress={() => setSelectedVendor('')}
                    >
                      <Text
                        style={[
                          styles.selectionChipText,
                          !selectedVendor && styles.selectionChipTextSelected,
                        ]}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                    {vendors.map((vendor: any) => (
                      <TouchableOpacity
                        key={vendor.id}
                        style={[
                          styles.selectionChip,
                          selectedVendor === vendor.id && styles.selectionChipSelected,
                        ]}
                        onPress={() => setSelectedVendor(vendor.id)}
                      >
                        <Text
                          style={[
                            styles.selectionChipText,
                            selectedVendor === vendor.id && styles.selectionChipTextSelected,
                          ]}
                        >
                          {vendor.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => setShowAddVendor(true)}
                  >
                    <Feather name="plus" size={18} color="#EF4444" />
                    <Text style={styles.emptyStateText}>Add your first vendor</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Date Picker */}
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.inputLabel}>Date</Text>
                <View style={styles.datePickerContent}>
                  <Feather name="calendar" size={20} color={Colors.light.textSecondary} />
                  <Text style={styles.datePickerText}>
                    {format(selectedDate, 'MMM dd, yyyy')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Smart Category Suggestion */}
              {suggestedCategory && !selectedCategory && (
                <View style={styles.suggestionBox}>
                  <View style={styles.suggestionHeader}>
                    <MaterialIcons name="auto-awesome" size={16} color="#F59E0B" />
                    <Text style={styles.suggestionTitle}>AI Suggestion</Text>
                    {isProcessingAI && <ActivityIndicator size="small" color="#F59E0B" />}
                  </View>
                  <TouchableOpacity
                    style={styles.suggestionChip}
                    onPress={() => setSelectedCategory(suggestedCategory.categoryId)}
                  >
                    <View style={[styles.suggestionDot, { backgroundColor: suggestedCategory.color || '#EF4444' }]} />
                    <Text style={styles.suggestionText}>{suggestedCategory.category}</Text>
                    <Text style={styles.suggestionConfidence}>
                      {Math.round(suggestedCategory.confidence * 100)}% match
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.suggestionReason}>{suggestedCategory.reasoning}</Text>
                </View>
              )}

              {/* Category Selection */}
              <View style={styles.categorySection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddCategory(true)}
                  >
                    <Feather name="plus" size={16} color={Colors.light.primary} />
                    <Text style={[styles.addButtonText, { color: Colors.light.primary }]}>
                      Add New
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.categoryGrid}>
                  {categories?.map((category: any) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        selectedCategory === category.id && styles.categoryChipSelected,
                      ]}
                      onPress={() => setSelectedCategory(category.id)}
                    >
                      <View style={[styles.categoryChipDot, { backgroundColor: category.color }]} />
                      <Text style={[
                        styles.categoryChipText,
                        selectedCategory === category.id && styles.categoryChipTextSelected,
                      ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={onClose}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Add Expense"
                onPress={handleSubmit}
                loading={loading}
                disabled={!amount || !description}
                style={styles.modalButton}
              />
            </View>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          onChange={(event: any, date?: Date) => {
            setShowDatePicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}
      {/* Quick Add Vendor Modal */}
      <Modal
        visible={showAddVendor}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddVendor(false)}
      >
        <View style={styles.quickModalOverlay}>
          <View style={styles.quickModalContent}>
            <Text style={styles.quickModalTitle}>Add New Vendor</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Vendor Name *"
                placeholder="e.g., Amazon, Local Store"
                value={newVendorData.name}
                onChangeText={(text) => setNewVendorData({ ...newVendorData, name: text })}
                icon="shopping-bag"
              />
              
              <Input
                label="Email"
                placeholder="vendor@example.com"
                value={newVendorData.email}
                onChangeText={(text) => setNewVendorData({ ...newVendorData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail"
              />
              
              <Input
                label="Phone"
                placeholder="+1 (555) 123-4567"
                value={newVendorData.phone}
                onChangeText={(text) => setNewVendorData({ ...newVendorData, phone: text })}
                keyboardType="phone-pad"
                icon="phone"
              />
              
              <Input
                label="Address"
                placeholder="123 Main St, City, State"
                value={newVendorData.address}
                onChangeText={(text) => setNewVendorData({ ...newVendorData, address: text })}
                multiline
                numberOfLines={3}
                icon="map-pin"
              />
            </ScrollView>
            
            <View style={styles.quickModalActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddVendor(false);
                  setNewVendorData({ name: "", email: "", phone: "", address: "" });
                }}
                variant="ghost"
                style={styles.quickModalButton}
              />
              <Button
                title="Add Vendor"
                onPress={handleQuickAddVendor}
                disabled={!newVendorData.name.trim()}
                style={styles.quickModalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
      {/* Quick Add Category Modal */}
      <Modal
        visible={showAddCategory}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddCategory(false)}
      >
        <View style={styles.quickModalOverlay}>
          <View style={styles.quickModalContent}>
            <Text style={styles.quickModalTitle}>Add Expense Category</Text>
            
            <Input
              label="Category Name"
              placeholder="e.g., Food, Transport, Shopping"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              icon="tag"
            />
            
            <View style={styles.colorSection}>
              <Text style={styles.colorLabel}>Choose Color</Text>
              <View style={styles.colorGrid}>
                {CATEGORY_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      newCategoryColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setNewCategoryColor(color)}
                  >
                    {newCategoryColor === color && (
                      <Feather name="check" size={16} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.quickModalActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddCategory(false);
                  setNewCategoryName("");
                  setNewCategoryColor("#EF4444");
                }}
                variant="ghost"
                style={styles.quickModalButton}
              />
              <Button
                title="Add Category"
                onPress={handleQuickAddCategory}
                disabled={!newCategoryName.trim()}
                style={styles.quickModalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
      {/* Currency Selector Modal */}
<Modal
  visible={showCurrencySelector}
  animationType="fade"
  transparent
  onRequestClose={() => setShowCurrencySelector(false)}
>
  <TouchableOpacity 
    style={styles.modalOverlay}
    activeOpacity={1}
    onPress={() => setShowCurrencySelector(false)}
  >
    <View style={styles.currencyModalContent}>
      <Text style={styles.currencyModalTitle}>Select Currency</Text>
      {availableCurrencies.map((curr) => (
        <TouchableOpacity
          key={curr.code}
          style={[
            styles.currencyOption,
            currency === curr.code && styles.currencyOptionSelected
          ]}
          onPress={() => {
            setCurrency(curr.code);
            setShowCurrencySelector(false);
          }}
        >
          <View style={styles.currencyOptionLeft}>
            <Text style={styles.currencySymbolDisplay}>{curr.symbol}</Text>
            <View>
              <Text style={styles.currencyCode}>{curr.code}</Text>
              <Text style={styles.currencyName}>{curr.name}</Text>
            </View>
          </View>
          {currency === curr.code && (
            <Feather name="check" size={20} color="#EF4444" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  </TouchableOpacity>
</Modal>
    </Modal>
    
  );
  
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    height: SCREEN_HEIGHT * 0.92,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
  },
  amountSection: {
  marginBottom: Spacing.md,
},
amountRow: {
  flexDirection: 'row',
  gap: Spacing.sm,
},

taxRateButtons: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: Spacing.sm,
  marginBottom: Spacing.sm,
},
taxRateButton: {
  paddingVertical: Spacing.sm,
  paddingHorizontal: Spacing.md,
  backgroundColor: Colors.light.backgroundSecondary,
  borderRadius: BorderRadius.md,
  borderWidth: 1.5,
  borderColor: Colors.light.border,
  minWidth: 80,
  alignItems: 'center',
},
taxRateButtonSelected: {
  backgroundColor: '#EF4444' + '15',
  borderColor: '#EF4444',
},
taxRateButtonText: {
  fontSize: 13,
  color: Colors.light.text,
  fontWeight: '500',
},
taxRateButtonTextSelected: {
  color: '#EF4444',
  fontWeight: '600',
},
taxRatePercent: {
  fontSize: 11,
  color: Colors.light.textSecondary,
},
taxRatePercentSelected: {
  color: '#EF4444',
},
currencySelector: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: Spacing.md,
  paddingVertical: Spacing.md,
  backgroundColor: Colors.light.backgroundSecondary,
  borderRadius: BorderRadius.md,
  borderWidth: 1.5,
  borderColor: Colors.light.border,
  minWidth: 110,
},
currencySelectorText: {
  fontSize: 16,
  fontWeight: '600',
  color: Colors.light.text,
},
conversionNote: {
  fontSize: 12,
  color: Colors.light.textSecondary,
  marginTop: Spacing.xs,
  fontStyle: 'italic',
},
currencyModalContent: {
  backgroundColor: Colors.light.background,
  borderRadius: BorderRadius.xl,
  padding: Spacing.lg,
  margin: Spacing.xl,
  maxHeight: '70%',
},
currencyModalTitle: {
  fontSize: 18,
  fontWeight: '600',
  color: Colors.light.text,
  marginBottom: Spacing.md,
},
currencyOption: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: Spacing.md,
  paddingHorizontal: Spacing.sm,
  borderBottomWidth: 1,
  borderBottomColor: Colors.light.border,
},
currencyOptionSelected: {
  backgroundColor: '#EF4444' + '10',
},
currencyOptionLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: Spacing.md,
},
currencySymbolDisplay: {
  fontSize: 20,
  fontWeight: '600',
  color: Colors.light.text,
  width: 30,
},
currencyCode: {
  fontSize: 16,
  fontWeight: '600',
  color: Colors.light.text,
},
currencyName: {
  fontSize: 13,
  color: Colors.light.textSecondary,
},
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.title3,
    color: Colors.light.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  scannerSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.subhead,
    color: Colors.light.text,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  scannerButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  scanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.light.backgroundSecondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#EF4444',
    borderStyle: 'dashed',
  },
  scanButtonText: {
    ...Typography.body,
    color: '#EF4444',
    fontWeight: '500',
  },
  receiptPreview: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  receiptImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    marginTop: Spacing.sm,
  },
  amountInputContainer: {
  flex: 1,  // Add this
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: Colors.light.backgroundSecondary,
  borderRadius: BorderRadius.md,
  paddingHorizontal: Spacing.md,
  height: 56,
  borderWidth: 1.5,  // Add this
  borderColor: Colors.light.border,  // Add this
},
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.text,
  },
  datePickerButton: {
    marginBottom: Spacing.md,
  },
  datePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  datePickerText: {
    ...Typography.body,
    color: Colors.light.text,
  },
  inputLabel: {
    ...Typography.subhead,
    color: Colors.light.text,
    marginBottom: Spacing.sm,
    fontWeight: '500',
  },
  
  // Vendor selection styles
  selectionSection: {
    marginBottom: Spacing.md,
  },
  selectionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundSecondary,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minWidth: 60,
    alignItems: 'center',
  },
  selectionChipSelected: {
    backgroundColor: '#EF4444' + '15',
    borderColor: '#EF4444',
  },
  selectionChipText: {
    ...Typography.caption1,
    color: Colors.light.text,
    fontWeight: '400',
  },
  selectionChipTextSelected: {
    color: '#EF4444',
    fontWeight: '600',
  },
  
  // AI Suggestion styles
  suggestionBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  suggestionTitle: {
    ...Typography.caption1,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  suggestionText: {
    ...Typography.body,
    color: Colors.light.text,
    flex: 1,
  },
  suggestionConfidence: {
    ...Typography.caption2,
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  suggestionReason: {
    ...Typography.caption2,
    color: '#92400E',
    fontStyle: 'italic',
  },
  
  // Category styles
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 4,
  },
  categoryChipSelected: {
    backgroundColor: '#EF4444' + '15',
    borderColor: '#EF4444',
  },
  categoryChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  categoryChipText: {
    ...Typography.caption1,
    color: Colors.light.text,
  },
  categoryChipTextSelected: {
    color: '#EF4444',
    fontWeight: '600',
  },
  
  // Modal actions
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  modalButton: {
    flex: 1,
  },
  // Add these new styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#EF4444',
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  
  // Tax styles
  taxToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  taxToggleText: {
    fontSize: 16,
    color: Colors.light.text,
    marginLeft: Spacing.sm,
  },
  taxSection: {
    marginBottom: Spacing.md,
  },
  taxInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  taxInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  taxPercent: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginLeft: Spacing.xs,
  },
  taxCalculation: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  taxCalcText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  
  // Quick modal styles
  quickModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickModalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  quickModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  quickModalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  quickModalButton: {
    flex: 1,
  },
  colorSection: {
    marginBottom: Spacing.lg,
  },
  colorLabel: {
    ...Typography.subhead,
    color: Colors.light.text,
    marginBottom: Spacing.md,
    fontWeight: '500',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    transform: [{ scale: 1.1 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});