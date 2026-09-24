import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileText, Minimize2, ChevronLeft, ChevronRight, Files } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CashBookEntry, EntryDocument } from '../../types';
import { entriesApi } from '../../lib/api';
import { useTranslation } from '../../store/languageStore';

interface Props {
  entry: CashBookEntry;
  onClose: () => void;
}

function getDocuments(entry: CashBookEntry): EntryDocument[] {
  const docs: EntryDocument[] = [];

  if (Array.isArray(entry.documents) && entry.documents.length > 0) {
    docs.push(...entry.documents);
  }

  // Legacy single-doc fallback
  if (entry.documentPath && !docs.some((d) => d.path === entry.documentPath)) {
    const ext = (entry.documentOriginalName || entry.documentPath).split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    };
    docs.push({
      path: entry.documentPath,
      originalName: entry.documentOriginalName || entry.documentPath,
      mimeType: mimeMap[ext] || 'application/octet-stream',
    });
  }

  return docs;
}

function DocIcon({ mimeType, className = '' }: { mimeType: string; className?: string }) {
  const isPdf = mimeType === 'application/pdf';
  return (
    <div className={`flex items-center justify-center rounded-lg ${isPdf ? 'bg-rose-100 text-rose-600' : 'bg-brand-100 text-brand-600'} ${className}`}>
      <FileText size={20} />
    </div>
  );
}

export default function DocumentViewer({ entry, onClose }: Props) {
  const { language } = useTranslation();
  const docs = getDocuments(entry);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isMergingPDF, setIsMergingPDF] = useState(false);

  const selected = docs[selectedIdx];
  if (!selected) return null;

  const viewUrl = `/uploads/${selected.path}`;
  const downloadUrl = `/uploads/${selected.path}?download=true`;

  const ext = selected.originalName.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png'].includes(ext) || selected.mimeType.startsWith('image/');
  const isPdf = ext === 'pdf' || selected.mimeType === 'application/pdf';

  const handleMergedPDF = async () => {
    setIsMergingPDF(true);
    try {
      await entriesApi.downloadMergedPDF(entry._id, entry.voucherNo);
      toast.success(
        language === 'de' ? 'Zusammengeführtes PDF heruntergeladen' : 'Merged PDF downloaded'
      );
    } catch {
      toast.error(language === 'de' ? 'Fehler beim Erstellen des PDF' : 'Failed to generate merged PDF');
    } finally {
      setIsMergingPDF(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
              <Files size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-slate-900 font-bold text-sm truncate">
                {language === 'de' ? 'Dokumente' : 'Documents'} — {language === 'de' ? 'Beleg' : 'Voucher'} {entry.voucherNo || '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {docs.length} {language === 'de' ? (docs.length === 1 ? 'Datei' : 'Dateien') : (docs.length === 1 ? 'file' : 'files')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Primary Download: Single PDF */}
            <button
              onClick={handleMergedPDF}
              disabled={isMergingPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              title={
                language === 'de'
                  ? 'Als einzelnes PDF herunterladen'
                  : 'Download as single PDF'
              }
            >
              <Download size={13} />
              {isMergingPDF
                ? (language === 'de' ? 'Erstelle PDF…' : 'Generating…')
                : (docs.length > 1
                    ? (language === 'de' ? 'Alle als 1 PDF' : 'Download All as 1 PDF')
                    : (language === 'de' ? 'PDF herunterladen' : 'Download PDF'))}
            </button>

            {/* Download selected individual document (only if more than 1 doc) */}
            {docs.length > 1 && (
              <a
                href={downloadUrl}
                download={selected.originalName}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-xs transition-colors"
                title={language === 'de' ? 'Aktuelle Datei herunterladen' : 'Download selected file'}
              >
                <Download size={13} />
                {language === 'de' ? 'Einzeldatei' : 'Single File'}
              </a>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body: sidebar + preview ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Thumbnail sidebar — only shown when > 1 doc */}
          {docs.length > 1 && (
            <div className="w-44 flex-shrink-0 border-r border-slate-200 bg-slate-50/60 overflow-y-auto py-3 px-2 space-y-1.5">
              {docs.map((doc, idx) => {
                const dExt = doc.originalName.split('.').pop()?.toLowerCase() || '';
                const dIsImage = ['jpg', 'jpeg', 'png'].includes(dExt) || doc.mimeType.startsWith('image/');
                const isActive = idx === selectedIdx;
                return (
                  <button
                    key={doc.path}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full flex flex-col items-center gap-2 p-2 rounded-xl border transition-all text-left ${
                      isActive
                        ? 'bg-brand-50 border-brand-300 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-brand-200 hover:bg-brand-50/40'
                    }`}
                  >
                    {dIsImage ? (
                      <div className="w-full h-20 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                        <img
                          src={`/uploads/${doc.path}`}
                          alt={doc.originalName}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-20 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
                        <FileText size={28} className="text-rose-400" />
                      </div>
                    )}
                    <p className="text-[10px] font-medium text-slate-700 text-center line-clamp-2 leading-tight w-full">
                      {doc.originalName}
                    </p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                      dIsImage ? 'bg-brand-100 text-brand-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {dExt}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Main preview area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">

            {/* File name bar + prev/next nav */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <DocIcon mimeType={selected.mimeType} className="w-6 h-6 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-800 truncate">{selected.originalName}</span>
                <span className="text-[10px] text-slate-400 flex-shrink-0">
                  {selectedIdx + 1} / {docs.length}
                </span>
              </div>
              {docs.length > 1 && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setSelectedIdx((i) => Math.max(0, i - 1))}
                    disabled={selectedIdx === 0}
                    className="p-1 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedIdx((i) => Math.min(docs.length - 1, i + 1))}
                    disabled={selectedIdx === docs.length - 1}
                    className="p-1 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-auto p-4 bg-slate-100/50 min-h-0">
              {isImage && (
                <div className="flex items-center justify-center h-full min-h-[350px]">
                  <img
                    src={viewUrl}
                    alt={selected.originalName}
                    className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-lg border border-slate-200"
                  />
                </div>
              )}
              {isPdf && (
                <iframe
                  src={viewUrl}
                  className="w-full h-full min-h-[60vh] rounded-xl border border-slate-200 shadow-xs bg-white"
                  title={selected.originalName}
                />
              )}
              {!isImage && !isPdf && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
                  <FileText size={48} className="text-slate-300" />
                  <p className="text-sm font-medium">No preview available</p>
                  <a
                    href={downloadUrl}
                    download={selected.originalName}
                    className="text-brand-600 hover:text-brand-700 text-sm font-semibold underline"
                  >
                    Download to view
                  </a>
                </div>
              )}
            </div>

            {/* Image info banner */}
            {isImage && (
              <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 text-blue-700 text-[11px] flex items-center gap-2 flex-shrink-0">
                <Minimize2 size={11} className="flex-shrink-0" />
                <span>
                  {language === 'de'
                    ? 'Original gespeichert. Optimierte Ansicht in hoher Qualität.'
                    : 'Original stored. Optimized view with high quality.'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
