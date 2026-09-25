import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, AlertTriangle, Calendar, Info, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CashBookEntry, BookingRule } from '../../types';
import { entriesApi, bookingRulesApi, settingsApi } from '../../lib/api';
import { formatDateForInput, formatAmountWithCommas, parseFormattedAmount } from '../../lib/utils';
import { useTranslation } from '../../store/languageStore';
import { translateBookingRuleName } from '../../lib/i18n/translations';
import { optimizeDocumentIfNeeded } from '../../lib/documentCompression';
import { uploadDocumentWithProgress, type UploadedDocumentRef } from '../../lib/documentUpload';
import { cn } from '../../lib/utils';

interface Props {
  type: 'income' | 'expense';
  entry?: CashBookEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}

const VAT_OPTS = [0, 7, 19];

function getAutoVat(rule: BookingRule | string | undefined): 0 | 7 | 19 {
  if (!rule) return 0;
  if (typeof rule === 'object') {
    if (rule.defaultVat !== undefined && [0, 7, 19].includes(rule.defaultVat)) {
      return rule.defaultVat;
    }
    return getAutoVat(rule.name);
  }
  if (rule.includes('19%')) return 19;
  if (rule.includes('7%')) return 7;
  return 0;
}

export default function EntryForm({ type, entry, onClose, onSuccess }: Props) {
  const isEdit = !!entry;
  const today = new Date().toISOString().split('T')[0];
  const { t, formatCurrency, language } = useTranslation();

  const [date, setDate] = useState(isEdit ? formatDateForInput(entry!.date) : today);
  const [voucherNo, setVoucherNo] = useState(isEdit ? entry!.voucherNo : '');
  const [bookingRuleId, setBookingRuleId] = useState(
    isEdit
      ? typeof entry!.bookingRule === 'object'
        ? entry!.bookingRule._id
        : String(entry!.bookingRule)
      : ''
  );
  const [contraAccount, setContraAccount] = useState(
    isEdit ? (entry?.contraAccount || entry?.columnH || '') : ''
  );
  const [activeChart, setActiveChart] = useState<'SKR03' | 'SKR04'>('SKR04');
  const [bookingText, setBookingText] = useState(isEdit ? entry!.bookingText : '');
  const [amount, setAmount] = useState(isEdit ? formatAmountWithCommas(String(entry!.amount)) : '');
  const [vat, setVat] = useState<0 | 7 | 19>(isEdit ? entry!.vatPercentage : 0);
  /** New files selected in this session */
  const [newFiles, setNewFiles] = useState<File[]>([]);
  /** Paths of existing docs the user wants to remove (edit mode) */
  const [removedPaths, setRemovedPaths] = useState<Set<string>>(new Set());
  const [bookingRules, setBookingRules] = useState<BookingRule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleVat, setNewRuleVat] = useState<0 | 7 | 19>(0);
  const [isHistorical, setIsHistorical] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isIncome = type === 'income';

  // Existing docs in edit mode
  const existingDocs = isEdit
    ? [
        ...(entry!.documents || []),
        ...(entry!.documentPath && !(entry!.documents || []).some((d: any) => d.path === entry!.documentPath)
          ? [{ path: entry!.documentPath!, originalName: entry!.documentOriginalName || entry!.documentPath!, mimeType: 'application/octet-stream' }]
          : []),
      ]
    : [];
  const activeExistingCount = existingDocs.filter((d: any) => !removedPaths.has(d.path)).length;
  const totalFilesCount = activeExistingCount + newFiles.length;
  const isMaxFilesReached = totalFilesCount >= 10;

  useEffect(() => {
    settingsApi
      .get()
      .then((res) => {
        const s = res.data?.data;
        if (s?.datevChartOfAccounts) {
          setActiveChart(s.datevChartOfAccounts);
        }
      })
      .catch(() => {});

    bookingRulesApi
      .getAll()
      .then((res) => {
        const rules: BookingRule[] = res.data.data;
        setBookingRules(rules);
        if (isEdit && !entry?.contraAccount && !entry?.columnH) {
          const ruleId = typeof entry!.bookingRule === 'object' ? entry!.bookingRule._id : String(entry!.bookingRule);
          const r = rules.find((x) => x._id === ruleId);
          if (r) {
            setContraAccount(activeChart === 'SKR03' ? (r.accountSKR03 || '1360') : (r.accountSKR04 || '1360'));
          }
        }
      })
      .catch(() => {});
    entriesApi
      .getSummary()
      .then((res) => setCurrentBalance(res.data.data.currentBalance))
      .catch(() => {});
    if (!isEdit) {
      entriesApi
        .getNextVoucherNo()
        .then((res) => {
          if (res.data?.data?.nextVoucherNo) {
            setVoucherNo(res.data.data.nextVoucherNo);
          }
        })
        .catch(() => {});
    }
  }, [isEdit]);

  useEffect(() => {
    setIsHistorical(date < today);
  }, [date, today]);

  useEffect(() => {
    if (type === 'expense' && amount && currentBalance !== null) {
      const numAmt = parseFormattedAmount(amount);
      if (!isNaN(numAmt) && numAmt > currentBalance) {
        setBalanceWarning(
          `${t('formInsufficientBalance')} (${t('formCurrentBalance')} ${formatCurrency(
            currentBalance
          )})`
        );
      } else {
        setBalanceWarning(null);
      }
    } else {
      setBalanceWarning(null);
    }
  }, [amount, currentBalance, type, t, formatCurrency]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawValue = input.value;
    const cursor = input.selectionStart ?? rawValue.length;
    const formatted = formatAmountWithCommas(rawValue);
    setAmount(formatted);

    requestAnimationFrame(() => {
      const rawBefore = rawValue.slice(0, cursor);
      const digitsBefore = rawBefore.replace(/\D/g, '').length;
      let newCursor = formatted.length;
      let digitsFound = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) digitsFound++;
        if (digitsFound === digitsBefore) {
          newCursor = i + 1;
          break;
        }
      }
      if (cursor >= rawValue.length) newCursor = formatted.length;
      input.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleRuleChange = (ruleId: string) => {
    if (ruleId === '__add_new__') {
      setShowAddRule(true);
      return;
    }
    setBookingRuleId(ruleId);
    const rule = bookingRules.find((r) => r._id === ruleId);
    if (rule) {
      setVat(getAutoVat(rule));
      const autoAccount = activeChart === 'SKR03'
        ? (rule.accountSKR03 || rule.accountSKR04 || '1360')
        : (rule.accountSKR04 || rule.accountSKR03 || '1360');
      setContraAccount(autoAccount);
    }
  };

  const handleAddNewRule = async () => {
    if (!newRuleName.trim()) return;
    try {
      const res = await bookingRulesApi.create({
        name: newRuleName.trim(),
        defaultVat: newRuleVat,
      });
      const newRule = res.data.data;
      setBookingRules((prev) => [...prev, newRule]);
      setBookingRuleId(newRule._id);
      setVat(newRuleVat);
      setShowAddRule(false);
      setNewRuleName('');
      setNewRuleVat(0);
      toast.success(t('btnSave'));
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Speichern' : 'Error saving');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawSelected = Array.from(e.target.files || []);
    if (rawSelected.length === 0) return;
    // Reset the input so the same file can be re-added after removal
    e.target.value = '';

    const remainingSlots = Math.max(0, 10 - activeExistingCount - newFiles.length);

    if (remainingSlots <= 0) {
      toast.error(
        language === 'de'
          ? 'Maximal 10 Dateien erlaubt. Sie haben bereits 10 Dateien ausgewählt.'
          : 'Maximum 10 files allowed. You already have 10 files selected.'
      );
      return;
    }

    let selected = rawSelected;
    if (selected.length > remainingSlots) {
      selected = selected.slice(0, remainingSlots);
      toast(
        language === 'de'
          ? `Maximal 10 Dateien erlaubt. Es wurden nur die ersten ${remainingSlots} Datei(en) übernommen.`
          : `Maximum 10 files allowed. Only the first ${remainingSlots} file(s) were included.`,
        { icon: 'ℹ️' }
      );
    }

    const toAdd: File[] = [];
    for (const rawFile of selected) {
      if (rawFile.size > 100 * 1024 * 1024) {
        toast.error(
          language === 'de'
            ? `"${rawFile.name}" ist zu groß. Max. 100 MB pro Datei.`
            : `"${rawFile.name}" exceeds 100 MB limit.`
        );
        continue;
      }
      if (rawFile.size > 800 * 1024) {
        const isImg = rawFile.type.startsWith('image/') || /\.(jpe?g|png)$/i.test(rawFile.name);
        if (isImg) {
          const toastId = toast.loading(
            language === 'de' ? `"${rawFile.name}" wird optimiert…` : `Optimizing "${rawFile.name}"…`
          );
          try {
            const { file: optimized, wasCompressed, originalSizeBytes, compressedSizeBytes } =
              await optimizeDocumentIfNeeded(rawFile);
            if (wasCompressed) {
              const origMB = (originalSizeBytes / 1024 / 1024).toFixed(1);
              const compMB = (compressedSizeBytes / 1024 / 1024).toFixed(1);
              toast.success(
                language === 'de'
                  ? `Optimiert: ${origMB} MB → ${compMB} MB`
                  : `Optimized: ${origMB} MB → ${compMB} MB`,
                { id: toastId }
              );
              toAdd.push(optimized);
            } else {
              toast.dismiss(toastId);
              toAdd.push(optimized);
            }
          } catch {
            toast.dismiss(toastId);
            toAdd.push(rawFile);
          }
        } else {
          toAdd.push(rawFile);
        }
      } else {
        toAdd.push(rawFile);
      }
    }
    setNewFiles((prev) => {
      const combined = [...prev, ...toAdd];
      const maxAllowed = Math.max(0, 10 - activeExistingCount);
      return combined.slice(0, maxAllowed);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRuleId) {
      toast.error(t('msgBookingRuleRequired'));
      return;
    }
    const numAmount = parseFormattedAmount(amount);
    if (!amount || numAmount <= 0) {
      toast.error(t('msgAmountRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload any new files safely (individual / chunked) so no single request exceeds Vercel's 4.5 MB limit
      const allowedNewCount = Math.max(0, 10 - activeExistingCount);
      const filesToUpload = newFiles.slice(0, allowedNewCount);
      const uploadedDocs: UploadedDocumentRef[] = [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const toastId = toast.loading(
          language === 'de'
            ? `Dokument ${i + 1}/${filesToUpload.length} wird hochgeladen…`
            : `Uploading document ${i + 1}/${filesToUpload.length}…`
        );
        try {
          const docRef = await uploadDocumentWithProgress(file);
          uploadedDocs.push(docRef);
          toast.dismiss(toastId);
        } catch (uploadErr: any) {
          toast.dismiss(toastId);
          const errorText = uploadErr?.response?.data?.message || uploadErr?.message || '';
          toast.error(
            language === 'de'
              ? `Fehler beim Hochladen von "${file.name}" ${errorText ? `(${errorText})` : ''}`
              : `Failed to upload "${file.name}" ${errorText ? `(${errorText})` : ''}`
          );
          setIsSubmitting(false);
          return;
        }
      }

      const fd = new FormData();
      fd.append('date', date);
      fd.append('voucherNo', voucherNo.trim());
      fd.append('bookingRule', bookingRuleId);
      fd.append('bookingText', bookingText);
      fd.append('type', type);
      fd.append('amount', String(numAmount));
      fd.append('vatPercentage', String(vat));
      fd.append('contraAccount', contraAccount.trim());
      fd.append('columnH', contraAccount.trim());

      // Pass the uploaded document references as JSON string
      if (uploadedDocs.length > 0) {
        fd.append('uploadedDocuments', JSON.stringify(uploadedDocs));
      }

      // In edit mode, tell the backend which existing docs to remove
      if (isEdit && removedPaths.size > 0) {
        fd.append('removeDocumentPaths', Array.from(removedPaths).join(','));
      }

      if (isEdit) {
        await entriesApi.updateEntry(entry!._id, fd);
        toast.success(t('btnUpdate'));
      } else {
        await entriesApi.createEntry(fd);
        toast.success(t('btnSave'));
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error';
      if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance')) {
        toast.error(t('formInsufficientBalance'));
      } else if (msg.toLowerCase().includes('voucherno') || msg.toLowerCase().includes('belegnummer')) {
        toast.error(t('msgVoucherNoRequired'));
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 max-h-[96vh] overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between px-6 py-4 rounded-t-2xl border-b',
            isIncome
              ? 'bg-emerald-50/70 border-emerald-100 text-emerald-950'
              : 'bg-rose-50/70 border-rose-100 text-rose-950'
          )}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  isIncome ? 'bg-emerald-600' : 'bg-rose-600'
                )}
              />
              <h2 className="text-base font-bold text-slate-900">
                {isEdit
                  ? isIncome
                    ? t('formEditIncomeTitle')
                    : t('formEditExpenseTitle')
                  : isIncome
                  ? t('formAddIncomeTitle')
                  : t('formAddExpenseTitle')}
              </h2>
            </div>
            {currentBalance !== null && (
              <p className="text-xs text-slate-500 mt-1">
                {t('formCurrentBalance')}{' '}
                <span className="font-semibold text-slate-800">
                  {formatCurrency(currentBalance)}
                </span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          {/* Historical notice */}
          {isHistorical && (
            <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs leading-relaxed">
              <Info size={16} className="mt-0.5 flex-shrink-0 text-blue-600" />
              <p>{t('formHistoricalNotice')}</p>
            </div>
          )}

          {/* Insufficient balance warning */}
          {balanceWarning && (
            <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs leading-relaxed">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-rose-600" />
              <p>{t('formInsufficientBalance')}</p>
            </div>
          )}

          {/* Row 1: Date & Voucher Number (Equal 2-Column Grid) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  {t('lblDate')} <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setDate(today)}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  {t('btnSelectToday')}
                </button>
              </div>
              <div className="relative">
                <Calendar
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-xs"
                  required
                />
              </div>
            </div>

            {/* Voucher No */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('lblVoucherNo')}
              </label>
              <input
                type="text"
                value={voucherNo}
                disabled
                readOnly
                placeholder={t('placeholderVoucherNo')}
                title={language === 'de' ? 'Automatisch fortlaufende Belegnummer (nicht editierbar)' : 'Auto-incrementing voucher number (read-only)'}
                className="w-full px-3.5 py-2 bg-slate-100/90 border border-slate-200 rounded-xl text-slate-600 text-sm font-mono cursor-not-allowed select-none shadow-xs"
              />
            </div>
          </div>

          {/* Row 2: Booking Rule & Contra Account (Column H) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('lblBookingRule')} <span className="text-rose-500">*</span>
              </label>
              {showAddRule ? (
                <div className="space-y-2 p-2.5 bg-brand-50/40 border border-brand-200 rounded-xl animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder={t('placeholderNewRule')}
                      className="flex-1 px-3.5 py-2 bg-white border border-brand-400 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xs"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddNewRule}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      {t('btnAdd')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddRule(false)}
                      className="p-2 bg-white hover:bg-slate-100 text-slate-500 rounded-xl text-xs transition-colors border border-slate-200"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {/* VAT Selection for New Rule */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">{t('thVat')}:</span>
                      <div className="flex gap-1">
                        {([0, 7, 19] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setNewRuleVat(v)}
                            className={cn(
                              'px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all',
                              newRuleVat === v
                                ? 'bg-brand-600 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            )}
                          >
                            {v}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {language === 'en' ? 'Default VAT for rule' : 'Standard-MwSt.'}
                    </span>
                  </div>
                </div>
              ) : (
                <select
                  value={bookingRuleId}
                  onChange={(e) => handleRuleChange(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-xs"
                  required
                >
                  <option value="">{t('selectBookingRulePlaceholder')}</option>
                  {bookingRules.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.ruleNumber !== undefined ? `${r.ruleNumber}. ` : ''}{translateBookingRuleName(r.name, language)}
                    </option>
                  ))}
                  <option value="__add_new__" className="text-brand-600 font-semibold">
                    {t('addNewBookingRuleOption')}
                  </option>
                </select>
              )}
            </div>

            {/* Column H: Contra Account (Gegenkonto) */}
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('lblContraAccountColH')}
              </label>
              <input
                type="text"
                value={contraAccount}
                onChange={(e) => setContraAccount(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-xs"
                title={t('helpContraAccountColH')}
              />
            </div>
          </div>

          {/* Row 3: Booking Text (Full Width) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('lblBookingText')}
            </label>
            <input
              type="text"
              value={bookingText}
              onChange={(e) => setBookingText(e.target.value)}
              placeholder={t('placeholderBookingText')}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 placeholder-slate-400 shadow-xs"
            />
          </div>

          {/* Row 4: Amount & VAT (Equal 2-Column Grid) */}
          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isIncome ? t('lblIncomeAmount') : t('lblExpenseAmount')}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  €
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  className={cn(
                    'w-full pl-8 pr-3.5 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 placeholder-slate-400 shadow-xs font-semibold',
                    balanceWarning
                      ? 'border-rose-500 text-rose-700 focus:ring-rose-500/20 focus:border-rose-600'
                      : 'border-slate-200 text-slate-900 focus:ring-brand-500/20 focus:border-brand-600'
                  )}
                  required
                />
              </div>
            </div>

            {/* VAT */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('lblVat')} <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                {VAT_OPTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVat(v as 0 | 7 | 19)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-xs font-bold border transition-all duration-150 shadow-xs',
                      vat === v
                        ? 'bg-brand-600 border-brand-600 text-white shadow-brand'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600'
                    )}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 5: Document Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {t('lblUploadDoc')}
                <span className="ml-1 text-slate-400 font-normal">
                  ({language === 'de' ? 'bis zu 10 Dateien, je max. 100 MB' : 'up to 10 files, 100 MB each'})
                </span>
              </label>
              <span className={cn(
                "text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors",
                totalFilesCount >= 10
                  ? "bg-rose-100 text-rose-700"
                  : totalFilesCount > 0
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-400"
              )}>
                {totalFilesCount}/10 {language === 'de' ? 'Dateien' : 'files'}
              </span>
            </div>

            {/* Existing docs in edit mode */}
            {isEdit && existingDocs.length > 0 && (
              <div className="mb-2 space-y-1">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">
                  {language === 'de' ? 'Vorhandene Dokumente' : 'Existing documents'}
                </p>
                {existingDocs.map((doc: any) => {
                  const isRemoved = removedPaths.has(doc.path);
                  return (
                    <div
                      key={doc.path}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all',
                        isRemoved
                          ? 'bg-rose-50 border-rose-200 opacity-60 line-through text-rose-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={13} className={isRemoved ? 'text-rose-400' : 'text-brand-500'} />
                        <span className="truncate font-medium">{doc.originalName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRemovedPaths((prev) => {
                            const next = new Set(prev);
                            if (next.has(doc.path)) next.delete(doc.path);
                            else next.add(doc.path);
                            return next;
                          });
                        }}
                        className={cn(
                          'ml-2 flex-shrink-0 p-1 rounded-lg transition-colors text-xs font-semibold',
                          isRemoved
                            ? 'text-brand-600 hover:bg-brand-50'
                            : 'text-rose-500 hover:bg-rose-50'
                        )}
                        title={isRemoved ? (language === 'de' ? 'Wiederherstellen' : 'Restore') : (language === 'de' ? 'Entfernen' : 'Remove')}
                      >
                        {isRemoved ? (language === 'de' ? 'Wiederherstellen' : 'Restore') : <X size={13} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* New files list */}
            {newFiles.length > 0 && (
              <div className="mb-2 space-y-1">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">
                  {language === 'de' ? 'Neue Dateien' : 'New files'} ({newFiles.length})
                </p>
                {newFiles.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={13} className="text-emerald-600 flex-shrink-0" />
                      <span className="truncate font-medium text-slate-800">{f.name}</span>
                      <span className="text-[10px] text-emerald-600 flex-shrink-0">
                        {(f.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="ml-2 flex-shrink-0 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add files button */}
            <div
              onClick={() => {
                if (isMaxFilesReached) {
                  toast.error(
                    language === 'de'
                      ? 'Maximal 10 Dateien erreicht. Entfernen Sie eine Datei, um eine andere hinzuzufügen.'
                      : 'Maximum 10 files reached. Remove a file to add another.'
                  );
                  return;
                }
                fileInputRef.current?.click();
              }}
              className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-dashed transition-all group",
                isMaxFilesReached
                  ? "bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed"
                  : "bg-slate-50 hover:bg-brand-50/40 border-slate-300 hover:border-brand-400 cursor-pointer"
              )}
            >
              <div className="flex items-center gap-2.5 text-slate-600">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-brand-600 shadow-2xs">
                  <Paperclip size={15} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 group-hover:text-brand-700">
                    {isMaxFilesReached
                      ? (language === 'de' ? 'Maximal 10 Dateien erreicht' : 'Maximum 10 files reached')
                      : (language === 'de' ? 'Dateien hinzufügen' : 'Add files')}
                  </p>
                  <p className="text-[10px] text-slate-400">PDF, JPG, PNG · {language === 'de' ? 'Max. 100 MB pro Datei' : 'Max 100 MB per file'}</p>
                </div>
              </div>
              <span className={cn(
                "text-xs font-semibold px-3 py-1 rounded-lg shadow-2xs transition-colors",
                isMaxFilesReached
                  ? "bg-slate-200 text-slate-500 border border-slate-300"
                  : "text-brand-600 group-hover:text-brand-700 bg-white border border-slate-200 group-hover:border-brand-200"
              )}>
                {language === 'de' ? 'Durchsuchen' : 'Browse'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                disabled={isMaxFilesReached}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
            >
              {t('btnCancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (type === 'expense' && !!balanceWarning)}
              className={cn(
                'px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
                isIncome
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                  : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
              )}
            >
              {isSubmitting
                ? t('btnSaving')
                : isEdit
                ? t('btnUpdate')
                : t('btnSave')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
