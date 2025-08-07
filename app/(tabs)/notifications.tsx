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
import { useAuth } from '../../src/hooks/useAuth';
import { useSettings } from '../../src/contexts/SettingsContext';
import { 
  getNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotifications // You'll need to add this function
} from '../../src/services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/Colors';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';

interface NotificationItemProps {
  notification: any;
  onPress: (notification: any) => void;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  onPress, 
  isSelecting, 
  isSelected, 
  onSelect 
}) => {
  const { formatCurrency } = useSettings();
  
  const getIcon = () => {
    switch (notification.type) {
      case 'invoice_paid':
        return { name: 'check-circle', color: '#10B981' };
      case 'invoice_overdue':
        return { name: 'alert-circle', color: '#EF4444' };
      case 'payment_received':
        return { name: 'dollar-sign', color: '#10B981' };
      case 'team_invite':
        return { name: 'bell', color: Colors.light.primary };
      default:
        return { name: 'bell', color: Colors.light.primary };
    }
  };

  const icon = getIcon();

  // Format notification message with proper currency
  const formatMessage = (message: string) => {
    const amountPattern = /\$?(\d+(?:\.\d{2})?)/g;
    return message.replace(amountPattern, (match, amount) => {
      const numAmount = parseFloat(amount);
      return formatCurrency(numAmount);
    });
  };

  const handlePress = () => {
    if (isSelecting) {
      onSelect(notification.id);
    } else {
      onPress(notification);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !notification.is_read && styles.unreadItem,
        isSelected && styles.selectedItem,
      ]}
      onPress={handlePress}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(notification.id);
      }}
      activeOpacity={0.7}
    >
      {isSelecting && (
        <View style={styles.checkboxContainer}>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && (
              <Feather name="check" size={16} color="#FFFFFF" />
            )}
          </View>
        </View>
      )}
      
      <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
        <Feather name={icon.name as any} size={20} color={icon.color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {formatMessage(notification.message)}
        </Text>
        <Text style={styles.time}>
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </Text>
      </View>
      {!notification.is_read && !isSelecting && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => getNotifications(user!.id),
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
    },
  });

  const deleteNotificationsMutation = useMutation({
    mutationFn: (ids: string[]) => deleteNotifications(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setSelectedIds([]);
      setIsSelecting(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to delete notifications');
    },
  });

  const handleNotificationPress = async (notification: any) => {
    if (!notification.is_read) {
      await markAsReadMutation.mutateAsync(notification.id);
    }
    // Here you could add navigation to the related content
    // e.g., if (notification.type === 'invoice_paid') navigation.navigate('InvoiceView', { invoiceId: notification.related_id })
  };

  const handleMarkAllAsRead = () => {
    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: () => markAllAsReadMutation.mutate(),
        },
      ]
    );
  };

  const toggleSelectMode = () => {
    if (isSelecting) {
      setSelectedIds([]);
    }
    setIsSelecting(!isSelecting);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSelectAll = () => {
    if (notifications) {
      if (selectedIds.length === notifications.length) {
        setSelectedIds([]);
      } else {
        setSelectedIds(notifications.map((n: any) => n.id));
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSelect = (id: string) => {
    setIsSelecting(true);
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = () => {
    const count = selectedIds.length;
    Alert.alert(
      'Delete Notifications',
      `Are you sure you want to delete ${count} notification${count > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotificationsMutation.mutate(selectedIds),
        },
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
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (isSelecting) {
              setIsSelecting(false);
              setSelectedIds([]);
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backButton}
        >
          <Feather 
            name={isSelecting ? "x" : "arrow-left"} 
            size={24} 
            color={Colors.light.text} 
          />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {isSelecting ? `${selectedIds.length} selected` : 'Notifications'}
        </Text>
        
        <View style={styles.headerRight}>
          {isSelecting ? (
            <View style={styles.selectionActions}>
              <TouchableOpacity 
                onPress={handleSelectAll}
                style={styles.headerButton}
              >
                <Text style={styles.headerButtonText}>
                  {selectedIds.length === notifications?.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.normalActions}>
              {notifications && notifications.length > 0 && (
                <TouchableOpacity 
                  onPress={toggleSelectMode}
                  style={styles.iconButton}
                >
                  <MaterialIcons name="check-circle-outline" size={24} color={Colors.light.primary} />
                </TouchableOpacity>
              )}
              {unreadCount > 0 && (
                <TouchableOpacity 
                  onPress={handleMarkAllAsRead}
                  style={styles.iconButton}
                >
                  <Feather name="check-square" size={22} color={Colors.light.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Selection toolbar */}
      {isSelecting && selectedIds.length > 0 && (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity
            style={[styles.toolbarButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Feather name="trash-2" size={20} color="#FFFFFF" />
            <Text style={styles.toolbarButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={handleNotificationPress}
            isSelecting={isSelecting}
            isSelected={selectedIds.includes(item.id)}
            onSelect={handleSelect}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          isSelecting && selectedIds.length > 0 && styles.listContentWithToolbar
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={48} color={Colors.light.textTertiary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              We'll notify you when something important happens
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
    backgroundColor: Colors.light.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  normalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: Spacing.xs,
  },
  headerButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  headerButtonText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  selectionToolbar: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  deleteButton: {
    backgroundColor: Colors.light.error,
  },
  toolbarButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    paddingVertical: Spacing.sm,
  },
  listContentWithToolbar: {
    paddingBottom: Spacing.xxl,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.light.background,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  unreadItem: {
    backgroundColor: Colors.light.primary + '08',
  },
  selectedItem: {
    backgroundColor: Colors.light.primary + '15',
    borderWidth: 1,
    borderColor: Colors.light.primary + '30',
  },
  checkboxContainer: {
    marginRight: Spacing.sm,
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  checkboxSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
    marginLeft: Spacing.sm,
    marginTop: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 3,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});