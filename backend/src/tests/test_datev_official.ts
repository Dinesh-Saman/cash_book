import fs from 'fs';
import { exportToDatev } from '../services/exportService';
import { ICashBookEntry } from '../models/CashBookEntry';
import { ISettings } from '../models/Settings';

const testSettingsSKR03: ISettings = {
  openingBalance: 1000,
  datevAdvisorNumber: '1001',
  datevClientNumber: '10001',
  datevChartOfAccounts: 'SKR03',
  isYearFinalized: false,
  finalizedYears: []
} as any;

const testSettingsSKR04: ISettings = {
  openingBalance: 1000,
  datevAdvisorNumber: '2468',
  datevClientNumber: '99999',
  datevChartOfAccounts: 'SKR04',
  isYearFinalized: false,
  finalizedYears: []
} as any;

const sampleRules = [
  { name: 'Cash from Bank (Deposit)', accountSKR03: '1200', accountSKR04: '1800' },
  { name: 'Cash to Bank (Withdrawal)', accountSKR03: '1200', accountSKR04: '1800' },
  { name: 'Cash Customer Invoice Receipt', accountSKR03: '8400', accountSKR04: '4400' },
  { name: 'Supplier Invoice Payment', accountSKR03: '1360', accountSKR04: '1360' },
  { name: 'Postage / Stamps', accountSKR03: '4910', accountSKR04: '6800' },
  { name: 'Shipping / Freight 19%', accountSKR03: '4730', accountSKR04: '6740' },
  { name: 'Office Materials 19%', accountSKR03: '4930', accountSKR04: '6815' },
  { name: 'Office Materials 7%', accountSKR03: '4930', accountSKR04: '6815' },
  { name: 'Other Costs 19%', accountSKR03: '4900', accountSKR04: '6300' },
  { name: 'Hospitality 19%', accountSKR03: '4650', accountSKR04: '6640' },
  { name: 'Vehicle (Fuel, Washing) 19%', accountSKR03: '4530', accountSKR04: '6530' },
  { name: 'Travel Expenses 19%', accountSKR03: '4670', accountSKR04: '6670' },
  { name: 'Lottery Cash Deposit', accountSKR03: '1360', accountSKR04: '1360' },
];

const mockEntries: ICashBookEntry[] = sampleRules.map((r, idx) => ({
  date: new Date(2026, 8, idx + 1), // Sept 1..13, 2026
  voucherNo: `V-${idx + 1}`,
  bookingRule: r as any,
  bookingText: `Test Buchung: ${r.name} - Äpfel & Öl`,
  type: idx % 2 === 0 ? 'income' : 'expense',
  amount: (idx + 1) * 25.5,
  vatPercentage: 19,
  cashBalance: 1000 + (idx * 10),
  documents: [],
  isDeleted: false,
  year: 2026,
  month: 9
} as any));

// 1. Generate SKR03 file
const skr03Buffer = exportToDatev(mockEntries, testSettingsSKR03, 2026, 9);
const skr03Path = 'D:\\Uvexzon\\Cash_Book_Management_System\\scratch_test_skr03.csv';
fs.writeFileSync(skr03Path, skr03Buffer);
console.log(`Saved SKR03 DATEV export to ${skr03Path} (${skr03Buffer.length} bytes)`);

// 2. Generate SKR04 file
const skr04Buffer = exportToDatev(mockEntries, testSettingsSKR04, 2026, 9);
const skr04Path = 'D:\\Uvexzon\\Cash_Book_Management_System\\scratch_test_skr04.csv';
fs.writeFileSync(skr04Path, skr04Buffer);
console.log(`Saved SKR04 DATEV export to ${skr04Path} (${skr04Buffer.length} bytes)`);

console.log('Generated test DATEV exports successfully.');
