import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../hooks/useAuth';
import { getVendors, supabase } from '../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { Vendor } from '../types';
import { AddVendorModal } from '../components/vendors/AddVendorModal';
import { EditVendorModal } from '../components/vendors/EditVendorModal';

const VendorItem = ({ 
  item, 
  onEdit,
  onDelete 
}: { 
  item: Vendor; 
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
}) => {
  return (
    <TouchableOpacity 
      style={styles.vendorItem} 
      activeOpacity={0.7}
      onPress={() => onEdit(item)}
    >
      <View style={styles.itemContent}>
        <View style={styles.itemLeft}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </View>
          <Text style={styles.itemName}>{item.name}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(item)}
        >
          <Feather name="trash-2" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default function VendorsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ['vendors', user?.id],
    queryFn: () => getVendors(user!.id),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (vendorId: string) => {
      // Check if vendor is in use
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id')
        .eq('vendor_id', vendorId)
        .limit(1);
      
      if (expenses && expenses.length > 0) {
        throw new Error('Vendor has associated expenses and cannot be deleted');
      }
      
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message);
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleDelete = (vendor: Vendor) => {
    Alert.alert(
      'Delete Vendor',
      `Are you sure you want to delete ${vendor.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(vendor.id),
        },
      ]
    );
  };

  const handleEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setShowEditModal(true);
  };

  const filteredVendors = vendors?.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#EF4444', '#DC2626']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Vendors</Text>
          
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <View style={styles.addButtonInner}>
              <Feather name="plus" size={24} color="#EF4444" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vendors..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{vendors?.length || 0}</Text>
            <Text style={styles.statLabel}>Total Vendors</Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={filteredVendors}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VendorItem 
            item={item} 
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#EF4444"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#FEE2E2', '#FECACA']}
              style={styles.emptyIcon}
            >
              <MaterialIcons name="store" size={48} color="#EF4444" />
            </LinearGradient>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No vendors found' : 'No vendors yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery 
                ? 'Try searching with a different term' 
                : 'Add vendors to track your expenses better'
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => setShowAddModal(true)}
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  style={styles.emptyButtonGradient}
                >
                  <Feather name="plus" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Add Vendor</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <AddVendorModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <EditVendorModal
        visible={showEditModal}
        vendor={selectedVendor}
        onClose={() => {
          setShowEditModal(false);
          setSelectedVendor(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerGradient: {
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    marginRight: -Spacing.sm,
  },
  addButtonInner: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
    color: Colors.light.text,
  },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  listContent: {
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  vendorItem: {
    backgroundColor: Colors.light.background,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatarGradient: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 3,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  emptyButton: {
    overflow: 'hidden',
    borderRadius: BorderRadius.full,
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});