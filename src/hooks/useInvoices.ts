// src/hooks/useInvoices.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { 
  getInvoices, 
  getInvoice, 
  createInvoice, 
  updateInvoice, 
  deleteInvoice 
} from '../services/api';

export const useInvoices = (limit = 50) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['invoices', user?.id, limit],
    queryFn: () => getInvoices(user!.id, limit),
    enabled: !!user,
  });
};

export const useInvoice = (invoiceId: string) => {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId),
    enabled: !!invoiceId,
  });
};

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ invoice, items }: { invoice: any, items: any[] }) => 
      createInvoice(invoice, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', user?.id] });
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: any }) => 
      updateInvoice(id, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.id] });
    },
  });
};