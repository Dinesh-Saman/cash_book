import { Router } from 'express';
import { CashBookEntry } from '../models/CashBookEntry';
import { Settings } from '../models/Settings';
import { authenticate } from '../middleware/auth';
import { exportToPDF, exportToExcel, exportToXML, exportToDatev } from '../services/exportService';

const router = Router();
router.use(authenticate);

async function getEntriesAndSettings(year?: string, month?: string) {
  const query: Record<string, unknown> = { isDeleted: false };
  if (year) query.year = Number(year);
  if (month && month !== 'undefined') query.month = Number(month);

  const entries = await CashBookEntry
    .find(query)
    .populate('bookingRule')
    .sort({ date: 1, createdAt: 1 });

  const settings = await Settings.findOne() || await Settings.create({ openingBalance: 0 });

  let startBalance = settings.openingBalance || 0;
  if (year && month && month !== 'undefined') {
    const firstDay = new Date(Number(year), Number(month) - 1, 1);
    const priorEntry = await CashBookEntry.findOne({
      date: { $lt: firstDay },
      isDeleted: false
    }).sort({ date: -1, createdAt: -1 });
    if (priorEntry) startBalance = priorEntry.cashBalance;
  } else if (year) {
    const firstDay = new Date(Number(year), 0, 1);
    const priorEntry = await CashBookEntry.findOne({
      date: { $lt: firstDay },
      isDeleted: false
    }).sort({ date: -1, createdAt: -1 });
    if (priorEntry) startBalance = priorEntry.cashBalance;
  }

  const periodLabel = month && month !== 'undefined' ? `${year}/${month}` : `${year}`;
  return { entries, settings, title: `Kassenbuch ${periodLabel}`, startBalance };
}

router.get('/pdf', async (req, res, next) => {
  try {
    const { year, month, lang } = req.query as Record<string, string>;
    const reportLang: 'de' | 'en' = lang === 'en' ? 'en' : 'de';
    const { entries, settings, title, startBalance } = await getEntriesAndSettings(year, month);
    const localizedTitle = reportLang === 'en' ? title.replace('Kassenbuch', 'Cash Book') : title;
    const pdfBuffer = exportToPDF(entries, localizedTitle, settings, startBalance, reportLang);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Kassenbuch_${year}_${month || 'gesamt'}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) { next(error); }
});

router.get('/excel', async (req, res, next) => {
  try {
    const { year, month, lang } = req.query as Record<string, string>;
    const reportLang: 'de' | 'en' = lang === 'en' ? 'en' : 'de';
    const { entries, settings, title, startBalance } = await getEntriesAndSettings(year, month);
    const localizedTitle = reportLang === 'en' ? title.replace('Kassenbuch', 'Cash Book') : title;
    const numYear = year ? Number(year) : undefined;
    const numMonth = month && month !== 'undefined' ? Number(month) : undefined;
    const excelBuffer = await exportToExcel(entries, localizedTitle, settings, startBalance, numYear, numMonth, reportLang);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Kassenbuch_${year}_${month || 'gesamt'}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) { next(error); }
});

router.get('/xml', async (req, res, next) => {
  try {
    const { year, month } = req.query as Record<string, string>;
    const { entries, title } = await getEntriesAndSettings(year, month);
    const xml = exportToXML(entries, title);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Kassenbuch_${year}_${month || 'gesamt'}.xml"`);
    res.send(xml);
  } catch (error) { next(error); }
});

router.get('/datev', async (req, res, next) => {
  try {
    const { year, month } = req.query as Record<string, string>;
    const { entries, settings } = await getEntriesAndSettings(year, month);
    const csv = exportToDatev(entries, settings);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="EXTF_Kassenbuch_${year}_${month || 'gesamt'}.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
});

export default router;
