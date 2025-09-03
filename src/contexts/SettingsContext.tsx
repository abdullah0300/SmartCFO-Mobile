// src/contexts/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

interface UserSettings {
  id: string;
  user_id: string;
  base_currency: string;
  country?: string;
  timezone?: string;
  date_format?: string;
  fiscal_year_start?: string;
  enabled_currencies?: string[];
  tax_rates?: Record<string, number>;
  vat_number?: string;
  uk_vat_scheme?: string;
}

interface CurrencyFormatOptions {
  currency?: string;
  showCode?: boolean;
}

interface SettingsContextType {
  settings: UserSettings | null;
  baseCurrency: string;
  userCountry: string;
  currencySymbol: string;
  enabledCurrencies: string[];
  taxRates: Record<string, number>;
  formatCurrency: (amount: number | undefined | null, options?: CurrencyFormatOptions) => string;
  formatNumber: (num: number | undefined | null) => string;
  getCurrencySymbol: (currency: string) => string;
  getExchangeRate: (fromCurrency: string, toCurrency: string) => Promise<number>;
  convertToBaseCurrency: (amount: number, fromCurrency: string) => Promise<{ baseAmount: number; exchangeRate: number }>;
  loadSettings: () => Promise<void>;
  updateBaseCurrency: (currency: string) => Promise<void>;
  updateCountry: (country: string) => Promise<void>;
  isLoading: boolean;
  isUKBusiness: boolean;
}



const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
  PKR: 'Rs',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  CNY: '¥',
  AED: 'د.إ',
  SAR: 'ر.س',
  BDT: '৳',
  EGP: 'E£',
  IDR: 'Rp',
  KRW: '₩',
  MXN: '$',
  NGN: '₦',
  NZD: 'NZ$',
  PHP: '₱',
  RUB: '₽',
  SGD: 'S$',
  THB: '฿',
  TRY: '₺',
  VND: '₫',
  ZAR: 'R',
};

const DEFAULT_CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'INR'];

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [userCountry, setUserCountry] = useState('US');
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(DEFAULT_CURRENCIES);
  const [taxRates, setTaxRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading settings:', error);
      }

              if (data) {
          setSettings(data);
          setBaseCurrency(data.base_currency || 'USD');
          setUserCountry(data.country || 'US');
          setEnabledCurrencies(data.enabled_currencies || DEFAULT_CURRENCIES);
          
          // Fetch tax rates from separate table
          const { data: taxRatesData } = await supabase
            .from('tax_rates')
            .select('*')
            .eq('user_id', user.id);
          
          if (taxRatesData) {
            const taxRatesObj: Record<string, number> = {};
            taxRatesData.forEach(rate => {
              taxRatesObj[rate.name] = parseFloat(rate.rate);
            });
            setTaxRates(taxRatesObj);
            await AsyncStorage.setItem('@tax_rates', JSON.stringify(taxRatesObj));
          } else {
            setTaxRates({});
          }
        
        // Cache everything
        await AsyncStorage.setItem('@user_settings', JSON.stringify(data));
        await AsyncStorage.setItem('@enabled_currencies', JSON.stringify(data.enabled_currencies || DEFAULT_CURRENCIES));
        await AsyncStorage.setItem('@tax_rates', JSON.stringify(data.tax_rates || {}));
      } else {
        // Create default settings that match web app structure
        const defaultSettings = {
          user_id: user.id,
          base_currency: 'USD',
          country: 'US',
          enabled_currencies: DEFAULT_CURRENCIES,
          tax_rates: {},
          date_format: 'MM/DD/YYYY',
          fiscal_year_start: '01-01'
        };
        
        const { data: newSettings } = await supabase
          .from('user_settings')
          .insert(defaultSettings)
          .select()
          .single();
          
        if (newSettings) {
          setSettings(newSettings);
          setBaseCurrency(newSettings.base_currency);
          setUserCountry(newSettings.country || 'US');
          setEnabledCurrencies(newSettings.enabled_currencies || DEFAULT_CURRENCIES);
          setTaxRates(newSettings.tax_rates || {});
          await AsyncStorage.setItem('@user_settings', JSON.stringify(newSettings));
        }
      }
    } catch (error) {
      console.error('Error in loadSettings:', error);
      // Try cache
      try {
        const cached = await AsyncStorage.getItem('@user_settings');
        if (cached) {
          const parsedSettings = JSON.parse(cached);
          setSettings(parsedSettings);
          setBaseCurrency(parsedSettings.base_currency || 'USD');
          setUserCountry(parsedSettings.country || 'US');
          setEnabledCurrencies(parsedSettings.enabled_currencies || DEFAULT_CURRENCIES);
          setTaxRates(parsedSettings.tax_rates || {});
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError);
        setBaseCurrency('USD');
        setUserCountry('US');
        setEnabledCurrencies(DEFAULT_CURRENCIES);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateBaseCurrency = async (currency: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ base_currency: currency })
        .eq('user_id', user.id);

      if (error) throw error;

      setBaseCurrency(currency);
      if (settings) {
        const updated = { ...settings, base_currency: currency };
        setSettings(updated);
        await AsyncStorage.setItem('@user_settings', JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error updating currency:', error);
      throw error;
    }
  };

  const updateCountry = async (country: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ country })
        .eq('user_id', user.id);

      if (error) throw error;

      setUserCountry(country);
      if (settings) {
        const updated = { ...settings, country };
        setSettings(updated);
        await AsyncStorage.setItem('@user_settings', JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error updating country:', error);
      throw error;
    }
  };

  const getExchangeRate = async (fromCurrency: string, toCurrency: string): Promise<number> => {
  if (fromCurrency === toCurrency) return 1;

  try {
    // Check exchange_rates table first (this is what your web app uses)
    const { data: rateData, error } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (rateData && !error) {
      return parseFloat(rateData.rate);
    }

    // If no direct rate, try inverse
    const { data: inverseRate } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', toCurrency)
      .eq('to_currency', fromCurrency)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (inverseRate) {
      return 1 / parseFloat(inverseRate.rate);
    }

    // Cache the rate
    const cacheKey = `@exchange_rate_${fromCurrency}_${toCurrency}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const { rate } = JSON.parse(cached);
      return rate;
    }

    return 1;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return 1;
  }
};

  const convertToBaseCurrency = async (
    amount: number, 
    fromCurrency: string
  ): Promise<{ baseAmount: number; exchangeRate: number }> => {
    if (fromCurrency === baseCurrency) {
      return { baseAmount: amount, exchangeRate: 1 };
    }

    const exchangeRate = await getExchangeRate(fromCurrency, baseCurrency);
    const baseAmount = amount * exchangeRate;

    return { baseAmount, exchangeRate };
  };

  const getCurrencySymbol = (currency: string): string => {
    return CURRENCY_SYMBOLS[currency] || currency;
  };

  const formatCurrency = (
  amount: number | undefined | null,
  options?: CurrencyFormatOptions
): string => {
  // Handle null/undefined safely
  if (amount === undefined || amount === null) {
    amount = 0;
  }

  const currency = options?.currency || baseCurrency;
  const symbol = getCurrencySymbol(currency);
  const showCode = options?.showCode || false;
  
  try {
    // Use Intl.NumberFormat for proper thousand separators
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    
    const result = `${symbol}${formatted}`;
    return showCode ? `${result} ${currency}` : result;
  } catch (error) {
    // Fallback if Intl.NumberFormat fails
    console.warn('NumberFormat failed, using fallback:', error);
    const fallbackFormatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const result = `${symbol}${fallbackFormatted}`;
    return showCode ? `${result} ${currency}` : result;
  }
};

const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null) return '0';
  
  try {
    return new Intl.NumberFormat('en-US').format(num);
  } catch (error) {
    // Fallback formatting
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
};

  const currencySymbol = getCurrencySymbol(baseCurrency);
  const isUKBusiness = userCountry === 'UK' || userCountry === 'GB';

  return (
    <SettingsContext.Provider
      value={{
        settings,
        baseCurrency,
        userCountry,
        currencySymbol,
        enabledCurrencies,
        taxRates,
        formatCurrency,
        formatNumber,
        getCurrencySymbol,
        getExchangeRate,
        convertToBaseCurrency,
        loadSettings,
        updateBaseCurrency,
        updateCountry,
        isLoading,
        isUKBusiness,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      settings: null,
      baseCurrency: 'USD',
      userCountry: 'US',
      currencySymbol: '$',
      enabledCurrencies: DEFAULT_CURRENCIES,
      taxRates: {},
      formatCurrency: (amount: number | undefined | null) => {
        const val = amount || 0;
        const formatted = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(val);
        return `$${formatted}`;
      },
      formatNumber: (num: number | undefined | null) => {  // ADD THIS
        const val = num || 0;
        return new Intl.NumberFormat('en-US').format(val);
      },
      getCurrencySymbol: (currency: string) => CURRENCY_SYMBOLS[currency] || currency,
      getExchangeRate: async () => 1,
      convertToBaseCurrency: async (amount: number) => ({ baseAmount: amount, exchangeRate: 1 }),
      loadSettings: async () => {},
      updateBaseCurrency: async () => {},
      updateCountry: async () => {},
      isLoading: false,
      isUKBusiness: false,
    };
  }
  return context;
};