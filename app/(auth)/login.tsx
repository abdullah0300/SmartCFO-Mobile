// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../src/hooks/useAuth';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/Colors';

// Define navigation types
type RootStackParamList = {
  Main: undefined;
  Login: undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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
      // Navigation will be handled automatically by the AuthNavigator in App.tsx
      // No need to manually navigate here
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

  return (
    <LinearGradient
      colors={['#FFFFFF', '#F0F9FF', '#E0F2FE']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo/Brand Section */}
            <View style={styles.headerSection}>
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={[Colors.light.primary, Colors.light.secondary]}
                  style={styles.logoGradient}
                >
                  <Text style={styles.logoText}>SC</Text>
                </LinearGradient>
              </View>
              <Text style={styles.brandName}>SmartCFO</Text>
              <Text style={styles.tagline}>Your Financial Command Center</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.subtitleText}>Sign in to continue managing your finances</Text>

              <View style={styles.form}>
                <Input
                  label="Email"
                  placeholder="your@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={errors.email}
                  icon="mail"
                />

                <Input
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  error={errors.password}
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onIconPress={() => setShowPassword(!showPassword)}
                />

                <Button
                  title="Sign In"
                  onPress={handleLogin}
                  loading={loading}
                  style={styles.loginButton}
                />

                <Text style={styles.footerText}>
                  Don't have an account?{' '}
                  <Text 
                    style={styles.linkText} 
                    onPress={() => Alert.alert('Coming Soon', 'Registration will be available soon')}
                  >
                    Sign up
                  </Text>
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  headerSection: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    marginBottom: Spacing.md,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandName: {
    ...Typography.title1,
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  tagline: {
    ...Typography.callout,
    color: Colors.light.textSecondary,
  },
  formSection: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeText: {
    ...Typography.title2,
    color: Colors.light.text,
    marginBottom: Spacing.xs,
  },
  subtitleText: {
    ...Typography.body,
    color: Colors.light.textSecondary,
    marginBottom: Spacing.xl,
  },
  form: {
    marginBottom: Spacing.xl,
  },
  loginButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  footerText: {
    ...Typography.callout,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  linkText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
});