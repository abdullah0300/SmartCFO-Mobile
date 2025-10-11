import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { Spacing, BorderRadius } from '../constants/Colors';
import * as Haptics from 'expo-haptics';

export default function InvoiceSettingsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentMethodsCount, setPaymentMethodsCount] = useState(0);
  const [hasPaymentAccount, setHasPaymentAccount] = useState(false);

  const [settings, setSettings] = useState({
    // Company Details
    company_name: '',
    company_email: '',
    company_phone: '',
    company_address: '',
    tax_number: '',
    
    // Invoice Defaults
    invoice_prefix: 'INV-',
    payment_terms: 30,
    default_tax_rate: 0,
    invoice_notes: '',
    invoice_footer: '',
    
    // Auto-send settings
    auto_send_recurring: false,
    email_notifications: true,
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setSettings({
          company_name: data.company_name || '',
          company_email: data.company_email || '',
          company_phone: data.company_phone || '',
          company_address: data.company_address || '',
          tax_number: data.tax_number || '',
          invoice_prefix: data.invoice_prefix || 'INV-',
          payment_terms: data.payment_terms || 30,
          default_tax_rate: data.default_tax_rate || 0,
          invoice_notes: data.invoice_notes || '',
          invoice_footer: data.invoice_footer || '',
          auto_send_recurring: data.auto_send_recurring || false,
          email_notifications: data.email_notifications !== false,
        });
      }

      // Load payment methods count
      const { data: methods } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_enabled', true);

      setPaymentMethodsCount(methods?.length || 0);

      // Check payment accounts
      const { data: accounts } = await supabase
        .from('user_payment_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('onboarding_completed', true);

      setHasPaymentAccount(accounts && accounts.length > 0);

    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('invoice_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const settingsData = {
        ...settings,
        payment_terms: parseInt(settings.payment_terms.toString()) || 30,
        default_tax_rate: parseFloat(settings.default_tax_rate.toString()) || 0,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        const { error } = await supabase
          .from('invoice_settings')
          .update(settingsData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('invoice_settings')
          .insert([{
            ...settingsData,
            user_id: user.id
          }]);

        if (error) throw error;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Settings saved successfully!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', 'Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenWebDashboard = async () => {
    const url = 'https://smartcfo.webcraftio.com/invoices';
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Alert.alert('Error', 'Unable to open web dashboard');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open web dashboard');
    }
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Invoice Settings</Text>
          
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="check" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Company Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Company Name</Text>
            <TextInput
              style={styles.input}
              value={settings.company_name}
              onChangeText={(text) => setSettings({...settings, company_name: text})}
              placeholder="Your Company Name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={settings.company_email}
              onChangeText={(text) => setSettings({...settings, company_email: text})}
              placeholder="company@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={settings.company_phone}
              onChangeText={(text) => setSettings({...settings, company_phone: text})}
              placeholder="+1 234 567 8900"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={settings.company_address}
              onChangeText={(text) => setSettings({...settings, company_address: text})}
              placeholder="123 Main St, City, State 12345"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tax Number</Text>
            <TextInput
              style={styles.input}
              value={settings.tax_number}
              onChangeText={(text) => setSettings({...settings, tax_number: text})}
              placeholder="Tax ID / VAT Number"
            />
          </View>
        </View>

        {/* Invoice Defaults */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Defaults</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Invoice Prefix</Text>
            <TextInput
              style={styles.input}
              value={settings.invoice_prefix}
              onChangeText={(text) => setSettings({...settings, invoice_prefix: text})}
              placeholder="INV-"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payment Terms (Days)</Text>
            <TextInput
              style={styles.input}
              value={settings.payment_terms.toString()}
              onChangeText={(text) => setSettings({...settings, payment_terms: parseInt(text) || 30})}
              placeholder="30"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Default Tax Rate (%)</Text>
            <TextInput
              style={styles.input}
              value={settings.default_tax_rate.toString()}
              onChangeText={(text) => setSettings({...settings, default_tax_rate: parseFloat(text) || 0})}
              placeholder="0"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Default Invoice Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={settings.invoice_notes}
              onChangeText={(text) => setSettings({...settings, invoice_notes: text})}
              placeholder="Thank you for your business!"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Invoice Footer</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={settings.invoice_footer}
              onChangeText={(text) => setSettings({...settings, invoice_footer: text})}
              placeholder="Payment is due within 30 days"
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Email Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Settings</Text>
          
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Email Notifications</Text>
              <Text style={styles.switchDescription}>
                Send invoice emails to clients
              </Text>
            </View>
            <Switch
              value={settings.email_notifications}
              onValueChange={(value) => setSettings({...settings, email_notifications: value})}
              trackColor={{ false: '#E5E7EB', true: '#C4B5FD' }}
              thumbColor={settings.email_notifications ? '#8B5CF6' : '#9CA3AF'}
            />
          </View>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Auto-send Recurring</Text>
              <Text style={styles.switchDescription}>
                Automatically email recurring invoices
              </Text>
            </View>
            <Switch
              value={settings.auto_send_recurring}
              onValueChange={(value) => setSettings({...settings, auto_send_recurring: value})}
              trackColor={{ false: '#E5E7EB', true: '#C4B5FD' }}
              thumbColor={settings.auto_send_recurring ? '#8B5CF6' : '#9CA3AF'}
            />
          </View>
        </View>

        {/* Payment Features Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Features</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Feather name="credit-card" size={20} color="#8B5CF6" />
              <Text style={styles.infoCardTitle}>Payment Methods</Text>
            </View>
            <Text style={styles.infoCardText}>
              {paymentMethodsCount > 0
                ? `${paymentMethodsCount} payment method${paymentMethodsCount > 1 ? 's' : ''} configured`
                : 'No payment methods configured'}
            </Text>
            <View style={styles.infoCardFooter}>
              <Feather name="globe" size={14} color="#6B7280" />
              <Text style={styles.infoCardFooterText}>
                Manage payment methods on web app
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Feather name="dollar-sign" size={20} color="#10B981" />
              <Text style={styles.infoCardTitle}>Online Payments</Text>
            </View>
            <View style={styles.statusRow}>
              {hasPaymentAccount ? (
                <>
                  <Feather name="check-circle" size={16} color="#10B981" />
                  <Text style={[styles.infoCardText, { color: '#10B981' }]}>
                    Stripe Connected
                  </Text>
                </>
              ) : (
                <>
                  <Feather name="alert-circle" size={16} color="#F59E0B" />
                  <Text style={[styles.infoCardText, { color: '#F59E0B' }]}>
                    Not Connected
                  </Text>
                </>
              )}
            </View>
            <View style={styles.infoCardFooter}>
              <Feather name="globe" size={14} color="#6B7280" />
              <Text style={styles.infoCardFooterText}>
                Connect Stripe on web app to accept online payments
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleOpenWebDashboard}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.floatingButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Feather name="external-link" size={20} color="#FFFFFF" />
          <Text style={styles.floatingButtonText}>Open in Web Dashboard</Text>
        </LinearGradient>
      </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    marginBottom: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 6,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  switchDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  // Payment Features Info Styles
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  infoCardText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  infoCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  infoCardFooterText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  // Floating Action Button Styles
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  floatingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});