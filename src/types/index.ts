// src/types/index.ts

export interface User {
  id: string;
  email?: string;
  role?: string;
  created_at?: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Income {
  id: string;
  user_id: string;
  amount: number;
  category_id?: string;
  category?: Category;
  description: string;
  date: string;
  reference_number?: string;
  created_at: string;
  updated_at: string;
  client_id?: string;
  client?: Client;
  // Add these tax fields
  tax_rate?: number;
  tax_amount?: number;
  total_with_tax?: number;
  currency?: string;
  exchange_rate?: number;
  base_amount?: number;
}

export interface Vendor {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  payment_terms: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  import_session_id?: string | null;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category_id?: string;
  category?: Category;
  description: string;
  date: string;
  vendor?: string;           // This is the old string field
  vendor_id?: string;        // This is the new vendor reference
  vendor_detail?: Vendor;    // ADD THIS - This is the populated vendor object
  receipt_url?: string;
  created_at: string;
  updated_at: string;
  currency?: string;
  exchange_rate?: number;
  base_amount?: number;
  tax_rate?: number;
  tax_amount?: number;
  total_with_tax?: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

// Add to src/types/index.ts
export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  client_id?: string;
  client?: Client;
  date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  currency?: string;
  paid_date?: string;
  sent_date?: string;
  items?: InvoiceItem[];
  created_at: string;
  updated_at: string;
  income_category_id?: string;
  base_amount?: number;
  exchange_rate?: number;
  tax_metadata?: {
    has_line_item_vat?: boolean;
    vat_breakdown?: Record<string, { net: number; vat: number; gross: number }>;
    tax_label?: string;
    tax_scheme?: string;
    country_code?: string;
    };
}

export interface NewInvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  tax_rate?: number;
  tax_amount?: number;
  net_amount?: number;
  gross_amount?: number;
}

export interface RecurringInvoice {
  id: string;
  user_id: string;
  client_id?: string;
  client?: Client;
  template_data: {
    invoice_number?: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    notes?: string;
    currency?: string;
    items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[];
  };
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  next_date: string;
  last_generated?: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceTemplate {
  id: string;
  user_id: string;
  name: string;
  template_data: {
    client_id?: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    notes?: string;
    currency?: string;
    items: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>[];
  };
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  created_at?: string;
  tax_rate?: number;
  tax_amount?: number;
  net_amount?: number;
  gross_amount?: number;
}

export interface InvoiceSettings {
  id: string;
  user_id: string;
  invoice_prefix: string;
  next_number: number;
  due_days: number;
  payment_terms?: number;
  notes?: string;
  footer?: string;
  tax_rate?: number;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_logo?: string;
  currency?: string;
  payment_instructions?: string;
  auto_send_recurring?: boolean;
  created_at?: string;
  updated_at?: string;
}


export interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  pendingInvoices: number;
  invoiceCount: number;
  recentIncomes?: Income[];
  recentExpenses?: Expense[];
}

export interface Settings {
  id: string;
  user_id: string;
  base_currency: string;
  country?: string;
  timezone?: string;
  date_format?: string;
  fiscal_year_start?: string;
  created_at?: string;
  updated_at?: string;
}