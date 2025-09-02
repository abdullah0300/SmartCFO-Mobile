export interface Country {
  code: string;
  name: string;
  taxName: string;
  defaultTaxRate?: number;
  taxFeatures: {
    requiresInvoiceTaxBreakdown: boolean;
    supportedSchemes?: string[];
    standardRates?: number[];
  };
}

export const countries: Country[] = [
  {
    code: 'GB',
    name: 'United Kingdom',
    taxName: 'VAT',
    defaultTaxRate: 20,
    taxFeatures: {
      requiresInvoiceTaxBreakdown: true,
      supportedSchemes: ['standard', 'flat_rate', 'cash'],
      standardRates: [0, 5, 20]
    }
  },
  {
    code: 'US',
    name: 'United States',
    taxName: 'Tax',
    defaultTaxRate: 0,
    taxFeatures: {
      requiresInvoiceTaxBreakdown: false
    }
  },
  {
    code: 'EU',
    name: 'European Union',
    taxName: 'VAT',
    defaultTaxRate: 21,
    taxFeatures: {
      requiresInvoiceTaxBreakdown: true,
      standardRates: [0, 9, 21]
    }
  },
  {
    code: 'CA',
    name: 'Canada',
    taxName: 'GST/HST',
    defaultTaxRate: 5,
    taxFeatures: {
      requiresInvoiceTaxBreakdown: false
    }
  },
  {
    code: 'AU',
    name: 'Australia',
    taxName: 'GST',
    defaultTaxRate: 10,
    taxFeatures: {
      requiresInvoiceTaxBreakdown: false
    }
  },
  {
    code: 'IN',
    name: 'India',
    taxName: 'GST',
    defaultTaxRate: 18,
    taxFeatures: {
      requiresInvoiceTaxBreakdown: true,
      standardRates: [0, 5, 12, 18, 28]
    }
  }
];