import { useEffect, useState, useCallback } from 'react';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { auditApi } from '../../lib/api';
import type { AuditLog } from '../../types';
import { useTranslation } from '../../store/languageStore';

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold',
  UPDATE: 'bg-amber-50 text-amber-700 border border-amber-200 font-bold',
  DELETE: 'bg-rose-50 text-rose-700 border border-rose-200 font-bold',
  FINALIZE: 'bg-brand-50 text-brand-700 border border-brand-200 font-bold',
  LOGIN: 'bg-slate-100 text-slate-700 border border-slate-200 font-medium',
};

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { t, language } = useTranslation();

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(language === 'en' ? 'en-US' : 'de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatAmountStr = (numStr: string, lang: string): string => {
    const n = parseFloat(numStr.replace(/,/g, ''));
    if (isNaN(n)) return numStr;
    if (lang === 'de') {
      return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const translateAuditDescription = (desc: string, lang: string): string => {
    if (!desc) return '';
    if (lang === 'de') {
      // Created expense entry <voucher> (€ <amount>)
      let m = desc.match(/^Created expense entry\s*(.*?)\s*\(\s*€\s*([\d.,]+)\s*\)$/i);
      if (m) {
        const v = m[1].trim();
        const a = formatAmountStr(m[2], 'de');
        return `Ausgabeneintrag ${v ? `„${v}“ ` : ''}(€ ${a}) erstellt`;
      }

      // Created income entry <voucher> (€ <amount>)
      m = desc.match(/^Created income entry\s*(.*?)\s*\(\s*€\s*([\d.,]+)\s*\)$/i);
      if (m) {
        const v = m[1].trim();
        const a = formatAmountStr(m[2], 'de');
        return `Einnahmeneintrag ${v ? `„${v}“ ` : ''}(€ ${a}) erstellt`;
      }

      // Created entry <voucher> (€ <amount>)
      m = desc.match(/^Created entry\s*(.*?)\s*\(\s*€\s*([\d.,]+)\s*\)$/i);
      if (m) {
        const v = m[1].trim();
        const a = formatAmountStr(m[2], 'de');
        return `Eintrag ${v ? `„${v}“ ` : ''}(€ ${a}) erstellt`;
      }

      // Created entry <voucher>
      m = desc.match(/^Created entry\s*(.*)$/i);
      if (m) {
        const v = m[1].trim();
        return `Eintrag ${v ? `„${v}“ ` : ''}erstellt`;
      }

      // Updated entry <voucher> (€ <amount>)
      m = desc.match(/^Updated entry\s*(.*?)\s*\(\s*€\s*([\d.,]+)\s*\)$/i);
      if (m) {
        const v = m[1].trim();
        const a = formatAmountStr(m[2], 'de');
        return `Eintrag ${v ? `„${v}“ ` : ''}(€ ${a}) aktualisiert`;
      }

      // Updated entry <voucher>
      m = desc.match(/^Updated entry\s*(.*)$/i);
      if (m) {
        const v = m[1].trim();
        return `Eintrag ${v ? `„${v}“ ` : ''}aktualisiert`;
      }

      // Deleted entry <voucher>
      m = desc.match(/^Deleted entry\s*(.*)$/i);
      if (m) {
        const v = m[1].trim();
        return `Eintrag ${v ? `„${v}“ ` : ''}gelöscht`;
      }

      // User <email> successfully logged in
      m = desc.match(/^User\s+(\S+)\s+successfully logged in$/i);
      if (m) return `Benutzer ${m[1]} erfolgreich angemeldet`;

      // Initial admin user registered
      if (/^Initial admin user registered$/i.test(desc)) {
        return 'Erster Administrator-Benutzer registriert';
      }

      // Updated opening balance to € <amount>
      m = desc.match(/^Updated opening balance to\s*€\s*([\d.,]+)$/i);
      if (m) {
        const a = formatAmountStr(m[1], 'de');
        return `Anfangsbestand auf € ${a} aktualisiert`;
      }

      // Finalized fiscal year <year>
      m = desc.match(/^Finalized fiscal year\s+(\d+)$/i);
      if (m) return `Geschäftsjahr ${m[1]} abgeschlossen`;

      // Unlocked fiscal year <year>
      m = desc.match(/^Unlocked fiscal year\s+(\d+)$/i);
      if (m) return `Geschäftsjahr ${m[1]} entsperrt`;

      // Created booking rule "<name>" (<vat>% VAT)
      m = desc.match(/^Created booking rule\s+"([^"]+)"\s*\((\d+)%\s*VAT\)$/i);
      if (m) return `Buchungsregel „${m[1]}“ (${m[2]}% MwSt.) erstellt`;

      // Created booking rule "<name>"
      m = desc.match(/^Created booking rule\s+"?([^"]+)"?$/i);
      if (m) return `Buchungsregel „${m[1]}“ erstellt`;

      // Updated booking rule "<name>" (<vat>% VAT)
      m = desc.match(/^Updated booking rule\s+"([^"]+)"\s*\((\d+)%\s*VAT\)$/i);
      if (m) return `Buchungsregel „${m[1]}“ (${m[2]}% MwSt.) aktualisiert`;

      // Updated booking rule "<name>"
      m = desc.match(/^Updated booking rule\s+"?([^"]+)"?$/i);
      if (m) return `Buchungsregel „${m[1]}“ aktualisiert`;

      // Deleted booking rule "<name>"
      m = desc.match(/^Deleted booking rule\s+"?([^"]+)"?$/i);
      if (m) return `Buchungsregel „${m[1]}“ gelöscht`;

      // Created user <email> (<role>)
      m = desc.match(/^Created user\s+(\S+)\s*\(([^)]+)\)$/i);
      if (m) {
        const roleMap: Record<string, string> = { admin: 'Administrator', accountant: 'Buchhalter', viewer: 'Betrachter' };
        const role = roleMap[m[2].toLowerCase()] || m[2];
        return `Benutzer ${m[1]} (${role}) erstellt`;
      }

      // Updated user <email>
      m = desc.match(/^Updated user\s+(\S+)$/i);
      if (m) return `Benutzer ${m[1]} aktualisiert`;

      // Deactivated user <email>
      m = desc.match(/^Deactivated user\s+(\S+)$/i);
      if (m) return `Benutzer ${m[1]} deaktiviert`;

      return desc;
    }

    // English formatting (if description was stored in German)
    let m = desc.match(/^Ausgabeneintrag\s*(?:„([^“]+)“\s*)?\(\s*€\s*([\d.,]+)\s*\)\s*erstellt$/i);
    if (m) return `Created expense entry ${m[1] ? m[1] + ' ' : ''}(€ ${formatAmountStr(m[2], 'en')})`;
    m = desc.match(/^Einnahmeneintrag\s*(?:„([^“]+)“\s*)?\(\s*€\s*([\d.,]+)\s*\)\s*erstellt$/i);
    if (m) return `Created income entry ${m[1] ? m[1] + ' ' : ''}(€ ${formatAmountStr(m[2], 'en')})`;
    m = desc.match(/^Eintrag\s*(?:„([^“]+)“\s*)?\(\s*€\s*([\d.,]+)\s*\)\s*erstellt$/i);
    if (m) return `Created entry ${m[1] ? m[1] + ' ' : ''}(€ ${formatAmountStr(m[2], 'en')})`;
    m = desc.match(/^Eintrag\s*(?:„([^“]+)“\s*)?\(\s*€\s*([\d.,]+)\s*\)\s*aktualisiert$/i);
    if (m) return `Updated entry ${m[1] ? m[1] + ' ' : ''}(€ ${formatAmountStr(m[2], 'en')})`;
    m = desc.match(/^Eintrag\s*(?:„([^“]+)“\s*)?gelöscht$/i);
    if (m) return `Deleted entry ${m[1] || ''}`;

    return desc;
  };

  const ACTION_LABELS: Record<string, string> = {
    CREATE: t('actCreate'),
    UPDATE: t('actUpdate'),
    DELETE: t('actDelete'),
    FINALIZE: t('actFinalize'),
    LOGIN: t('actLogin'),
  };

  const ENTITY_LABELS: Record<string, string> = {
    entry: t('catEntry'),
    booking_rule: t('catBookingRule'),
    user: t('catUser'),
    settings: t('catSettings'),
    month: t('catMonth'),
    year: t('catYear'),
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchLogs = useCallback(() => {
    setIsLoading(true);
    auditApi
      .getLogs({ page, limit: PAGE_SIZE })
      .then((res) => {
        const raw = res.data.data as any;
        if (Array.isArray(raw)) {
          setLogs(raw);
          setTotal(raw.length);
        } else if (raw && Array.isArray(raw.logs)) {
          setLogs(raw.logs);
          setTotal(raw.total ?? raw.logs.length);
        } else {
          setLogs([]);
          setTotal(0);
        }
      })
      .catch((err) => {
        console.error('Failed to load audit logs:', err);
        setLogs([]);
        setTotal(0);
      })
      .finally(() => setIsLoading(false));
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl purple-blue-gradient text-white flex items-center justify-center shadow-brand flex-shrink-0">
          <Shield size={24} />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('auditLogTitle')}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base mt-1 font-medium">
            {t('auditLogSubtitle')} ({total} {t('auditEntriesCount')})
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200">
              {[
                t('thTimestamp'),
                t('thAction'),
                t('thCategory'),
                t('thDescription'),
                t('thUser'),
              ].map((h) => (
                <th
                  key={h}
                  className="px-6 py-4 text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-6 py-5">
                    <div className="h-5 bg-slate-200/70 rounded-md animate-pulse" />
                  </td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2.5">
                    <Shield size={36} className="text-slate-300" />
                    <p className="font-semibold text-base text-slate-600">{t('noAuditEntries')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => {
                const actionStyle = ACTION_STYLES[log.action] || ACTION_STYLES.LOGIN;
                const actionLabel = ACTION_LABELS[log.action] || log.action;
                const entityLabel = ENTITY_LABELS[log.entityType] || log.entityType;
                const localizedDescription = translateAuditDescription(log.description, language);
                return (
                  <tr
                    key={log._id}
                    className={`hover:bg-brand-50/40 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="px-6 py-4.5 text-slate-700 text-xs sm:text-sm font-mono font-medium whitespace-nowrap">
                      {formatDateTime(log.performedAt)}
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`inline-block px-3 py-1 rounded-lg text-xs sm:text-sm font-bold ${actionStyle}`}>
                        {actionLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className="inline-block px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {entityLabel}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 text-slate-700 text-xs sm:text-[13px] font-medium leading-relaxed max-w-lg"
                      title={localizedDescription}
                    >
                      {localizedDescription}
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex flex-col">
                        <span className="text-slate-900 text-sm sm:text-base font-bold">
                          {log.performedBy?.name || '—'}
                        </span>
                        <span className="text-slate-500 text-xs sm:text-sm font-normal">
                          {log.performedBy?.email || ''}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-sm font-semibold text-slate-600">
            {t('pageOf', { page, total: totalPages })} — {total} {t('totalActions')}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-brand-600 hover:border-brand-300 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page - 2 + i;
              if (pg < 1 || pg > totalPages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                    pg === page
                      ? 'bg-brand-600 text-white shadow-brand'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-brand-600 hover:border-brand-300 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-xs"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
