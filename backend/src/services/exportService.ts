import { ICashBookEntry } from '../models/CashBookEntry';
import { ISettings } from '../models/Settings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as xlsx from 'xlsx';
import { create } from 'xmlbuilder2';
import { format } from 'date-fns';
import { DEFAULT_CONTRA_ACCOUNTS } from '../seeder';

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
    thContraAccount: 'Spalte H',
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
    thVoucherNo: 'Vouc. No.',
    thBookingRule: 'Booking Rule',
    thContraAccount: 'Column H',
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
    e.contraAccount || e.columnH || (e.bookingRule as any)?.accountSKR04 || (e.bookingRule as any)?.accountSKR03 || '—',
    e.cashBalance.toFixed(2),
    e.documentOriginalName || (e.documentPath ? t.docAvailable : '—')
  ]);

  autoTable(doc, {
    head: [[t.thDate, t.thVoucherNo, t.thBookingRule, t.thBookingText, t.thIncome, t.thExpense, t.thVat, t.thContraAccount, t.thBalance, t.thDocument]],
    body: tableData,
    startY: (doc as any).lastAutoTable.finalY + 4,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
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
    { key: 'col1', width: 20 },
    { key: 'col2', width: 16 },
    { key: 'col3', width: 28 },
    { key: 'col4', width: 32 },
    { key: 'col5', width: 18 },
    { key: 'col6', width: 18 },
    { key: 'col7', width: 14 },
    { key: 'col8', width: 22 }, // Column H
    { key: 'col9', width: 22 },
    { key: 'col10', width: 28 }
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
    t.thContraAccount,
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
  for (let col = 1; col <= 10; col++) {
    tableHeaderRow.getCell(col).border = headerBorderStyle;
  }

  // Table Data Rows
  for (const e of entries) {
    const contraVal = e.contraAccount || e.columnH || (e.bookingRule as any)?.accountSKR04 || (e.bookingRule as any)?.accountSKR03 || '';
    const row = worksheet.addRow([
      format(new Date(e.date), 'dd.MM.yyyy'),
      e.voucherNo || '',
      translateRule((e.bookingRule as any)?.name || '', lang),
      e.bookingText || '',
      e.type === 'income' ? Number(e.amount.toFixed(2)) : null,
      e.type === 'expense' ? Number(e.amount.toFixed(2)) : null,
      e.vatPercentage,
      contraVal,
      Number(e.cashBalance.toFixed(2)),
      e.documentOriginalName || (e.documentPath ? t.docAvailable : '')
    ]);

    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(9).numFmt = '#,##0.00';
    row.alignment = { vertical: 'middle' };

    // Apply "All Borders" across all 10 columns explicitly
    for (let col = 1; col <= 10; col++) {
      row.getCell(col).border = allBordersStyle;
    }
  }

  // Add date and time at the bottom of the data
  const generatedOn = format(new Date(), 'dd.MM.yyyy HH:mm');
  worksheet.addRow([]); // Blank spacer row
  const footerRow = worksheet.addRow([`${t.createdOn}: ${generatedOn}`]);
  worksheet.mergeCells(`A${footerRow.number}:J${footerRow.number}`);
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
      .ele('Date').txt(format(new Date(e.date), 'dd.MM.yyyy')).up()
      .ele('VoucherNo').txt(e.voucherNo || '').up()
      .ele('BookingRule').txt((e.bookingRule as any)?.name || '').up()
      .ele('ContraAccount').txt(e.contraAccount || e.columnH || (e.bookingRule as any)?.accountSKR04 || (e.bookingRule as any)?.accountSKR03 || '').up()
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

const DATEV_FIELDS: { index: number; label: string; type: string; length: number }[] = [
  { index: 0, label: 'Umsatz (ohne Soll/Haben-Kz)', type: 'Betrag', length: 10 },
  { index: 1, label: 'Soll/Haben-Kennzeichen', type: 'Text', length: 1 },
  { index: 2, label: 'WKZ Umsatz', type: 'Text', length: 3 },
  { index: 3, label: 'Kurs', type: 'Zahl', length: 4 },
  { index: 4, label: 'Basis-Umsatz', type: 'Betrag', length: 10 },
  { index: 5, label: 'WKZ Basis-Umsatz', type: 'Text', length: 3 },
  { index: 6, label: 'Kontonummer', type: 'Konto', length: 9 },
  { index: 7, label: 'Gegenkonto (ohne BU-Schlüssel)', type: 'Konto', length: 9 },
  { index: 8, label: 'BU-Schlüssel', type: 'Text', length: 2 },
  { index: 9, label: 'Belegdatum', type: 'Datum', length: 8 },
  { index: 10, label: 'Belegfeld 1', type: 'Text', length: 12 },
  { index: 11, label: 'Belegfeld 2', type: 'Text', length: 12 },
  { index: 12, label: 'Skonto', type: 'Betrag', length: 8 },
  { index: 13, label: 'Buchungstext', type: 'Text', length: 60 },
  { index: 14, label: 'Postensperre', type: 'Zahl', length: 1 },
  { index: 15, label: 'Diverse Adressnummer', type: 'Text', length: 9 },
  { index: 16, label: 'Geschäftspartnerbank', type: 'Zahl', length: 3 },
  { index: 17, label: 'Sachverhalt', type: 'Zahl', length: 2 },
  { index: 18, label: 'Zinssperre', type: 'Zahl', length: 1 },
  { index: 19, label: 'Beleglink', type: 'Text', length: 210 },
  { index: 20, label: 'Beleginfo - Art 1', type: 'Text', length: 20 },
  { index: 21, label: 'Beleginfo - Inhalt 1', type: 'Text', length: 210 },
  { index: 22, label: 'Beleginfo - Art 2', type: 'Text', length: 20 },
  { index: 23, label: 'Beleginfo - Inhalt 2', type: 'Text', length: 210 },
  { index: 24, label: 'Beleginfo - Art 3', type: 'Text', length: 20 },
  { index: 25, label: 'Beleginfo - Inhalt 3', type: 'Text', length: 210 },
  { index: 26, label: 'Beleginfo - Art 4', type: 'Text', length: 20 },
  { index: 27, label: 'Beleginfo - Inhalt 4', type: 'Text', length: 210 },
  { index: 28, label: 'Beleginfo - Art 5', type: 'Text', length: 20 },
  { index: 29, label: 'Beleginfo - Inhalt 5', type: 'Text', length: 210 },
  { index: 30, label: 'Beleginfo - Art 6', type: 'Text', length: 20 },
  { index: 31, label: 'Beleginfo - Inhalt 6', type: 'Text', length: 210 },
  { index: 32, label: 'Beleginfo - Art 7', type: 'Text', length: 20 },
  { index: 33, label: 'Beleginfo - Inhalt 7', type: 'Text', length: 210 },
  { index: 34, label: 'Beleginfo - Art 8', type: 'Text', length: 20 },
  { index: 35, label: 'Beleginfo - Inhalt 8', type: 'Text', length: 210 },
  { index: 36, label: 'Kost 1 - Kostenstelle', type: 'Text', length: 8 },
  { index: 37, label: 'Kost 2 - Kostenstelle', type: 'Text', length: 8 },
  { index: 38, label: 'Kost-Menge', type: 'Zahl', length: 9 },
  { index: 39, label: 'EU-Land u. UStID', type: 'Text', length: 15 },
  { index: 40, label: 'EU-Steuersatz', type: 'Zahl', length: 2 },
  { index: 41, label: 'Abw. Versteuerungsart', type: 'Text', length: 1 },
  { index: 42, label: 'Sachverhalt L+L', type: 'Zahl', length: 3 },
  { index: 43, label: 'Funktionsergänzung L+L', type: 'Zahl', length: 3 },
  { index: 44, label: 'BU 49 Hauptfunktionstyp', type: 'Zahl', length: 1 },
  { index: 45, label: 'BU 49 Hauptfunktionsnummer', type: 'Zahl', length: 2 },
  { index: 46, label: 'BU 49 Funktionsergänzung', type: 'Zahl', length: 3 },
  { index: 47, label: 'Zusatzinformation - Art 1', type: 'Text', length: 20 },
  { index: 48, label: 'Zusatzinformation- Inhalt 1', type: 'Text', length: 210 },
  { index: 49, label: 'Zusatzinformation - Art 2', type: 'Text', length: 20 },
  { index: 50, label: 'Zusatzinformation- Inhalt 2', type: 'Text', length: 210 },
  { index: 51, label: 'Zusatzinformation - Art 3', type: 'Text', length: 20 },
  { index: 52, label: 'Zusatzinformation- Inhalt 3', type: 'Text', length: 210 },
  { index: 53, label: 'Zusatzinformation - Art 4', type: 'Text', length: 20 },
  { index: 54, label: 'Zusatzinformation- Inhalt 4', type: 'Text', length: 210 },
  { index: 55, label: 'Zusatzinformation - Art 5', type: 'Text', length: 20 },
  { index: 56, label: 'Zusatzinformation- Inhalt 5', type: 'Text', length: 210 },
  { index: 57, label: 'Zusatzinformation - Art 6', type: 'Text', length: 20 },
  { index: 58, label: 'Zusatzinformation- Inhalt 6', type: 'Text', length: 210 },
  { index: 59, label: 'Zusatzinformation - Art 7', type: 'Text', length: 20 },
  { index: 60, label: 'Zusatzinformation- Inhalt 7', type: 'Text', length: 210 },
  { index: 61, label: 'Zusatzinformation - Art 8', type: 'Text', length: 20 },
  { index: 62, label: 'Zusatzinformation- Inhalt 8', type: 'Text', length: 210 },
  { index: 63, label: 'Zusatzinformation - Art 9', type: 'Text', length: 20 },
  { index: 64, label: 'Zusatzinformation- Inhalt 9', type: 'Text', length: 210 },
  { index: 65, label: 'Zusatzinformation - Art 10', type: 'Text', length: 20 },
  { index: 66, label: 'Zusatzinformation- Inhalt 10', type: 'Text', length: 210 },
  { index: 67, label: 'Zusatzinformation - Art 11', type: 'Text', length: 20 },
  { index: 68, label: 'Zusatzinformation- Inhalt 11', type: 'Text', length: 210 },
  { index: 69, label: 'Zusatzinformation - Art 12', type: 'Text', length: 20 },
  { index: 70, label: 'Zusatzinformation- Inhalt 12', type: 'Text', length: 210 },
  { index: 71, label: 'Zusatzinformation - Art 13', type: 'Text', length: 20 },
  { index: 72, label: 'Zusatzinformation- Inhalt 13', type: 'Text', length: 210 },
  { index: 73, label: 'Zusatzinformation - Art 14', type: 'Text', length: 20 },
  { index: 74, label: 'Zusatzinformation- Inhalt 14', type: 'Text', length: 210 },
  { index: 75, label: 'Zusatzinformation - Art 15', type: 'Text', length: 20 },
  { index: 76, label: 'Zusatzinformation- Inhalt 15', type: 'Text', length: 210 },
  { index: 77, label: 'Zusatzinformation - Art 16', type: 'Text', length: 20 },
  { index: 78, label: 'Zusatzinformation- Inhalt 16', type: 'Text', length: 210 },
  { index: 79, label: 'Zusatzinformation - Art 17', type: 'Text', length: 20 },
  { index: 80, label: 'Zusatzinformation- Inhalt 17', type: 'Text', length: 210 },
  { index: 81, label: 'Zusatzinformation - Art 18', type: 'Text', length: 20 },
  { index: 82, label: 'Zusatzinformation- Inhalt 18', type: 'Text', length: 210 },
  { index: 83, label: 'Zusatzinformation - Art 19', type: 'Text', length: 20 },
  { index: 84, label: 'Zusatzinformation- Inhalt 19', type: 'Text', length: 210 },
  { index: 85, label: 'Zusatzinformation - Art 20', type: 'Text', length: 20 },
  { index: 86, label: 'Zusatzinformation- Inhalt 20', type: 'Text', length: 210 },
  { index: 87, label: 'Stück', type: 'Zahl', length: 8 },
  { index: 88, label: 'Gewicht', type: 'Zahl', length: 8 },
  { index: 89, label: 'Zahlweise', type: 'Zahl', length: 2 },
  { index: 90, label: 'Forderungsart', type: 'Text', length: 10 },
  { index: 91, label: 'Veranlagungsjahr', type: 'Zahl', length: 4 },
  { index: 92, label: 'Zugeordnete Fälligkeit', type: 'Datum', length: 8 },
  { index: 93, label: 'Skontotyp', type: 'Zahl', length: 1 },
  { index: 94, label: 'Auftragsnummer', type: 'Text', length: 30 },
  { index: 95, label: 'Buchungstyp', type: 'Text', length: 2 },
  { index: 96, label: 'Ust-Schlüssel (Anzahlungen)', type: 'Zahl', length: 2 },
  { index: 97, label: 'EU-Land (Anzahlungen)', type: 'Text', length: 2 },
  { index: 98, label: 'Sachverhalt L+L (Anzahlungen)', type: 'Zahl', length: 3 },
  { index: 99, label: 'EU-Steuersatz (Anzahlungen)', type: 'Zahl', length: 2 },
  { index: 100, label: 'Erlöskonto (Anzahlungen)', type: 'Konto', length: 9 },
  { index: 101, label: 'Herkunft-Kz', type: 'Text', length: 2 },
  { index: 102, label: 'Buchungs GUID', type: 'Text', length: 36 },
  { index: 103, label: 'Kost-Datum', type: 'Datum', length: 8 },
  { index: 104, label: 'SEPA-Mandatsreferenz', type: 'Text', length: 35 },
  { index: 105, label: 'Skontosperre', type: 'Zahl', length: 1 },
  { index: 106, label: 'Gesellschaftername', type: 'Text', length: 76 },
  { index: 107, label: 'Beteiligtennummer', type: 'Zahl', length: 4 },
  { index: 108, label: 'Identifikationsnummer', type: 'Text', length: 11 },
  { index: 109, label: 'Zeichnernummer', type: 'Text', length: 20 },
];

export function exportToDatev(
  entries: ICashBookEntry[],
  settings: ISettings,
  periodYear?: number,
  periodMonth?: number
): Buffer {
  const isSKR03 = settings.datevChartOfAccounts === 'SKR03';
  const cashAccount = isSKR03 ? '1600' : '1000';
  const createdDate = format(new Date(), 'yyyyMMddHHmmssSSS');

  // Advisor Number: DATEV standard requires 1001 to 9999999 (4-7 digits)
  const advisorRaw = parseInt(String(settings.datevAdvisorNumber || '').trim(), 10);
  const advisorNum = (!isNaN(advisorRaw) && advisorRaw >= 1001 && advisorRaw <= 9999999)
    ? advisorRaw.toString()
    : '1001';

  // Client Number: DATEV standard requires 1 to 99999 (1-5 digits)
  const clientRaw = parseInt(String(settings.datevClientNumber || '').trim(), 10);
  const clientNum = (!isNaN(clientRaw) && clientRaw >= 1 && clientRaw <= 99999)
    ? clientRaw.toString()
    : '1';

  const exportYear = periodYear || (entries.length > 0 ? new Date(entries[0].date).getFullYear() : new Date().getFullYear());
  const wjBeginn = `${exportYear}0101`;

  let datumVon = `${exportYear}0101`;
  let datumBis = `${exportYear}1231`;
  if (periodMonth) {
    const mStr = String(periodMonth).padStart(2, '0');
    const lastDay = new Date(exportYear, periodMonth, 0).getDate();
    datumVon = `${exportYear}${mStr}01`;
    datumBis = `${exportYear}${mStr}${String(lastDay).padStart(2, '0')}`;
  } else if (entries.length > 0) {
    datumVon = format(new Date(entries[0].date), 'yyyyMMdd');
    datumBis = format(new Date(entries[entries.length - 1].date), 'yyyyMMdd');
  }

  const skrCode = isSKR03 ? '"03"' : '"04"';

  // Exactly 31 fields in DATEV Format EXTF Header (Version 700, Format 21, Buchungsstapel)
  const headerFields = [
    '"EXTF"',
    '700',
    '21',
    '"Buchungsstapel"',
    '5',
    createdDate,
    '',
    '"cb"',
    '""',
    '""',
    advisorNum,
    clientNum,
    wjBeginn,
    '4',
    datumVon,
    datumBis,
    '"Kassenbuch"',
    '""',
    '1',
    '0',
    '0',
    '"EUR"',
    '""',
    '""',
    '""',
    '""',
    skrCode,
    '""',
    '""',
    '""',
    '""'
  ];

  // Line 2: All 110 column headers
  const headerRow = DATEV_FIELDS.map(f => `"${f.label}"`).join(';');

  // Line 3+: Data records (110 fields each)
  const dataRows: string[] = [];

  for (const e of entries) {
    const row: string[] = DATEV_FIELDS.map(f => f.type === 'Text' ? '""' : '');

    // 0: Umsatz (ohne Soll/Haben-Kz)
    row[0] = e.amount.toFixed(2).replace('.', ',');

    // 1: Soll/Haben-Kennzeichen
    row[1] = e.type === 'income' ? '"S"' : '"H"';

    // 6: Kontonummer (Kasse)
    row[6] = cashAccount;

    // 7: Gegenkonto (ohne BU-Schlüssel) - Field 8 / Column H in DATEV
    let contraAccount = (e.contraAccount || e.columnH || '').trim();
    if (!contraAccount) {
      const rule = e.bookingRule as any;
      contraAccount = isSKR03 ? rule?.accountSKR03 : rule?.accountSKR04;
      if (!contraAccount) {
        const ruleName = rule?.name || '';
        const defaultMapping = DEFAULT_CONTRA_ACCOUNTS[ruleName];
        contraAccount = isSKR03 ? defaultMapping?.skr03 : defaultMapping?.skr04;
      }
    }
    row[7] = contraAccount || '1360';

    // 9: Belegdatum (TTMM)
    row[9] = format(new Date(e.date), 'ddMM');

    // 10: Belegfeld 1 (Voucher No, max 12 chars)
    const voucher = (e.voucherNo || '').replace(/"/g, '').replace(/;/g, ' ').trim().slice(0, 12);
    row[10] = `"${voucher}"`;

    // 13: Buchungstext (max 60 chars)
    const rawText = e.bookingText || (e.bookingRule as any)?.name || '';
    const cleanText = rawText.replace(/"/g, '').replace(/;/g, ' ').trim().slice(0, 60);
    row[13] = `"${cleanText}"`;

    dataRows.push(row.join(';'));
  }

  const lines = [
    headerFields.join(';'),
    headerRow,
    ...dataRows
  ];

  const csvContent = lines.join('\r\n') + '\r\n';
  return Buffer.from(csvContent, 'latin1');
}
