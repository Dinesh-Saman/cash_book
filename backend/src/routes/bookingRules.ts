import { Router } from 'express';
import { BookingRule } from '../models/BookingRule';
import { CashBookEntry } from '../models/CashBookEntry';
import { User } from '../models/User';
import { authenticate, authorize } from '../middleware/auth';
import { logAction } from '../services/auditService';
import { DEFAULT_CONTRA_ACCOUNTS, STANDARD_DEFAULT_RULES } from '../constants/defaultContraAccounts';

const router = Router();
router.use(authenticate);

// ─── Helper: get next unique rule number ─────────────────────────────────────

async function getNextRuleNumber(): Promise<number> {
  const last = await BookingRule.findOne({ ruleNumber: { $exists: true, $ne: null } })
    .sort({ ruleNumber: -1 })
    .lean();
  return (last?.ruleNumber ?? 0) + 1;
}

/**
 * Ensures all existing rules without a ruleNumber or contra-accounts are backfilled.
 * Called on GET / so existing database rules get numbered and assigned DATEV accounts.
 */
async function backfillRuleNumbers(): Promise<void> {
  // 1. Backfill ruleNumber if missing
  const unassigned = await BookingRule.find({
    isActive: true,
    $or: [{ ruleNumber: { $exists: false } }, { ruleNumber: null }],
  }).sort({ createdAt: 1 });

  if (unassigned.length > 0) {
    const last = await BookingRule.findOne({ ruleNumber: { $exists: true, $ne: null } })
      .sort({ ruleNumber: -1 })
      .lean();
    let next = (last?.ruleNumber ?? 0) + 1;

    for (const rule of unassigned) {
      rule.ruleNumber = next++;
      await rule.save();
    }
  }

  // 2. Backfill accounts if missing
  const missingAccounts = await BookingRule.find({
    isActive: true,
    $or: [
      { accountSKR03: { $exists: false } },
      { accountSKR03: '' },
      { accountSKR04: { $exists: false } },
      { accountSKR04: '' },
    ],
  });

  for (const rule of missingAccounts) {
    const defaultMapping = DEFAULT_CONTRA_ACCOUNTS[rule.name];
    let changed = false;
    if (!rule.accountSKR03) {
      rule.accountSKR03 = defaultMapping?.skr03 || '1360';
      changed = true;
    }
    if (!rule.accountSKR04) {
      rule.accountSKR04 = defaultMapping?.skr04 || '1360';
      changed = true;
    }
    if (changed) {
      await rule.save();
    }
  }
}

// ─── GET / ───────────────────────────────────────────────────────────────────

router.get('/', async (req: any, res, next) => {
  try {
    let rules = await BookingRule.find({ isActive: true }).sort({ ruleNumber: 1 });
    if (rules.length === 0) {
      const admin = await User.findOne({ role: 'admin' });
      let ruleNum = 1;
      for (const ruleName of STANDARD_DEFAULT_RULES) {
        const mapping = DEFAULT_CONTRA_ACCOUNTS[ruleName];
        await BookingRule.create({
          ruleNumber: ruleNum++,
          name: ruleName,
          isDefault: true,
          defaultVat: mapping?.defaultVat ?? 0,
          accountSKR03: mapping?.skr03 ?? '1360',
          accountSKR04: mapping?.skr04 ?? '1360',
          createdBy: admin?._id || req.user?._id,
        });
      }
      rules = await BookingRule.find({ isActive: true }).sort({ ruleNumber: 1 });
    } else {
      await backfillRuleNumbers();
      rules = await BookingRule.find({ isActive: true }).sort({ ruleNumber: 1 });
    }
    res.json({ success: true, data: rules });
  } catch (error) { next(error); }
});

// ─── POST / ──────────────────────────────────────────────────────────────────

router.post('/', authorize('admin', 'accountant'), async (req: any, res, next) => {
  try {
    const { name, defaultVat, accountSKR03, accountSKR04 } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Rule name is required' });
    }
    const parsedVat = [0, 7, 19].includes(Number(defaultVat)) ? Number(defaultVat) : 0;
    const ruleNumber = await getNextRuleNumber();

    const trimmedName = name.trim();
    const defaultMapping = DEFAULT_CONTRA_ACCOUNTS[trimmedName];
    const skr03 = accountSKR03 ? String(accountSKR03).trim() : (defaultMapping?.skr03 || '1360');
    const skr04 = accountSKR04 ? String(accountSKR04).trim() : (defaultMapping?.skr04 || '1360');

    const rule = await BookingRule.create({
      ruleNumber,
      name: trimmedName,
      defaultVat: parsedVat,
      accountSKR03: skr03,
      accountSKR04: skr04,
      createdBy: req.user._id,
    });

    await logAction({
      action: 'CREATE',
      entityType: 'booking_rule',
      entityId: rule._id.toString(),
      description: `Created booking rule #${ruleNumber} "${rule.name}" (${parsedVat}% VAT, SKR03: ${skr03}, SKR04: ${skr04})`,
      performedBy: req.user._id,
    });

    res.json({ success: true, data: rule });
  } catch (error) { next(error); }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────
// ruleNumber is NEVER updated — it is immutable once assigned.

router.put('/:id', authorize('admin'), async (req: any, res, next) => {
  try {
    const { name, defaultVat, accountSKR03, accountSKR04 } = req.body;
    const rule = await BookingRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

    // Only allow name, defaultVat, accountSKR03, accountSKR04 to be changed — ruleNumber is immutable
    if (name) rule.name = name.trim();
    if (defaultVat !== undefined && [0, 7, 19].includes(Number(defaultVat))) {
      rule.defaultVat = Number(defaultVat) as 0 | 7 | 19;
    }
    if (accountSKR03 !== undefined) {
      rule.accountSKR03 = String(accountSKR03).trim();
    }
    if (accountSKR04 !== undefined) {
      rule.accountSKR04 = String(accountSKR04).trim();
    }
    await rule.save();

    await logAction({
      action: 'UPDATE',
      entityType: 'booking_rule',
      entityId: rule._id.toString(),
      description: `Updated booking rule #${rule.ruleNumber} "${rule.name}" (${rule.defaultVat ?? 0}% VAT, SKR03: ${rule.accountSKR03}, SKR04: ${rule.accountSKR04})`,
      performedBy: req.user._id,
    });

    res.json({ success: true, data: rule });
  } catch (error) { next(error); }
});

// ─── DELETE /:id ─────────────────────────────────────────────────────────────

router.delete('/:id', authorize('admin'), async (req: any, res, next) => {
  try {
    const rule = await BookingRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

    const lang = req.headers['accept-language']?.toLowerCase().startsWith('en') ? 'en' : 'de';
    if (rule.isDefault) {
      return res.status(400).json({
        success: false,
        message:
          lang === 'de'
            ? 'Standard-Buchungsregeln können nicht gelöscht werden.'
            : 'Default booking rules cannot be deleted.',
      });
    }

    const inUse = await CashBookEntry.countDocuments({ bookingRule: rule._id, isDeleted: false });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message:
          lang === 'de'
            ? `Diese Buchungsregel wird in ${inUse} Einträgen verwendet und kann nicht gelöscht werden.`
            : `This booking rule is used in ${inUse} entries and cannot be deleted.`,
      });
    }

    rule.isActive = false;
    await rule.save();

    await logAction({
      action: 'DELETE',
      entityType: 'booking_rule',
      entityId: rule._id.toString(),
      description: `Deleted booking rule #${rule.ruleNumber} "${rule.name}"`,
      performedBy: req.user._id,
    });

    res.json({ success: true, message: 'Booking rule deleted successfully' });
  } catch (error) { next(error); }
});

export default router;
