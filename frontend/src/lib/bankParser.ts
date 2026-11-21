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
  ownAccountNumber?: string; // Bank account: e.g. "350_1292218_00" or "350_1292218_01"
  sourceFileName?: string;
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

export function normalizeBankAccountId(acc?: string, fileName?: string, iban?: string): string {
  // 1. Direct check on account number field (e.g. "350 1292218 01" or "350 1292218 00")
  const rawAcc = (acc || '').replace(/[\s\-_]/g, '');
  if (rawAcc.includes('350129221801') || rawAcc.endsWith('129221801')) {
    return '350_1292218_01';
  }
  if (rawAcc.includes('350129221800') || rawAcc.endsWith('129221800')) {
    return '350_1292218_00';
  }

  // 2. Check IBAN (e.g. DE49440700240129221801 or DE76440700240129221800)
  const rawIban = (iban || '').replace(/[\s\-_]/g, '').toUpperCase();
  if (rawIban.endsWith('0129221801') || rawIban.includes('0129221801')) {
    return '350_1292218_01';
  }
  if (rawIban.endsWith('0129221800') || rawIban.includes('0129221800')) {
    return '350_1292218_00';
  }

  // 3. Check filename pattern (e.g. Kontoumsaetze_350_1292218_01_... or Kontoumsaetze_350_1292218_00_...)
  const fName = (fileName || '').toLowerCase();
  if (fName.match(/1292218[\s_-]*01\b/) || fName.includes('1292218_01') || fName.includes('1292218-01')) {
    return '350_1292218_01';
  }
  if (fName.match(/1292218[\s_-]*00\b/) || fName.includes('1292218_00') || fName.includes('1292218-00')) {
    return '350_1292218_00';
  }

  if (acc) {
    const cleaned = acc.trim().replace(/\s+/g, '_');
    if (cleaned) return cleaned;
  }
  return '';
}

/**
 * Parses a single CSV line taking quoted delimiters into account.
 * Handles standard CSV escaping (e.g. "field;with;semicolon" or "field ""with"" quotes").
 */
export function splitCsvLine(line: string, delimiter = ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Normalizes 2-digit or 4-digit German dates into YYYY-MM-DD.
 * Supports:
 *   "28.12.18" -> "2018-12-28"
 *   "01.03.2018" -> "2018-03-01"
 *   "28.12.2018" -> "2018-12-28"
 *   "2018-12-28" -> "2018-12-28"
 */
export function normalizeDateToIso(rawDate: string): { isoDate: string; rawDate: string } | null {
  if (!rawDate) return null;
  const clean = rawDate.replace(/^"+|"+$/g, '').trim();
  if (!clean) return null;

  // Already ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return { isoDate: clean, rawDate: clean };
  }

  // DD.MM.YY or DD.MM.YYYY
  const dotParts = clean.split('.');
  if (dotParts.length === 3) {
    const day = parseInt(dotParts[0], 10);
    const month = parseInt(dotParts[1], 10);
    let year = parseInt(dotParts[2], 10);

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      if (year < 100) {
        year = year >= 70 ? 1900 + year : 2000 + year;
      }
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(month).padStart(2, '0');
      const yearStr = String(year);
      return {
        isoDate: `${yearStr}-${monthStr}-${dayStr}`,
        rawDate: `${dayStr}.${monthStr}.${yearStr}`,
      };
    }
  }

  return null;
}

/**
 * Parses German bank CSV statements (e.g. Deutsche Bank / BestKonto / Sparkasse / Postbank)
 * Flexible column matching and order-independent parsing.
 */
export function parseBankCsv(content: string, fileName: string, fileSize: number): BankParsedData {
  const rawLines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    throw new Error('Die Datei ist leer oder ungültig.');
  }

  // Detect delimiter (semicolon or comma)
  const firstFew = rawLines.slice(0, 10).join('\n');
  const delimiter = firstFew.split(';').length >= firstFew.split(',').length ? ';' : ',';

  // Find the header row containing "Buchungstag" or "Datum"
  const headerIdx = rawLines.findIndex((l) => {
    const lower = l.toLowerCase();
    const hasDateCol = lower.includes('buchungstag') || lower.includes('buchungsdatum') || lower.includes('datum');
    const hasOtherCols =
      lower.includes('betrag') ||
      lower.includes('beguenstigter') ||
      lower.includes('begünstigter') ||
      lower.includes('auftraggeber') ||
      lower.includes('verwendungszweck') ||
      lower.includes('umsatz');
    return hasDateCol && hasOtherCols;
  });

  if (headerIdx === -1) {
    throw new Error('Ungültiges Bank-CSV-Format: Kopfzeile mit Buchungsdaten wurde nicht gefunden.');
  }

  const headerCols = splitCsvLine(rawLines[headerIdx], delimiter).map((c) =>
    c.replace(/^"+|"+$/g, '').trim().toLowerCase()
  );

  // Column matching with comprehensive aliases for German bank variants
  const findCol = (keywords: string[]): number => {
    return headerCols.findIndex((col) => keywords.some((kw) => col.includes(kw)));
  };

  const colDate = findCol(['buchungstag', 'buchungsdatum', 'valutadatum', 'datum']);
  const colValuta = findCol(['valutadatum', 'wertstellung', 'wert']);
  const colType = findCol(['buchungstext', 'umsatzart', 'vorgang', 'art']);
  const colCompany = findCol([
    'beguenstigter',
    'begünstigter',
    'zahlungspflichtiger',
    'auftraggeber',
    'empfänger',
    'empfaenger',
    'name',
    'partner',
  ]);
  const colPurpose = findCol(['verwendungszweck', 'beschreibung', 'notiz', 'details', 'text']);
  const colAccount = findCol(['kontonummer', 'iban', 'kontonr', 'konto']);
  const colBic = findCol(['blz', 'bic', 'bankleitzahl', 'swift']);
  const colAmount = findCol(['betrag', 'amount', 'umsatz']);
  const colCurrency = findCol(['waehrung', 'währung', 'currency']);
  const colOwnAccount = findCol(['auftragskonto', 'eigenes konto', 'quellkonto', 'kontoinhaber']);

  // Extract metadata from lines before header
  const metadata: BankStatementMetadata = {
    fileName,
    fileSize,
    uploadedAt: new Date().toISOString(),
    totalRecords: 0,
  };

  for (let i = 0; i < headerIdx; i++) {
    const rawLine = rawLines[i];
    const parts = splitCsvLine(rawLine, delimiter).map((p) => p.replace(/^"+|"+$/g, '').trim());

    // Account row: BestKonto;350 1292218 00;DE76440700240129221800;EUR
    if (parts.length >= 3 && (parts[1]?.match(/\d{3}/) || parts[2]?.startsWith('DE') || parts[2]?.match(/^[A-Z]{2}\d+/))) {
      metadata.accountName = parts[0];
      metadata.ownAccountNumber = parts[1];
      metadata.ownIban = parts[2];
      if (parts[3]) metadata.currency = parts[3];
    }

    // Period line: e.g. "1.1.2026 - 31.1.2026"
    if (rawLine.match(/\d{1,2}\.\d{1,2}\.\d{2,4}\s*-\s*\d{1,2}\.\d{1,2}\.\d{2,4}/)) {
      metadata.periodText = rawLine.replace(/^"+|"+$/g, '').trim();
    }

    // Last balance: Letzter Kontostand;;;;21.752,24;EUR
    if (rawLine.toLowerCase().includes('letzter kontostand') || rawLine.toLowerCase().includes('kontostand')) {
      const match = rawLine.match(/([+-]?\d{1,3}(?:\.\d{3})*,\d{2})/);
      if (match) {
        metadata.lastBalance = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      }
    }
  }

  const detectedAccount = normalizeBankAccountId(metadata.ownAccountNumber, fileName, metadata.ownIban);
  if (detectedAccount) {
    metadata.ownAccountNumber = detectedAccount;
  }

  // Parse transaction data lines
  const dataLines = rawLines.slice(headerIdx + 1);
  const transactions: BankTransaction[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const lower = line.toLowerCase();

    // Skip summary / footer rows
    if (
      lower.startsWith('"kontostand;') ||
      lower.startsWith('kontostand;') ||
      lower.startsWith('"letzter kontostand') ||
      lower.startsWith('letzter kontostand')
    ) {
      continue;
    }

    const cols = splitCsvLine(line, delimiter).map((c) => c.replace(/^"+|"+$/g, '').trim());
    if (cols.length <= Math.max(colDate >= 0 ? colDate : 0, colAmount >= 0 ? colAmount : 0)) {
      continue;
    }

    // Capture own account from first data row if present (e.g. Sparkasse "Auftragskonto" column)
    if (colOwnAccount !== -1 && cols[colOwnAccount] && !metadata.ownIban) {
      const ownVal = cols[colOwnAccount];
      if (ownVal.startsWith('DE') || ownVal.length > 10) {
        metadata.ownIban = ownVal;
      }
      if (!metadata.ownAccountNumber) {
        metadata.ownAccountNumber = ownVal;
      }
    }

    const rawDateVal = colDate !== -1 ? cols[colDate] : '';
    const dateParsed = normalizeDateToIso(rawDateVal);
    if (!dateParsed) {
      continue; // Skip invalid or non-date rows
    }

    // Parse amount e.g. -500,00 or 1.000,00 or 511,70 or -49,15
    const rawAmt = colAmount !== -1 ? cols[colAmount] : '0';
    const cleanedAmt = rawAmt.replace(/\./g, '').replace(',', '.');
    const parsedAmount = parseFloat(cleanedAmt);
    if (isNaN(parsedAmount)) {
      continue;
    }

    let company = colCompany !== -1 ? cols[colCompany] : '';
    const accountNumber = colAccount !== -1 && cols[colAccount] ? cols[colAccount] : '-';
    const purpose = colPurpose !== -1 ? cols[colPurpose] : undefined;
    const transType = colType !== -1 ? cols[colType] : undefined;
    const valutaRaw = colValuta !== -1 ? cols[colValuta] : undefined;
    const valutaParsed = valutaRaw ? normalizeDateToIso(valutaRaw)?.isoDate : undefined;
    const bic = colBic !== -1 ? cols[colBic] : undefined;
    const currency = colCurrency !== -1 && cols[colCurrency] ? cols[colCurrency] : (metadata.currency || 'EUR');

    // If company is empty (e.g. for Bank Entgeltabschluss, Zinsen, Bargeldeinzahlung),
    // derive a clean, readable name from transType or purpose
    if (!company) {
      if (transType && transType.trim()) {
        company = transType.trim();
      } else if (purpose) {
        const lowerPurp = purpose.toLowerCase();
        if (lowerPurp.includes('entgelt') || lowerPurp.includes('abrechnung') || lowerPurp.includes('kontoführung')) {
          company = 'Bankentgelt / Gebühren';
        } else if (lowerPurp.includes('bargeld') || lowerPurp.includes('einzahlung')) {
          company = 'Bargeldeinzahlung';
        } else if (lowerPurp.includes('rechnungsparkassen-card')) {
          company = 'Sparkassen-Card Gebühr';
        } else {
          company = 'Bankgebühren / Sonstiges';
        }
      } else {
        company = 'Bankgebühren / Sonstiges';
      }
    }

    const extractedInvoices = extractInvoiceNumbersFromPurpose(purpose);

    transactions.push({
      id: `tx-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      bookingDate: dateParsed.isoDate,
      rawDate: dateParsed.rawDate,
      valutaDate: valutaParsed,
      transactionType: transType,
      company: company.trim(),
      purpose,
      accountNumber: accountNumber.trim() || '-',
      bic: bic?.trim(),
      amount: parsedAmount,
      currency,
      extractedInvoices,
      ownAccountNumber: detectedAccount || metadata.ownAccountNumber,
      sourceFileName: fileName,
    });
  }

  // Calculate period text from min and max transaction dates if not present in metadata
  if (!metadata.periodText && transactions.length > 0) {
    const dates = transactions.map((t) => t.bookingDate).sort();
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    metadata.periodText = `${earliest} - ${latest}`;
  }

  metadata.totalRecords = transactions.length;

  return {
    metadata,
    transactions,
  };
}
