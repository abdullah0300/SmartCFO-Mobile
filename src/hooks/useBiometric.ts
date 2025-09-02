// src/hooks/useBiometric.ts
import { useState, useEffect } from 'react';
import { BiometricService } from '../services/biometricService';

export const useBiometric = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  const checkBiometricStatus = async () => {
    try {
      const available = await BiometricService.isAvailable();
      const enabled = await BiometricService.isEnabled();
      const type = await BiometricService.getBiometricType();
      
      setIsAvailable(available);
      setIsEnabled(enabled);
      setBiometricType(type);
    } catch (error) {
      console.error('Biometric status check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const enableBiometric = async (email: string, password: string) => {
    const success = await BiometricService.enable(email);
    if (success) {
      setIsEnabled(true);
    }
    return success;
  };

  const disableBiometric = async () => {
    await BiometricService.disable();
    setIsEnabled(false);
  };

  const authenticateWithBiometric = async () => {
    return await BiometricService.authenticate();
  };

  const getBiometricCredentials = async () => {
    return await BiometricService.getCredentials();
  };

  return {
    isAvailable,
    isEnabled,
    biometricType,
    loading,
    enableBiometric,
    disableBiometric,
    authenticateWithBiometric,
    getBiometricCredentials,
    refreshStatus: checkBiometricStatus,
  };
};