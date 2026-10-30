import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  Truck,
  AlertTriangle,
  Users,
  UserCheck,
  BarChart3,
  Settings,
  Pill,
  Clock,
  Sparkles,
} from 'lucide-react';
import { StoreSettings } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  settings: StoreSettings | null;
  expiredCount: number;
  criticalExpiryCount: number;
  lowStockCount: number;
  heldBillsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  expiredCount,
  criticalExpiryCount,
  lowStockCount,
  heldBillsCount,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalAlerts = expiredCount + criticalExpiryCount + lowStockCount;

  const navItems = [
    {
      id: 'billing',
      label: 'Billing POS',
      icon: ShoppingCart,
      shortcut: 'F2',
      badge: heldBillsCount > 0 ? `${heldBillsCount} Held` : null,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'inventory',
      label: 'Inventory & Rack',
      icon: Package,
      shortcut: 'F3',
    },
    {
      id: 'purchase',
      label: 'Stock Inward (Purchase)',
      icon: Truck,
    },
    {
      id: 'alerts',
      label: 'Expiry & Alerts',
      icon: AlertTriangle,
      badge: totalAlerts > 0 ? `${totalAlerts}` : null,
      badgeColor: expiredCount > 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white',
    },
    {
      id: 'customers',
      label: 'Customer Khata',
      icon: Users,
    },
    {
      id: 'doctors',
      label: 'Doctors',
      icon: UserCheck,
    },
    {
      id: 'reports',
      label: 'Sales & GST Reports',
      icon: BarChart3,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40 border-b border-slate-800">
      {/* Top micro bar with Drug License info, Store details, and Live Clock */}
      <div className="bg-slate-950 px-4 py-1.5 text-xs text-slate-400 flex flex-wrap justify-between items-center border-b border-slate-800/60">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>STORE ONLINE</span>
          </span>
          {settings?.dlNo1 && (
            <span className="hidden sm:inline">
              DL No: <strong className="text-slate-300 font-mono">{settings.dlNo1}</strong>
            </span>
          )}
          {settings?.gstin && (
            <span className="hidden md:inline">
              GSTIN: <strong className="text-slate-300 font-mono">{settings.gstin}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden lg:flex items-center space-x-2 text-slate-400">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-emerald-300">F2 Billing</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-emerald-300">F4 Search</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-emerald-300">F9 Pay</span>
          </div>

          <div className="flex items-center space-x-1.5 text-slate-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Main Header & Tab Navigation */}
      <div className="px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Pharmacy Branding */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('billing')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black text-xl">
            <Pill className="w-6 h-6 transform -rotate-45" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">
                {settings?.storeName?.replace('& SURGICALS', '').trim() || 'HEALTHPLUS PHARMACY'}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Medical Store POS
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-tight">
              {settings?.tagline || 'Pharmacy Management & GST Billing System'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center overflow-x-auto space-x-1 py-1 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 relative ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
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
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

