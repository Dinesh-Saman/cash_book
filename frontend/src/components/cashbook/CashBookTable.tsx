import { FileText, Edit2, Trash2, Eye } from 'lucide-react';
import type { CashBookEntry } from '../../types';
import { useTranslation } from '../../store/languageStore';
import { translateBookingRuleName } from '../../lib/i18n/translations';
import { cn } from '../../lib/utils';

interface Props {
  entries: CashBookEntry[];
  isLoading: boolean;
  settings?: { openingBalance?: number; openingBalanceDate?: string } | null;
  onEdit: (entry: CashBookEntry) => void;
  onDelete: (entry: CashBookEntry) => void;
  onViewDocument: (entry: CashBookEntry) => void;
  onEditOpeningBalance?: () => void;
  canEdit: boolean;
  canDelete?: boolean;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-slate-200/70 rounded-md animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

const VAT_COLORS: Record<number, string> = {
  0: 'bg-slate-100 text-slate-700 border border-slate-200',
  7: 'bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold',
  19: 'bg-brand-50 text-brand-700 border border-brand-200/80 font-semibold',
};

export default function CashBookTable({
  entries,
  isLoading,
  settings,
  onEdit,
  onDelete,
  onViewDocument,
  onEditOpeningBalance,
  canEdit,
  canDelete = canEdit,
}: Props) {
  const { t, formatCurrency, formatDate, language } = useTranslation();

  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-sm">
          <DesktopTableHeader t={t} />
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const totalIncome = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  return (
    <>
      {/* DESKTOP VIEW (>= md screens) - Standard Column Order */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-sm text-slate-700 text-left border-collapse">
          <DesktopTableHeader t={t} />
          <tbody className="divide-y divide-slate-100">
            {/* Opening Balance Row */}
            {settings?.openingBalance !== undefined && settings.openingBalance > 0 && (
              <tr className="bg-amber-50/50 hover:bg-amber-50 transition-colors">
                <td className="px-4 py-3 text-slate-600 text-xs font-medium">
                  {settings.openingBalanceDate ? formatDate(settings.openingBalanceDate) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">—</td>
                <td className="px-4 py-3" colSpan={2}>
                  <span className="inline-flex items-center gap-1.5 text-amber-800 font-bold text-xs uppercase tracking-wider">
                    📋 {t('tblOpeningBalance')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-amber-700 whitespace-nowrap">
                  {formatCurrency(settings.openingBalance)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400">—</td>
                <td className="px-4 py-3 text-center text-slate-400">—</td>
                <td className="px-4 py-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                  {formatCurrency(settings.openingBalance)}
                </td>
                <td className="px-4 py-3 text-center text-slate-400">—</td>
                <td className="px-4 py-3 text-right">
                  {canEdit && onEditOpeningBalance && (
                    <button
                      onClick={onEditOpeningBalance}
                      className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors inline-flex items-center justify-center"
                      title={t('btnEdit')}
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            )}

            {entries.length === 0 ? (
              <EmptyState t={t} colSpan={10} />
            ) : (
              entries.map((entry, idx) => (
                <tr
                  key={entry._id}
                  className={cn(
                    'transition-colors group',
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40',
                    'hover:bg-brand-50/30',
                    entry.type === 'income'
                      ? 'border-l-4 border-l-emerald-500'
                      : 'border-l-4 border-l-rose-500'
                  )}
                >
                  {/* 1. Date */}
                  <td className="px-4 py-3.5 text-slate-800 font-medium whitespace-nowrap">
                    {formatDate(entry.date)}
                  </td>

                  {/* 2. Voucher No */}
                  <td className="px-4 py-3.5 text-slate-600 font-mono text-xs whitespace-nowrap">
                    {entry.voucherNo ? (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 whitespace-nowrap inline-block">
                        {entry.voucherNo}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>

                  {/* 3. Booking Rule */}
                  <td className="px-4 py-3.5 text-slate-900 font-medium whitespace-nowrap">
                    {typeof entry.bookingRule === 'object'
                      ? translateBookingRuleName(entry.bookingRule?.name, language)
                      : translateBookingRuleName(String(entry.bookingRule), language)}
                  </td>

                  {/* 4. Booking Text */}
                  <td className="px-4 py-3.5 text-slate-600 text-xs min-w-[160px]">
                    {entry.bookingText || <span className="text-slate-300">—</span>}
                  </td>

                  {/* 5. Income */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    {entry.type === 'income' ? (
                      <span className="font-bold text-emerald-600 whitespace-nowrap">
                        +{formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  {/* 6. Expense */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    {entry.type === 'expense' ? (
                      <span className="font-bold text-rose-600 whitespace-nowrap">
                        -{formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  {/* 7. VAT */}
                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap',
                        VAT_COLORS[entry.vatPercentage]
                      )}
                    >
                      {entry.vatPercentage}%
                    </span>
                  </td>

                  {/* 8. Running Balance */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <span
                      className={cn(
                        'font-extrabold text-sm whitespace-nowrap',
                        entry.cashBalance < 0 ? 'text-rose-600' : 'text-slate-900'
                      )}
                    >
                      {formatCurrency(entry.cashBalance)}
                    </span>
                  </td>

                  {/* 9. Document View */}
                  <td className="px-4 py-3.5 text-center">
                    {entry.documentPath ? (
                      <button
                        onClick={() => onViewDocument(entry)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-medium border border-brand-200/80 transition-colors"
                        title={entry.documentOriginalName}
                      >
                        <Eye size={14} />
                        <span className="hidden sm:inline">{t('btnViewDoc')}</span>
                      </button>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* 10. Actions */}
                  <td className="px-4 py-3.5">
                    {(canEdit || canDelete) && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button
                            onClick={() => onEdit(entry)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title={t('btnEdit')}
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => onDelete(entry)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={t('btnDelete')}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Desktop Totals footer */}
          {entries.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td
                  colSpan={4}
                  className="px-4 py-3.5 text-slate-600 text-xs font-bold uppercase tracking-wider"
                >
                  {t('tblTotals')} ({entries.length} {t('tblBookingsCount')})
                </td>
                <td className="px-4 py-3.5 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                  +{formatCurrency(totalIncome)}
                </td>
                <td className="px-4 py-3.5 text-right font-extrabold text-rose-600 whitespace-nowrap">
                  -{formatCurrency(totalExpense)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* MOBILE VIEW (< md screens) - Order: Date -> Income -> Expense -> Rule -> Text -> VAT -> Balance -> Voucher No -> Document -> Actions */}
      <div className="block md:hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        <table className="w-full text-sm text-slate-700 text-left border-collapse">
          <MobileTableHeader t={t} />
          <tbody className="divide-y divide-slate-100">
            {/* Opening Balance Row */}
            {settings?.openingBalance !== undefined && settings.openingBalance > 0 && (
              <tr className="bg-amber-50/50 hover:bg-amber-50 transition-colors">
                <td className="px-3.5 py-3 text-slate-600 text-xs font-medium whitespace-nowrap">
                  {settings.openingBalanceDate ? formatDate(settings.openingBalanceDate) : '—'}
                </td>
                <td className="px-3.5 py-3 text-right font-bold text-amber-700 whitespace-nowrap">
                  {formatCurrency(settings.openingBalance)}
                </td>
                <td className="px-3.5 py-3 text-right text-slate-400 whitespace-nowrap">—</td>
                <td className="px-3.5 py-3" colSpan={4}>
                  <span className="inline-flex items-center gap-1.5 text-amber-800 font-bold text-xs uppercase tracking-wider">
                    📋 {t('tblOpeningBalance')}
                  </span>
                </td>
                <td className="px-3.5 py-3 text-slate-400 text-xs">—</td>
                <td className="px-3.5 py-3 text-center text-slate-400">—</td>
                <td className="px-3.5 py-3 text-right">
                  {canEdit && onEditOpeningBalance && (
                    <button
                      onClick={onEditOpeningBalance}
                      className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors inline-flex items-center justify-center"
                      title={t('btnEdit')}
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            )}

            {entries.length === 0 ? (
              <EmptyState t={t} colSpan={10} />
            ) : (
              entries.map((entry, idx) => (
                <tr
                  key={entry._id}
                  className={cn(
                    'transition-colors',
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40',
                    'hover:bg-brand-50/30',
                    entry.type === 'income'
                      ? 'border-l-4 border-l-emerald-500'
                      : 'border-l-4 border-l-rose-500'
                  )}
                >
                  {/* 1. Date */}
                  <td className="px-3.5 py-3 text-slate-800 font-medium whitespace-nowrap text-xs sm:text-sm">
                    {formatDate(entry.date)}
                  </td>

                  {/* 2. Income */}
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    {entry.type === 'income' ? (
                      <span className="font-bold text-emerald-600 whitespace-nowrap text-xs sm:text-sm">
                        +{formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* 3. Expense */}
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    {entry.type === 'expense' ? (
                      <span className="font-bold text-rose-600 whitespace-nowrap text-xs sm:text-sm">
                        -{formatCurrency(entry.amount)}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* 4. Booking Rule */}
                  <td className="px-3.5 py-3 text-slate-900 font-medium whitespace-nowrap text-xs sm:text-sm">
                    {typeof entry.bookingRule === 'object'
                      ? translateBookingRuleName(entry.bookingRule?.name, language)
                      : translateBookingRuleName(String(entry.bookingRule), language)}
                  </td>

                  {/* 5. Booking Text */}
                  <td className="px-3.5 py-3 text-slate-600 text-xs min-w-[120px]">
                    {entry.bookingText || <span className="text-slate-300">—</span>}
                  </td>

                  {/* 6. VAT */}
                  <td className="px-3.5 py-3 text-center whitespace-nowrap">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap',
                        VAT_COLORS[entry.vatPercentage]
                      )}
                    >
                      {entry.vatPercentage}%
                    </span>
                  </td>

                  {/* 7. Balance */}
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    <span
                      className={cn(
                        'font-extrabold text-xs sm:text-sm whitespace-nowrap',
                        entry.cashBalance < 0 ? 'text-rose-600' : 'text-slate-900'
                      )}
                    >
                      {formatCurrency(entry.cashBalance)}
                    </span>
                  </td>

                  {/* 8. Voucher No (at last before document) */}
                  <td className="px-3.5 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                    {entry.voucherNo ? (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 whitespace-nowrap inline-block text-[11px]">
                        {entry.voucherNo}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>

                  {/* 9. Document View */}
                  <td className="px-3.5 py-3 text-center">
                    {entry.documentPath ? (
                      <button
                        onClick={() => onViewDocument(entry)}
                        className="inline-flex items-center justify-center p-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-medium border border-brand-200/80 transition-colors"
                        title={entry.documentOriginalName}
                      >
                        <Eye size={14} />
                      </button>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* 10. Actions */}
                  <td className="px-3.5 py-3">
                    {(canEdit || canDelete) && (
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button
                            onClick={() => onEdit(entry)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title={t('btnEdit')}
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => onDelete(entry)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={t('btnDelete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Mobile Totals footer */}
          {entries.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="px-3.5 py-3 text-slate-600 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                  {t('tblTotals')}
                </td>
                <td className="px-3.5 py-3 text-right font-extrabold text-emerald-600 whitespace-nowrap text-xs sm:text-sm">
                  +{formatCurrency(totalIncome)}
                </td>
                <td className="px-3.5 py-3 text-right font-extrabold text-rose-600 whitespace-nowrap text-xs sm:text-sm">
                  -{formatCurrency(totalExpense)}
                </td>
                <td colSpan={7} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

function EmptyState({ t, colSpan }: { t: (key: any) => string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <FileText size={28} />
          </div>
          <p className="text-base font-semibold text-slate-700">{t('tblNoEntries')}</p>
          <p className="text-xs text-slate-500 max-w-sm">{t('tblNoEntriesDesc')}</p>
        </div>
      </td>
    </tr>
  );
}

function DesktopTableHeader({ t }: { t: (key: any) => string }) {
  const headers = [
    { key: 'thDate', align: 'text-left' },
    { key: 'thVoucherNo', align: 'text-left' },
    { key: 'thBookingRule', align: 'text-left' },
    { key: 'thBookingText', align: 'text-left' },
    { key: 'thIncome', align: 'text-right' },
    { key: 'thExpense', align: 'text-right' },
    { key: 'thVat', align: 'text-center' },
    { key: 'thBalance', align: 'text-right' },
    { key: 'thDocument', align: 'text-center' },
    { key: 'thActions', align: 'text-center' },
  ];

  return (
    <thead>
      <tr className="bg-slate-50/80 border-b border-slate-200">
        {headers.map((h) => (
          <th
            key={h.key}
            className={cn(
              'px-4 py-3.5 text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap',
              h.align
            )}
          >
            {t(h.key)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function MobileTableHeader({ t }: { t: (key: any) => string }) {
  // Mobile Order: Date -> Income -> Expense -> Booking Rule -> Booking Text -> VAT -> Balance -> Voucher No -> Document -> Actions
  const headers = [
    { key: 'thDate', align: 'text-left' },
    { key: 'thIncome', align: 'text-right' },
    { key: 'thExpense', align: 'text-right' },
    { key: 'thBookingRule', align: 'text-left' },
    { key: 'thBookingText', align: 'text-left' },
    { key: 'thVat', align: 'text-center' },
    { key: 'thBalance', align: 'text-right' },
    { key: 'thVoucherNo', align: 'text-left' },
    { key: 'thDocument', align: 'text-center' },
    { key: 'thActions', align: 'text-center' },
  ];

  return (
    <thead>
      <tr className="bg-slate-50/80 border-b border-slate-200">
        {headers.map((h) => (
          <th
            key={h.key}
            className={cn(
              'px-3.5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap',
              h.align
            )}
          >
            {t(h.key)}
          </th>
        ))}
      </tr>
    </thead>
  );
}