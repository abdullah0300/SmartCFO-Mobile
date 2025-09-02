// app/(tabs)/notifications.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/hooks/useAuth';
import { useSettings } from '../../src/contexts/SettingsContext';
import { 
  getNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotifications
} from '../../src/services/api';
import { Colors, Spacing, BorderRadius } from '../../src/constants/Colors';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface NotificationItemProps {
  notification: any;
  onPress: (notification: any) => void;
  formatCurrency: (amount: number | null | undefined) => string;
  baseCurrency: string;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  onPress,
  formatCurrency,
  baseCurrency
}) => {
  
  const getIcon = () => {
    switch (notification.type) {
      case 'invoice_paid':
        return { name: 'check-circle', color: '#10B981' };
      case 'invoice_overdue':
        return { name: 'alert-circle', color: '#EF4444' };
      case 'payment_received':
        return { name: 'attach-money', color: '#10B981', isMaterial: true };
      case 'expense_high':
        return { name: 'trending-up', color: '#F59E0B', isMaterial: true };
      case 'tax_reminder':
        return { name: 'receipt', color: '#8B5CF6', isMaterial: true };
      default:
        return { name: 'bell', color: '#6366F1' };
    }
  };

  const icon = getIcon();

  // Format notification message with proper currency
  const formatMessage = (message: string, data: any) => {
    let formattedMessage = message;
    
    // Handle amount formatting
    if (data?.amount !== undefined) {
      const formattedAmount = formatCurrency(data.amount);
      formattedMessage = formattedMessage.replace('{{amount}}', formattedAmount);
    }
    
    // Handle client name
    if (data?.client_name) {
      formattedMessage = formattedMessage.replace('{{client}}', data.client_name);
    }
    
    // Handle invoice number
    if (data?.invoice_number) {
      formattedMessage = formattedMessage.replace('{{invoice}}', `#${data.invoice_number}`);
    }
    
    return formattedMessage;
  };

  return (
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
        {icon.isMaterial ? (
          <MaterialIcons name={icon.name as any} size={20} color={icon.color} />
        ) : (
          <Feather name={icon.name as any} size={20} color={icon.color} />
        )}
      </View>
      
      <View style={styles.content}>
        <View style={styles.contentHeader}>
          <Text style={styles.title}>{notification.title}</Text>
          {!notification.is_read && <View style={styles.unreadDot} />}
        </View>
        
        <Text style={styles.message} numberOfLines={2}>
          {formatMessage(notification.message, notification.data)}
        </Text>
        
        <View style={styles.metaRow}>
          <Text style={styles.time}>
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </Text>
          
          {notification.data?.currency && notification.data.currency !== baseCurrency && (
            <View style={styles.currencyBadge}>
              <Text style={styles.currencyText}>{notification.data.currency}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { formatCurrency, baseCurrency } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'financial'>('all');

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id, filter],
    queryFn: async () => {
      const allNotifications = await getNotifications(user!.id);
      
      // Filter based on selected filter
      if (filter === 'unread') {
        return allNotifications.filter((n: any) => !n.is_read);
      } else if (filter === 'financial') {
        return allNotifications.filter((n: any) => 
          ['invoice_paid', 'invoice_overdue', 'payment_received', 'expense_high'].includes(n.type)
        );
      }
      return allNotifications;
    },
    enabled: !!user,
  });

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead(user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleNotificationPress = async (notification: any) => {
    if (!notification.is_read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'invoice_paid':
      case 'invoice_overdue':
        if (notification.data?.invoice_id) {
          navigation.navigate('InvoiceView', { 
            invoiceId: notification.data.invoice_id 
          });
        }
        break;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#3B82F6', '#8B5CF6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        
        {unreadCount > 0 && (
          <TouchableOpacity 
            onPress={() => markAllAsReadMutation.mutate()}
            style={styles.markAllButton}
          >
            <Feather name="check-circle" size={18} color="#FFFFFF" />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'unread', 'financial'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setFilter(tab)}
            style={[
              styles.filterTab,
              filter === tab && styles.filterTabActive,
            ]}
          >
            <Text style={[
              styles.filterTabText,
              filter === tab && styles.filterTabTextActive,
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={handleNotificationPress}
            formatCurrency={formatCurrency}
            baseCurrency={baseCurrency}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#EFF6FF', '#DBEAFE']}
              style={styles.emptyIcon}
            >
              <Feather name="bell-off" size={32} color="#3B82F6" />
            </LinearGradient>
            <Text style={styles.emptyText}>
              {filter === 'unread' ? 'All caught up!' : 'No notifications'}
            </Text>
            <Text style={styles.emptySubtext}>
              {filter === 'unread' 
                ? 'You have no unread notifications'
                : "We'll notify you about important updates"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unreadBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  markAllText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: '#EEF2FF',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#6366F1',
  },
  listContent: {
    paddingVertical: Spacing.md,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  currencyBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currencyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 3,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});