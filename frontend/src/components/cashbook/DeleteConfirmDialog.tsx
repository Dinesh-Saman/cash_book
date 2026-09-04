import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useTranslation } from '../../store/languageStore';

interface Props {
  entryDescription: string;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}

export default function DeleteConfirmDialog({
  entryDescription,
  onConfirm,
  onClose,
  isDeleting,
}: Props) {
  const { t } = useTranslation();

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/50">
          <div className="flex items-center gap-2.5 text-rose-700">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">{t('modalDeleteTitle')}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-slate-700 text-sm leading-relaxed">
            {t('modalDeleteDesc')}
          </p>
          {entryDescription && (
            <p className="text-xs font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              {entryDescription}
            </p>
          )}
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-800 text-xs">
            ⚠️ {t('modalDeleteWarning')}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
          >
            {t('btnCancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Trash2 size={16} />
            {isDeleting ? t('btnDeleting') : t('btnDeleteConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
