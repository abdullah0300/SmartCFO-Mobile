// VAT calculation utilities for UK/EU compliance
export const calculateVATFromNet = (netAmount: number, vatRate: number) => {
  const vat = (netAmount * vatRate) / 100;
  return {
    net: Math.round(netAmount * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    gross: Math.round((netAmount + vat) * 100) / 100
  };
};

export const aggregateVATByRate = (items: any[]) => {
  const vatGroups: Record<string, any> = {};
  
  items.forEach(item => {
    const rate = item.tax_rate || 0;
    if (!vatGroups[rate]) {
      vatGroups[rate] = { 
        rate, 
        net: 0, 
        vat: 0, 
        gross: 0,
        count: 0 
      };
    }
    vatGroups[rate].net += item.net_amount || 0;
    vatGroups[rate].vat += item.tax_amount || 0;
    vatGroups[rate].gross += item.gross_amount || 0;
    vatGroups[rate].count += 1;
  });
  
  // Round final values
  Object.keys(vatGroups).forEach(key => {
    vatGroups[key].net = Math.round(vatGroups[key].net * 100) / 100;
    vatGroups[key].vat = Math.round(vatGroups[key].vat * 100) / 100;
    vatGroups[key].gross = Math.round(vatGroups[key].gross * 100) / 100;
  });
  
  return vatGroups;
};