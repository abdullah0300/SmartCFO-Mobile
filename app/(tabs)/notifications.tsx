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
import { Notification } from '../../src/types';
import { Swipeable } from 'react-native-gesture-handler';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onDelete: (notificationId: string) => void;
  formatCurrency: (amount: number | null | undefined) => string;
  baseCurrency: string;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onDelete,
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

  // Format notification message with proper currency (matches webapp logic)
  const formatMessage = (message: string) => {
    let formattedMessage = message;

    // Get data from either metadata or data field (backend uses metadata, but support both)
    const notifData = notification.metadata || notification.data;

    // Check if notification was already formatted at creation
    if (notifData?.formatted_at_creation) {
      return formattedMessage; // Already formatted, return as-is
    }

    // Legacy formatting for old notifications
    if (notifData?.amount !== undefined) {
      const amount = notifData.amount;
      const currency = notifData.currency || baseCurrency;
      // Replace dollar amounts like $500 or $1,000.00 with properly formatted currency
      formattedMessage = formattedMessage.replace(/\$[\d,]+\.?\d*/g, () => {
        return formatCurrency(Math.abs(amount), { currency });
      });
    } else {
      // Fallback: parse amount from message if metadata doesn't have it
      formattedMessage = formattedMessage.replace(/\$[\d,]+\.?\d*/g, (match: string) => {
        const amount = parseFloat(match.replace(/[$,]/g, ''));
        return formatCurrency(Math.abs(amount), { currency: baseCurrency });
      });
    }

    // Handle client name placeholders
    if (notifData?.client_name) {
      formattedMessage = formattedMessage.replace('{{client}}', notifData.client_name);
    }

    // Handle invoice number placeholders
    if (notifData?.invoice_number) {
      formattedMessage = formattedMessage.replace('{{invoice}}', `#${notifData.invoice_number}`);
    }

    return formattedMessage;
  };

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDelete(notification.id);
      }}
    >
      <Feather name="trash-2" size={20} color="#FFFFFF" />
      <Text style={styles.deleteButtonText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
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
            {formatMessage(notification.message)}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.time}>
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </Text>

            {((notification.metadata?.currency || notification.data?.currency) &&
              (notification.metadata?.currency || notification.data?.currency) !== baseCurrency) && (
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyText}>
                  {notification.metadata?.currency || notification.data?.currency}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { formatCurrency, baseCurrency } = useSettings();
  const [refreshing, setRefreshing] = useState(false);

  const { data: notifications, isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const allNotifications = await getNotifications(user!.id);
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

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationIds: string[]) => deleteNotifications(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }

    // Get data from either metadata or data field
    const notifData = notification.metadata || notification.data;

    // Navigate based on notification type
    switch (notification.type) {
      case 'invoice_paid':
      case 'invoice_overdue':
        if (notifData?.invoice_id) {
          navigation.navigate('InvoiceView', {
            invoiceId: notifData.invoice_id
          });
        }
        break;
      case 'payment_received':
        if (notifData?.income_id) {
          navigation.navigate('TransactionDetail', {
            transactionId: notifData.income_id,
            type: 'income'
          });
        } else {
          // Fallback to Income tab if no specific income_id
          navigation.navigate('Income' as any);
        }
        break;
      case 'expense_high':
      case 'expense_added':
        if (notifData?.expense_id) {
          navigation.navigate('TransactionDetail', {
            transactionId: notifData.expense_id,
            type: 'expense'
          });
        } else {
          // Fallback to Expenses tab
          navigation.navigate('Expenses' as any);
        }
        break;
      case 'tax_reminder':
        // Navigate to Reports/Tax section
        navigation.navigate('ReportsOverview' as any);
        break;
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotificationMutation.mutateAsync([notificationId]);
  };

  const handleDeleteAll = () => {
    if (!notifications || notifications.length === 0) return;

    Alert.alert(
      'Delete All Notifications',
      `Are you sure you want to delete all ${notifications.length} notification${notifications.length !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const allIds = notifications.map(n => n.id);
            await deleteNotificationMutation.mutateAsync(allIds);
          }
        }
      ]
    );
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

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={() => markAllAsReadMutation.mutate()}
              style={styles.markAllButton}
            >
              <Feather name="check-circle" size={18} color="#FFFFFF" />
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}

          {notifications && notifications.length > 0 && (
            <TouchableOpacity
              onPress={handleDeleteAll}
              style={styles.deleteAllButton}
            >
              <Feather name="trash-2" size={18} color="#FFFFFF" />
              <Text style={styles.deleteAllText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={handleNotificationPress}
            onDelete={handleDeleteNotification}
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
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>
              We'll notify you about important updates
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
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
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteAllText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
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
  deleteButton: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 12,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});