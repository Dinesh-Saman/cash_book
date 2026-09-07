import { Cookie, Check } from 'lucide-react';
import { useCookieStore } from '../../store/cookieStore';
import { useTranslation } from '../../store/languageStore';

export default function CookieConsentBanner() {
  const isBannerOpen = useCookieStore((s) => s.isBannerOpen);
  const acceptAll = useCookieStore((s) => s.acceptAll);
  const { t } = useTranslation();

  if (!isBannerOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[99990] max-w-sm sm:max-w-md w-[calc(100vw-3rem)] pointer-events-none animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-2xl p-5 sm:p-6 pointer-events-auto flex flex-col gap-4">
        {/* Header with Icon and Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl purple-blue-gradient text-white flex items-center justify-center shadow-brand flex-shrink-0">
            <Cookie size={20} className="stroke-[2.5]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-1">
              {t('cookieBannerTitle')}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              {t('cookieBannerDesc')}
            </p>
          </div>
        </div>

        {/* Action Button - aligned to the left side */}
        <div className="flex items-center justify-start pt-3 border-t border-slate-100 pl-0 sm:pl-[50px]">
          <button
            type="button"
            onClick={acceptAll}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-xs font-bold transition-all shadow-brand cursor-pointer"
          >
            <Check size={14} className="stroke-[2.5]" />
            <span>{t('cookieBtnAcceptAll')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
