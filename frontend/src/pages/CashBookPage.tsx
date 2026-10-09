import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Download, FileSpreadsheet, FileCode, FileText as FileCsv, FileText, Scale, Lock, Unlock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCashbookStore } from '../store/cashbookStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useTranslation } from '../store/languageStore';
import { settingsApi, exportsApi } from '../lib/api';
import CashBookTable from '../components/cashbook/CashBookTable';
import EntryForm from '../components/cashbook/EntryForm';
import DeleteConfirmDialog from '../components/cashbook/DeleteConfirmDialog';
import DocumentViewer from '../components/cashbook/DocumentViewer';
import OpeningBalanceModal from '../components/cashbook/OpeningBalanceModal';
import CustomSelect from '../components/ui/CustomSelect';
import { type CashBookEntry, type Settings, getDefaultPermissions } from '../types';

const MONTH_INDICES = Array.from({ length: 12 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function CashBookPage() {
  const {
    entries,
    isLoading,
    selectedYear,
    selectedMonth,
    fetchEntries,
    fetchSummary,
    setSelectedPeriod,
  } = useCashbookStore();
  const user = useAuthStore((state) => state.user);
  const { t, getMonthName, language } = useTranslation();

  const showIncomeForm = useUIStore((state) => state.showIncomeForm);
  const showExpenseForm = useUIStore((state) => state.showExpenseForm);
  const editingEntry = useUIStore((state) => state.editingEntry);
  const openIncomeForm = useUIStore((state) => state.openIncomeForm);
  const openExpenseForm = useUIStore((state) => state.openExpenseForm);
  const closeForm = useUIStore((state) => state.closeForm);
  const setEditingEntry = useUIStore((state) => state.setEditingEntry);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<CashBookEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<CashBookEntry | null>(null);
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMobileExportMenu, setShowMobileExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const userPerms = user?.permissions
    ? { ...getDefaultPermissions(user.role), ...user.permissions }
    : user
    ? getDefaultPermissions(user.role)
    : null;

  useEffect(() => {
    fetchEntries();
    fetchSummary();
    settingsApi
      .get()
      .then((res) => {
        const s = res.data.data;
        setSettings(s);
        const canManage = userPerms?.canManageSettings ?? (user?.role === 'admin' || user?.role === 'accountant');
        if (!s.openingBalance && canManage) setShowOpeningBalance(true);
      })
      .catch(() => {});
  }, []);

  const handleRefresh = () => {
    fetchEntries();
    fetchSummary();
    settingsApi
      .get()
      .then((res) => setSettings(res.data.data))
      .catch(() => {});
  };

  const handleEdit = (entry: CashBookEntry) => {
    setEditingEntry(entry);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEntry) return;
    setIsDeleting(true);
    try {
      await useCashbookStore.getState().deleteEntry(deletingEntry._id);
      toast.success(t('btnDeleteConfirm'));
      setDeletingEntry(null);
      handleRefresh();
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Löschen' : 'Error deleting');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'xml' | 'datev') => {
    setIsExporting(true);
    setShowExportMenu(false);
    setShowMobileExportMenu(false);
    try {
      if (type === 'pdf') await exportsApi.downloadPDF(selectedYear, selectedMonth);
      else if (type === 'excel')
        await exportsApi.downloadExcel(selectedYear, selectedMonth);
      else if (type === 'xml')
        await exportsApi.downloadXML(selectedYear, selectedMonth);
      else await exportsApi.downloadDatev(selectedYear, selectedMonth);
      toast.success(language === 'de' ? 'Export erfolgreich' : 'Export complete');
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Exportieren' : 'Export error');
    } finally {
      setIsExporting(false);
    }
  };

  const [confirmMonthModal, setConfirmMonthModal] = useState<{ year: number; month: number; action: 'unlock' | 'lock' } | null>(null);
  const [isTogglingMonthLock, setIsTogglingMonthLock] = useState(false);

  const handleMonthLockAction = async () => {
    if (!confirmMonthModal) return;
    setIsTogglingMonthLock(true);
    try {
      const res = await settingsApi.lockMonth(confirmMonthModal.year, confirmMonthModal.month, confirmMonthModal.action);
      setSettings(res.data.data);
      if (confirmMonthModal.action === 'unlock') {
        toast.success(t('toastMonthUnlocked', { month: getMonthName(confirmMonthModal.month), year: confirmMonthModal.year }));
      } else {
        toast.success(t('toastMonthLocked', { month: getMonthName(confirmMonthModal.month), year: confirmMonthModal.year }));
      }
      setConfirmMonthModal(null);
      fetchEntries();
      fetchSummary();
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Ändern des Monatsstatus' : 'Error updating month lock status');
    } finally {
      setIsTogglingMonthLock(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isPastMonth = selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth);

  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const isMonthUnlocked = isAdmin && (settings?.unlockedMonths?.includes(monthKey) || false);
  const isMonthLocked = isPastMonth && !isMonthUnlocked;

  const isYearFinalized = settings?.finalizedYears?.includes(selectedYear) || false;
  const isLocked = isYearFinalized || isMonthLocked;

  const canAddIncome = (userPerms?.canAddIncome ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isLocked;
  const canAddExpense = (userPerms?.canAddExpense ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isLocked;
  const canEditEntry = (userPerms?.canEditEntry ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isLocked;
  const canDeleteEntry = (userPerms?.canDeleteEntry ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isLocked;
  const canManageSettings = (userPerms?.canManageSettings ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isLocked;
  const canExport = userPerms?.canExportReports ?? true;

  return (
    <div className="space-y-6">
      {/* Mobile Sticky Control Deck (< md screens) */}
      <div
        data-mobile-actions-bar
        className="md:hidden sticky top-0 z-25 bg-slate-50 -mx-4 px-3.5 pt-2.5 pb-2.5 border-b border-slate-200 shadow-xs space-y-2 before:absolute before:-top-16 before:left-0 before:right-0 before:h-16 before:bg-slate-50 before:pointer-events-none"
      >
        {/* Row 1: Action buttons (+ Income, + Expense, Lock/Unlock Month, Export) */}
        <div className="flex items-center gap-1.5 justify-between">
          {canAddIncome && (
            <button
              type="button"
              onClick={openIncomeForm}
              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap min-w-0"
            >
              <Plus size={15} className="stroke-[2.5] flex-shrink-0" />
              <span>{t('btnAddIncome')}</span>
            </button>
          )}

          {canAddExpense && (
            <button
              type="button"
              onClick={openExpenseForm}
              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap min-w-0"
            >
              <Plus size={15} className="stroke-[2.5] flex-shrink-0" />
              <span>{t('btnAddExpense')}</span>
            </button>
          )}

          {canManageSettings && (
            <button
              type="button"
              onClick={() => setShowOpeningBalance(true)}
              className="flex items-center justify-center gap-1 px-2 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap flex-shrink-0"
              title={t('modalOpeningBalanceTitle')}
            >
              <Scale size={15} className="text-amber-700 flex-shrink-0" />
              <span className="hidden xs:inline">{t('tblOpeningBalance')}</span>
            </button>
          )}

          {/* Admin Button to Lock / Unlock Past Month */}
          {isAdmin && !isYearFinalized && isPastMonth && (
            <button
              type="button"
              onClick={() =>
                setConfirmMonthModal({
                  year: selectedYear,
                  month: selectedMonth,
                  action: isMonthLocked ? 'unlock' : 'lock',
                })
              }
              className={`flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap flex-shrink-0 ${
                isMonthLocked
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
              }`}
              title={isMonthLocked ? t('btnUnlockMonth') : t('btnLockMonth')}
            >
              {isMonthLocked ? (
                <>
                  <Unlock size={14} className="text-amber-700 flex-shrink-0" />
                  <span>{t('btnUnlockMonth')}</span>
                </>
              ) : (
                <>
                  <Lock size={14} className="text-slate-700 flex-shrink-0" />
                  <span>{t('btnLockMonth')}</span>
                </>
              )}
            </button>
          )}

          {isYearFinalized && (canAddIncome || canAddExpense || canEditEntry) && (
            <span className="px-2.5 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0">
              🔒 {selectedYear}
            </span>
          )}

          {/* Export Dropdown */}
          {canExport && (
            <div className="relative z-50 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowMobileExportMenu((prev) => !prev)}
                disabled={isExporting}
                className="flex items-center justify-center gap-1 px-2.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold transition-all border border-slate-200 shadow-xs whitespace-nowrap"
              >
                <Download size={14} className="text-brand-600 flex-shrink-0" />
                <span>{isExporting ? t('btnExporting') : t('btnExport')}</span>
              </button>
              {showMobileExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMobileExportMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                    {[
                      { icon: FileText, label: t('exportPdf'), fn: () => handleExport('pdf') },
                      {
                        icon: FileSpreadsheet,
                        label: t('exportExcel'),
                        fn: () => handleExport('excel'),
                      },
                      { icon: FileCode, label: t('exportXml'), fn: () => handleExport('xml') },
                      { icon: FileCsv, label: t('exportDatev'), fn: () => handleExport('datev') },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.fn}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left"
                      >
                        <item.icon size={15} className="text-brand-600 flex-shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Row 2: Period Selectors (Year & Month dropdowns in pill card matching user design) */}
        <div className="bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-2">
          {/* Year Select */}
          <div className="w-[82px] flex-shrink-0 relative z-20">
            <CustomSelect
              value={selectedYear}
              onChange={(val) => setSelectedPeriod(Number(val), selectedMonth)}
              options={YEARS.map((y) => ({ value: y, label: String(y) }))}
              className="w-[82px]"
              buttonClassName="px-2.5 py-1.5 text-xs gap-1"
            />
          </div>

          {/* Month Dropdown - Mobile View (all 12 months with lock status indicators) */}
          <div className="flex-1 min-w-0 relative z-20">
            <CustomSelect
              value={selectedMonth}
              onChange={(val) => setSelectedPeriod(selectedYear, Number(val))}
              options={MONTH_INDICES.map((m) => {
                const mKey = `${selectedYear}-${String(m).padStart(2, '0')}`;
                const isMPast = selectedYear < currentYear || (selectedYear === currentYear && m < currentMonth);
                const isMUnlocked = isAdmin && (settings?.unlockedMonths?.includes(mKey) ?? false);
                const isMLocked = isYearFinalized || (isMPast && !isMUnlocked);
                const badge = isMLocked ? ' 🔒' : isMPast && isMUnlocked ? ' 🔓' : '';
                return {
                  value: m,
                  label: `${getMonthName(m)}${badge}`,
                };
              })}
              className="w-full"
              buttonClassName="px-3 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Page Header (Desktop >= md screens) */}
      <div className="hidden md:flex flex-row items-start justify-between gap-4 relative z-30">
        <div className="text-left w-auto">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('cashBookTitle')} {selectedYear}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            {t('lblMonthlyView')}: {getMonthName(selectedMonth)} {selectedYear}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 w-auto flex-nowrap justify-end">
          {canAddIncome && (
            <button
              onClick={openIncomeForm}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap min-w-0"
            >
              <Plus size={16} className="stroke-[2.5] flex-shrink-0" />
              <span>{t('btnAddIncome')}</span>
            </button>
          )}

          {canAddExpense && (
            <button
              onClick={openExpenseForm}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap min-w-0"
            >
              <Plus size={16} className="stroke-[2.5] flex-shrink-0" />
              <span>{t('btnAddExpense')}</span>
            </button>
          )}

          {canManageSettings && (
            <button
              onClick={() => setShowOpeningBalance(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap min-w-0"
              title={t('modalOpeningBalanceTitle')}
            >
              <Scale size={16} className="text-amber-700 flex-shrink-0" />
              <span>{t('tblOpeningBalance')}</span>
            </button>
          )}

          {/* Admin Button to Lock / Unlock Past Month */}
          {isAdmin && !isYearFinalized && isPastMonth && (
            <button
              type="button"
              onClick={() =>
                setConfirmMonthModal({
                  year: selectedYear,
                  month: selectedMonth,
                  action: isMonthLocked ? 'unlock' : 'lock',
                })
              }
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap min-w-0 ${
                isMonthLocked
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
              }`}
              title={isMonthLocked ? t('btnUnlockMonth') : t('btnLockMonth')}
            >
              {isMonthLocked ? (
                <>
                  <Unlock size={15} className="text-amber-700 flex-shrink-0" />
                  <span>{t('btnUnlockMonth')}</span>
                </>
              ) : (
                <>
                  <Lock size={15} className="text-slate-700 flex-shrink-0" />
                  <span>{t('btnLockMonth')}</span>
                </>
              )}
            </button>
          )}

          {isYearFinalized && (canAddIncome || canAddExpense || canEditEntry) && (
            <span className="px-3 sm:px-4 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold whitespace-nowrap">
              🔒 {selectedYear}
            </span>
          )}

          {/* Export Dropdown */}
          {canExport && (
            <div className="relative z-50 min-w-0">
              <button
                onClick={() => setShowExportMenu((prev) => !prev)}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-xs sm:text-sm font-semibold transition-all border border-slate-200 shadow-xs whitespace-nowrap min-w-0"
              >
                <Download size={15} className="text-brand-600 flex-shrink-0" />
                <span>{isExporting ? t('btnExporting') : t('btnExport')}</span>
              </button>
              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 sm:w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                    {[
                      { icon: FileText, label: t('exportPdf'), fn: () => handleExport('pdf') },
                      {
                        icon: FileSpreadsheet,
                        label: t('exportExcel'),
                        fn: () => handleExport('excel'),
                      },
                      { icon: FileCode, label: t('exportXml'), fn: () => handleExport('xml') },
                      { icon: FileCsv, label: t('exportDatev'), fn: () => handleExport('datev') },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.fn}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors text-left"
                      >
                        <item.icon size={16} className="text-brand-600" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Period Filter Card (Desktop >= md screens) */}
      <div className="hidden md:flex bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs items-center gap-2.5 relative z-10">
        {/* Year Select */}
        <div className="w-[82px] flex-shrink-0 relative z-20">
          <CustomSelect
            value={selectedYear}
            onChange={(val) => setSelectedPeriod(Number(val), selectedMonth)}
            options={YEARS.map((y) => ({ value: y, label: String(y) }))}
            className="w-[82px]"
            buttonClassName="px-2.5 gap-1"
          />
        </div>

        {/* Desktop View: All 12 Months full names without truncation */}
        <div className="flex items-center gap-1 xl:gap-1.5 flex-1 min-w-0">
          {MONTH_INDICES.map((m) => {
            const mKey = `${selectedYear}-${String(m).padStart(2, '0')}`;
            const isMPast = selectedYear < currentYear || (selectedYear === currentYear && m < currentMonth);
            const isMUnlocked = isAdmin && (settings?.unlockedMonths?.includes(mKey) ?? false);
            const isMLocked = isYearFinalized || (isMPast && !isMUnlocked);
            return (
              <button
                key={m}
                onClick={() => setSelectedPeriod(selectedYear, m)}
                className={`flex-auto py-1.5 px-1 xl:px-2 rounded-xl text-xs font-semibold transition-all border text-center whitespace-nowrap flex items-center justify-center gap-1 ${
                  selectedMonth === m
                    ? 'bg-brand-600 border-brand-600 text-white shadow-brand font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600'
                }`}
                title={`${getMonthName(m)}${isMLocked ? ' 🔒' : isMPast && isMUnlocked ? ' 🔓' : ''}`}
              >
                <span>{getMonthName(m)}</span>
                {isMLocked && <span className="text-[10px] opacity-75">🔒</span>}
                {isMPast && isMUnlocked && <span className="text-[10px] opacity-75 text-emerald-600">🔓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* No opening balance banner */}
      {settings && !settings.openingBalance && canManageSettings && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex items-center gap-3 text-amber-900">
            <span className="text-2xl">💡</span>
            <div>
              <p className="font-bold text-sm">{t('noOpeningBalanceTitle')}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {t('noOpeningBalanceDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowOpeningBalance(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex-shrink-0"
          >
            {t('btnSetOpeningBalanceNow')}
          </button>
        </div>
      )}

      {/* Finalized Year Lock Banner */}
      {isYearFinalized && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900">
          <span className="text-2xl">🔒</span>
          <div>
            <p className="font-bold text-sm">
              {t('yearFinalizedBadge', { year: selectedYear })}
            </p>
            <p className="text-xs text-rose-700 mt-0.5">
              {t('descYearFinalization')}
            </p>
          </div>
        </div>
      )}

      {/* Month Closed / Locked Banner */}
      {!isYearFinalized && isMonthLocked && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-amber-900">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-bold text-sm">
                {t('monthClosedBadge', { month: getMonthName(selectedMonth), year: selectedYear })}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                {t('descMonthClosed')}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setConfirmMonthModal({ year: selectedYear, month: selectedMonth, action: 'unlock' })}
              className="hidden sm:flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto flex-shrink-0"
            >
              <Unlock size={14} />
              <span>{t('btnUnlockMonth')}</span>
            </button>
          )}
        </div>
      )}

      {/* Past Month Unlocked Banner */}
      {!isYearFinalized && isPastMonth && isMonthUnlocked && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-emerald-950">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔓</span>
            <div>
              <p className="font-bold text-sm text-emerald-900">
                {t('monthUnlockedBadge', { month: getMonthName(selectedMonth), year: selectedYear })}
              </p>
              <p className="text-xs text-emerald-800 mt-0.5">
                {t('descMonthUnlocked')}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setConfirmMonthModal({ year: selectedYear, month: selectedMonth, action: 'lock' })}
              className="hidden sm:flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white rounded-xl text-xs font-bold shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto flex-shrink-0"
            >
              <Lock size={14} />
              <span>{t('btnLockMonth')}</span>
            </button>
          )}
        </div>
      )}

      {/* Main Table */}
      <CashBookTable
        entries={entries}
        isLoading={isLoading}
        settings={settings ?? undefined}
        onEdit={handleEdit}
        onDelete={setDeletingEntry}
        onViewDocument={(entry) => {
          // Open viewer if entry has any documents (new array or legacy field)
          const hasDocuments = (entry.documents && entry.documents.length > 0) || !!entry.documentPath;
          if (hasDocuments) setViewingDoc(entry);
        }}
        onEditOpeningBalance={() => setShowOpeningBalance(true)}
        canEdit={canEditEntry}
        canDelete={canDeleteEntry}
      />

      {/* Modals */}
      {showIncomeForm && (
        <EntryForm
          type="income"
          entry={editingEntry}
          onClose={closeForm}
          onSuccess={handleRefresh}
        />
      )}
      {showExpenseForm && (
        <EntryForm
          type="expense"
          entry={editingEntry}
          onClose={closeForm}
          onSuccess={handleRefresh}
        />
      )}
      {deletingEntry && (
        <DeleteConfirmDialog
          entryDescription={`${deletingEntry.voucherNo || ''} — ${
            typeof deletingEntry.bookingRule === 'object' ? deletingEntry.bookingRule.name : ''
          }`}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeletingEntry(null)}
          isDeleting={isDeleting}
        />
      )}
      {viewingDoc && (
        <DocumentViewer
          entry={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}
      {showOpeningBalance && (
        <OpeningBalanceModal
          currentBalance={settings?.openingBalance}
          onClose={() => setShowOpeningBalance(false)}
          onSuccess={handleRefresh}
        />
      )}

      {/* Confirmation Modal for Month Lock / Unlock */}
      {confirmMonthModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${confirmMonthModal.action === 'unlock' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                    {confirmMonthModal.action === 'unlock' ? <Unlock size={18} /> : <Lock size={18} />}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {confirmMonthModal.action === 'unlock'
                      ? t('confirmUnlockMonthTitle', { month: getMonthName(confirmMonthModal.month), year: confirmMonthModal.year })
                      : t('confirmLockMonthTitle', { month: getMonthName(confirmMonthModal.month), year: confirmMonthModal.year })}
                  </h3>
                </div>
                <button
                  onClick={() => setConfirmMonthModal(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {confirmMonthModal.action === 'unlock'
                    ? t('confirmUnlockMonthDesc', { month: getMonthName(confirmMonthModal.month), year: confirmMonthModal.year })
                    : t('confirmLockMonthDesc', { month: getMonthName(confirmMonthModal.month), year: confirmMonthModal.year })}
                </p>
              </div>
              <div className="flex gap-3 px-6 pb-6 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmMonthModal(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  {t('btnCancel')}
                </button>
                <button
                  type="button"
                  onClick={handleMonthLockAction}
                  disabled={isTogglingMonthLock}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors shadow-xs ${
                    confirmMonthModal.action === 'unlock'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  {isTogglingMonthLock
                    ? t('btnSaving')
                    : confirmMonthModal.action === 'unlock'
                    ? t('btnUnlockMonth')
                    : t('btnLockMonth')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
