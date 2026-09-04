import { CashBookEntry } from '../models/CashBookEntry';
import { Settings } from '../models/Settings';

export async function recalculateBalancesFrom(fromDate: Date): Promise<void> {
  const settings = await Settings.findOne() || await Settings.create({});
  let runningBalance = settings.openingBalance;

  const earlierEntries = await CashBookEntry.find({
    date: { $lt: fromDate },
    isDeleted: false
  }).sort({ date: 1, createdAt: 1 });

  for (const entry of earlierEntries) {
    if (entry.type === 'income') runningBalance += entry.amount;
    else runningBalance -= entry.amount;
  }

  const entriesToUpdate = await CashBookEntry.find({
    date: { $gte: fromDate },
    isDeleted: false
  }).sort({ date: 1, createdAt: 1 });

  for (const entry of entriesToUpdate) {
    if (entry.type === 'income') runningBalance += entry.amount;
    else runningBalance -= entry.amount;

    entry.cashBalance = runningBalance;
    await entry.save();
  }
}

export async function getCurrentBalance(): Promise<number> {
  const settings = await Settings.findOne() || await Settings.create({});
  const latestEntry = await CashBookEntry.findOne({ isDeleted: false })
    .sort({ date: -1, createdAt: -1 });

  return latestEntry ? latestEntry.cashBalance : settings.openingBalance;
}

export async function validateExpense(
  amount: number,
  entryDate: Date,
  excludeEntryId?: string
): Promise<{ valid: boolean; availableBalance: number; reason?: string }> {
  const settings = await Settings.findOne() || await Settings.create({});
  let runningBalance = settings.openingBalance;

  const query: any = { isDeleted: false };
  if (excludeEntryId) {
    query._id = { $ne: excludeEntryId };
  }

  const allEntries = await CashBookEntry.find(query).sort({ date: 1, createdAt: 1 });
  
  let balanceAtEntryDate = settings.openingBalance;
  let minFutureBalance = Infinity;

  for (const entry of allEntries) {
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

  const maxAvailable = Math.min(balanceAtEntryDate, minFutureBalance === Infinity ? balanceAtEntryDate : minFutureBalance);

  if (balanceAtEntryDate < amount) {
    return {
      valid: false,
      availableBalance: Math.max(0, balanceAtEntryDate),
      reason: 'Insufficient balance at entry date'
    };
  }

  if (minFutureBalance < amount) {
    return {
      valid: false,
      availableBalance: Math.max(0, minFutureBalance),
      reason: 'Expense would cause a future cash balance to become negative'
    };
  }

  return {
    valid: true,
    availableBalance: Math.max(0, maxAvailable)
  };
}
