import { NavLink, useLocation } from 'react-router-dom';
import {
  Book,
  Home,
  Calendar,
  BarChart2,
  Settings,
  Users,
  Shield,
  LogOut,
  X,
  PlusCircle,
  MinusCircle,
  Wallet,
  CheckCircle2,
  Cookie,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useCashbookStore } from '../../store/cashbookStore';
import { useCookieStore } from '../../store/cookieStore';
import { useTranslation } from '../../store/languageStore';
import LanguageToggle from '../ui/LanguageToggle';
import { cn } from '../../lib/utils';
import { useEffect } from 'react';
import { getDefaultPermissions } from '../../types';

export default function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const openIncomeForm = useUIStore((state) => state.openIncomeForm);
  const openExpenseForm = useUIStore((state) => state.openExpenseForm);
  const openCookieModal = useCookieStore((state) => state.setModalOpen);
  const summary = useCashbookStore((state) => state.summary);
  const { t, language, formatCurrency } = useTranslation();
  const location = useLocation();

  const userPerms = user?.permissions
    ? { ...getDefaultPermissions(user.role), ...user.permissions }
    : user
    ? getDefaultPermissions(user.role)
    : null;

  const canAddIncome = userPerms?.canAddIncome ?? (user?.role === 'admin' || user?.role === 'accountant');
  const canAddExpense = userPerms?.canAddExpense ?? (user?.role === 'admin' || user?.role === 'accountant');
  const hasQuickActions = canAddIncome || canAddExpense;

  // Auto-close sidebar on mobile route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const navItems = [
    { to: '/', icon: Home, label: t('navCashBook') },
    { to: '/monthly', icon: Calendar, label: t('navMonthlyReports') },
    { to: '/annual', icon: BarChart2, label: t('navAnnualReport') },
    { to: '/settings', icon: Settings, label: t('navSettings') },
  ];

  const adminItems = [
    { to: '/admin/users', icon: Users, label: t('navUserManagement') },
    { to: '/admin/audit', icon: Shield, label: t('navAuditLog') },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 shadow-xl lg:shadow-none flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="pt-5 pb-3.5 sm:pt-0 sm:pb-0 sm:h-16 px-6 flex items-center justify-between border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl purple-blue-gradient flex items-center justify-center text-white shadow-brand">
              <Book size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">{t('appName')}</h1>
              <p className="text-[11px] font-medium text-brand-600">{t('appSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg lg:hidden transition-colors"
            aria-label="Menü schließen"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items & Widgets */}
        <nav className="flex-1 py-4 px-4 space-y-4 overflow-y-auto no-scrollbar">
          {/* Main Menu */}
          <div>
            <p className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {t('navMainMenu')}
            </p>
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs border-l-4 border-brand-600'
                          : 'text-slate-600 hover:text-brand-600 hover:bg-slate-50'
                      )
                    }
                  >
                    <item.icon size={19} className="flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Transaction Actions (Mobile & Compact) */}
          {hasQuickActions && (
            <div>
              <p className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {language === 'de' ? 'Schnellbuchung' : 'Quick Actions'}
              </p>
              <div className={`grid ${canAddIncome && canAddExpense ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                {canAddIncome && (
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      openIncomeForm();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                  >
                    <PlusCircle size={14} />
                    <span>{t('btnAddIncome')}</span>
                  </button>
                )}
                {canAddExpense && (
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      openExpenseForm();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                  >
                    <MinusCircle size={14} />
                    <span>{t('btnAddExpense')}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Admin Menu */}
          {user?.role === 'admin' && (
            <div>
              <p className="px-3 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {t('navAdministration')}
              </p>
              <ul className="space-y-1">
                {adminItems.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                          isActive
                            ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs border-l-4 border-brand-600'
                            : 'text-slate-600 hover:text-brand-600 hover:bg-slate-50'
                        )
                      }
                    >
                      <item.icon size={19} className="flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Live Cash Balance Card */}
          {summary && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-50/70 via-slate-50 to-purple-50/50 border border-brand-200/70 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand-800 uppercase tracking-wider">
                  <Wallet size={13} className="text-brand-600" />
                  <span>{t('summaryCurrentBalance')}</span>
                </div>
                <span className="flex h-2 w-2 relative" title="Live">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-lg font-extrabold text-brand-900 tracking-tight">
                {formatCurrency(summary.currentBalance)}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-200/70 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('summaryIncome')}</span>
                  <span className="font-bold text-emerald-600 truncate block">
                    +{formatCurrency(summary.totalIncome)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('summaryExpense')}</span>
                  <span className="font-bold text-rose-600 truncate block">
                    -{formatCurrency(summary.totalExpense)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Compliance & Standard Badge */}
          <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 font-semibold text-slate-600">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>GoBD & DATEV</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">SRS v1.5</span>
          </div>
        </nav>

        {/* Language Switcher & User Card & Logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-3">
          {/* Language Toggle in Sidebar */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-slate-500">{t('lblLanguage')}</span>
            <LanguageToggle />
          </div>

          {/* Cookie Preferences Link */}
          <div className="flex items-center justify-between px-1 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                openCookieModal(true);
              }}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-brand-600 transition-colors"
            >
              <Cookie size={13} className="text-brand-600" />
              <span>{t('cookieModalTitle')}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <div className="w-9 h-9 rounded-lg purple-blue-gradient text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() || (user?.role === 'admin' ? 'A' : 'U')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {user?.name
                  ? user.name === 'Admin'
                    ? (language === 'de' ? 'Administrator' : 'Admin')
                    : user.name
                  : (user?.role === 'admin' ? t('roleAdmin') : user?.role === 'accountant' ? t('roleAccountant') : t('roleViewer'))}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {user?.role === 'admin'
                  ? t('roleAdmin')
                  : user?.role === 'accountant'
                  ? t('roleAccountant')
                  : t('roleViewer')}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-100 transition-colors"
          >
            <LogOut size={15} />
            {t('navLogout')}
          </button>
        </div>
      </aside>
    </>
  );
}
