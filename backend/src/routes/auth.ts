import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User, getDefaultPermissions } from '../models/User';
import { authenticate, authorize } from '../middleware/auth';
import { logAction } from '../services/auditService';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'Ihr Konto wurde von einem Administrator deaktiviert. Bitte wenden Sie sich an Ihren Administrator. / Your account has been disabled by an administrator. Please contact your administrator.'
      });
    }

    const secret = process.env.JWT_SECRET || 'secret';
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as any;
    const token = jwt.sign({ id: user._id }, secret, { expiresIn });

    // Log user login in audit trail
    await logAction({
      action: 'LOGIN',
      entityType: 'user',
      entityId: user._id.toString(),
      description: `User ${user.email} successfully logged in`,
      performedBy: user._id.toString() as any
    });

    const userPerms = (user.permissions && typeof (user.permissions as any).toObject === 'function')
      ? (user.permissions as any).toObject()
      : (user.permissions || {});
    const permissions = {
      ...getDefaultPermissions(user.role),
      ...userPerms,
    };

    res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          permissions
        }
      }
    });
  } catch (error) { next(error); }
});

router.post('/register', authenticate, authorize('admin'), async (req: any, res, next) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    const assignedPermissions = {
      ...getDefaultPermissions(role || 'viewer'),
      ...(permissions || {}),
    };
    const user = await User.create({ name, email, password, role, permissions: assignedPermissions });
    await logAction({
      action: 'CREATE',
      entityType: 'user',
      entityId: user._id.toString(),
      description: `Created user ${email} (${role})`,
      performedBy: req.user._id
    });
    res.json({ success: true, data: user });
  } catch (error) { next(error); }
});

router.get('/me', authenticate, (req: any, res) => {
  const userObj = req.user.toObject ? req.user.toObject() : { ...req.user };
  delete userObj.password;
  userObj.permissions = {
    ...getDefaultPermissions(userObj.role),
    ...(userObj.permissions || {}),
  };
  res.json({ success: true, data: userObj });
});

router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

export default router;
