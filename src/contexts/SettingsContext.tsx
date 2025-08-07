// src/contexts/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextData {
  currency: string;
  currencySymbol: string;
  theme: 'light' | 'dark';
  notifications: boolean;
  biometrics: boolean;
  setCurrency: (currency: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setNotifications: (enabled: boolean) => void;
  setBiometrics: (enabled: boolean) => void;
  formatCurrency: (amount: number | undefined | null) => string;
}

const SettingsContext = createContext<SettingsContextData>({} as SettingsContextData);

const STORAGE_KEYS = {
  CURRENCY: '@smartcfo_currency',
  THEME: '@smartcfo_theme',
  NOTIFICATIONS: '@smartcfo_notifications',
  BIOMETRICS: '@smartcfo_biometrics',
};

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  CNY: '¥',
  INR: '₹',
  KRW: '₩',
  MXN: '$',
  NOK: 'kr',
  NZD: 'NZ$',
  SEK: 'kr',
  SGD: 'S$',
  TRY: '₺',
  ZAR: 'R',
  BRL: 'R$',
  RUB: '₽',
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState('USD');
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [notifications, setNotificationsState] = useState(true);
  const [biometrics, setBiometricsState] = useState(false);

  // Load settings from storage
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [savedCurrency, savedTheme, savedNotifications, savedBiometrics] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CURRENCY),
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.BIOMETRICS),
      ]);

      if (savedCurrency) setCurrencyState(savedCurrency);
      if (savedTheme) setThemeState(savedTheme as 'light' | 'dark');
      if (savedNotifications !== null) setNotificationsState(savedNotifications === 'true');
      if (savedBiometrics !== null) setBiometricsState(savedBiometrics === 'true');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const setCurrency = async (newCurrency: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENCY, newCurrency);
      setCurrencyState(newCurrency);
    } catch (error) {
      console.error('Error saving currency:', error);
    }
  };

  const setTheme = async (newTheme: 'light' | 'dark') => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const setNotifications = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, enabled.toString());
      setNotificationsState(enabled);
    } catch (error) {
      console.error('Error saving notifications setting:', error);
    }
  };

  const setBiometrics = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRICS, enabled.toString());
      setBiometricsState(enabled);
    } catch (error) {
      console.error('Error saving biometrics setting:', error);
    }
  };

  const formatCurrency = useCallback((amount: number | undefined | null): string => {
    // Handle undefined or null amounts
    if (amount === undefined || amount === null || isNaN(amount)) {
      return `${currencySymbols[currency] || '$'}0.00`;
    }
    
    try {
      const symbol = currencySymbols[currency] || '$';
      
      // Handle different currency formatting
      switch (currency) {
        case 'JPY':
        case 'KRW':
          // No decimal places for these currencies
          return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
        
        case 'EUR':
          // European format: 1.234,56 €
          return `${amount.toLocaleString('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${symbol}`;
        
        default:
          // Default format: $1,234.56
          return `${symbol}${amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
      }
    } catch (error) {
      console.error('Error formatting currency:', error);
      return `${currencySymbols[currency] || '$'}${amount}`;
    }
  }, [currency]);

  const currencySymbol = currencySymbols[currency] || '$';

  return (
    <SettingsContext.Provider
      value={{
        currency,
        currencySymbol,
        theme,
        notifications,
        biometrics,
        setCurrency,
        setTheme,
        setNotifications,
        setBiometrics,
        formatCurrency,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};