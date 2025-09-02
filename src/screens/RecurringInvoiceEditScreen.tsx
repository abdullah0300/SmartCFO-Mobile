import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Spacing, BorderRadius } from '../constants/Colors';

export default function RecurringInvoiceEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { recurringId } = route.params as { recurringId: string };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recurring, setRecurring] = useState<any>(null);
  const [showNextDatePicker, setShowNextDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    loadRecurringInvoice();
  }, [recurringId]);

  const loadRecurringInvoice = async () => {
    if (!recurringId || !user) return;

    try {
      const { data, error } = await supabase
        .from('recurring_invoices')
        .select('*, client:clients(name)')
        .eq('id', recurringId)
        .single();

      if (error) throw error;
      setRecurring(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load recurring invoice');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .update({
          frequency: recurring.frequency,
          next_date: recurring.next_date,
          is_active: recurring.is_active,
          end_date: recurring.end_date || null,
        })
        .eq('id', recurringId);

      if (error) throw error;
      
      Alert.alert('Success', 'Recurring invoice updated');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update recurring invoice');
    } finally {
      setSaving(false);
    }
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Recurring Invoice</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Client Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Client</Text>
          <Text style={styles.clientName}>
            {recurring?.client?.name || 'No client'}
          </Text>
        </View>

        {/* Frequency */}
        <View style={styles.card}>
          <Text style={styles.label}>Frequency</Text>
          <View style={styles.frequencyOptions}>
            {['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'].map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.frequencyOption,
                  recurring.frequency === freq && styles.frequencyOptionActive
                ]}
                onPress={() => setRecurring({ ...recurring, frequency: freq })}
              >
                <Text style={[
                  styles.frequencyText,
                  recurring.frequency === freq && styles.frequencyTextActive
                ]}>
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Next Date */}
        <View style={styles.card}>
          <Text style={styles.label}>Next Invoice Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowNextDatePicker(true)}
          >
            <Feather name="calendar" size={18} color="#6366F1" />
            <Text style={styles.dateText}>
              {format(new Date(recurring.next_date), 'MMM dd, yyyy')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* End Date */}
        <View style={styles.card}>
          <Text style={styles.label}>End Date (Optional)</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowEndDatePicker(true)}
          >
            <Feather name="calendar" size={18} color="#6366F1" />
            <Text style={styles.dateText}>
              {recurring.end_date 
                ? format(new Date(recurring.end_date), 'MMM dd, yyyy')
                : 'No end date'
              }
            </Text>
          </TouchableOpacity>
          {recurring.end_date && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setRecurring({ ...recurring, end_date: null })}
            >
              <Text style={styles.clearButtonText}>Clear end date</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Active Status */}
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>Active</Text>
            <Switch
              value={recurring.is_active}
              onValueChange={(value) => 
                setRecurring({ ...recurring, is_active: value })
              }
              trackColor={{ false: '#D1D5DB', true: '#8B5CF6' }}
              thumbColor={recurring.is_active ? '#6366F1' : '#f4f3f4'}
            />
          </View>
          <Text style={styles.helpText}>
            {recurring.is_active 
              ? 'Invoice will be generated automatically'
              : 'Invoice generation is paused'
            }
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonSecondaryText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonPrimaryText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Date Pickers */}
      {showNextDatePicker && (
        <DateTimePicker
          value={new Date(recurring.next_date)}
          mode="date"
          onChange={(event, date) => {
            setShowNextDatePicker(false);
            if (date) {
              setRecurring({ ...recurring, next_date: date.toISOString() });
            }
          }}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={recurring.end_date ? new Date(recurring.end_date) : new Date()}
          mode="date"
          onChange={(event, date) => {
            setShowEndDatePicker(false);
            if (date) {
              setRecurring({ ...recurring, end_date: date.toISOString() });
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  frequencyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  frequencyOptionActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  frequencyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  frequencyTextActive: {
    color: '#FFFFFF',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#1F2937',
  },
  clearButton: {
    marginTop: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#6366F1',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helpText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  buttonPrimary: {
    backgroundColor: '#6366F1',
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});