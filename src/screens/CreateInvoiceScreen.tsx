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
import { format, addDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { useAuth } from '../hooks/useAuth';
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
  const { formatCurrency, currencySymbol } = useSettings();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [issueDate, setIssueDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(addDays(new Date(), 30));
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [incomeCategoryId, setIncomeCategoryId] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  
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
  }]);
  
  const [clients, setClients] = useState<Client[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showClientModal, setShowClientModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

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
      
      // Generate invoice number using the web app format
      if (settingsData) {
        setInvoiceSettings(settingsData);
        const invoiceNum = await generateInvoiceNumber(user.id);
        setInvoiceNumber(invoiceNum);
        
        // Set default due date based on settings
        if (settingsData.due_days) {
          setDueDate(addDays(new Date(), settingsData.due_days));
        }
        
        // Set default tax rate
        if (settingsData.tax_rate) {
          setTaxRate(settingsData.tax_rate);
        }
        
        // Set default notes
        if (settingsData.notes) {
          setNotes(settingsData.notes);
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

  const updateItem = (index: number, field: keyof NewInvoiceItem, value: string | number) => {
    const newItems = [...items];
    const item = { ...newItems[index] };
    
    switch (field) {
      case 'quantity':
      case 'rate':
        item[field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
        item.amount = item.quantity * item.rate;
        break;
      case 'description':
        item[field] = value as string;
        break;
      case 'amount':
        item[field] = value as number;
        break;
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
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    
    return { subtotal, taxRate, taxAmount, total };
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
      
      // Create invoice
      const invoice = {
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
        currency: invoiceSettings?.currency || 'USD',
      };
      
      // Prepare recurring data if needed
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
            currency: invoiceSettings?.currency || 'USD',
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
            currency: invoiceSettings?.currency || 'USD',
            items: items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
            })),
          },
          is_default: false,
          templateSelector: {
    marginTop: Spacing.sm,
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
  recurringToggleLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
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
  endDateButton: {
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
      }
      
      // Update invoice number in settings
      if (invoiceSettings) {
        await supabase
          .from('invoice_settings')
          .update({ next_number: (invoiceSettings.next_number || 1) + 1 })
          .eq('user_id', user.id);
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
            
            <Text style={styles.headerTitle}>Create Invoice</Text>
            
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || !selectedClient}
              style={styles.saveButton}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Invoice Header Info */}
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceNumberSection}>
              <Text style={styles.label}>Invoice Number</Text>
              <TextInput
                style={styles.invoiceNumberInput}
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
                placeholder="INV-0001"
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
                      <Text style={styles.currencySymbol}>{currencySymbol}</Text>
                      <TextInput
                        style={styles.rateInput}
                        placeholder="0.00"
                        value={item.rate.toString()}
                        onChangeText={(text) => updateItem(index, 'rate', text)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.itemField}>
                    <Text style={styles.itemFieldLabel}>Amount</Text>
                    <Text style={styles.itemAmount}>
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Template Section */}
          {templates.length > 0 && (
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

          {/* Tax Section */}
          <View style={styles.section}>
            <View style={styles.taxSection}>
              <Text style={styles.sectionTitle}>Tax Rate (%)</Text>
              <TextInput
                style={styles.taxInput}
                placeholder="0"
                value={taxRate.toString()}
                onChangeText={(text) => setTaxRate(parseFloat(text) || 0)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

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
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            
            {taxRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({taxRate}%)</Text>
                <Text style={styles.totalValue}>{formatCurrency(taxAmount)}</Text>
              </View>
            )}
            
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>

          {/* Save as Template Option */}
          {!selectedTemplate && (
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
              title="Create Invoice"
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
  // In CreateInvoiceScreen.tsx, add these styles to the StyleSheet.create({...}) object:

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