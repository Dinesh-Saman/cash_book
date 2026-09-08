import { useEffect, useState, useRef } from 'react';
import { reportsApi, exportsApi } from '../lib/api';
import { useTranslation } from '../store/languageStore';
import { translateBookingRuleName } from '../lib/i18n/translations';
import CustomSelect from '../components/ui/CustomSelect';
import { Download, FileText, FileSpreadsheet, FileCode, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CashBookEntry } from '../types';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const MONTH_INDICES = Array.from({ length: 12 }, (_, i) => i + 1);

const VAT_COLORS: Record<number, string> = {
  0: 'bg-slate-100 text-slate-700 border border-slate-200',
  7: 'bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold',
  19: 'bg-brand-50 text-brand-700 border border-brand-200/80 font-semibold',
};

export default function MonthlyReportPage() {
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // Helper to compute default month bounds
  const getMonthDateBounds = (y: number, m: number) => {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  };

  const initialBounds = getMonthDateBounds(CURRENT_YEAR, new Date().getMonth() + 1);
  const [startDate, setStartDate] = useState(initialBounds.start);
  const [endDate, setEndDate] = useState(initialBounds.end);

  const [entries, setEntries] = useState<CashBookEntry[]>([]);
  const [startBalance, setStartBalance] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { t, formatCurrency, getMonthName, formatDate, language } = useTranslation();

  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const el = mobileContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };

    updateWidth();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });

    ro.observe(el);
    window.addEventListener('resize', updateWidth);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const availableWidth = containerWidth > 0
    ? containerWidth
    : typeof window !== 'undefined'
    ? Math.max(300, window.innerWidth - 26)
    : 360;

  const colDateWidth = Math.max(82, Math.round(availableWidth * 0.28));
  const remainingWidth = Math.max(160, availableWidth - colDateWidth);
  const colIncomeWidth = Math.floor(remainingWidth / 2);
  const colExpenseWidth = remainingWidth - colIncomeWidth;

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    const bounds = getMonthDateBounds(newYear, month);
    setStartDate(bounds.start);
    setEndDate(bounds.end);
  };

  const handleMonthChange = (newMonth: number) => {
    setMonth(newMonth);
    const bounds = getMonthDateBounds(year, newMonth);
    setStartDate(bounds.start);
    setEndDate(bounds.end);
  };

  const resetToFullMonth = () => {
    const bounds = getMonthDateBounds(year, month);
    setStartDate(bounds.start);
    setEndDate(bounds.end);
  };

  const isCustomRange = (() => {
    const bounds = getMonthDateBounds(year, month);
    return startDate !== bounds.start || endDate !== bounds.end;
  })();

  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries
    .filter((e) => e.type === 'expense')
    .reduce((s, e) => s + e.amount, 0);
  const endBalance = entries.length > 0 ? entries[entries.length - 1].cashBalance : startBalance;

  useEffect(() => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    reportsApi
      .monthly(year, month, startDate, endDate)
      .then((res) => {
        const d = res.data.data;
        setEntries(d?.entries || []);
        setStartBalance(d?.startBalance ?? 0);
        setIsFinalized(d?.isFinalized ?? false);
      })
      .catch(() => {
        setEntries([]);
        setStartBalance(0);
      })
      .finally(() => setIsLoading(false));
  }, [year, month, startDate, endDate]);

  const handleExport = async (type: 'pdf' | 'excel' | 'xml' | 'datev') => {
    setIsExporting(true);
    try {
      if (type === 'pdf') await exportsApi.downloadPDF(year, month, language, startDate, endDate);
      else if (type === 'excel') await exportsApi.downloadExcel(year, month, language, startDate, endDate);
      else if (type === 'xml') await exportsApi.downloadXML(year, month, language, startDate, endDate);
      else await exportsApi.downloadDatev(year, month, language, startDate, endDate);
      toast.success(t('btnExport'));
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Exportieren' : 'Export error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-center sm:text-left w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('monthlyReportTitle')}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">
            {isCustomRange && startDate && endDate
              ? `${formatDate(startDate)} – ${formatDate(endDate)} (${getMonthName(month)} ${year})`
              : `${getMonthName(month)} ${year}`}
          </p>
        </div>
        <div className="grid grid-cols-4 sm:flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {[
            { label: 'PDF', icon: FileText, type: 'pdf' },
            { label: 'Excel', icon: FileSpreadsheet, type: 'excel' },
            { label: 'XML', icon: FileCode, type: 'xml' },
            { label: 'DATEV', icon: Download, type: 'datev' },
          ].map((e) => (
            <button
              key={e.type}
              onClick={() => handleExport(e.type as any)}
              disabled={isExporting || entries.length === 0}
              className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 shadow-xs disabled:opacity-40 disabled:pointer-events-none"
            >
              <e.icon size={14} className="text-brand-600 flex-shrink-0" />
              <span className="truncate">{e.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Period & Date Range Selector Card */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <CustomSelect
            value={year}
            onChange={(val) => handleYearChange(Number(val))}
            options={YEARS.map((y) => ({ value: y, label: String(y) }))}
            className="w-28 sm:w-32"
          />
          <CustomSelect
            value={month}
            onChange={(val) => handleMonthChange(Number(val))}
            options={MONTH_INDICES.map((m) => ({ value: m, label: getMonthName(m) }))}
            className="w-36 sm:w-44"
          />

          <div className="hidden lg:block h-6 w-px bg-slate-200 mx-1" />

          {/* Date Range Start and End */}
          <div className="flex items-center gap-2 flex-wrap">
            <div
              onClick={(e) => {
                if (e.target !== fromDateRef.current) {
                  try {
                    fromDateRef.current?.showPicker?.();
                  } catch {}
                }
              }}
              className="h-10 flex items-center gap-2 bg-white border border-slate-200 px-3.5 rounded-xl shadow-xs hover:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-600 transition-all cursor-pointer"
            >
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">{t('lblFromDate')}:</span>
              <input
                ref={fromDateRef}
                type="date"
                value={startDate}
                min={`${year}-${String(month).padStart(2, '0')}-01`}
                max={endDate || `${year}-${String(month).padStart(2, '0')}-31`}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            <div
              onClick={(e) => {
                if (e.target !== toDateRef.current) {
                  try {
                    toDateRef.current?.showPicker?.();
                  } catch {}
                }
              }}
              className="h-10 flex items-center gap-2 bg-white border border-slate-200 px-3.5 rounded-xl shadow-xs hover:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-600 transition-all cursor-pointer"
            >
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">{t('lblToDate')}:</span>
              <input
                ref={toDateRef}
                type="date"
                value={endDate}
                min={startDate || `${year}-${String(month).padStart(2, '0')}-01`}
                max={`${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`}
                onChange={(e) => setEndDate(e.target.value)}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>

            {isCustomRange && (
              <button
                type="button"
                onClick={resetToFullMonth}
                className="h-10 px-3.5 text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition-all shadow-xs flex items-center justify-center"
              >
                {t('btnFullMonth')}
              </button>
            )}
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          {isCustomRange
            ? `${startDate ? formatDate(startDate) : ''} – ${endDate ? formatDate(endDate) : ''}`
            : `${getMonthName(month)} ${year}`}
        </div>
      </div>

      {/* Finalized Banner */}
      {isFinalized && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900">
          <Lock size={18} className="text-rose-600 flex-shrink-0" />
          <p className="font-bold text-xs sm:text-sm">
            {t('yearFinalizedBadge', { year })}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: t('cardMonthStartBalance'),
            value: startBalance,
            color: 'text-slate-800',
            bg: 'bg-slate-50 border-slate-200 shadow-xs',
          },
          {
            label: t('cardTotalIncome'),
            value: totalIncome,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50/70 border-emerald-200',
          },
          {
            label: t('cardTotalExpense'),
            value: totalExpense,
            color: 'text-rose-600',
            bg: 'bg-rose-50/70 border-rose-200',
          },
          {
            label: t('cardMonthBalance'),
            value: totalIncome - totalExpense,
            color: totalIncome - totalExpense >= 0 ? 'text-brand-700' : 'text-rose-700',
            bg: 'bg-brand-50/70 border-brand-200',
          },
          {
            label: t('cardMonthEndBalance'),
            value: endBalance,
            color: 'text-slate-900',
            bg: 'bg-white border-slate-200 shadow-xs',
          },
        ].map((c) => (
          <div key={c.label} className={`p-4 rounded-2xl border ${c.bg}`}>
            <p className="text-xs font-semibold text-slate-500 mb-1">{c.label}</p>
            <p className={`text-base sm:text-lg font-extrabold ${c.color}`}>
              {formatCurrency(c.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Table: Desktop View (>= md) */}
      <div className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-card overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {[
                t('thDate'),
                t('thVoucherNo'),
                t('thBookingRule'),
                t('thBookingText'),
                t('thIncome'),
                t('thExpense'),
                t('thVat'),
                t('thBalance'),
                t('thDocument'),
              ].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3.5 text-xs font-bold text-slate-700 uppercase tracking-wider ${
                    i >= 4 && i <= 7 ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={9} className="px-4 py-3.5">
                    <div className="h-4 bg-slate-200/70 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  {t('noMonthlyEntries')}
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => (
                <tr
                  key={entry._id}
                  className={`hover:bg-brand-50/30 transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                  } ${
                    entry.type === 'income'
                      ? 'border-l-4 border-l-emerald-500'
                      : 'border-l-4 border-l-rose-500'
                  }`}
                >
                  <td className="px-4 py-3.5 text-slate-800 font-medium whitespace-nowrap">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-mono text-xs whitespace-nowrap">
                    {entry.voucherNo || '—'}
                  </td>
                  <td className="px-4 py-3.5 text-slate-900 font-medium whitespace-nowrap">
                    {typeof entry.bookingRule === 'object'
                      ? translateBookingRuleName(entry.bookingRule?.name, language)
                      : translateBookingRuleName(String(entry.bookingRule), language)}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 text-xs min-w-[160px]">
                    {entry.bookingText || '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    {entry.type === 'income' ? (
                      <span className="font-bold text-emerald-600 whitespace-nowrap">
                        +{formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    {entry.type === 'expense' ? (
                      <span className="font-bold text-rose-600 whitespace-nowrap">
                        -{formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                        VAT_COLORS[entry.vatPercentage]
                      }`}
                    >
                      {entry.vatPercentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-extrabold text-slate-900 whitespace-nowrap">
                    {formatCurrency(entry.cashBalance)}
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-400 text-xs">
                    {entry.documentPath ? `📎 ${t('docAvailable')}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td
                  colSpan={4}
                  className="px-4 py-3.5 text-slate-600 text-xs font-bold uppercase tracking-wider"
                >
                  {t('tblTotals')}
                </td>
                <td className="px-4 py-3.5 text-right font-extrabold text-emerald-600">
                  +{formatCurrency(totalIncome)}
                </td>
                <td className="px-4 py-3.5 text-right font-extrabold text-rose-600">
                  -{formatCurrency(totalExpense)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Table: Mobile View (< md) - Order: Date -> Income -> Expense -> Rule -> Text -> VAT -> Balance -> Voucher No -> Document */}
      <div
        ref={mobileContainerRef}
        className="block md:hidden rounded-2xl border border-slate-200 bg-white shadow-card overflow-x-auto"
      >
        <table className="min-w-full w-max text-sm text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {[
                { label: t('thDate'), align: 'text-left', style: { width: colDateWidth, minWidth: colDateWidth, maxWidth: colDateWidth }, className: 'px-2.5' },
                { label: t('thIncome'), align: 'text-right', style: { width: colIncomeWidth, minWidth: colIncomeWidth, maxWidth: colIncomeWidth }, className: 'px-2.5' },
                { label: t('thExpense'), align: 'text-right', style: { width: colExpenseWidth, minWidth: colExpenseWidth, maxWidth: colExpenseWidth }, className: 'px-2.5' },
                { label: t('thBookingRule'), align: 'text-left', style: { minWidth: 160, width: 160 }, className: 'px-3' },
                { label: t('thBookingText'), align: 'text-left', style: { minWidth: 150, width: 150 }, className: 'px-3' },
                { label: t('thVat'), align: 'text-center', style: { minWidth: 65, width: 65 }, className: 'px-2.5' },
                { label: t('thBalance'), align: 'text-right', style: { minWidth: 110, width: 110 }, className: 'px-3' },
                { label: t('thVoucherNo'), align: 'text-left', style: { minWidth: 85, width: 85 }, className: 'px-2.5' },
                { label: t('thDocument'), align: 'text-center', style: { minWidth: 60, width: 60 }, className: 'px-2' },
              ].map((h) => (
                <th
                  key={h.label}
                  style={h.style}
                  className={`py-3 text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap ${h.align} ${h.className}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={9} className="px-3.5 py-3">
                    <div className="h-4 bg-slate-200/70 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3.5 py-12 text-center text-slate-400">
                  {t('noMonthlyEntries')}
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => (
                <tr
                  key={entry._id}
                  className={`hover:bg-brand-50/30 transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                  } ${
                    entry.type === 'income'
                      ? 'border-l-4 border-l-emerald-500'
                      : 'border-l-4 border-l-rose-500'
                  }`}
                >
                  {/* 1. Date */}
                  <td
                    style={{ width: colDateWidth, minWidth: colDateWidth, maxWidth: colDateWidth }}
                    className="px-2.5 py-3 text-slate-800 font-medium whitespace-nowrap text-xs"
                  >
                    {formatDate(entry.date)}
                  </td>
                  {/* 2. Income */}
                  <td
                    style={{ width: colIncomeWidth, minWidth: colIncomeWidth, maxWidth: colIncomeWidth }}
                    className="px-2.5 py-3 text-right whitespace-nowrap"
                  >
                    {entry.type === 'income' ? (
                      <span className="font-bold text-emerald-600 whitespace-nowrap text-xs">
                        +{formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  {/* 3. Expense (no vertical line after expense) */}
                  <td
                    style={{ width: colExpenseWidth, minWidth: colExpenseWidth, maxWidth: colExpenseWidth }}
                    className="px-2.5 py-3 text-right whitespace-nowrap"
                  >
                    {entry.type === 'expense' ? (
                      <span className="font-bold text-rose-600 whitespace-nowrap text-xs">
                        -{formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  {/* 4. Booking Rule */}
                  <td
                    style={{ minWidth: 160, width: 160 }}
                    className="px-3 py-3 text-slate-900 font-medium whitespace-nowrap text-xs"
                  >
                    {typeof entry.bookingRule === 'object'
                      ? translateBookingRuleName(entry.bookingRule?.name, language)
                      : translateBookingRuleName(String(entry.bookingRule), language)}
                  </td>
                  {/* 5. Booking Text */}
                  <td
                    style={{ minWidth: 150, width: 150 }}
                    className="px-3 py-3 text-slate-600 text-xs"
                  >
                    {entry.bookingText || '—'}
                  </td>
                  {/* 6. VAT */}
                  <td
                    style={{ minWidth: 65, width: 65 }}
                    className="px-2.5 py-3 text-center whitespace-nowrap"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                        VAT_COLORS[entry.vatPercentage]
                      }`}
                    >
                      {entry.vatPercentage}%
                    </span>
                  </td>
                  {/* 7. Balance */}
                  <td
                    style={{ minWidth: 110, width: 110 }}
                    className="px-3 py-3 text-right font-extrabold text-slate-900 whitespace-nowrap text-xs"
                  >
                    {formatCurrency(entry.cashBalance)}
                  </td>
                  {/* 8. Voucher No */}
                  <td
                    style={{ minWidth: 85, width: 85 }}
                    className="px-2.5 py-3 text-slate-600 font-mono text-xs whitespace-nowrap"
                  >
                    {entry.voucherNo || '—'}
                  </td>
                  {/* 9. Document */}
                  <td
                    style={{ minWidth: 60, width: 60 }}
                    className="px-2 py-3 text-center text-slate-400 text-xs"
                  >
                    {entry.documentPath ? `📎 ${t('docAvailable')}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td
                  style={{ width: colDateWidth, minWidth: colDateWidth, maxWidth: colDateWidth }}
                  className="px-2.5 py-3 text-slate-600 text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  {t('tblTotals')}
                </td>
                <td
                  style={{ width: colIncomeWidth, minWidth: colIncomeWidth, maxWidth: colIncomeWidth }}
                  className="px-2.5 py-3 text-right font-extrabold text-emerald-600 text-xs whitespace-nowrap"
                >
                  +{formatCurrency(totalIncome)}
                </td>
                <td
                  style={{ width: colExpenseWidth, minWidth: colExpenseWidth, maxWidth: colExpenseWidth }}
                  className="px-2.5 py-3 text-right font-extrabold text-rose-600 text-xs whitespace-nowrap"
                >
                  -{formatCurrency(totalExpense)}
                </td>
                <td colSpan={6} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
