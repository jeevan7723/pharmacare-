import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Building2,
  Plus,
  Search,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Settings,
  Sliders,
  DollarSign,
  Users,
  Package,
  Layers,
  ShoppingBag,
  Cpu,
  Pill,
  Sparkles,
  Lock,
  Unlock,
  AlertTriangle,
  X,
  Check,
  RefreshCw,
  ArrowLeft,
  Palette,
  CloudUpload,
} from 'lucide-react';
import { db } from '../db/db';
import { Workspace, IndustryType, PlanTier, LicenseStatus, WorkspaceFeatures, CompanyTheme } from '../types';
import { getIndustryTemplate } from '../db/seedData';
import { formatDate } from '../utils/formatters';
import { THEMES, getThemeColorClass } from './TopHeader';
import { syncWorkspaceToCloud, uploadLocalDatabaseToCloud } from '../firebase/firestoreService';

interface SuperAdminConsoleProps {
  currentWorkspace: Workspace;
  onSwitchWorkspace: (workspace: Workspace) => void;
  onRefreshWorkspaces: () => void;
  onExit?: () => void;
  onLock?: () => void;
}

export const SuperAdminConsole: React.FC<SuperAdminConsoleProps> = ({
  currentWorkspace,
  onSwitchWorkspace,
  onRefreshWorkspaces,
  onExit,
  onLock,
}) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');

  // Add Company Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    slug: '',
    industry: 'pharmacy' as IndustryType,
    theme: 'emerald' as CompanyTheme,
    plan: 'pro' as PlanTier,
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    validMonths: 12,
  });

  // Edit Modules Modal
  const [selectedWsForFeatures, setSelectedWsForFeatures] = useState<Workspace | null>(null);
  const [featureForm, setFeatureForm] = useState<WorkspaceFeatures | null>(null);

  const addModalRef = useRef<HTMLDialogElement>(null);
  const featureModalRef = useRef<HTMLDialogElement>(null);

  const loadWorkspaces = async () => {
    const list = await db.workspaces.toArray();
    setWorkspaces(list);
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const filteredWorkspaces = workspaces.filter((ws) => {
    const matchesSearch =
      ws.name.toLowerCase().includes(search.toLowerCase()) ||
      ws.slug.toLowerCase().includes(search.toLowerCase()) ||
      ws.license.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      ws.license.licenseKey.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || ws.license.status === statusFilter;
    const matchesIndustry = industryFilter === 'all' || ws.industry === industryFilter;

    return matchesSearch && matchesStatus && matchesIndustry;
  });

  // KPI calculations
  const totalCompanies = workspaces.length;
  const activeCount = workspaces.filter((w) => w.license.status === 'active').length;
  const trialCount = workspaces.filter((w) => w.license.status === 'trial').length;
  const suspendedCount = workspaces.filter((w) => w.license.status === 'suspended' || w.license.status === 'expired').length;

  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleSyncAllToCloud = async () => {
    setIsSyncingAll(true);
    try {
      const res = await uploadLocalDatabaseToCloud();
      alert(`Cloud Database Stored Successfully!\n\n${res.message}`);
    } catch (err: any) {
      alert(`Failed to sync to cloud database: ${err?.message || err}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Toggle License Status (Active <-> Suspended)
  const handleToggleStatus = async (ws: Workspace) => {
    const newStatus: LicenseStatus = ws.license.status === 'active' ? 'suspended' : 'active';
    const actionLabel = newStatus === 'suspended' ? 'SUSPEND' : 'ACTIVATE';
    
    if (!confirm(`Are you sure you want to ${actionLabel} client workspace: ${ws.name}?`)) return;

    const updatedLicense = {
      ...ws.license,
      status: newStatus,
    };

    await db.workspaces.update(ws.id, {
      license: updatedLicense,
    });

    await syncWorkspaceToCloud({ ...ws, license: updatedLicense });

    await loadWorkspaces();
    onRefreshWorkspaces();
  };

  // Open Feature Config Modal
  const openFeatureModal = (ws: Workspace) => {
    setSelectedWsForFeatures(ws);
    setFeatureForm({ ...ws.features });
    featureModalRef.current?.showModal();
  };

  // Save Feature Toggles
  const handleSaveFeatures = async () => {
    if (!selectedWsForFeatures || !featureForm) return;

    await db.workspaces.update(selectedWsForFeatures.id, {
      features: featureForm,
    });

    await syncWorkspaceToCloud({ ...selectedWsForFeatures, features: featureForm });

    featureModalRef.current?.close();
    setSelectedWsForFeatures(null);
    await loadWorkspaces();
    onRefreshWorkspaces();
  };

  // Open Add Company Modal
  const openAddModal = () => {
    setAddForm({
      name: '',
      slug: '',
      industry: 'pharmacy',
      theme: 'emerald',
      plan: 'pro',
      ownerName: '',
      ownerPhone: '',
      ownerEmail: '',
      validMonths: 12,
    });
    addModalRef.current?.showModal();
    setIsAddModalOpen(true);
  };

  // Create & Provision New Client Company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.ownerName.trim()) {
      alert('Please enter Company Name and Owner Name.');
      return;
    }

    const slug = addForm.slug.trim() || addForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const existing = workspaces.find((w) => w.slug === slug);
    if (existing) {
      alert(`A workspace with slug "${slug}" already exists. Please choose a different slug.`);
      return;
    }

    const template = getIndustryTemplate(addForm.industry);
    const validUntilDate = new Date();
    validUntilDate.setMonth(validUntilDate.getMonth() + addForm.validMonths);

    const newWsId = `ws_${Date.now().toString(36)}`;
    const randomKey = `LIC-${addForm.industry.substring(0, 3).toUpperCase()}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const newWorkspace: Workspace = {
      id: newWsId,
      name: addForm.name.trim(),
      slug,
      industry: addForm.industry,
      theme: addForm.theme || 'emerald',
      features: template.features,
      license: {
        status: 'active',
        plan: addForm.plan,
        validUntil: validUntilDate.toISOString().split('T')[0],
        maxMonthlyBills: addForm.plan === 'starter' ? 1000 : addForm.plan === 'pro' ? 10000 : -1,
        ownerName: addForm.ownerName.trim(),
        ownerPhone: addForm.ownerPhone.trim(),
        ownerEmail: addForm.ownerEmail.trim(),
        licenseKey: randomKey,
      },
      settings: {
        storeName: addForm.name.trim().toUpperCase(),
        tagline: `${addForm.name.trim()} - Point of Sale & Billing`,
        addressLine1: 'Main Market Road',
        addressLine2: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        phone: addForm.ownerPhone.trim(),
        email: addForm.ownerEmail.trim(),
        dlNo1: addForm.industry === 'pharmacy' ? '20B/MH/2026/001' : 'TRADE-LIC-2026-001',
        dlNo2: addForm.industry === 'pharmacy' ? '21B/MH/2026/001' : 'SHOPACT-2026-001',
        gstin: '27AABCU1234F1Z1',
        upiId: `${slug}@upi`,
        upiName: addForm.name.trim(),
        currencySymbol: '₹',
        invoiceFooterTerms: template.defaultSettings.invoiceFooterTerms || 'Thank you for your business!',
        defaultGstRate: template.defaultSettings.defaultGstRate || 18,
        printFormat: template.defaultSettings.printFormat || 'thermal-80mm',
        autoPrintOnSave: true,
      },
      createdAt: new Date().toISOString(),
      notes: `Provisioned by Super Admin for ${addForm.ownerName}`,
    };

    await db.workspaces.put(newWorkspace);
    await syncWorkspaceToCloud(newWorkspace);
    addModalRef.current?.close();
    setIsAddModalOpen(false);
    await loadWorkspaces();
    onRefreshWorkspaces();

    alert(`Company "${newWorkspace.name}" successfully provisioned with License Key: ${randomKey}`);
  };

  const getIndustryBadge = (ind: IndustryType) => {
    switch (ind) {
      case 'pharmacy':
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
            <Pill className="w-3 h-3 text-emerald-600" />
            <span>Pharmacy</span>
          </span>
        );
      case 'grocery':
        return (
          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
            <ShoppingBag className="w-3 h-3 text-amber-600" />
            <span>Supermarket</span>
          </span>
        );
      case 'electronics':
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
            <Cpu className="w-3 h-3 text-blue-600" />
            <span>Electronics</span>
          </span>
        );
      case 'clothing':
        return (
          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>Fashion / Retail</span>
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold">
            General Goods
          </span>
        );
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Master Authority Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-950 text-white rounded-3xl p-5 md:p-6 shadow-xl border border-amber-500/30 space-y-4">
        {/* Top Header Row: Badge & Platform Tag on left, Security/Exit Utilities on right */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] uppercase font-mono font-bold tracking-widest flex items-center gap-1.5 whitespace-nowrap shadow-xs">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>SUPER ADMIN MASTER CONTROL</span>
            </span>
            <span className="text-slate-400 text-xs hidden sm:inline">&bull; Platform Authority</span>
          </div>

          <div className="flex items-center gap-2">
            {onLock && (
              <button
                type="button"
                onClick={onLock}
                className="px-3.5 py-1.5 bg-red-950/60 hover:bg-red-900/80 active:scale-[0.98] text-red-200 hover:text-white font-bold rounded-xl text-xs border border-red-500/40 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="Lock Super Admin Portal & Require Password"
              >
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span>Lock Portal</span>
              </button>
            )}

            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 hover:text-white font-bold rounded-xl text-xs border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="Return to store / POS interface"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Back to Store ({currentWorkspace?.name || 'Active'})</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: Main Title & Description on left, Primary Action CTAs on right */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Client Companies & Licensing Portal</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              You hold master ownership over all companies using this software. Provision new customer workspaces, activate/suspend licenses remotely, and configure industry-specific modules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleSyncAllToCloud}
              disabled={isSyncingAll}
              className="px-4 py-2.5 bg-blue-950/70 hover:bg-blue-900 active:scale-[0.98] text-blue-200 hover:text-white font-bold rounded-xl text-xs border border-blue-500/40 flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Upload and store all companies, products, batches, suppliers, and bills in Firebase Cloud Firestore"
            >
              <CloudUpload className={`w-4 h-4 text-blue-400 ${isSyncingAll ? 'animate-bounce' : ''}`} />
              <span>{isSyncingAll ? 'Storing to Cloud...' : 'STORE ALL TO CLOUD DB'}</span>
            </button>

            <button
              onClick={openAddModal}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>PROVISION NEW COMPANY</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Client Companies</span>
            <Building2 className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {totalCompanies} Workspaces
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Multi-tenant client accounts</p>
        </div>

        <div className="bg-white border border-emerald-200 bg-emerald-50/20 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <span>Active Paid Subscriptions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
            {activeCount} Active
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">Fully licensed & operational</p>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/20 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center text-amber-800 text-xs font-bold uppercase tracking-wider">
            <span>Trial Accounts</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2 font-mono">
            {trialCount} In Trial
          </div>
          <p className="text-[11px] text-amber-700 font-semibold mt-1">Free evaluation period</p>
        </div>

        <div className="bg-white border border-red-200 bg-red-50/20 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center text-red-800 text-xs font-bold uppercase tracking-wider">
            <span>Suspended / Terminated</span>
            <Lock className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-700 mt-2 font-mono">
            {suspendedCount} Locked
          </div>
          <p className="text-[11px] text-red-700 font-semibold mt-1">Access revoked remotely</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3.5 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, owner, license key..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium"
          >
            <option value="all">All Industries</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="grocery">Supermarket / Grocery</option>
            <option value="electronics">Electronics & IT</option>
            <option value="clothing">Fashion & Apparel</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium"
          >
            <option value="all">All License Statuses</option>
            <option value="active">Active Only</option>
            <option value="trial">Trial Only</option>
            <option value="suspended">Suspended Only</option>
          </select>

          <button
            onClick={loadWorkspaces}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Refresh Companies"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center text-xs font-bold">
          <span>Client Companies Master Registry ({filteredWorkspaces.length})</span>
          <span className="text-slate-400 font-normal">
            Currently Viewing: <strong className="text-amber-400">{currentWorkspace.name}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Company / Business</th>
                <th className="py-3 px-3">Industry Preset</th>
                <th className="py-3 px-3">Owner Contact</th>
                <th className="py-3 px-3">Plan & Expiry</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Master Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredWorkspaces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No client companies match the selected search filters.
                  </td>
                </tr>
              ) : (
                filteredWorkspaces.map((ws) => {
                  const isCurrent = currentWorkspace.id === ws.id;
                  const isSuspended = ws.license.status === 'suspended' || ws.license.status === 'expired';

                  return (
                    <tr
                      key={ws.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCurrent ? 'bg-amber-50/40 font-medium' : ''
                      }`}
                    >
                      {/* Company Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-slate-900 text-sm">{ws.name}</div>
                          {isCurrent && (
                            <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded uppercase">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          slug: <span className="text-slate-700">/{ws.slug}</span> &bull; ID: {ws.id}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Key: {ws.license.licenseKey}
                        </div>
                      </td>

                      {/* Industry Preset & Color Theme */}
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          {getIndustryBadge(ws.industry)}
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                            <span className={`w-2 h-2 rounded-full ${getThemeColorClass(ws.theme, ws.industry)}`} />
                            <span className="capitalize">{ws.theme || (ws.industry === 'grocery' ? 'amber' : ws.industry === 'electronics' ? 'blue' : ws.industry === 'clothing' ? 'purple' : 'emerald')} theme</span>
                          </div>
                        </div>
                      </td>

                      {/* Owner Contact */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{ws.license.ownerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{ws.license.ownerPhone}</div>
                        <div className="text-[10px] text-slate-400">{ws.license.ownerEmail}</div>
                      </td>

                      {/* Plan & Expiry */}
                      <td className="py-3 px-3">
                        <span className="uppercase font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {ws.license.plan}
                        </span>
                        <div className="text-[11px] text-slate-600 mt-1">
                          Valid until: <strong className="font-mono">{formatDate(ws.license.validUntil)}</strong>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                            ws.license.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : ws.license.status === 'trial'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-red-100 text-red-800 border border-red-300'
                          }`}
                        >
                          {ws.license.status}
                        </span>
                      </td>

                      {/* Master Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Switch to this workspace */}
                          <button
                            onClick={() => onSwitchWorkspace(ws)}
                            disabled={isCurrent}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              isCurrent
                                ? 'bg-slate-100 text-slate-400 cursor-default'
                                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                            }`}
                            title="Open and manage this client workspace"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{isCurrent ? 'Active' : 'Open Workspace'}</span>
                          </button>

                          {/* Feature Modules Toggle */}
                          <button
                            onClick={() => openFeatureModal(ws)}
                            className="p-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700"
                            title="Configure company features & modules"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Suspended */}
                          <button
                            onClick={() => handleToggleStatus(ws)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isSuspended
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                            title={isSuspended ? 'Unlock / Reactivate Company' : 'Suspend / Lock Company (Kill Switch)'}
                          >
                            {isSuspended ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= PROVISION NEW COMPANY DIALOG ================= */}
      <dialog
        ref={addModalRef}
        aria-labelledby="add-modal-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-xl w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 id="add-modal-title" className="text-base font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              <span>Provision New Client Company</span>
            </h2>
            <p className="text-xs text-slate-400">Set up workspace isolation, industry catalog template, and license</p>
          </div>
          <button
            onClick={() => {
              addModalRef.current?.close();
              setIsAddModalOpen(false);
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company / Store Name *</label>
              <input
                type="text"
                required
                autoFocus
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="e.g. Apex Hypermarket"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Workspace Slug (URL / ID)</label>
              <input
                type="text"
                value={addForm.slug}
                onChange={(e) => setAddForm({ ...addForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="e.g. apex-market"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* Industry Preset Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Select Industry Template (Adapts POS & Product Catalog) *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'pharmacy', label: 'Pharmacy', desc: 'Batch, Expiry, Doctor Rx', icon: Pill },
                { id: 'grocery', label: 'Supermarket', desc: 'Barcodes, Weight, FMCG', icon: ShoppingBag },
                { id: 'electronics', label: 'Electronics', desc: 'Serial/IMEI, Warranty', icon: Cpu },
                { id: 'clothing', label: 'Fashion / Retail', desc: 'Size, Color, Clothing', icon: Sparkles },
              ].map((ind) => {
                const Icon = ind.icon;
                const isSelected = addForm.industry === ind.id;
                return (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => {
                      const autoTheme: CompanyTheme =
                        ind.id === 'grocery' ? 'amber' :
                        ind.id === 'electronics' ? 'blue' :
                        ind.id === 'clothing' ? 'purple' : 'emerald';
                      setAddForm({ ...addForm, industry: ind.id as IndustryType, theme: autoTheme });
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1.5 text-amber-600" />
                    <div className="text-xs">{ind.label}</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">{ind.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand Color Theme Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Brand Color Theme *</span>
              <span className="text-[10px] text-slate-400 capitalize font-normal">Active Theme: <strong className="text-slate-800">{addForm.theme}</strong></span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {THEMES.map((th) => {
                const isSelected = addForm.theme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setAddForm({ ...addForm, theme: th.id })}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 shadow-xs ring-1 ring-amber-400'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${th.bg} shadow-xs ring-1 ring-black/10`} />
                    <span className="text-[10px] font-bold text-slate-800 leading-tight">{th.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Owner Name *</label>
              <input
                type="text"
                required
                value={addForm.ownerName}
                onChange={(e) => setAddForm({ ...addForm, ownerName: e.target.value })}
                placeholder="Client Name"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Owner Phone</label>
              <input
                type="tel"
                value={addForm.ownerPhone}
                onChange={(e) => setAddForm({ ...addForm, ownerPhone: e.target.value })}
                placeholder="+91 98200 11223"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Owner Email</label>
              <input
                type="email"
                value={addForm.ownerEmail}
                onChange={(e) => setAddForm({ ...addForm, ownerEmail: e.target.value })}
                placeholder="client@gmail.com"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Subscription Plan Tier</label>
              <select
                value={addForm.plan}
                onChange={(e) => setAddForm({ ...addForm, plan: e.target.value as PlanTier })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="starter">Starter Plan (Up to 1,000 bills/mo)</option>
                <option value="pro">Pro Plan (Up to 10,000 bills/mo)</option>
                <option value="enterprise">Enterprise Plan (Unlimited)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Validity Period</label>
              <select
                value={addForm.validMonths}
                onChange={(e) => setAddForm({ ...addForm, validMonths: parseInt(e.target.value, 10) })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value={1}>1 Month (Monthly Subscription)</option>
                <option value={3}>3 Months (Quarterly)</option>
                <option value={6}>6 Months (Half-Yearly)</option>
                <option value={12}>12 Months (1 Year License)</option>
                <option value={36}>36 Months (3 Years)</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-100 -mx-6 -mb-6 p-4 flex justify-end space-x-2 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={() => {
                addModalRef.current?.close();
                setIsAddModalOpen(false);
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Create & Provision Company</span>
            </button>
          </div>
        </form>
      </dialog>

      {/* ================= EDIT MODULES / FEATURES DIALOG ================= */}
      <dialog
        ref={featureModalRef}
        aria-labelledby="feature-modal-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-lg w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 id="feature-modal-title" className="text-base font-bold flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              <span>Configure Feature Modules</span>
            </h2>
            <p className="text-xs text-slate-400">{selectedWsForFeatures?.name}</p>
          </div>
          <button
            onClick={() => featureModalRef.current?.close()}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {featureForm && (
          <div className="p-6 space-y-3">
            <p className="text-xs text-slate-600 mb-2">
              Enable or disable specific modules for this company based on their subscription package:
            </p>

            {[
              {
                key: 'enableBatchAndExpiry',
                label: 'Batch Numbers & Expiry Watchtower',
                desc: 'FEFO stock auto-deduction, expiry dates, and alerts (mandatory for pharmacy)',
              },
              {
                key: 'enableDoctorPrescription',
                label: 'Doctor & Prescription Registration',
                desc: 'Captures consulting doctors and MCI registration numbers',
              },
              {
                key: 'enableCustomerKhata',
                label: 'Customer Khata (Credit Ledger)',
                desc: 'Tracks patient/buyer debt balances and partial installments',
              },
              {
                key: 'enableBarcodeScanner',
                label: 'Barcode & SKU Scanning Bar',
                desc: 'Instant lookup via USB/Bluetooth barcode guns',
              },
              {
                key: 'enableSerialTracking',
                label: 'Serial & IMEI Warranty Tracking',
                desc: 'For electronics, laptops, and appliances',
              },
              {
                key: 'enableRacksAndShelves',
                label: 'Rack & Shelf Physical Locator',
                desc: 'Displays storage location (Rack A - Shelf 2) on POS bill items',
              },
            ].map((f) => (
              <label
                key={f.key}
                className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={(featureForm as any)[f.key]}
                  onChange={(e) =>
                    setFeatureForm({
                      ...featureForm,
                      [f.key]: e.target.checked,
                    })
                  }
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <div>
                  <div className="text-xs font-bold text-slate-800">{f.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{f.desc}</div>
                </div>
              </label>
            ))}

            <div className="bg-slate-100 -mx-6 -mb-6 p-4 flex justify-end space-x-2 border-t border-slate-200 mt-6">
              <button
                type="button"
                onClick={() => featureModalRef.current?.close()}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFeatures}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black shadow-md"
              >
                Save Modules
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};
