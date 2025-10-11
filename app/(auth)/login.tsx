// app/(auth)/login.tsx
import React, { useState, useEffect } from 'react';
import { Image } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Linking,
  Dimensions,
  TextInput, 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../src/hooks/useAuth';
import { useBiometric } from '../../src/hooks/useBiometric';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/Colors';

const { width, height } = Dimensions.get('window');

// Define navigation types
type RootStackParamList = {
  Main: undefined;
  Login: undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const { signIn, signInWithBiometric, signInWithOAuth } = useAuth();
  const { 
    isAvailable, 
    isEnabled, 
    biometricType, 
    enableBiometric,
    loading: biometricLoading
  } = useBiometric();
  
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enableBiometricOnLogin, setEnableBiometricOnLogin] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [storedEmail, setStoredEmail] = useState('');
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  // Check for biometric login on mount
  useEffect(() => {
    if (!biometricLoading && isEnabled) {
      setTimeout(() => {
        handleBiometricLogin();
      }, 500);
    }
  }, [biometricLoading, isEnabled]);

  useFocusEffect(
  React.useCallback(() => {
    if (!biometricLoading && isEnabled) {
      setTimeout(() => {
        handleBiometricLogin();
      }, 500);
    }
  }, [biometricLoading, isEnabled])
);
  useEffect(() => {
  const getStoredEmail = async () => {
    const email = await SecureStore.getItemAsync('user_email');
    if (email) setStoredEmail(email);
  };
  getStoredEmail();
}, []);

  const handleBiometricLogin = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const success = await signInWithBiometric();
    if (!success) {
      Alert.alert(
        'Biometric Login Failed',
        'Please use your email and password to sign in.'
      );
    }
    setLoading(false);
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await signIn(email, password);

      // If user wants to enable biometric
      if (enableBiometricOnLogin && isAvailable) {
        const success = await enableBiometric(email, password);
        if (success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        error.message || 'Please check your credentials and try again'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'linkedin_oidc') => {
    setSocialLoading(provider);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      console.log(`🔐 Starting OAuth flow for ${provider}`);
      const result = await signInWithOAuth(provider);
      console.log('✅ OAuth initiated successfully:', result);

      // Clear loading state after browser opens (give it a moment)
      setTimeout(() => {
        setSocialLoading(null);
      }, 1500);
    } catch (error: any) {
      console.error('❌ OAuth error:', error);
      Alert.alert(
        'Authentication Failed',
        error.message || 'Could not complete authentication. Please try again.'
      );
      setSocialLoading(null);
    }
  };

  const handleSignUpRedirect = () => {
    // Redirect to web app sign up
    Linking.openURL('https://smartcfo.webcraftio.com/register').catch(err => 
      Alert.alert('Error', 'Could not open sign up page')
    );
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      'You will be redirected to the web app to reset your password.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            Linking.openURL('https://smartcfo.webcraftio.com/login').catch(err =>
              Alert.alert('Error', 'Could not open the link')
            );
          },
        },
      ]
    );
  };

  if (biometricLoading) {
    return (
      <LinearGradient
        colors={['#FFFFFF', '#F0F9FF', '#E0F2FE']}
         style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#6366F1', '#8B5CF6', '#EC4899']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating Elements */}
      <View style={styles.floatingElements}>
        <View style={[styles.floatingCircle, styles.circle1]} />
        <View style={[styles.floatingCircle, styles.circle2]} />
        <Ionicons name="calculator-outline" size={40} color="rgba(255,255,255,0.1)" style={styles.floatingIcon1} />
        <MaterialIcons name="trending-up" size={35} color="rgba(255,255,255,0.1)" style={styles.floatingIcon2} />
        <Feather name="dollar-sign" size={30} color="rgba(255,255,255,0.1)" style={styles.floatingIcon3} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo and Title */}
            <View style={styles.headerSection}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/icon.png')}   // local image
                  style={{ width: 80, height: 80, borderRadius: 20 }} 
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.subtitleText}>Sign in to manage your finances</Text>
            </View>

            {/* Login Card */}
            <View style={styles.loginCard}>
              {/* Social Login Section */}
              <View style={styles.socialLoginContainer}>
                <Text style={styles.socialLoginTitle}>Sign in with</Text>

                {/* Google Login Button */}
                <TouchableOpacity
                  style={[styles.socialButton, socialLoading === 'google' && styles.socialButtonDisabled]}
                  onPress={() => handleSocialAuth('google')}
                  disabled={socialLoading !== null}
                >
                  {socialLoading === 'google' ? (
                    <ActivityIndicator color="#6366F1" size="small" />
                  ) : (
                    <>
                      <FontAwesome5 name="google" size={22} color="#DB4437" />
                      <Text style={styles.socialButtonText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* LinkedIn Login Button */}
                <TouchableOpacity
                  style={[styles.socialButton, socialLoading === 'linkedin_oidc' && styles.socialButtonDisabled]}
                  onPress={() => handleSocialAuth('linkedin_oidc')}
                  disabled={socialLoading !== null}
                >
                  {socialLoading === 'linkedin_oidc' ? (
                    <ActivityIndicator color="#6366F1" size="small" />
                  ) : (
                    <>
                      <FontAwesome5 name="linkedin" size={22} color="#0077B5" />
                      <Text style={styles.socialButtonText}>Continue with LinkedIn</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.socialDividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.socialDividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>
              </View>

              {/* Biometric Login Button - Show if enabled */}
              {isEnabled && (
                <>
                  <Text style={styles.biometricAccountText}>
                      Logging in as: {storedEmail}
                    </Text>
                  <TouchableOpacity
                    style={styles.biometricMainButton}
                    onPress={handleBiometricLogin}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#6366F1', '#8B5CF6']}
                      style={styles.biometricButtonGradient}
                    >
                      <Feather 
                        name={biometricType === 'Face ID' ? 'smile' : 'unlock'} 
                        size={24} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.biometricButtonText}>
                        Login with {biometricType}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.divider} />
                  </View>
                </>
              )}

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email address</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="mail" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="john@example.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="lock" size={20} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Feather 
                      name={showPassword ? 'eye-off' : 'eye'} 
                      size={20} 
                      color="#94A3B8" 
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              {/* Forgot Password Link */}
              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotPasswordButton}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Biometric Enable Option */}
              {isAvailable && !isEnabled && (
                <View style={styles.biometricOption}>
                  <View style={styles.biometricOptionLeft}>
                    <Feather 
                      name={biometricType === 'Face ID' ? 'smile' : 'unlock'} 
                      size={20} 
                      color="#6366F1" 
                    />
                    <Text style={styles.biometricText}>
                      Enable {biometricType} for quick login
                    </Text>
                  </View>
                  <Switch
                    value={enableBiometricOnLogin}
                    onValueChange={setEnableBiometricOnLogin}
                    trackColor={{ false: '#E2E8F0', true: '#6366F1' }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#E2E8F0"
                  />
                </View>
              )}

              {/* Sign In Button */}
              <TouchableOpacity
                style={[styles.signInButton, loading && styles.signInButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.signInButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.signInButtonText}>Sign in</Text>
                      <Feather name="chevron-right" size={20} color="#FFFFFF" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Sign Up Link */}
              <View style={styles.signUpContainer}>
                <Text style={styles.signUpText}>New to SmartCFO?</Text>
                <TouchableOpacity onPress={handleSignUpRedirect}>
                  <Text style={styles.signUpLink}>Create an account</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Trust Indicators */}
            <View style={styles.trustIndicators}>
              <View style={styles.trustItem}>
                <Feather name="shield" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.trustText}>Secure</Text>
              </View>
              <View style={styles.trustItem}>
                <Feather name="check-circle" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.trustText}>GDPR Compliant</Text>
              </View>
              <View style={styles.trustItem}>
                <MaterialIcons name="business" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.trustText}>10k+ businesses</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  floatingElements: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  floatingCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  circle1: {
    width: 200,
    height: 200,
    top: -50,
    left: -50,
  },
  circle2: {
    width: 150,
    height: 150,
    bottom: -30,
    right: -30,
  },
  floatingIcon1: {
    position: 'absolute',
    top: 100,
    right: 30,
  },
  floatingIcon2: {
    position: 'absolute',
    bottom: 150,
    left: 30,
  },
  floatingIcon3: {
    position: 'absolute',
    top: height * 0.4,
    left: 20,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginTop: height * 0.08,
    marginBottom: 30,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoBackground: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#6366F1',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  biometricAccountText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 14,
    marginBottom: 12,
  },
  socialLoginContainer: {
    marginBottom: Spacing.lg,
  },
  socialLoginTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginLeft: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  socialDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: 0,
  },
  socialDividerText: {
    marginHorizontal: Spacing.md,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  forgotPasswordButton: {
    alignSelf: 'center',
    // marginTop: Spacing.sm,
    padding: Spacing.sm,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  loginCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  biometricMainButton: {
    marginBottom: 20,
  },
  biometricButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#94A3B8',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  rememberText: {
    fontSize: 14,
    color: '#64748B',
  },
  forgotText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  biometricOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  biometricOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  biometricText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  signInButton: {
    marginBottom: 20,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  signUpText: {
    fontSize: 14,
    color: '#64748B',
  },
  signUpLink: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  trustIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
});