CORRECTED COMPLETE INSTRUCTIONS FOR MOBILE APP FIXES
🎯 SUMMARY OF ISSUES:

INCOME needs: Client selector (already exists in web) + Reference Number (already exists in web) → Both MISSING in mobile
EXPENSE needs: Reference Number (already exists in web) → MISSING in mobile
Vendor created on mobile not showing on web → API query mismatch
Notification shows hardcoded "$" → needs base currency symbol


✅ WHAT ALREADY EXISTS:
Web App (src/components/Income/IncomeForm.tsx):

✅ Client selector dropdown with ability to add new client
✅ Reference Number field
✅ Client has: name, company_name, email, phone, address

Web App (src/components/Expense/ExpenseForm.tsx):

✅ Reference Number field
✅ Vendor selector

Mobile Types (src/types/index.ts):

✅ Income interface has client_id and reference_number
✅ Expense interface has reference_number
✅ Client interface has all fields including company_name


🔧 FIX #1: ADD CLIENT SELECTOR & REFERENCE NUMBER TO MOBILE INCOME FORM
File: src/components/income/AddIncomeModal.tsx (MOBILE)
STEP 1: Add state variables (around line 50):
typescriptconst [selectedClient, setSelectedClient] = useState<string>('');
const [referenceNumber, setReferenceNumber] = useState('');

// For quick add client modal
const [showAddClient, setShowAddClient] = useState(false);
const [newClientData, setNewClientData] = useState({
  name: '',
  company_name: '',
  email: '',
  phone: '',
  address: '',
});
STEP 2: Add query to load clients (after categories query, around line 80):
typescriptconst { data: clients = [] } = useQuery({
  queryKey: ['clients', user?.id],
  queryFn: () => getClients(user!.id),
  enabled: !!user,
});
STEP 3: Add fields in the form (after Description field, before Tax section, around line 350):
typescript{/* Client Selector */}
<View style={styles.fieldGroup}>
  <Text style={styles.inputLabel}>Client (Optional)</Text>
  <View style={styles.vendorRow}>
    <View style={styles.vendorSelectorContainer}>
      <Picker
        selectedValue={selectedClient}
        onValueChange={(value) => setSelectedClient(value)}
        style={styles.picker}
      >
        <Picker.Item label="Select a client" value="" />
        {clients.map((client: Client) => (
          <Picker.Item
            key={client.id}
            label={`${client.name}${client.company_name ? ` - ${client.company_name}` : ''}`}
            value={client.id}
          />
        ))}
      </Picker>
    </View>
    <TouchableOpacity 
      style={styles.addButton}
      onPress={() => setShowAddClient(true)}
    >
      <Feather name="plus" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  </View>
</View>

{/* Reference Number */}
<Input
  label="Reference Number (Optional)"
  placeholder="Invoice #, PO #, etc."
  value={referenceNumber}
  onChangeText={setReferenceNumber}
  icon="hash"
/>
STEP 4: Update resetForm function (around line 130):
typescriptconst resetForm = () => {
  setAmount('');
  setDescription('');
  setSelectedClient('');  // ADD THIS
  setReferenceNumber('');  // ADD THIS
  setSelectedCategory('');
  setSelectedDate(new Date());
  setSuggestedCategory(null);
  setTaxRate("0");
  setIncludeTax(false);
  setNewCategoryName("");
  setNewCategoryColor("#3B82F6");
  setNewClientData({ name: '', company_name: '', email: '', phone: '', address: '' });  // ADD THIS
};
STEP 5: Update handleSubmit (around line 320) - add to incomeData object:
typescriptconst incomeData = {
  user_id: user.id,
  amount: parseFloat(amount),
  description,
  category_id: selectedCategory || undefined,
  client_id: selectedClient || undefined,  // ADD THIS
  reference_number: referenceNumber || undefined,  // ADD THIS
  date: format(selectedDate, 'yyyy-MM-dd'),
  currency: currency,
  exchange_rate: exchangeRate,
  base_amount: baseAmount,
  tax_rate: includeTax ? parseFloat(taxRate) : 0,
  tax_amount: includeTax ? taxAmount : 0,
};
STEP 6: Add Quick Add Client Modal (before the main Modal closing tag, around line 600):
typescript{/* Quick Add Client Modal */}
<Modal
  visible={showAddClient}
  transparent
  animationType="fade"
  onRequestClose={() => setShowAddClient(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.quickAddModal}>
      <View style={styles.quickAddHeader}>
        <Text style={styles.quickAddTitle}>Add New Client</Text>
        <TouchableOpacity onPress={() => setShowAddClient(false)}>
          <Feather name="x" size={24} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.quickAddContent}>
        <Input
          label="Client Name *"
          placeholder="Client name"
          value={newClientData.name}
          onChangeText={(text) => setNewClientData({...newClientData, name: text})}
          icon="user"
        />
        <Input
          label="Company Name"
          placeholder="Company name (optional)"
          value={newClientData.company_name}
          onChangeText={(text) => setNewClientData({...newClientData, company_name: text})}
          icon="briefcase"
        />
        <Input
          label="Email"
          placeholder="client@example.com"
          value={newClientData.email}
          onChangeText={(text) => setNewClientData({...newClientData, email: text})}
          icon="mail"
          keyboardType="email-address"
        />
        <Input
          label="Phone"
          placeholder="+1 (555) 123-4567"
          value={newClientData.phone}
          onChangeText={(text) => setNewClientData({...newClientData, phone: text})}
          icon="phone"
          keyboardType="phone-pad"
        />
        <Input
          label="Address"
          placeholder="Street address"
          value={newClientData.address}
          onChangeText={(text) => setNewClientData({...newClientData, address: text})}
          icon="map-pin"
          multiline
        />
      </ScrollView>
      
      <View style={styles.quickAddActions}>
        <Button
          title="Cancel"
          onPress={() => {
            setShowAddClient(false);
            setNewClientData({ name: '', company_name: '', email: '', phone: '', address: '' });
          }}
          variant="secondary"
          style={{ flex: 1 }}
        />
        <Button
          title="Add Client"
          onPress={async () => {
            if (!newClientData.name.trim()) {
              Alert.alert('Error', 'Please enter client name');
              return;
            }
            try {
              const newClient = await createClient({
                user_id: user!.id,
                ...newClientData
              });
              queryClient.invalidateQueries({ queryKey: ['clients'] });
              setSelectedClient(newClient.id);
              setShowAddClient(false);
              setNewClientData({ name: '', company_name: '', email: '', phone: '', address: '' });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Alert.alert('Error', 'Failed to create client');
            }
          }}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  </View>
</Modal>
STEP 7: Add styling (in StyleSheet.create at bottom):
typescriptvendorRow: {
  flexDirection: 'row',
  gap: 8,
},
vendorSelectorContainer: {
  flex: 1,
  borderWidth: 1,
  borderColor: Colors.light.border,
  borderRadius: BorderRadius.md,
  overflow: 'hidden',
  backgroundColor: Colors.light.background,
},
picker: {
  height: 50,
},
addButton: {
  width: 50,
  height: 50,
  backgroundColor: Colors.light.primary,
  borderRadius: BorderRadius.md,
  justifyContent: 'center',
  alignItems: 'center',
},
quickAddModal: {
  backgroundColor: Colors.light.background,
  borderRadius: BorderRadius.lg,
  width: '90%',
  maxHeight: '80%',
},
quickAddHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: Colors.light.border,
},
quickAddTitle: {
  fontSize: 18,
  fontWeight: '600',
  color: Colors.light.text,
},
quickAddContent: {
  padding: 16,
},
quickAddActions: {
  flexDirection: 'row',
  gap: 12,
  padding: 16,
  borderTopWidth: 1,
  borderTopColor: Colors.light.border,
},

File: src/components/income/EditIncomeModal.tsx (MOBILE)
Apply the exact same changes as AddIncomeModal:

Add same state variables
Add same client query
Load existing client_id and reference_number in useEffect
Add same UI fields
Update handleUpdate function with client_id and reference_number


🔧 FIX #2: ADD REFERENCE NUMBER TO MOBILE EXPENSE FORM
File: src/components/expense/AddExpenseModal.tsx (MOBILE)
ALREADY HAS reference field in form but might be missing. Check if Reference Number field exists after Vendor selector. If NOT, add:
typescript{/* Reference Number */}
<Input
  label="Reference Number (Optional)"
  placeholder="Invoice #, PO #, etc."
  value={referenceNumber}
  onChangeText={setReferenceNumber}
  icon="hash"
/>
Ensure referenceNumber state exists and is included in the expenseData object when submitting.

File: src/components/expense/EditExpenseModal.tsx (MOBILE)
Same as above - ensure Reference Number field exists and loads properly from expense data.

🔧 FIX #3: VENDOR SHOWS EMPTY ON WEB (API QUERY MISMATCH)
File: src/services/api.ts (MOBILE)
FIND the getExpenses function (around line 130):
CHANGE FROM:
typescript.select(`
  *,
  category:categories(*),
  vendor:vendors(*)
`)
CHANGE TO:
typescript.select(`
  *,
  category:categories(*),
  vendor_detail:vendors(*)
`)
ALSO UPDATE createExpense function:
typescript.select(`
  *,
  category:categories(*),
  vendor_detail:vendors(*)
`)
ALSO UPDATE updateExpense function:
typescript.select(`
  *,
  category:categories(*),
  vendor_detail:vendors(*)
`)
This ensures mobile API returns vendor data in the same format as web (vendor_detail instead of vendor).

🔧 FIX #4: NOTIFICATION CURRENCY SYMBOL
File: src/components/expense/AddExpenseModal.tsx (MOBILE)
FIND the notification creation in handleSubmit (around line 340):
CHANGE FROM:
typescriptawait createNotification(
  user.id, 
  'expense_added', 
  'New Expense Added', 
  `You added an expense of $${parseFloat(amount).toFixed(2)}`,
  { metadata: { amount: parseFloat(amount), description } }
);
CHANGE TO:
typescriptawait createNotification(
  user.id, 
  'expense_added', 
  'New Expense Added', 
  `You added an expense of ${getCurrencySymbol(currency)}${parseFloat(amount).toFixed(2)}`,
  {
    metadata: { 
      amount: baseAmount,
      currency: baseCurrency,
      description 
    }
  }
);

File: src/components/expense/EditExpenseModal.tsx (MOBILE)
FIND the notification in handleUpdate (around line 260):
CHANGE TO:
typescriptawait createNotification(
  user.id, 
  'expense_added', 
  'Expense Updated', 
  `You updated an expense: ${getCurrencySymbol(currency)}${parseFloat(amount).toFixed(2)}`,
  {
    metadata: { 
      amount: baseAmount,
      currency: baseCurrency,
      description 
    }
  }
);

File: src/components/income/AddIncomeModal.tsx (MOBILE)
FIND notification creation and apply same fix:
typescriptawait createNotification(
  user.id, 
  'payment_received', 
  'New Income Added', 
  `You recorded an income of ${getCurrencySymbol(currency)}${parseFloat(amount).toFixed(2)}`,
  {
    metadata: { 
      amount: baseAmount,
      currency: baseCurrency,
      description 
    }
  }
);

✅ TESTING CHECKLIST
After implementing all fixes:

 Income Mobile: Can select client, shows company_name in dropdown
 Income Mobile: Can add new client with all fields (name, company_name, email, phone, address)
 Income Mobile: Reference number field exists and saves
 Income Web: Shows client and reference number from mobile-created income
 Expense Mobile: Reference number field exists and saves
 Expense Web: Shows reference number from mobile-created expense
 Expense Mobile → Web: Vendor created on mobile shows correctly on web
 Expense Web → Mobile: Vendor created on web shows correctly on mobile
 Notifications: Show correct currency symbol (PKR, USD, etc.) not hardcoded "$"