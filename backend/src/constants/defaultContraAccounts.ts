export interface ContraAccountMapping {
  skr03: string;
  skr04: string;
  defaultVat?: 0 | 7 | 19;
}

export const DEFAULT_CONTRA_ACCOUNTS: Record<string, ContraAccountMapping> = {
  'Cash from Bank (Deposit)': { skr03: '1200', skr04: '1800', defaultVat: 0 },
  'Cash from Bank (Cash In / Inflow)': { skr03: '1200', skr04: '1800', defaultVat: 0 },
  'Cash to Bank (Withdrawal)': { skr03: '1200', skr04: '1800', defaultVat: 0 },
  'Cash to Bank (Cash Out / Outflow)': { skr03: '1200', skr04: '1800', defaultVat: 0 },
  'Cash Customer Invoice Receipt': { skr03: '8400', skr04: '4400', defaultVat: 19 },
  'Supplier Invoice Payment': { skr03: '1360', skr04: '1360', defaultVat: 0 },
  'Postage / Stamps': { skr03: '4910', skr04: '6800', defaultVat: 0 },
  'Shipping / Freight 19%': { skr03: '4730', skr04: '6740', defaultVat: 19 },
  'Office Materials 19%': { skr03: '4930', skr04: '6815', defaultVat: 19 },
  'Office Materials 7%': { skr03: '4930', skr04: '6815', defaultVat: 7 },
  'Other Costs 19%': { skr03: '4900', skr04: '6300', defaultVat: 19 },
  'Other Costs 7%': { skr03: '4900', skr04: '6300', defaultVat: 7 },
  'Hospitality 19%': { skr03: '4650', skr04: '6640', defaultVat: 19 },
  'Vehicle (Fuel, Washing) 19%': { skr03: '4530', skr04: '6530', defaultVat: 19 },
  'Travel Expenses 19%': { skr03: '4670', skr04: '6670', defaultVat: 19 },
  'Lottery Cash Deposit': { skr03: '1360', skr04: '1360', defaultVat: 0 }
};

export const STANDARD_DEFAULT_RULES = [
  'Cash from Bank (Deposit)',
  'Cash to Bank (Withdrawal)',
  'Cash Customer Invoice Receipt',
  'Supplier Invoice Payment',
  'Postage / Stamps',
  'Shipping / Freight 19%',
  'Office Materials 19%',
  'Office Materials 7%',
  'Other Costs 19%',
  'Other Costs 7%',
  'Hospitality 19%',
  'Vehicle (Fuel, Washing) 19%',
  'Travel Expenses 19%',
  'Lottery Cash Deposit'
];
