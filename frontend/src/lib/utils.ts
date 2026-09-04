import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguageStore } from '../store/languageStore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  const lang = useLanguageStore.getState().language;
  const locale = lang === 'en' ? 'en-US' : 'de-DE';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const lang = useLanguageStore.getState().language;
  const dateObj = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  const formatStr = lang === 'en' ? 'MM/dd/yyyy' : 'dd.MM.yyyy';
  const locale = lang === 'en' ? enUS : de;
  return format(dateObj, formatStr, { locale });
}

export function formatDateForInput(dateStr: string): string {
  if (!dateStr) return '';
  return format(typeof dateStr === 'string' ? parseISO(dateStr) : dateStr, 'yyyy-MM-dd');
}

export function getMonthName(monthNumber: number): string {
  return useLanguageStore.getState().getMonthName(monthNumber);
}

export function getMonthShort(monthNumber: number): string {
  return useLanguageStore.getState().getMonthShort(monthNumber);
}

/**
 * Automatically formats a numeric input string with commas as thousand separators (every 3 digits).
 * Supports typing decimals with '.' or ','.
 * e.g. "20000" -> "20,000", "2000000" -> "2,000,000", "20000.50" -> "20,000.50"
 */
export function formatAmountWithCommas(raw: string): string {
  if (!raw) return '';

  let val = raw.trim();

  // Handle European comma decimal: if ends with comma and has no dot, convert to dot
  if (!val.includes('.') && val.endsWith(',')) {
    val = val.slice(0, -1) + '.';
  } else if (!val.includes('.') && /,\d{1,2}$/.test(val) && (val.match(/,/g) || []).length === 1) {
    // Exactly one comma followed by 1 or 2 digits at the end (e.g. "20000,50")
    val = val.replace(',', '.');
  }

  // Check if decimal point exists
  const hasDot = val.includes('.');
  const parts = val.replace(/,/g, '').split('.');

  // Integer part: keep digits only
  let intStr = parts[0].replace(/\D/g, '');
  // Remove multiple leading zeros (keep single '0')
  if (intStr.length > 1 && intStr.startsWith('0')) {
    intStr = intStr.replace(/^0+/, '') || '0';
  }

  const formattedInt = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (hasDot) {
    const decStr = (parts[1] ?? '').replace(/\D/g, '').slice(0, 2);
    const prefix = formattedInt || '0';
    return `${prefix}.${decStr}`;
  }

  return formattedInt;
}

export function parseFormattedAmount(formatted: string): number {
  if (!formatted) return 0;
  const clean = formatted.replace(/,/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}
