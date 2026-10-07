import { CashBookEntry } from '../models/CashBookEntry';
import { Settings } from '../models/Settings';

export const VOUCHER_COLLATION = { locale: 'en', numericOrdering: true };

export async function recalculateBalances(): Promise<void> {
  const settings = (await Settings.findOne().select('openingBalance').lean()) || { openingBalance: 0 };
  let runningBalance = settings.openingBalance || 0;

  // Fetch all active entries sorted by voucher number ascending, then date ascending
  const entriesToUpdate = await CashBookEntry.find({ isDeleted: false })
    .collation(VOUCHER_COLLATION)
    .sort({ voucherNo: 1, date: 1, createdAt: 1 })
    .select('_id type amount cashBalance')
    .lean();

  if (entriesToUpdate.length === 0) return;

  const bulkOps: any[] = [];
  for (let i = 0; i < entriesToUpdate.length; i++) {
    const entry = entriesToUpdate[i];
    if (entry.type === 'income') runningBalance += entry.amount;
    else runningBalance -= entry.amount;

    if (entry.cashBalance !== runningBalance) {
      bulkOps.push({
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: { cashBalance: runningBalance } },
        },
      });
    }
  }

  // Update all modified entries in a single network roundtrip
  if (bulkOps.length > 0) {
    await CashBookEntry.bulkWrite(bulkOps, { ordered: true });
  }
}

export async function recalculateBalancesFrom(_fromDate?: Date): Promise<void> {
  return recalculateBalances();
}

export async function getCurrentBalance(): Promise<number> {
  const settings = (await Settings.findOne().select('openingBalance').lean()) || { openingBalance: 0 };
  const latestEntry = await CashBookEntry.findOne({ isDeleted: false })
    .collation(VOUCHER_COLLATION)
    .sort({ voucherNo: -1, date: -1, createdAt: -1 })
    .select('cashBalance')
    .lean();

  return latestEntry ? latestEntry.cashBalance : (settings.openingBalance || 0);
}

export async function validateExpense(
  amount: number,
  _entryDate: Date,
  excludeEntryId?: string
): Promise<{ valid: boolean; availableBalance: number; reason?: string }> {
  const settings = (await Settings.findOne().select('openingBalance').lean()) || { openingBalance: 0 };
  let runningBalance = settings.openingBalance || 0;

  const query: any = { isDeleted: false };
  if (excludeEntryId) {
    query._id = { $ne: excludeEntryId };
  }

  // Use projection, lean, and voucher collation
  const allEntries = await CashBookEntry.find(query, { type: 1, amount: 1, date: 1, voucherNo: 1 })
    .collation(VOUCHER_COLLATION)
    .sort({ voucherNo: 1, date: 1, createdAt: 1 })
    .lean();

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    if (entry.type === 'income') runningBalance += entry.amount;
    else runningBalance -= entry.amount;
  }

  if (runningBalance < amount) {
    return {
      valid: false,
      availableBalance: Math.max(0, runningBalance),
      reason: 'Insufficient balance for expense',
    };
  }

  return {
    valid: true,
    availableBalance: Math.max(0, runningBalance),
  };
}
