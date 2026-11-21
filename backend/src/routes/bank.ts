import { Router } from 'express';
import { BankStatement } from '../models/BankStatement';
import { authenticate } from '../middleware/auth';
import { logAction } from '../services/auditService';

const router = Router();
router.use(authenticate);

// ─── GET /api/bank/latest ─────────────────────────────────────────────────────
// Returns the most recently uploaded bank statement so it stays visible on reload/relogin
router.get('/latest', async (req, res, next) => {
  try {
    const latest = await BankStatement.findOne().sort({ createdAt: -1 });
    if (!latest) {
      return res.json({ success: true, data: null });
    }
    return res.json({
      success: true,
      data: {
        id: latest._id,
        metadata: latest.metadata,
        transactions: latest.transactions,
        companyInvoices: latest.companyInvoices || [],
        createdAt: latest.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/bank/history ────────────────────────────────────────────────────
// Returns the list of all uploaded statements (history metadata)
router.get('/history', async (req, res, next) => {
  try {
    const history = await BankStatement.find(
      {},
      {
        fileName: 1,
        fileSize: 1,
        accountName: 1,
        ownAccountNumber: 1,
        ownIban: 1,
        periodText: 1,
        totalRecords: 1,
        createdAt: 1,
      }
    ).sort({ createdAt: -1 });

    return res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/bank/:id ────────────────────────────────────────────────────────
// Loads a specific historical statement by ID
router.get('/:id', async (req, res, next) => {
  try {
    const statement = await BankStatement.findById(req.params.id);
    if (!statement) {
      return res.status(404).json({ success: false, message: 'Bank statement not found' });
    }
    return res.json({
      success: true,
      data: {
        id: statement._id,
        metadata: statement.metadata,
        transactions: statement.transactions,
        companyInvoices: statement.companyInvoices || [],
        createdAt: statement.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/bank/save ──────────────────────────────────────────────────────
// Saves an uploaded bank statement to MongoDB so it persists permanently
router.post('/save', async (req: any, res, next) => {
  try {
    const { metadata, transactions, companyInvoices } = req.body;
    if (!metadata || !Array.isArray(transactions)) {
      return res.status(400).json({ success: false, message: 'Invalid bank statement payload' });
    }

    const statement = await BankStatement.create({
      fileName: metadata.fileName || 'statement.csv',
      fileSize: metadata.fileSize || 0,
      accountName: metadata.accountName,
      ownAccountNumber: metadata.ownAccountNumber,
      ownIban: metadata.ownIban,
      periodText: metadata.periodText,
      lastBalance: metadata.lastBalance,
      currency: metadata.currency || 'EUR',
      totalRecords: transactions.length,
      metadata,
      transactions,
      companyInvoices: Array.isArray(companyInvoices) ? companyInvoices : [],
      uploadedBy: req.user?._id,
    });

    await logAction({
      action: 'CREATE',
      entityType: 'bank_statement' as any,
      entityId: statement._id.toString(),
      description: `Uploaded bank statement "${statement.fileName}" (${statement.totalRecords} transactions)`,
      performedBy: req.user?._id,
    });

    return res.json({
      success: true,
      data: {
        id: statement._id,
        metadata: statement.metadata,
        transactions: statement.transactions,
        companyInvoices: statement.companyInvoices || [],
        createdAt: statement.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/bank/company-invoices ──────────────────────────────────────────
// Upload / attach invoices for a specific company in the bank statement
router.post('/company-invoices', async (req: any, res, next) => {
  try {
    const { statementId, company, invoices } = req.body;
    if (!company || !Array.isArray(invoices)) {
      return res.status(400).json({ success: false, message: 'Invalid company or invoices data' });
    }

    let statement;
    if (statementId) {
      statement = await BankStatement.findById(statementId);
    }
    if (!statement) {
      statement = await BankStatement.findOne().sort({ createdAt: -1 });
    }
    if (!statement) {
      return res.status(404).json({ success: false, message: 'No bank statement found' });
    }

    const existingCompanyList = statement.companyInvoices || [];
    const compIdx = existingCompanyList.findIndex(
      (c) => c.company.trim().toLowerCase() === company.trim().toLowerCase()
    );

    if (compIdx !== -1) {
      existingCompanyList[compIdx].invoices = invoices;
    } else {
      existingCompanyList.push({
        company: company.trim(),
        invoices,
      });
    }

    statement.companyInvoices = existingCompanyList;
    await statement.save();

    await logAction({
      action: 'UPDATE',
      entityType: 'bank_statement' as any,
      entityId: statement._id.toString(),
      description: `Updated invoices for company "${company}" (${invoices.length} file(s)) in statement "${statement.fileName}"`,
      performedBy: req.user?._id,
    });

    return res.json({
      success: true,
      data: {
        company,
        companyInvoices: statement.companyInvoices,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/bank/:id ─────────────────────────────────────────────────────
// Deletes a historical statement
router.delete('/:id', async (req: any, res, next) => {
  try {
    const statement = await BankStatement.findByIdAndDelete(req.params.id);
    if (!statement) {
      return res.status(404).json({ success: false, message: 'Bank statement not found' });
    }

    await logAction({
      action: 'DELETE',
      entityType: 'bank_statement' as any,
      entityId: req.params.id,
      description: `Deleted bank statement "${statement.fileName}"`,
      performedBy: req.user?._id,
    });

    return res.json({ success: true, message: 'Statement deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
