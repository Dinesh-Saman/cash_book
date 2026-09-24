import dns from 'dns';
import dotenv from 'dotenv';
dotenv.config();

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

import mongoose from 'mongoose';
import { CashBookEntry } from '../models/CashBookEntry';
import { Settings } from '../models/Settings';
import { exportToDatev } from '../services/exportService';
import fs from 'fs';

async function testExport() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cashbook';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const settings = (await Settings.findOne()) || (await Settings.create({ openingBalance: 0 }));
  // Test with valid settings:
  settings.datevAdvisorNumber = '1001';
  settings.datevClientNumber = '10001';
  settings.datevChartOfAccounts = 'SKR03';

  const entries = await CashBookEntry.find({ isDeleted: false })
    .populate('bookingRule')
    .sort({ date: 1, createdAt: 1 });

  console.log(`Found ${entries.length} entries.`);
  const buffer = exportToDatev(entries, settings, 2026);

  const outPath = 'D:\\Uvexzon\\Cash_Book_Management_System\\scratch_real_entries_datev.csv';
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote DATEV export to ${outPath}`);

  await mongoose.disconnect();
}

testExport().catch(err => {
  console.error(err);
  process.exit(1);
});
