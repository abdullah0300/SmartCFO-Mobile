import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";

import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../contexts/SettingsContext";
import { createIncome, getCategories, getClients, supabase } from "../../services/api";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
} from "../../constants/Colors";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

interface AddIncomeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AddIncomeModal: React.FC<AddIncomeModalProps> = ({
  visible,
  onClose,
}) => {
  const { user } = useAuth();
  const { currencySymbol, formatCurrency, baseCurrency, isUKBusiness, convertToBaseCurrency, getCurrencySymbol, enabledCurrencies, taxRates } = useSettings();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [taxRate, setTaxRate] = useState("0");
  const [includeTax, setIncludeTax] = useState(false);
  const [currency, setCurrency] = useState(baseCurrency);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [convertedPreview, setConvertedPreview] = useState(0);

  const [availableCurrencies, setAvailableCurrencies] = useState<Array<{code: string, symbol: string, name: string}>>([]);

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

  // Quick add modal states
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#10B981");

  const CATEGORY_COLORS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
    '#EF4444', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
  ];

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ["categories", user?.id, "income"],
    queryFn: () => getCategories(user!.id, "income"),
    enabled: !!user,
  });

  const { data: clients, refetch: refetchClients } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: () => getClients(user!.id),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: createIncome,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["recent-incomes"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      resetForm();
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setSelectedCategory("");
    setSelectedClient("");
    setSelectedDate(new Date());
    setReferenceNumber("");
    setTaxRate("0");
    setIncludeTax(false);
    setCurrency(baseCurrency);
    setNewClientData({ name: "", email: "", phone: "", address: "" });
  };

  // In AddIncomeModal.tsx - Replace the handleSubmit function:

const handleSubmit = async () => {
  if (!amount || !description || !user) return;

  setLoading(true);
  
  try {
    const amountNum = parseFloat(amount);
    const taxRateNum = includeTax ? (parseFloat(taxRate) || 0) : 0;
    const taxAmountCalc = taxRateNum > 0 ? (amountNum * taxRateNum) / 100 : 0;

    // Convert to base currency
    const { baseAmount, exchangeRate } = await convertToBaseCurrency(amountNum, currency);
    const baseTaxAmount = taxRateNum > 0 ? (baseAmount * taxRateNum) / 100 : 0;

    const incomeData: any = {
      user_id: user.id,
      amount: amountNum,
      description,
      category_id: selectedCategory || null,
      date: format(selectedDate, "yyyy-MM-dd"),
      reference_number: referenceNumber || null,
      client_id: selectedClient || null,
      tax_rate: taxRateNum || null,
      tax_amount: taxAmountCalc || null,
      currency: currency,
      base_amount: baseAmount,
      exchange_rate: exchangeRate,
    };

    await createMutation.mutateAsync(incomeData);
  } catch (error) {
    console.error('Error creating income:', error);
    Alert.alert('Error', 'Failed to create income');
  } finally {
    setLoading(false);
  }
};



  const handleQuickAddClient = async () => {
    if (!newClientData.name.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          user_id: user.id,
          name: newClientData.name.trim(),
          email: newClientData.email.trim() || null,
          phone: newClientData.phone.trim() || null,
          address: newClientData.address.trim() || null,
        }])
        .select()
        .single();

      if (error) throw error;

      await refetchClients();
      setSelectedClient(data.id);
      setShowAddClient(false);
      setNewClientData({ name: "", email: "", phone: "", address: "" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to add client');
    }
  };

  const handleQuickAddCategory = async () => {
    if (!newCategoryName.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          user_id: user.id,
          name: newCategoryName.trim(),
          type: 'income',
          color: newCategoryColor,
        }])
        .select()
        .single();

      if (error) throw error;

      await refetchCategories();
      setSelectedCategory(data.id);
      setShowAddCategory(false);
      setNewCategoryName("");
      setNewCategoryColor("#10B981");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Error', 'Failed to add category');
    }
  };

  // Refresh data when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      refetchCategories();
      refetchClients();
    }
  }, [visible]);
  // Load enabled currencies from settings
React.useEffect(() => {
  if (visible && enabledCurrencies) {
    const currencies = enabledCurrencies.map(code => ({
      code,
      symbol: getCurrencySymbol(code),
      name: CURRENCY_NAMES[code] || code
    }));
    setAvailableCurrencies(currencies);
    setCurrency(baseCurrency);
  }
}, [visible, enabledCurrencies, baseCurrency, getCurrencySymbol]);
React.useEffect(() => {
  if (currency !== baseCurrency && amount) {
    convertToBaseCurrency(parseFloat(amount || '0'), currency)
      .then(({ baseAmount }) => setConvertedPreview(baseAmount))
      .catch(() => setConvertedPreview(0));
  } else {
    setConvertedPreview(0);
  }
}, [amount, currency, baseCurrency]);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Income</Text>
              <TouchableOpacity onPress={onClose}>
                <Feather name="x" size={24} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Amount Input with Currency Selector */}
              <View style={styles.amountSection}>
                <Text style={styles.inputLabel}>Amount</Text>
                <View style={styles.amountRow}>
                  <TouchableOpacity 
                    style={styles.currencySelector}
                    onPress={() => setShowCurrencySelector(true)}
                  >
                    <Text style={styles.currencySelectorText}>
                      {getCurrencySymbol(currency)} {currency}
                    </Text>
                    <Feather name="chevron-down" size={16} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                  <View style={styles.amountInputContainer}>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      placeholderTextColor={Colors.light.textTertiary}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                {currency !== baseCurrency && amount && convertedPreview > 0 && (
                  <Text style={styles.conversionNote}>
                    ≈ {formatCurrency(convertedPreview)} (will be converted at current rate)
                  </Text>
                )}
              </View>

              {/* Description */}
              <Input
                label="Description"
                placeholder="What was this income for?"
                value={description}
                onChangeText={setDescription}
                icon="edit-3"
              />

              {/* Tax Section */}
                <TouchableOpacity
                  style={styles.taxToggle}
                  onPress={() => setIncludeTax(!includeTax)}
                >
                  <MaterialIcons 
                    name={includeTax ? "check-box" : "check-box-outline-blank"} 
                    size={24} 
                    color="#10B981" 
                  />
                  <Text style={styles.taxToggleText}>
                    {isUKBusiness ? 'Apply VAT' : 'Apply Tax'}
                    
                  </Text> 
                </TouchableOpacity>
                
                {includeTax && (
                  <View style={styles.taxSection}>
                    <Text style={styles.inputLabel}>{isUKBusiness ? 'VAT Rate' : 'Tax Rate'}</Text>
                    
                    {/* Show saved tax rates as buttons */}
                    {taxRates && Object.keys(taxRates).length > 0 ? (
                      <View style={styles.taxRateButtons}>
                        {Object.entries(taxRates).map(([name, rate]) => (
                          <TouchableOpacity
                            key={name}
                            style={[
                              styles.taxRateButton,
                              taxRate === String(rate) && styles.taxRateButtonSelected
                            ]}
                            onPress={() => setTaxRate(String(rate))}
                          >
                            <Text style={[
                              styles.taxRateButtonText,
                              taxRate === String(rate) && styles.taxRateButtonTextSelected
                            ]}>
                              {name}
                            </Text>
                            <Text style={[
                              styles.taxRatePercent,
                              taxRate === String(rate) && styles.taxRatePercentSelected
                            ]}>
                              {rate}%
                            </Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={[
                            styles.taxRateButton,
                            !Object.values(taxRates).includes(Number(taxRate)) && taxRate !== "0" && styles.taxRateButtonSelected
                          ]}
                          onPress={() => setTaxRate("0")}
                        >
                          <Text style={styles.taxRateButtonText}>Custom</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    
                    {/* Show input for custom rate or if no saved rates */}
                    {(!taxRates || Object.keys(taxRates).length === 0 || !Object.values(taxRates).includes(Number(taxRate))) && (
                      <View style={styles.taxInputContainer}>
                        <TextInput
                          style={styles.taxInput}
                          placeholder="0"
                          value={taxRate}
                          onChangeText={setTaxRate}
                          keyboardType="decimal-pad"
                        />
                        <Text style={styles.taxPercent}>%</Text>
                      </View>
                    )}
                    
                    {parseFloat(taxRate) > 0 && parseFloat(amount) > 0 && (
                      <View style={styles.taxCalculation}>
                        <Text style={styles.taxCalcText}>
                          Tax: {formatCurrency(parseFloat(amount) * parseFloat(taxRate) / 100)}
                        </Text>
                        <Text style={styles.taxCalcText}>
                          Total: {formatCurrency(parseFloat(amount) * (1 + parseFloat(taxRate) / 100))}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

              {/* Date Picker */}
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.inputLabel}>Date</Text>
                <View style={styles.datePickerContent}>
                  <Feather
                    name="calendar"
                    size={20}
                    color={Colors.light.textSecondary}
                  />
                  <Text style={styles.datePickerText}>
                    {format(selectedDate, "MMM dd, yyyy")}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Client Selection */}
              <View style={styles.selectionSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.inputLabel}>Client (Optional)</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddClient(true)}
                  >
                    <Feather name="plus" size={16} color="#10B981" />
                    <Text style={styles.addButtonText}>Add New</Text>
                  </TouchableOpacity>
                </View>
                
                {clients && clients.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[
                        styles.selectionChip,
                        !selectedClient && styles.selectionChipSelected,
                      ]}
                      onPress={() => setSelectedClient("")}
                    >
                      <Text
                        style={[
                          styles.selectionChipText,
                          !selectedClient && styles.selectionChipTextSelected,
                        ]}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                    {clients.map((client: any) => (
                      <TouchableOpacity
                        key={client.id}
                        style={[
                          styles.selectionChip,
                          selectedClient === client.id &&
                            styles.selectionChipSelected,
                        ]}
                        onPress={() => setSelectedClient(client.id)}
                      >
                        <Text
                          style={[
                            styles.selectionChipText,
                            selectedClient === client.id &&
                              styles.selectionChipTextSelected,
                          ]}
                        >
                          {client.name}{client.company_name ? ` - ${client.company_name}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => setShowAddClient(true)}
                  >
                    <Feather name="plus" size={18} color="#10B981" />
                    <Text style={styles.emptyStateText}>Add your first client</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Category Selection */}
              <View style={styles.categorySection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddCategory(true)}
                  >
                    <Feather name="plus" size={16} color={Colors.light.primary} />
                    <Text style={[styles.addButtonText, { color: Colors.light.primary }]}>
                      Add New
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {categories && categories.length > 0 ? (
                  <View style={styles.categoryGrid}>
                    {categories.map((category: any) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryChip,
                          selectedCategory === category.id &&
                            styles.categoryChipSelected,
                        ]}
                        onPress={() => setSelectedCategory(category.id)}
                      >
                        <View
                          style={[
                            styles.categoryChipDot,
                            { backgroundColor: category.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            selectedCategory === category.id &&
                              styles.categoryChipTextSelected,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => setShowAddCategory(true)}
                  >
                    <Feather name="plus" size={18} color={Colors.light.primary} />
                    <Text style={[styles.emptyStateText, { color: Colors.light.primary }]}>
                      Add income categories
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Reference Number */}
              <Input
                label="Reference Number (Optional)"
                placeholder="e.g., Invoice #123"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                icon="hash"
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={onClose}
                variant="ghost"
                style={styles.modalButton}
              />
              <Button
                title="Add Income"
                onPress={handleSubmit}
                loading={loading}
                disabled={!amount || !description}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            onChange={(event: any, date?: Date) => {
              setShowDatePicker(false);
              if (date) setSelectedDate(date);
            }}
          />
        )}
      </Modal>

      {/* Quick Add Client Modal */}
      <Modal
        visible={showAddClient}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddClient(false)}
      >
        <View style={styles.quickModalOverlay}>
          <View style={styles.quickModalContent}>
            <Text style={styles.quickModalTitle}>Add New Client</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Client Name *"
                placeholder="John Doe"
                value={newClientData.name}
                onChangeText={(text) => setNewClientData({ ...newClientData, name: text })}
                icon="user"
              />

              <Input
                label="Email"
                placeholder="client@example.com"
                value={newClientData.email}
                onChangeText={(text) => setNewClientData({ ...newClientData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail"
              />
              
              <Input
                label="Phone"
                placeholder="+1 (555) 123-4567"
                value={newClientData.phone}
                onChangeText={(text) => setNewClientData({ ...newClientData, phone: text })}
                keyboardType="phone-pad"
                icon="phone"
              />
              
              <Input
                label="Address"
                placeholder="123 Main St, City, State"
                value={newClientData.address}
                onChangeText={(text) => setNewClientData({ ...newClientData, address: text })}
                multiline
                numberOfLines={3}
                icon="map-pin"
              />
            </ScrollView>
            
            <View style={styles.quickModalActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddClient(false);
                  setNewClientData({ name: "", email: "", phone: "", address: "" });
                }}
                variant="ghost"
                style={styles.quickModalButton}
              />
              <Button
                title="Add Client"
                onPress={handleQuickAddClient}
                disabled={!newClientData.name.trim()}
                style={styles.quickModalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Quick Add Category Modal */}
      <Modal
        visible={showAddCategory}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddCategory(false)}
      >
        <View style={styles.quickModalOverlay}>
          <View style={styles.quickModalContent}>
            <Text style={styles.quickModalTitle}>Add Income Category</Text>
            
            <Input
              label="Category Name"
              placeholder="e.g., Salary, Freelance"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              icon="tag"
            />
            
            <View style={styles.colorSection}>
              <Text style={styles.colorLabel}>Choose Color</Text>
              <View style={styles.colorGrid}>
                {CATEGORY_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      newCategoryColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setNewCategoryColor(color)}
                  >
                    {newCategoryColor === color && (
                      <Feather name="check" size={16} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.quickModalActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddCategory(false);
                  setNewCategoryName("");
                  setNewCategoryColor("#10B981");
                }}
                variant="ghost"
                style={styles.quickModalButton}
              />
              <Button
                title="Add Category"
                onPress={handleQuickAddCategory}
                disabled={!newCategoryName.trim()}
                style={styles.quickModalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
      {/* Currency Selector Modal */}
      <Modal
        visible={showCurrencySelector}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCurrencySelector(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCurrencySelector(false)}
        >
          <View style={styles.currencyModalContent}>
            <Text style={styles.currencyModalTitle}>Select Currency</Text>
            {availableCurrencies.map((curr) => (
              <TouchableOpacity
                key={curr.code}
                style={[
                  styles.currencyOption,
                  currency === curr.code && styles.currencyOptionSelected
                ]}
                onPress={() => {
                  setCurrency(curr.code);
                  setShowCurrencySelector(false);
                }}
              >
                <View style={styles.currencyOptionLeft}>
                  <Text style={styles.currencySymbolDisplay}>{curr.symbol}</Text>
                  <View>
                    <Text style={styles.currencyCode}>{curr.code}</Text>
                    <Text style={styles.currencyName}>{curr.name}</Text>
                  </View>
                </View>
                {currency === curr.code && (
                  <Feather name="check" size={20} color="#10B981" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
    
  );
  
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl + 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.title3,
    color: Colors.light.text,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.full,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#10B981",
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderStyle: "dashed",
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#10B981",
  },
  taxRateButtons: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: Spacing.sm,
  marginBottom: Spacing.sm,
},
taxRateButton: {
  paddingVertical: Spacing.sm,
  paddingHorizontal: Spacing.md,
  backgroundColor: Colors.light.backgroundSecondary,
  borderRadius: BorderRadius.md,
  borderWidth: 1.5,
  borderColor: Colors.light.border,
  minWidth: 80,
  alignItems: 'center',
},
taxRateButtonSelected: {
  backgroundColor: '#10B981' + '15',
  borderColor: '#10B981',
},
taxRateButtonText: {
  fontSize: 13,
  color: Colors.light.text,
  fontWeight: '500',
},
taxRateButtonTextSelected: {
  color: '#10B981',
  fontWeight: '600',
},
taxRatePercent: {
  fontSize: 11,
  color: Colors.light.textSecondary,
},
taxRatePercentSelected: {
  color: '#10B981',
},
  // Quick modal styles
  quickModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  quickModalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: "90%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  quickModalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  quickModalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  quickModalButton: {
    flex: 1,
  },
  colorSection: {
    marginBottom: Spacing.lg,
  },
  colorLabel: {
    ...Typography.subhead,
    color: Colors.light.text,
    marginBottom: Spacing.md,
    fontWeight: "500",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  colorOptionSelected: {
    transform: [{ scale: 1.1 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Form styles
  datePickerButton: {
    marginBottom: Spacing.md,
  },
  datePickerContent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  datePickerText: {
    ...Typography.body,
    color: Colors.light.text,
  },
  selectionSection: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.subhead,
    color: Colors.light.text,
    fontWeight: "500",
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  // Add these styles to both modals:
taxCalculation: {
  marginTop: Spacing.sm,
  padding: Spacing.sm,
  backgroundColor: Colors.light.backgroundSecondary,
  borderRadius: BorderRadius.sm,
},
taxCalcRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 4,
},
taxCalcLabel: {
  fontSize: 13,
  color: Colors.light.textSecondary,
},
taxCalcValue: {
  fontSize: 14,
  color: Colors.light.text,
  fontWeight: '500',
},
amountInputContainer: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F9FAFB',
  borderRadius: BorderRadius.lg,
  paddingHorizontal: Spacing.md,
  height: 56,
  borderWidth: 1.5,
  borderColor: '#E5E7EB',
},
taxCalcTotal: {
  borderTopWidth: 1,
  borderTopColor: Colors.light.border,
  marginTop: 4,
  paddingTop: 8,
},
taxCalcTotalLabel: {
  fontSize: 14,
  color: Colors.light.text,
  fontWeight: '600',
},
taxCalcTotalValue: {
  fontSize: 16,
  color: '#10B981',
  fontWeight: '700',
},
amountSection: {
    marginBottom: Spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    minWidth: 110,
  },
  currencySelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  conversionNote: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  currencyModalContent: {
    backgroundColor: Colors.light.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    margin: Spacing.xl,
    maxHeight: '70%',
  },
  currencyModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.md,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  currencyOptionSelected: {
    backgroundColor: '#10B981' + '10',
  },
  currencyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  currencySymbolDisplay: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    width: 30,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  currencyName: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  categoryChipSelected: {
    backgroundColor: Colors.light.primary + '15',
    borderColor: Colors.light.primary,
  },
  categoryChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  categoryChipText: {
    ...Typography.caption1,
    color: Colors.light.text,
  },
  categoryChipTextSelected: {
    color: Colors.light.primary,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
  selectionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F3F4F6',
    marginRight: Spacing.sm,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  selectionChipSelected: {
    backgroundColor: '#10B981' + '15',
    borderColor: '#10B981',
  },
  selectionChipText: {
    ...Typography.caption1,
    color: Colors.light.text,
    fontWeight: '500',
  },
  selectionChipTextSelected: {
    color: '#10B981',
    fontWeight: '600',
  },

  currencySymbol: {
    fontSize: 28,
    fontWeight: '600',
    color: '#10B981',
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '600',
    color: Colors.light.text,
  },
  taxSection: {
    marginBottom: Spacing.md,
  },
  taxToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  taxToggleText: {
    fontSize: 16,
    color: Colors.light.text,
    marginLeft: Spacing.sm,
  },
  taxInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  taxInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  taxPercent: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginLeft: Spacing.xs,
  },
  
  taxCalcText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
});