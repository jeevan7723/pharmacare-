import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  Building2,
  ArrowRight,
  X,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { db } from '../db/db';
import { Medicine, Supplier, PurchaseOrder, PurchaseItem, Batch, StoreSettings, Workspace } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { syncPurchaseToCloud, syncBatchToCloud, syncSupplierToCloud } from '../firebase/firestoreService';
import { useLanguage } from '../context/LanguageContext';

interface PurchaseEntryProps {
  settings: StoreSettings | null;
  currentWorkspace?: Workspace | null;
  onRefreshStats: () => void;
}

export const PurchaseEntry: React.FC<PurchaseEntryProps> = ({
  settings,
  currentWorkspace,
  onRefreshStats,
}) => {
  const symbol = currentWorkspace?.settings.currencySymbol || settings?.currencySymbol || '₹';
  const targetWsId = currentWorkspace?.id || 'ws_healthplus';
  const { t, language } = useLanguage();

  const industry = currentWorkspace?.industry || 'pharmacy';
  const isPharmacy = industry === 'pharmacy';
  const isGrocery = industry === 'grocery';
  const isTech = industry === 'electronics';
  const isFashion = industry === 'clothing';

  const terms = {
    supplierCardTitle: isPharmacy
      ? 'Distributor / Wholesaler Details'
      : isGrocery
      ? 'FMCG Supplier / Wholesaler Details'
      : isTech
      ? 'Tech Vendor / Distributor Details'
      : isFashion
      ? 'Textile / Apparel Vendor Details'
      : 'Supplier / Vendor Details',
    supplierLabel: isPharmacy
      ? 'Distributor / Supplier'
      : isGrocery
      ? 'Grocery Supplier'
      : isTech
      ? 'Hardware Vendor'
      : isFashion
      ? 'Garment Supplier'
      : 'Supplier',
    addSupplierBtn: isPharmacy
      ? '+ Add Distributor'
      : isGrocery
      ? '+ Add FMCG Supplier'
      : isTech
      ? '+ Add Tech Vendor'
      : isFashion
      ? '+ Add Apparel Vendor'
      : '+ Add Supplier',
    modalTitle: isPharmacy
      ? 'Add New Distributor / Wholesaler Master'
      : isGrocery
      ? 'Add New FMCG Supplier / Wholesaler'
      : isTech
      ? 'Add New Technology Vendor / Distributor'
      : isFashion
      ? 'Add New Textile / Garment Vendor'
      : 'Add New Supplier',
    itemTitle: isPharmacy
      ? 'Add Inward Medicine to Purchase Bill'
      : isGrocery
      ? 'Add Inward Grocery Item to Purchase Bill'
      : isTech
      ? 'Add Inward Electronic Device to Purchase Bill'
      : isFashion
      ? 'Add Inward Apparel Product to Purchase Bill'
      : 'Add Inward Item to Purchase Bill',
    itemSelectLabel: isPharmacy
      ? 'Medicine *'
      : isGrocery
      ? 'Grocery Product *'
      : isTech
      ? 'Electronic Product *'
      : isFashion
      ? 'Fashion Product *'
      : 'Product / Item *',
    itemPlaceholder: isPharmacy
      ? '-- Choose Medicine Master --'
      : isGrocery
      ? '-- Choose Grocery Item --'
      : isTech
      ? '-- Choose Electronic Product --'
      : isFashion
      ? '-- Choose Apparel Item --'
      : '-- Choose Product --',
    batchLabel: isPharmacy
      ? 'Batch Number *'
      : isGrocery
      ? 'Lot / Batch No *'
      : isTech
      ? 'Serial / SKU / Lot *'
      : isFashion
      ? 'Lot / Batch Code *'
      : 'Batch / Lot No *',
    batchPlaceholder: isPharmacy
      ? 'e.g. B26001'
      : isGrocery
      ? 'e.g. LOT-2026-A'
      : isTech
      ? 'e.g. SKU-TECH-01'
      : isFashion
      ? 'e.g. LOT-FABRIC-01'
      : 'e.g. B101',
    expiryLabel: isPharmacy
      ? 'Expiry (YYYY-MM) *'
      : isGrocery
      ? 'Best Before / Expiry *'
      : isTech
      ? 'Mfg / Import Date *'
      : isFashion
      ? 'Packing Date *'
      : 'Expiry / Date *',
    colItemName: isPharmacy
      ? 'Medicine'
      : isGrocery
      ? 'Grocery Product'
      : isTech
      ? 'Electronic Device'
      : isFashion
      ? 'Fashion Apparel'
      : 'Product',
    colBatchExpiry: isPharmacy ? 'Batch / Exp' : 'Lot / Date',
    summaryDistributorLabel: isPharmacy
      ? 'Distributor:'
      : isGrocery
      ? 'Grocery Supplier:'
      : isTech
      ? 'Tech Vendor:'
      : isFashion
      ? 'Apparel Vendor:'
      : 'Supplier / Vendor:',
    noItemsText: isPharmacy
      ? 'No inward items added yet. Choose a medicine and add it above.'
      : isGrocery
      ? 'No inward items added yet. Choose a grocery product and add it above.'
      : isTech
      ? 'No inward items added yet. Choose an electronic item and add it above.'
      : isFashion
      ? 'No inward items added yet. Choose a fashion item and add it above.'
      : 'No inward items added yet. Choose a product and add it above.',
  };

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Add Supplier Modal state
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState<Partial<Supplier>>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstin: '',
    dlNo: '',
    address: '',
    balance: 0,
  });
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);

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
    const allSups = await db.suppliers.toArray();
    const allMeds = await db.medicines.toArray();
    const allOrders = await db.purchases.reverse().toArray();

    // Filter suppliers specifically by current workspace
    const sups = allSups.filter((s) => (s.workspaceId || 'ws_healthplus') === targetWsId);
    const meds = allMeds.filter((m) => (m.workspaceId || 'ws_healthplus') === targetWsId);
    const orders = allOrders.filter((o) => (o.workspaceId || 'ws_healthplus') === targetWsId);

    setSuppliers(sups);
    setMedicines(meds);
    setPurchases(orders);

    if (sups.length > 0) {
      if (!selectedSupplierId || !sups.some((s) => s.id === selectedSupplierId)) {
        setSelectedSupplierId(sups[0].id);
      }
    } else {
      setSelectedSupplierId('');
    }
  };

  useEffect(() => {
    loadData();
  }, [targetWsId]);

  const handleOpenAddSupplier = () => {
    setNewSupplierForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      gstin: '',
      dlNo: '',
      address: '',
      balance: 0,
    });
    setIsAddSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierForm.name?.trim()) {
      alert('Please enter Supplier Name.');
      return;
    }
    if (!newSupplierForm.phone?.trim()) {
      alert('Please enter Supplier Phone Number.');
      return;
    }

    try {
      setIsAddingSupplier(true);
      const newSup: Supplier = {
        id: `sup-${Date.now()}`,
        workspaceId: targetWsId,
        name: newSupplierForm.name.trim(),
        contactPerson: newSupplierForm.contactPerson?.trim() || '',
        phone: newSupplierForm.phone.trim(),
        email: newSupplierForm.email?.trim() || '',
        gstin: newSupplierForm.gstin?.trim() || '',
        dlNo: newSupplierForm.dlNo?.trim() || '',
        address: newSupplierForm.address?.trim() || '',
        balance: Number(newSupplierForm.balance) || 0,
      };

      await db.suppliers.put(newSup);
      syncSupplierToCloud(newSup);

      // Prepend to current workspace supplier list and auto-select
      setSuppliers((prev) => [newSup, ...prev]);
      setSelectedSupplierId(newSup.id);
      setIsAddSupplierModalOpen(false);
    } catch (err) {
      console.error('Error saving supplier:', err);
      alert('Failed to save supplier. Please try again.');
    } finally {
      setIsAddingSupplier(false);
    }
  };

  // When medicine changes, prefill default GST & MRP if batch exists
  const handleSelectMedicine = async (medId: string) => {
    setSelectedMedId(medId);
    const med = medicines.find((m) => m.id === medId);
    if (!med) return;

    setGstPercent(med.defaultGstPercent);

    const defaultBatchCode = isPharmacy
      ? `B${Math.floor(10000 + Math.random() * 90000)}`
      : isGrocery
      ? `LOT-${Math.floor(1000 + Math.random() * 9000)}`
      : isTech
      ? `SKU-${Math.floor(1000 + Math.random() * 9000)}`
      : `LOT-${Math.floor(100 + Math.random() * 900)}`;

    // Look for previous batch to autofill rates
    const existingBatches = await db.batches.where('medicineId').equals(medId).toArray();
    if (existingBatches.length > 0) {
      const latest = existingBatches[existingBatches.length - 1];
      setPurchaseRate(latest.purchaseRate);
      setMrp(latest.mrp);
      setSaleRate(latest.saleRate);
      setBatchNumber(defaultBatchCode);
    } else {
      setPurchaseRate(med.purchaseRate || (med.mrp ? Math.round(med.mrp * 0.7) : 50));
      setMrp(med.mrp || 75);
      setSaleRate(med.saleRate || med.mrp || 75);
      setBatchNumber(defaultBatchCode);
    }

    const today = new Date();
    const expDate = new Date(today.getFullYear() + (isPharmacy || isGrocery ? 2 : 5), today.getMonth(), 1);
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
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

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
        workspaceId: targetWsId,
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
              workspaceId: targetWsId,
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
            {t('purchase.title', 'Stock Inward & Purchase Entry')}
          </h2>
          <p className="text-xs text-slate-500">
            {language === 'mr'
              ? 'वितरकांकडून खरेदी नोंदवा. साठा आणि बॅचेस आपोआप अपडेट होतात.'
              : 'Record incoming shipments from distributors. Automatically updates inventory batches and stock counts.'}
          </p>
        </div>
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Form: Distributor Header & Add Line Items */}
        <div className="lg:col-span-8 space-y-4">
          {/* Distributor Invoice Info */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                {terms.supplierCardTitle}
              </h3>
              <button
                type="button"
                onClick={handleOpenAddSupplier}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{terms.addSupplierBtn}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    {terms.supplierLabel} *
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenAddSupplier}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add New
                  </button>
                </div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  {suppliers.length === 0 ? (
                    <option value="">-- No suppliers found. Click + Add Supplier --</option>
                  ) : (
                    suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.phone ? `(${s.phone})` : ''}
                      </option>
                    ))
                  )}
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

            {selectedSupplier && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 bg-slate-50/80 px-3 py-2 rounded-lg">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  {selectedSupplier.name}
                </span>
                {selectedSupplier.contactPerson && (
                  <span>Contact: <strong className="text-slate-700">{selectedSupplier.contactPerson}</strong></span>
                )}
                {selectedSupplier.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <strong>{selectedSupplier.phone}</strong>
                  </span>
                )}
                {selectedSupplier.gstin && (
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    GSTIN: <strong>{selectedSupplier.gstin}</strong>
                  </span>
                )}
                {isPharmacy && selectedSupplier.dlNo && (
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-purple-700">
                    DL: <strong>{selectedSupplier.dlNo}</strong>
                  </span>
                )}
                {selectedSupplier.address && (
                  <span className="flex items-center gap-1 text-slate-400 truncate max-w-xs" title={selectedSupplier.address}>
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    {selectedSupplier.address}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Add Item Line Item Box */}
          <form onSubmit={handleAddItem} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-600" />
              {terms.itemTitle}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{terms.itemSelectLabel}</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => handleSelectMedicine(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="">{terms.itemPlaceholder}</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {!isPharmacy && m.genericName === 'Standard Product' ? '' : `(${m.genericName})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{terms.batchLabel}</label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder={terms.batchPlaceholder}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{terms.expiryLabel}</label>
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
                    <th className="py-2 px-3">{terms.colItemName}</th>
                    <th className="py-2 px-2">{terms.colBatchExpiry}</th>
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
                        {terms.noItemsText}
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
                <span>{terms.summaryDistributorLabel}</span>
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

      {/* Add Supplier Modal for Current Workspace */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  {terms.modalTitle}
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Workspace: <span className="text-emerald-300 font-semibold">{currentWorkspace?.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3.5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company / Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newSupplierForm.name || ''}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                    placeholder={
                      isPharmacy
                        ? 'e.g. Apex Pharma Distributors'
                        : isGrocery
                        ? 'e.g. Metro Cash & Carry Wholesale'
                        : isTech
                        ? 'e.g. Redington Tech Distribution'
                        : isFashion
                        ? 'e.g. Arvind Textiles & Garments'
                        : 'e.g. Supplier Name'
                    }
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={newSupplierForm.contactPerson || ''}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, contactPerson: e.target.value })}
                    placeholder="e.g. Mr. Rajesh Sharma"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone / Mobile *</label>
                  <input
                    type="tel"
                    required
                    value={newSupplierForm.phone || ''}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                    placeholder="e.g. 9820011222"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newSupplierForm.email || ''}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, email: e.target.value })}
                    placeholder="orders@supplier.com"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    value={newSupplierForm.gstin || ''}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, gstin: e.target.value.toUpperCase() })}
                    placeholder="e.g. 27AAACA1234F1Z1"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg uppercase font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {isPharmacy ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Drug License (DL) No.</label>
                    <input
                      type="text"
                      value={newSupplierForm.dlNo || ''}
                      onChange={(e) => setNewSupplierForm({ ...newSupplierForm, dlNo: e.target.value })}
                      placeholder="e.g. 20B/DIST/2024/110"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Trade / FSSAI / Reg License</label>
                    <input
                      type="text"
                      value={newSupplierForm.dlNo || ''}
                      onChange={(e) => setNewSupplierForm({ ...newSupplierForm, dlNo: e.target.value })}
                      placeholder="e.g. TR-2026-99881"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newSupplierForm.balance || 0}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, balance: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Warehouse / Office Address</label>
                  <textarea
                    rows={2}
                    value={newSupplierForm.address || ''}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, address: e.target.value })}
                    placeholder="Godown / Warehouse number, industrial estate, city..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingSupplier}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isAddingSupplier ? (
                    'Saving...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Save Supplier & Select
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

