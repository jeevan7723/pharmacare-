import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Building2,
  Printer,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Server,
  FileDown,
  Loader2,
  LogOut,
} from 'lucide-react';
import { db, exportDatabaseToJson, restoreDatabaseFromJson, resetDatabaseToDefault } from '../db/db';
import { StoreSettings } from '../types';
import { generateStorePdfBackup } from '../utils/pdfBackupGenerator';
import {
  checkFirebaseConnection,
  uploadLocalDatabaseToCloud,
  downloadCloudDatabaseToLocal,
  syncSettingsToCloud,
} from '../firebase/firestoreService';

interface SettingsProps {
  settings: StoreSettings | null;
  onRefreshSettings: () => void;
  onExit?: () => void;
}

export const SettingsView: React.FC<SettingsProps> = ({ settings, onRefreshSettings, onExit }) => {
  const [formData, setFormData] = useState<StoreSettings>({
    storeName: '',
    tagline: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    dlNo1: '',
    dlNo2: '',
    gstin: '',
    fssaiNo: '',
    upiId: '',
    upiName: '',
    currencySymbol: '₹',
    invoiceFooterTerms: '',
    defaultGstRate: 12,
    printFormat: 'thermal-80mm',
    autoPrintOnSave: false,
  });

  const [isSaved, setIsSaved] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [cloudChecking, setCloudChecking] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
    // Check initial Firebase connection
    checkFirebaseConnection().then(setCloudStatus);
  }, [settings]);

  // Save settings to Dexie & Cloud Firestore
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.settings.put({ ...formData, id: 1 });
    syncSettingsToCloud(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
    onRefreshSettings();
  };

  // Test Firebase connection
  const handleTestConnection = async () => {
    setCloudChecking(true);
    const res = await checkFirebaseConnection();
    setCloudStatus(res);
    setCloudChecking(false);
  };

  // Upload all local data to Firebase Cloud
  const handleUploadAllToCloud = async () => {
    if (!confirm('Upload all local medicines, batches, customers, invoices, and settings to Firebase Cloud Firestore?')) return;
    setIsCloudSyncing(true);
    setCloudSyncMessage('Uploading all local database collections to Firebase Cloud...');
    const res = await uploadLocalDatabaseToCloud();
    setIsCloudSyncing(false);
    setCloudSyncMessage(res.message);
  };

  // Download all cloud data to local Dexie
  const handleDownloadAllFromCloud = async () => {
    if (!confirm('Download and sync all cloud data into local database? This will refresh your local medicines and batches.')) return;
    setIsCloudSyncing(true);
    setCloudSyncMessage('Downloading collections from Firebase Cloud...');
    const res = await downloadCloudDatabaseToLocal();
    setIsCloudSyncing(false);
    setCloudSyncMessage(res.message);
    if (res.success) {
      onRefreshSettings();
    }
  };

  // Export Database Backup (.json)
  const handleExportBackup = async () => {
    try {
      const json = await exportDatabaseToJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PharmaCare_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export backup: ' + err);
    }
  };

  // Export Store Backup (.pdf)
  const handleExportPdfBackup = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateStorePdfBackup(settings);
    } catch (err: any) {
      alert('Failed to generate PDF backup: ' + (err?.message || err));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Restore Database Backup (.json)
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('CAUTION: Restoring will overwrite all existing medicines, invoices, and customers with the backup file. Proceed?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await restoreDatabaseFromJson(content);
      if (success) {
        setRestoreStatus('Database restored successfully from backup!');
        onRefreshSettings();
      } else {
        setRestoreStatus('Failed to restore. Please check if the JSON file is valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Reset to Demo Data
  const handleResetDemo = async () => {
    if (!confirm('Reset all data and reload fresh 20+ demo medicines, batches, customers, and doctors?')) return;
    await resetDatabaseToDefault();
    onRefreshSettings();
    alert('Database successfully reset to initial demo pharmacy data!');
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            Pharmacy Store Profile & Invoicing Settings
          </h2>
          <p className="text-xs text-slate-500">
            Configure your Medical Store Drug License numbers, GSTIN, UPI payment QR details, and database backups.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
              title="Exit Settings"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>Exit</span>
            </button>
          )}

          {isSaved && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Settings Saved!</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Pharmacy Identity & Drug Licenses */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            Medical Store Name & Licenses
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pharmacy / Medical Store Name *
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                placeholder="e.g. HEALTHPLUS PHARMACY"
                className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Store Tagline / Subtitle
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                placeholder="e.g. 24x7 Chemist & Druggist"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Drug License No. Form 20B *
              </label>
              <input
                type="text"
                value={formData.dlNo1}
                onChange={(e) => setFormData({ ...formData, dlNo1: e.target.value })}
                placeholder="20B/MH/2023/89412"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Drug License No. Form 21B
              </label>
              <input
                type="text"
                value={formData.dlNo2}
                onChange={(e) => setFormData({ ...formData, dlNo2: e.target.value })}
                placeholder="21B/MH/2023/89413"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                GSTIN (Goods & Services Tax)
              </label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="27AABCH1234F1Z9"
                className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FSSAI License No.</label>
              <input
                type="text"
                value={formData.fssaiNo || ''}
                onChange={(e) => setFormData({ ...formData, fssaiNo: e.target.value })}
                placeholder="11521018000452"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Store Phone / Mobile *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98201 23456"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Store Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="pharmacy@gmail.com"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Address Line 1</label>
              <input
                type="text"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                placeholder="Shop No. 4-5, Metro Square"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Address Line 2 / Landmark</label>
              <input
                type="text"
                value={formData.addressLine2}
                onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                placeholder="Opposite Civil Hospital, Station Road"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Mumbai"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="Maharashtra"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="400001"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* UPI QR & Payment Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
            <QrCode className="w-4 h-4 text-emerald-600" />
            UPI Payment QR Code & Bill Terms
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                UPI ID (Virtual Payment Address - VPA)
              </label>
              <input
                type="text"
                value={formData.upiId}
                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                placeholder="e.g. pharmacy@okaxis or merchant@upi"
                className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Generates instant dynamic QR code on customer bills with exact amount payable.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Default Print Format
              </label>
              <select
                value={formData.printFormat}
                onChange={(e) => setFormData({ ...formData, printFormat: e.target.value as any })}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="thermal-80mm">3-inch Thermal Slip (80mm POS Printer)</option>
                <option value="a4-tax-invoice">Standard A4 GST Tax Invoice (Laser / DeskJet)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Invoice Footer Terms & Conditions
            </label>
            <textarea
              rows={3}
              value={formData.invoiceFooterTerms}
              onChange={(e) => setFormData({ ...formData, invoiceFooterTerms: e.target.value })}
              className="w-full text-xs p-3 border border-slate-300 rounded-lg leading-relaxed font-sans"
              placeholder="Terms printed at bottom of every receipt..."
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>SAVE PROFILE SETTINGS</span>
          </button>
        </div>
      </form>

      {/* Firebase Cloud Firestore Sync Station */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>Firebase Cloud Firestore Database</span>
                <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-mono font-bold">
                  pharmacare-1d3a2
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Connected to Google Cloud Firestore with real-time multi-terminal sync and persistent offline caching.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 ${
                cloudStatus?.ok
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  cloudStatus?.ok ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
                }`}
              ></span>
              <span>{cloudStatus?.ok ? 'Cloud Connected' : 'Checking Cloud...'}</span>
            </span>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={cloudChecking}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cloudChecking ? 'animate-spin' : ''}`} />
              <span>Test Connection</span>
            </button>
          </div>
        </div>

        {cloudStatus?.message && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
              cloudStatus.ok
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{cloudStatus.message}</span>
          </div>
        )}

        {/* Sync Operations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Upload to Cloud */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <CloudUpload className="w-4 h-4 text-emerald-600" />
                <span>Upload Local Inventory & Bills to Firebase Cloud</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Uploads all local medicines, batches, customers, invoices, and settings into your Firebase Cloud Firestore collections.
              </p>
            </div>
            <button
              type="button"
              onClick={handleUploadAllToCloud}
              disabled={isCloudSyncing}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CloudUpload className="w-4 h-4" />
              <span>Upload Local Data to Firebase</span>
            </button>
          </div>

          {/* Download from Cloud */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <CloudDownload className="w-4 h-4 text-teal-600" />
                <span>Fetch / Sync from Firebase Cloud</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Fetches all medicines, batches, and patient accounts from Firebase Cloud Firestore into this terminal.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadAllFromCloud}
              disabled={isCloudSyncing}
              className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CloudDownload className="w-4 h-4 text-teal-400" />
              <span>Fetch Data from Firebase Cloud</span>
            </button>
          </div>
        </div>

        {cloudSyncMessage && (
          <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900">
            {cloudSyncMessage}
          </div>
        )}
      </div>

      {/* Database Backup & Restore Center */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Data Safety, Backup & Database Recovery
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Export Full JSON Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Export Full JSON Backup</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Download full raw database backup (.json) with all medicines, batches, customers, bills, and purchase orders.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="mt-4 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download Backup (.json)</span>
            </button>
          </div>

          {/* Export Store Backup (PDF) */}
          <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/60 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <FileDown className="w-3.5 h-3.5 text-emerald-700" />
                  Store Backup (PDF)
                </h4>
                <span className="text-[9px] bg-emerald-200/80 text-emerald-900 font-black px-1.5 py-0.5 rounded tracking-wide">
                  PDF DOC
                </span>
              </div>
              <p className="text-[11px] text-emerald-900/80 mt-1">
                Export complete multi-page PDF audit report with Store KPIs, Bill Invoices, Stock Valuation, and Customer Khata.
              </p>
            </div>
            <button
              onClick={handleExportPdfBackup}
              disabled={isGeneratingPdf}
              className="mt-4 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Download Backup (.pdf)</span>
                </>
              )}
            </button>
          </div>

          {/* Restore Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Restore from Backup File</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Restore database from a previously downloaded .json backup file.
              </p>
            </div>
            <label className="mt-4 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
              <Upload className="w-3.5 h-3.5 text-slate-300" />
              <span>Upload & Restore (.json)</span>
              <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
            </label>
          </div>

          {/* Reset Demo Data */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800">Reset Initial Demo Data</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Reset database and load 20+ preloaded sample medicines, realistic batches, expiries, and doctors.
              </p>
            </div>
            <button
              onClick={handleResetDemo}
              className="mt-4 px-3 py-2 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Demo Data</span>
            </button>
          </div>
        </div>

        {restoreStatus && (
          <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800">
            {restoreStatus}
          </div>
        )}
      </div>
    </div>
  );
};

