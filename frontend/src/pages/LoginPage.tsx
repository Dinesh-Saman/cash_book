import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../store/languageStore';
import LanguageToggle from '../components/ui/LanguageToggle';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState(() => {
    return localStorage.getItem('cashbook_remember_user') || 'admin@cashbook.com';
  });
  const [password, setPassword] = useState('Admin@1234');
  const [rememberMe, setRememberMe] = useState(true);
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
      if (rememberMe) {
        localStorage.setItem('cashbook_remember_user', identifier);
      } else {
        localStorage.removeItem('cashbook_remember_user');
      }

      const res = await authApi.login(identifier, password);
      login(res.data.data.user, res.data.data.token);
      toast.success(language === 'de' ? 'Erfolgreich angemeldet ✓' : 'Signed in successfully ✓');
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
            ? 'Ungültiger Benutzername/E-Mail oder Passwort'
            : 'Invalid username/email or password');
        setError(msg);
        toast.error(language === 'de' ? 'Anmeldung fehlgeschlagen' : 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 h-screen w-screen flex items-center justify-center p-3 sm:p-5 select-none overflow-hidden font-sans">
      {/* High-Quality Geometric Framing Background Image: Desktop & Mobile Portrait */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none hidden sm:block"
        style={{ backgroundImage: `url('/login-bg.png')` }}
      />
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none block sm:hidden"
        style={{ backgroundImage: `url('/login-bg-mobile.png')` }}
      />

      {/* Top right language switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-30">
        <div className="bg-white/90 backdrop-blur-sm border border-slate-200/90 rounded-xl p-0.5 shadow-sm text-slate-800">
          <LanguageToggle />
        </div>
      </div>

      {/* Main Two-Column Card Container - Increased height for optimal visual balance */}
      <div className="w-full max-w-[850px] h-[455px] sm:h-[460px] max-h-[92vh] bg-white rounded-[24px] shadow-[0_20px_60px_-15px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.06)] overflow-hidden grid grid-cols-1 md:grid-cols-2 relative border border-slate-200/80 z-10">
        {/* Left Side: Visual Hero Image & Product Branding */}
        <div className="hidden md:block relative w-full h-full bg-[#081e3a] overflow-hidden select-none">
          <img
            src="/login-left-panel.png"
            alt="CashBook - Cash Book Management System"
            className="w-full h-full object-cover object-top select-none pointer-events-none"
          />
        </div>

        {/* Right Side: Sign In Form with tailored, reduced content width */}
        <div className="p-6 sm:px-10 sm:py-8 flex flex-col justify-center items-center h-full bg-white relative">
          <div className="w-full max-w-[325px]">
            {/* Mobile-only Top Brand Header */}
            <div className="md:hidden flex items-center gap-2 mb-2">
              <span className="text-xl font-bold text-slate-800 tracking-tight">
                Cash<span className="text-[#22c55e]">Book</span>
              </span>
            </div>

            <div>
              {/* Welcome Back Header */}
              <div className="mb-4">
                <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight leading-tight">
                  {language === 'de' ? 'Willkommen zurück' : 'Welcome Back'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal leading-relaxed">
                  {language === 'de'
                    ? 'Melden Sie sich bei Ihrem CashBook-Konto an, um Ihre Finanzen weiter zu verwalten.'
                    : 'Sign in to your CashBook account to continue managing your finances.'}
                </p>
              </div>

              {/* Error Notification */}
              {error && (
                <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
                  <AlertCircle size={15} className="text-rose-600 flex-shrink-0" />
                  <div className="flex-1 leading-snug">{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Username / Email Input */}
                <div>
                  <div className="relative flex items-center group">
                    <div className="absolute left-3.5 text-slate-400 group-focus-within:text-[#1451a2] transition-colors pointer-events-none">
                      <User size={17} strokeWidth={1.75} />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (error) setError('');
                      }}
                      required
                      placeholder={language === 'de' ? 'Benutzername / E-Mail' : 'Username / Email'}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-[#1451a2] rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 shadow-xs transition-all font-normal"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="relative flex items-center group">
                    <div className="absolute left-3.5 text-slate-400 group-focus-within:text-[#1451a2] transition-colors pointer-events-none">
                      <Lock size={17} strokeWidth={1.75} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError('');
                      }}
                      required
                      placeholder={language === 'de' ? 'Passwort' : 'Password'}
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 hover:border-slate-300 focus:border-[#1451a2] rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 shadow-xs transition-all font-normal"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <Eye size={17} strokeWidth={1.75} /> : <EyeOff size={17} strokeWidth={1.75} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#1451a2] focus:ring-[#1451a2] accent-[#1451a2] cursor-pointer"
                    />
                    <span className="text-xs sm:text-sm text-slate-600 font-medium">
                      {language === 'de' ? 'Angemeldet bleiben' : 'Remember me'}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      toast(
                        language === 'de'
                          ? 'Bitte kontaktieren Sie Ihren Administrator zum Zurücksetzen.'
                          : 'Please contact your system administrator to reset your password.',
                        { icon: 'ℹ️' }
                      )
                    }
                    className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {language === 'de' ? 'Passwort vergessen?' : 'Forgot password?'}
                  </button>
                </div>

                {/* Sign In Button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 sm:py-3 px-6 bg-[#1451a2] hover:bg-[#0f4285] active:bg-[#0c366e] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all duration-150 disabled:opacity-60 cursor-pointer"
                  >
                    <span>
                      {isLoading
                        ? language === 'de'
                          ? 'Anmeldung...'
                          : 'Signing In...'
                        : language === 'de'
                        ? 'Anmelden'
                        : 'Sign In'}
                    </span>
                    <ArrowRight size={17} strokeWidth={2} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
