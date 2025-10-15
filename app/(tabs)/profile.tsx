// app/(tabs)/profile.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../src/hooks/useAuth';
import { useBiometric } from '../../src/hooks/useBiometric';
import { getProfile, updateProfile } from '../../src/services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/Colors';
import { FloatingCalculator } from '../../src/components/common/FloatingCalculator';
import { supabase } from '../../src/services/supabase';

interface ProfileData {
  id?: string;
  full_name?: string;
  phone?: string;
  company_name?: string;
  company_address?: string;
  company_logo?: string;
  privacy_preference?: 'show' | 'hide' | null;
}

interface FormData {
  full_name: string;
  phone: string;
  company_name: string;
  company_address: string;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    biometricType,
    disableBiometric,
    refreshStatus: refreshBiometricStatus
  } = useBiometric();

  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const [privacyPreference, setPrivacyPreference] = useState<'show' | 'hide'>('show');
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    phone: '',
    company_name: '',
    company_address: '',
  });
  
  const { data: profile, isLoading, refetch } = useQuery<ProfileData>({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });

  // Update form data when profile data changes
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        company_name: profile.company_name || '',
        company_address: profile.company_address || '',
      });
      // Load privacy preference
      if (profile.privacy_preference === 'show' || profile.privacy_preference === 'hide') {
        setPrivacyPreference(profile.privacy_preference);
      }
    }
  }, [profile]);

  // Refresh biometric status when screen focuses
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshBiometricStatus();
    });
    return unsubscribe;
  }, [navigation, refreshBiometricStatus]);

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => updateProfile(user!.id, data),
    onSuccess: () => {
      refetch();
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const handleBiometricToggle = () => {
    if (biometricEnabled) {
      Alert.alert(
        `Disable ${biometricType}`,
        `Are you sure you want to disable ${biometricType} login?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await disableBiometric();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', `${biometricType} login has been disabled`);
            }
          }
        ]
      );
    } else {
      Alert.alert(
        `Enable ${biometricType}`,
        `To enable ${biometricType} login, please sign out and sign in again. You'll see the option to enable ${biometricType} during login.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out Now',
            onPress: handleSignOut
          }
        ]
      );
    }
  };

  const handlePrivacyToggle = async (value: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPreference = value ? 'show' : 'hide';
      setPrivacyPreference(newPreference);

      // Update in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ privacy_preference: newPreference })
        .eq('id', user!.id);

      if (error) throw error;

      // Invalidate all profile queries to update dashboard and other screens
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error updating privacy preference:', error);
      Alert.alert('Error', 'Failed to update privacy preference');
      // Revert the toggle
      setPrivacyPreference(value ? 'hide' : 'show');
    }
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const openDashboardSettings = () => {
    const dashboardUrl = 'https://smartcfo.webcraftio.com/settings/profile';
    Linking.openURL(dashboardUrl).catch((err) => 
      Alert.alert('Error', 'Could not open dashboard settings')
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const ProfileField = ({ 
    label, 
    value, 
    icon, 
    field, 
    editable = true 
  }: {
    label: string;
    value?: string;
    icon: string;
    field: keyof FormData | null;
    editable?: boolean;
  }) => (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldIcon}>
        <Feather name={icon as any} size={20} color={Colors.light.textSecondary} />
      </View>
      <View style={styles.fieldContent}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isEditing && editable && field !== null ? (
          <TextInput
            style={styles.fieldInput}
            value={formData[field]}
            onChangeText={(text) => setFormData(prev => ({ ...prev, [field]: text }))}
            placeholder={`Enter ${label.toLowerCase()}`}
            placeholderTextColor={Colors.light.textTertiary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
          />
        ) : (
          <Text style={styles.fieldValue}>{value || 'Not set'}</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
            >
              {isEditing ? (
                <Feather name="check" size={20} color={Colors.light.primary} />
              ) : (
                <Feather name="edit-2" size={20} color={Colors.light.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <LinearGradient
              colors={['#3B82F6', '#8B5CF6']}
              style={styles.profileGradient}
            >
              {profile?.company_logo ? (
                <Image
                  source={{ uri: profile.company_logo }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileInitial}>
                    {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
            </LinearGradient>
            
            <Text style={styles.profileName}>
              {profile?.full_name || 'User'}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            
            {profile?.company_name && (
              <View style={styles.companyBadge}>
                <Feather name="briefcase" size={14} color={Colors.light.primary} />
                <Text style={styles.companyName}>{profile.company_name}</Text>
              </View>
            )}
          </View>

          {/* Profile Fields */}
          <View style={styles.fieldsContainer}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <ProfileField
              label="Full Name"
              value={profile?.full_name}
              icon="user"
              field="full_name"
            />
            <ProfileField
              label="Email"
              value={user?.email}
              icon="mail"
              field={null}
              editable={false}
            />
            <ProfileField
              label="Phone"
              value={profile?.phone}
              icon="phone"
              field="phone"
            />
            
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
              Company Information
            </Text>
            
            <ProfileField
              label="Company Name"
              value={profile?.company_name}
              icon="briefcase"
              field="company_name"
            />
            <ProfileField
              label="Address"
              value={profile?.company_address}
              icon="map-pin"
              field="company_address"
            />
          </View>

          {/* Security Settings Section */}
          <View style={styles.fieldsContainer}>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
              Security Settings
            </Text>

            {/* Biometric Setting */}
            {biometricAvailable && (
              <TouchableOpacity
                style={styles.securityOption}
                onPress={handleBiometricToggle}
                activeOpacity={0.7}
              >
                <View style={styles.securityOptionLeft}>
                  <View style={styles.fieldIcon}>
                    <MaterialIcons
                      name={biometricType === 'Biometric' ? 'face' : 'fingerprint'}
                      size={20}
                      color={Colors.light.textSecondary}
                    />
                  </View>
                  <View style={styles.securityOptionContent}>
                    <Text style={styles.securityOptionTitle}>
                      {biometricType} Login
                    </Text>
                    <Text style={styles.securityOptionSubtitle}>
                      {biometricEnabled
                        ? `Quick login with ${biometricType}`
                        : `Enable ${biometricType} for quick access`}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: '#E5E7EB', true: Colors.light.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E5E7EB"
                />
              </TouchableOpacity>
            )}

            {/* Privacy Preference Setting */}
            <View style={styles.securityOption}>
              <View style={styles.securityOptionLeft}>
                <View style={styles.fieldIcon}>
                  <Feather
                    name={privacyPreference === 'show' ? 'eye' : 'eye-off'}
                    size={20}
                    color={Colors.light.textSecondary}
                  />
                </View>
                <View style={styles.securityOptionContent}>
                  <Text style={styles.securityOptionTitle}>
                    Show Amounts by Default
                  </Text>
                  <Text style={styles.securityOptionSubtitle}>
                    {privacyPreference === 'show'
                      ? 'Financial data always visible'
                      : 'Amounts hidden for privacy'}
                  </Text>
                </View>
              </View>
              <Switch
                value={privacyPreference === 'show'}
                onValueChange={handlePrivacyToggle}
                trackColor={{ false: '#E5E7EB', true: Colors.light.primary }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E5E7EB"
              />
            </View>

          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={openDashboardSettings}>
              <Feather name="settings" size={20} color={Colors.light.text} />
              <Text style={styles.actionText}>Advanced Settings</Text>
              <Feather name="external-link" size={16} color={Colors.light.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.actionButton, styles.signOutButton]} onPress={handleSignOut}>
              <Feather name="log-out" size={20} color="#EF4444" />
              <Text style={[styles.actionText, { color: '#EF4444' }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Calculator */}
      <FloatingCalculator position="right" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  profileGradient: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    padding: 3,
    marginBottom: Spacing.md,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.full,
    objectFit: 'contain',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.md,
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary + '15',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  companyName: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '500',
  },
  fieldsContainer: {
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.md,
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
  },
  fieldInput: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.primary,
    paddingVertical: 2,
  },
  // New styles for security settings
  securityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  securityOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  securityOptionContent: {
    flex: 1,
  },
  securityOptionTitle: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  securityOptionSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  actions: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    marginLeft: Spacing.md,
  },
  signOutButton: {
    marginTop: Spacing.md,
  },
});