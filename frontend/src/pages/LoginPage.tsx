import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, Mail, Lock, Sparkles } from 'lucide-react';
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
  const { t, language } = useTranslation();
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
          (language === 'de'
            ? 'Ungültige E-Mail-Adresse oder Passwort'
            : 'Invalid email or password');
        setError(msg);
        toast.error(language === 'de' ? 'Anmeldung fehlgeschlagen' : 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-900 flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden select-none">
      {/* Elegant Multi-layered Mesh Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0f172a] to-[#1e1b4b] pointer-events-none" />
      
      {/* Ambient glowing radial orbs */}
      <div className="absolute -top-32 -left-32 w-[550px] h-[550px] bg-indigo-600/25 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute top-1/2 -right-32 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[130px] pointer-events-none animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute -bottom-32 left-1/3 w-[450px] h-[450px] bg-blue-600/15 rounded-full blur-[110px] pointer-events-none" />

      {/* Subtle background grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top right language switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30">
        <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-0.5 shadow-lg">
          <LanguageToggle />
        </div>
      </div>

      {/* Main Two-Column Card Container */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5),0_0_40px_rgba(99,102,241,0.15)] border border-slate-700/30 overflow-hidden relative z-10 grid grid-cols-1 md:grid-cols-2 max-h-[92vh]">
        {/* Left Side: Visual Hero Image & Product Info */}
        <div className="relative bg-gradient-to-br from-slate-950 via-[#111827] to-[#1e1b4b] text-white p-6 sm:p-8 flex flex-col justify-between overflow-hidden border-b md:border-b-0 md:border-r border-slate-800">
          {/* Subtle inner background light */}
          <div className="absolute -top-20 -left-20 w-60 h-60 bg-indigo-500/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Info */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-[11px] font-semibold tracking-wide mb-2.5">
              <Sparkles size={12} className="text-indigo-400" />
              <span>Finanzbuchhaltung</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {t('appName')}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-indigo-300 mt-0.5">
              {t('appSubtitle')}
            </p>
          </div>

          {/* Image Showcase - aligns with the text above */}
          <div className="w-full flex-1 flex items-center pt-3 pb-1 relative z-10">
            <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/10 group">
              <img
                src="/login-illustration.jpg"
                alt="Cash Book Finance Management"
                className="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Right Side: Sign In Form */}
        <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-white overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('loginTitle')}</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Willkommen zurück • Welcome back</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('loginEmailLabel')}
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-600 transition-colors pointer-events-none">
                  <Mail size={16} />
                </div>
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-brand-500/10 placeholder-slate-400 shadow-xs transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('loginPasswordLabel')}
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-600 transition-colors pointer-events-none">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-600 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-brand-500/10 shadow-xs transition-all font-medium tracking-wide"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1 transition-all"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-700 hover:via-indigo-700 hover:to-purple-700 active:scale-[0.99] disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all duration-150 cursor-pointer"
              >
                <LogIn size={17} />
                {isLoading ? t('loginAuthenticating') : t('btnLogin')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
