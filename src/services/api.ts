// src/services/api.ts
import { supabase } from './supabase';
import { Income, Expense, Invoice, Category } from '../types';

// Remove this import since you're importing supabase from './supabase'
// import { createClient } from '@supabase/supabase-js';

// Auth functions
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

// Export supabase for components that need it directly (like AddExpenseModal)
export { supabase };

// Add the missing getRecentTransactions function for the dashboard
export const getRecentTransactions = async (userId: string, limit = 5) => {
  const { data: incomes } = await supabase
    .from('income')
    .select(`
      id,
      amount,
      description,
      date,
      created_at,
      category:categories(name, color),
      client:clients(name)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  const { data: expenses } = await supabase
    .from('expenses')
    .select(`
      id,
      amount,
      description,
      date,
      created_at,
      category:categories(name, color),
      vendor_detail:vendors(name)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  // Combine and sort by date
  const allTransactions = [
    ...(incomes || []).map(t => ({ ...t, type: 'income' as const })),
    ...(expenses || []).map(t => ({ ...t, type: 'expense' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return allTransactions.slice(0, limit);
};

// Rest of your functions remain exactly the same...
export const getClients = async (userId: string) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// Dashboard data
export const getDashboardData = async (userId: string) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

  const [incomeResult, expenseResult, invoiceResult] = await Promise.all([
    supabase
      .from('income')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth),
    
    supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth),
    
    supabase
      .from('invoices')
      .select('total, status')
      .eq('user_id', userId)
      .in('status', ['sent', 'overdue'])
  ]);

  const totalIncome = incomeResult.data?.reduce((sum, item) => sum + item.amount, 0) || 0;
  const totalExpenses = expenseResult.data?.reduce((sum, item) => sum + item.amount, 0) || 0;
  const pendingInvoices = invoiceResult.data?.reduce((sum, item) => sum + item.total, 0) || 0;

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    pendingInvoices,
    invoiceCount: invoiceResult.data?.length || 0
  };
};

// Get notifications
export const getNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) throw error;
  return data;
};

export const deleteNotifications = async (notificationIds: string[]) => {
  try {
    // Delete notifications in batches to avoid potential query size limits
    const batchSize = 100;
    
    for (let i = 0; i < notificationIds.length; i += batchSize) {
      const batch = notificationIds.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', batch);
      
      if (error) throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting notifications:', error);
    throw error;
  }
};

// Get user profile
export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

export const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);
  
  if (error) throw error;
};

// Income functions - Add client relation
export const getIncomes = async (userId: string, limit = 20) => {
  const { data, error } = await supabase
    .from('income')
    .select(`
      *,
      category:categories(id, name, color),
      client:clients(*)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
};

// Update income
export const updateIncome = async (incomeId: string, updates: Partial<Income>) => {
  const { data, error } = await supabase
    .from('income')
    .update(updates)
    .eq('id', incomeId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Delete income - with proper error handling
export const deleteIncome = async (incomeId: string) => {
  const { data, error } = await supabase
    .from('income')
    .delete()
    .eq('id', incomeId);
  
  if (error) {
    console.error('Delete error:', error);
    throw error;
  }
  
  return data;
};

export const createIncome = async (income: Omit<Income, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('income')
    .insert([income])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);
  
  if (error) throw error;
};

// Update profile
export const updateProfile = async (userId: string, data: any) => {
  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId);
  
  if (error) throw error;
  return data;
};

// Expense functions
export const getExpenses = async (userId: string, limit = 50) => {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      category:categories(*),
      vendor_detail:vendors(*)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
};

export const createExpense = async (expense: any) => {
  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      ...expense,
      vendor_id: expense.vendor_id || null,
      tax_rate: expense.tax_rate || null,
      tax_amount: expense.tax_amount || null,
    }])
    .select(`
      *,
      category:categories(*),
      vendor_detail:vendors(*)
    `)
    .single();

  if (error) throw error;
  return data;
};

export const updateExpense = async (expenseId: string, updates: any) => {
  const { data, error } = await supabase
    .from('expenses')
    .update({
      ...updates,
      vendor_id: updates.vendor_id || null,
      tax_rate: updates.tax_rate || null,
      tax_amount: updates.tax_amount || null,
    })
    .eq('id', expenseId)
    .select(`
      *,
      category:categories(*),
      vendor_detail:vendors(*)
    `)
    .single();

  if (error) throw error;
  return data;
};
// Delete expense
export const deleteExpense = async (expenseId: string) => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId);
  
  if (error) throw error;
};

// Smart categorization - fix the edge function call
export const categorizeExpense = async (description: string, vendor: string, amount: number) => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user?.id) throw new Error('User not authenticated');

    // For now, implement client-side categorization
    // This avoids the edge function error
    const categories = await getCategories(user.user.id, 'expense');
    
    if (!categories || categories.length === 0) {
      return null;
    }

    // Simple keyword matching for categories
    const lowerDesc = description.toLowerCase();
    const lowerVendor = vendor.toLowerCase();
    const combined = `${lowerDesc} ${lowerVendor}`;

    // Category matching rules
    const categoryRules = {
      'Food & Dining': ['restaurant', 'food', 'lunch', 'dinner', 'breakfast', 'cafe', 'coffee', 'pizza', 'burger'],
      'Transportation': ['uber', 'lyft', 'gas', 'fuel', 'parking', 'taxi', 'bus', 'train'],
      'Shopping': ['amazon', 'store', 'mall', 'shop', 'retail', 'clothes', 'shoes'],
      'Entertainment': ['movie', 'theater', 'concert', 'game', 'sport', 'netflix', 'spotify'],
      'Utilities': ['electric', 'water', 'internet', 'phone', 'mobile', 'bill'],
      'Healthcare': ['doctor', 'hospital', 'pharmacy', 'medicine', 'health', 'clinic'],
      'Groceries': ['grocery', 'supermarket', 'walmart', 'target', 'costco'],
    };

    for (const [categoryName, keywords] of Object.entries(categoryRules)) {
      if (keywords.some(keyword => combined.includes(keyword))) {
        const matchedCategory = categories.find(c => c.name === categoryName);
        if (matchedCategory) {
          return {
            category: matchedCategory.name,
            id: matchedCategory.id,
            color: matchedCategory.color,
            confidence: 0.85,
            reason: `Matched based on keywords in ${vendor || 'description'}`
          };
        }
      }
    }

    // If no match, return null
    return null;
  } catch (error) {
    console.error('Categorization error:', error);
    return null;
  }
};

// Categories
export const getCategories = async (userId: string, type?: 'income' | 'expense') => {
  let query = supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId);
  
  if (type) {
    query = query.eq('type', type);
  }
  
  const { data, error } = await query.order('name');
  if (error) throw error;
  return data;
};

// Get vendors
export const getVendors = async (userId: string) => {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  
  if (error) throw error;
  return data || [];
};

// Create vendor
export const createVendor = async (vendor: any) => {
  const { data, error } = await supabase
    .from('vendors')
    .insert([vendor])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Invoices
// Add to src/services/api.ts
export const getInvoices = async (userId: string, limit = 20) => {
  try {
    // Try to get invoices with recurring_invoice_id if it exists
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(id, name, email, phone)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }

    // Get all recurring invoice template IDs
    const { data: recurringInvoices } = await supabase
      .from('recurring_invoices')
      .select('id, invoice_id')
      .eq('user_id', userId);

    // Create Sets for checking
    const recurringTemplateIds = new Set(
      recurringInvoices?.map(r => r.invoice_id) || []
    );
    const recurringIds = new Set(
      recurringInvoices?.map(r => r.id) || []
    );

    // Mark invoices as recurring based on:
    // 1. If invoice.id matches a recurring template (invoice_id in recurring_invoices)
    // 2. If invoice has a recurring_invoice_id field (auto-generated invoices)
    const invoicesWithRecurringFlag = data?.map(invoice => ({
      ...invoice,
      is_recurring: recurringTemplateIds.has(invoice.id) ||
                    (invoice.recurring_invoice_id && recurringIds.has(invoice.recurring_invoice_id))
    })) || [];

    return invoicesWithRecurringFlag;
  } catch (error) {
    console.error('Failed to get invoices:', error);
    return [];
  }
};

// Add these invoice-related functions
export const getInvoice = async (invoiceId: string) => {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(*),
      items:invoice_items(*)
    `)
    .eq('id', invoiceId)
    .single();

  if (error) throw error;

  // Check if this invoice is recurring - either from the is_recurring field or linked to recurring_invoices
  if (!data.is_recurring) {
    const { data: recurringCheck } = await supabase
      .from('recurring_invoices')
      .select('id')
      .or(`invoice_id.eq.${invoiceId}${data.recurring_invoice_id ? `,id.eq.${data.recurring_invoice_id}` : ''}`)
      .maybeSingle();

    if (recurringCheck) {
      data.is_recurring = true;
    }
  }

  return data;
};

export const createInvoice = async (invoice: any, items: any[], isRecurring = false, recurringData?: any) => {
  // Start a transaction
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .insert([invoice])
    .select()
    .single();
  
  if (invoiceError) throw invoiceError;
  
  // Add items
  if (items.length > 0) {
    const invoiceItems = items.map(item => ({
      ...item,
      invoice_id: invoiceData.id,
    }));
    
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);
    
    if (itemsError) throw itemsError;
  }
  
  // Create recurring invoice if needed
  if (isRecurring && recurringData) {
    const { error: recurringError } = await supabase
      .from('recurring_invoices')
      .insert([{
        ...recurringData,
        invoice_id: invoiceData.id,
      }]);
    
    if (recurringError) throw recurringError;
  }
  
  return invoiceData;
};

export const generateInvoiceNumber = async (userId: string): Promise<string> => {
  try {
    // Use the same RPC function as web app - this is atomic and safe
    const { data, error } = await supabase
      .rpc('get_next_invoice_number', { p_user_id: userId });
    
    if (error) throw error;
    return data;
    
  } catch (error) {
    console.error('Error generating invoice number:', error);
    // Fallback to timestamp-based number
    return `INV-${Date.now()}`;
  }
};

export const updateInvoice = async (invoiceId: string, updates: any) => {
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteInvoice = async (invoiceId: string) => {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId);
  
  if (error) throw error;
};


// Add to src/services/api.ts
export const sendInvoiceEmail = async (
  invoiceId: string, 
  recipientEmail: string,
  attachPdf = true
) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) throw new Error('No session');
  
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-invoice-email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        invoiceId,
        recipientEmail,
        attachPdf,
      }),
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to send email');
  }
  
  return response.json();
};

export const generateInvoicePublicLink = async (invoiceId: string) => {
  const token = btoa(Math.random().toString()).substring(10, 25);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry
  
  const { error } = await supabase
    .from('invoice_access_tokens')
    .insert({
      token,
      invoice_id: invoiceId,
      expires_at: expiresAt.toISOString()
    });
  
  if (error) throw error;
  
  return `${process.env.EXPO_PUBLIC_APP_URL}/invoices/public/${invoiceId}?token=${token}`;
};

// Get invoice settings
export const getInvoiceSettings = async (userId: string) => {
  const { data, error } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const getRecurringInvoices = async (userId: string) => {
  const { data, error } = await supabase
    .from('recurring_invoices')
    .select(`
      *,
      client:clients(*),
      original_invoice:invoices!invoice_id(invoice_number)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createRecurringInvoice = async (recurringInvoice: any) => {
  const { data, error } = await supabase
    .from('recurring_invoices')
    .insert([recurringInvoice])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateRecurringInvoice = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('recurring_invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getInvoiceTemplates = async (userId: string) => {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createInvoiceTemplate = async (template: any) => {
  const { data, error } = await supabase
    .from('invoice_templates')
    .insert([template])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteInvoiceTemplate = async (id: string) => {
  const { error } = await supabase
    .from('invoice_templates')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Add this function to your src/services/api.ts file

export const getDashboardDataForPeriod = async (
  userId: string, 
  startDate: Date, 
  endDate: Date
) => {
  const startDateISO = startDate.toISOString();
  const endDateISO = endDate.toISOString();

  const [incomeResult, expenseResult, invoiceResult] = await Promise.all([
    // Get income for the period
    supabase
      .from('income')
      .select('amount, tax_amount')
      .eq('user_id', userId)
      .gte('date', startDateISO)
      .lte('date', endDateISO),
    
    // Get expenses for the period
    supabase
      .from('expenses')
      .select('amount, tax_amount')
      .eq('user_id', userId)
      .gte('date', startDateISO)
      .lte('date', endDateISO),
    
    // Get pending invoices (not date-filtered as they're still pending)
    supabase
      .from('invoices')
      .select('total, status')
      .eq('user_id', userId)
      .in('status', ['sent', 'overdue'])
  ]);

  // Calculate totals including tax
  const totalIncome = incomeResult.data?.reduce((sum, item) => {
    const baseAmount = item.amount || 0;
    const taxAmount = item.tax_amount || 0;
    return sum + baseAmount + taxAmount;
  }, 0) || 0;

  const totalExpenses = expenseResult.data?.reduce((sum, item) => {
    const baseAmount = item.amount || 0;
    const taxAmount = item.tax_amount || 0;
    return sum + baseAmount + taxAmount;
  }, 0) || 0;

  const pendingInvoices = invoiceResult.data?.reduce((sum, item) => sum + item.total, 0) || 0;

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    pendingInvoices,
    invoiceCount: invoiceResult.data?.length || 0,
    period: {
      start: startDateISO,
      end: endDateISO
    }
  };
};


// Get single income record
export const getIncome = async (incomeId: string, userId: string) => {
  const { data, error } = await supabase
    .from('income')
    .select(`
      *,
      category:categories(*),
      client:clients(*)
    `)
    .eq('id', incomeId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
};

// Get single expense record
export const getExpense = async (expenseId: string, userId: string) => {
  const { data, error} = await supabase
    .from('expenses')
    .select(`
      *,
      category:categories(*),
      vendor_detail:vendors(*)
    `)
    .eq('id', expenseId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
};