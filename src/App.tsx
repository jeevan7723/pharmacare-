import React, { useState, useEffect } from 'react';
import { db, initializeDatabase } from './db/db';
import { StoreSettings, Workspace, CompanyTheme } from './types';
import { checkExpiryStatus } from './utils/formatters';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardOverview } from './components/DashboardOverview';
import { BillingPOS } from './components/BillingPOS';
import { GeneratedBills } from './components/GeneratedBills';
import { InventoryManagement } from './components/InventoryManagement';
import { PurchaseEntry } from './components/PurchaseEntry';
import { ExpiryAlerts } from './components/ExpiryAlerts';
import { CustomerKhata } from './components/CustomerKhata';
import { DoctorsDirectory } from './components/DoctorsDirectory';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { ActiveBillDock } from './components/ActiveBillDock';
import { SuperAdminConsole } from './components/SuperAdminConsole';
import {
  SuperAdminLoginModal,
  SuperAdminLockScreen,
  isSuperAdminSessionValid,
  setSuperAdminSession,
} from './components/SuperAdminAuth';
import { Lock, ShieldAlert, Key, Building2 } from 'lucide-react';
import {
  syncSettingsToCloud,
  syncAllBillingAndPaymentsToCloud,
  downloadCloudDatabaseToLocal,
} from './firebase/firestoreService';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  // Super Admin Password Authentication state (Password: jeevan@1234)
  const [isSuperAdminAuth, setIsSuperAdminAuth] = useState<boolean>(() => isSuperAdminSessionValid());
  const [isSuperAdminLoginModalOpen, setIsSuperAdminLoginModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Badge counters
  const [expiredCount, setExpiredCount] = useState(0);
  const [criticalExpiryCount, setCriticalExpiryCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [heldBillsCount, setHeldBillsCount] = useState(0);
  const [autoOpenAddModal, setAutoOpenAddModal] = useState(false);

  const handleOpenSuperAdmin = () => {
    if (isSuperAdminAuth) {
      setActiveTab('superadmin');
    } else {
      setIsSuperAdminLoginModalOpen(true);
    }
  };

  const handleSuperAdminAuthSuccess = () => {
    setIsSuperAdminAuth(true);
    setActiveTab('superadmin');
  };

  const handleLockSuperAdmin = () => {
    setSuperAdminSession(false);
    setIsSuperAdminAuth(false);
    setActiveTab('dashboard');
  };

  // Dynamically apply active company workspace theme to root document
  useEffect(() => {
    const theme = currentWorkspace?.theme || (
      currentWorkspace?.industry === 'grocery'
        ? 'amber'
        : currentWorkspace?.industry === 'electronics'
        ? 'blue'
        : currentWorkspace?.industry === 'clothing'
        ? 'purple'
        : 'emerald'
    );
    document.documentElement.setAttribute('data-theme', theme);
  }, [currentWorkspace?.theme, currentWorkspace?.industry]);

  const handleUpdateWorkspaceTheme = async (theme: CompanyTheme) => {
    if (!currentWorkspace) return;
    await db.workspaces.update(currentWorkspace.id, { theme });
    const updated = { ...currentWorkspace, theme };
    setCurrentWorkspace(updated);
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === currentWorkspace.id ? updated : w))
    );
  };

  const refreshStats = async (wsId?: string) => {
    try {
      const targetWsId = wsId || currentWorkspace?.id || 'ws_healthplus';

      let currentSettings = await db.settings.get(1);
      const activeWs = await db.workspaces.get(targetWsId);
      if (activeWs?.settings) {
        currentSettings = {
          ...(currentSettings || {}),
          ...activeWs.settings,
          id: 1,
        } as StoreSettings;
      }

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

      const allBatches = await db.batches.toArray();
      const allMeds = await db.medicines.toArray();
      const allHeld = await db.heldBills.toArray();

      const batches = allBatches.filter((b) => (b.workspaceId || 'ws_healthplus') === targetWsId);
      const meds = allMeds.filter((m) => (m.workspaceId || 'ws_healthplus') === targetWsId);
      const held = allHeld.filter((h) => (h.workspaceId || 'ws_healthplus') === targetWsId).length;

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

  const reloadWorkspaces = async () => {
    try {
      const allWs = await db.workspaces.toArray();
      setWorkspaces(allWs);
      if (currentWorkspace) {
        const updated = allWs.find((w) => w.id === currentWorkspace.id);
        if (updated) {
          setCurrentWorkspace(updated);
        }
      }
    } catch (err) {
      console.error('Error reloading workspaces:', err);
    }
  };

  const handleSwitchWorkspace = (ws: Workspace) => {
    localStorage.setItem('active_workspace_id', ws.id);
    setCurrentWorkspace(ws);
    if (ws.settings) {
      setSettings((prev) => ({
        ...(prev || {}),
        id: 1,
        ...ws.settings,
      } as StoreSettings));
    }
    refreshStats(ws.id);
  };

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();

        // Load multi-tenant workspaces
        const allWs = await db.workspaces.toArray();
        setWorkspaces(allWs);

        const savedWsId = localStorage.getItem('active_workspace_id') || 'ws_healthplus';
        const activeWs = allWs.find((w) => w.id === savedWsId) || allWs[0];
        setCurrentWorkspace(activeWs || null);

        // Automatically fetch and synchronize existing pharmacy data from Firebase Cloud Firestore
        try {
          const cloudResult = await downloadCloudDatabaseToLocal();
          if (cloudResult.success) {
            console.log('[App] Cloud data synchronized on startup:', cloudResult.message);
          }
        } catch (cloudErr) {
          console.warn('[App] Firebase Cloud auto-sync notice:', cloudErr);
        }

        await refreshStats(activeWs?.id);

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
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('bills');
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

  const isCurrentWsSuspended =
    currentWorkspace?.license.status === 'suspended' || currentWorkspace?.license.status === 'expired';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center">
          <h2 className="text-lg font-bold">Billing Software Platform (Multi-Tenant SaaS)</h2>
          <p className="text-xs text-slate-400 mt-1">Connecting to Firebase Cloud & loading client company records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Left Sidebar (Desktop + Mobile Drawer) */}
      <div className={`${isMobileMenuOpen ? 'fixed inset-0 z-50 flex' : 'hidden lg:flex'}`}>
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
            currentWorkspace={currentWorkspace}
            onOpenSuperAdmin={() => {
              handleOpenSuperAdmin();
              setIsMobileMenuOpen(false);
            }}
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
          currentWorkspace={currentWorkspace}
          allWorkspaces={workspaces}
          onSwitchWorkspace={handleSwitchWorkspace}
          onOpenSuperAdmin={handleOpenSuperAdmin}
          onUpdateWorkspaceTheme={handleUpdateWorkspaceTheme}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Global Suspended License Warning Banner */}
        {isCurrentWsSuspended && activeTab !== 'superadmin' && (
          <div className="bg-red-600 text-white px-3 sm:px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 shrink-0 text-white animate-bounce" />
              <span className="truncate">
                <strong>LICENSE SUSPENDED:</strong> Workspace "{currentWorkspace?.name}" has been suspended by the platform administrator. Bill generation is locked.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenSuperAdmin}
                className="px-2.5 py-1 bg-white text-red-700 hover:bg-red-50 rounded text-[11px] font-black uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
              >
                Super Admin Reactivate
              </button>
            </div>
          </div>
        )}

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              settings={settings}
              currentWorkspace={currentWorkspace}
              setActiveTab={setActiveTab}
              onQuickAddProduct={() => {
                setActiveTab('inventory');
                setAutoOpenAddModal(true);
              }}
              expiredCount={expiredCount}
              criticalExpiryCount={criticalExpiryCount}
              lowStockCount={lowStockCount}
              heldBillsCount={heldBillsCount}
            />
          )}

          <div className={activeTab === 'billing' ? 'block' : 'hidden'}>
            <BillingPOS
              settings={settings}
              currentWorkspace={currentWorkspace}
              onRefreshStats={refreshStats}
              isActive={activeTab === 'billing'}
            />
          </div>

          {activeTab === 'bills' && (
            <GeneratedBills
              settings={settings}
              currentWorkspace={currentWorkspace}
              onNewBill={() => setActiveTab('billing')}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryManagement
              settings={settings}
              currentWorkspace={currentWorkspace}
              onRefreshStats={refreshStats}
              autoOpenAddModal={autoOpenAddModal}
              onAddModalOpened={() => setAutoOpenAddModal(false)}
            />
          )}

          {activeTab === 'purchase' && (
            <PurchaseEntry
              settings={settings}
              currentWorkspace={currentWorkspace}
              onRefreshStats={refreshStats}
            />
          )}

          {activeTab === 'alerts' && (
            <ExpiryAlerts
              settings={settings}
              currentWorkspace={currentWorkspace}
              onRefreshStats={refreshStats}
            />
          )}

          {activeTab === 'customers' && (
            <CustomerKhata
              settings={settings}
              currentWorkspace={currentWorkspace}
              onRefreshStats={refreshStats}
            />
          )}

          {activeTab === 'doctors' && <DoctorsDirectory />}

          {activeTab === 'reports' && (
            <ReportsView
              settings={settings}
              currentWorkspace={currentWorkspace}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              currentWorkspace={currentWorkspace}
              onRefreshSettings={refreshStats}
              onUpdateWorkspaceTheme={handleUpdateWorkspaceTheme}
            />
          )}

          {activeTab === 'superadmin' && currentWorkspace && (
            isSuperAdminAuth ? (
              <SuperAdminConsole
                currentWorkspace={currentWorkspace}
                onSwitchWorkspace={handleSwitchWorkspace}
                onRefreshWorkspaces={reloadWorkspaces}
                onExit={() => setActiveTab('dashboard')}
                onLock={handleLockSuperAdmin}
              />
            ) : (
              <SuperAdminLockScreen
                onSuccess={handleSuperAdminAuthSuccess}
                onCancel={() => setActiveTab('dashboard')}
              />
            )
          )}
        </main>

        {/* Persistent Active Bill Dock across other sections */}
        {activeTab !== 'superadmin' && (
          <ActiveBillDock
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            symbol={currentWorkspace?.settings.currencySymbol || settings?.currencySymbol || '₹'}
            onRefreshStats={refreshStats}
          />
        )}
      </div>

      {/* Super Admin Password Authentication Modal (Password: jeevan@1234) */}
      <SuperAdminLoginModal
        isOpen={isSuperAdminLoginModalOpen}
        onClose={() => setIsSuperAdminLoginModalOpen(false)}
        onSuccess={handleSuperAdminAuthSuccess}
      />
    </div>
  );
};

export default App;
