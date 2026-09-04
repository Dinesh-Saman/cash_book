import { Router } from 'express';
import { CashBookEntry } from '../models/CashBookEntry';
import { Settings } from '../models/Settings';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/monthly', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const numYear = Number(year);
    const numMonth = Number(month);

    const firstDayOfMonth = new Date(numYear, numMonth - 1, 1);
    const settings = await Settings.findOne() || await Settings.create({ openingBalance: 0 });

    // Prior entry before this month to get start balance
    const priorEntry = await CashBookEntry.findOne({
      date: { $lt: firstDayOfMonth },
      isDeleted: false
    }).sort({ date: -1, createdAt: -1 });

    const startBalance = priorEntry ? priorEntry.cashBalance : settings.openingBalance;

    const entries = await CashBookEntry
      .find({ year: numYear, month: numMonth, isDeleted: false })
      .populate('bookingRule')
      .sort({ date: 1, createdAt: 1 });

    const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const endBalance = entries.length > 0 ? entries[entries.length - 1].cashBalance : startBalance;

    res.json({
      success: true,
      data: {
        entries,
        startBalance,
        totalIncome,
        totalExpense,
        endBalance,
        isFinalized: settings.finalizedYears?.includes(numYear) || false
      }
    });
  } catch (error) { next(error); }
});

router.get('/annual', async (req, res, next) => {
  try {
    const { year } = req.query;
    const numYear = Number(year);
    const settings = await Settings.findOne() || await Settings.create({ openingBalance: 0 });

    const entries = await CashBookEntry
      .find({ year: numYear, isDeleted: false })
      .populate('bookingRule')
      .sort({ date: 1, createdAt: 1 });

    // Group by month
    const byMonth: Record<number, typeof entries> = {};
    for (const entry of entries) {
      const m = entry.month;
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(entry);
    }

    const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

    res.json({
      success: true,
      data: {
        byMonth,
        totalIncome,
        totalExpense,
        entries,
        isFinalized: settings.finalizedYears?.includes(numYear) || false
      }
    });
  } catch (error) { next(error); }
});

router.get('/months', async (req, res, next) => {
  try {
    const result = await CashBookEntry.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: { year: '$year', month: '$month' } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);
    res.json({ success: true, data: result.map(r => r._id) });
  } catch (error) { next(error); }
});

export default router;
