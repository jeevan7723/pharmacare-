import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
  Check,
  MapPin,
  Calendar,
  Layers,
  ArrowUpDown,
  IndianRupee,
} from 'lucide-react';
import { db } from '../db/db';
import { Medicine, Batch, MedicineCategory, ScheduleType, StoreSettings } from '../types';
import { formatCurrency, checkExpiryStatus } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';
import {
  syncMedicineToCloud,
  deleteMedicineFromCloud,
  syncBatchToCloud,
  deleteBatchFromCloud,
} from '../firebase/firestoreService';

const CATEGORIES: MedicineCategory[] = [
  'Tablets',
  'Capsules',
  'Syrups & Suspensions',
  'Injections',
  'Ointments & Creams',
  'Drops (Eye/Ear)',
  'Inhalers & Respiratory',
  'Medical Devices & First Aid',
  'Nutraceuticals & Vitamins',
  'Baby Care',
  'Personal Care',
];

const SCHEDULES: ScheduleType[] = ['OTC', 'Schedule H', 'Schedule H1', 'Schedule X', 'Narcotic'];

interface InventoryProps {
  settings: StoreSettings | null;
  onRefreshStats: () => void;
}

export const InventoryManagement: React.FC<InventoryProps> = ({ settings, onRefreshStats }) => {
  const symbol = settings?.currencySymbol || '₹';
  const { t, language } = useLanguage();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('all');
  const [selectedRack, setSelectedRack] = useState<string>('all');

  // Add / Edit Medicine Modal
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [initialStockQty, setInitialStockQty] = useState<number>(50);
  const [initialBatchNo, setInitialBatchNo] = useState<string>('');
  const [medForm, setMedForm] = useState<Partial<Medicine>>({
    name: '',
    genericName: '',
    manufacturer: '',
    category: 'Tablets',
    rack: 'Rack A',
    shelf: 'Shelf 1',
    hsnCode: '30049099',
    schedule: 'OTC',
    unit: 'Strip',
    packSize: 10,
    minStockAlert: 15,
    defaultGstPercent: 12,
    mrp: 0,
    saleRate: 0,
    purchaseRate: 0,
  });

  // Add Batch Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [targetMedForBatch, setTargetMedForBatch] = useState<Medicine | null>(null);
  const [batchForm, setBatchForm] = useState<Partial<Batch>>({
    batchNumber: '',
    expiryDate: '',
    purchaseRate: 0,
    mrp: 0,
    saleRate: 0,
    stockQty: 50,
    barcode: '',
  });

  const medDialogRef = useRef<HTMLDialogElement>(null);
  const batchDialogRef = useRef<HTMLDialogElement>(null);

  const loadData = async () => {
    const m = await db.medicines.toArray();
    const b = await db.batches.toArray();
    setMedicines(m);
    setBatches(b);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to extract pricing info for a medicine
  const getMedicinePricing = (med: Medicine, medBatches: Batch[]) => {
    if (medBatches.length > 0) {
      const mrps = medBatches.map((b) => b.mrp).filter((p) => typeof p === 'number' && p > 0);
      const saleRates = medBatches.map((b) => b.saleRate).filter((p) => typeof p === 'number' && p > 0);
      const purchaseRates = medBatches.map((b) => b.purchaseRate).filter((p) => typeof p === 'number' && p > 0);

      const minMrp = mrps.length > 0 ? Math.min(...mrps) : (med.mrp || 0);
      const maxMrp = mrps.length > 0 ? Math.max(...mrps) : (med.mrp || 0);
      const minSale = saleRates.length > 0 ? Math.min(...saleRates) : (med.saleRate || 0);
      const maxSale = saleRates.length > 0 ? Math.max(...saleRates) : (med.saleRate || 0);

      const latestBatch = medBatches[medBatches.length - 1];

      return {
        hasBatches: true,
        mrpRange: minMrp !== maxMrp ? { min: minMrp, max: maxMrp } : null,
        primaryMrp: latestBatch?.mrp || med.mrp || minMrp,
        saleRate: latestBatch?.saleRate || med.saleRate || minSale,
        purchaseRate: latestBatch?.purchaseRate || med.purchaseRate || (purchaseRates[0] || 0),
      };
    }

    return {
      hasBatches: false,
      mrpRange: null,
      primaryMrp: med.mrp || 0,
      saleRate: med.saleRate || med.mrp || 0,
      purchaseRate: med.purchaseRate || 0,
    };
  };

  // Filter medicines
  const filteredMeds = medicines.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.genericName.toLowerCase().includes(search.toLowerCase()) ||
      m.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
      m.rack.toLowerCase().includes(search.toLowerCase());

    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
    const matchesSched = selectedSchedule === 'all' || m.schedule === selectedSchedule;
    const matchesRack = selectedRack === 'all' || m.rack === selectedRack;

    return matchesSearch && matchesCat && matchesSched && matchesRack;
  });

  const uniqueRacks = Array.from(new Set(medicines.map((m) => m.rack))).sort();
  const totalStockUnits = batches.reduce((sum, b) => sum + (b.stockQty || 0), 0);
  const totalStockValuation = batches.reduce((sum, b) => sum + ((b.stockQty || 0) * (b.mrp || 0)), 0);

  // Open Add Medicine Modal
  const openAddMedModal = () => {
    setEditingMedId(null);
    setMedForm({
      name: '',
      genericName: '',
      manufacturer: '',
      category: 'Tablets',
      rack: 'Rack A',
      shelf: 'Shelf 1',
      hsnCode: '30049099',
      schedule: 'OTC',
      unit: 'Strip',
      packSize: 10,
      minStockAlert: 15,
      defaultGstPercent: 12,
      mrp: 0,
      saleRate: 0,
      purchaseRate: 0,
    });
    setInitialStockQty(50);
    setInitialBatchNo(`B${Math.floor(10000 + Math.random() * 90000)}`);
    setIsMedModalOpen(true);
    medDialogRef.current?.showModal();
  };

  // Open Edit Medicine Modal
  const openEditMedModal = (m: Medicine) => {
    const medBatches = batches.filter((b) => b.medicineId === m.id);
    const pricing = getMedicinePricing(m, medBatches);
    setEditingMedId(m.id);
    setMedForm({
      ...m,
      mrp: m.mrp || pricing.primaryMrp || 0,
      saleRate: m.saleRate || pricing.saleRate || 0,
      purchaseRate: m.purchaseRate || pricing.purchaseRate || 0,
    });
    setIsMedModalOpen(true);
    medDialogRef.current?.showModal();
  };

  const closeMedModal = () => {
    setIsMedModalOpen(false);
    medDialogRef.current?.close();
  };

  // Save Medicine
  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medForm.name || !medForm.genericName) {
      alert('Please enter Medicine Name and Generic Salt.');
      return;
    }

    const mrp = Number(medForm.mrp) || 0;
    const saleRate = Number(medForm.saleRate) || mrp;
    const purchaseRate = Number(medForm.purchaseRate) || 0;

    if (editingMedId) {
      const updatedMed: Partial<Medicine> = {
        ...medForm,
        mrp,
        saleRate,
        purchaseRate,
      };
      await db.medicines.update(editingMedId, updatedMed);
      const updated = await db.medicines.get(editingMedId);
      if (updated) syncMedicineToCloud(updated);

      // If user updated price and batches exist, keep batch price updated
      const existingBatches = await db.batches.where('medicineId').equals(editingMedId).toArray();
      if (existingBatches.length > 0 && mrp > 0) {
        for (const b of existingBatches) {
          if (b.mrp === 0 || existingBatches.length === 1) {
            await db.batches.update(b.id, {
              mrp,
              saleRate,
              purchaseRate: purchaseRate || b.purchaseRate,
            });
            const updatedB = await db.batches.get(b.id);
            if (updatedB) syncBatchToCloud(updatedB);
          }
        }
      } else if (existingBatches.length === 0 && (mrp > 0 || initialStockQty > 0)) {
        // Create initial batch if medicine had none
        const today = new Date();
        const expDate = new Date(today.getFullYear() + 2, today.getMonth(), 1);
        const expStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
        const autoBatch: Batch = {
          id: `batch-${Date.now()}`,
          medicineId: editingMedId,
          medicineName: updated?.name || medForm.name || '',
          batchNumber: `B${Math.floor(10000 + Math.random() * 90000)}`,
          expiryDate: expStr,
          purchaseRate,
          mrp,
          saleRate,
          stockQty: initialStockQty || 0,
          barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
          createdAt: new Date().toISOString(),
        };
        await db.batches.put(autoBatch);
        syncBatchToCloud(autoBatch);
      }
    } else {
      const newMedId = `med-${Date.now()}`;
      const newMed: Medicine = {
        ...(medForm as Medicine),
        id: newMedId,
        mrp,
        saleRate,
        purchaseRate,
        createdAt: new Date().toISOString(),
      };
      await db.medicines.put(newMed);
      syncMedicineToCloud(newMed);

      // Automatically create the initial batch so medicine has price & stock in POS immediately
      if (mrp > 0 || initialStockQty > 0) {
        const today = new Date();
        const expDate = new Date(today.getFullYear() + 2, today.getMonth(), 1);
        const expStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
        const autoBatch: Batch = {
          id: `batch-${Date.now()}`,
          medicineId: newMedId,
          medicineName: newMed.name,
          batchNumber: initialBatchNo.trim() || `B${Math.floor(10000 + Math.random() * 90000)}`,
          expiryDate: expStr,
          purchaseRate,
          mrp,
          saleRate,
          stockQty: initialStockQty || 0,
          barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
          createdAt: new Date().toISOString(),
        };
        await db.batches.put(autoBatch);
        syncBatchToCloud(autoBatch);
      }
    }

    closeMedModal();
    await loadData();
    onRefreshStats();
  };

  // Delete Medicine
  const handleDeleteMedicine = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name} and all its batches?`)) return;
    await db.transaction('rw', [db.medicines, db.batches], async () => {
      await db.medicines.delete(id);
      await db.batches.where('medicineId').equals(id).delete();
    });
    deleteMedicineFromCloud(id);
    await loadData();
    onRefreshStats();
  };

  // Open Add Batch Modal
  const openAddBatchModal = (med: Medicine) => {
    setTargetMedForBatch(med);
    const medBatches = batches.filter((b) => b.medicineId === med.id);
    const pricing = getMedicinePricing(med, medBatches);
    const defaultMrp = pricing.primaryMrp || med.mrp || 80;
    const defaultSale = pricing.saleRate || med.saleRate || defaultMrp;
    const defaultPurchase = pricing.purchaseRate || med.purchaseRate || 50;

    const today = new Date();
    // Default expiry 18-24 months ahead
    const expDate = new Date(today.getFullYear() + 2, today.getMonth(), 1);
    const expStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;

    setBatchForm({
      medicineId: med.id,
      medicineName: med.name,
      batchNumber: `B${Math.floor(10000 + Math.random() * 90000)}`,
      expiryDate: expStr,
      purchaseRate: defaultPurchase,
      mrp: defaultMrp,
      saleRate: defaultSale,
      stockQty: 50,
      barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
    });

    setIsBatchModalOpen(true);
    batchDialogRef.current?.showModal();
  };

  const closeBatchModal = () => {
    setIsBatchModalOpen(false);
    batchDialogRef.current?.close();
  };

  // Save Batch
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMedForBatch || !batchForm.batchNumber || !batchForm.expiryDate) {
      alert('Please enter Batch Number and Expiry Date (YYYY-MM).');
      return;
    }

    const newBatch: Batch = {
      ...(batchForm as Batch),
      id: `batch-${Date.now()}`,
      medicineId: targetMedForBatch.id,
      medicineName: targetMedForBatch.name,
      createdAt: new Date().toISOString(),
    };

    await db.batches.put(newBatch);
    syncBatchToCloud(newBatch);
    closeBatchModal();
    await loadData();
    onRefreshStats();
  };

  // Delete individual batch
  const handleDeleteBatch = async (batchId: string, batchNo: string) => {
    if (!confirm(`Delete batch ${batchNo}?`)) return;
    await db.batches.delete(batchId);
    deleteBatchFromCloud(batchId);
    await loadData();
    onRefreshStats();
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Top Action Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            {t('inv.title', 'Pharmacy Inventory & Rack Locator')}
          </h2>
          <p className="text-xs text-slate-500">
            {medicines.length} {t('dash.medicines', 'Medicines')} &bull; {batches.length} {t('dash.batches', 'Batches')} &bull; {totalStockUnits} {t('dash.units_in_stock', 'units in stock')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddMedModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('inv.add_medicine', 'Add New Medicine Master')}</span>
          </button>
        </div>
      </div>

      {/* Stock & Valuation Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('dash.medicines', 'Medicines')}</div>
            <div className="text-base font-bold text-slate-900 font-mono">{medicines.length}</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Racks & Locations</div>
            <div className="text-base font-bold text-slate-900 font-mono">{uniqueRacks.length} Racks</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('inv.col_stock', 'Total Stock')}</div>
            <div className="text-base font-bold text-slate-900 font-mono">{totalStockUnits} Units</div>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('inv.stock_value', 'Stock Valuation (MRP)')}</div>
            <div className="text-base font-bold text-teal-700 font-mono">{formatCurrency(totalStockValuation, symbol)}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicine, salt, rack..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
        >
          <option value="all">All Categories ({CATEGORIES.length})</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={selectedSchedule}
          onChange={(e) => setSelectedSchedule(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
        >
          <option value="all">All Schedules (OTC & Rx)</option>
          {SCHEDULES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={selectedRack}
          onChange={(e) => setSelectedRack(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
        >
          <option value="all">All Racks / Storage ({uniqueRacks.length})</option>
          {uniqueRacks.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">{t('inv.col_name', 'Medicine Name & Formulation')}</th>
                <th className="py-3 px-2">{t('inv.col_category', 'Category')}</th>
                <th className="py-3 px-2">{t('inv.col_rack', 'Rack Location')}</th>
                <th className="py-3 px-2">Schedule / HSN</th>
                <th className="py-3 px-2 text-center">Pack</th>
                <th className="py-3 px-3 text-right">{t('inv.col_price', 'Price / MRP')}</th>
                <th className="py-3 px-2">{t('inv.col_batches', 'Active Batches (Stock / Exp / Price)')}</th>
                <th className="py-3 px-2 text-center">{t('inv.col_stock', 'Total Stock')}</th>
                <th className="py-3 px-3 text-right">{t('inv.col_actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMeds.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No medicines match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMeds.map((med) => {
                  const medBatches = batches.filter((b) => b.medicineId === med.id);
                  const totalStock = medBatches.reduce((sum, b) => sum + b.stockQty, 0);
                  const isLowStock = totalStock <= med.minStockAlert;
                  const pricing = getMedicinePricing(med, medBatches);

                  return (
                    <tr key={med.id} className="hover:bg-slate-50">
                      {/* Name & Generic */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-sm">{med.name}</div>
                        <div className="text-[11px] text-emerald-800 font-medium">{med.genericName}</div>
                        <div className="text-[10px] text-slate-400">{med.manufacturer}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {med.category}
                        </span>
                      </td>

                      {/* Rack & Shelf */}
                      <td className="py-3 px-2 font-mono text-slate-700">
                        <div className="flex items-center gap-1 text-slate-800 font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          <span>{med.rack}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{med.shelf}</div>
                      </td>

                      {/* Schedule & HSN */}
                      <td className="py-3 px-2">
                        <div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              med.schedule === 'Schedule H' || med.schedule === 'Schedule H1'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {med.schedule}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-1">HSN: {med.hsnCode}</div>
                      </td>

                      {/* Pack Size */}
                      <td className="py-3 px-2 text-center">
                        <div className="font-bold text-slate-800">{med.packSize}</div>
                        <div className="text-[10px] text-slate-500">{med.unit}</div>
                      </td>

                      {/* Price / MRP Column */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          {pricing.mrpRange ? (
                            <span>
                              {formatCurrency(pricing.mrpRange.min, symbol)} - {formatCurrency(pricing.mrpRange.max, symbol)}
                            </span>
                          ) : pricing.primaryMrp > 0 ? (
                            <span>{formatCurrency(pricing.primaryMrp, symbol)}</span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Not set</span>
                          )}
                        </div>
                        {pricing.saleRate > 0 && pricing.saleRate !== pricing.primaryMrp && (
                          <div className="text-[10px] text-emerald-700 font-bold font-mono">
                            Sale: {formatCurrency(pricing.saleRate, symbol)}
                          </div>
                        )}
                        {pricing.purchaseRate > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cost: {formatCurrency(pricing.purchaseRate, symbol)}
                          </div>
                        )}
                      </td>

                      {/* Batches Pill List with Price */}
                      <td className="py-3 px-2">
                        {medBatches.length === 0 ? (
                          <span className="text-[10px] text-red-500 italic">No batches created</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-sm">
                            {medBatches.map((b) => {
                              const exp = checkExpiryStatus(b.expiryDate);
                              return (
                                <div
                                  key={b.id}
                                  className="text-[10px] px-2 py-0.5 rounded-lg border border-slate-200 bg-white flex items-center gap-1.5 group relative shadow-2xs hover:border-emerald-400 transition-colors"
                                >
                                  <span className="font-mono font-bold text-slate-700">B:{b.batchNumber}</span>
                                  <span className={`px-1 rounded text-[9px] ${exp.badgeClass}`}>
                                    {b.expiryDate}
                                  </span>
                                  <span className="font-semibold text-slate-900">({b.stockQty})</span>
                                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1 rounded text-[10px]">
                                    {formatCurrency(b.saleRate || b.mrp, symbol)}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteBatch(b.id, b.batchNumber)}
                                    className="hidden group-hover:inline-block text-red-400 hover:text-red-600 ml-0.5"
                                    title="Delete batch"
                                  >
                                    &times;
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Total Stock */}
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`font-black text-sm px-2 py-0.5 rounded ${
                            isLowStock
                              ? 'bg-red-100 text-red-700 border border-red-300 animate-pulse'
                              : 'text-slate-800'
                          }`}
                        >
                          {totalStock}
                        </span>
                        {isLowStock && (
                          <div className="text-[9px] text-red-600 font-bold mt-0.5">Low Stock!</div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openAddBatchModal(med)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold flex items-center gap-1"
                            title="Add new batch"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+Batch</span>
                          </button>
                          <button
                            onClick={() => openEditMedModal(med)}
                            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                            title="Edit Medicine"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMedicine(med.id, med.name)}
                            className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                            title="Delete Medicine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ================= ADD / EDIT MEDICINE DIALOG ================= */}
      <dialog
        ref={medDialogRef}
        aria-labelledby="med-dialog-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-2xl w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <h2 id="med-dialog-title" className="text-base font-bold">
            {editingMedId ? 'Edit Medicine Master' : 'Add New Medicine to Master'}
          </h2>
          <button onClick={closeMedModal} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveMedicine} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand / Product Name *</label>
              <input
                type="text"
                required
                autoFocus
                value={medForm.name || ''}
                onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                placeholder="e.g. Dolo 650 Tablet"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Generic Name / Composition *</label>
              <input
                type="text"
                required
                value={medForm.genericName || ''}
                onChange={(e) => setMedForm({ ...medForm, genericName: e.target.value })}
                placeholder="e.g. Paracetamol (650mg)"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Manufacturer</label>
              <input
                type="text"
                value={medForm.manufacturer || ''}
                onChange={(e) => setMedForm({ ...medForm, manufacturer: e.target.value })}
                placeholder="e.g. Cipla, Sun Pharma"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={medForm.category}
                onChange={(e) => setMedForm({ ...medForm, category: e.target.value as MedicineCategory })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Drug Schedule</label>
              <select
                value={medForm.schedule}
                onChange={(e) => setMedForm({ ...medForm, schedule: e.target.value as ScheduleType })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {SCHEDULES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rack / Storage Location</label>
              <input
                type="text"
                value={medForm.rack || ''}
                onChange={(e) => setMedForm({ ...medForm, rack: e.target.value })}
                placeholder="e.g. Rack A"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shelf / Bin</label>
              <input
                type="text"
                value={medForm.shelf || ''}
                onChange={(e) => setMedForm({ ...medForm, shelf: e.target.value })}
                placeholder="e.g. Shelf 1"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">HSN Code</label>
              <input
                type="text"
                value={medForm.hsnCode || ''}
                onChange={(e) => setMedForm({ ...medForm, hsnCode: e.target.value })}
                placeholder="30049099"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">GST %</label>
              <select
                value={medForm.defaultGstPercent}
                onChange={(e) => setMedForm({ ...medForm, defaultGstPercent: parseInt(e.target.value, 10) })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono"
              >
                <option value={0}>0% (Exempted)</option>
                <option value={5}>5%</option>
                <option value={12}>12% (Standard Pharma)</option>
                <option value={18}>18% (Devices/Sanitizers)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
              <input
                type="text"
                value={medForm.unit || ''}
                onChange={(e) => setMedForm({ ...medForm, unit: e.target.value })}
                placeholder="Strip, Bottle, Tube"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pack Size (Qty per pack)</label>
              <input
                type="number"
                min="1"
                value={medForm.packSize || 10}
                onChange={(e) => setMedForm({ ...medForm, packSize: parseInt(e.target.value, 10) || 1 })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Low Stock Alert Threshold</label>
              <input
                type="number"
                min="1"
                value={medForm.minStockAlert || 10}
                onChange={(e) => setMedForm({ ...medForm, minStockAlert: parseInt(e.target.value, 10) || 1 })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Medicine Pricing & Rates Section */}
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wider">
              <IndianRupee className="w-4 h-4 text-emerald-700" />
              <span>{t('inv.pricing_section', 'Medicine Pricing & Rates')}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  MRP ({symbol}) *
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">{symbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={medForm.mrp || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setMedForm({
                        ...medForm,
                        mrp: val,
                        saleRate: (!medForm.saleRate || medForm.saleRate === medForm.mrp) ? val : medForm.saleRate,
                      });
                    }}
                    placeholder="0.00"
                    className="w-full text-xs pl-7 pr-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                <span className="text-[10px] text-slate-500">Maximum Retail Price</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sale Rate ({symbol}) *
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">{symbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={medForm.saleRate || ''}
                    onChange={(e) => setMedForm({ ...medForm, saleRate: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full text-xs pl-7 pr-3 py-2 border border-slate-300 rounded-lg font-mono font-bold focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                <span className="text-[10px] text-slate-500">Customer billing rate</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Purchase Rate ({symbol})
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">{symbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={medForm.purchaseRate || ''}
                    onChange={(e) => setMedForm({ ...medForm, purchaseRate: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full text-xs pl-7 pr-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                <span className="text-[10px] text-slate-500">Cost from distributor</span>
              </div>
            </div>

            {!editingMedId && (
              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-emerald-200/70">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('inv.initial_stock', 'Initial Stock Quantity')} (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={initialStockQty}
                    onChange={(e) => setInitialStockQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-500">Creates first batch automatically</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('inv.initial_batch', 'Initial Batch Number')}
                  </label>
                  <input
                    type="text"
                    value={initialBatchNo}
                    onChange={(e) => setInitialBatchNo(e.target.value.toUpperCase())}
                    placeholder="e.g. B2601"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold uppercase bg-white"
                  />
                  <span className="text-[10px] text-slate-500">Batch identifier on strip</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-100 -mx-6 -mb-6 p-4 flex justify-end space-x-2 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={closeMedModal}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md"
            >
              Save Medicine
            </button>
          </div>
        </form>
      </dialog>

      {/* ================= ADD BATCH DIALOG ================= */}
      <dialog
        ref={batchDialogRef}
        aria-labelledby="batch-dialog-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-lg w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 id="batch-dialog-title" className="text-base font-bold">
              Add New Stock Batch
            </h2>
            <p className="text-xs text-slate-400">{targetMedForBatch?.name}</p>
          </div>
          <button onClick={closeBatchModal} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveBatch} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Batch Number *</label>
              <input
                type="text"
                required
                autoFocus
                value={batchForm.batchNumber || ''}
                onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value.toUpperCase() })}
                placeholder="e.g. DL26K01"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date (YYYY-MM) *</label>
              <input
                type="month"
                required
                value={batchForm.expiryDate || ''}
                onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Rate</label>
              <input
                type="number"
                step="0.01"
                value={batchForm.purchaseRate || 0}
                onChange={(e) => setBatchForm({ ...batchForm, purchaseRate: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">MRP *</label>
              <input
                type="number"
                step="0.01"
                required
                value={batchForm.mrp || 0}
                onChange={(e) => {
                  const mrpVal = parseFloat(e.target.value) || 0;
                  setBatchForm({ ...batchForm, mrp: mrpVal, saleRate: mrpVal });
                }}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sale Rate *</label>
              <input
                type="number"
                step="0.01"
                required
                value={batchForm.saleRate || 0}
                onChange={(e) => setBatchForm({ ...batchForm, saleRate: parseFloat(e.target.value) || 0 })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Stock Quantity (Units) *</label>
              <input
                type="number"
                min="0"
                required
                value={batchForm.stockQty || 0}
                onChange={(e) => setBatchForm({ ...batchForm, stockQty: parseInt(e.target.value, 10) || 0 })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Barcode / SKU</label>
              <input
                type="text"
                value={batchForm.barcode || ''}
                onChange={(e) => setBatchForm({ ...batchForm, barcode: e.target.value })}
                placeholder="Scan or leave blank"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="bg-slate-100 -mx-6 -mb-6 p-4 flex justify-end space-x-2 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={closeBatchModal}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md"
            >
              Add Batch Stock
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};
