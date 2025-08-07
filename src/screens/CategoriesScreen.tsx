import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../hooks/useAuth';
import { getCategories, supabase } from '../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/Colors';
import { Category } from '../types';
import { AddCategoryModal } from '../components/categories/AddCategoryModal';

interface CategorySectionProps {
  title: string;
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  emptyMessage: string;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  title,
  categories,
  onEdit,
  onDelete,
  emptyMessage,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {categories.length === 0 ? (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      ) : (
        <View style={styles.categoryGrid}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => onEdit(category)}
              activeOpacity={0.7}
            >
              <View style={styles.categoryContent}>
                <View style={styles.categoryLeft}>
                  <View 
                    style={[
                      styles.categoryDot, 
                      { backgroundColor: category.color }
                    ]} 
                  />
                  <Text style={styles.categoryName}>{category.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => onDelete(category)}
                >
                  <Feather name="trash-2" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default function CategoriesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryType, setCategoryType] = useState<'income' | 'expense'>('income');

  const { data: categories, isLoading, refetch } = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: () => getCategories(user!.id),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      // Check if category is in use
      const { data: incomes } = await supabase
        .from('income')
        .select('id')
        .eq('category_id', categoryId)
        .limit(1);
      
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id')
        .eq('category_id', categoryId)
        .limit(1);
      
      if ((incomes && incomes.length > 0) || (expenses && expenses.length > 0)) {
        throw new Error('Category is in use and cannot be deleted');
      }
      
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
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

  const handleDelete = (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(category.id),
        },
      ]
    );
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setShowEditModal(true);
  };

  const handleAddCategory = (type: 'income' | 'expense') => {
    setCategoryType(type);
    setShowAddModal(true);
  };

  const incomeCategories = categories?.filter(c => c.type === 'income') || [];
  const expenseCategories = categories?.filter(c => c.type === 'expense') || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#6366F1', '#4F46E5']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Categories</Text>
          
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
      >
        <CategorySection
          title="Income Categories"
          categories={incomeCategories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          emptyMessage="No income categories yet"
        />
        
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: '#10B981' }]}
          onPress={() => handleAddCategory('income')}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Income Category</Text>
        </TouchableOpacity>

        <CategorySection
          title="Expense Categories"
          categories={expenseCategories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          emptyMessage="No expense categories yet"
        />
        
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: '#EF4444' }]}
          onPress={() => handleAddCategory('expense')}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Expense Category</Text>
        </TouchableOpacity>
      </ScrollView>

      <AddCategoryModal
        visible={showAddModal}
        type={categoryType}
        onClose={() => setShowAddModal(false)}
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
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  categoryGrid: {
    gap: Spacing.sm,
  },
  categoryCard: {
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 8,
    marginBottom: Spacing.xl,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});