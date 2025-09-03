// src/screens/CreateInvoiceScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { format, addDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { useAuth } from '../hooks/useAuth';
import { calculateVATFromNet, aggregateVATByRate } from '../utils/vatCalculations';
import { countries } from '../data/countries';
import { useSettings } from '../contexts/SettingsContext';
import { useQueryClient } from '@tanstack/react-query';
import { 
  createInvoice, 
  getClients, 
  getInvoiceSettings,
  getCategories,
  getInvoiceTemplates,
  createInvoiceTemplate,
  generateInvoiceNumber,
  supabase 
} from '../services/api';
import { Client, Category, InvoiceItem, InvoiceSettings, InvoiceTemplate } from '../types';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { Button } from '../components/ui/Button';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width: screenWidth } = Dimensions.get('window');

interface NewInvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  tax_rate?: number;
  tax_amount?: number;
  net_amount?: number;
  gross_amount?: number;
}

type RootStackParamList = {
  Main: undefined;
  InvoiceView: { invoiceId: string };
  CreateInvoice: undefined;
  EditInvoice: { invoiceId: string };
  RecurringInvoices: undefined;
};

type CreateInvoiceNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateInvoice'>;

export default function CreateInvoiceScreen() {
  const navigation = useNavigation<CreateInvoiceNavigationProp>();
  const { user } = useAuth();
  const route = useRoute();
  const invoiceId = (route.params as any)?.invoiceId;
  const isEditMode = !!invoiceId;
  const { formatCurrency, currencySymbol, baseCurrency, getCurrencySymbol, enabledCurrencies, convertToBaseCurrency, taxRates, settings, userCountry } = useSettings();
  const taxRateOptions = Object.entries(taxRates).map(([name, rate]) => ({
  id: name,
  name: name,
  rate: Number(rate)
  }));
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const countryData = countries.find(c => c.code === userCountry);
  const taxLabel = countryData?.taxName || 'Tax';
  const requiresLineItemVAT = countryData?.taxFeatures?.requiresInvoiceTaxBreakdown === true;
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [issueDate, setIssueDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(addDays(new Date(), 30));
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [incomeCategoryId, setIncomeCategoryId] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [selectedCurrency, setSelectedCurrency] = useState(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  // Recurring invoice states
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState<Date | null>(null);
  const [showRecurringEndDatePicker, setShowRecurringEndDatePicker] = useState(false);
  
  // Template states
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<any[]>([]);
  
  const [items, setItems] = useState<NewInvoiceItem[]>([{
  description: '',
  quantity: 1,
  rate: 0,
  amount: 0,
  tax_rate: 0,  
  tax_amount: 0,
  net_amount: 0,
  gross_amount: 0,
}]);
  
  const [clients, setClients] = useState<Client[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showClientModal, setShowClientModal] = useState(false);




  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (isEditMode) {
      loadInvoiceForEdit();
    }
  }, [invoiceId]);

  useEffect(() => {
  const fetchExchangeRate = async () => {
    if (selectedCurrency && selectedCurrency !== baseCurrency) {
      try {
        const result = await convertToBaseCurrency(1, selectedCurrency);
        setExchangeRate(result.exchangeRate);
      } catch (error) {
        console.error('Error fetching exchange rate:', error);
        setExchangeRate(1);
      }
    } else {
      setExchangeRate(1);
    }
  };
  
  fetchExchangeRate();
}, [selectedCurrency, baseCurrency]);

  const loadInitialData = async () => {
    if (!user) return;
    
    try {
      setLoadingData(true);
      
      // Load all required data in parallel
      const [clientsData, categoriesData, settingsData, templatesData] = await Promise.all([
        getClients(user.id),
        getCategories(user.id, 'income'),
        getInvoiceSettings(user.id),
        getInvoiceTemplates(user.id),
      ]);
      
      setClients(clientsData || []);
      setIncomeCategories(categoriesData || []);
      setTemplates(templatesData || []);
      
      // Apply ALL invoice settings from web app
if (settingsData) {
  setInvoiceSettings(settingsData);
  const invoiceNum = await generateInvoiceNumber(user.id);
  setInvoiceNumber(invoiceNum);
  
  // Payment terms and due date
  if (settingsData.payment_terms || settingsData.due_days) {
    const days = settingsData.payment_terms || settingsData.due_days || 30;
    setDueDate(addDays(issueDate, days));
  }
  
  // Default tax rate
  if (settingsData.default_tax_rate !== undefined && settingsData.default_tax_rate !== null) {
    setTaxRate(Number(settingsData.default_tax_rate));
  }
  
  // Default notes (use invoice_notes field from web app)
  if (settingsData.invoice_notes) {
    setNotes(settingsData.invoice_notes);
  }
  
  // Default income category if set
  if (settingsData.default_income_category_id) {
    setIncomeCategoryId(settingsData.default_income_category_id);
  }
} else {
        // Generate default invoice number
        const invoiceNum = await generateInvoiceNumber(user.id);
        setInvoiceNumber(invoiceNum);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  const loadInvoiceForEdit = async () => {
    if (!invoiceId || !user) return;
    
    try {
      const { data: invoice } = await supabase
        .from('invoices')
        .select(`
          *,
          items:invoice_items(*)
        `)
        .eq('id', invoiceId)
        .single();
      
      if (!invoice) {
        Alert.alert('Error', 'Invoice not found');
        navigation.goBack();
        return;
      }
      
      // Check if invoice can be edited
      if (invoice.status === 'paid' || invoice.status === 'canceled') {
        Alert.alert('Cannot Edit', 'This invoice is locked and cannot be edited.');
        navigation.goBack();
        return;
      }
      
      // Load invoice data into form
      setInvoiceNumber(invoice.invoice_number);
      setSelectedClient(invoice.client_id || '');
      setIssueDate(new Date(invoice.date));
      setDueDate(new Date(invoice.due_date));
      setNotes(invoice.notes || '');
      setTaxRate(invoice.tax_rate || 0);
      setSelectedCurrency(invoice.currency || baseCurrency);
      setIncomeCategoryId(invoice.income_category_id || '');
      
      // Check for recurring
      const { data: recurringData } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();
      
      if (recurringData) {
        setIsRecurring(true);
        setFrequency(recurringData.frequency);
        if (recurringData.end_date) {
          setRecurringEndDate(new Date(recurringData.end_date));
        }
      }
      
      // Load items
      if (invoice.items && invoice.items.length > 0) {
        setItems(invoice.items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          tax_rate: item.tax_rate || 0,
          tax_amount: item.tax_amount || 0,
          net_amount: item.net_amount || item.amount,
          gross_amount: item.gross_amount || item.amount,
        })));
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      Alert.alert('Error', 'Failed to load invoice');
    }
  };

  const updateItem = (index: number, field: keyof NewInvoiceItem, value: string | number) => {
  const newItems = [...items];
  const item = { ...newItems[index] };
  
  if (field === 'quantity' || field === 'rate' || field === 'tax_rate') {
    const quantity = field === 'quantity' ? Number(value) || 0 : item.quantity;
    const rate = field === 'rate' ? Number(value) || 0 : item.rate;
    const taxRate = field === 'tax_rate' ? Number(value) || 0 : (item.tax_rate || 0);
    
    if (requiresLineItemVAT) {
      const vatCalc = calculateVATFromNet(quantity * rate, taxRate);
      item.quantity = quantity;
      item.rate = rate;
      item.tax_rate = taxRate;
      item.net_amount = vatCalc.net;
      item.tax_amount = vatCalc.vat;
      item.gross_amount = vatCalc.gross;
      item.amount = vatCalc.gross;
    } else {
      item.quantity = quantity;
      item.rate = rate;
      item.amount = quantity * rate;
    }
  } else if (field === 'description') {
    item.description = value as string;
  }
  
  newItems[index] = item;
  setItems(newItems);
};

  const addItem = () => {
  setItems([...items, {
    description: '',
    quantity: 1,
    rate: 0,
    amount: 0,
    tax_rate: 0,
    tax_amount: 0,
    net_amount: 0,
    gross_amount: 0,
  }]);
};
  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
  if (requiresLineItemVAT) {
    const itemsWithVAT = items.map(item => {
      const vatCalc = calculateVATFromNet(
        item.quantity * item.rate, 
        item.tax_rate || 0
      );
      return {
        ...item,
        net_amount: vatCalc.net,
        tax_amount: vatCalc.vat,
        gross_amount: vatCalc.gross
      };
    });
    
    const vatBreakdown = aggregateVATByRate(itemsWithVAT);
    
    let netTotal = 0;
    let taxTotal = 0;
    let grossTotal = 0;
    
    Object.values(vatBreakdown).forEach(group => {
      netTotal += group.net;
      taxTotal += group.vat;
      grossTotal += group.gross;
    });
    
    return {
      subtotal: netTotal,
      taxAmount: taxTotal,
      total: grossTotal,
      vatBreakdown
    };
  } else {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    
    return {
      subtotal,
      taxAmount,
      total,
      vatBreakdown: null
    };
        }
      };

  const getNextInvoiceDate = () => {
    const today = new Date();
    switch (frequency) {
      case 'weekly':
        return addDays(today, 7);
      case 'biweekly':
        return addDays(today, 14);
      case 'monthly':
        return addDays(today, 30);
      case 'quarterly':
        return addDays(today, 90);
      case 'yearly':
        return addDays(today, 365);
      default:
        return addDays(today, 30);
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const data = template.template_data;
    
    // Load template data
    if (data.client_id) setSelectedClient(data.client_id);
    if (data.tax_rate !== undefined) setTaxRate(data.tax_rate);
    if (data.notes) setNotes(data.notes);
    if (data.currency) setSelectedCurrency(data.currency);
    // Load items
    if (data.items && data.items.length > 0) {
      setItems(data.items.map((item: any) => ({
        description: item.description,
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: item.amount || 0,
      })));
    }
    
    Alert.alert('Success', `Template "${template.name}" loaded`);
  };

  const handleSubmit = async () => {
  // Validation
  if (!selectedClient) {
    Alert.alert('Error', 'Please select a client');
    return;
  }
  
  if (items.some(item => !item.description || item.amount === 0)) {
    Alert.alert('Error', 'Please complete all item details');
    return;
  }
  
  if (!user) return;

try {
  setLoading(true);
  
  const { subtotal, taxAmount, total } = calculateTotals();
    
  // Calculate exchange rate and base amounts
  const conversionResult = await convertToBaseCurrency(total, selectedCurrency);
  const baseAmount = conversionResult.baseAmount;
  const currentExchangeRate = conversionResult.exchangeRate;
  const baseTaxAmount = taxAmount / currentExchangeRate;
  
  // Prepare invoice data
  const invoiceData = {
    user_id: user.id,
    invoice_number: invoiceNumber,
    client_id: selectedClient,
    date: format(issueDate, 'yyyy-MM-dd'),
    due_date: format(dueDate, 'yyyy-MM-dd'),
    status: 'draft' as const,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total,
    notes,
    income_category_id: incomeCategoryId || null,
    currency: selectedCurrency,
    base_amount: baseAmount,
    exchange_rate: currentExchangeRate,
    base_tax_amount: baseTaxAmount,
    tax_metadata: requiresLineItemVAT ? {
      tax_scheme: settings?.uk_vat_scheme || 'standard',
      vat_breakdown: calculateTotals().vatBreakdown,
      has_line_item_vat: true,
      tax_label: taxLabel,
      country_code: countryData?.code
    } : null,
  };
  
  if (isEditMode) {
    // UPDATE existing invoice
    const { error: updateError } = await supabase
      .from('invoices')
      .update(invoiceData)
      .eq('id', invoiceId);
    
    if (updateError) throw updateError;
    
    // Delete old items and insert new ones
    await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoiceId);
    
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(items.map(item => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        tax_rate: item.tax_rate || 0,
        tax_amount: item.tax_amount || 0,
        net_amount: item.net_amount || 0,
        gross_amount: item.gross_amount || 0,
      })));
    
    if (itemsError) throw itemsError;
    
    // Handle recurring update if needed
    if (isRecurring) {
      const { data: existingRecurring } = await supabase
        .from('recurring_invoices')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();
      
      const recurringData = {
        user_id: user.id,
        client_id: selectedClient,
        template_data: {
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          notes,
          currency: selectedCurrency,
          items: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
        },
        frequency,
        next_date: format(getNextInvoiceDate(), 'yyyy-MM-dd'),
        end_date: recurringEndDate ? format(recurringEndDate, 'yyyy-MM-dd') : null,
        is_active: true,
      };
      
      if (existingRecurring) {
        await supabase
          .from('recurring_invoices')
          .update(recurringData)
          .eq('invoice_id', invoiceId);
      } else {
        await supabase
          .from('recurring_invoices')
          .insert({ ...recurringData, invoice_id: invoiceId });
      }
    } else {
      // Remove recurring if it existed
      await supabase
        .from('recurring_invoices')
        .delete()
        .eq('invoice_id', invoiceId);
    }
    
    // Refresh and navigate
    queryClient.invalidateQueries({ queryKey: ['invoices', user.id] });
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Invoice updated successfully', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
    
  } else {
    // CREATE new invoice (existing code remains the same)
    const invoice = invoiceData;
    
    // Rest of your existing code for recurring data...
    let recurringData = null;
    if (isRecurring) {
      recurringData = {
        user_id: user.id,
        client_id: selectedClient,
        template_data: {
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          notes,
          currency: selectedCurrency,
          items: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
        },
        frequency,
        next_date: format(getNextInvoiceDate(), 'yyyy-MM-dd'),
        end_date: recurringEndDate ? format(recurringEndDate, 'yyyy-MM-dd') : null,
        is_active: true,
      };
    }
    
    // Create invoice (with recurring if needed)
    await createInvoice(invoice, items, isRecurring, recurringData);
    
    // Save as template if requested
    if (saveAsTemplate && templateName) {
      await createInvoiceTemplate({
        user_id: user.id,
        name: templateName,
        template_data: {
          client_id: selectedClient,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          notes,
          currency: selectedCurrency,
          items: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
        },
        is_default: false,
      });
    }
    
    // Refresh invoices list
    queryClient.invalidateQueries({ queryKey: ['invoices', user.id] });
    if (isRecurring) {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices', user.id] });
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Invoice created successfully', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  }
} catch (error) {
      console.error('Error creating invoice:', error);
      Alert.alert('Error', 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const ClientSelector = () => {
    const selectedClientData = clients.find(c => c.id === selectedClient);
    
    return (
      <TouchableOpacity 
        style={styles.clientSelector}
        onPress={() => setShowClientModal(true)}
      >
        <View style={styles.clientSelectorContent}>
          {selectedClientData ? (
            <View>
              <Text style={styles.selectedClientName}>{selectedClientData.name}</Text>
              {selectedClientData.email && (
                <Text style={styles.selectedClientEmail}>{selectedClientData.email}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.clientPlaceholder}>Select a client</Text>
          )}
        </View>
        <Feather name="chevron-down" size={20} color="#6B7280" />
      </TouchableOpacity>
    );
  };

  if (loadingData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </SafeAreaView>
    );
  }

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
       <LinearGradient
  colors={['#8B5CF6', '#7C3AED'] as const}
  style={styles.header}
>
  <View style={styles.headerContent}>
    <TouchableOpacity 
      onPress={() => navigation.goBack()}
      style={styles.backButton}
    >
      <Feather name="x" size={24} color="#FFFFFF" />
    </TouchableOpacity>
    
    <Text style={styles.headerTitle}>{isEditMode ? 'Edit Invoice' : 'Create Invoice'}</Text>
    
    <TouchableOpacity
      onPress={() => navigation.navigate('InvoiceSettings' as any)}
      style={styles.settingsButton}
    >
      <Feather name="settings" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  </View>
</LinearGradient>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

           {/* Template Section */}
          {!isEditMode && templates.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Use Template</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.templateSelector}
              >
                {templates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.templateChip}
                    onPress={() => loadTemplate(template.id)}
                  >
                    <MaterialIcons name="description" size={16} color="#8B5CF6" />
                    <Text style={styles.templateChipText}>{template.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          {/* Invoice Header Info */}
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceNumberSection}>
              <Text style={styles.label}>Invoice Number</Text>
             <TextInput
                style={[
                  styles.invoiceNumberInput,
                  isEditMode && { opacity: 0.6 }
                ]}
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
                placeholder="INV-0001"
                editable={!isEditMode}
              />
            </View>

            <View style={styles.dateSection}>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowIssueDatePicker(true)}
              >
                <Text style={styles.dateLabel}>Issue Date</Text>
                <View style={styles.dateValue}>
                  <Feather name="calendar" size={16} color="#6B7280" />
                  <Text style={styles.dateText}>
                    {format(issueDate, 'MMM dd, yyyy')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDueDatePicker(true)}
              >
                <Text style={styles.dateLabel}>Due Date</Text>
                <View style={styles.dateValue}>
                  <Feather name="calendar" size={16} color="#6B7280" />
                  <Text style={styles.dateText}>
                    {format(dueDate, 'MMM dd, yyyy')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          
            
            {/* Currency Selection - ADD THIS INSIDE invoiceHeader */}
            <View style={styles.currencySection}>
              <Text style={styles.dateLabel}>CURRENCY</Text>
              <TouchableOpacity
                style={styles.currencySelector}
                onPress={() => setShowCurrencyModal(true)}
              >
                <View style={styles.dateValue}>
                  <Text style={styles.dateText}>
                    {getCurrencySymbol(selectedCurrency)} {selectedCurrency}
                  </Text>
                  <Feather name="chevron-down" size={16} color="#6B7280" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Client Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <ClientSelector />
            
            {clients.length === 0 && (
              <TouchableOpacity 
                style={styles.addClientButton}
                onPress={() => {
                  // Navigate to add client screen
                  Alert.alert('Add Client', 'Navigate to add client screen');
                }}
              >
                <MaterialIcons name="add" size={18} color="#8B5CF6" />
                <Text style={styles.addClientText}>Add New Client</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Invoice Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Items</Text>
              <TouchableOpacity onPress={addItem} style={styles.addItemButton}>
                <MaterialIcons name="add" size={20} color="#8B5CF6" />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemNumber}>Item {index + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeItem(index)}
                      style={styles.removeButton}
                    >
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  style={styles.itemDescriptionInput}
                  placeholder="Item description"
                  value={item.description}
                  onChangeText={(text) => updateItem(index, 'description', text)}
                  multiline
                  numberOfLines={2}
                />

                <View style={styles.itemDetailsRow}>
                  <View style={styles.itemField}>
                    <Text style={styles.itemFieldLabel}>Quantity</Text>
                    <TextInput
                      style={styles.itemFieldInput}
                      placeholder="1"
                      value={item.quantity.toString()}
                      onChangeText={(text) => updateItem(index, 'quantity', text)}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.itemField}>
                    <Text style={styles.itemFieldLabel}>Rate</Text>
                    <View style={styles.rateInputContainer}>
                      <Text style={styles.currencySymbol}>{getCurrencySymbol(selectedCurrency)}</Text>
                      <TextInput
                        style={styles.rateInput}
                        placeholder="0.00"
                        value={item.rate.toString()}
                        onChangeText={(text) => updateItem(index, 'rate', text)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                 {requiresLineItemVAT && (
                      <View style={styles.itemField}>
                        <Text style={styles.itemFieldLabel}>{taxLabel}</Text>
                        <TouchableOpacity
                          style={styles.vatDropdown}
                          onPress={() => {
                            // Show picker or modal for tax rate selection
                            Alert.alert(
                              'Select ' + taxLabel + ' Rate',
                              '',
                              [
                                { text: 'No ' + taxLabel + ' (0%)', onPress: () => updateItem(index, 'tax_rate', 0) },
                                ...taxRateOptions.map(tax => ({
                                  text: `${tax.name} (${tax.rate}%)`,
                                  onPress: () => updateItem(index, 'tax_rate', tax.rate)
                                })),
                                { text: 'Cancel', style: 'cancel' }
                              ]
                            );
                          }}
                        >
                          <Text style={styles.vatDropdownText}>
                            {item.tax_rate || 0}%
                          </Text>
                          <Feather name="chevron-down" size={12} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                    )}

                  <View style={styles.itemField}>
                    <Text style={styles.itemFieldLabel}>
                      {requiresLineItemVAT ? 'Total' : 'Amount'}
                    </Text>
                    <Text style={styles.itemAmount}>
                      {getCurrencySymbol(selectedCurrency)} {' '}
                      {requiresLineItemVAT 
                        ? (item.gross_amount || 0).toFixed(2)
                        : item.amount.toFixed(2)
                      }
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

        

          {/* Recurring Invoice Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.recurringToggle}
              onPress={() => setIsRecurring(!isRecurring)}
            >
              <View style={styles.recurringToggleLeft}>
                <MaterialIcons 
                  name={isRecurring ? "check-box" : "check-box-outline-blank"} 
                  size={24} 
                  color="#8B5CF6" 
                />
                <View style={styles.recurringToggleText}>
                  <Text style={styles.recurringToggleTitle}>Make this a recurring invoice</Text>
                  <Text style={styles.recurringToggleSubtitle}>
                    Automatically generate invoices on a schedule
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {isRecurring && (
              <View style={styles.recurringOptions}>
                <View style={styles.recurringField}>
                  <Text style={styles.label}>Frequency</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.frequencySelector}
                  >
                    {(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const).map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        style={[
                          styles.frequencyChip,
                          frequency === freq && styles.frequencyChipSelected
                        ]}
                        onPress={() => setFrequency(freq)}
                      >
                        <Text style={[
                          styles.frequencyChipText,
                          frequency === freq && styles.frequencyChipTextSelected
                        ]}>
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={styles.nextInvoiceText}>
                    Next invoice: {format(getNextInvoiceDate(), 'MMM dd, yyyy')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.endDateButton}
                  onPress={() => setShowRecurringEndDatePicker(true)}
                >
                  <Text style={styles.label}>End Date (Optional)</Text>
                  <View style={styles.endDateValue}>
                    <Feather name="calendar" size={16} color="#6B7280" />
                    <Text style={styles.endDateText}>
                      {recurringEndDate ? format(recurringEndDate, 'MMM dd, yyyy') : 'No end date'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Tax Section - Only for non-VAT countries */}
            {!requiresLineItemVAT && (
              <View style={styles.section}>
                <View style={styles.taxSection}>
                  <Text style={styles.sectionTitle}>{taxLabel} Rate</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.categorySelector}
                  >
                    <TouchableOpacity
                      style={[
                        styles.categoryChip,
                        taxRate === 0 && styles.categoryChipSelected
                      ]}
                      onPress={() => setTaxRate(0)}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        taxRate === 0 && styles.categoryChipTextSelected
                      ]}>
                        No {taxLabel} (0%)
                      </Text>
                    </TouchableOpacity>
                    
                    {taxRateOptions.map((tax) => (
                      <TouchableOpacity
                        key={tax.id}
                        style={[
                          styles.categoryChip,
                          taxRate === tax.rate && styles.categoryChipSelected
                        ]}
                        onPress={() => setTaxRate(tax.rate)}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          taxRate === tax.rate && styles.categoryChipTextSelected
                        ]}>
                          {tax.name} ({tax.rate}%)
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}
          

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add any notes or payment terms..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Income Category */}
          {incomeCategories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Income Category (Optional)</Text>
              <Text style={styles.categoryHint}>
                Select a category to automatically record this as income when paid
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.categorySelector}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    !incomeCategoryId && styles.categoryChipSelected
                  ]}
                  onPress={() => setIncomeCategoryId('')}
                >
                  <Text style={[
                    styles.categoryChipText,
                    !incomeCategoryId && styles.categoryChipTextSelected
                  ]}>
                    None
                  </Text>
                </TouchableOpacity>
                
                {incomeCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      incomeCategoryId === category.id && styles.categoryChipSelected
                    ]}
                    onPress={() => setIncomeCategoryId(category.id)}
                  >
                    <View 
                      style={[
                        styles.categoryDot, 
                        { backgroundColor: category.color }
                      ]} 
                    />
                    <Text style={[
                      styles.categoryChipText,
                      incomeCategoryId === category.id && styles.categoryChipTextSelected
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Totals Summary */}
          <View style={styles.totalsSummary}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {getCurrencySymbol(selectedCurrency)} {subtotal.toFixed(2)}
              </Text>
            </View>

            {/* VAT Breakdown for UK/EU users */}
              {requiresLineItemVAT && (() => {
                const totals = calculateTotals();
                if (!totals.vatBreakdown) return null;
                
                return Object.entries(totals.vatBreakdown).map(([rate, data]: [string, any]) => (
                  data.vat > 0 ? (
                    <View key={rate} style={styles.totalRow}>
                      <Text style={styles.totalLabel}>{taxLabel} @ {rate}%</Text>
                      <Text style={styles.totalValue}>
                        {getCurrencySymbol(selectedCurrency)} {data.vat.toFixed(2)}
                      </Text>
                    </View>
                  ) : null
                ));
              })()}
                        
            {/* Only show tax row for non-VAT countries or if VAT countries have tax */}
              {!requiresLineItemVAT && taxRate > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{taxLabel} ({taxRate}%)</Text>
                  <Text style={styles.totalValue}>
                    {getCurrencySymbol(selectedCurrency)} {taxAmount.toFixed(2)}
                  </Text>
                </View>
              )}

              {/* For VAT countries, show tax total if there's any VAT */}
              {requiresLineItemVAT && taxAmount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{taxLabel} Total</Text>
                  <Text style={styles.totalValue}>
                    {getCurrencySymbol(selectedCurrency)} {taxAmount.toFixed(2)}
                  </Text>
                </View>
              )}
            
            <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <View style={styles.totalValueContainer}>
              <Text style={styles.grandTotalValue}>
                {getCurrencySymbol(selectedCurrency)} {total.toFixed(2)}
              </Text>
              {selectedCurrency !== baseCurrency && (
                <Text style={styles.conversionNote}>
                  ≈ {formatCurrency(total / (exchangeRate || 1))} base
                </Text>
              )}
            </View>
          </View>
          </View>

          {/* Save as Template Option */}
          {!isEditMode && !selectedTemplate && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.saveTemplateToggle}
                onPress={() => setSaveAsTemplate(!saveAsTemplate)}
              >
                <MaterialIcons 
                  name={saveAsTemplate ? "check-box" : "check-box-outline-blank"} 
                  size={24} 
                  color="#8B5CF6" 
                />
                <Text style={styles.saveTemplateText}>Save as template for future use</Text>
              </TouchableOpacity>
              
              {saveAsTemplate && (
                <TextInput
                  style={styles.templateNameInput}
                  placeholder="Template name (e.g., Monthly Retainer)"
                  value={templateName}
                  onChangeText={setTemplateName}
                />
              )}
            </View>
          )}

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <Button
              title={isEditMode ? "Update Invoice" : "Create Invoice"}
              onPress={handleSubmit}
              loading={loading}
              disabled={loading || !selectedClient || items.some(item => !item.description)}
              style={styles.submitButton}
            />
          </View>
        </ScrollView>

        {/* Date Pickers */}
        {showIssueDatePicker && (
          <DateTimePicker
            value={issueDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              setShowIssueDatePicker(false);
              if (date) setIssueDate(date);
            }}
          />
        )}

        {showDueDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              setShowDueDatePicker(false);
              if (date) setDueDate(date);
            }}
          />
        )}

        {showRecurringEndDatePicker && (
          <DateTimePicker
            value={recurringEndDate || new Date()}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              setShowRecurringEndDatePicker(false);
              if (date) setRecurringEndDate(date);
            }}
          />
        )}

        {/* Client Selection Modal */}
        {showClientModal && (
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowClientModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Client</Text>
              <ScrollView style={styles.clientList}>
                {clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[
                      styles.clientItem,
                      selectedClient === client.id && styles.clientItemSelected
                    ]}
                    onPress={() => {
                      setSelectedClient(client.id);
                      setShowClientModal(false);
                    }}
                  >
                    <View>
                      <Text style={styles.clientItemName}>{client.name}</Text>
                      {client.email && (
                        <Text style={styles.clientItemEmail}>{client.email}</Text>
                      )}
                    </View>
                    {selectedClient === client.id && (
                      <Feather name="check" size={20} color="#8B5CF6" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        )}

        {/* Date Pickers */}
        {showIssueDatePicker && (
          <DateTimePicker
            value={issueDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              setShowIssueDatePicker(false);
              if (date) setIssueDate(date);
            }}
          />
        )}

        {showDueDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              setShowDueDatePicker(false);
              if (date) setDueDate(date);
            }}
          />
        )}
      </KeyboardAvoidingView>
      {/* Currency Selection Modal */}
      {showCurrencyModal && (
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCurrencyModal(false)}
        >
          <View style={[styles.modalContent, { maxHeight: '50%' }]}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <ScrollView style={styles.clientList}>
              {enabledCurrencies?.map((currency: string) => (
                <TouchableOpacity
                  key={currency}
                  style={[
                    styles.clientItem,
                    selectedCurrency === currency && styles.clientItemSelected
                  ]}
                  onPress={() => {
                    setSelectedCurrency(currency);
                    setShowCurrencyModal(false);
                  }}
                >
                  <View>
                    <Text style={styles.clientItemName}>
                      {getCurrencySymbol(currency)} {currency}
                    </Text>
                  </View>
                  {selectedCurrency === currency && (
                    <Feather name="check" size={20} color="#8B5CF6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  currencySection: {
  marginTop: Spacing.md,
},
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
  saveButton: {
    padding: Spacing.sm,
    marginRight: -Spacing.sm,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  invoiceHeader: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  invoiceNumberSection: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  invoiceNumberInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateSection: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dateButton: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  
  totalValueContainer: {
    alignItems: 'flex-end',
  },
  conversionNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  dateValue: {
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
  currencySelector: {
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
  section: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  clientSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: Spacing.sm,
  },
  clientSelectorContent: {
    flex: 1,
  },
  selectedClientName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  selectedClientEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  clientPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  addClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addClientText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addItemText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  itemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  removeButton: {
    padding: 4,
  },
  itemDescriptionInput: {
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: Spacing.sm,
    minHeight: 60,
    },
    vatDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vatDropdownText: {
    fontSize: 12,
    color: '#1F2937',
  },
  itemDetailsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  itemField: {
    flex: 1,
  },
  itemFieldLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  itemFieldInput: {
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlign: 'center',
  },
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: Spacing.sm,
  },
  currencySymbol: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
  rateInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: 8,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    paddingVertical: 10,
  },
  taxSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taxInput: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: 80,
    textAlign: 'center',
  },
  settingsButton: {
  padding: Spacing.sm,
  marginRight: -Spacing.sm,
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
  categoryHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: Spacing.sm,
  },
  categorySelector: {
    marginTop: Spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginRight: Spacing.sm,
    gap: 6,
  },
  categoryChipSelected: {
    backgroundColor: '#EDE9FE',
    borderColor: '#8B5CF6',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#6B7280',
  },
  categoryChipTextSelected: {
    color: '#8B5CF6',
    fontWeight: '500',
  },

  recurringToggleText: {
    flex: 1,
  },
  recurringToggleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  recurringToggleSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  recurringOptions: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  recurringField: {
    marginBottom: Spacing.md,
  },
  recurringToggleLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  templateSelector: {
    marginTop: Spacing.sm,
  },
  endDateButton: {
    marginTop: Spacing.sm,
  },
  totalsSummary: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  grandTotalRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  submitSection: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  submitButton: {
    width: '100%',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  clientList: {
    paddingHorizontal: Spacing.lg,
  },
  clientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  clientItemSelected: {
    backgroundColor: '#F9FAFB',
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  clientItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  clientItemEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },

  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    backgroundColor: '#EDE9FE',
    marginRight: Spacing.sm,
    gap: 6,
  },
  templateChipText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
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
    backgroundColor: '#EDE9FE',
    borderColor: '#8B5CF6',
  },
  frequencyChipText: {
    fontSize: 14,
    color: '#6B7280',
  },
  frequencyChipTextSelected: {
    color: '#8B5CF6',
    fontWeight: '500',
  },
  nextInvoiceText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: Spacing.sm,
  },
  endDateValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 6,
  },
  endDateText: {
    fontSize: 14,
    color: '#1F2937',
  },
  saveTemplateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  saveTemplateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  templateNameInput: {
    fontSize: 14,
    color: '#1F2937',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: Spacing.sm,
  },
});