import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, Eye, EyeOff, LogIn, ShieldCheck, AlertCircle } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import LanguageToggle from '../components/ui/LanguageToggle';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@cashbook.com');
  const [password, setPassword] = useState('Admin@1234');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await authApi.login(email, password);
      login(res.data.data.user, res.data.data.token);
      toast.success(t('loginTitle') + ' ✓');
      navigate('/');
    } catch (err: any) {
      if (err?.response?.data?.code === 'ACCOUNT_DISABLED') {
        const disabledMsg = t('accountDisabled');
        setError(disabledMsg);
        toast.error(disabledMsg);
      } else {
        const msg =
          err?.response?.data?.message ||
          'Ungültige E-Mail-Adresse oder Passwort / Invalid email or password';
        setError(msg);
        toast.error('Anmeldung fehlgeschlagen / Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 80% 80% at 50% -20%, rgba(124, 58, 237, 0.15), rgba(248, 250, 252, 0.95))',
      }}
    >
      {/* Top right language switcher */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageToggle />
      </div>

      {/* Decorative ambient blur orbs */}
      <div className="absolute top-10 left-1/4 w-72 h-72 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-brand-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl purple-blue-gradient text-white shadow-brand mb-4 animate-in fade-in zoom-in-90 duration-300">
          <Book size={32} className="stroke-[2.5]" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('appName')}</h1>
        <p className="mt-1 text-sm font-semibold text-brand-700">{t('appSubtitle')}</p>
        <p className="text-xs text-slate-500 mt-0.5">{t('appTagline')}</p>
      </div>

      {/* Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-card p-8 sm:p-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">{t('loginTitle')}</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck size={13} />
              {t('loginSslSecured')}
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle size={17} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('loginEmailLabel')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                required
                autoComplete="email"
                placeholder="admin@cashbook.com"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 placeholder-slate-400 shadow-xs transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('loginPasswordLabel')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-xs transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-brand transition-all duration-150"
              >
                <LogIn size={17} />
                {isLoading ? t('loginAuthenticating') : t('btnLogin')}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-1.5 text-center">
            <p className="text-xs text-slate-500 font-medium">
              {t('defaultAccess')} <span className="font-bold text-slate-700">admin@cashbook.com</span>
            </p>
            <p className="text-[11px] text-slate-400">{t('defaultPassword')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
