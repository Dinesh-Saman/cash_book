import { useEffect, useState } from 'react';
import { Plus, Download, FileSpreadsheet, FileCode, FileText as FileCsv, FileText, Scale } from 'lucide-react';
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
  const { t, getMonthName, getMonthShort, language } = useTranslation();

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

  const isYearFinalized = settings?.finalizedYears?.includes(selectedYear) || false;
  const canAddIncome = (userPerms?.canAddIncome ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isYearFinalized;
  const canAddExpense = (userPerms?.canAddExpense ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isYearFinalized;
  const canEditEntry = (userPerms?.canEditEntry ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isYearFinalized;
  const canDeleteEntry = (userPerms?.canDeleteEntry ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isYearFinalized;
  const canManageSettings = (userPerms?.canManageSettings ?? (user?.role === 'admin' || user?.role === 'accountant')) && !isYearFinalized;
  const canExport = userPerms?.canExportReports ?? true;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-30">
        <div className="text-center sm:text-left w-full sm:w-auto">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {t('cashBookTitle')} {selectedYear}
            </h1>
            {isYearFinalized && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold">
                🔒 {t('yearFinalizedBadge', { year: selectedYear })}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            {t('lblMonthlyView')}: {getMonthName(selectedMonth)} {selectedYear}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {canAddIncome && (
            <button
              onClick={openIncomeForm}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap min-w-0"
            >
              <Plus size={16} className="stroke-[2.5] flex-shrink-0" />
              <span>{t('btnAddIncome')}</span>
            </button>
          )}

          {canAddExpense && (
            <button
              onClick={openExpenseForm}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap min-w-0"
            >
              <Plus size={16} className="stroke-[2.5] flex-shrink-0" />
              <span>{t('btnAddExpense')}</span>
            </button>
          )}

          {canManageSettings && (
            <button
              onClick={() => setShowOpeningBalance(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap min-w-0"
              title={t('modalOpeningBalanceTitle')}
            >
              <Scale size={16} className="text-amber-700 flex-shrink-0" />
              <span>{t('tblOpeningBalance')}</span>
            </button>
          )}

          {isYearFinalized && (canAddIncome || canAddExpense || canEditEntry) && (
            <span className="px-3 sm:px-4 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold whitespace-nowrap">
              🔒 {selectedYear}
            </span>
          )}

          {/* Export Dropdown */}
          {canExport && (
            <div className="flex-1 sm:flex-initial relative z-50 min-w-0">
              <button
                onClick={() => setShowExportMenu((prev) => !prev)}
                disabled={isExporting}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-xs sm:text-sm font-semibold transition-all border border-slate-200 shadow-xs whitespace-nowrap min-w-0"
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

      {/* Period Filter Card */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center gap-2.5 relative z-10">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Year Select */}
          <div className="flex-1 sm:flex-initial sm:w-28 relative z-20">
            <CustomSelect
              value={selectedYear}
              onChange={(val) => setSelectedPeriod(Number(val), selectedMonth)}
              options={YEARS.map((y) => ({ value: y, label: String(y) }))}
              className="w-full sm:w-28"
            />
          </div>

          {/* Month Dropdown - Mobile View Only (all 12 months) */}
          <div className="flex-1 sm:hidden relative z-20">
            <CustomSelect
              value={selectedMonth}
              onChange={(val) => {
                setSelectedPeriod(selectedYear, Number(val));
              }}
              options={MONTH_INDICES.map((m) => ({
                value: m,
                label: getMonthName(m),
              }))}
              className="w-full"
            />
          </div>
        </div>

        {/* Desktop View: All 12 Months in a single grid without scrolling/moving */}
        <div className="hidden sm:grid grid-cols-12 gap-1 xl:gap-1.5 flex-1 min-w-0">
          {MONTH_INDICES.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedPeriod(selectedYear, m)}
              className={`w-full py-1.5 px-0.5 xl:px-1 rounded-xl text-xs font-semibold transition-all border text-center truncate ${
                selectedMonth === m
                  ? 'bg-brand-600 border-brand-600 text-white shadow-brand font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600'
              }`}
              title={getMonthName(m)}
            >
              <span className="hidden xl:inline">{getMonthName(m)}</span>
              <span className="xl:hidden">{getMonthShort(m)}</span>
            </button>
          ))}
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

      {/* Main Table */}
      <CashBookTable
        entries={entries}
        isLoading={isLoading}
        settings={settings ?? undefined}
        onEdit={handleEdit}
        onDelete={setDeletingEntry}
        onViewDocument={setViewingDoc}
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
      {viewingDoc?.documentPath && (
        <DocumentViewer
          documentPath={viewingDoc.documentPath}
          documentOriginalName={viewingDoc.documentOriginalName}
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
    </div>
  );
}
