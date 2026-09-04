import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, Save, X, Lock, Unlock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi, bookingRulesApi } from '../lib/api';
import type { Settings, BookingRule } from '../types';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import { translateBookingRuleName } from '../lib/i18n/translations';
import { formatAmountWithCommas, parseFormattedAmount } from '../lib/utils';

const CURRENT_YEAR = new Date().getFullYear();
const FINALIZATION_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const inputClass =
  'w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 disabled:opacity-50 disabled:bg-slate-50 shadow-xs';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <h2 className="font-bold text-slate-900 text-sm sm:text-base">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
      <label className="text-xs sm:text-sm font-semibold text-slate-700 w-48 flex-shrink-0">
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const canManageOpeningBalance = user?.role === 'admin' || user?.role === 'accountant';
  const { t, language } = useTranslation();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [bookingRules, setBookingRules] = useState<BookingRule[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Opening balance form
  const [obAmount, setObAmount] = useState('');
  const [obDate, setObDate] = useState('');

  // DATEV form
  const [advisorNum, setAdvisorNum] = useState('');
  const [clientNum, setClientNum] = useState('');
  const [chartOfAccounts, setChartOfAccounts] = useState<'SKR03' | 'SKR04'>('SKR04');

  // Booking rule form
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleVat, setNewRuleVat] = useState<0 | 7 | 19>(0);
  const [editingRule, setEditingRule] = useState<BookingRule | null>(null);
  const [editRuleName, setEditRuleName] = useState('');
  const [editRuleVat, setEditRuleVat] = useState<0 | 7 | 19>(0);

  // Year finalization form
  const [selectedFinalizeYear, setSelectedFinalizeYear] = useState<number>(CURRENT_YEAR - 1);
  const [confirmFinalizeYear, setConfirmFinalizeYear] = useState<{ year: number; action: 'finalize' | 'unlock' } | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    settingsApi
      .get()
      .then((res) => {
        const s = res.data.data;
        setSettings(s);
        setObAmount(s.openingBalance ? formatAmountWithCommas(String(s.openingBalance)) : '');
        setObDate(
          s.openingBalanceDate
            ? s.openingBalanceDate.split('T')[0]
            : new Date().toISOString().split('T')[0]
        );
        setAdvisorNum(s.datevAdvisorNumber || '');
        setClientNum(s.datevClientNumber || '');
        setChartOfAccounts(s.datevChartOfAccounts || 'SKR04');
      })
      .catch(() => {});
    bookingRulesApi
      .getAll()
      .then((res) => setBookingRules(res.data.data))
      .catch(() => {});
  }, []);

  const handleObAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawValue = input.value;
    const cursor = input.selectionStart ?? rawValue.length;
    const formatted = formatAmountWithCommas(rawValue);
    setObAmount(formatted);

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

  const handleSaveOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageOpeningBalance) return;
    setIsSaving(true);
    try {
      const res = await settingsApi.update({ openingBalance: parseFormattedAmount(obAmount), openingBalanceDate: obDate });
      setSettings(res.data.data);
      toast.success(t('btnSaveOpeningBalance'));
    } catch {
      toast.error('Fehler beim Speichern / Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDatev = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const res = await settingsApi.update({
        datevAdvisorNumber: advisorNum,
        datevClientNumber: clientNum,
        datevChartOfAccounts: chartOfAccounts,
      });
      setSettings(res.data.data);
      toast.success(t('btnSaveDatev'));
    } catch {
      toast.error('Fehler beim Speichern / Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;
    try {
      const res = await bookingRulesApi.create({
        name: newRuleName.trim(),
        defaultVat: newRuleVat,
      });
      setBookingRules((prev) => [...prev, res.data.data]);
      setNewRuleName('');
      setNewRuleVat(0);
      toast.success(t('btnAddRule'));
    } catch {
      toast.error('Fehler beim Hinzufügen / Error adding');
    }
  };

  const handleEditRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editRuleName.trim()) return;
    try {
      const res = await bookingRulesApi.update(editingRule._id, {
        name: editRuleName.trim(),
        defaultVat: editRuleVat,
      });
      setBookingRules((prev) =>
        prev.map((r) => (r._id === editingRule._id ? res.data.data : r))
      );
      setEditingRule(null);
      toast.success(t('btnUpdate'));
    } catch {
      toast.error('Fehler / Error');
    }
  };

  const handleDeleteRule = async (rule: BookingRule) => {
    if (rule.isDefault) {
      toast.error('Standard-Buchungsregeln können nicht gelöscht werden / Default rules cannot be deleted');
      return;
    }
    try {
      await bookingRulesApi.delete(rule._id);
      setBookingRules((prev) => prev.filter((r) => r._id !== rule._id));
      toast.success(t('btnDelete'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Fehler beim Löschen / Error deleting');
    }
  };

  const handleFinalizeAction = async () => {
    if (!confirmFinalizeYear || !isAdmin) return;
    setIsFinalizing(true);
    try {
      const res = await settingsApi.finalizeYear(confirmFinalizeYear.year, confirmFinalizeYear.action);
      setSettings(res.data.data);
      toast.success(
        confirmFinalizeYear.action === 'finalize'
          ? `Geschäftsjahr ${confirmFinalizeYear.year} erfolgreich abgeschlossen`
          : `Geschäftsjahr ${confirmFinalizeYear.year} erfolgreich entsperrt`
      );
      setConfirmFinalizeYear(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Fehler beim Jahresabschluss');
    } finally {
      setIsFinalizing(false);
    }
  };

  const finalizedYears = settings?.finalizedYears || [];
  const isSelectedYearFinalized = finalizedYears.includes(selectedFinalizeYear);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t('settingsTitle')}
        </h1>
        <p className="text-slate-500 text-sm mt-0.5 font-medium">
          {t('settingsSubtitle')}
        </p>
      </div>

      {/* Opening Balance */}
      <Section title={t('secCashBookSettings')}>
        <form onSubmit={handleSaveOpeningBalance} className="space-y-4">
          <FieldRow label={t('lblOpeningBalanceAmount')}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                €
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={obAmount}
                onChange={handleObAmountChange}
                disabled={!canManageOpeningBalance}
                placeholder="0.00"
                className={`${inputClass} pl-8 font-semibold`}
              />
            </div>
          </FieldRow>
          <FieldRow label={t('lblOpeningBalanceDate')}>
            <input
              type="date"
              value={obDate}
              onChange={(e) => setObDate(e.target.value)}
              disabled={!canManageOpeningBalance}
              className={inputClass}
            />
          </FieldRow>
          {canManageOpeningBalance && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-brand disabled:opacity-50 transition-all"
              >
                <Save size={15} />
                {isSaving ? t('btnSaving') : t('btnSaveOpeningBalance')}
              </button>
            </div>
          )}
        </form>
      </Section>

      {/* Booking Rules */}
      <Section title={t('secBookingRules')}>
        <div className="space-y-2">
          <div className="max-h-80 overflow-y-auto pr-2 space-y-1.5 divide-y divide-slate-100">
            {bookingRules.map((rule) => (
              <div
                key={rule._id}
                className="flex items-center justify-between gap-3 pt-2 first:pt-0"
              >
                {editingRule?._id === rule._id ? (
                  <form onSubmit={handleEditRule} className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-2 py-1">
                    <input
                      value={editRuleName}
                      onChange={(e) => setEditRuleName(e.target.value)}
                      className="flex-1 min-w-[140px] px-3 py-1.5 bg-white border border-brand-500 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xs"
                      autoFocus
                    />
                    {/* VAT Pills for editing rule */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl flex-shrink-0">
                      <span className="text-[10px] font-semibold text-slate-500">{t('thVat')}:</span>
                      {([0, 7, 19] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setEditRuleVat(v)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                            editRuleVat === v
                              ? 'bg-brand-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {v}%
                        </button>
                      ))}
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center flex-shrink-0"
                      title={t('btnSave')}
                    >
                      <Save size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRule(null)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs flex-shrink-0"
                      title={t('btnCancel')}
                    >
                      <X size={13} />
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-slate-800">
                        {translateBookingRuleName(rule.name, language)}
                      </span>
                      {rule.defaultVat !== undefined && (
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-700 text-[10px] font-bold rounded-md border border-brand-200">
                          {rule.defaultVat}% {t('thVat')}
                        </span>
                      )}
                      {rule.isDefault && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-md border border-slate-200">
                          {t('badgeDefaultRule')}
                        </span>
                      )}
                    </div>
                    {isAdmin && !rule.isDefault && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setEditRuleName(rule.name);
                            setEditRuleVat(rule.defaultVat ?? 0);
                          }}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title={t('btnEdit')}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title={t('btnDelete')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {isAdmin && (
            <form onSubmit={handleAddRule} className="flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-slate-100">
              <input
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder={t('placeholderNewRule')}
                className="flex-1 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-xs"
              />
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500">{t('thVat')}:</span>
                {([0, 7, 19] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setNewRuleVat(v)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                      newRuleVat === v
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-brand transition-colors"
              >
                <Plus size={15} />
                {t('btnAddRule')}
              </button>
            </form>
          )}
        </div>
      </Section>

      {/* DATEV Configuration */}
      {isAdmin && (
        <Section title={t('secDatev')}>
          <form onSubmit={handleSaveDatev} className="space-y-4">
            <FieldRow label={t('lblAdvisorNum')}>
              <input
                type="text"
                value={advisorNum}
                onChange={(e) => setAdvisorNum(e.target.value)}
                placeholder="z.B. 12345"
                className={inputClass}
              />
            </FieldRow>
            <FieldRow label={t('lblClientNum')}>
              <input
                type="text"
                value={clientNum}
                onChange={(e) => setClientNum(e.target.value)}
                placeholder="z.B. 67890"
                className={inputClass}
              />
            </FieldRow>
            <FieldRow label={t('lblChartOfAccounts')}>
              <div className="space-y-2">
                <div className="flex gap-3">
                  {(['SKR03', 'SKR04'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setChartOfAccounts(s)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        chartOfAccounts === s
                          ? 'bg-brand-600 border-brand-600 text-white shadow-brand'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-brand-400 hover:text-brand-600'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  {chartOfAccounts === 'SKR04' ? t('descSkr04') : t('descSkr03')}
                </p>
              </div>
            </FieldRow>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-brand disabled:opacity-50 transition-colors"
              >
                <Save size={15} />
                {isSaving ? t('btnSaving') : t('btnSaveDatev')}
              </button>
            </div>
          </form>
        </Section>
      )}

      {/* Fiscal Year Finalization (SRS §8) */}
      {isAdmin && (
        <Section title={t('secYearFinalization')}>
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('descYearFinalization')}
            </p>

            <FieldRow label={t('lblSelectYearToFinalize')}>
              <div className="flex items-center gap-3">
                <select
                  value={selectedFinalizeYear}
                  onChange={(e) => setSelectedFinalizeYear(Number(e.target.value))}
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xs"
                >
                  {FINALIZATION_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y} {finalizedYears.includes(y) ? '🔒 (Abgeschlossen)' : ''}
                    </option>
                  ))}
                </select>

                {isSelectedYearFinalized ? (
                  <button
                    type="button"
                    onClick={() => setConfirmFinalizeYear({ year: selectedFinalizeYear, action: 'unlock' })}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    <Unlock size={14} />
                    {t('btnUnfinalizeYear')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmFinalizeYear({ year: selectedFinalizeYear, action: 'finalize' })}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    <Lock size={14} />
                    {t('btnFinalizeYear')}
                  </button>
                )}
              </div>
            </FieldRow>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                {t('finalizedYearsList')}
              </p>
              {finalizedYears.length === 0 ? (
                <p className="text-xs text-slate-400 italic">{t('noneFinalized')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {finalizedYears.map((yr) => (
                    <span
                      key={yr}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold"
                    >
                      <Lock size={12} />
                      {yr}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Confirmation Modal for Finalization */}
      {confirmFinalizeYear &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                    <AlertTriangle size={18} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {confirmFinalizeYear.action === 'finalize'
                      ? t('confirmFinalizeTitle', { year: confirmFinalizeYear.year })
                      : t('confirmUnlockTitle', { year: confirmFinalizeYear.year })}
                  </h3>
                </div>
                <button
                  onClick={() => setConfirmFinalizeYear(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {confirmFinalizeYear.action === 'finalize'
                    ? t('confirmFinalizeDesc', { year: confirmFinalizeYear.year })
                    : t('confirmUnlockDesc', { year: confirmFinalizeYear.year })}
                </p>
              </div>
              <div className="flex gap-3 px-6 pb-6 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmFinalizeYear(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  {t('btnCancel')}
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeAction}
                  disabled={isFinalizing}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-colors shadow-xs ${
                    confirmFinalizeYear.action === 'finalize'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isFinalizing
                    ? t('btnSaving')
                    : confirmFinalizeYear.action === 'finalize'
                    ? t('btnFinalizeYear')
                    : t('btnUnfinalizeYear')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
