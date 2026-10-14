import { CashBookEntry } from '../models/CashBookEntry';
import { Settings } from '../models/Settings';

export const VOUCHER_COLLATION = { locale: 'en', numericOrdering: true };

/**
 * Sequentially renumbers all active entries (1, 2, 3... N) in strict chronological
 * order (by date ascending, tie-breaking by createdAt and _id), and recalculates
 * the running cash balance from the opening balance.
 */
export async function renumberAndRecalculateBalances(): Promise<void> {
  const settings = (await Settings.findOne().select('openingBalance').lean()) || { openingBalance: 0 };
  let runningBalance = Number(settings.openingBalance) || 0;

  // Fetch all active entries sorted chronologically:
  // Primary: date ascending
  // Secondary: createdAt ascending, _id ascending
  const entries = await CashBookEntry.find({ isDeleted: false })
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .select('_id voucherNo type amount cashBalance')
    .lean();

  if (entries.length === 0) return;

  const bulkOps: any[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const newVoucherNo = String(i + 1);

    if (entry.type === 'income') {
      runningBalance += entry.amount;
    } else {
      runningBalance -= entry.amount;
    }

    const roundedBalance = Math.round(runningBalance * 100) / 100;

    const needsVoucherUpdate = entry.voucherNo !== newVoucherNo;
    const needsBalanceUpdate = entry.cashBalance !== roundedBalance;

    if (needsVoucherUpdate || needsBalanceUpdate) {
      bulkOps.push({
        updateOne: {
          filter: { _id: entry._id },
          update: {
            $set: {
              voucherNo: newVoucherNo,
              cashBalance: roundedBalance,
            },
          },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await CashBookEntry.bulkWrite(bulkOps, { ordered: true });
  }
}

export async function recalculateBalances(): Promise<void> {
  return renumberAndRecalculateBalances();
}

export async function recalculateBalancesFrom(_fromDate?: Date): Promise<void> {
  return renumberAndRecalculateBalances();
}

export async function getCurrentBalance(): Promise<number> {
  const settings = (await Settings.findOne().select('openingBalance').lean()) || { openingBalance: 0 };
  const latestEntry = await CashBookEntry.findOne({ isDeleted: false })
    .sort({ date: -1, createdAt: -1, _id: -1 })
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
  let runningBalance = Number(settings.openingBalance) || 0;

  const query: any = { isDeleted: false };
  if (excludeEntryId) {
    query._id = { $ne: excludeEntryId };
  }

  const allEntries = await CashBookEntry.find(query, { type: 1, amount: 1, date: 1, createdAt: 1 })
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean();

  const targetTime = new Date(entryDate).getTime();
  let balanceAtDate = runningBalance;
  let reachedDate = false;
  let minBalanceAfter = Infinity;

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const entryTime = new Date(entry.date).getTime();

    if (!reachedDate && entryTime > targetTime) {
      balanceAtDate = runningBalance;
      reachedDate = true;
    }

    if (entry.type === 'income') runningBalance += entry.amount;
    else runningBalance -= entry.amount;

    if (reachedDate || entryTime >= targetTime) {
      if (runningBalance < minBalanceAfter) {
        minBalanceAfter = runningBalance;
      }
    }
  }

  if (!reachedDate) {
    balanceAtDate = runningBalance;
  }

  const available = Math.max(0, Math.min(balanceAtDate, minBalanceAfter === Infinity ? balanceAtDate : minBalanceAfter));

  if (amount > available) {
    return {
      valid: false,
      availableBalance: Math.round(available * 100) / 100,
      reason: 'Insufficient balance for expense',
    };
  }

  return {
    valid: true,
    availableBalance: Math.round(available * 100) / 100,
  };
}
