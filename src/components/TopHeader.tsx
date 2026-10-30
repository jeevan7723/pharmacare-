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
} from 'lucide-react';
import { StoreSettings } from '../types';
import { useBillingDraft } from '../context/BillingDraftContext';
import { formatCurrency } from '../utils/formatters';

interface TopHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: StoreSettings | null;
  onToggleMobileMenu?: () => void;
}

const TAB_TITLES: { [key: string]: { title: string; subtitle: string } } = {
  dashboard: {
    title: 'Pharmacy Operations Dashboard',
    subtitle: 'Daily financial summary, fast actions, and inventory alerts',
  },
  billing: {
    title: 'Point of Sale (POS) Billing',
    subtitle: 'Rapid medicine checkout, batch auto-FEFO, and payment settlement',
  },
  inventory: {
    title: 'Drug Inventory & Shelf Locator',
    subtitle: 'Medicine masters, batch tracking, expiry monitoring, and rack positions',
  },
  purchase: {
    title: 'Stock Inward (Purchase)',
    subtitle: 'Inward entry from pharmaceutical distributors & automatic stock increment',
  },
  alerts: {
    title: 'Expiry & Low Stock Watchtower',
    subtitle: 'Mandatory drug compliance, expired stock returns, and replenishment orders',
  },
  customers: {
    title: 'Customer Khata (Credit Ledger)',
    subtitle: 'Patient ledger accounts, credit debt tracking, and installment collections',
  },
  doctors: {
    title: 'Prescribing Doctors Directory',
    subtitle: 'Doctor registration numbers, clinics, and specializations',
  },
  reports: {
    title: 'Sales & GST Tax Reports',
    subtitle: 'GSTR-1 tax slab breakdown, profit analytics, and sales registers',
  },
  settings: {
    title: 'Store Settings & Backups',
    subtitle: 'Drug License 20B/21B, GSTIN, UPI QR configuration, and full database backups',
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onToggleMobileMenu,
}) => {
  const [time, setTime] = useState(new Date());
  const { cart, grandTotal, hasActiveDraft, customerName } = useBillingDraft();
  const symbol = settings?.currencySymbol || '₹';

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentInfo = TAB_TITLES[activeTab] || {
    title: 'PharmaCare Pro',
    subtitle: 'Pharmacy Management & Billing System',
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs px-4 py-3 flex items-center justify-between">
      {/* Left: Mobile hamburger & Active Section Title */}
      <div className="flex items-center space-x-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
            {currentInfo.title}
          </h2>
          <p className="text-[11px] text-slate-500 hidden sm:block leading-tight">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Badges, Shortcuts & Clock */}
      <div className="flex items-center space-x-3">
        {/* Keyboard Shortcuts Indicator */}
        <div className="hidden xl:flex items-center space-x-1.5 text-[10px] text-slate-500 font-medium">
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-slate-700">
            F2 New
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-slate-700">
            F4 Search
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-slate-700">
            F8 Hold
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-slate-700">
            F9 Pay
          </span>
        </div>

        {/* Cloud Status Badge */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-medium" title="Realtime Firebase live sync active on all operations">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <Cloud className="w-3.5 h-3.5 text-emerald-600" />
          <span>Live Sync Active</span>
        </div>

        {/* Drug License Badge */}
        {settings?.dlNo1 && (
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              DL: <strong className="font-mono">{settings.dlNo1}</strong>
            </span>
          </div>
        )}

        {/* Live Clock */}
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-700">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Quick New Bill / Resume Active Bill Button */}
        {activeTab !== 'billing' && (
          <button
            onClick={() => setActiveTab('billing')}
            className={`px-3 py-1.5 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all ${
              hasActiveDraft
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/30 ring-1 ring-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {hasActiveDraft
                ? `Resume Bill (${customerName.trim() || `${cart.length} items`} • ${formatCurrency(grandTotal, symbol)})`
                : 'Go to POS'}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};

