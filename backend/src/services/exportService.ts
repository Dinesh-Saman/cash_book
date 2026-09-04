import { ICashBookEntry } from '../models/CashBookEntry';
import { ISettings } from '../models/Settings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as xlsx from 'xlsx';
import { create } from 'xmlbuilder2';
import { format } from 'date-fns';

const I18N = {
  de: {
    titlePrefix: 'Kassenbuch',
    openingBalMonth: 'Anfangsbestand (Monat)',
    openingBalYear: 'Anfangsbestand',
    totalIncome: 'Gesamteinnahmen',
    totalExpense: 'Gesamtausgaben',
    netBalance: 'Saldo',
    closingBalance: 'Endbestand',
    thDate: 'Datum',
    thVoucherNo: 'Belegnr.',
    thBookingRule: 'Buchungsregel',
    thBookingText: 'Buchungstext',
    thIncome: 'Einnahme (€)',
    thExpense: 'Ausgabe (€)',
    thVat: 'MwSt. (%)',
    thBalance: 'Kassenbestand (€)',
    thDocument: 'Dokument',
    docAvailable: 'Vorhanden',
    createdOn: 'Erstellt am',
    pageOf: 'Seite',
    of: 'von'
  },
  en: {
    titlePrefix: 'Cash Book',
    openingBalMonth: 'Opening Balance (Month)',
    openingBalYear: 'Opening Balance',
    totalIncome: 'Total Income',
    totalExpense: 'Total Expenses',
    netBalance: 'Net Balance',
    closingBalance: 'Closing Balance',
    thDate: 'Date',
    thVoucherNo: 'Voucher No.',
    thBookingRule: 'Booking Rule',
    thBookingText: 'Description',
    thIncome: 'Income (€)',
    thExpense: 'Expense (€)',
    thVat: 'VAT (%)',
    thBalance: 'Cash Balance (€)',
    thDocument: 'Document',
    docAvailable: 'Available',
    createdOn: 'Generated on',
    pageOf: 'Page',
    of: 'of'
  }
};

const BOOKING_RULE_TRANSLATIONS: Record<string, { de: string; en: string }> = {
  'Cash from Bank (Deposit)': { de: 'Bargeld von Bank (Einzahlung in Kasse)', en: 'Cash from Bank (Cash In / Inflow)' },
  'Cash from Bank (Cash In / Inflow)': { de: 'Bargeld von Bank (Einzahlung in Kasse)', en: 'Cash from Bank (Cash In / Inflow)' },
  'Cash to Bank (Withdrawal)': { de: 'Bargeld an Bank (Auszahlung aus Kasse)', en: 'Cash to Bank (Cash Out / Outflow)' },
  'Cash to Bank (Cash Out / Outflow)': { de: 'Bargeld an Bank (Auszahlung aus Kasse)', en: 'Cash to Bank (Cash Out / Outflow)' },
  'Cash Customer Invoice Receipt': { de: 'Barverkauf / Kundenrechnung', en: 'Cash Customer Invoice Receipt' },
  'Supplier Invoice Payment': { de: 'Lieferantenrechnung Barzahlung', en: 'Supplier Invoice Payment' },
  'Postage / Stamps': { de: 'Post / Briefmarken', en: 'Postage / Stamps' },
  'Shipping / Freight 19%': { de: 'Fracht / Versand 19%', en: 'Shipping / Freight 19%' },
  'Office Materials 19%': { de: 'Büromaterial 19%', en: 'Office Materials 19%' },
  'Office Materials 7%': { de: 'Büromaterial 7%', en: 'Office Materials 7%' },
  'Other Costs 19%': { de: 'Sonstige Kosten 19%', en: 'Other Costs 19%' },
  'Other Costs 7%': { de: 'Sonstige Kosten 7%', en: 'Other Costs 7%' },
  'Hospitality 19%': { de: 'Bewirtung 19%', en: 'Hospitality 19%' },
  'Vehicle (Fuel, Washing) 19%': { de: 'KFZ (Benzin, Wäsche) 19%', en: 'Vehicle (Fuel, Washing) 19%' },
  'Travel Expenses 19%': { de: 'Reisekosten 19%', en: 'Travel Expenses 19%' },
  'Lottery Cash Deposit': { de: 'Lotto-Bareinzahlung', en: 'Lottery Cash Deposit' }
};

function translateRule(name: string, lang: 'de' | 'en'): string {
  if (!name) return '—';
  const direct = BOOKING_RULE_TRANSLATIONS[name];
  if (direct) return direct[lang] || name;
  for (const entry of Object.values(BOOKING_RULE_TRANSLATIONS)) {
    if (entry.de.toLowerCase() === name.toLowerCase() || entry.en.toLowerCase() === name.toLowerCase()) {
      return entry[lang] || name;
    }
  }
  return name;
}

export function exportToPDF(
  entries: ICashBookEntry[],
  reportTitle: string,
  settings: ISettings,
  customStartBalance?: number,
  lang: 'de' | 'en' = 'de'
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape' });
  const generatedOn = format(new Date(), 'dd.MM.yyyy HH:mm');
  const t = I18N[lang] || I18N.de;

  // Compute 5 summary values
  const startBal = customStartBalance !== undefined ? customStartBalance : (settings.openingBalance || 0);
  const totalInc = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExp = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const netBal = totalInc - totalExp;
  const endBal = entries.length > 0 ? entries[entries.length - 1].cashBalance : startBal;

  // Document Title Header
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(reportTitle, 14, 15);

  // Summary Cards Bar (5 cards)
  const summaryCards = [
    { title: t.openingBalMonth, value: `€ ${startBal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: [30, 41, 59] },
    { title: t.totalIncome, value: `+€ ${totalInc.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: [5, 150, 105] },
    { title: t.totalExpense, value: `-€ ${totalExp.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: [225, 29, 72] },
    { title: t.netBalance, value: `€ ${netBal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: [79, 70, 229] },
    { title: t.closingBalance, value: `€ ${endBal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: [15, 23, 42] }
  ];

  autoTable(doc, {
    startY: 20,
    head: [summaryCards.map(c => c.title)],
    body: [summaryCards.map(c => c.value)],
    theme: 'plain',
    styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
    headStyles: { fillColor: [241, 245, 249], textColor: [100, 116, 139], fontStyle: 'bold' },
    bodyStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 9 }
  });

  const tableData = entries.map(e => [
    format(new Date(e.date), 'dd.MM.yyyy'),
    e.voucherNo || '—',
    translateRule((e.bookingRule as any)?.name || '', lang),
    e.bookingText || '—',
    e.type === 'income' ? `+${e.amount.toFixed(2)}` : '',
    e.type === 'expense' ? `-${e.amount.toFixed(2)}` : '',
    `${e.vatPercentage}%`,
    e.cashBalance.toFixed(2),
    e.documentOriginalName || (e.documentPath ? t.docAvailable : '—')
  ]);

  autoTable(doc, {
    head: [[t.thDate, t.thVoucherNo, t.thBookingRule, t.thBookingText, t.thIncome, t.thExpense, t.thVat, t.thBalance, t.thDocument]],
    body: tableData,
    startY: (doc as any).lastAutoTable.finalY + 4,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (data) => {
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Bottom center: Date and Time
      const dateTimeStr = `${t.createdOn}: ${generatedOn}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(dateTimeStr, pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Footer page numbering (right side)
      const pageNumStr = `${t.pageOf} ${doc.getNumberOfPages()}`;
      doc.text(pageNumStr, pageWidth - 25, pageHeight - 10);
    }
  });

  return Buffer.from(doc.output('arraybuffer'));
}

import ExcelJS from 'exceljs';

export async function exportToExcel(
  entries: ICashBookEntry[],
  reportTitle: string,
  settings?: ISettings,
  customStartBalance?: number,
  periodYear?: number,
  periodMonth?: number,
  lang: 'de' | 'en' = 'de'
): Promise<Buffer> {
  const MONTH_NAMES: Record<'de' | 'en', string[]> = {
    de: [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ],
    en: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
  };

  const t = I18N[lang] || I18N.de;

  // Determine Sheet Tab Name:
  // - For Monthly report: e.g. "September 2026"
  // - For Annual report: e.g. "2026"
  let sheetName = lang === 'en' ? 'CashBook' : 'Kassenbuch';
  if (periodYear && periodMonth) {
    const monthStr = (MONTH_NAMES[lang] || MONTH_NAMES.de)[periodMonth - 1] || `Monat ${periodMonth}`;
    sheetName = `${monthStr} ${periodYear}`;
  } else if (periodYear) {
    sheetName = `${periodYear}`;
  } else {
    const matchMonthly = reportTitle.match(/(\d{4})\/(\d{1,2})/);
    if (matchMonthly) {
      const y = matchMonthly[1];
      const m = Number(matchMonthly[2]);
      const monthStr = (MONTH_NAMES[lang] || MONTH_NAMES.de)[m - 1] || `Monat ${m}`;
      sheetName = `${monthStr} ${y}`;
    } else {
      const matchYear = reportTitle.match(/\b(20\d{2})\b/);
      if (matchYear) {
        sheetName = matchYear[1];
      }
    }
  }

  // Ensure sheet name is <= 31 chars and has no forbidden chars \ / ? * [ ] :
  sheetName = sheetName.replace(/[\/\\?*\[\]:]/g, '-').slice(0, 31);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Compute 5 summary values
  const startBal = customStartBalance !== undefined ? customStartBalance : (settings?.openingBalance || 0);
  const totalInc = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExp = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const netBal = totalInc - totalExp;
  const endBal = entries.length > 0 ? entries[entries.length - 1].cashBalance : startBal;

  worksheet.columns = [
    { key: 'col1', width: 28 }, // Widened so 'Opening Balance (Month)' or 'Anfangsbestand (Monat)' is fully visible
    { key: 'col2', width: 20 },
    { key: 'col3', width: 28 },
    { key: 'col4', width: 34 },
    { key: 'col5', width: 18 },
    { key: 'col6', width: 18 },
    { key: 'col7', width: 14 },
    { key: 'col8', width: 22 },
    { key: 'col9', width: 32 }
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  const allBordersStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  const headerBorderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'medium', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  // Row 1: Report Title
  const titleRow = worksheet.addRow([reportTitle]);
  titleRow.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
  worksheet.mergeCells('A1:D1');
  titleRow.height = 24;

  // Row 2: Empty Spacer
  worksheet.addRow([]);

  // Row 3: Summary Cards Header
  const openingLabel = periodMonth ? t.openingBalMonth : t.openingBalYear;
  const sumHeaderRow = worksheet.addRow([
    openingLabel,
    t.totalIncome,
    t.totalExpense,
    t.netBalance,
    t.closingBalance
  ]);
  sumHeaderRow.font = { bold: true, size: 9, color: { argb: 'FF64748B' } };
  sumHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
  sumHeaderRow.height = 20;

  // Row 4: Summary Cards Values
  const sumValueRow = worksheet.addRow([
    startBal,
    totalInc,
    totalExp,
    netBal,
    endBal
  ]);
  sumValueRow.font = { bold: true, size: 12 };
  sumValueRow.alignment = { horizontal: 'center', vertical: 'middle' };
  sumValueRow.height = 26;

  // Colors for each card:
  // Card 1: Slate
  sumValueRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
  sumValueRow.getCell(1).numFmt = '[$€-de-DE] #,##0.00';
  sumHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  sumValueRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  // Card 2: Green
  sumValueRow.getCell(2).font = { bold: true, size: 11, color: { argb: 'FF059669' } };
  sumValueRow.getCell(2).numFmt = '[$€-de-DE] #,##0.00';
  sumHeaderRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
  sumValueRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };

  // Card 3: Rose
  sumValueRow.getCell(3).font = { bold: true, size: 11, color: { argb: 'FFE11D48' } };
  sumValueRow.getCell(3).numFmt = '[$€-de-DE] #,##0.00';
  sumHeaderRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
  sumValueRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };

  // Card 4: Indigo
  sumValueRow.getCell(4).font = { bold: true, size: 11, color: { argb: 'FF4F46E5' } };
  sumValueRow.getCell(4).numFmt = '[$€-de-DE] #,##0.00';
  sumHeaderRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
  sumValueRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };

  // Card 5: Dark Blue
  sumValueRow.getCell(5).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
  sumValueRow.getCell(5).numFmt = '[$€-de-DE] #,##0.00';
  sumHeaderRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  sumValueRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  for (let c = 1; c <= 5; c++) {
    sumHeaderRow.getCell(c).border = thinBorder;
    sumValueRow.getCell(c).border = thinBorder;
  }

  // Row 5: Spacer Row
  worksheet.addRow([]);

  // Row 6: Table Headers
  const tableHeaderRow = worksheet.addRow([
    t.thDate,
    t.thVoucherNo,
    t.thBookingRule,
    t.thBookingText,
    t.thIncome,
    t.thExpense,
    t.thVat,
    t.thBalance,
    t.thDocument
  ]);
  tableHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  tableHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' } // brand indigo
  };
  tableHeaderRow.alignment = { vertical: 'middle' };
  tableHeaderRow.height = 24;
  for (let col = 1; col <= 9; col++) {
    tableHeaderRow.getCell(col).border = headerBorderStyle;
  }

  // Table Data Rows
  for (const e of entries) {
    const row = worksheet.addRow([
      format(new Date(e.date), 'yyyy-MM-dd'),
      e.voucherNo || '',
      translateRule((e.bookingRule as any)?.name || '', lang),
      e.bookingText || '',
      e.type === 'income' ? Number(e.amount.toFixed(2)) : null,
      e.type === 'expense' ? Number(e.amount.toFixed(2)) : null,
      e.vatPercentage,
      Number(e.cashBalance.toFixed(2)),
      e.documentOriginalName || (e.documentPath ? t.docAvailable : '')
    ]);

    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(8).numFmt = '#,##0.00';
    row.alignment = { vertical: 'middle' };

    // Apply "All Borders" across all 9 columns explicitly
    for (let col = 1; col <= 9; col++) {
      row.getCell(col).border = allBordersStyle;
    }
  }

  // Add date and time at the bottom of the data
  const generatedOn = format(new Date(), 'dd.MM.yyyy HH:mm');
  worksheet.addRow([]); // Blank spacer row
  const footerRow = worksheet.addRow([`${t.createdOn}: ${generatedOn}`]);
  worksheet.mergeCells(`A${footerRow.number}:I${footerRow.number}`);
  footerRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
  footerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Page setup print footer with date and time centered
  worksheet.headerFooter.oddFooter = `&C ${t.createdOn}: ${generatedOn} &R ${t.pageOf} &P ${t.of} &N`;

  const uint8Array = await workbook.xlsx.writeBuffer();
  return Buffer.from(uint8Array);
}

export function exportToXML(entries: ICashBookEntry[], reportTitle: string): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('CashBook', {
    title: reportTitle,
    generatedAt: new Date().toISOString()
  });

  for (const e of entries) {
    root.ele('Entry')
      .ele('Date').txt(format(new Date(e.date), 'yyyy-MM-dd')).up()
      .ele('VoucherNo').txt(e.voucherNo || '').up()
      .ele('BookingRule').txt((e.bookingRule as any)?.name || '').up()
      .ele('BookingText').txt(e.bookingText || '').up()
      .ele('Type').txt(e.type).up()
      .ele('Income').txt(e.type === 'income' ? e.amount.toFixed(2) : '').up()
      .ele('Expense').txt(e.type === 'expense' ? e.amount.toFixed(2) : '').up()
      .ele('Amount').txt(e.amount.toFixed(2)).up()
      .ele('VATPercentage').txt(e.vatPercentage.toString()).up()
      .ele('CashBalance').txt(e.cashBalance.toFixed(2)).up()
      .ele('Document').txt(e.documentOriginalName || e.documentPath || '').up()
      .up();
  }

  return root.end({ prettyPrint: true });
}

export function exportToDatev(entries: ICashBookEntry[], settings: ISettings): string {
  const advisorNum = settings.datevAdvisorNumber || '00000';
  const clientNum = settings.datevClientNumber || '00000';
  const cashAccount = settings.datevChartOfAccounts === 'SKR03' ? '1600' : '1000';
  const createdDate = format(new Date(), 'yyyyMMddHHmmssSSS');

  // DATEV EXTF header specification
  let csv = `EXTF;700;21;Buchungsstapel;5;${createdDate};;cb;cb;;${advisorNum};${clientNum};20260101;4;20260101;20261231;;;;\n`;
  csv += 'Umsatz;Soll/Haben;Konto;Gegenkonto;Belegdatum;Belegfeld1;Buchungstext\n';

  for (const e of entries) {
    const umsatz = e.amount.toFixed(2).replace('.', ',');
    const sh = e.type === 'income' ? 'S' : 'H';
    const datum = format(new Date(e.date), 'ddMM');
    const voucher = (e.voucherNo || '').replace(/;/g, ' ');
    const text = (e.bookingText || (e.bookingRule as any)?.name || '').replace(/;/g, ' ');
    
    // In DATEV, Konto is the cash account (1000 for SKR04, 1600 for SKR03)
    csv += `${umsatz};${sh};${cashAccount};;${datum};${voucher};${text}\n`;
  }

  return csv;
}
