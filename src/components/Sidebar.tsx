import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  AlertTriangle,
  Users,
  UserCheck,
  BarChart3,
  Settings,
  Pill,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Database,
  ExternalLink,
} from 'lucide-react';
import { StoreSettings } from '../types';
import { useBillingDraft } from '../context/BillingDraftContext';
import { useLanguage } from '../context/LanguageContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: StoreSettings | null;
  expiredCount: number;
  criticalExpiryCount: number;
  lowStockCount: number;
  heldBillsCount: number;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  expiredCount,
  criticalExpiryCount,
  lowStockCount,
  heldBillsCount,
  isCollapsed,
  setIsCollapsed,
}) => {
  const totalAlerts = expiredCount + criticalExpiryCount + lowStockCount;
  const { cart, hasActiveDraft } = useBillingDraft();
  const { t } = useLanguage();

  const navGroups = [
    {
      title: t('sidebar.group_pos', 'Point of Sale'),
      items: [
        {
          id: 'dashboard',
          label: t('sidebar.nav_dashboard', 'Dashboard Home'),
          icon: LayoutDashboard,
          shortcut: '',
        },
        {
          id: 'billing',
          label: t('sidebar.nav_billing', 'Billing POS'),
          icon: ShoppingCart,
          shortcut: 'F2',
          badge: hasActiveDraft
            ? `${cart.length} ${t('sidebar.in_cart', 'in cart')}`
            : heldBillsCount > 0
            ? `${heldBillsCount} ${t('sidebar.held', 'Held')}`
            : null,
          badgeColor: hasActiveDraft
            ? 'bg-emerald-500 text-white font-black animate-pulse'
            : 'bg-amber-500 text-white',
        },
      ],
    },
    {
      title: t('sidebar.group_inventory', 'Inventory & Stock'),
      items: [
        {
          id: 'inventory',
          label: t('sidebar.nav_inventory', 'Medicines & Racks'),
          icon: Package,
          shortcut: 'F3',
        },
        {
          id: 'purchase',
          label: t('sidebar.nav_purchase', 'Stock Inward (Purchase)'),
          icon: Truck,
        },
        {
          id: 'alerts',
          label: t('sidebar.nav_alerts', 'Expiry & Low Stock'),
          icon: AlertTriangle,
          badge: totalAlerts > 0 ? `${totalAlerts}` : null,
          badgeColor: expiredCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white',
        },
      ],
    },
    {
      title: t('sidebar.group_accounts', 'Accounts & People'),
      items: [
        {
          id: 'customers',
          label: t('sidebar.nav_customers', 'Customer Khata (Credit)'),
          icon: Users,
        },
        {
          id: 'doctors',
          label: t('sidebar.nav_doctors', 'Doctors Directory'),
          icon: UserCheck,
        },
      ],
    },
    {
      title: t('sidebar.group_management', 'Management'),
      items: [
        {
          id: 'reports',
          label: t('sidebar.nav_reports', 'Sales & GST Reports'),
          icon: BarChart3,
        },
        {
          id: 'settings',
          label: t('sidebar.nav_settings', 'Store Settings'),
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <aside
      className={`bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-300 select-none z-30 shrink-0 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div
        className={`border-b border-slate-800/80 flex transition-all ${
          isCollapsed
            ? 'flex-col items-center justify-center py-3 px-2 gap-2 relative group/header'
            : 'items-center justify-between p-4'
        }`}
      >
        <div
          className={`flex items-center cursor-pointer ${
            isCollapsed ? 'justify-center relative group' : 'space-x-3 overflow-hidden min-w-0'
          }`}
          onClick={() => setActiveTab('dashboard')}
          title={settings?.storeName || 'HealthPlus Pharmacy'}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black shrink-0 hover:scale-105 transition-transform">
            <Pill className="w-5 h-5 transform -rotate-45" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white tracking-tight truncate leading-tight">
                {settings?.storeName?.replace('& SURGICALS', '').trim() || 'HEALTHPLUS PHARMACY'}
              </h1>
              <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider truncate">
                {t('sidebar.tagline', 'Medical Store POS')}
              </p>
            </div>
          )}

          {/* Popover tooltip when collapsed */}
          {isCollapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 whitespace-nowrap font-bold border border-slate-700">
              {settings?.storeName?.replace('& SURGICALS', '').trim() || 'HEALTHPLUS PHARMACY'}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center ${
            isCollapsed ? 'w-8 h-6 hover:bg-slate-800/80 text-slate-400' : 'p-1.5'
          }`}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick Action: New Bill Button */}
      <div className="p-3">
        <button
          onClick={() => setActiveTab('billing')}
          className={`w-full py-2.5 px-3 ${
            hasActiveDraft && activeTab !== 'billing'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 ring-2 ring-emerald-400/50'
              : 'bg-emerald-600 hover:bg-emerald-500'
          } active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center transition-all ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
          title={hasActiveDraft ? 'Resume Active Bill (F2)' : 'New Bill (F2)'}
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 shrink-0" />
            {!isCollapsed && (
              <span>
                {hasActiveDraft
                  ? `${t('sidebar.resume_bill', 'Resume Bill')} (${cart.length})`
                  : t('sidebar.quick_new_bill', 'Quick New Bill')}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-700/60 text-emerald-100 border border-emerald-500/30">
              F2
            </kbd>
          )}
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4 text-xs">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center rounded-xl px-3 py-2.5 transition-all text-xs font-semibold relative group ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
                  title={item.label}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && (
                    <div className="flex items-center space-x-1.5">
                      {item.shortcut && (
                        <span
                          className={`text-[9px] font-mono px-1 rounded ${
                            isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.shortcut}
                        </span>
                      )}
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Popover tooltip when collapsed */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 whitespace-nowrap">
                      {item.label}
                      {item.badge && ` (${item.badge})`}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};

