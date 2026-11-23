import ExcelJS from 'exceljs';

export interface CompanySummaryExportItem {
  company: string;
  ownAccountNumber?: string;
  accountNumber: string;
  periodText: string;
  count: number;
  totalAmount: number;
  currency: string;
  isMultiAccount?: boolean;
}

export interface TransactionExportItem {
  bookingDate: string;
  rawDate?: string;
  ownAccountNumber?: string;
  company: string;
  accountNumber: string;
  transactionType: string;
  purpose?: string;
  amount: number;
  currency: string;
}

/**
 * Exports the Company Summary as a professional Excel (.xlsx) file.
 * - Auto-adjusts column widths based on content
 * - Applies a clean light blue header background
 * - Formats currency and numbers cleanly
 * - Uses clean ASCII/Unicode text with no corrupted characters
 */
export async function exportCompanySummaryToExcel(
  items: CompanySummaryExportItem[],
  fileName: string = `Bank_Zusammenfassung_Unternehmen_${new Date().toISOString().slice(0, 10)}.xlsx`
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cash Book Management System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Zusammenfassung Unternehmen', {
    views: [{ showGridLines: true }],
  });

  // Define columns with clean labels (no special character issues)
  worksheet.columns = [
    { header: 'Unternehmen (Company Name)', key: 'company' },
    { header: 'Bankkonto (Bank Account)', key: 'ownAccount' },
    { header: 'Zugehoerige Kontonummer / IBAN (Associated Account)', key: 'accountNumber' },
    { header: 'Buchungsdatum / Zeitraum (Booking Period)', key: 'period' },
    { header: 'Anzahl Buchungen (Count)', key: 'count' },
    { header: 'Gesamtbetrag (Total Amount EUR)', key: 'totalAmount' },
    { header: 'Waehrung (Currency)', key: 'currency' },
  ];

  // Style header row (Row 1) with light blue background
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF1E3A8A' }, // Deep slate blue for high readability
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDBEAFE' }, // Light blue (Tailwind blue-100)
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: false,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF93C5FD' } },
      bottom: { style: 'medium', color: { argb: 'FF60A5FA' } },
      left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    };
  });

  // Center headers for count & total
  headerRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
  headerRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

  // Populate data rows
  items.forEach((item, index) => {
    const row = worksheet.addRow({
      company: item.company || '',
      ownAccount: item.isMultiAccount ? (item.ownAccountNumber || '-') : '',
      accountNumber: item.accountNumber && item.accountNumber !== '-' ? item.accountNumber : '-',
      period: item.periodText || '',
      count: item.count,
      totalAmount: item.totalAmount,
      currency: item.currency || 'EUR',
    });

    row.height = 22;

    // Formatting individual cells
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = { vertical: 'middle' };

      // Alternating row background for clean readability
      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }, // Very subtle slate-50
        };
      }

      // Format Count column
      if (colNumber === 5) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '#,##0';
      }

      // Format Total Amount column
      if (colNumber === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: item.totalAmount >= 0 ? 'FF059669' : 'FFDC2626' }, // Emerald / Rose
        };
      }

      // Format Currency column
      if (colNumber === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  // Auto-adjust column widths based on longest cell content
  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const val = cell.value !== undefined && cell.value !== null ? String(cell.value) : '';
      if (val.length > maxLen) {
        maxLen = val.length;
      }
    });
    // Add margin for aesthetics and prevent cell clipping
    column.width = Math.max(maxLen + 4, 15);
  });

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports All Bank Transactions as a styled Excel (.xlsx) file.
 */
export async function exportAllTransactionsToExcel(
  items: TransactionExportItem[],
  fileName: string = `Bank_Alle_Buchungen_${new Date().toISOString().slice(0, 10)}.xlsx`
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cash Book Management System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Alle Buchungen', {
    views: [{ showGridLines: true }],
  });

  worksheet.columns = [
    { header: 'Buchungstag (Date)', key: 'date' },
    { header: 'Bankkonto (Bank Account)', key: 'ownAccount' },
    { header: 'Unternehmen (Company Name)', key: 'company' },
    { header: 'Kontonummer / IBAN (Account / IBAN)', key: 'accountNumber' },
    { header: 'Umsatzart (Transaction Type)', key: 'type' },
    { header: 'Verwendungszweck (Purpose / Details)', key: 'purpose' },
    { header: 'Betrag (Amount EUR)', key: 'amount' },
    { header: 'Waehrung (Currency)', key: 'currency' },
  ];

  // Style header row (Row 1) with light blue background
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF1E3A8A' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDBEAFE' }, // Light blue
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF93C5FD' } },
      bottom: { style: 'medium', color: { argb: 'FF60A5FA' } },
      left: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      right: { style: 'thin', color: { argb: 'FFBFDBFE' } },
    };
  });

  headerRow.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
  headerRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

  items.forEach((item, index) => {
    const row = worksheet.addRow({
      date: item.rawDate || item.bookingDate || '',
      ownAccount: item.ownAccountNumber || '',
      company: item.company || '',
      accountNumber: item.accountNumber || '-',
      type: item.transactionType || '',
      purpose: item.purpose || '',
      amount: item.amount,
      currency: item.currency || 'EUR',
    });

    row.height = 22;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = { vertical: 'middle' };

      if (index % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }

      if (colNumber === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: item.amount >= 0 ? 'FF059669' : 'FFDC2626' },
        };
      }

      if (colNumber === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  worksheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const val = cell.value !== undefined && cell.value !== null ? String(cell.value) : '';
      if (val.length > maxLen) {
        maxLen = val.length;
      }
    });
    column.width = Math.max(maxLen + 4, 15);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
