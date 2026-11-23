import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanySummaryExportItem, TransactionExportItem } from './excelExport';

/**
 * Formats a number to German currency string (e.g. 1.250,50)
 */
function formatAmount(val: number): string {
  const isNeg = val < 0;
  const abs = Math.abs(val);
  const parts = abs.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = `${intPart},${parts[1]}`;
  return isNeg ? `-${formatted}` : formatted;
}

/**
 * Formats generated date and time e.g. "11/22/2026 14:07:19"
 */
function formatGeneratedDateTime(d: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

function getAccountLabel(accId: string): string {
  return accId.trim();
}

export interface PdfExportMetadata {
  accountName?: string;
  ownAccountNumber?: string;
  periodText?: string;
  language?: 'de' | 'en';
}

/**
 * Exports the Company Summary table as a styled, professional PDF (Landscape A4).
 * - When multiple accounts are present (e.g. 350_1292218_00 & 350_1292218_01):
 *   Separately groups each account with a clear section banner for easy identification.
 * - Single combined grand total at the very end of the report (no separate totals).
 * - Excludes the Bank Account column.
 * - Includes exact Generated date and timestamp.
 */
export function exportCompanySummaryToPdf(
  items: CompanySummaryExportItem[],
  metadata: PdfExportMetadata = {},
  fileName: string = `Bank_Zusammenfassung_Unternehmen_${new Date().toISOString().slice(0, 10)}.pdf`
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const isDe = metadata.language !== 'en';
  const totalAmount = items.reduce((sum, it) => sum + it.totalAmount, 0);
  const totalCount = items.reduce((sum, it) => sum + it.count, 0);

  // Identify distinct bank accounts present
  const distinctAccounts = Array.from(
    new Set(
      items
        .map((it) => it.ownAccountNumber?.trim())
        .filter((id): id is string => Boolean(id) && id !== '-')
    )
  ).sort();

  const hasMultipleAccounts = distinctAccounts.length > 1;

  // Document Title Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(
    isDe ? 'Bankauszug – Zusammenfassung nach Unternehmen' : 'Bank Statement – Summary by Company',
    14,
    15
  );

  // Subtitle / Meta information
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500

  const accountDisplay = hasMultipleAccounts
    ? `${isDe ? 'Konten' : 'Accounts'}: ${distinctAccounts.join(', ')}`
    : metadata.ownAccountNumber
    ? `${isDe ? 'Konto' : 'Account'}: ${metadata.ownAccountNumber}`
    : '';

  const metaLine1 = [
    accountDisplay,
    metadata.periodText ? `${isDe ? 'Zeitraum' : 'Period'}: ${metadata.periodText}` : '',
    `Generated: ${formatGeneratedDateTime()}`,
  ]
    .filter(Boolean)
    .join('   |   ');

  doc.text(metaLine1, 14, 21);

  // Table Columns (6 columns - Bank Account column removed)
  const head = [
    [
      isDe ? 'Unternehmen (Company Name)' : 'Company Name',
      isDe ? 'Zugehörige Kontonummer / IBAN' : 'Associated Account / IBAN',
      isDe ? 'Buchungsdatum / Zeitraum' : 'Dates / Period',
      isDe ? 'Anzahl' : 'Count',
      isDe ? 'Gesamtbetrag (EUR)' : 'Total Amount (EUR)',
      isDe ? 'Währung' : 'Currency',
    ],
  ];

  // Build Table Body Rows (separated by account if multiple exist, without separate totals)
  let body: any[] = [];

  if (hasMultipleAccounts) {
    distinctAccounts.forEach((accId) => {
      const accItems = items.filter((it) => (it.ownAccountNumber || '').trim() === accId);
      if (accItems.length === 0) return;

      const accTitle = getAccountLabel(accId);
      const countLabel = `${accItems.length} ${isDe ? (accItems.length === 1 ? 'Eintrag' : 'Einträge') : (accItems.length === 1 ? 'record' : 'records')}`;

      // Section Header row spanning all 6 columns for easy identification
      body.push([
        {
          content: `${isDe ? 'Bankkonto' : 'Bank Account'}: ${accTitle}   •   ${countLabel}`,
          colSpan: 6,
          styles: {
            fillColor: [238, 242, 255], // Soft indigo tint (#EEF2FF)
            textColor: [49, 46, 129], // Deep indigo (#312E81)
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left',
            cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
          },
        },
      ]);

      accItems.forEach((item) => {
        body.push([
          item.company || '',
          item.accountNumber && item.accountNumber !== '-' ? item.accountNumber : '-',
          item.periodText || '',
          item.count.toString(),
          formatAmount(item.totalAmount),
          item.currency || 'EUR',
        ]);
      });
    });

    const otherItems = items.filter(
      (it) => !it.ownAccountNumber || !distinctAccounts.includes(it.ownAccountNumber.trim())
    );
    if (otherItems.length > 0) {
      body.push([
        {
          content: `${isDe ? 'Weitere Buchungen' : 'Other Entries'}   •   ${otherItems.length} ${isDe ? 'Einträge' : 'records'}`,
          colSpan: 6,
          styles: {
            fillColor: [241, 245, 249],
            textColor: [71, 85, 105],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left',
            cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
          },
        },
      ]);
      otherItems.forEach((item) => {
        body.push([
          item.company || '',
          item.accountNumber && item.accountNumber !== '-' ? item.accountNumber : '-',
          item.periodText || '',
          item.count.toString(),
          formatAmount(item.totalAmount),
          item.currency || 'EUR',
        ]);
      });
    }
  } else {
    body = items.map((item) => [
      item.company || '',
      item.accountNumber && item.accountNumber !== '-' ? item.accountNumber : '-',
      item.periodText || '',
      item.count.toString(),
      formatAmount(item.totalAmount),
      item.currency || 'EUR',
    ]);
  }

  // Single combined grand total at the bottom of the entire report
  const foot = [
    [
      isDe ? 'Gesamtsumme' : 'Total',
      '',
      '',
      totalCount.toString(),
      formatAmount(totalAmount),
      'EUR',
    ],
  ];

  autoTable(doc, {
    startY: 26,
    head,
    body,
    foot,
    showFoot: 'lastPage', // Only display total on the last page
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [226, 232, 240], // slate-200
      lineWidth: 0.1,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [219, 234, 254], // Light blue (#DBEAFE) matching UI
      textColor: [30, 58, 138], // Deep navy slate (#1E3A8A)
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    footStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { cellWidth: 76, fontStyle: 'bold' },                  // Company Name
      1: { cellWidth: 62 },                                    // Counterparty IBAN
      2: { cellWidth: 54 },                                    // Date / Period
      3: { cellWidth: 18, halign: 'center' },                  // Count
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }, // Total Amount
      5: { cellWidth: 24, halign: 'center' },                  // Currency
    },
    didParseCell: (data) => {
      // Header alignments
      if (data.section === 'head') {
        if (data.column.index === 3 || data.column.index === 5) {
          data.cell.styles.halign = 'center';
        } else if (data.column.index === 4) {
          data.cell.styles.halign = 'right';
        }
      }
      // Color positive amounts green and negative amounts red
      if (data.section === 'body' && (data.cell as any).colSpan === 1 && data.column.index === 4) {
        const rawVal = data.cell.raw;
        if (typeof rawVal === 'string') {
          if (rawVal.startsWith('-')) {
            data.cell.styles.textColor = [220, 38, 38]; // rose-600
          } else if (rawVal !== '0,00' && rawVal !== '0') {
            data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          }
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `${isDe ? 'Seite' : 'Page'} ${data.pageNumber} / ${pageCount}`,
        doc.internal.pageSize.width - 25,
        doc.internal.pageSize.height - 8
      );
    },
  });

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/**
 * Exports All Transactions table as a styled, professional PDF (Landscape A4).
 * - When multiple accounts are present: Separately sections each account.
 * - Single combined grand total at the very end of the report (no separate totals).
 * - Excludes Bank Account column.
 * - Includes exact Generated date and timestamp.
 */
export function exportAllTransactionsToPdf(
  items: TransactionExportItem[],
  metadata: PdfExportMetadata = {},
  fileName: string = `Bank_Alle_Buchungen_${new Date().toISOString().slice(0, 10)}.pdf`
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const isDe = metadata.language !== 'en';
  const totalAmount = items.reduce((sum, it) => sum + it.amount, 0);

  const distinctAccounts = Array.from(
    new Set(
      items
        .map((it) => it.ownAccountNumber?.trim())
        .filter((id): id is string => Boolean(id) && id !== '-')
    )
  ).sort();

  const hasMultipleAccounts = distinctAccounts.length > 1;

  // Document Title Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(
    isDe ? 'Bankauszug – Alle Buchungen' : 'Bank Statement – All Transactions',
    14,
    15
  );

  // Subtitle with Generated Date & Time
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);

  const accountDisplay = hasMultipleAccounts
    ? `${isDe ? 'Konten' : 'Accounts'}: ${distinctAccounts.join(', ')}`
    : metadata.ownAccountNumber
    ? `${isDe ? 'Konto' : 'Account'}: ${metadata.ownAccountNumber}`
    : '';

  const metaLine = [
    accountDisplay,
    `${items.length} ${isDe ? 'Buchungen' : 'transactions'}`,
    `${isDe ? 'Netto' : 'Net'}: ${formatAmount(totalAmount)} EUR`,
    `Generated: ${formatGeneratedDateTime()}`,
  ]
    .filter(Boolean)
    .join('   |   ');

  doc.text(metaLine, 14, 21);

  // Columns (6 columns - Bank Account column removed)
  const head = [
    [
      isDe ? 'Datum' : 'Date',
      isDe ? 'Unternehmen (Company Name)' : 'Company Name',
      isDe ? 'Kontonummer / IBAN' : 'Account / IBAN',
      isDe ? 'Umsatzart' : 'Type',
      isDe ? 'Verwendungszweck' : 'Purpose / Details',
      isDe ? 'Betrag (EUR)' : 'Amount (EUR)',
    ],
  ];

  let body: any[] = [];

  if (hasMultipleAccounts) {
    distinctAccounts.forEach((accId) => {
      const accItems = items.filter((it) => (it.ownAccountNumber || '').trim() === accId);
      if (accItems.length === 0) return;

      const accTitle = getAccountLabel(accId);
      const countLabel = `${accItems.length} ${isDe ? (accItems.length === 1 ? 'Buchung' : 'Buchungen') : (accItems.length === 1 ? 'transaction' : 'transactions')}`;

      body.push([
        {
          content: `${isDe ? 'Bankkonto' : 'Bank Account'}: ${accTitle}   •   ${countLabel}`,
          colSpan: 6,
          styles: {
            fillColor: [238, 242, 255],
            textColor: [49, 46, 129],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left',
            cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
          },
        },
      ]);

      accItems.forEach((tx) => {
        body.push([
          tx.rawDate || tx.bookingDate || '',
          tx.company || '',
          tx.accountNumber || '-',
          tx.transactionType || '',
          tx.purpose || '',
          formatAmount(tx.amount),
        ]);
      });
    });

    const otherItems = items.filter(
      (it) => !it.ownAccountNumber || !distinctAccounts.includes(it.ownAccountNumber.trim())
    );
    if (otherItems.length > 0) {
      body.push([
        {
          content: `${isDe ? 'Weitere Buchungen' : 'Other Entries'}   •   ${otherItems.length} ${isDe ? 'Buchungen' : 'transactions'}`,
          colSpan: 6,
          styles: {
            fillColor: [241, 245, 249],
            textColor: [71, 85, 105],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'left',
            cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
          },
        },
      ]);
      otherItems.forEach((tx) => {
        body.push([
          tx.rawDate || tx.bookingDate || '',
          tx.company || '',
          tx.accountNumber || '-',
          tx.transactionType || '',
          tx.purpose || '',
          formatAmount(tx.amount),
        ]);
      });
    }
  } else {
    body = items.map((tx) => [
      tx.rawDate || tx.bookingDate || '',
      tx.company || '',
      tx.accountNumber || '-',
      tx.transactionType || '',
      tx.purpose || '',
      formatAmount(tx.amount),
    ]);
  }

  // Single combined grand total at the bottom
  const foot = [
    [
      isDe ? 'Gesamtsumme' : 'Total',
      '',
      '',
      '',
      `${items.length} ${isDe ? 'Buchungen' : 'items'}`,
      formatAmount(totalAmount),
    ],
  ];

  autoTable(doc, {
    startY: 26,
    head,
    body,
    foot,
    showFoot: 'lastPage',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [219, 234, 254], // Light blue (#DBEAFE)
      textColor: [30, 58, 138],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 26 },                                    // Date
      1: { cellWidth: 60, fontStyle: 'bold' },                  // Company Name
      2: { cellWidth: 55 },                                    // Account / IBAN
      3: { cellWidth: 35 },                                    // Type
      4: { cellWidth: 60 },                                    // Purpose
      5: { cellWidth: 33, halign: 'right', fontStyle: 'bold' }, // Amount
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 5) {
        data.cell.styles.halign = 'right';
      }
      if (data.section === 'body' && (data.cell as any).colSpan === 1 && data.column.index === 5) {
        const rawVal = data.cell.raw;
        if (typeof rawVal === 'string') {
          if (rawVal.startsWith('-')) {
            data.cell.styles.textColor = [220, 38, 38];
          } else if (rawVal !== '0,00' && rawVal !== '0') {
            data.cell.styles.textColor = [5, 150, 105];
          }
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `${isDe ? 'Seite' : 'Page'} ${data.pageNumber} / ${pageCount}`,
        doc.internal.pageSize.width - 25,
        doc.internal.pageSize.height - 8
      );
    },
  });

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}
