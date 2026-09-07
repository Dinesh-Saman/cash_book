import { Router } from 'express';
import multer from 'multer';
import { CashBookEntry } from '../models/CashBookEntry';
import { Settings } from '../models/Settings';
import { getDefaultPermissions } from '../models/User';
import { authenticate } from '../middleware/auth';
import { validateExpense, recalculateBalancesFrom, getCurrentBalance } from '../services/balanceService';
import { logAction } from '../services/auditService';

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'));
  }
});

const router = Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { year, month, type, page = 1, limit = 50 } = req.query;
    const query: any = { isDeleted: false };
    if (year) query.year = Number(year);
    if (month) query.month = Number(month);
    if (type) query.type = type;

    const skip = (Number(page) - 1) * Number(limit);
    const entries = await CashBookEntry.find(query).populate('bookingRule').sort({ date: 1, createdAt: 1 }).skip(skip).limit(Number(limit));
    
    let totalIncome = 0;
    let totalExpense = 0;
    const allEntries = await CashBookEntry.find(query);
    allEntries.forEach(e => {
      if (e.type === 'income') totalIncome += e.amount;
      else totalExpense += e.amount;
    });

    const currentBalance = await getCurrentBalance();

    res.json({ success: true, data: { entries, totalIncome, totalExpense, currentBalance } });
  } catch (error) { next(error); }
});

router.post('/', upload.single('document'), async (req: any, res, next) => {
  try {
    const { date, voucherNo, bookingRule, bookingText, type, amount, vatPercentage } = req.body;

    const userPermissions = req.user?.permissions || getDefaultPermissions(req.user?.role || 'viewer');
    if (type === 'income' && !userPermissions.canAddIncome) {
      return res.status(403).json({
        success: false,
        message: 'Keine Berechtigung zum Erfassen von Einnahmen. / Not permitted to add income.'
      });
    }
    if (type === 'expense' && !userPermissions.canAddExpense) {
      return res.status(403).json({
        success: false,
        message: 'Keine Berechtigung zum Erfassen von Ausgaben. / Not permitted to add expenses.'
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Bitte einen gültigen Betrag größer als 0 eingeben / Please enter a valid amount greater than 0.' });
    }

    const entryDate = new Date(date);
    const entryYear = entryDate.getFullYear();

    const settings = await Settings.findOne() || await Settings.create({});
    if (settings.finalizedYears?.includes(entryYear)) {
      return res.status(400).json({
        success: false,
        message: `Geschäftsjahr ${entryYear} ist abgeschlossen und schreibgeschützt. / Fiscal year ${entryYear} is finalized and locked.`
      });
    }
    
    if (type === 'expense') {
      const { valid, availableBalance } = await validateExpense(numAmount, entryDate);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: `Unzureichender Kassenbestand. Diese Ausgabe kann nicht gespeichert werden, da der verfügbare Kassenbestand geringer ist als der eingegebene Betrag. (Verfügbar: € ${availableBalance.toFixed(2)})`
        });
      }
    }

    const entry = await CashBookEntry.create({
      date: entryDate,
      voucherNo: voucherNo || '',
      bookingRule,
      bookingText: bookingText || '',
      type,
      amount: numAmount,
      vatPercentage: Number(vatPercentage) || 0,
      cashBalance: 0,
      year: entryYear,
      month: entryDate.getMonth() + 1,
      documentPath: req.file?.filename,
      documentOriginalName: req.file?.originalname,
      createdBy: req.user._id
    });

    await recalculateBalancesFrom(entryDate);
    await logAction({
      action: 'CREATE',
      entityType: 'entry',
      entityId: entry._id.toString(),
      description: `Created ${type} entry ${voucherNo || ''} (€ ${numAmount.toFixed(2)})`,
      performedBy: req.user._id
    });

    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.put('/:id', upload.single('document'), async (req: any, res, next) => {
  try {
    const userPermissions = req.user?.permissions || getDefaultPermissions(req.user?.role || 'viewer');
    if (!userPermissions.canEditEntry) {
      return res.status(403).json({
        success: false,
        message: 'Keine Berechtigung zum Bearbeiten von Einträgen. / Not permitted to edit entries.'
      });
    }

    const entry = await CashBookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });

    const settings = await Settings.findOne() || await Settings.create({});
    if (settings.finalizedYears?.includes(entry.year)) {
      return res.status(400).json({
        success: false,
        message: `Geschäftsjahr ${entry.year} ist abgeschlossen und schreibgeschützt. / Fiscal year ${entry.year} is finalized and locked.`
      });
    }

    const oldDate = entry.date;
    const { date, voucherNo, bookingRule, bookingText, type, amount, vatPercentage } = req.body;
    const newDate = new Date(date);
    const newYear = newDate.getFullYear();

    if (settings.finalizedYears?.includes(newYear)) {
      return res.status(400).json({
        success: false,
        message: `Ziel-Geschäftsjahr ${newYear} ist abgeschlossen und schreibgeschützt. / Target fiscal year ${newYear} is finalized.`
      });
    }
    
    if (type === 'expense') {
      const { valid, availableBalance } = await validateExpense(Number(amount), newDate, entry._id.toString());
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: `Unzureichender Kassenbestand. Diese Ausgabe kann nicht gespeichert werden, da der verfügbare Kassenbestand geringer ist als der eingegebene Betrag. (Verfügbar: € ${availableBalance.toFixed(2)})`
        });
      }
    }

    Object.assign(entry, {
      date: newDate,
      voucherNo: voucherNo || '',
      bookingRule,
      bookingText: bookingText || '',
      type,
      amount: Number(amount),
      vatPercentage: Number(vatPercentage) || 0,
      year: newYear,
      month: newDate.getMonth() + 1,
      updatedBy: req.user._id
    });

    if (req.file) {
      entry.documentPath = req.file.filename;
      entry.documentOriginalName = req.file.originalname;
    }

    await entry.save();
    await recalculateBalancesFrom(newDate < oldDate ? newDate : oldDate);

    await logAction({
      action: 'UPDATE',
      entityType: 'entry',
      entityId: entry._id.toString(),
      description: `Updated entry ${voucherNo || ''} (€ ${Number(amount).toFixed(2)})`,
      performedBy: req.user._id
    });

    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req: any, res, next) => {
  try {
    const userPermissions = req.user?.permissions || getDefaultPermissions(req.user?.role || 'viewer');
    if (!userPermissions.canDeleteEntry) {
      return res.status(403).json({
        success: false,
        message: 'Keine Berechtigung zum Löschen von Einträgen. / Not permitted to delete entries.'
      });
    }

    const entry = await CashBookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });

    const settings = await Settings.findOne() || await Settings.create({});
    if (settings.finalizedYears?.includes(entry.year)) {
      return res.status(400).json({
        success: false,
        message: `Geschäftsjahr ${entry.year} ist abgeschlossen und schreibgeschützt. / Fiscal year ${entry.year} is finalized and locked.`
      });
    }

    entry.isDeleted = true;
    entry.updatedBy = req.user._id;
    await entry.save();

    await recalculateBalancesFrom(entry.date);
    await logAction({
      action: 'DELETE',
      entityType: 'entry',
      entityId: entry._id.toString(),
      description: `Deleted entry ${entry.voucherNo || ''}`,
      performedBy: req.user._id
    });

    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

router.get('/summary', async (req, res, next) => {
  try {
    const entries = await CashBookEntry.find({ isDeleted: false });
    let totalIncome = 0, totalExpense = 0;
    entries.forEach(e => {
      if (e.type === 'income') totalIncome += e.amount;
      else totalExpense += e.amount;
    });
    const currentBalance = await getCurrentBalance();
    const settings = await Settings.findOne();
    res.json({
      success: true,
      data: {
        currentBalance,
        totalIncome,
        totalExpense,
        openingBalance: settings?.openingBalance || 0
      }
    });
  } catch (error) { next(error); }
});

export default router;
