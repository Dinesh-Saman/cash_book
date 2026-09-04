import { Router } from 'express';
import { BookingRule } from '../models/BookingRule';
import { authenticate, authorize } from '../middleware/auth';
import { logAction } from '../services/auditService';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const rules = await BookingRule.find({ isActive: true });
    res.json({ success: true, data: rules });
  } catch (error) { next(error); }
});

router.post('/', authorize('admin', 'accountant'), async (req: any, res, next) => {
  try {
    const { name, defaultVat } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Rule name is required' });
    }
    const parsedVat = [0, 7, 19].includes(Number(defaultVat)) ? Number(defaultVat) : 0;
    const rule = await BookingRule.create({
      name: name.trim(),
      defaultVat: parsedVat,
      createdBy: req.user._id,
    });

    await logAction({
      action: 'CREATE',
      entityType: 'booking_rule',
      entityId: rule._id.toString(),
      description: `Created booking rule "${rule.name}" (${parsedVat}% VAT)`,
      performedBy: req.user._id,
    });

    res.json({ success: true, data: rule });
  } catch (error) { next(error); }
});

router.put('/:id', authorize('admin'), async (req: any, res, next) => {
  try {
    const { name, defaultVat } = req.body;
    const rule = await BookingRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });

    if (name) rule.name = name.trim();
    if (defaultVat !== undefined && [0, 7, 19].includes(Number(defaultVat))) {
      rule.defaultVat = Number(defaultVat) as 0 | 7 | 19;
    }
    await rule.save();

    await logAction({
      action: 'UPDATE',
      entityType: 'booking_rule',
      entityId: rule._id.toString(),
      description: `Updated booking rule "${rule.name}" (${rule.defaultVat ?? 0}% VAT)`,
      performedBy: req.user._id,
    });

    res.json({ success: true, data: rule });
  } catch (error) { next(error); }
});

router.delete('/:id', authorize('admin'), async (req: any, res, next) => {
  try {
    const rule = await BookingRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: 'Rule not found' });
    
    if (rule.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Standard-Buchungsregeln können nicht gelöscht werden / Default booking rules cannot be deleted.'
      });
    }

    rule.isActive = false;
    await rule.save();

    await logAction({
      action: 'DELETE',
      entityType: 'booking_rule',
      entityId: rule._id.toString(),
      description: `Deleted booking rule "${rule.name}"`,
      performedBy: req.user._id,
    });

    res.json({ success: true, data: rule });
  } catch (error) { next(error); }
});

export default router;
