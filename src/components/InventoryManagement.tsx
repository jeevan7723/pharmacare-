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
  LogOut,
} from 'lucide-react';
import { db } from '../db/db';
import { Medicine, Batch, MedicineCategory, ScheduleType, StoreSettings } from '../types';
import { formatCurrency, checkExpiryStatus } from '../utils/formatters';
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
  onExit?: () => void;
}

export const InventoryManagement: React.FC<InventoryProps> = ({ settings, onRefreshStats, onExit }) => {
  const symbol = settings?.currencySymbol || '₹';

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('all');
  const [selectedRack, setSelectedRack] = useState<string>('all');

  // Add / Edit Medicine Modal
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
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
    });
    setIsMedModalOpen(true);
    medDialogRef.current?.showModal();
  };

  // Open Edit Medicine Modal
  const openEditMedModal = (m: Medicine) => {
    setEditingMedId(m.id);
    setMedForm(m);
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

    if (editingMedId) {
      await db.medicines.update(editingMedId, medForm);
      const updated = await db.medicines.get(editingMedId);
      if (updated) syncMedicineToCloud(updated);
    } else {
      const newMed: Medicine = {
        ...(medForm as Medicine),
        id: `med-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      await db.medicines.put(newMed);
      syncMedicineToCloud(newMed);
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
    const today = new Date();
    // Default expiry 18 months ahead
    const expDate = new Date(today.getFullYear() + 2, today.getMonth(), 1);
    const expStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;

    setBatchForm({
      medicineId: med.id,
      medicineName: med.name,
      batchNumber: `B${Math.floor(10000 + Math.random() * 90000)}`,
      expiryDate: expStr,
      purchaseRate: 50,
      mrp: 80,
      saleRate: 80,
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
            Pharmacy Inventory & Rack Locator
          </h2>
          <p className="text-xs text-slate-500">
            {medicines.length} Medicines &bull; {batches.length} Stock Batches in Store
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
              title="Exit Inventory"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>Exit</span>
            </button>
          )}

          <button
            onClick={openAddMedModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Medicine Master</span>
          </button>
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
                <th className="py-3 px-3">Medicine Name & Formulation</th>
                <th className="py-3 px-2">Category</th>
                <th className="py-3 px-2">Rack Location</th>
                <th className="py-3 px-2">Schedule / HSN</th>
                <th className="py-3 px-2 text-center">Pack</th>
                <th className="py-3 px-2">Active Batches (Stock / Exp)</th>
                <th className="py-3 px-2 text-center">Total Stock</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMeds.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No medicines match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMeds.map((med) => {
                  const medBatches = batches.filter((b) => b.medicineId === med.id);
                  const totalStock = medBatches.reduce((sum, b) => sum + b.stockQty, 0);
                  const isLowStock = totalStock <= med.minStockAlert;

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

                      {/* Batches Pill List */}
                      <td className="py-3 px-2">
                        {medBatches.length === 0 ? (
                          <span className="text-[10px] text-red-500 italic">No batches created</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {medBatches.map((b) => {
                              const exp = checkExpiryStatus(b.expiryDate);
                              return (
                                <div
                                  key={b.id}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white flex items-center gap-1 group relative shadow-2xs"
                                >
                                  <span className="font-mono font-bold text-slate-700">B:{b.batchNumber}</span>
                                  <span className={`px-1 rounded text-[9px] ${exp.badgeClass}`}>
                                    {b.expiryDate}
                                  </span>
                                  <span className="font-semibold text-slate-900">({b.stockQty})</span>
                                  <button
                                    onClick={() => handleDeleteBatch(b.id, b.batchNumber)}
                                    className="hidden group-hover:inline-block text-red-400 hover:text-red-600 ml-1"
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
