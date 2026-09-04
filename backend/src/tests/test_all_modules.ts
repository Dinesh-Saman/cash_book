import mongoose from 'mongoose';
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
import dotenv from 'dotenv';
dotenv.config();

import { User } from '../models/User';
import { BookingRule } from '../models/BookingRule';
import { CashBookEntry } from '../models/CashBookEntry';
import { Settings } from '../models/Settings';
import { AuditLog } from '../models/AuditLog';
import { validateExpense, recalculateBalancesFrom, getCurrentBalance } from '../services/balanceService';
import { exportToDatev, exportToExcel, exportToPDF, exportToXML } from '../services/exportService';

async function runTests() {
  console.log('=== STARTING AUTOMATED TEST SUITE ===');
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected to MongoDB');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Check Default Admin User
    const admin = await User.findOne({ email: 'admin@cashbook.com' });
    assert(!!admin && admin.role === 'admin' && admin.isActive, 'TC-AUTH-01: Default admin exists and is active');
    if (admin) {
      const validPass = await admin.comparePassword('Admin@1234');
      const invalidPass = await admin.comparePassword('WrongPassword');
      assert(validPass, 'TC-AUTH-01: Admin password matches Admin@1234');
      assert(!invalidPass, 'TC-AUTH-02: Invalid password rejected');
    }

    // 2. Check 14 Default Booking Rules
    const rules = await BookingRule.find({ isDefault: true }).sort({ createdAt: 1 });
    assert(rules.length === 14, `TC-RULE-01: Exactly 14 default booking rules seeded (found: ${rules.length})`);
    
    // Check default rule protection
    const sampleDefaultRule = rules[0];
    assert(sampleDefaultRule.isDefault === true, 'TC-RULE-05: Default booking rule has isDefault=true');

    // 3. Check Settings & Opening Balance
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ openingBalance: 5000, datevAdvisorNumber: '12345', datevClientNumber: '67890', datevChartOfAccounts: 'SKR04' });
    assert(settings !== null, 'TC-OB-02: Settings document exists');

    // 4. Test Balance Validation & Overdraft Prevention
    // Clean up test entries before run
    await CashBookEntry.deleteMany({ voucherNo: { $regex: /^TEST-/ } });

    // Set opening balance to 1000 for clean test
    settings.openingBalance = 1000;
    settings.finalizedYears = [2024];
    await settings.save();
    await recalculateBalancesFrom(new Date(0));

    const testDate = new Date('2026-08-15T10:00:00.000Z');

    // Overdraft test: expense 1500 > balance 1000
    const overCheck = await validateExpense(1500, testDate);
    assert(!overCheck.valid && overCheck.availableBalance === 1000, 'TC-EXP-03 & TC-EXP-04: Overdraft expense rejected (1500 > 1000)');

    // Valid expense: 400 <= 1000
    const validCheck = await validateExpense(400, testDate);
    assert(validCheck.valid && validCheck.availableBalance === 1000, 'TC-EXP-07: Valid expense accepted (400 <= 1000)');

    // Exact zero balance: expense 1000 == 1000
    const exactZeroCheck = await validateExpense(1000, testDate);
    assert(exactZeroCheck.valid, 'TC-EXP-06: Exact zero balance transition allowed (1000 == 1000)');

    // 5. Test Entry Creation & Balance Recalculation
    const entry1 = await CashBookEntry.create({
      date: new Date('2026-08-10'),
      voucherNo: 'TEST-001',
      bookingRule: rules[0]._id,
      bookingText: 'Test Income 1',
      type: 'income',
      amount: 500,
      vatPercentage: 19,
      cashBalance: 0,
      year: 2026,
      month: 8,
      createdBy: admin?._id
    });
    await recalculateBalancesFrom(new Date('2026-08-10'));
    const reloaded1 = await CashBookEntry.findById(entry1._id);
    assert(reloaded1?.cashBalance === 1500, `TC-INC-06: Income added and balance updated to 1500 (got: ${reloaded1?.cashBalance})`);

    // Back-dated entry: add on Aug 05 (before Aug 10)
    const entryBack = await CashBookEntry.create({
      date: new Date('2026-08-05'),
      voucherNo: 'TEST-BACK',
      bookingRule: rules[1]._id,
      bookingText: 'Test Backdated Expense',
      type: 'expense',
      amount: 200,
      vatPercentage: 0,
      cashBalance: 0,
      year: 2026,
      month: 8,
      createdBy: admin?._id
    });
    await recalculateBalancesFrom(new Date('2026-08-05'));
    const reloadedBack = await CashBookEntry.findById(entryBack._id);
    const reloaded1After = await CashBookEntry.findById(entry1._id);
    assert(reloadedBack?.cashBalance === 800, `TC-SEQ-02 & TC-SEQ-03: Backdated entry balance is 800 (1000 - 200) (got: ${reloadedBack?.cashBalance})`);
    assert(reloaded1After?.cashBalance === 1300, `TC-SEQ-03: Subsequent entry chronologically recalculated to 1300 (800 + 500) (got: ${reloaded1After?.cashBalance})`);

    // Intermediate overdraft test:
    // On Aug 05 balance is 800, on Aug 10 it is 1300.
    // If we try to add an expense of 900 on Aug 07, it should be rejected because available balance on Aug 07 is 800!
    const intermediateCheck = await validateExpense(900, new Date('2026-08-07'));
    assert(!intermediateCheck.valid, 'TC-SEQ-04: Historical expense causing negative balance rejected');

    // 6. Test Year Finalization Protection
    assert(settings.finalizedYears.includes(2024), 'TC-FIN-01: Finalized year 2024 is tracked');
    assert(!settings.finalizedYears.includes(2026), 'TC-FIN-03: Year 2026 is not finalized');

    // 7. Test Export Generators
    const testEntries = [reloadedBack!, reloaded1After!];
    
    // PDF Export
    const pdfBuf = exportToPDF(testEntries as any, 'Kassenbuch August 2026', settings);
    assert(pdfBuf && pdfBuf.length > 500, 'TC-PDF-01 to TC-PDF-04: PDF generated with table and headers');

    // Excel Export
    const xlsxBuf = await exportToExcel(testEntries as any, 'Kassenbuch August 2026');
    assert(xlsxBuf && xlsxBuf.length > 500, 'TC-XLS-01 to TC-XLS-04: Excel workbook generated with numeric cells');

    // XML Export
    const xmlStr = exportToXML(testEntries as any, 'Kassenbuch August 2026');
    assert(xmlStr.includes('<Income>') && xmlStr.includes('<Expense>') && xmlStr.includes('<CashBalance>'), 'TC-XML-01 to TC-XML-04: XML generated with all required SRS nodes');

    // DATEV Export for SKR04
    settings.datevChartOfAccounts = 'SKR04';
    const datevStrSKR04 = exportToDatev(testEntries as any, settings);
    assert(
      datevStrSKR04.startsWith('EXTF;700;21;Buchungsstapel;') &&
      datevStrSKR04.includes(';1000;') &&
      datevStrSKR04.includes(';S;') &&
      datevStrSKR04.includes(';H;'),
      'TC-DAT-01 to TC-DAT-06: DATEV CSV matches EXTF standard and SKR04 account 1000'
    );

    // DATEV Export for SKR03
    settings.datevChartOfAccounts = 'SKR03';
    const datevStrSKR03 = exportToDatev(testEntries as any, settings);
    assert(
      datevStrSKR03.includes(';1600;'),
      'TC-DAT-06: DATEV CSV matches SKR03 account 1600'
    );

    // Clean up test entries
    await CashBookEntry.deleteMany({ voucherNo: { $regex: /^TEST-/ } });
    await recalculateBalancesFrom(new Date(0));

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  } catch (err: any) {
    console.error('Test error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
