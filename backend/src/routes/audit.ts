import { Router } from 'express';
import { AuditLog } from '../models/AuditLog';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, authorize('admin'), async (req: any, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 25);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find()
        .sort({ performedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('performedBy', 'name email'),
      AuditLog.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) { next(error); }
});

export default router;
