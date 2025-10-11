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
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../hooks/useAuth';
import { getClients, supabase } from '../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { Client } from '../types';
import { AddClientModal } from '../components/clients/AddClientModal';
import { EditClientModal } from '../components/clients/EditClientModal';
import { useSettings } from '../contexts/SettingsContext';
import { subMonths } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ClientItem = ({ 
  item, 
  onPress,
  onEdit,
  onDelete 
}: { 
  item: Client; 
  onPress: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}) => {
  return (
    <TouchableOpacity 
      style={styles.clientItem} 
      activeOpacity={0.7}
      onPress={() => onPress(item)}
    >
      <View style={styles.itemContent}>
        <View style={styles.itemLeft}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#3B82F6', '#8B5CF6']}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </View>
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.email && (
              <View style={styles.itemMeta}>
                <Feather name="mail" size={12} color={Colors.light.textTertiary} />
                <Text style={styles.itemEmail}>{item.email}</Text>
              </View>
            )}
            {item.phone && (
              <View style={styles.itemMeta}>
                <Feather name="phone" size={12} color={Colors.light.textTertiary} />
                <Text style={styles.itemPhone}>{item.phone}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onEdit(item)}
          >
            <Feather name="edit-2" size={18} color={Colors.light.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onDelete(item)}
          >
            <Feather name="trash-2" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function ClientsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { formatCurrency } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
const navigation = useNavigation<NavigationProp>();

  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ['clients', user?.id],
    queryFn: () => getClients(user!.id),
    enabled: !!user,
  });

  // Fetch invoices to calculate revenue
  const { data: invoices } = useQuery({
    queryKey: ['invoices', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('client_id, total, status, date')
        .eq('user_id', user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!clients || !invoices) {
      return {
        totalClients: clients?.length || 0,
        activeClients: 0,
        totalRevenue: 0,
        monthRevenue: 0,
      };
    }

    // Get clients with invoices in last 3 months
    const threeMonthsAgo = subMonths(new Date(), 3);
    const activeClientIds = new Set(
      invoices
        .filter(inv => new Date(inv.date) >= threeMonthsAgo)
        .map(inv => inv.client_id)
        .filter(Boolean)
    );

    // Calculate total revenue from paid invoices
    const totalRevenue = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    // Calculate this month's revenue
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const monthRevenue = invoices
      .filter(inv =>
        inv.status === 'paid' &&
        new Date(inv.date) >= firstDayOfMonth
      )
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    return {
      totalClients: clients.length,
      activeClients: activeClientIds.size,
      totalRevenue,
      monthRevenue,
    };
  }, [clients, invoices]);

  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleDelete = (client: Client) => {
    Alert.alert(
      'Delete Client',
      `Are you sure you want to delete ${client.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(client.id),
        },
      ]
    );
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setShowEditModal(true);
  };

  const handleClientPress = (client: Client) => {
  navigation.navigate('ClientDetail', { clientId: client.id });
  };

  const filteredClients = clients?.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#3B82F6', '#2563EB']}
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
              <Text style={styles.headerTitle}>Clients</Text>
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
                  <Feather name={showSearch ? "x" : "search"} size={18} color="#3B82F6" />
                </View>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <BlurView intensity={80} tint="light" style={styles.addButtonBlur}>
                <View style={styles.addButtonInner}>
                  <Feather name="plus" size={18} color="#3B82F6" />
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
                placeholder="Search clients..."
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
            colors={['#3B82F6', '#2563EB']}
            style={styles.kpiGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.kpiHeader}>
              <View style={styles.kpiIconContainer}>
                <MaterialIcons name="people" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>Total Clients</Text>
                <Text style={styles.kpiValue}>{kpis.totalClients}</Text>
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
                <Text style={styles.kpiLabel}>Active Clients</Text>
                <Text style={styles.kpiValue}>{kpis.activeClients}</Text>
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
                <MaterialIcons name="account-balance-wallet" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>Total Revenue</Text>
                <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(kpis.totalRevenue)}
                </Text>
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
                <MaterialIcons name="calendar-today" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.kpiTextContainer}>
                <Text style={styles.kpiLabel}>This Month</Text>
                <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(kpis.monthRevenue)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      <FlatList
        data={filteredClients}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClientItem 
            item={item} 
            onPress={handleClientPress}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#DBEAFE', '#BFDBFE']}
              style={styles.emptyIcon}
            >
              <MaterialIcons name="people" size={48} color="#3B82F6" />
            </LinearGradient>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No clients found' : 'No clients yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery 
                ? 'Try searching with a different term' 
                : 'Add your first client to get started'
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => setShowAddModal(true)}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.emptyButtonGradient}
                >
                  <Feather name="plus" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Add Client</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <AddClientModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <EditClientModal
        visible={showEditModal}
        client={selectedClient}
        onClose={() => {
          setShowEditModal(false);
          setSelectedClient(null);
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
  clientItem: {
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
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  itemEmail: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  itemPhone: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
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