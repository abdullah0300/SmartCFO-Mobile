import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
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
  
  const [name, setName] = useState('');
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
    setName('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Vendor name is required');
      return;
    }

    if (!user) return;

    setLoading(true);
    await createMutation.mutateAsync({
      user_id: user.id,
      name: name.trim(),
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Vendor</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <Input
            label="Vendor Name"
            placeholder="e.g., Amazon, Walmart, Local Store"
            value={name}
            onChangeText={setName}
            icon="shopping-bag"
          />

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
              disabled={!name.trim()}
              style={styles.modalButton}
            />
          </View>
        </View>
      </View>
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
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
});