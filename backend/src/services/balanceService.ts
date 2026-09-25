import { CashBookEntry } from '../models/CashBookEntry';
import { Settings } from '../models/Settings';

export async function recalculateBalancesFrom(fromDate: Date): Promise<void> {
  const settings = (await Settings.findOne().select('openingBalance').lean()) || { openingBalance: 0 };

  // Find the single previous entry before fromDate to get starting runningBalance
  const prevEntry = await CashBookEntry.findOne({
    date: { $lt: fromDate },
    isDeleted: false,
  })
    .sort({ date: -1, createdAt: -1 })
    .select('cashBalance')
    .lean();

  let runningBalance = prevEntry ? prevEntry.cashBalance : (settings.openingBalance || 0);

  // Fetch only the entries that need recalculation using lean projection
  const entriesToUpdate = await CashBookEntry.find({
    date: { $gte: fromDate },
    isDeleted: false,
  })
    .sort({ date: 1, createdAt: 1 })
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

export async function getCurrentBalance(): Promise<number> {
  const settings = (await Settings.findOne().select('openingBalance').lean()) || { openingBalance: 0 };
  const latestEntry = await CashBookEntry.findOne({ isDeleted: false })
    .sort({ date: -1, createdAt: -1 })
    .select('cashBalance')
    .lean();

  return latestEntry ? latestEntry.cashBalance : (settings.openingBalance || 0);
}

export async function validateExpense(
  amount: number,
  entryDate: Date,
  excludeEntryId?: string
): Promise<{ valid: boolean; availableBalance: number; reason?: string }> {
  const settings = (await Settings.findOne().select('openingBalance').lean()) || { openingBalance: 0 };
  let runningBalance = settings.openingBalance || 0;

  const query: any = { isDeleted: false };
  if (excludeEntryId) {
    query._id = { $ne: excludeEntryId };
  }

  // Use projection and lean for lightning-fast retrieval
  const allEntries = await CashBookEntry.find(query, { type: 1, amount: 1, date: 1 })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  let balanceAtEntryDate = settings.openingBalance || 0;
  let minFutureBalance = Infinity;

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const d = new Date(entry.date);
    if (d <= entryDate) {
      if (entry.type === 'income') runningBalance += entry.amount;
      else runningBalance -= entry.amount;
      balanceAtEntryDate = runningBalance;
    } else {
      if (entry.type === 'income') runningBalance += entry.amount;
      else runningBalance -= entry.amount;
      if (runningBalance < minFutureBalance) {
        minFutureBalance = runningBalance;
      }
    }
  }

  const maxAvailable = Math.min(
    balanceAtEntryDate,
    minFutureBalance === Infinity ? balanceAtEntryDate : minFutureBalance
  );

  if (balanceAtEntryDate < amount) {
    return {
      valid: false,
      availableBalance: Math.max(0, balanceAtEntryDate),
      reason: 'Insufficient balance at entry date',
    };
  }

  if (minFutureBalance < amount) {
    return {
      valid: false,
      availableBalance: Math.max(0, minFutureBalance),
      reason: 'Expense would cause a future cash balance to become negative',
    };
  }

  return {
    valid: true,
    availableBalance: Math.max(0, maxAvailable),
  };
}
