// src/services/pdfService.mobile.ts
import { supabase } from './supabase';

export const pdfService = {
  async generateInvoicePDF(invoiceId: string): Promise<Blob> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No authentication session');
      }

      // Call the edge function (same as web)
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-invoice-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ invoiceId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PDF');
      }

      return await response.blob();
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  },
};