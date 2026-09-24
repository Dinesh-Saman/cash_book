import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, Save, X, Lock, Unlock, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi, bookingRulesApi } from '../lib/api';
import { type Settings, type BookingRule, getDefaultPermissions } from '../types';
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
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/60">
        <h2 className="font-bold text-slate-900 text-sm sm:text-base">{title}</h2>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
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
  const userPerms = user?.permissions
    ? { ...getDefaultPermissions(user.role), ...user.permissions }
    : user
    ? getDefaultPermissions(user.role)
    : null;

  const canManageSettings = userPerms?.canManageSettings ?? (user?.role === 'admin');
  const isAdmin = user?.role === 'admin' || canManageSettings;
  const canManageOpeningBalance = userPerms?.canManageSettings ?? (user?.role === 'admin' || user?.role === 'accountant');
  const { t, language } = useTranslation();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [bookingRules, setBookingRules] = useState<BookingRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);
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
  const [newRuleSKR03, setNewRuleSKR03] = useState('');
  const [newRuleSKR04, setNewRuleSKR04] = useState('');
  const [editingRule, setEditingRule] = useState<BookingRule | null>(null);
  const [editRuleName, setEditRuleName] = useState('');
  const [editRuleVat, setEditRuleVat] = useState<0 | 7 | 19>(0);
  const [editRuleSKR03, setEditRuleSKR03] = useState('');
  const [editRuleSKR04, setEditRuleSKR04] = useState('');

  // Year finalization form
  const [selectedFinalizeYear, setSelectedFinalizeYear] = useState<number>(CURRENT_YEAR - 1);
  const [confirmFinalizeYear, setConfirmFinalizeYear] = useState<{ year: number; action: 'finalize' | 'unlock' } | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const fetchRules = async () => {
    setIsLoadingRules(true);
    setRulesError(null);
    try {
      const res = await bookingRulesApi.getAll();
      setBookingRules(res.data.data || []);
    } catch (err: any) {
      console.error('Failed to load rules:', err);
      setRulesError(
        err?.response?.data?.message ||
          (language === 'de' ? 'Fehler beim Laden der Buchungsregeln' : 'Failed to load booking rules')
      );
    } finally {
      setIsLoadingRules(false);
    }
  };

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
    fetchRules();
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
      toast.error(language === 'de' ? 'Fehler beim Speichern' : 'Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  const advisorTrimmed = advisorNum.trim();
  const advisorParsed = advisorTrimmed ? parseInt(advisorTrimmed, 10) : null;
  const isAdvisorValid = advisorParsed === null || (!isNaN(advisorParsed) && advisorParsed >= 1001 && advisorParsed <= 9999999 && /^\d+$/.test(advisorTrimmed));
  const advisorError = advisorTrimmed !== '' && !isAdvisorValid;

  const clientTrimmed = clientNum.trim();
  const clientParsed = clientTrimmed ? parseInt(clientTrimmed, 10) : null;
  const isClientValid = clientParsed === null || (!isNaN(clientParsed) && clientParsed >= 1 && clientParsed <= 99999 && /^\d+$/.test(clientTrimmed));
  const clientError = clientTrimmed !== '' && !isClientValid;

  const handleSaveDatev = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (advisorError) {
      toast.error(t('advisorNumInvalid'));
      return;
    }
    if (clientError) {
      toast.error(t('clientNumInvalid'));
      return;
    }
    setIsSaving(true);
    try {
      const res = await settingsApi.update({
        datevAdvisorNumber: advisorNum.trim(),
        datevClientNumber: clientNum.trim(),
        datevChartOfAccounts: chartOfAccounts,
      });
      setSettings(res.data.data);
      toast.success(t('btnSaveDatev'));
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Speichern' : 'Error saving');
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
        accountSKR03: newRuleSKR03.trim() || undefined,
        accountSKR04: newRuleSKR04.trim() || undefined,
      } as any);
      setBookingRules((prev) => [...prev, res.data.data]);
      setNewRuleName('');
      setNewRuleVat(0);
      setNewRuleSKR03('');
      setNewRuleSKR04('');
      toast.success(t('btnAddRule'));
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Hinzufügen' : 'Error adding');
    }
  };

  const handleEditRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editRuleName.trim()) return;
    try {
      const res = await bookingRulesApi.update(editingRule._id, {
        name: editRuleName.trim(),
        defaultVat: editRuleVat,
        accountSKR03: editRuleSKR03.trim(),
        accountSKR04: editRuleSKR04.trim(),
      } as any);
      setBookingRules((prev) =>
        prev.map((r) => (r._id === editingRule._id ? res.data.data : r))
      );
      setEditingRule(null);
      toast.success(t('btnUpdate'));
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Aktualisieren' : 'Error updating');
    }
  };

  const handleDeleteRule = async (rule: BookingRule) => {
    if (rule.isDefault) {
      toast.error(
        language === 'de'
          ? 'Standard-Buchungsregeln können nicht gelöscht werden.'
          : 'Default booking rules cannot be deleted.'
      );
      return;
    }
    try {
      await bookingRulesApi.delete(rule._id);
      setBookingRules((prev) => prev.filter((r) => r._id !== rule._id));
      toast.success(t('btnDelete'));
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          (language === 'de' ? 'Fehler beim Löschen' : 'Error deleting')
      );
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
      <Section
        title={`${t('secBookingRules')}${bookingRules.length > 0 ? ` (${bookingRules.length})` : ''}`}
      >
        <div className="space-y-3">
          {isLoadingRules ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2.5">
              <Loader2 className="animate-spin text-brand-600" size={20} />
              <span className="text-xs font-semibold">
                {language === 'de' ? 'Buchungsregeln werden geladen...' : 'Loading booking rules...'}
              </span>
            </div>
          ) : rulesError ? (
            <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{rulesError}</span>
              </div>
              <button
                type="button"
                onClick={fetchRules}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              >
                <RefreshCw size={12} />
                {language === 'de' ? 'Wiederholen' : 'Retry'}
              </button>
            </div>
          ) : bookingRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-3">
                {language === 'de'
                  ? 'Keine Buchungsregeln vorhanden oder initialisiert.'
                  : 'No booking rules found or initialized.'}
              </p>
              <button
                type="button"
                onClick={fetchRules}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-brand transition-colors"
              >
                <RefreshCw size={13} />
                {language === 'de' ? 'Standard-Buchungsregeln laden' : 'Load Standard Booking Rules'}
              </button>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1 sm:pr-2 space-y-2 divide-y divide-slate-100">
              {bookingRules.map((rule) => (
                <div
                  key={rule._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 pt-2.5 first:pt-0"
                >
                  {editingRule?._id === rule._id ? (
                    <form onSubmit={handleEditRule} className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 py-1">
                      {/* Rule number shown read-only during edit */}
                      {rule.ruleNumber !== undefined && (
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-extrabold rounded-xl border border-slate-200 tabular-nums select-none" title="Rule number is permanent and cannot be changed">
                          #{rule.ruleNumber}
                        </span>
                      )}
                      <input
                        value={editRuleName}
                        onChange={(e) => setEditRuleName(e.target.value)}
                        className="flex-1 min-w-[140px] px-3 py-1.5 bg-white border border-brand-500 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xs"
                        autoFocus
                      />
                      {/* Contra account input */}
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl flex-shrink-0">
                        <span className="text-[10px] font-semibold text-slate-500">{chartOfAccounts}:</span>
                        <input
                          value={chartOfAccounts === 'SKR03' ? editRuleSKR03 : editRuleSKR04}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                            if (chartOfAccounts === 'SKR03') setEditRuleSKR03(val);
                            else setEditRuleSKR04(val);
                          }}
                          placeholder={chartOfAccounts === 'SKR03' ? '1200' : '1800'}
                          className="w-16 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-900 text-[11px] font-mono text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                          title={`${chartOfAccounts} Gegenkonto`}
                        />
                      </div>
                      {/* VAT Pills for editing rule */}
                      <div className="flex items-center justify-between sm:justify-start gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl flex-shrink-0">
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
                        <div className="flex items-center gap-1 ml-1 sm:ml-2">
                          <button
                            type="submit"
                            className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center"
                            title={t('btnSave')}
                          >
                            <Save size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRule(null)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs"
                            title={t('btnCancel')}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        {rule.ruleNumber !== undefined && (
                          <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-extrabold rounded-md border border-slate-300 tracking-wide tabular-nums select-none" title="Unique rule number (permanent)">
                            #{rule.ruleNumber}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-800 leading-snug truncate">
                          {translateBookingRuleName(rule.name, language)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono font-medium rounded-md border border-slate-200 whitespace-nowrap" title={`${chartOfAccounts} Gegenkonto`}>
                            {chartOfAccounts}: {chartOfAccounts === 'SKR03' ? (rule.accountSKR03 || '1360') : (rule.accountSKR04 || '1360')}
                          </span>
                          {rule.defaultVat !== undefined && (
                            <span className="px-2 py-0.5 bg-brand-50 text-brand-700 text-[10px] font-bold rounded-md border border-brand-200 whitespace-nowrap">
                              {rule.defaultVat}% {t('thVat')}
                            </span>
                          )}
                          {rule.isDefault && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-md border border-slate-200 whitespace-nowrap">
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
                                setEditRuleSKR03(rule.accountSKR03 || '');
                                setEditRuleSKR04(rule.accountSKR04 || '');
                              }}
                              className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                              title={t('btnEdit')}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title={t('btnDelete')}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAdmin && (
            <form onSubmit={handleAddRule} className="flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-slate-100">
              <input
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder={t('placeholderNewRule')}
                className="w-full sm:flex-1 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-xs"
              />
              <input
                value={chartOfAccounts === 'SKR03' ? newRuleSKR03 : newRuleSKR04}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                  if (chartOfAccounts === 'SKR03') setNewRuleSKR03(val);
                  else setNewRuleSKR04(val);
                }}
                placeholder={chartOfAccounts === 'SKR03' ? 'Konto (z.B. 1200)' : 'Konto (z.B. 1800)'}
                className="w-full sm:w-36 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-xs"
                title={`${chartOfAccounts} Gegenkonto`}
              />
              <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl flex-1 sm:flex-initial">
                  <span className="text-[11px] font-semibold text-slate-500">{t('thVat')}:</span>
                  {([0, 7, 19] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewRuleVat(v)}
                      className={`flex-1 sm:flex-initial px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
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
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-brand transition-colors whitespace-nowrap flex-shrink-0"
                >
                  <Plus size={15} />
                  {t('btnAddRule')}
                </button>
              </div>
            </form>
          )}
        </div>
      </Section>

      {/* DATEV Configuration */}
      {isAdmin && (
        <Section title={t('secDatev')}>
          <form onSubmit={handleSaveDatev} className="space-y-4">
            <FieldRow label={t('lblAdvisorNum')}>
              <div className="space-y-1">
                <input
                  type="text"
                  value={advisorNum}
                  onChange={(e) => setAdvisorNum(e.target.value.replace(/\D/g, ''))}
                  placeholder="z.B. 1001"
                  maxLength={7}
                  className={`${inputClass} ${advisorError ? 'border-rose-400 focus:ring-rose-400/20' : ''}`}
                />
                <p className={`text-[11px] ${advisorError ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
                  {advisorError ? t('advisorNumInvalid') : t('advisorNumHelp')}
                </p>
              </div>
            </FieldRow>
            <FieldRow label={t('lblClientNum')}>
              <div className="space-y-1">
                <input
                  type="text"
                  value={clientNum}
                  onChange={(e) => setClientNum(e.target.value.replace(/\D/g, ''))}
                  placeholder="z.B. 10001"
                  maxLength={5}
                  className={`${inputClass} ${clientError ? 'border-rose-400 focus:ring-rose-400/20' : ''}`}
                />
                <p className={`text-[11px] ${clientError ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
                  {clientError ? t('clientNumInvalid') : t('clientNumHelp')}
                </p>
              </div>
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
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-xs font-bold px-2 py-0.5 bg-brand-50 text-brand-700 border border-brand-200 rounded-md">
                    {chartOfAccounts === 'SKR03' ? 'Konto 1600' : 'Konto 1000'}
                  </span>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {chartOfAccounts === 'SKR04' ? t('descSkr04') : t('descSkr03')}
                  </p>
                </div>
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
