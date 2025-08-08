import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/Colors';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface AddVendorModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AddVendorModal: React.FC<AddVendorModalProps> = ({
  visible,
  onClose,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    payment_terms: '30',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('vendors')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      tax_id: '',
      payment_terms: '30',
      notes: '',
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Vendor name is required');
      return;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      Alert.alert('Error', 'Invalid email format');
      return;
    }

    if (!user) return;

    setLoading(true);
    await createMutation.mutateAsync({
      user_id: user.id,
      name: formData.name.trim(),
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      tax_id: formData.tax_id || null,
      payment_terms: formData.payment_terms ? parseInt(formData.payment_terms) : 30,
      notes: formData.notes || null,
    });
    setLoading(false);
  };

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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Vendor</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            style={styles.scrollContent}
          >
            <Input
              label="Vendor Name *"
              placeholder="e.g., Amazon, Walmart, Local Store"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              icon="shopping-bag"
            />

            <Input
              label="Email"
              placeholder="vendor@example.com"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              icon="mail"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Phone"
              placeholder="Phone number"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              icon="phone"
              keyboardType="phone-pad"
            />

            <Input
              label="Address"
              placeholder="Vendor address"
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              icon="map-pin"
              multiline
              numberOfLines={3}
            />

            <Input
              label="Tax ID"
              placeholder="Tax identification number"
              value={formData.tax_id}
              onChangeText={(text) => setFormData({ ...formData, tax_id: text })}
              icon="file-text"
            />

            <Input
              label="Payment Terms (Days)"
              placeholder="30"
              value={formData.payment_terms}
              onChangeText={(text) => setFormData({ ...formData, payment_terms: text })}
              icon="calendar"
              keyboardType="numeric"
            />

            <Input
              label="Notes"
              placeholder="Additional notes about this vendor"
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              icon="edit-3"
              multiline
              numberOfLines={3}
            />
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="ghost"
              style={styles.modalButton}
            />
            <Button
              title="Add Vendor"
              onPress={handleSubmit}
              loading={loading}
              disabled={!formData.name.trim()}
              style={styles.modalButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl + 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.title3,
    color: Colors.light.text,
  },
  scrollContent: {
    maxHeight: '70%',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
});