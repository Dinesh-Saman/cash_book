import { Router } from 'express';
import { User, getDefaultPermissions } from '../models/User';
import { authenticate, authorize } from '../middleware/auth';
import { logAction } from '../services/auditService';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const usersWithPermissions = users.map((u) => {
      const obj = u.toObject() as any;
      obj.permissions = {
        ...getDefaultPermissions(obj.role),
        ...(obj.permissions || {}),
      };
      return obj;
    });
    res.json({ success: true, data: usersWithPermissions });
  } catch (error) { next(error); }
});

router.post('/', async (req: any, res, next) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ein Benutzer mit dieser E-Mail existiert bereits. / Email already in use.' });
    }

    const assignedPermissions = {
      ...getDefaultPermissions(role || 'viewer'),
      ...(permissions || {}),
    };

    const user = await User.create({
      name,
      email,
      password,
      role,
      permissions: assignedPermissions,
    });

    await logAction({
      action: 'CREATE',
      entityType: 'user',
      entityId: user._id.toString(),
      description: `Created user ${email} (${role}) with custom permissions`,
      performedBy: req.user._id
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        permissions: user.permissions
      }
    });
  } catch (error) { next(error); }
});

router.put('/:id', async (req: any, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;
    if (req.body.role) user.role = req.body.role;
    if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
    if (req.body.permissions) {
      const existingPerms = (user.permissions && typeof (user.permissions as any).toObject === 'function')
        ? (user.permissions as any).toObject()
        : (user.permissions || getDefaultPermissions(user.role));

      user.permissions = {
        ...getDefaultPermissions(req.body.role || user.role),
        ...existingPerms,
        ...req.body.permissions,
      };
      user.markModified('permissions');
    }
    if (req.body.password && req.body.password.trim()) {
      user.password = req.body.password;
    }

    await user.save();

    await logAction({
      action: 'UPDATE',
      entityType: 'user',
      entityId: user._id.toString(),
      description: `Updated user profile/permissions for ${user.email}`,
      performedBy: req.user._id
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        permissions: user.permissions
      }
    });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req: any, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = false;
    await user.save();

    await logAction({
      action: 'DELETE',
      entityType: 'user',
      entityId: user._id.toString(),
      description: `Deactivated user ${user.email}`,
      performedBy: req.user._id
    });

    res.json({ success: true, data: user });
  } catch (error) { next(error); }
});

export default router;
