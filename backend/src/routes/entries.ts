import { Router } from 'express';
import multer from 'multer';
import { CashBookEntry } from '../models/CashBookEntry';
import { BookingRule } from '../models/BookingRule';
import { Settings } from '../models/Settings';
import { getDefaultPermissions } from '../models/User';
import { authenticate } from '../middleware/auth';
import { validateExpense, recalculateBalancesFrom, getCurrentBalance } from '../services/balanceService';
import { logAction } from '../services/auditService';
import { getDocumentStream, saveDocumentToGridFS } from '../services/documentStorage';
import { buildMergedPdf, DocumentItem, MAX_TARGET_KB, DYNAMIC_TARGET_5_TO_10_KB } from '../services/documentCompression';

import crypto from 'crypto';
import path from 'path';
import jsPDF from 'jspdf';

// ─── Multer: accept up to 100 MB per file (parse up to 50 files; handlers cap at 10) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 50 }, // 100 MB max per document
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'));
  }
});

const router = Router();
router.use(authenticate);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function getNextVoucherNumber(): Promise<string> {
  const entries = await CashBookEntry.find({ isDeleted: false }, { voucherNo: 1 }).lean();
  const numericVouchers = entries
    .map((e) => String(e.voucherNo || '').trim())
    .filter((v) => /^\d+$/.test(v))
    .map(Number);

  if (numericVouchers.length === 0) return '1';
  return String(Math.max(...numericVouchers) + 1);
}

export function isMonthClosed(year: number, month: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year < currentYear || (year === currentYear && month < currentMonth);
}

/**
 * Save a multer file buffer to GridFS and return { path, originalName, mimeType }.
 */
async function saveFile(file: Express.Multer.File) {
  const ext = path.extname(file.originalname) || '';
  const generatedFilename = `${crypto.randomBytes(16).toString('hex')}${ext.toLowerCase()}`;
  await saveDocumentToGridFS(generatedFilename, file.buffer, file.mimetype, file.originalname);
  return { path: generatedFilename, originalName: file.originalname, mimeType: file.mimetype };
}

/**
 * Build a list of { path, originalName, mimeType } that covers both legacy
 * single-document entries and new multi-document entries.
 */
function getAllDocuments(entry: any): { path: string; originalName: string; mimeType: string }[] {
  const docs: { path: string; originalName: string; mimeType: string }[] = [];

  // New documents[] array
  if (Array.isArray(entry.documents) && entry.documents.length > 0) {
    docs.push(...entry.documents);
  }

  // Legacy single-document fallback (only if not already in documents[])
  if (entry.documentPath && !docs.some((d) => d.path === entry.documentPath)) {
    const ext = (entry.documentOriginalName || entry.documentPath).split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };
    docs.push({
      path: entry.documentPath,
      originalName: entry.documentOriginalName || entry.documentPath,
      mimeType: mimeMap[ext] || 'application/octet-stream',
    });
  }

  return docs;
}

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { year, month, type, page = 1, limit = 50 } = req.query;
    const query: any = { isDeleted: false };
    if (year) query.year = Number(year);
    if (month) query.month = Number(month);
    if (type) query.type = type;

    const skip = (Number(page) - 1) * Number(limit);
    const entries = await CashBookEntry.find(query)
      .populate('bookingRule')
      .sort({ date: 1, createdAt: 1 })
      .skip(skip)
      .limit(Number(limit));

    let totalIncome = 0;
    let totalExpense = 0;
    const allEntries = await CashBookEntry.find(query);
    allEntries.forEach((e) => {
      if (e.type === 'income') totalIncome += e.amount;
      else totalExpense += e.amount;
    });

    const currentBalance = await getCurrentBalance();
    res.json({ success: true, data: { entries, totalIncome, totalExpense, currentBalance } });
  } catch (error) { next(error); }
});

// ─── GET /next-voucher-no ────────────────────────────────────────────────────

router.get('/next-voucher-no', async (req, res, next) => {
  try {
    const nextVoucherNo = await getNextVoucherNumber();
    res.json({ success: true, data: { nextVoucherNo } });
  } catch (error) { next(error); }
});

// ─── GET /summary ─────────────────────────────────────────────────────────────

router.get('/summary', async (req, res, next) => {
  try {
    const entries = await CashBookEntry.find({ isDeleted: false });
    let totalIncome = 0, totalExpense = 0;
    entries.forEach((e) => {
      if (e.type === 'income') totalIncome += e.amount;
      else totalExpense += e.amount;
    });
    const currentBalance = await getCurrentBalance();
    const settings = await Settings.findOne();
    res.json({
      success: true,
      data: { currentBalance, totalIncome, totalExpense, openingBalance: settings?.openingBalance || 0 }
    });
  } catch (error) { next(error); }
});

// ─── GET /:id/merged-pdf ──────────────────────────────────────────────────────
// Merges all documents of an entry into a single PDF strictly under 200 KB.

router.get('/:id/merged-pdf', async (req: any, res, next) => {
  try {
    const entry = await CashBookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });

    const docs = getAllDocuments(entry);
    if (docs.length === 0) {
      return res.status(404).json({ success: false, message: 'No documents attached to this entry' });
    }

    const items: DocumentItem[] = [];
    for (const doc of docs) {
      const retrieved = await getDocumentStream(doc.path);
      if (!retrieved) continue;

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        retrieved.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        retrieved.stream.on('end', resolve);
        retrieved.stream.on('error', reject);
      });
      items.push({
        buffer: Buffer.concat(chunks),
        originalName: doc.originalName,
        mimeType: doc.mimeType,
      });
    }

    if (items.length === 0) {
      return res.status(404).json({ success: false, message: 'Attached documents could not be loaded' });
    }

    const pdfBuffer = await buildMergedPdf(items);
    const filename = `Voucher_${entry.voucherNo || entry._id}_Invoice.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('X-Document-Count', docs.length.toString());
    res.end(pdfBuffer);
  } catch (error) { next(error); }
});

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', upload.array('documents', 50), async (req: any, res, next) => {
  try {
    let { date, voucherNo, bookingRule, bookingText, type, amount, vatPercentage, contraAccount, columnH } = req.body;

    const trimmedVoucher = typeof voucherNo === 'string' ? voucherNo.trim() : '';
    const finalVoucherNo = trimmedVoucher || await getNextVoucherNumber();

    const userPermissions = req.user?.permissions || getDefaultPermissions(req.user?.role || 'viewer');
    if (type === 'income' && !userPermissions.canAddIncome) {
      return res.status(403).json({ success: false, message: 'Keine Berechtigung zum Erfassen von Einnahmen. / Not permitted to add income.' });
    }
    if (type === 'expense' && !userPermissions.canAddExpense) {
      return res.status(403).json({ success: false, message: 'Keine Berechtigung zum Erfassen von Ausgaben. / Not permitted to add expenses.' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Bitte einen gültigen Betrag größer als 0 eingeben / Please enter a valid amount greater than 0.' });
    }

    const entryDate = new Date(date);
    const entryYear = entryDate.getFullYear();
    const entryMonth = entryDate.getMonth() + 1;

    if (isMonthClosed(entryYear, entryMonth)) {
      return res.status(403).json({ success: false, message: 'Vergangene Monate sind abgeschlossen und schreibgeschützt. / Past months are closed and locked for new entries.' });
    }

    const settings = await Settings.findOne() || await Settings.create({});
    if (settings.finalizedYears?.includes(entryYear)) {
      return res.status(400).json({ success: false, message: `Geschäftsjahr ${entryYear} ist abgeschlossen und schreibgeschützt. / Fiscal year ${entryYear} is finalized and locked.` });
    }

    if (type === 'expense') {
      const { valid, availableBalance } = await validateExpense(numAmount, entryDate);
      if (!valid) {
        return res.status(400).json({ success: false, message: `Unzureichender Kassenbestand. Diese Ausgabe kann nicht gespeichert werden, da der verfügbare Kassenbestand geringer ist als der eingegebene Betrag. (Verfügbar: € ${availableBalance.toFixed(2)})` });
      }
    }

    // Resolve Contra Account / Column H
    let resolvedAccount = String(contraAccount || columnH || '').trim();
    if (!resolvedAccount && bookingRule) {
      try {
        const ruleDoc = await BookingRule.findById(bookingRule);
        if (ruleDoc) {
          const isSKR03 = settings.datevChartOfAccounts === 'SKR03';
          resolvedAccount = isSKR03 ? (ruleDoc.accountSKR03 || '1360') : (ruleDoc.accountSKR04 || '1360');
        }
      } catch {}
    }

    // Save uploaded files to GridFS (strictly capped at 10 files)
    const rawFiles = (req.files as Express.Multer.File[]) || [];
    const files = rawFiles.slice(0, 10);
    const savedDocs = await Promise.all(files.map(saveFile));

    const entry = await CashBookEntry.create({
      date: entryDate,
      voucherNo: finalVoucherNo,
      bookingRule,
      bookingText: bookingText || '',
      type,
      amount: numAmount,
      vatPercentage: Number(vatPercentage) || 0,
      cashBalance: 0,
      contraAccount: resolvedAccount,
      columnH: resolvedAccount,
      year: entryYear,
      month: entryDate.getMonth() + 1,
      documents: savedDocs,
      // Keep legacy fields populated from first document for backward compat
      documentPath: savedDocs[0]?.path,
      documentOriginalName: savedDocs[0]?.originalName,
      createdBy: req.user._id
    });

    await recalculateBalancesFrom(entryDate);
    await logAction({
      action: 'CREATE',
      entityType: 'entry',
      entityId: entry._id.toString(),
      description: `Created ${type} entry ${finalVoucherNo} (€ ${numAmount.toFixed(2)}) with ${savedDocs.length} document(s)`,
      performedBy: req.user._id
    });

    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

// ─── PUT /:id ─────────────────────────────────────────────────────────────────

router.put('/:id', upload.array('documents', 50), async (req: any, res, next) => {
  try {
    const userPermissions = req.user?.permissions || getDefaultPermissions(req.user?.role || 'viewer');
    if (!userPermissions.canEditEntry) {
      return res.status(403).json({ success: false, message: 'Keine Berechtigung zum Bearbeiten von Einträgen. / Not permitted to edit entries.' });
    }

    const entry = await CashBookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });

    if (isMonthClosed(entry.year, entry.month)) {
      return res.status(403).json({ success: false, message: 'Buchungen aus vergangenen Monaten sind abgeschlossen und können nicht mehr bearbeitet werden. / Entries from past months are closed and cannot be edited.' });
    }

    const settings = await Settings.findOne() || await Settings.create({});
    if (settings.finalizedYears?.includes(entry.year)) {
      return res.status(400).json({ success: false, message: `Geschäftsjahr ${entry.year} ist abgeschlossen und schreibgeschützt. / Fiscal year ${entry.year} is finalized and locked.` });
    }

    const oldDate = entry.date;
    const { date, voucherNo, bookingRule, bookingText, type, amount, vatPercentage, contraAccount, columnH, removeDocumentPaths } = req.body;
    const newDate = new Date(date);
    const newYear = newDate.getFullYear();
    const newMonth = newDate.getMonth() + 1;

    if (isMonthClosed(newYear, newMonth)) {
      return res.status(403).json({ success: false, message: 'Buchung kann nicht in einen vergangenen, abgeschlossenen Monat verschoben werden. / Cannot move entry into a closed past month.' });
    }

    if (settings.finalizedYears?.includes(newYear)) {
      return res.status(400).json({ success: false, message: `Ziel-Geschäftsjahr ${newYear} ist abgeschlossen und schreibgeschützt. / Target fiscal year ${newYear} is finalized.` });
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

    let pathsToRemove: string[] = [];
    if (removeDocumentPaths) {
      try {
        pathsToRemove = JSON.parse(removeDocumentPaths);
      } catch {
        pathsToRemove = Array.isArray(removeDocumentPaths) ? removeDocumentPaths : [removeDocumentPaths];
      }
    }

    // Start from existing documents, filter out removed ones
    let currentDocs = getAllDocuments(entry).filter((d) => !pathsToRemove.includes(d.path));

    // Append newly uploaded files (strictly capped so total does not exceed 10)
    const rawNewFiles = (req.files as Express.Multer.File[]) || [];
    const maxNewAllowed = Math.max(0, 10 - currentDocs.length);
    const newFiles = rawNewFiles.slice(0, maxNewAllowed);
    const newSavedDocs = await Promise.all(newFiles.map(saveFile));
    const allDocs = [...currentDocs, ...newSavedDocs];

    let resolvedAccount = entry.contraAccount || entry.columnH || '';
    if (contraAccount !== undefined || columnH !== undefined) {
      resolvedAccount = String(contraAccount || columnH || '').trim();
    } else if (!resolvedAccount && bookingRule) {
      try {
        const ruleDoc = await BookingRule.findById(bookingRule);
        if (ruleDoc) {
          const isSKR03 = settings.datevChartOfAccounts === 'SKR03';
          resolvedAccount = isSKR03 ? (ruleDoc.accountSKR03 || '1360') : (ruleDoc.accountSKR04 || '1360');
        }
      } catch {}
    }

    Object.assign(entry, {
      date: newDate,
      voucherNo: voucherNo || '',
      bookingRule,
      bookingText: bookingText || '',
      type,
      amount: Number(amount),
      vatPercentage: Number(vatPercentage) || 0,
      contraAccount: resolvedAccount,
      columnH: resolvedAccount,
      year: newYear,
      month: newDate.getMonth() + 1,
      documents: allDocs,
      // Update legacy fields to reflect the first document
      documentPath: allDocs[0]?.path,
      documentOriginalName: allDocs[0]?.originalName,
      updatedBy: req.user._id
    });

    await entry.save();
    await recalculateBalancesFrom(newDate < oldDate ? newDate : oldDate);
    await logAction({
      action: 'UPDATE',
      entityType: 'entry',
      entityId: entry._id.toString(),
      description: `Updated entry ${voucherNo || ''} (€ ${Number(amount).toFixed(2)}), ${allDocs.length} document(s)`,
      performedBy: req.user._id
    });

    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

router.delete('/:id', async (req: any, res, next) => {
  try {
    const userPermissions = req.user?.permissions || getDefaultPermissions(req.user?.role || 'viewer');
    if (!userPermissions.canDeleteEntry) {
      return res.status(403).json({ success: false, message: 'Keine Berechtigung zum Löschen von Einträgen. / Not permitted to delete entries.' });
    }

    const entry = await CashBookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Not found' });

    if (isMonthClosed(entry.year, entry.month)) {
      return res.status(403).json({ success: false, message: 'Buchungen aus vergangenen Monaten sind abgeschlossen und können nicht mehr gelöscht werden. / Entries from past months are closed and cannot be deleted.' });
    }

    const settings = await Settings.findOne() || await Settings.create({});
    if (settings.finalizedYears?.includes(entry.year)) {
      return res.status(400).json({ success: false, message: `Geschäftsjahr ${entry.year} ist abgeschlossen und schreibgeschützt. / Fiscal year ${entry.year} is finalized and locked.` });
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

export default router;
