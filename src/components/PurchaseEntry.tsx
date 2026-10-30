import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  Building2,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { db } from '../db/db';
import { Medicine, Supplier, PurchaseOrder, PurchaseItem, Batch, StoreSettings } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { syncPurchaseToCloud, syncBatchToCloud } from '../firebase/firestoreService';

interface PurchaseEntryProps {
  settings: StoreSettings | null;
  onRefreshStats: () => void;
}

export const PurchaseEntry: React.FC<PurchaseEntryProps> = ({ settings, onRefreshStats }) => {
  const symbol = settings?.currencySymbol || '₹';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Line items for the current purchase
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Current item being entered
  const [selectedMedId, setSelectedMedId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [qty, setQty] = useState<number>(10);
  const [freeQty, setFreeQty] = useState<number>(0);
  const [purchaseRate, setPurchaseRate] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [saleRate, setSaleRate] = useState<number>(0);
  const [gstPercent, setGstPercent] = useState<number>(12);

  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    const sups = await db.suppliers.toArray();
    const meds = await db.medicines.toArray();
    const orders = await db.purchases.reverse().toArray();
    setSuppliers(sups);
    setMedicines(meds);
    setPurchases(orders);

    if (sups.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(sups[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When medicine changes, prefill default GST & MRP if batch exists
  const handleSelectMedicine = async (medId: string) => {
    setSelectedMedId(medId);
    const med = medicines.find((m) => m.id === medId);
    if (!med) return;

    setGstPercent(med.defaultGstPercent);

    // Look for previous batch to autofill rates
    const existingBatches = await db.batches.where('medicineId').equals(medId).toArray();
    if (existingBatches.length > 0) {
      const latest = existingBatches[existingBatches.length - 1];
      setPurchaseRate(latest.purchaseRate);
      setMrp(latest.mrp);
      setSaleRate(latest.saleRate);
      setBatchNumber(`B${Math.floor(10000 + Math.random() * 90000)}`);
    } else {
      setPurchaseRate(50);
      setMrp(75);
      setSaleRate(75);
      setBatchNumber(`B${Math.floor(10000 + Math.random() * 90000)}`);
    }

    const today = new Date();
    const expDate = new Date(today.getFullYear() + 2, today.getMonth(), 1);
    setExpiryDate(`${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`);
  };

  // Add line item to purchase table
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedId || !batchNumber || !expiryDate || qty <= 0) {
      alert('Please fill Medicine, Batch, Expiry, and Quantity.');
      return;
    }

    const med = medicines.find((m) => m.id === selectedMedId);
    if (!med) return;

    const taxableAmount = qty * purchaseRate;
    const gstAmount = taxableAmount * (gstPercent / 100);
    const totalAmount = taxableAmount + gstAmount;

    const newItem: PurchaseItem = {
      medicineId: med.id,
      medicineName: med.name,
      genericName: med.genericName,
      batchNumber: batchNumber.toUpperCase().trim(),
      expiryDate,
      qty,
      freeQty,
      purchaseRate,
      mrp,
      saleRate,
      gstPercent,
      taxableAmount: Number(taxableAmount.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
    };

    setItems([...items, newItem]);

    // Reset current item inputs
    setSelectedMedId('');
    setBatchNumber('');
    setQty(10);
    setFreeQty(0);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const totalGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
  const grandTotal = subtotal + totalGst;

  // Save Purchase & Automatically update Inventory Batches
  const handleSavePurchaseOrder = async () => {
    if (items.length === 0) {
      alert('Add at least one medicine item to the purchase invoice.');
      return;
    }
    if (!supplierInvoiceNo.trim()) {
      alert('Please enter Distributor Invoice No.');
      return;
    }

    setIsSaving(true);
    try {
      const supplier = suppliers.find((s) => s.id === selectedSupplierId);
      const purchaseCount = await db.purchases.count();
      const purchaseNo = `PO-${new Date().getFullYear()}-${String(purchaseCount + 1).padStart(4, '0')}`;

      const newOrder: PurchaseOrder = {
        id: `po-${Date.now()}`,
        purchaseNo,
        supplierId: selectedSupplierId,
        supplierName: supplier?.name || 'Distributor',
        supplierInvoiceNo: supplierInvoiceNo.trim(),
        date: purchaseDate,
        items: [...items],
        subtotal,
        totalGst,
        grandTotal,
        paymentStatus: 'paid',
        paidAmount: grandTotal,
        notes,
        createdAt: new Date().toISOString(),
      };

      // Transaction: save purchase and increment/create batches
      await db.transaction('rw', [db.purchases, db.batches], async () => {
        await db.purchases.put(newOrder);

        for (const item of items) {
          const totalReceived = item.qty + item.freeQty;

          // Check if batch already exists for this medicine and batch number
          const existingBatch = await db.batches
            .where('medicineId')
            .equals(item.medicineId)
            .and((b) => b.batchNumber === item.batchNumber)
            .first();

          if (existingBatch) {
            await db.batches.update(existingBatch.id, {
              stockQty: existingBatch.stockQty + totalReceived,
              purchaseRate: item.purchaseRate,
              mrp: item.mrp,
              saleRate: item.saleRate,
              expiryDate: item.expiryDate,
            });
          } else {
            const newBatch: Batch = {
              id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              medicineId: item.medicineId,
              medicineName: item.medicineName,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              purchaseRate: item.purchaseRate,
              mrp: item.mrp,
              saleRate: item.saleRate,
              stockQty: totalReceived,
              barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
              supplierId: selectedSupplierId,
              supplierName: supplier?.name,
              createdAt: new Date().toISOString(),
            };
            await db.batches.put(newBatch);
          }
        }
      });

      // Synchronize purchase order and updated batches with Firebase Cloud
      syncPurchaseToCloud(newOrder);
      for (const item of items) {
        db.batches
          .where('medicineId')
          .equals(item.medicineId)
          .and((b) => b.batchNumber === item.batchNumber)
          .first()
          .then((b) => {
            if (b) syncBatchToCloud(b);
          });
      }

      alert(`Purchase Order ${purchaseNo} recorded! Inventory stock has been automatically updated.`);
      setItems([]);
      setSupplierInvoiceNo('');
      setNotes('');
      await loadData();
      onRefreshStats();
    } catch (err) {
      console.error('Error saving purchase:', err);
      alert('Failed to save purchase order.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            Stock Inward & Purchase Entry
          </h2>
          <p className="text-xs text-slate-500">
            Record incoming shipments from distributors. Automatically updates inventory batches and stock counts.
          </p>
        </div>
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Form: Distributor Header & Add Line Items */}
        <div className="lg:col-span-8 space-y-4">
          {/* Distributor Invoice Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600" />
              Distributor / Wholesaler Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Supplier *</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Supplier Invoice / Bill No *
                </label>
                <input
                  type="text"
                  required
                  value={supplierInvoiceNo}
                  onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                  placeholder="e.g. AP-98421"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Add Medicine Line Item Box */}
          <form onSubmit={handleAddItem} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-600" />
              Add Inward Item to Purchase Bill
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Medicine *</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => handleSelectMedicine(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="">-- Choose Medicine Master --</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.genericName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Batch Number *</label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. B26001"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expiry (YYYY-MM) *</label>
                <input
                  type="month"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Free Qty (Bonus)</label>
                <input
                  type="number"
                  min="0"
                  value={freeQty}
                  onChange={(e) => setFreeQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cost Rate (ex. GST)</label>
                <input
                  type="number"
                  step="0.01"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">MRP</label>
                <input
                  type="number"
                  step="0.01"
                  value={mrp}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setMrp(v);
                    setSaleRate(v);
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sale Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={saleRate}
                  onChange={(e) => setSaleRate(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">GST %</label>
                <select
                  value={gstPercent}
                  onChange={(e) => setGstPercent(parseInt(e.target.value, 10))}
                  className="w-full text-xs px-2 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item to List</span>
              </button>
            </div>
          </form>

          {/* Items Inward Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-900 text-white text-xs font-bold flex justify-between">
              <span>Items to Inward ({items.length})</span>
              <span>Total Qty: {items.reduce((s, i) => s + i.qty + i.freeQty, 0)} units</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Medicine</th>
                    <th className="py-2 px-2">Batch / Exp</th>
                    <th className="py-2 px-2 text-center">Qty + Free</th>
                    <th className="py-2 px-2 text-right">Cost Rate</th>
                    <th className="py-2 px-2 text-right">MRP</th>
                    <th className="py-2 px-2 text-right">GST %</th>
                    <th className="py-2 px-2 text-right">Taxable</th>
                    <th className="py-2 px-2 text-right">Total</th>
                    <th className="py-2 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No inward items added yet. Choose a medicine and add it above.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-900">{item.medicineName}</td>
                        <td className="py-2 px-2 font-mono text-slate-700">
                          {item.batchNumber} ({item.expiryDate})
                        </td>
                        <td className="py-2 px-2 text-center font-bold">
                          {item.qty} {item.freeQty > 0 && <span className="text-emerald-600 font-normal">+{item.freeQty}</span>}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">{item.purchaseRate.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-500">{item.mrp.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono">{item.gstPercent}%</td>
                        <td className="py-2 px-2 text-right font-mono">{item.taxableAmount.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          {item.totalAmount.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Summary & Save Inward Box */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 sticky top-20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
              Purchase Invoice Summary
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Distributor:</span>
                <span className="font-semibold text-slate-800">
                  {suppliers.find((s) => s.id === selectedSupplierId)?.name || 'None'}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Bill Number:</span>
                <span className="font-mono font-bold text-slate-800">{supplierInvoiceNo || '-'}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Taxable Subtotal:</span>
                <span className="font-mono">{formatCurrency(subtotal, symbol)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>GST Tax (Input Credit):</span>
                <span className="font-mono">{formatCurrency(totalGst, symbol)}</span>
              </div>

              <div className="mt-3 p-3.5 bg-slate-900 rounded-xl text-white">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Purchase Value</div>
                <div className="text-2xl font-black font-mono mt-0.5 text-emerald-400">
                  {formatCurrency(grandTotal, symbol)}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / LR No.</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Transport details, LR number, etc."
                rows={2}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg"
              />
            </div>

            <button
              onClick={handleSavePurchaseOrder}
              disabled={items.length === 0 || isSaving}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>CONFIRM STOCK INWARD</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inward History Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Recent Inward Purchase Bills ({purchases.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-2">Purchase No</th>
                <th className="py-2 px-2">Distributor</th>
                <th className="py-2 px-2 font-mono">Invoice No</th>
                <th className="py-2 px-2 text-center">Items</th>
                <th className="py-2 px-2 text-right">Taxable</th>
                <th className="py-2 px-2 text-right">GST</th>
                <th className="py-2 px-3 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No inward bills recorded yet.
                  </td>
                </tr>
              ) : (
                purchases.slice(0, 10).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-600">{formatDate(p.date)}</td>
                    <td className="py-2 px-2 font-mono font-bold text-slate-800">{p.purchaseNo}</td>
                    <td className="py-2 px-2 font-medium text-slate-900">{p.supplierName}</td>
                    <td className="py-2 px-2 font-mono text-slate-700">{p.supplierInvoiceNo}</td>
                    <td className="py-2 px-2 text-center">{p.items.length} items</td>
                    <td className="py-2 px-2 text-right font-mono">{formatCurrency(p.subtotal, symbol)}</td>
                    <td className="py-2 px-2 text-right font-mono text-slate-500">
                      {formatCurrency(p.totalGst, symbol)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                      {formatCurrency(p.grandTotal, symbol)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

