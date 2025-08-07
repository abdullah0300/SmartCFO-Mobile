import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/Colors';
import { AIInsight } from '../../services/aiInsightsService';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');

interface AIInsightsModalProps {
  visible: boolean;
  onClose: () => void;
  insights: AIInsight[];
  loading: boolean;
  onRefresh?: () => void;
}

const InsightCard = ({ insight, index }: { insight: AIInsight; index: number }) => {
  const getStyleByType = () => {
    switch (insight.type) {
      case 'urgent':
        return {
          gradient: ['#FEE2E2', '#FECACA'],
          iconBg: '#EF4444',
          titleColor: '#991B1B',
          icon: 'alert-circle',
        };
      case 'warning':
        return {
          gradient: ['#FEF3C7', '#FDE68A'],
          iconBg: '#F59E0B',
          titleColor: '#92400E',
          icon: 'alert-triangle',
        };
      case 'success':
        return {
          gradient: ['#D1FAE5', '#A7F3D0'],
          iconBg: '#10B981',
          titleColor: '#064E3B',
          icon: 'trending-up',
        };
      case 'info':
      default:
        return {
          gradient: ['#DBEAFE', '#BFDBFE'],
          iconBg: '#3B82F6',
          titleColor: '#1E3A8A',
          icon: 'info',
        };
    }
  };

  const style = getStyleByType();

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      style={[styles.insightCard, { marginTop: index === 0 ? 0 : Spacing.md }]}
    >
      <LinearGradient
        colors={style.gradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.insightGradient}
      >
        <View style={styles.insightContent}>
          <View style={[styles.iconContainer, { backgroundColor: style.iconBg }]}>
            <Feather name={style.icon as any} size={22} color="#FFFFFF" />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={[styles.insightTitle, { color: style.titleColor }]}>
              {insight.title}
            </Text>
            <Text style={styles.insightMessage}>
              {insight.message}
            </Text>
            
            {insight.action && (
              <TouchableOpacity style={styles.actionChip}>
                <Text style={[styles.actionText, { color: style.iconBg }]}>
                  {insight.action.label}
                </Text>
                <Feather name="arrow-right" size={14} color={style.iconBg} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

export const AIInsightsModal: React.FC<AIInsightsModalProps> = ({
  visible,
  onClose,
  insights,
  loading,
  onRefresh,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <BlurView intensity={100} tint="dark" style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View style={styles.modalContainer}>
          {/* Animated gradient background */}
          <LinearGradient
            colors={['#FFFFFF', '#F3F4F6']}
            style={styles.modalContent}
          >
            {/* Pull indicator */}
            <View style={styles.pullIndicator} />
            
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.logoGradient}
                >
                  <Ionicons name="sparkles" size={24} color="#FFFFFF" />
                </LinearGradient>
                <View>
                  <Text style={styles.headerTitle}>AI Insights</Text>
                  <Text style={styles.headerSubtitle}>Powered by SmartCFO</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.loadingGradient}
                >
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.loadingText}>
                  Analyzing your financial data...
                </Text>
                <Text style={styles.loadingSubtext}>
                  This usually takes a few seconds
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {insights.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>
                      What we discovered today
                    </Text>
                    {insights
                      .sort((a, b) => a.priority - b.priority)
                      .map((insight, index) => (
                        <InsightCard 
                          key={insight.id} 
                          insight={insight} 
                          index={index}
                        />
                      ))}
                  </>
                ) : (
                  <View style={styles.emptyState}>
                    <LinearGradient
                      colors={['#E0E7FF', '#C7D2FE']}
                      style={styles.emptyIcon}
                    >
                      <Ionicons name="bulb-outline" size={40} color="#6366F1" />
                    </LinearGradient>
                    <Text style={styles.emptyTitle}>No insights yet</Text>
                    <Text style={styles.emptyText}>
                      Add more transactions to get personalized financial insights
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Footer */}
            {!loading && (
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Updated {format(new Date(), 'MMM d \'at\' h:mm a')}
                </Text>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={onRefresh}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={14} color="#6366F1" />
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.lg,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalContent: {
    maxHeight: '85%',
    minHeight: 400,
  },
  pullIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoGradient: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.md,
  },
  insightCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  insightGradient: {
    padding: Spacing.md,
  },
  insightContent: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textContainer: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightMessage: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 3,
  },
  loadingGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E0E7FF',
    borderRadius: BorderRadius.full,
  },
  refreshText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '500',
  },
});