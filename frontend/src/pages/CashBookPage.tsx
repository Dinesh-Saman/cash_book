import { useEffect, useState } from 'react';
import { Plus, Download, FileSpreadsheet, FileCode, FileText as FileCsv, FileText, Scale } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCashbookStore } from '../store/cashbookStore';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import { settingsApi, exportsApi } from '../lib/api';
import CashBookTable from '../components/cashbook/CashBookTable';
import EntryForm from '../components/cashbook/EntryForm';
import DeleteConfirmDialog from '../components/cashbook/DeleteConfirmDialog';
import DocumentViewer from '../components/cashbook/DocumentViewer';
import OpeningBalanceModal from '../components/cashbook/OpeningBalanceModal';
import CustomSelect from '../components/ui/CustomSelect';
import type { CashBookEntry, Settings } from '../types';

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
  const { t, getMonthName } = useTranslation();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashBookEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<CashBookEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<CashBookEntry | null>(null);
  const [showOpeningBalance, setShowOpeningBalance] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'accountant';

  useEffect(() => {
    fetchEntries();
    fetchSummary();
    settingsApi
      .get()
      .then((res) => {
        const s = res.data.data;
        setSettings(s);
        if (!s.openingBalance && canEdit) setShowOpeningBalance(true);
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
    if (entry.type === 'income') setShowIncomeForm(true);
    else setShowExpenseForm(true);
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
      toast.error('Fehler beim Löschen / Error deleting');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async (type: 'pdf' | 'excel' | 'xml' | 'datev') => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      if (type === 'pdf') await exportsApi.downloadPDF(selectedYear, selectedMonth ?? undefined);
      else if (type === 'excel')
        await exportsApi.downloadExcel(selectedYear, selectedMonth ?? undefined);
      else if (type === 'xml')
        await exportsApi.downloadXML(selectedYear, selectedMonth ?? undefined);
      else await exportsApi.downloadDatev(selectedYear, selectedMonth ?? undefined);
      toast.success('Export erfolgreich / Export complete');
    } catch {
      toast.error('Fehler beim Exportieren / Export error');
    } finally {
      setIsExporting(false);
    }
  };

  const isYearFinalized = settings?.finalizedYears?.includes(selectedYear) || false;
  const canModify = canEdit && !isYearFinalized;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-30">
        <div>
          <div className="flex items-center gap-3">
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
            {selectedMonth ? `${t('lblMonthlyView')}: ${getMonthName(selectedMonth)} ${selectedYear}` : t('cashBookYearlyView')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canModify ? (
            <>
              <button
                onClick={() => {
                  setEditingEntry(null);
                  setShowIncomeForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-xs transition-all"
              >
                <Plus size={17} className="stroke-[2.5]" />
                {t('btnAddIncome')}
              </button>
              <button
                onClick={() => {
                  setEditingEntry(null);
                  setShowExpenseForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-sm font-bold shadow-xs transition-all"
              >
                <Plus size={17} className="stroke-[2.5]" />
                {t('btnAddExpense')}
              </button>
              <button
                onClick={() => setShowOpeningBalance(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-sm font-bold shadow-xs transition-all"
                title={t('modalOpeningBalanceTitle')}
              >
                <Scale size={16} className="text-amber-700" />
                <span>{t('tblOpeningBalance')}</span>
              </button>
            </>
          ) : isYearFinalized && canEdit ? (
            <span className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold">
              🔒 {t('statusInactive')}: {selectedYear}
            </span>
          ) : null}

          {/* Export Dropdown */}
          <div className="relative z-50">
            <button
              onClick={() => setShowExportMenu((prev) => !prev)}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-sm font-semibold transition-all border border-slate-200 shadow-xs"
            >
              <Download size={16} className="text-brand-600" />
              {isExporting ? t('btnExporting') : t('btnExport')}
            </button>
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
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
        </div>
      </div>

      {/* Period Filter Card */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2.5 relative z-10">
        <div className="flex-shrink-0 relative z-10">
          <CustomSelect
            value={selectedYear}
            onChange={(val) => setSelectedPeriod(Number(val), selectedMonth)}
            options={YEARS.map((y) => ({ value: y, label: String(y) }))}
            className="w-28"
          />
        </div>

        <button
          onClick={() => setSelectedPeriod(selectedYear, null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap flex-shrink-0 ${
            selectedMonth === null
              ? 'bg-brand-600 border-brand-600 text-white shadow-brand'
              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600'
          }`}
        >
          {t('btnAllMonths')}
        </button>

        <div className="h-5 w-px bg-slate-200 flex-shrink-0 mx-0.5" />

        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar py-0.5">
          {MONTH_INDICES.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedPeriod(selectedYear, m)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border whitespace-nowrap flex-shrink-0 ${
                selectedMonth === m
                  ? 'bg-brand-600 border-brand-600 text-white shadow-brand'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600'
              }`}
            >
              {getMonthName(m)}
            </button>
          ))}
        </div>
      </div>

      {/* No opening balance banner */}
      {settings && !settings.openingBalance && canEdit && (
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
        canEdit={canModify}
      />

      {/* Modals */}
      {showIncomeForm && (
        <EntryForm
          type="income"
          entry={editingEntry}
          onClose={() => {
            setShowIncomeForm(false);
            setEditingEntry(null);
          }}
          onSuccess={handleRefresh}
        />
      )}
      {showExpenseForm && (
        <EntryForm
          type="expense"
          entry={editingEntry}
          onClose={() => {
            setShowExpenseForm(false);
            setEditingEntry(null);
          }}
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
