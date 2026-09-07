import { Cookie, Settings2, Check, ShieldCheck } from 'lucide-react';
import { useCookieStore } from '../../store/cookieStore';
import { useTranslation } from '../../store/languageStore';

export default function CookieConsentBanner() {
  const isBannerOpen = useCookieStore((s) => s.isBannerOpen);
  const acceptAll = useCookieStore((s) => s.acceptAll);
  const acceptEssentialOnly = useCookieStore((s) => s.acceptEssentialOnly);
  const setModalOpen = useCookieStore((s) => s.setModalOpen);
  const { t } = useTranslation();

  if (!isBannerOpen) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[99990] p-4 sm:p-6 pointer-events-none flex justify-center animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl shadow-2xl p-5 sm:p-6 max-w-4xl w-full pointer-events-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-12 h-12 rounded-2xl purple-blue-gradient text-white flex items-center justify-center shadow-brand flex-shrink-0">
            <Cookie size={24} className="stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                {t('cookieBannerTitle')}
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-lg">
                <ShieldCheck size={11} />
                DSGVO / GDPR
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              {t('cookieBannerDesc')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-shrink-0 justify-end">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Settings2 size={15} />
            <span>{t('cookieBtnCustomize')}</span>
          </button>
          <button
            type="button"
            onClick={acceptEssentialOnly}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-colors"
          >
            {t('cookieBtnEssentialOnly')}
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-brand flex items-center gap-1.5"
          >
            <Check size={15} />
            <span>{t('cookieBtnAcceptAll')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
