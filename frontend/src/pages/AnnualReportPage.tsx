import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown, ChevronRight, Download, FileText, FileSpreadsheet, FileCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsApi, exportsApi } from '../lib/api';
import { useTranslation } from '../store/languageStore';
import { translateBookingRuleName } from '../lib/i18n/translations';
import CustomSelect from '../components/ui/CustomSelect';
import type { CashBookEntry } from '../types';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

interface MonthData {
  month: number;
  entries: CashBookEntry[];
  totalIncome: number;
  totalExpense: number;
  endBalance: number;
}

const VAT_COLORS: Record<number, string> = {
  0: 'bg-slate-100 text-slate-700 border border-slate-200',
  7: 'bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold',
  19: 'bg-brand-50 text-brand-700 border border-brand-200/80 font-semibold',
};

export default function AnnualReportPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [monthData, setMonthData] = useState<MonthData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const { t, formatCurrency, formatDate, getMonthName, getMonthShort, language } = useTranslation();

  const yearTotalIncome = monthData.reduce((s, m) => s + m.totalIncome, 0);
  const yearTotalExpense = monthData.reduce((s, m) => s + m.totalExpense, 0);

  const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
  const chartData = ALL_MONTHS.map((m) => {
    const found = monthData.find((md) => md.month === m);
    return {
      name: getMonthShort(m),
      Einnahmen: found ? found.totalIncome : 0,
      Ausgaben: found ? found.totalExpense : 0,
    };
  });

  useEffect(() => {
    setIsLoading(true);
    reportsApi
      .annual(year)
      .then((res) => {
        const data: Record<number, CashBookEntry[]> = res.data.data?.byMonth || {};
        const months: MonthData[] = Object.entries(data)
          .map(([mStr, entries]) => {
            const m = Number(mStr);
            const totalIncome = (entries as CashBookEntry[])
              .filter((e: CashBookEntry) => e.type === 'income')
              .reduce((s: number, e: CashBookEntry) => s + e.amount, 0);
            const totalExpense = (entries as CashBookEntry[])
              .filter((e: CashBookEntry) => e.type === 'expense')
              .reduce((s: number, e: CashBookEntry) => s + e.amount, 0);
            const sortedEntries = [...(entries as CashBookEntry[])].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            const endBalance =
              sortedEntries.length > 0 ? sortedEntries[sortedEntries.length - 1].cashBalance : 0;
            return { month: m, entries: sortedEntries, totalIncome, totalExpense, endBalance };
          })
          .sort((a, b) => a.month - b.month);
        setMonthData(months);
      })
      .catch(() => setMonthData([]))
      .finally(() => setIsLoading(false));
  }, [year]);

  const toggleMonth = (m: number) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'xml' | 'datev') => {
    setIsExporting(true);
    try {
      if (type === 'pdf') await exportsApi.downloadPDF(year);
      else if (type === 'excel') await exportsApi.downloadExcel(year);
      else if (type === 'xml') await exportsApi.downloadXML(year);
      else await exportsApi.downloadDatev(year);
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
            {t('annualReportTitle')} {year}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">
            {t('annualReportSubtitle')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
          <CustomSelect
            value={year}
            onChange={(val) => setYear(Number(val))}
            options={YEARS.map((y) => ({ value: y, label: String(y) }))}
            className="w-full sm:w-[84px]"
            buttonClassName="px-2.5 gap-1"
          />
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
                disabled={isExporting || monthData.length === 0}
                className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 shadow-xs disabled:opacity-40 disabled:pointer-events-none"
              >
                <e.icon size={14} className="text-brand-600 flex-shrink-0" />
                <span className="truncate">{e.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Year Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
          <p className="text-xs font-semibold text-emerald-800 mb-1">{t('cardYearIncome')}</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700">
            +{formatCurrency(yearTotalIncome)}
          </p>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/70 border border-rose-200">
          <p className="text-xs font-semibold text-rose-800 mb-1">{t('cardYearExpense')}</p>
          <p className="text-xl sm:text-2xl font-extrabold text-rose-700">
            -{formatCurrency(yearTotalExpense)}
          </p>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-brand-50/70 border border-brand-200">
          <p className="text-xs font-semibold text-brand-800 mb-1">{t('cardYearBalance')}</p>
          <p
            className={`text-xl sm:text-2xl font-extrabold ${
              yearTotalIncome - yearTotalExpense >= 0 ? 'text-brand-700' : 'text-rose-700'
            }`}
          >
            {formatCurrency(yearTotalIncome - yearTotalExpense)}
          </p>
        </div>
      </div>

      {/* Bar Chart Card */}
      {monthData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 mb-4">
            <h2 className="text-[11px] sm:text-sm font-bold text-slate-800 uppercase tracking-normal sm:tracking-wider whitespace-nowrap">
              {t('chartTitle')}
            </h2>
            <span className="text-[10px] sm:text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-brand-200 self-start sm:self-auto whitespace-nowrap">
              {t('fiscalYear')} {year}
            </span>
          </div>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                barGap={2}
                maxBarSize={20}
                margin={{ top: 10, right: 5, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => {
                    if (v === 0) return '0 €';
                    if (v >= 1000) return `${(v / 1000).toLocaleString(language === 'de' ? 'de-DE' : 'en-US')}k €`;
                    return `${v.toLocaleString(language === 'de' ? 'de-DE' : 'en-US')} €`;
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  labelStyle={{ color: '#0f172a', fontWeight: 700 }}
                  formatter={(val: number) => [formatCurrency(val), '']}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 12, color: '#475569', fontSize: 12 }}
                />
                <Bar
                  dataKey="Einnahmen"
                  name={t('summaryIncome')}
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={16}
                />
                <Bar
                  dataKey="Ausgaben"
                  name={t('summaryExpense')}
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Accordions */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-white rounded-2xl animate-pulse border border-slate-200"
            />
          ))}
        </div>
      ) : monthData.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-xs">
          {t('noAnnualEntries')}
        </div>
      ) : (
        <div className="space-y-3">
          {monthData.map((md) => {
            const isOpen = expandedMonths.has(md.month);
            return (
              <div
                key={md.month}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
              >
                <button
                  onClick={() => toggleMonth(md.month)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:px-5 sm:py-4 hover:bg-slate-50 transition-colors text-left gap-2 sm:gap-4"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-bold text-slate-900 text-sm sm:text-base whitespace-nowrap">
                        {getMonthName(md.month)} {year}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                        ({md.entries.length} {md.entries.length === 1 ? t('bookingSingular') : t('bookingPlural')})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-4 text-xs sm:text-sm font-semibold ml-9.5 sm:ml-0 flex-wrap">
                    <span className="text-emerald-600 font-bold">
                      +{formatCurrency(md.totalIncome)}
                    </span>
                    <span className="text-rose-600 font-bold">
                      -{formatCurrency(md.totalExpense)}
                    </span>
                    <span className="text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap">
                      <span className="text-slate-500 font-medium">{t('cardMonthEndBalance')}: </span>
                      {formatCurrency(md.endBalance)}
                    </span>
                  </div>
                </button>

                {isOpen && md.entries.length > 0 && (
                  <div className="border-t border-slate-100 overflow-x-auto bg-slate-50/40">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/60 border-b border-slate-200/80">
                          {[
                            t('thDate'),
                            t('thVoucherNo'),
                            t('thBookingRule'),
                            t('thBookingText'),
                            t('thIncome'),
                            t('thExpense'),
                            t('thVat'),
                            t('thBalance'),
                          ].map((h, i) => (
                            <th
                              key={h}
                              className={`px-4 py-2.5 text-slate-600 font-bold ${
                                i >= 4 && i <= 7 ? 'text-right' : 'text-left'
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {md.entries.map((entry) => (
                          <tr
                            key={entry._id}
                            className={`hover:bg-brand-50/30 transition-colors ${
                              entry.type === 'income'
                                ? 'border-l-4 border-l-emerald-500'
                                : 'border-l-4 border-l-rose-500'
                            }`}
                          >
                            <td className="px-4 py-2.5 text-slate-800 font-medium">
                              {formatDate(entry.date)}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">
                              {entry.voucherNo || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-900 font-medium max-w-[130px] truncate">
                              {typeof entry.bookingRule === 'object'
                                ? translateBookingRuleName(entry.bookingRule?.name, language)
                                : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 max-w-[130px] truncate">
                              {entry.bookingText || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                              {entry.type === 'income' ? `+${formatCurrency(entry.amount)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-rose-600">
                              {entry.type === 'expense' ? `-${formatCurrency(entry.amount)}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                                  VAT_COLORS[entry.vatPercentage]
                                }`}
                              >
                                {entry.vatPercentage}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-extrabold text-slate-900">
                              {formatCurrency(entry.cashBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
