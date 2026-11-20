export interface BankTransaction {
  id: string;
  bookingDate: string; // ISO date YYYY-MM-DD
  rawDate: string; // Original date e.g. 30.1.2026
  valutaDate?: string;
  transactionType?: string;
  company: string; // Begünstigter / Auftraggeber
  purpose?: string; // Verwendungszweck
  accountNumber: string; // IBAN / Kontonummer
  bic?: string;
  amount: number; // Signed float e.g. 88.06 or -49.15
  currency: string;
  extractedInvoices?: string[]; // Array of invoice numbers extracted strictly from purpose
}

export interface BankStatementMetadata {
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  accountName?: string;
  ownAccountNumber?: string;
  ownIban?: string;
  periodText?: string;
  lastBalance?: number;
  currency?: string;
  totalRecords: number;
}

export interface BankParsedData {
  metadata: BankStatementMetadata;
  transactions: BankTransaction[];
}

/**
 * Extracts invoice numbers from German bank payment reference texts (Verwendungszweck).
 * Examples:
 *   "ReNr 2026R26" -> ["2026R26"]
 *   "Kunden Nr.: 1960 Rechnungsnr.: 2026R27" -> ["2026R27"]
 *   "Rechnung Nr. AR2617318" -> ["AR2617318"]
 *   "ReNr 2026-600268" -> ["2026-600268"]
 *   "KD-Nr. K212923336/ RG-Nr. 151121569381" -> ["151121569381"]
 *   "Rechnungsnummer: 53760151 und Rechnungsnummer: 53765211" -> ["53760151", "53765211"]
 */
export function extractInvoiceNumbersFromPurpose(purpose?: string): string[] {
  if (!purpose) return [];
  const text = purpose.trim();
  const invoices = new Set<string>();

  const patterns = [
    /(?:rechnungs?nummer|rechnungs?-?nr\.?|re\.?-?nr\.?|rg\.?-?nr\.?|renr|rechnung|rnr)\s*[:#.]?\s*([a-zA-Z0-9\/\-_]+)/gi,
    /\b(202[4-6]R\d+)\b/gi,
    /\b(RE\d{4,8})\b/gi,
    /\b(AR\d{4,8})\b/gi,
  ];

  const ignoreWords = new Set(['und', 'vom', 'vom.', 'fällig', 'bezahlt', 'sbetrag', 'abzüglich', 'skonto', 'teilzahlung', 'restsumme', 'monat']);

  for (const pat of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pat.exec(text)) !== null) {
      let inv = match[1]?.trim();
      if (!inv) continue;
      inv = inv.replace(/[,;.:]+$/, '').trim();
      if (inv.length >= 3 && !ignoreWords.has(inv.toLowerCase())) {
        invoices.add(inv);
      }
    }
  }

  return Array.from(invoices);
}

/**
 * Parses German bank CSV statements (e.g. Deutsche Bank / BestKonto / Sparkasse)
 */
export function parseBankCsv(content: string, fileName: string, fileSize: number): BankParsedData {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('Die Datei ist leer oder ungültig.');
  }

  // Find the header row containing "Buchungstag"
  const headerIdx = lines.findIndex(
    (l) => l.toLowerCase().includes('buchungstag') && (l.toLowerCase().includes('begünstigter') || l.toLowerCase().includes('auftraggeber') || l.includes(';'))
  );

  if (headerIdx === -1) {
    throw new Error('Ungültiges Bank-CSV-Format: Kopfzeile "Buchungstag" wurde nicht gefunden.');
  }

  const headerCols = lines[headerIdx].split(';').map((c) => c.trim().toLowerCase());
  
  // Find column indices
  let colDate = headerCols.findIndex((c) => c.includes('buchungstag'));
  let colValuta = headerCols.findIndex((c) => c === 'wert' || c.includes('valuta'));
  let colType = headerCols.findIndex((c) => c.includes('umsatzart'));
  let colCompany = headerCols.findIndex((c) => c.includes('begünstigter') || c.includes('auftraggeber') || c.includes('name'));
  let colPurpose = headerCols.findIndex((c) => c.includes('verwendungszweck'));
  let colAccount = headerCols.findIndex((c) => c.includes('iban') || c.includes('kontonummer'));
  let colBic = headerCols.findIndex((c) => c.includes('bic'));
  let colAmount = headerCols.findIndex((c) => c.includes('betrag'));
  let colCurrency = headerCols.findIndex((c) => c.includes('währung'));

  // Fallbacks if exact name matching differed
  if (colDate === -1) colDate = 0;
  if (colCompany === -1) colCompany = 3;
  if (colAccount === -1) colAccount = 5;
  if (colAmount === -1) colAmount = 11;

  // Extract metadata from lines before header
  const metadata: BankStatementMetadata = {
    fileName,
    fileSize,
    uploadedAt: new Date().toISOString(),
    totalRecords: 0,
  };

  for (let i = 0; i < headerIdx; i++) {
    const rawLine = lines[i];
    const parts = rawLine.split(';').map((p) => p.trim());

    // Account row: BestKonto;350 1292218 00;DE76440700240129221800;EUR
    if (parts.length >= 3 && (parts[1]?.match(/\d{3}/) || parts[2]?.startsWith('DE') || parts[2]?.match(/^[A-Z]{2}\d+/))) {
      metadata.accountName = parts[0];
      metadata.ownAccountNumber = parts[1];
      metadata.ownIban = parts[2];
      if (parts[3]) metadata.currency = parts[3];
    }

    // Period line: e.g. "1.1.2026 - 31.1.2026"
    if (rawLine.match(/\d{1,2}\.\d{1,2}\.\d{4}\s*-\s*\d{1,2}\.\d{4}/)) {
      metadata.periodText = rawLine;
    }

    // Last balance: Letzter Kontostand;;;;21.752,24;EUR
    if (rawLine.toLowerCase().includes('letzter kontostand') || rawLine.toLowerCase().includes('kontostand')) {
      const match = rawLine.match(/([+-]?\d{1,3}(?:\.\d{3})*,\d{2})/);
      if (match) {
        metadata.lastBalance = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      }
    }
  }

  // Parse transaction data lines
  const dataLines = lines.slice(headerIdx + 1);
  const transactions: BankTransaction[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    // Skip summary / footer rows
    if (line.toLowerCase().startsWith('kontostand;') || line.toLowerCase().startsWith('letzter kontostand;')) {
      continue;
    }

    const cols = line.split(';');
    if (cols.length <= Math.max(colDate, colCompany, colAmount)) {
      continue;
    }

    const rawDate = cols[colDate]?.trim() || '';
    if (!rawDate || !rawDate.includes('.')) {
      continue;
    }

    // Convert DD.MM.YYYY to YYYY-MM-DD
    const dateParts = rawDate.split('.').map((p) => parseInt(p, 10));
    let isoDate = '';
    if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
      const day = String(dateParts[0]).padStart(2, '0');
      const month = String(dateParts[1]).padStart(2, '0');
      const year = String(dateParts[2]);
      isoDate = `${year}-${month}-${day}`;
    } else {
      continue; // Not a valid date row
    }

    // Parse amount e.g. -49,15 or 1.267,35 or 700
    const rawAmt = cols[colAmount]?.trim() || '0';
    const cleanedAmt = rawAmt.replace(/\./g, '').replace(',', '.');
    const parsedAmount = parseFloat(cleanedAmt);
    if (isNaN(parsedAmount)) {
      continue;
    }

    const company = cols[colCompany]?.trim() || 'Unbekannt';
    const accountNumber = cols[colAccount]?.trim() || '-';
    const purpose = colPurpose !== -1 ? cols[colPurpose]?.trim() : undefined;
    const transType = colType !== -1 ? cols[colType]?.trim() : undefined;
    const valuta = colValuta !== -1 ? cols[colValuta]?.trim() : undefined;
    const bic = colBic !== -1 ? cols[colBic]?.trim() : undefined;
    const currency = colCurrency !== -1 ? cols[colCurrency]?.trim() || 'EUR' : 'EUR';

    const extractedInvoices = extractInvoiceNumbersFromPurpose(purpose);

    transactions.push({
      id: `tx-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookingDate: isoDate,
      rawDate,
      valutaDate: valuta,
      transactionType: transType,
      company,
      purpose,
      accountNumber,
      bic,
      amount: parsedAmount,
      currency,
      extractedInvoices,
    });
  }

  metadata.totalRecords = transactions.length;

  return {
    metadata,
    transactions,
  };
}
