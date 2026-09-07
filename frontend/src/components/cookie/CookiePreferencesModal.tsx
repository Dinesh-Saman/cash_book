import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Cookie, Shield, Check, X, Sliders, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useCookieStore } from '../../store/cookieStore';
import { useTranslation } from '../../store/languageStore';
import toast from 'react-hot-toast';

export default function CookiePreferencesModal() {
  const isModalOpen = useCookieStore((s) => s.isModalOpen);
  const setModalOpen = useCookieStore((s) => s.setModalOpen);
  const preferences = useCookieStore((s) => s.preferences);
  const savePreferences = useCookieStore((s) => s.savePreferences);
  const acceptAll = useCookieStore((s) => s.acceptAll);
  const { t, language } = useTranslation();

  const [functional, setFunctional] = useState(preferences.functional);
  const [analytics, setAnalytics] = useState(preferences.analytics);
  const [expandedSection, setExpandedSection] = useState<'necessary' | 'functional' | 'analytics' | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      setFunctional(preferences.functional);
      setAnalytics(preferences.analytics);
    }
  }, [isModalOpen, preferences]);

  if (!isModalOpen) return null;

  const handleSave = () => {
    savePreferences({ functional, analytics });
    toast.success(t('cookieSavedToast'));
  };

  const handleAcceptAll = () => {
    acceptAll();
    toast.success(t('cookieSavedToast'));
  };

  const toggleSection = (sec: 'necessary' | 'functional' | 'analytics') => {
    setExpandedSection((prev) => (prev === sec ? null : sec));
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl purple-blue-gradient text-white flex items-center justify-center shadow-brand flex-shrink-0">
              <Cookie size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {t('cookieModalTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
                {t('cookieModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"
            aria-label="Schließen"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body - Cookie Categories */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 no-scrollbar">
          {/* Category 1: Strictly Necessary */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Shield size={16} />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    {t('cookieSecNecessaryTitle')}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed font-normal">
                  {t('cookieSecNecessaryDesc')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl">
                  <Lock size={12} />
                  {t('cookieAlwaysActive')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleSection('necessary')}
              className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
            >
              <span>{language === 'de' ? 'Details & Gespeicherte Cookies anzeigen' : 'View Details & Stored Cookies'}</span>
              {expandedSection === 'necessary' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {expandedSection === 'necessary' && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl">
                  <div><span className="font-bold text-slate-800">auth_token</span> (JWT)</div>
                  <div>{language === 'de' ? 'Sitzungsauthentifizierung' : 'Session Authentication'}</div>
                  <div className="text-slate-500">7 {language === 'de' ? 'Tage' : 'Days'}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl">
                  <div><span className="font-bold text-slate-800">app_lang</span></div>
                  <div>{language === 'de' ? 'Sprachauswahl (DE/EN)' : 'Language Selection (DE/EN)'}</div>
                  <div className="text-slate-500">{language === 'de' ? 'Dauerhaft' : 'Persistent'}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl">
                  <div><span className="font-bold text-slate-800">cashbook_cookie_consent</span></div>
                  <div>{language === 'de' ? 'Einwilligungsstatus' : 'Consent State'}</div>
                  <div className="text-slate-500">12 {language === 'de' ? 'Monate' : 'Months'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Category 2: Functional */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Sliders size={16} />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    {t('cookieSecFunctionalTitle')}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed font-normal">
                  {t('cookieSecFunctionalDesc')}
                </p>
              </div>
              <div className="flex items-center flex-shrink-0 pt-0.5">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={functional}
                    onChange={(e) => setFunctional(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleSection('functional')}
              className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
            >
              <span>{language === 'de' ? 'Details anzeigen' : 'View Details'}</span>
              {expandedSection === 'functional' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {expandedSection === 'functional' && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl">
                  <div><span className="font-bold text-slate-800">ui_filters_state</span></div>
                  <div>{language === 'de' ? 'Zuletzt gewählte Berichtsfilter' : 'Last Selected Report Filters'}</div>
                  <div className="text-slate-500">6 {language === 'de' ? 'Monate' : 'Months'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Category 3: Analytics */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                    <Cookie size={16} />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    {t('cookieSecAnalyticsTitle')}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed font-normal">
                  {t('cookieSecAnalyticsDesc')}
                </p>
              </div>
              <div className="flex items-center flex-shrink-0 pt-0.5">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600" />
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => toggleSection('analytics')}
              className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
            >
              <span>{language === 'de' ? 'Details anzeigen' : 'View Details'}</span>
              {expandedSection === 'analytics' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {expandedSection === 'analytics' && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl">
                  <div><span className="font-bold text-slate-800">perf_metrics</span></div>
                  <div>{language === 'de' ? 'Anonyme Ladezeitmessung' : 'Anonymous Latency Metrics'}</div>
                  <div className="text-slate-500">30 {language === 'de' ? 'Tage' : 'Days'}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors text-center"
          >
            {language === 'de' ? 'Schließen' : 'Close'}
          </button>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSave}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs"
            >
              {t('cookieBtnSavePreferences')}
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="w-full sm:w-auto px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-brand flex items-center justify-center gap-1.5"
            >
              <Check size={16} />
              {t('cookieBtnAcceptAll')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
