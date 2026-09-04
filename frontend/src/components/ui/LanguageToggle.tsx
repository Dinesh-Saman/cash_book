import { useLanguageStore } from '../../store/languageStore';
import { cn } from '../../lib/utils';

interface Props {
  className?: string;
  variant?: 'pill' | 'compact' | 'ghost';
}

export default function LanguageToggle({ className, variant = 'pill' }: Props) {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 bg-slate-100/90 hover:bg-slate-200/90 p-1 rounded-xl border border-slate-200 text-xs font-bold transition-colors cursor-pointer select-none',
          className
        )}
        onClick={() => setLanguage(language === 'de' ? 'en' : 'de')}
        title={language === 'de' ? 'Sprache wechseln zu Englisch' : 'Switch language to German'}
      >
        <span
          className={cn(
            'px-2 py-0.5 rounded-lg transition-all',
            language === 'de' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600'
          )}
        >
          DE
        </span>
        <span
          className={cn(
            'px-2 py-0.5 rounded-lg transition-all',
            language === 'en' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600'
          )}
        >
          EN
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs select-none',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setLanguage('de')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-150',
          language === 'de'
            ? 'bg-white text-brand-700 shadow-xs border border-slate-200/60'
            : 'text-slate-500 hover:text-slate-900'
        )}
      >
        <span>🇩🇪</span>
        <span>DE</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-150',
          language === 'en'
            ? 'bg-white text-brand-700 shadow-xs border border-slate-200/60'
            : 'text-slate-500 hover:text-slate-900'
        )}
      >
        <span>🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );
}
