import React, { useState, useEffect } from 'react';
import {
  Clock,
  Menu,
  Pill,
  ShoppingCart,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle2,
  Cloud,
  ArrowLeft,
  Languages,
} from 'lucide-react';
import { StoreSettings } from '../types';
import { useBillingDraft } from '../context/BillingDraftContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../utils/formatters';

interface TopHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: StoreSettings | null;
  onToggleMobileMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onToggleMobileMenu,
}) => {
  const [time, setTime] = useState(new Date());
  const { cart, grandTotal, hasActiveDraft, customerName } = useBillingDraft();
  const { language, setLanguage, toggleLanguage, t, getTabInfo } = useLanguage();
  const symbol = settings?.currencySymbol || '₹';

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentInfo = getTabInfo(activeTab);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
      {/* Left: Mobile hamburger, Exit / Back & Active Section Title */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 sm:p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden shrink-0"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {activeTab !== 'dashboard' && (
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors shrink-0 shadow-xs"
            title="Exit to Dashboard Home"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>{t('header.exit_section', 'Exit Section')}</span>
          </button>
        )}

        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight truncate">
            {currentInfo.title}
          </h2>
          <p className="text-[11px] text-slate-500 hidden md:block leading-tight truncate">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Language Switcher, Badges, Shortcuts & Clock */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        {/* Language Change Button: English to Marathi */}
        <div
          className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs"
          title={language === 'en' ? 'मराठी भाषेत बदला (Switch to Marathi)' : 'Switch to English (इंग्रजीत बदला)'}
        >
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
              language === 'en'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>EN</span>
          </button>
          <button
            type="button"
            onClick={() => setLanguage('mr')}
            className={`px-2 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
              language === 'mr'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>मराठी</span>
          </button>
        </div>

        {/* Keyboard Shortcuts Indicator */}
        <div className="hidden xl:flex items-center space-x-1.5 text-[10px] text-slate-500 font-medium">
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-slate-700">
            {t('header.f2_new', 'F2 New')}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-slate-700">
            {t('header.f4_search', 'F4 Search')}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-slate-700">
            {t('header.f8_hold', 'F8 Hold')}
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-slate-700">
            {t('header.f9_pay', 'F9 Pay')}
          </span>
        </div>

        {/* Cloud Status Badge */}
        <div
          className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-medium"
          title="Realtime Firebase live sync active on all operations"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Cloud className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('header.live_sync_active', 'Live Sync Active')}</span>
        </div>

        {/* Drug License Badge */}
        {settings?.dlNo1 && (
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {t('header.dl_badge', 'DL')}: <strong className="font-mono">{settings.dlNo1}</strong>
            </span>
          </div>
        )}

        {/* Live Clock */}
        <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-700">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Quick New Bill / Resume Active Bill Button */}
        {activeTab !== 'billing' && (
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-2.5 sm:px-3 py-1.5 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all ${
              hasActiveDraft
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/30 ring-1 ring-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {hasActiveDraft
                ? `${t('header.resume_bill', 'Resume Bill')} (${customerName.trim() || `${cart.length} items`} • ${formatCurrency(grandTotal, symbol)})`
                : t('header.go_to_pos', 'Go to POS')}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};

