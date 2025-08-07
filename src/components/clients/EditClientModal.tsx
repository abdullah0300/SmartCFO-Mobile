import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { supabase } from '../../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/Colors';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Client } from '../../types';

interface EditClientModalProps {
  visible: boolean;
  client: Client | null;
  onClose: () => void;
}

export const EditClientModal: React.FC<EditClientModalProps> = ({
  visible,
  client,
  onClose,
}) => {
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setAddress(client.address || '');
    }
  }, [client]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('clients')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleSubmit = async () => {
    if (!name.trim() || !client) {
      Alert.alert('Error', 'Client name is required');
      return;
    }

    setLoading(true);
    await updateMutation.mutateAsync({
      id: client.id,
      data: {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      },
    });
    setLoading(false);
  };

  if (!client) return null;

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
            <Text style={styles.modalTitle}>Edit Client</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Input
              label="Client Name *"
              placeholder="John Doe or Company Name"
              value={name}
              onChangeText={setName}
              icon="user"
            />

            <Input
              label="Email"
              placeholder="client@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail"
            />

            <Input
              label="Phone"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon="phone"
            />

            <Input
              label="Address"
              placeholder="123 Main St, City, State"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              icon="map-pin"
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
              title="Save Changes"
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
    maxHeight: '80%',
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