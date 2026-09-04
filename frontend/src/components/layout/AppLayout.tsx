import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import SummaryBar from './SummaryBar';
import { Menu, Book } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useTranslation } from '../../store/languageStore';
import LanguageToggle from '../ui/LanguageToggle';

export default function AppLayout() {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const { t } = useTranslation();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Mobile Top Header */}
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Menü öffnen"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg purple-blue-gradient flex items-center justify-center text-white shadow-xs">
                <Book size={15} />
              </div>
              <span className="font-bold text-sm text-slate-800">{t('appName')}</span>
            </div>
          </div>
          <LanguageToggle variant="compact" />
        </header>

        {/* Live Summary Bar */}
        <SummaryBar />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
