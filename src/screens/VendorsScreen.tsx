import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { subMonths } from 'date-fns';

import { useAuth } from '../hooks/useAuth';
import { getVendors, supabase } from '../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { Vendor } from '../types';
import { AddVendorModal } from '../components/vendors/AddVendorModal';
import { EditVendorModal } from '../components/vendors/EditVendorModal';
import { useSettings } from '../contexts/SettingsContext';

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
  const { formatCurrency } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ['vendors', user?.id],
    queryFn: () => getVendors(user!.id),
    enabled: !!user,
  });

  // Fetch expenses to calculate spending
  const { data: expenses } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('vendor_id, amount, date')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!vendors || !expenses) {
      return {
        totalVendors: vendors?.length || 0,
        activeVendors: 0,
        totalExpenses: 0,
        monthExpenses: 0,
      };
    }

    // Get vendors with expenses in last 3 months
    const threeMonthsAgo = subMonths(new Date(), 3);
    const activeVendorIds = new Set(
      expenses
        .filter(exp => new Date(exp.date) >= threeMonthsAgo)
        .map(exp => exp.vendor_id)
        .filter(Boolean)
    );

    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Calculate this month's expenses
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const monthExpenses = expenses
      .filter(exp => new Date(exp.date) >= firstDayOfMonth)
      .reduce((sum, exp) => sum + (exp.amount || 0), 0);

    return {
      totalVendors: vendors.length,
      activeVendors: activeVendorIds.size,
      totalExpenses,
      monthExpenses,
    };
  }, [vendors, expenses]);

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
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerSubtitle}>Manage your</Text>
              <Text style={styles.headerTitle}>Vendors</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => {
                setShowSearch(!showSearch);
                if (showSearch) {
                  setSearchQuery('');
                  Keyboard.dismiss();
                }
              }}
            >
              <BlurView intensity={80} tint="light" style={styles.searchButtonBlur}>
                <View style={styles.searchButtonInner}>
                  <Feather name={showSearch ? "x" : "search"} size={18} color="#EF4444" />
                </View>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <BlurView intensity={80} tint="light" style={styles.addButtonBlur}>
                <View style={styles.addButtonInner}>
                  <Feather name="plus" size={18} color="#EF4444" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Feather name="search" size={16} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search vendors..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x-circle" size={16} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </LinearGradient>

      {/* KPI Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kpiContainer}
        style={styles.kpiScrollView}
      >
        <View style={styles.kpiCard}>
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.kpiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconContainer}>
                <MaterialIcons name="store" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>Total Vendors</Text>
                <Text style={styles.kpiValue}>{kpis.totalVendors}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.kpiCard}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.kpiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconContainer}>
                <MaterialIcons name="trending-up" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>Active Vendors</Text>
                <Text style={styles.kpiValue}>{kpis.activeVendors}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.kpiCard}>
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={styles.kpiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconContainer}>
                <MaterialIcons name="receipt" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>Total Expenses</Text>
                <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(kpis.totalExpenses)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.kpiCard}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.kpiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconContainer}>
                <MaterialIcons name="calendar-today" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>This Month</Text>
                <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(kpis.monthExpenses)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

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
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  searchButtonBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  searchButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonBlur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  addButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 20,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  kpiScrollView: {
    marginTop: 16,
  },
  kpiContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  kpiCard: {
    borderRadius: 20,
  },
  kpiGradient: {
    width: 180,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  kpiIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  kpiTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  listContent: {
    paddingTop: 8,
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