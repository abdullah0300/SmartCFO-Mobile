// src/services/biometricService.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const USER_CREDENTIALS_KEY = 'user_credentials';

export const BiometricService = {
  // Check if device has biometric hardware
  async isAvailable(): Promise<boolean> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return false;
      
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return enrolled;
    } catch (error) {
      console.error('Biometric check error:', error);
      return false;
    }
  },

  // Get biometric type (FaceID, TouchID, etc.)
  async getBiometricType(): Promise<string> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Biometric';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
    return 'Biometric';
  },

  // Authenticate using biometric
  async authenticate(reason?: string): Promise<boolean> {
    try {
      const biometricType = await this.getBiometricType();
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason || `Use ${biometricType} to access SmartCFO`,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
        disableDeviceFallback: false,
      });
      
      return result.success;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  },

  // Check if biometric login is enabled
  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch {
      return false;
    }
  },

  // Enable biometric login
 async enable(email: string): Promise<boolean> {
  try {
    const authenticated = await this.authenticate('Authenticate to enable biometric login');
    if (!authenticated) return false;
    
    // Store only email, not password
    await SecureStore.setItemAsync('user_email', email);
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
    
    return true;
  } catch (error) {
    console.error('Enable biometric error:', error);
    return false;
  }
},

  // Disable biometric login
  async disable(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(USER_CREDENTIALS_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    } catch (error) {
      console.error('Disable biometric error:', error);
    }
  },

  // Get stored credentials after biometric auth
  async getCredentials(): Promise<{ email: string; password: string } | null> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated) return null;

      const credentials = await SecureStore.getItemAsync(USER_CREDENTIALS_KEY);
      if (!credentials) return null;

      return JSON.parse(credentials);
    } catch (error) {
      console.error('Get credentials error:', error);
      return null;
    }
  },

  // Update stored password (when user changes password)
  async updatePassword(newPassword: string): Promise<boolean> {
    try {
      const credentials = await SecureStore.getItemAsync(USER_CREDENTIALS_KEY);
      if (!credentials) return false;

      const parsed = JSON.parse(credentials);
      parsed.password = newPassword;
      
      await SecureStore.setItemAsync(USER_CREDENTIALS_KEY, JSON.stringify(parsed));
      return true;
    } catch (error) {
      console.error('Update password error:', error);
      return false;
    }
  }
};