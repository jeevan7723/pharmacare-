import React, { useState, useEffect } from 'react';
import { db, initializeDatabase } from './db/db';
import { StoreSettings } from './types';
import { checkExpiryStatus } from './utils/formatters';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardOverview } from './components/DashboardOverview';
import { BillingPOS } from './components/BillingPOS';
import { InventoryManagement } from './components/InventoryManagement';
import { PurchaseEntry } from './components/PurchaseEntry';
import { ExpiryAlerts } from './components/ExpiryAlerts';
import { CustomerKhata } from './components/CustomerKhata';
import { DoctorsDirectory } from './components/DoctorsDirectory';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { ActiveBillDock } from './components/ActiveBillDock';
import {
  syncSettingsToCloud,
  syncAllBillingAndPaymentsToCloud,
  downloadCloudDatabaseToLocal,
} from './firebase/firestoreService';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Badge counters
  const [expiredCount, setExpiredCount] = useState(0);
  const [criticalExpiryCount, setCriticalExpiryCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [heldBillsCount, setHeldBillsCount] = useState(0);

  const refreshStats = async () => {
    try {
      let currentSettings = await db.settings.get(1);
      if (currentSettings) {
        if (currentSettings.storeName && currentSettings.storeName.includes('& SURGICALS')) {
          currentSettings = {
            ...currentSettings,
            storeName: currentSettings.storeName.replace('& SURGICALS', '').trim(),
          };
          await db.settings.put(currentSettings);
          syncSettingsToCloud(currentSettings);
        }
        setSettings(currentSettings);
      }

      const batches = await db.batches.toArray();
      const meds = await db.medicines.toArray();
      const held = await db.heldBills.count();

      let expCount = 0;
      let critCount = 0;

      batches.forEach((b) => {
        if (b.stockQty > 0) {
          const status = checkExpiryStatus(b.expiryDate);
          if (status.status === 'expired') expCount++;
          if (status.status === 'critical') critCount++;
        }
      });

      let lowCount = 0;
      meds.forEach((m) => {
        const medBatches = batches.filter((b) => b.medicineId === m.id);
        const total = medBatches.reduce((s, b) => s + b.stockQty, 0);
        if (total <= m.minStockAlert) lowCount++;
      });

      setExpiredCount(expCount);
      setCriticalExpiryCount(critCount);
      setLowStockCount(lowCount);
      setHeldBillsCount(held);
    } catch (err) {
      console.error('Error refreshing stats:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();

        // Automatically fetch and synchronize existing pharmacy data from Firebase Cloud Firestore
        try {
          const cloudResult = await downloadCloudDatabaseToLocal();
          if (cloudResult.success) {
            console.log('[App] Cloud data synchronized on startup:', cloudResult.message);
          }
        } catch (cloudErr) {
          console.warn('[App] Firebase Cloud auto-sync notice:', cloudErr);
        }

        await refreshStats();

        // Ensure any local pending records are safely mirrored in Cloud
        syncAllBillingAndPaymentsToCloud().catch((err) => {
          console.warn('Background Firebase billing sync notice:', err);
        });
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Global keybindings
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('billing');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('inventory');
      } else if (e.key === 'Escape' && activeTab !== 'dashboard') {
        // Exit to dashboard if no dialog modal is currently open
        const hasOpenDialog = document.querySelector('dialog[open]');
        if (!hasOpenDialog) {
          setActiveTab('dashboard');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center">
          <h2 className="text-lg font-bold">PharmaCare Pro Billing Software</h2>
          <p className="text-xs text-slate-400 mt-1">Connecting to Firebase Cloud & loading pharmacy records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
        {/* Left Sidebar (Desktop + Mobile Drawer) */}
        <div
          className={`${
            isMobileMenuOpen ? 'fixed inset-0 z-50 flex' : 'hidden lg:flex'
          }`}
        >
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            ></div>
          )}

          <div className="relative z-10 flex h-full">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                setActiveTab(tab);
                setIsMobileMenuOpen(false);
              }}
              settings={settings}
              expiredCount={expiredCount}
              criticalExpiryCount={criticalExpiryCount}
              lowStockCount={lowStockCount}
              heldBillsCount={heldBillsCount}
              isCollapsed={isSidebarCollapsed}
              setIsCollapsed={setIsSidebarCollapsed}
            />
          </div>
        </div>

        {/* Main App Container */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          {/* Top Header Bar */}
          <TopHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            settings={settings}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />

          {/* Scrollable View Area */}
          <main className="flex-1 overflow-y-auto">
            {activeTab === 'dashboard' && (
              <DashboardOverview
                settings={settings}
                setActiveTab={setActiveTab}
                expiredCount={expiredCount}
                criticalExpiryCount={criticalExpiryCount}
                lowStockCount={lowStockCount}
                heldBillsCount={heldBillsCount}
              />
            )}
            <div className={activeTab === 'billing' ? 'block' : 'hidden'}>
              <BillingPOS
                settings={settings}
                onRefreshStats={refreshStats}
                isActive={activeTab === 'billing'}
                onExit={() => setActiveTab('dashboard')}
              />
            </div>
            {activeTab === 'inventory' && (
              <InventoryManagement
                settings={settings}
                onRefreshStats={refreshStats}
                onExit={() => setActiveTab('dashboard')}
              />
            )}
            {activeTab === 'purchase' && (
              <PurchaseEntry
                settings={settings}
                onRefreshStats={refreshStats}
                onExit={() => setActiveTab('dashboard')}
              />
            )}
            {activeTab === 'alerts' && (
              <ExpiryAlerts
                settings={settings}
                onRefreshStats={refreshStats}
                onExit={() => setActiveTab('dashboard')}
              />
            )}
            {activeTab === 'customers' && (
              <CustomerKhata
                settings={settings}
                onRefreshStats={refreshStats}
                onExit={() => setActiveTab('dashboard')}
              />
            )}
            {activeTab === 'doctors' && (
              <DoctorsDirectory onExit={() => setActiveTab('dashboard')} />
            )}
            {activeTab === 'reports' && (
              <ReportsView
                settings={settings}
                onExit={() => setActiveTab('dashboard')}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                onRefreshSettings={refreshStats}
                onExit={() => setActiveTab('dashboard')}
              />
            )}
          </main>

          {/* Persistent Active Bill Dock across other sections */}
          <ActiveBillDock
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            symbol={settings?.currencySymbol || '₹'}
            onRefreshStats={refreshStats}
          />
        </div>
      </div>
  );
};

export default App;
