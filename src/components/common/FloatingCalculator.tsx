// src/components/common/FloatingCalculator.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../../contexts/SettingsContext';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/Colors';

const { width, height } = Dimensions.get('window');

interface FloatingCalculatorProps {
  position?: 'left' | 'right';
}

export const FloatingCalculator: React.FC<FloatingCalculatorProps> = ({ position = 'left' }) => {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'converter' | 'calculator'>('calculator');

  // Currency Converter States
  const {
    formatCurrency,
    getCurrencySymbol,
    enabledCurrencies,
    baseCurrency,
    getExchangeRate,
  } = useSettings();

  const [fromCurrency, setFromCurrency] = useState(baseCurrency);
  const [toCurrency, setToCurrency] = useState(enabledCurrencies.find(c => c !== baseCurrency) || 'USD');
  const [fromAmount, setFromAmount] = useState('1');
  const [toAmount, setToAmount] = useState('0');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [inverseRate, setInverseRate] = useState(1);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Calculator States
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const CURRENCY_NAMES: Record<string, string> = {
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    PKR: 'Pakistani Rupee',
    INR: 'Indian Rupee',
    AUD: 'Australian Dollar',
    CAD: 'Canadian Dollar',
    JPY: 'Japanese Yen',
    CNY: 'Chinese Yuan',
    AED: 'UAE Dirham',
    SAR: 'Saudi Riyal',
  };

  // Fetch exchange rate when currencies change
  useEffect(() => {
    if (fromCurrency && toCurrency && visible) {
      fetchExchangeRate();
    }
  }, [fromCurrency, toCurrency, visible]);

  // Auto-convert when amount changes
  useEffect(() => {
    if (fromAmount && !isNaN(parseFloat(fromAmount))) {
      const amount = parseFloat(fromAmount);
      const result = amount * exchangeRate;
      setToAmount(result.toFixed(2));
    }
  }, [fromAmount, exchangeRate]);

  const fetchExchangeRate = async () => {
    setIsLoadingRate(true);
    try {
      // Use your existing getExchangeRate function from SettingsContext
      const rate = await getExchangeRate(fromCurrency, toCurrency);
      setExchangeRate(rate);
      setInverseRate(1 / rate);
      setLastUpdated(new Date());

      // Auto-convert current amount
      if (fromAmount && !isNaN(parseFloat(fromAmount))) {
        const result = parseFloat(fromAmount) * rate;
        setToAmount(result.toFixed(2));
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      setExchangeRate(1);
      setInverseRate(1);
    } finally {
      setIsLoadingRate(false);
    }
  };

  const swapCurrencies = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Swap currencies
    const tempCurrency = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(tempCurrency);

    // Swap amounts
    setFromAmount(toAmount);

    // Swap rates
    setExchangeRate(inverseRate);
    setInverseRate(exchangeRate);
  };

  const handleFromAmountChange = (text: string) => {
    // Only allow numbers and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return; // Prevent multiple decimals

    setFromAmount(cleaned);
  };

  // ============= CALCULATOR FUNCTIONS =============

  const inputDigit = (digit: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (waitingForOperand) {
      setDisplay(String(digit));
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? String(digit) : display + digit);
    }
  };

  const inputDecimal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const clearDisplay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const clearEntry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDisplay('0');
  };

  const toggleSign = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = parseFloat(display) * -1;
    setDisplay(String(newValue));
  };

  const inputPercent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentValue = parseFloat(display);

    if (currentValue === 0) return;

    const newValue = currentValue / 100;
    setDisplay(String(newValue));
  };

  const performOperation = (nextOperation: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '−':
        return firstValue - secondValue;
      case '×':
        return firstValue * secondValue;
      case '÷':
        return secondValue !== 0 ? firstValue / secondValue : 0;
      default:
        return secondValue;
    }
  };

  const performEquals = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const handleBackspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const openModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVisible(true);
  };

  const closeModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVisible(false);
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <>
      {/* Floating Button - Modern Pill Style */}
      <TouchableOpacity
        style={[styles.floatingButton, position === 'left' ? styles.leftPosition : styles.rightPosition]}
        onPress={openModal}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.floatingGradient}
        >
          <View style={styles.buttonIconContainer}>
            <MaterialCommunityIcons name="calculator-variant" size={20} color="#FFFFFF" />
            <Feather name="repeat" size={16} color="#FFFFFF" style={styles.secondaryIcon} />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <BlurView intensity={40} style={styles.modalOverlay}>
          <View style={styles.modalBackground}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={closeModal}
            />
            <View style={styles.modalContent}>
                {/* Header */}
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalHeader}
                >
                  <Text style={styles.modalTitle}>Smart Tools</Text>
                  <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                    <Feather name="x" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </LinearGradient>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'converter' && styles.activeTab]}
                    onPress={() => {
                      setActiveTab('converter');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Feather
                      name="repeat"
                      size={18}
                      color={activeTab === 'converter' ? '#3B82F6' : '#9CA3AF'}
                    />
                    <Text style={[
                      styles.tabText,
                      activeTab === 'converter' && styles.activeTabText
                    ]}>
                      Converter
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'calculator' && styles.activeTab]}
                    onPress={() => {
                      setActiveTab('calculator');
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Feather
                      name="grid"
                      size={18}
                      color={activeTab === 'calculator' ? '#3B82F6' : '#9CA3AF'}
                    />
                    <Text style={[
                      styles.tabText,
                      activeTab === 'calculator' && styles.activeTabText
                    ]}>
                      Calculator
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.contentWrapper}>
                  <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces={true}
                    scrollEventThrottle={16}
                  >
                    {activeTab === 'converter' ? (
                    // Currency Converter - Compact Design with Dropdowns
                    <View style={styles.converterContainer}>
                      {/* From Currency Section */}
                      <View style={styles.compactCurrencySection}>
                        <View style={styles.compactHeader}>
                          <LinearGradient
                            colors={['#3B82F6', '#8B5CF6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.compactBadge}
                          >
                            <Text style={styles.compactBadgeText}>From</Text>
                          </LinearGradient>
                          <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => {
                              setShowFromPicker(true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                          >
                            <Text style={styles.dropdownText}>{fromCurrency}</Text>
                            <Feather name="chevron-down" size={16} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.compactAmountRow}>
                          <Text style={styles.compactSymbol}>{getCurrencySymbol(fromCurrency)}</Text>
                          <TextInput
                            style={styles.compactInput}
                            value={fromAmount}
                            onChangeText={handleFromAmountChange}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor="#CBD5E1"
                          />
                        </View>
                      </View>

                      {/* Swap Button */}
                      <TouchableOpacity
                        style={styles.compactSwapButton}
                        onPress={swapCurrencies}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={['#3B82F6', '#8B5CF6']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.compactSwapGradient}
                        >
                          <Feather name="repeat" size={18} color="#FFFFFF" />
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* To Currency Section */}
                      <View style={styles.compactCurrencySection}>
                        <View style={styles.compactHeader}>
                          <LinearGradient
                            colors={['#10B981', '#34D399']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.compactBadge}
                          >
                            <Text style={styles.compactBadgeText}>To</Text>
                          </LinearGradient>
                          <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => {
                              setShowToPicker(true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                          >
                            <Text style={styles.dropdownText}>{toCurrency}</Text>
                            <Feather name="chevron-down" size={16} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.compactAmountRow}>
                          <Text style={styles.compactSymbol}>{getCurrencySymbol(toCurrency)}</Text>
                          {isLoadingRate ? (
                            <ActivityIndicator size="small" color="#3B82F6" />
                          ) : (
                            <Text style={styles.compactResult}>{toAmount}</Text>
                          )}
                        </View>
                      </View>

                      {/* Exchange Rate Info */}
                      <View style={styles.compactRateInfo}>
                        <Text style={styles.compactRateText}>
                          1 {fromCurrency} = {exchangeRate.toFixed(4)} {toCurrency}
                        </Text>
                        <TouchableOpacity onPress={fetchExchangeRate} disabled={isLoadingRate}>
                          <Feather
                            name="refresh-cw"
                            size={16}
                            color={isLoadingRate ? '#CBD5E1' : '#3B82F6'}
                          />
                        </TouchableOpacity>
                      </View>
                      {lastUpdated && (
                        <Text style={styles.compactUpdateTime}>
                          Updated {formatLastUpdated()}
                        </Text>
                      )}
                    </View>
                  ) : (
                    // Calculator
                    <View style={styles.calculatorContainer}>
                      {/* Display */}
                      <View style={styles.calculatorDisplay}>
                        <LinearGradient
                          colors={['#F9FAFB', '#FFFFFF']}
                          style={styles.displayGradient}
                        >
                          {operation && previousValue !== null && (
                            <Text style={styles.operationText}>
                              {previousValue} {operation}
                            </Text>
                          )}
                          <Text
                            style={styles.displayText}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {display}
                          </Text>
                        </LinearGradient>
                      </View>

                      {/* Buttons */}
                      <View style={styles.buttonGrid}>
                        {/* Row 1 */}
                        <View style={styles.buttonRow}>
                          <TouchableOpacity
                            style={[styles.calcButton, styles.functionButton]}
                            onPress={clearDisplay}
                          >
                            <Text style={styles.functionButtonText}>AC</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.calcButton, styles.functionButton]}
                            onPress={handleBackspace}
                          >
                            <Feather name="delete" size={18} color="#374151" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.calcButton, styles.functionButton]}
                            onPress={inputPercent}
                          >
                            <Text style={styles.functionButtonText}>%</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.calcButton, styles.operatorButton]}
                            onPress={() => performOperation('÷')}
                          >
                            <Text style={styles.operatorButtonText}>÷</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Row 2 */}
                        <View style={styles.buttonRow}>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={() => inputDigit('7')}
                          >
                            <Text style={styles.numberButtonText}>7</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={() => inputDigit('8')}
                          >
                            <Text style={styles.numberButtonText}>8</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={() => inputDigit('9')}
                          >
                            <Text style={styles.numberButtonText}>9</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.calcButton, styles.operatorButton]}
                            onPress={() => performOperation('×')}
                          >
                            <Text style={styles.operatorButtonText}>×</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Row 3 */}
                        <View style={styles.buttonRow}>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={() => inputDigit('4')}
                          >
                            <Text style={styles.numberButtonText}>4</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={() => inputDigit('5')}
                          >
                            <Text style={styles.numberButtonText}>5</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={() => inputDigit('6')}
                          >
                            <Text style={styles.numberButtonText}>6</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.calcButton, styles.operatorButton]}
                            onPress={() => performOperation('−')}
                          >
                            <Text style={styles.operatorButtonText}>−</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Row 4 */}
                        <View style={styles.buttonRow}>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={() => inputDigit('1')}
                          >
                            <Text style={styles.numberButtonText}>1</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={() => inputDigit('2')}
                          >
                            <Text style={styles.numberButtonText}>2</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={() => inputDigit('3')}
                          >
                            <Text style={styles.numberButtonText}>3</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.calcButton, styles.operatorButton]}
                            onPress={() => performOperation('+')}
                          >
                            <Text style={styles.operatorButtonText}>+</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Row 5 */}
                        <View style={styles.buttonRow}>
                          <TouchableOpacity
                            style={[styles.calcButton, styles.zeroButton]}
                            onPress={() => inputDigit('0')}
                          >
                            <Text style={styles.numberButtonText}>0</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.calcButton}
                            onPress={inputDecimal}
                          >
                            <Text style={styles.numberButtonText}>.</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.calcButton, styles.equalsButton]}
                            onPress={performEquals}
                          >
                            <LinearGradient
                              colors={['#3B82F6', '#8B5CF6']}
                              style={styles.equalsGradient}
                            >
                              <Text style={styles.equalsButtonText}>=</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                  </ScrollView>
                </View>
              </View>
            </View>
        </BlurView>
      </Modal>

      {/* From Currency Picker Modal */}
      <Modal
        visible={showFromPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFromPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowFromPicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowFromPicker(false)}>
                <Feather name="x" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {enabledCurrencies.map((curr) => (
                <TouchableOpacity
                  key={curr}
                  style={[
                    styles.pickerItem,
                    fromCurrency === curr && styles.pickerItemActive
                  ]}
                  onPress={() => {
                    setFromCurrency(curr);
                    setShowFromPicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={styles.pickerItemLeft}>
                    <Text style={styles.pickerSymbol}>{getCurrencySymbol(curr)}</Text>
                    <View>
                      <Text style={styles.pickerCode}>{curr}</Text>
                      <Text style={styles.pickerName}>{CURRENCY_NAMES[curr] || curr}</Text>
                    </View>
                  </View>
                  {fromCurrency === curr && (
                    <Feather name="check" size={20} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* To Currency Picker Modal */}
      <Modal
        visible={showToPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowToPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowToPicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Currency</Text>
              <TouchableOpacity onPress={() => setShowToPicker(false)}>
                <Feather name="x" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {enabledCurrencies.map((curr) => (
                <TouchableOpacity
                  key={curr}
                  style={[
                    styles.pickerItem,
                    toCurrency === curr && styles.pickerItemActive
                  ]}
                  onPress={() => {
                    setToCurrency(curr);
                    setShowToPicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View style={styles.pickerItemLeft}>
                    <Text style={styles.pickerSymbol}>{getCurrencySymbol(curr)}</Text>
                    <View>
                      <Text style={styles.pickerCode}>{curr}</Text>
                      <Text style={styles.pickerName}>{CURRENCY_NAMES[curr] || curr}</Text>
                    </View>
                  </View>
                  {toCurrency === curr && (
                    <Feather name="check" size={20} color="#3B82F6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 110,
    width: 56,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  leftPosition: {
    left: 20,
  },
  rightPosition: {
    right: 20,
  },
  floatingGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  secondaryIcon: {
    marginLeft: -3,
    opacity: 0.9,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    width: '100%',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: width * 0.9,
    maxWidth: 400,
    height: height * 0.68,
    maxHeight: height * 0.85,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  contentWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },

  // Currency Converter Styles - Compact Design (No Scroll)
  converterContainer: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  compactCurrencySection: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  compactBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  compactBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  compactAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactSymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: '#3B82F6',
  },
  compactInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    padding: 0,
  },
  compactResult: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: '#10B981',
  },
  compactSwapButton: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginVertical: Spacing.xs,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  compactSwapGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactRateInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  compactRateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  compactUpdateTime: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  // Calculator Styles
  calculatorContainer: {
    padding: Spacing.sm,
    paddingBottom: 0,
  },
  calculatorDisplay: {
    marginBottom: 8,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  displayGradient: {
    padding: Spacing.sm,
    paddingVertical: Spacing.md,
    minHeight: 70,
    justifyContent: 'flex-end',
  },
  operationText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  displayText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'right',
  },
  buttonGrid: {
    gap: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  calcButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  functionButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  operatorButton: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  zeroButton: {
    flex: 2,
  },
  equalsButton: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 0,
  },
  equalsGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  functionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  operatorButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  equalsButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Currency Picker Modal Styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: height * 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  pickerList: {
    maxHeight: height * 0.5,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerItemActive: {
    backgroundColor: '#F0F9FF',
  },
  pickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pickerSymbol: {
    fontSize: 24,
    fontWeight: '700',
  },
  pickerCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  pickerName: {
    fontSize: 12,
    color: '#64748B',
  },
});
