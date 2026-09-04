import { useCashbookStore } from '../../store/cashbookStore';
import { useTranslation } from '../../store/languageStore';
import { Wallet, TrendingUp, TrendingDown, ClipboardList } from 'lucide-react';
import LanguageToggle from '../ui/LanguageToggle';

export default function SummaryBar() {
  const summary = useCashbookStore((state) => state.summary);
  const { t, formatCurrency } = useTranslation();
  if (!summary) return null;

  return (
    <div className="bg-white border-b border-slate-200 shadow-subtle px-3 sm:px-6 py-2.5 sm:py-3.5 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-6">
        {/* Current Cash Balance - Purple-Blue Featured Card */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 bg-brand-50/70 border border-brand-200/80 px-4 py-2.5 sm:py-2 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg purple-blue-gradient flex items-center justify-center text-white shadow-brand flex-shrink-0">
              <Wallet size={20} />
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-brand-700 uppercase tracking-wider">
                {t('summaryCurrentBalance')}
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-brand-900 tracking-tight">
                {formatCurrency(summary.currentBalance)}
              </p>
            </div>
          </div>
        </div>

        {/* Income & Expense & Opening Balance Stats */}
        <div className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-6 sm:ml-auto text-xs sm:text-sm">
          {/* Total Income */}
          <div className="flex items-center gap-2 bg-emerald-50/50 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none border border-emerald-100/80 sm:border-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <TrendingUp size={15} className="sm:w-[17px] sm:h-[17px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">{t('summaryIncome')}</p>
              <p className="text-xs sm:text-sm font-bold text-emerald-600 truncate">
                +{formatCurrency(summary.totalIncome)}
              </p>
            </div>
          </div>

          {/* Total Expense */}
          <div className="flex items-center gap-2 bg-rose-50/50 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none border border-rose-100/80 sm:border-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center flex-shrink-0">
              <TrendingDown size={15} className="sm:w-[17px] sm:h-[17px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">{t('summaryExpense')}</p>
              <p className="text-xs sm:text-sm font-bold text-rose-600 truncate">
                -{formatCurrency(summary.totalExpense)}
              </p>
            </div>
          </div>

          {/* Opening Balance */}
          <div className="hidden md:flex items-center gap-2.5 border-l border-slate-200 pl-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center flex-shrink-0">
              <ClipboardList size={17} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">{t('summaryOpeningBalance')}</p>
              <p className="text-sm font-semibold text-slate-800">
                {formatCurrency(summary.openingBalance)}
              </p>
            </div>
          </div>

          {/* Desktop Language Toggle */}
          <div className="hidden lg:flex items-center border-l border-slate-200 pl-4">
            <LanguageToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
