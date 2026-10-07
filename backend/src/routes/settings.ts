import { Router } from 'express';
import { Settings } from '../models/Settings';
import { authenticate, authorize } from '../middleware/auth';
import { getDefaultPermissions } from '../models/User';
import { recalculateBalancesFrom } from '../services/balanceService';
import { logAction } from '../services/auditService';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ openingBalance: 0, cashAccount: '1000', finalizedYears: [] });
    } else if (!settings.cashAccount) {
      settings.cashAccount = '1000';
      await settings.save();
    }
    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
});

router.put('/', async (req: any, res, next) => {
  try {
    const userPerms = req.user?.permissions || getDefaultPermissions(req.user?.role || 'viewer');
    if (req.user?.role !== 'admin' && !userPerms.canManageSettings) {
      return res.status(403).json({
        success: false,
        message: 'Keine Berechtigung zum Verwalten der Einstellungen. / Not permitted to manage settings.'
      });
    }
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ cashAccount: '1000', finalizedYears: [] });

    const oldOpeningBalance = settings.openingBalance;
    const oldCashAccount = settings.cashAccount;
    Object.assign(settings, req.body);
    if (!settings.cashAccount) {
      settings.cashAccount = '1000';
    }
    await settings.save();

    if (req.body.openingBalance !== undefined && req.body.openingBalance !== oldOpeningBalance) {
      await recalculateBalancesFrom(new Date(0));
      await logAction({
        action: 'UPDATE',
        entityType: 'settings',
        entityId: settings._id.toString(),
        description: `Updated opening balance to € ${Number(req.body.openingBalance).toFixed(2)}`,
        performedBy: req.user._id
      });
    }

    if (req.body.cashAccount !== undefined && req.body.cashAccount !== oldCashAccount) {
      await logAction({
        action: 'UPDATE',
        entityType: 'settings',
        entityId: settings._id.toString(),
        description: `Updated cash account (Konto) to ${req.body.cashAccount}`,
        performedBy: req.user._id
      });
    }

    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
});

router.post('/finalize-year', authorize('admin'), async (req: any, res, next) => {
  try {
    const { year, action } = req.body; // action: 'finalize' | 'unlock'
    const numYear = Number(year);
    if (!numYear) return res.status(400).json({ success: false, message: 'Valid year is required' });

    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ finalizedYears: [] });

    const set = new Set(settings.finalizedYears || []);
    if (action === 'unlock') {
      set.delete(numYear);
      await logAction({
        action: 'UPDATE',
        entityType: 'year',
        entityId: String(numYear),
        description: `Unlocked fiscal year ${numYear}`,
        performedBy: req.user._id
      });
    } else {
      set.add(numYear);
      await logAction({
        action: 'FINALIZE',
        entityType: 'year',
        entityId: String(numYear),
        description: `Finalized and locked fiscal year ${numYear}`,
        performedBy: req.user._id
      });
    }

    settings.finalizedYears = Array.from(set).sort((a, b) => a - b);
    await settings.save();

    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
});

const handleMonthLockUnlock = async (req: any, res: any, next: any) => {
  try {
    const { year, month, action } = req.body; // action: 'unlock' | 'lock'
    const numYear = Number(year);
    const numMonth = Number(month);
    if (!numYear || !numMonth || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({ success: false, message: 'Valid year and month (1-12) are required' });
    }

    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ finalizedYears: [], lockedMonths: [], unlockedMonths: [] });

    const monthKey = `${numYear}-${String(numMonth).padStart(2, '0')}`;
    const unlockedSet = new Set(settings.unlockedMonths || []);
    const lockedSet = new Set(settings.lockedMonths || []);

    if (action === 'lock') {
      unlockedSet.delete(monthKey);
      lockedSet.add(monthKey);
      await logAction({
        action: 'FINALIZE',
        entityType: 'month',
        entityId: monthKey,
        description: `Locked month ${String(numMonth).padStart(2, '0')}/${numYear}`,
        performedBy: req.user._id
      });
    } else {
      lockedSet.delete(monthKey);
      unlockedSet.add(monthKey);
      await logAction({
        action: 'UPDATE',
        entityType: 'month',
        entityId: monthKey,
        description: `Unlocked month ${String(numMonth).padStart(2, '0')}/${numYear}`,
        performedBy: req.user._id
      });
    }

    settings.unlockedMonths = Array.from(unlockedSet).sort();
    settings.lockedMonths = Array.from(lockedSet).sort();
    await settings.save();

    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
};

router.post('/lock-month', authorize('admin'), handleMonthLockUnlock);
router.post('/unlock-month', authorize('admin'), handleMonthLockUnlock);

export default router;
