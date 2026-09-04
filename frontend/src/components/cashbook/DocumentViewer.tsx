import { createPortal } from 'react-dom';
import { X, Download, FileText } from 'lucide-react';
import { useTranslation } from '../../store/languageStore';

interface Props {
  documentPath: string;
  documentOriginalName?: string;
  onClose: () => void;
}

export default function DocumentViewer({ documentPath, documentOriginalName, onClose }: Props) {
  const url = `/uploads/${documentPath}`;
  const downloadUrl = `/uploads/${documentPath}?download=true`;
  const name = documentOriginalName || documentPath;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png'].includes(ext);
  const isPdf = ext === 'pdf';
  const { t } = useTranslation();

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
              <FileText size={18} />
            </div>
            <span className="text-slate-900 font-semibold text-sm truncate max-w-md">{name}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              download={name}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Download size={14} />
              {t('docViewerDownload')}
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-100/50">
          {isImage && (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <img
                src={url}
                alt={name}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-card border border-slate-200"
              />
            </div>
          )}
          {isPdf && (
            <iframe
              src={url}
              className="w-full h-full min-h-[65vh] rounded-xl border border-slate-200 shadow-xs bg-white"
              title={name}
            />
          )}
          {!isImage && !isPdf && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
              <FileText size={48} className="text-slate-300" />
              <p className="text-sm">{t('docViewerNoPreview')}</p>
              <a
                href={downloadUrl}
                download={name}
                className="text-brand-600 hover:text-brand-700 text-sm font-semibold underline"
              >
                {t('docViewerDownloadFile')}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
