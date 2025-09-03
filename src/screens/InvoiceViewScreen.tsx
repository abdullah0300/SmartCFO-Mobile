// src/screens/InvoiceViewScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
  Dimensions,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useQueryClient } from '@tanstack/react-query';
import { getInvoice, updateInvoice, supabase } from '../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { Invoice, InvoiceSettings } from '../types';
import { Button } from '../components/ui/Button';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';


const { width: screenWidth } = Dimensions.get('window');
type RootStackParamList = {
  Main: undefined;
  InvoiceView: { invoiceId: string };
  CreateInvoice: { invoiceId?: string } | undefined;
};
type InvoiceViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'InvoiceView'>;
type InvoiceViewRouteProp = RouteProp<RootStackParamList, 'InvoiceView'>;
export default function InvoiceViewScreen() {
  const navigation = useNavigation<InvoiceViewNavigationProp>();
  const route = useRoute<InvoiceViewRouteProp>();
  const { user } = useAuth();
  const { formatCurrency, getCurrencySymbol, baseCurrency } = useSettings();
  const queryClient = useQueryClient();
  const token = Crypto.randomUUID();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const currencySymbol = invoice?.currency ? getCurrencySymbol(invoice.currency) : getCurrencySymbol(baseCurrency);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const formatAmount = (amount: number, currency?: string) => {
    const symbol = getCurrencySymbol(currency || baseCurrency);
    return `${symbol}${amount.toFixed(2)}`;
  };
  
  const invoiceId = route.params?.invoiceId;

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  const loadInvoice = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load invoice with all related data
      const [invoiceData, profileData, settingsData] = await Promise.all([
        getInvoice(invoiceId),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('invoice_settings').select('*').eq('user_id', user.id).single(),
      ]);
      
      setInvoice(invoiceData);
      setProfile(profileData.data);
      setInvoiceSettings(settingsData.data);
      
    } catch (error) {
      console.error('Error loading invoice:', error);
      Alert.alert('Error', 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };
  const generatePublicLink = async (): Promise<string> => {
  if (!invoice || !user) return '';
  
  try {
    // Generate a UUID token using Expo's crypto
    const token = require('expo-crypto').randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
    
    // Store the token in the database
    const { error } = await supabase
      .from('invoice_access_tokens')
      .insert({
        token,
        invoice_id: invoice.id,
        expires_at: expiresAt.toISOString()
      });
    
    if (error) throw error;
    
    // Return the public link
    const baseUrl = 'https://smartcfo.webcraftio.com';
    return `${baseUrl}/invoice/public/${invoice.id}?token=${token}`;
  } catch (err: any) {
    console.error('Error generating public link:', err);
    return '';
  }
};

  const handleStatusChange = async (newStatus: Invoice['status']) => {
    if (!invoice || !user) return;
    
    try {
      setUpdating(true);
      
      // Update in database
      await updateInvoice(invoice.id, { 
        status: newStatus,
        ...(newStatus === 'paid' ? { paid_date: new Date().toISOString() } : {}),
        ...(newStatus === 'sent' ? { sent_date: new Date().toISOString() } : {})
      });
      
      // Update local state
      setInvoice({ ...invoice, status: newStatus });
      
      // Invalidate queries to refresh list
      queryClient.invalidateQueries({ queryKey: ['invoices', user.id] });
      
      // Show success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // If marked as paid and has income category, create income entry
      if (newStatus === 'paid' && invoice.income_category_id) {
        try {
          await supabase.from('income').insert({
            user_id: user.id,
            amount: invoice.total,
            category_id: invoice.income_category_id,
            description: `Invoice #${invoice.invoice_number} - ${invoice.client?.name}`,
            date: new Date().toISOString().split('T')[0],
            reference_number: invoice.invoice_number,
            client_id: invoice.client_id,
          });
        } catch (err) {
          console.error('Error creating income entry:', err);
        }
      }
      
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update invoice status');
    } finally {
      setUpdating(false);
    }
  };

const handleDownloadPDF = async () => {
  if (!invoice || !user) return;
  
  try {
    setGeneratingPDF(true);
    
    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      Alert.alert('Error', 'No active session. Please login again.');
      return;
    }
    
    // Use the hardcoded URL from your supabase.ts
    const functionUrl = 'https://adsbnzqorfmgnneiopcr.supabase.co/functions/v1/generate-invoice-pdf';
    
    console.log('Calling PDF function...');
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkc2JuenFvcmZtZ25uZWlvcGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NzM1NzAsImV4cCI6MjA2NDM0OTU3MH0.To7RgYgKu1yKVBSNVYzvce92kcLAXW0G_9jppFdeaU4', // Add the anon key
      },
      body: JSON.stringify({ invoiceId: invoice.id }),
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('PDF generation failed:', errorText);
      throw new Error(`Failed to generate PDF: ${errorText}`);
    }
    
    // Get the PDF blob
    const blob = await response.blob();
    
    // Convert blob to base64 for React Native
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    
    reader.onloadend = async () => {
      try {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];
        
        // Save the PDF
        const fileUri = `${FileSystem.documentDirectory}invoice-${invoice.invoice_number}.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Share the PDF
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle: `Invoice ${invoice.invoice_number}`,
            UTI: 'com.adobe.pdf',
          });
          Alert.alert('Success', 'PDF generated successfully!');
        } else {
          Alert.alert('Success', 'PDF saved successfully!');
        }
      } catch (error) {
        console.error('Error saving PDF:', error);
        Alert.alert('Error', 'Failed to save PDF');
      }
    };
    
    reader.onerror = () => {
      console.error('FileReader error');
      Alert.alert('Error', 'Failed to read PDF data');
    };
    
  } catch (error: any) {
    console.error('Full error:', error);
    Alert.alert('Error', error.message || 'Failed to generate PDF');
  } finally {
    setGeneratingPDF(false);
  }
};



const handleSendEmail = async () => {
  if (!invoice || !user || !invoice.client?.email) return;
  
  try {
    setSendingEmail(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      Alert.alert('Error', 'No active session. Please login again.');
      return;
    }
    
    const functionUrl = 'https://adsbnzqorfmgnneiopcr.supabase.co/functions/v1/send-invoice-email';
    
    console.log('Sending email to:', invoice.client.email);
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkc2JuenFvcmZtZ25uZWlvcGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NzM1NzAsImV4cCI6MjA2NDM0OTU3MH0.To7RgYgKu1yKVBSNVYzvce92kcLAXW0G_9jppFdeaU4',
      },
      body: JSON.stringify({
        invoiceId: invoice.id,
        recipientEmail: invoice.client.email,
        attachPdf: true,
      }),
    });
    
    console.log('Email response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Email sending failed:', errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }
    
    // Update status to sent if it was draft
    if (invoice.status === 'draft') {
      await handleStatusChange('sent');
    }
    
    Alert.alert('Success', 'Invoice sent successfully!');
    
  } catch (error: any) {
    console.error('Full error:', error);
    Alert.alert('Error', error.message || 'Failed to send invoice');
  } finally {
    setSendingEmail(false);
  }
};
  const handleShare = async () => {
  if (!invoice) return;
  
  try {
    // Generate the secure public link
    const shareUrl = await generatePublicLink();
    
    if (!shareUrl) {
      Alert.alert('Error', 'Failed to generate share link');
      return;
    }
    
    const message = `Invoice #${invoice.invoice_number}\n` +
      `Client: ${invoice.client?.name}\n` +
      `Amount: ${formatAmount(invoice.total, invoice.currency)}\n` +
      `Due Date: ${format(new Date(invoice.due_date), 'MMM dd, yyyy')}\n\n` +
      `View invoice: ${shareUrl}`;
    
    await Share.share({
      message,
      title: `Invoice ${invoice.invoice_number}`,
    });
  } catch (error) {
    console.error('Error sharing:', error);
  }
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#10B981';
      case 'sent': return '#8B5CF6';
      case 'overdue': return '#EF4444';
      case 'draft': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return 'check-circle';
      case 'sent': return 'send';
      case 'overdue': return 'error-outline';
      case 'draft': return 'edit';
      default: return 'help-outline';
    }
  };

  const getCompanyName = () => {
    return profile?.company_name || 
           invoiceSettings?.company_name || 
           profile?.full_name || 
           profile?.email || 
           'Your Company';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Invoice not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const isOverdue = invoice.status !== 'paid' && new Date(invoice.due_date) < new Date();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Invoice Details</Text>
          
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleShare}
              style={styles.headerActionButton}
            >
              <Feather name="share-2" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Invoice Document */}
        <View style={styles.invoiceDocument}>
          {/* Header with Pattern */}
          <View style={styles.documentHeader}>
            <View style={styles.patternOverlay} />
            
            <View style={styles.documentHeaderContent}>
              {/* Company Info */}
              <View style={styles.companyInfo}>
                <Text style={styles.companyName}>{getCompanyName()}</Text>
                {(profile?.company_address || invoiceSettings?.company_address) && (
                  <Text style={styles.companyAddress}>
                    {profile?.company_address || invoiceSettings?.company_address}
                  </Text>
                )}
                {(profile?.phone || invoiceSettings?.company_phone) && (
                  <Text style={styles.companyContact}>
                    {profile?.phone || invoiceSettings?.company_phone}
                  </Text>
                )}
                {(profile?.email || invoiceSettings?.company_email) && (
                  <Text style={styles.companyContact}>
                    {profile?.email || invoiceSettings?.company_email}
                  </Text>
                )}
              </View>

              {/* Invoice Title and Number */}
              <View style={styles.invoiceHeader}>
                <Text style={styles.invoiceTitle}>INVOICE</Text>
                <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
                
                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) + '20' }]}>
                  <MaterialIcons 
                    name={getStatusIcon(invoice.status) as any} 
                    size={16} 
                    color={getStatusColor(invoice.status)} 
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
                    {isOverdue ? 'OVERDUE' : invoice.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Invoice Body */}
          <View style={styles.documentBody}>
            {/* Bill To Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bill To</Text>
              <View style={styles.billToCard}>
                <Text style={styles.clientName}>{invoice.client?.name || 'Unknown Client'}</Text>
                {invoice.client?.email && (
                  <Text style={styles.clientInfo}>{invoice.client.email}</Text>
                )}
                {invoice.client?.phone && (
                  <Text style={styles.clientInfo}>{invoice.client.phone}</Text>
                )}
                {invoice.client?.address && (
                  <Text style={styles.clientInfo}>{invoice.client.address}</Text>
                )}
              </View>
            </View>

            {/* Dates */}
            <View style={styles.datesRow}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Invoice Date</Text>
                <Text style={styles.dateValue}>
                  {format(new Date(invoice.date), 'MMM dd, yyyy')}
                </Text>
              </View>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Due Date</Text>
                <Text style={[styles.dateValue, isOverdue && styles.overdueText]}>
                  {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                </Text>
              </View>
            </View>

           {/* Items Table */}
          <View style={styles.itemsSection}>
            <View style={styles.itemsHeader}>
              <Text style={[styles.itemHeaderText, styles.itemDescription]}>Description</Text>
              <Text style={[styles.itemHeaderText, styles.itemQty]}>Qty</Text>
              <Text style={[styles.itemHeaderText, styles.itemRate]}>Rate</Text>
              {invoice.tax_metadata?.has_line_item_vat && (
                <>
                  <Text style={[styles.itemHeaderText, styles.itemTax]}>
                    {invoice.tax_metadata?.tax_label || 'Tax'}%
                  </Text>
                </>
              )}
              <Text style={[styles.itemHeaderText, styles.itemAmount]}>
                {invoice.tax_metadata?.has_line_item_vat ? 'Total' : 'Amount'}
              </Text>
            </View>

             {invoice.items?.map((item, index) => (
              <View key={item.id || index} style={styles.itemRow}>
                <Text style={[styles.itemText, styles.itemDescription]} numberOfLines={2}>
                  {item.description}
                </Text>
                <Text style={[styles.itemText, styles.itemQty]}>{item.quantity}</Text>
                <Text style={[styles.itemText, styles.itemRate]}>
                  {formatAmount(item.rate, invoice.currency)}
                </Text>
                {invoice.tax_metadata?.has_line_item_vat && (
                  <Text style={[styles.itemText, styles.itemTax]}>
                    {item.tax_rate || 0}%
                  </Text>
                )}
                <Text style={[styles.itemText, styles.itemAmount]}>
                  {formatAmount(
                    invoice.tax_metadata?.has_line_item_vat 
                      ? (item.gross_amount || item.amount)
                      : item.amount,
                    invoice.currency
                  )}
                </Text>
              </View>
            ))}
            </View>

            {/* Totals */}
              <View style={styles.totalsSection}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {invoice.tax_metadata?.has_line_item_vat ? 'Net Total' : 'Subtotal'}
                  </Text>
                  <Text style={styles.totalValue}>
                    {formatAmount(invoice.subtotal, invoice.currency)}
                  </Text>
                </View>
                
                {/* VAT Breakdown for UK/EU users */}
                {invoice.tax_metadata?.vat_breakdown && Object.entries(invoice.tax_metadata.vat_breakdown).map(([rate, data]: [string, any]) => (
                  data.vat > 0 && (
                    <View key={rate} style={styles.totalRow}>
                      <Text style={styles.totalLabel}>
                        {invoice.tax_metadata?.tax_label || 'Tax'} @ {rate}%
                      </Text>
                      <Text style={styles.totalValue}>
                        {formatAmount(data.vat, invoice.currency)}
                      </Text>
                    </View>
                  )
                ))}
                
                {/* Standard tax for non-VAT countries */}
                {!invoice.tax_metadata?.has_line_item_vat && invoice.tax_rate > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Tax ({invoice.tax_rate}%)</Text>
                    <Text style={styles.totalValue}>
                      {formatAmount(invoice.tax_amount, invoice.currency)}
                    </Text>
                  </View>
                )}
            
              
              <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total Due</Text>
              <View style={styles.totalValueContainer}>
                <Text style={styles.grandTotalValue}>
                  {formatAmount(invoice.total, invoice.currency)}
                </Text>
                {invoice.currency !== baseCurrency && invoice.base_amount && (
                  <Text style={styles.conversionNote}>
                    ({formatAmount(invoice.base_amount, baseCurrency)} base)
                  </Text>
                )}
              </View>
            </View>
            </View>

            {/* Notes */}
            {invoice.notes && (
              <View style={styles.notesSection}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </View>
            )}

            {/* Payment Instructions */}
            {invoiceSettings?.payment_instructions && (
              <View style={styles.paymentInstructions}>
                <Text style={styles.sectionTitle}>Payment Instructions</Text>
                <Text style={styles.paymentText}>
                  {invoiceSettings.payment_instructions}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          {/* Status Buttons */}
          <View style={styles.statusSection}>
            <Text style={styles.actionSectionTitle}>Update Status</Text>
            <View style={styles.statusButtons}>
              {(['draft', 'sent', 'paid'] as const).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    invoice.status === status && { 
                      backgroundColor: getStatusColor(status) + '20',
                      borderColor: getStatusColor(status),
                    }
                  ]}
                  onPress={() => handleStatusChange(status)}
                  disabled={updating || invoice.status === status}
                >
                  <MaterialIcons 
                    name={getStatusIcon(status) as any} 
                    size={18} 
                    color={invoice.status === status ? getStatusColor(status) : '#6B7280'}
                  />
                  <Text style={[
                    styles.statusButtonText,
                    invoice.status === status && { color: getStatusColor(status) }
                  ]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Main Actions */}
          <View style={styles.mainActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => navigation.navigate('CreateInvoice', { invoiceId: invoice.id })}
            >
              <Feather name="edit-2" size={18} color="#6B7280" />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.pdfButton]}
              onPress={handleDownloadPDF}
              disabled={generatingPDF}
            >
              {generatingPDF ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <>
                  <Feather name="download" size={18} color="#8B5CF6" />
                  <Text style={[styles.actionButtonText, { color: '#8B5CF6' }]}>PDF</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.emailButton]}
              onPress={handleSendEmail}
              disabled={sendingEmail || !invoice.client?.email}
            >
              {sendingEmail ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="mail" size={18} color="#FFFFFF" />
                  <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                    Send
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
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
  invoiceDocument: {
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
    backgroundColor: '#8B5CF6',
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
  companyInfo: {
    marginBottom: 20,
  },
  companyName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  companyAddress: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 4,
    lineHeight: 20,
  },
  companyContact: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 2,
  },
  invoiceHeader: {
    alignItems: 'flex-start',
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  invoiceNumber: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 6,
    marginBottom: 12,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  overdueText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  documentBody: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  billToCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  clientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  clientInfo: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    lineHeight: 20,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  
  itemsSection: {
    marginBottom: 24,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    overflow: 'hidden',
  },
  itemsHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  itemHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  itemText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  itemDescription: {
    flex: 3,
    paddingRight: 12,
  },
  itemQty: {
    flex: 0.8,
    textAlign: 'center',
  },
  itemRate: {
    flex: 1.2,
    textAlign: 'right',
    paddingRight: 8,
  },
  itemTax: {
    flex: 0.8,
    textAlign: 'center',
  },
  itemAmount: {
    flex: 1.5,
    textAlign: 'right',
    fontWeight: '600',
    color: '#1F2937',
  },
  totalsSection: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  grandTotalRow: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  totalValueContainer: {
    alignItems: 'flex-end',
  },
  conversionNote: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  notesSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  notesText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  paymentInstructions: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 20,
  },
  paymentText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  actionsSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  actionSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusSection: {
    marginBottom: 20,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  mainActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pdfButton: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#A78BFA',
  },
  emailButton: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  
});