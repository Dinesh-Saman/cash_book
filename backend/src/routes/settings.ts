import { Router } from 'express';
import { Settings } from '../models/Settings';
import { authenticate, authorize } from '../middleware/auth';
import { recalculateBalancesFrom } from '../services/balanceService';
import { logAction } from '../services/auditService';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ openingBalance: 0, finalizedYears: [] });
    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
});

router.put('/', authorize('admin', 'accountant'), async (req: any, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({ finalizedYears: [] });

    const oldOpeningBalance = settings.openingBalance;
    Object.assign(settings, req.body);
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

export default router;
