import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Menu,
  Pill,
  ShoppingCart,
  ShieldCheck,
  ShieldAlert,
  Cloud,
  ArrowLeft,
  Languages,
  Building2,
  ChevronDown,
  ShoppingBag,
  Cpu,
  Sparkles,
  Lock,
  Key,
  Check,
  Palette,
} from 'lucide-react';
import { StoreSettings, Workspace, IndustryType, CompanyTheme } from '../types';
import { useBillingDraft } from '../context/BillingDraftContext';
import { useLanguage } from '../context/LanguageContext';

export const THEMES: { id: CompanyTheme; name: string; bg: string; border: string; desc: string }[] = [
  { id: 'emerald', name: 'Emerald Green', bg: 'bg-emerald-500', border: 'border-emerald-600', desc: 'Pharmacy / Healthcare' },
  { id: 'amber', name: 'Warm Amber', bg: 'bg-amber-500', border: 'border-amber-600', desc: 'Grocery / Supermarket' },
  { id: 'blue', name: 'Electric Blue', bg: 'bg-blue-500', border: 'border-blue-600', desc: 'Tech & Electronics' },
  { id: 'purple', name: 'Royal Purple', bg: 'bg-purple-500', border: 'border-purple-600', desc: 'Fashion Boutique' },
  { id: 'rose', name: 'Rose Ruby', bg: 'bg-rose-500', border: 'border-rose-600', desc: 'Beauty & Retail' },
  { id: 'cyan', name: 'Cyan Teal', bg: 'bg-cyan-500', border: 'border-cyan-600', desc: 'Digital & Hardware' },
];

export const getThemeColorClass = (theme?: CompanyTheme, industry?: IndustryType) => {
  const activeTheme = theme || (
    industry === 'grocery' ? 'amber' :
    industry === 'electronics' ? 'blue' :
    industry === 'clothing' ? 'purple' : 'emerald'
  );
  switch (activeTheme) {
    case 'amber': return 'bg-amber-500';
    case 'blue': return 'bg-blue-500';
    case 'purple': return 'bg-purple-500';
    case 'rose': return 'bg-rose-500';
    case 'cyan': return 'bg-cyan-500';
    case 'emerald':
    default:
      return 'bg-emerald-500';
  }
};

interface TopHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: StoreSettings | null;
  currentWorkspace: Workspace | null;
  allWorkspaces: Workspace[];
  onSwitchWorkspace: (workspace: Workspace) => void;
  onOpenSuperAdmin: () => void;
  onUpdateWorkspaceTheme?: (theme: CompanyTheme) => void;
  onToggleMobileMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  currentWorkspace,
  allWorkspaces,
  onSwitchWorkspace,
  onOpenSuperAdmin,
  onUpdateWorkspaceTheme,
  onToggleMobileMenu,
}) => {
  const [time, setTime] = useState(new Date());
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  const { hasActiveDraft } = useBillingDraft();
  const { language, setLanguage, t, getTabInfo } = useLanguage();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(target)
      ) {
        setIsWorkspaceMenuOpen(false);
      }
      if (
        themeDropdownRef.current &&
        !themeDropdownRef.current.contains(target)
      ) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentInfo = getTabInfo(activeTab);

  const getIndustryIcon = (industry?: IndustryType) => {
    switch (industry) {
      case 'grocery':
        return <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />;
      case 'electronics':
        return <Cpu className="w-3.5 h-3.5 text-blue-500" />;
      case 'clothing':
        return <Sparkles className="w-3.5 h-3.5 text-purple-500" />;
      case 'pharmacy':
      default:
        return <Pill className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  const isSuspended = currentWorkspace?.license.status === 'suspended' || currentWorkspace?.license.status === 'expired';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3 min-w-0">
      {/* Left: Mobile hamburger, Exit / Back & Active Section Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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
            <span className="hidden xs:inline">{t('header.exit_section', 'Exit Section')}</span>
          </button>
        )}

        <div className="min-w-0">
          <h2
            className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight truncate"
            title={currentInfo.title}
          >
            {currentInfo.title}
          </h2>
          <p
            className="text-[11px] text-slate-500 hidden md:block leading-tight truncate max-w-sm"
            title={currentInfo.subtitle}
          >
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Workspace Switcher, Theme Selector, Master Portal, Language, Badges & Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Workspace Switcher Pill Dropdown */}
        <div className="relative" ref={workspaceDropdownRef}>
          <button
            type="button"
            onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isSuspended
                ? 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300'
            }`}
            title="Switch Client Company Workspace"
          >
            <div className="flex items-center gap-1 min-w-0">
              {getIndustryIcon(currentWorkspace?.industry)}
              <span className="max-w-[90px] sm:max-w-[130px] md:max-w-[150px] truncate font-bold text-slate-900">
                {currentWorkspace?.name || 'Select Workspace'}
              </span>
            </div>
            {isSuspended ? (
              <span className="px-1.5 py-0.2 text-[9px] bg-red-600 text-white rounded font-black uppercase flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" />
                <span>Suspended</span>
              </span>
            ) : (
              <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] bg-emerald-100 text-emerald-800 rounded font-semibold uppercase">
                {currentWorkspace?.industry || 'Pharma'}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Workspace Dropdown Menu */}
          {isWorkspaceMenuOpen && (
            <div className="absolute right-0 sm:left-0 mt-1.5 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-1.5 animate-in fade-in duration-150">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Switch Client Workspace
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {allWorkspaces.length} Companies Configured
                  </div>
                </div>
                <Building2 className="w-4 h-4 text-slate-400" />
              </div>

              <div className="max-h-60 overflow-y-auto py-1 space-y-0.5">
                {allWorkspaces.map((ws) => {
                  const isSelected = ws.id === currentWorkspace?.id;
                  const isWsSuspended = ws.license.status === 'suspended' || ws.license.status === 'expired';
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        onSwitchWorkspace(ws);
                        setIsWorkspaceMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${getThemeColorClass(ws.theme, ws.industry)} ring-1 ring-black/10`} />
                        {getIndustryIcon(ws.industry)}
                        <div className="truncate">
                          <div className="truncate text-slate-900 font-semibold">{ws.name}</div>
                          <div className="text-[10px] text-slate-400 capitalize">
                            {ws.industry} &bull; {ws.theme || (ws.industry === 'grocery' ? 'amber' : ws.industry === 'electronics' ? 'blue' : ws.industry === 'clothing' ? 'purple' : 'emerald')} theme
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isWsSuspended && (
                          <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                            Locked
                          </span>
                        )}
                        {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Master Super Admin shortcut inside switcher */}
              <div className="pt-1.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsWorkspaceMenuOpen(false);
                    onOpenSuperAdmin();
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:from-amber-500/20 hover:to-amber-600/20 text-amber-950 border border-amber-300/60 text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    <span>Super Admin Master Portal</span>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded uppercase">
                    Platform Owner
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Company Color Theme Switcher */}
        <div className="relative" ref={themeDropdownRef}>
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            title="Company Color Theme (Click to switch store brand theme)"
          >
            <Palette className="w-3.5 h-3.5 text-slate-600" />
            <span className={`w-2.5 h-2.5 rounded-full ${getThemeColorClass(currentWorkspace?.theme, currentWorkspace?.industry)} ring-1 ring-black/10`} />
            <span className="hidden lg:inline capitalize text-[11px] font-bold text-slate-700">
              {currentWorkspace?.theme || (currentWorkspace?.industry === 'grocery' ? 'amber' : currentWorkspace?.industry === 'electronics' ? 'blue' : currentWorkspace?.industry === 'clothing' ? 'purple' : 'emerald')}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isThemeMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-1.5 animate-in fade-in duration-150">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex justify-between items-center">
                <span>Company Brand Theme</span>
                <span className="text-[9px] font-mono text-emerald-600 font-bold">Theme</span>
              </div>
              <div className="py-1 space-y-0.5">
                {THEMES.map((th) => {
                  const activeTheme = currentWorkspace?.theme || (
                    currentWorkspace?.industry === 'grocery' ? 'amber' :
                    currentWorkspace?.industry === 'electronics' ? 'blue' :
                    currentWorkspace?.industry === 'clothing' ? 'purple' : 'emerald'
                  );
                  const isCurrent = activeTheme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        onUpdateWorkspaceTheme?.(th.id);
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-100 text-slate-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${th.bg} shadow-xs ring-1 ring-black/10`} />
                        <div>
                          <div className="font-semibold text-slate-800">{th.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{th.desc}</div>
                        </div>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-slate-900" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Super Admin Master Portal Shortcut Button */}
        <button
          type="button"
          onClick={onOpenSuperAdmin}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-xs cursor-pointer ${
            activeTab === 'superadmin'
              ? 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-400'
              : 'bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-amber-500/15 text-amber-900 hover:bg-amber-500 hover:text-slate-950 border-amber-300'
          }`}
          title="Super Admin Master Portal: Provision new company workspaces, lock licenses remotely, configure features"
        >
          <Key className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="hidden md:inline">Super Admin</span>
          <span className="md:hidden">Admin</span>
        </button>

        {/* Language Change Button: English to Marathi */}
        <div
          className="flex items-center gap-1 bg-slate-900 text-white p-0.5 pl-1.5 rounded-xl border border-emerald-500/60 shadow-xs shrink-0"
          title="Change Language / भाषा बदला (English ⇄ मराठी)"
        >
          <Languages className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-700/60">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-1.5 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('mr')}
              className={`px-1.5 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                language === 'mr'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              मराठी
            </button>
          </div>
        </div>

        {/* Cloud Status Badge */}
        <div
          className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-medium shrink-0"
          title="Realtime Firebase live sync active on all operations"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Cloud className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('header.live_sync_active', 'Live Sync Active')}</span>
        </div>

        {/* Drug License Badge (visible on ultra-wide screens for pharmacy) */}
        {settings?.dlNo1 && currentWorkspace?.industry === 'pharmacy' && (
          <div className="hidden 2xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-medium shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {t('header.dl_badge', 'DL')}: <strong className="font-mono">{settings.dlNo1}</strong>
            </span>
          </div>
        )}

        {/* Live Clock */}
        <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-700 shrink-0">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Quick New Bill / Resume Active Bill Button */}
        {activeTab !== 'billing' && activeTab !== 'superadmin' && (
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-3 py-1.5 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              isSuspended
                ? 'bg-slate-400 cursor-not-allowed'
                : hasActiveDraft
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/30 ring-1 ring-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
            }`}
            disabled={isSuspended}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isSuspended
                ? 'Billing Locked'
                : hasActiveDraft
                ? `${t('header.resume_bill', 'Resume Bill')}`
                : t('header.go_to_pos', 'Go to POS')}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
