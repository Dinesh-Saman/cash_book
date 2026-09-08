import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Scale } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi } from '../../lib/api';
import { useTranslation } from '../../store/languageStore';
import { formatAmountWithCommas, parseFormattedAmount } from '../../lib/utils';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  currentBalance?: number;
}

export default function OpeningBalanceModal({ onClose, onSuccess, currentBalance }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const { t, language } = useTranslation();
  const [amount, setAmount] = useState(
    currentBalance !== undefined && currentBalance !== 0
      ? formatAmountWithCommas(String(currentBalance))
      : ''
  );
  const [date, setDate] = useState(today);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFormattedAmount(amount);
    if (!amount || num < 0) {
      toast.error(language === 'de' ? 'Bitte gültigen Betrag eingeben' : 'Please enter a valid amount');
      return;
    }
    setIsSaving(true);
    try {
      await settingsApi.update({ openingBalance: num, openingBalanceDate: date });
      toast.success(t('btnSave'));
      onSuccess();
      onClose();
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Speichern' : 'Error saving');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100 bg-brand-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl purple-blue-gradient flex items-center justify-center text-white shadow-brand">
              <Scale size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                {t('modalOpeningBalanceTitle')}
              </h2>
              <p className="text-[11px] text-brand-700">{t('modalOpeningBalanceSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <p className="text-slate-600 text-xs leading-relaxed">
            {t('modalOpeningBalanceDesc')}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('lblOpeningBalanceAmount')} <span className="text-rose-500">*</span>
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
                className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-xs"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('lblDate')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-xs"
              required
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
            >
              {t('btnCancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-brand transition-colors"
            >
              {isSaving ? t('btnSaving') : t('btnSave')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
