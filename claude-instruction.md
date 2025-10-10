// src/components/Invoice/RecurringInvoices.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Calendar,
  RefreshCw,
  Play,
  Pause,
  Edit,
  Trash2,
  Clock,
  Coins,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Search,
  Filter
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabaseClient';
import { format, addDays, addWeeks, addMonths, parseISO, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface RecurringInvoice {
  id: string;
  user_id: string;
  client_id: string;
  invoice_id?: string;
  client?: { name: string };
  template_data: any;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  next_date: string;
  last_generated: string | null;
  is_active: boolean;
  created_at: string;
  end_date?: string | null;
  original_invoice?: { invoice_number: string };
}

export const RecurringInvoices: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatCurrency, getCurrencySymbol, baseCurrency } = useSettings();
  const { effectiveUserId } = useData();
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');

  useEffect(() => {
    if (user && effectiveUserId) {
      loadRecurringInvoices();
    }
  }, [user, effectiveUserId, filter]);

  const loadRecurringInvoices = async () => {
    if (!user || !effectiveUserId) return;

    try {
      setLoading(true);
      let query = supabase
        .from('recurring_invoices')
        .select(`
          *,
          client:clients(name),
          original_invoice:invoices!invoice_id(invoice_number)
        `)
        .eq('user_id', effectiveUserId)
        .order('next_date', { ascending: true });
      
      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'paused') {
        query = query.eq('is_active', false);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setRecurringInvoices(data || []);
    } catch (err: any) {
      console.error('Error loading recurring invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      await loadRecurringInvoices();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const deleteRecurring = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this recurring invoice?')) return;
    
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      await loadRecurringInvoices();
    } catch (err: any) {
      alert('Error deleting recurring invoice: ' + err.message);
    }
  };

  const getFrequencyBadge = (frequency: string) => {
    const badges: { [key: string]: { label: string; color: string } } = {
      weekly: { label: 'Weekly', color: 'bg-purple-100 text-purple-700' },
      biweekly: { label: 'Bi-weekly', color: 'bg-indigo-100 text-indigo-700' },
      monthly: { label: 'Monthly', color: 'bg-blue-100 text-blue-700' },
      quarterly: { label: 'Quarterly', color: 'bg-cyan-100 text-cyan-700' },
      yearly: { label: 'Yearly', color: 'bg-green-100 text-green-700' }
    };
    return badges[frequency] || { label: frequency, color: 'bg-gray-100 text-gray-700' };
  };

  const getDaysUntilNext = (nextDate: string) => {
    const days = differenceInDays(parseISO(nextDate), new Date());
    if (days < 0) return { text: 'Overdue', color: 'text-red-600' };
    if (days === 0) return { text: 'Today', color: 'text-green-600' };
    if (days === 1) return { text: 'Tomorrow', color: 'text-blue-600' };
    if (days <= 7) return { text: `In ${days} days`, color: 'text-yellow-600' };
    return { text: `In ${days} days`, color: 'text-gray-600' };
  };

  // Filter invoices based on search and filters
  const filteredInvoices = useMemo(() => {
    return recurringInvoices.filter(invoice => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const clientName = invoice.client?.name?.toLowerCase() || '';
        const invoiceNumber = invoice.original_invoice?.invoice_number?.toLowerCase() || '';
        if (!clientName.includes(searchLower) && !invoiceNumber.includes(searchLower)) {
          return false;
        }
      }

      // Frequency filter
      if (frequencyFilter !== 'all' && invoice.frequency !== frequencyFilter) {
        return false;
      }

      // Date range filter
      if (dateRangeFilter !== 'all') {
        const days = differenceInDays(parseISO(invoice.next_date), new Date());
        if (dateRangeFilter === 'overdue' && days >= 0) return false;
        if (dateRangeFilter === 'thisWeek' && (days < 0 || days > 7)) return false;
        if (dateRangeFilter === 'thisMonth' && (days < 0 || days > 30)) return false;
        if (dateRangeFilter === 'upcoming' && days < 0) return false;
      }

      return true;
    });
  }, [recurringInvoices, searchTerm, frequencyFilter, dateRangeFilter]);

  // Calculate stats
  const stats = {
    active: recurringInvoices.filter(i => i.is_active).length,
    total: recurringInvoices.length,
    weeklyValue: recurringInvoices
      .filter(i => i.is_active && i.frequency === 'weekly')
      .reduce((sum, i) => sum + (i.template_data?.total || 0), 0),
    monthlyValue: recurringInvoices
      .filter(i => i.is_active && i.frequency === 'monthly')
      .reduce((sum, i) => sum + (i.template_data?.total || 0), 0),
    dueThisWeek: recurringInvoices.filter(i => {
      const days = differenceInDays(parseISO(i.next_date), new Date());
      return days >= 0 && days <= 7 && i.is_active;
    }).length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recurring Invoices</h1>
            <p className="text-gray-500 mt-1">Automate your regular billing</p>
          </div>
        </div>
        <Link
          to="/invoices/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Recurring
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Due This Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.dueThisWeek}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Monthly Value</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(stats.monthlyValue, baseCurrency)}
              </p>
            </div>
            <Coins className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <RefreshCw className="h-8 w-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by client name or invoice number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Status Filter Tabs */}
          <div className="bg-gray-100 rounded-lg p-1 inline-flex">
            {['all', 'active', 'paused'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-4 py-1.5 rounded-md capitalize transition-colors text-sm ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
                <span className="ml-2 text-xs">
                  ({status === 'all' ? stats.total : status === 'active' ? stats.active : stats.total - stats.active})
                </span>
              </button>
            ))}
          </div>

          {/* Frequency Filter */}
          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Frequencies</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>

          {/* Date Range Filter */}
          <select
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value)}
            className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Dates</option>
            <option value="overdue">Overdue</option>
            <option value="thisWeek">This Week</option>
            <option value="thisMonth">This Month</option>
            <option value="upcoming">Upcoming</option>
          </select>

          {/* Clear Filters */}
          {(searchTerm || frequencyFilter !== 'all' || dateRangeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFrequencyFilter('all');
                setDateRangeFilter('all');
              }}
              className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* List View */}
      {filteredInvoices.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredInvoices.length}</span> of <span className="font-semibold">{recurringInvoices.length}</span> recurring invoices
            </p>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((recurring) => {
                const currency = recurring.template_data?.currency || baseCurrency;
                const total = recurring.template_data?.total || 0;
                const frequencyBadge = getFrequencyBadge(recurring.frequency);
                const daysUntil = getDaysUntilNext(recurring.next_date);
                
                return (
                  <tr key={recurring.id} className={!recurring.is_active ? 'opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {recurring.client?.name || 'No Client'}
                        </div>
                        {recurring.original_invoice?.invoice_number && (
                          <div className="text-xs text-gray-500">
                            From #{recurring.original_invoice.invoice_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${frequencyBadge.color}`}>
                        {frequencyBadge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(total, currency)}
                      </div>
                      {currency !== baseCurrency && (
                        <div className="text-xs text-gray-500">{currency}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">
                          {format(parseISO(recurring.next_date), 'MMM dd, yyyy')}
                        </div>
                        <div className={`text-xs font-medium ${daysUntil.color}`}>
                          {daysUntil.text}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {recurring.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></span>
                          Paused
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => toggleStatus(recurring.id, recurring.is_active)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            recurring.is_active
                              ? 'text-orange-600 hover:bg-orange-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={recurring.is_active ? 'Pause' : 'Resume'}
                        >
                          {recurring.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        {recurring.invoice_id && (
                          <Link
                            to={`/invoices/recurring/edit/${recurring.id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        )}
                        <button
                          onClick={() => deleteRecurring(recurring.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : recurringInvoices.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No matching invoices</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFrequencyFilter('all');
              setDateRangeFilter('all');
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recurring invoices</h3>
          <p className="text-gray-500 mb-4">Create recurring invoices to automate your billing</p>
          <Link
            to="/invoices/new"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create your first recurring invoice
          </Link>
        </div>
      )}
    </div>
  );
};