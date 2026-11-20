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
  Barcode,
  RefreshCw,
} from 'lucide-react';
import { db } from '../db/db';
import { Medicine, Batch, MedicineCategory, ScheduleType, StoreSettings, Workspace } from '../types';
import { formatCurrency, checkExpiryStatus } from '../utils/formatters';
import { useLanguage } from '../context/LanguageContext';
import {
  syncMedicineToCloud,
  deleteMedicineFromCloud,
  syncBatchToCloud,
  deleteBatchFromCloud,
} from '../firebase/firestoreService';
import { BarcodeModal } from './BarcodeModal';
import { generateMedicineBarcode, ensureAllBarcodes } from '../utils/barcodeGenerator';

const PHARMA_CATEGORIES: MedicineCategory[] = [
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

const GROCERY_CATEGORIES = [
  'Rice & Grains',
  'Pulses & Flours',
  'Edible Oils & Ghee',
  'Spices & Masalas',
  'Dairy & Eggs',
  'Snacks & Biscuits',
  'Beverages & Tea',
  'Household & Cleaning',
  'Personal Care',
];

const TECH_CATEGORIES = [
  'Smartphones',
  'Laptops & Computers',
  'Audio & Earphones',
  'Smart Watches',
  'TV & Entertainment',
  'Accessories & Cables',
  'Storage & SSD',
  'Gaming & Peripherals',
];

const CLOTHING_CATEGORIES = [
  "Men's Shirts & T-Shirts",
  "Men's Jeans & Trousers",
  "Women's Ethnic & Sarees",
  "Women's Western Wear",
  "Kids & Infants",
  "Footwear & Shoes",
  "Winter Wear & Jackets",
  "Accessories & Bags",
];

const SCHEDULES: ScheduleType[] = ['OTC', 'Schedule H', 'Schedule H1', 'Schedule X', 'Narcotic'];

interface InventoryProps {
  settings: StoreSettings | null;
  currentWorkspace?: Workspace | null;
  onRefreshStats: () => void;
  autoOpenAddModal?: boolean;
  onAddModalOpened?: () => void;
}

export const InventoryManagement: React.FC<InventoryProps> = ({
  settings,
  currentWorkspace,
  onRefreshStats,
  autoOpenAddModal,
  onAddModalOpened,
}) => {
  const symbol = currentWorkspace?.settings.currencySymbol || settings?.currencySymbol || '₹';
  const { t, language } = useLanguage();

  const targetWsId = currentWorkspace?.id || 'ws_healthplus';
  const industry = currentWorkspace?.industry || 'pharmacy';
  const categories =
    industry === 'grocery'
      ? GROCERY_CATEGORIES
      : industry === 'electronics'
      ? TECH_CATEGORIES
      : industry === 'clothing'
      ? CLOTHING_CATEGORIES
      : PHARMA_CATEGORIES;

  const isPharmacy = industry === 'pharmacy';
  const isGrocery = industry === 'grocery';
  const isTech = industry === 'electronics';
  const isFashion = industry === 'clothing';

  const terms = {
    itemName: isPharmacy
      ? 'Medicine'
      : isGrocery
      ? 'Grocery Product'
      : isTech
      ? 'Electronic Product'
      : isFashion
      ? 'Fashion Product'
      : 'Product',
    addButton: isPharmacy
      ? t('inv.add_medicine', 'Add New Medicine Master')
      : isGrocery
      ? 'Add Grocery Product'
      : isTech
      ? 'Add Electronic Product'
      : isFashion
      ? 'Add Fashion Product'
      : 'Add New Product',
    title: isPharmacy
      ? t('inv.title', 'Pharmacy Inventory & Rack Locator')
      : isGrocery
      ? 'Grocery & Supermarket Inventory'
      : isTech
      ? 'Electronics & Gadgets Inventory'
      : isFashion
      ? 'Fashion & Apparel Inventory'
      : 'Product Inventory & Stock',
    searchPh: isPharmacy
      ? 'Search medicine, salt, rack...'
      : isGrocery
      ? 'Search grocery product, brand, barcode...'
      : isTech
      ? 'Search device, model, brand, serial...'
      : isFashion
      ? 'Search apparel, brand, size, color...'
      : 'Search product, barcode, brand...',
    colName: isPharmacy
      ? t('inv.col_name', 'Medicine Name & Formulation')
      : isGrocery
      ? 'Product Name & Brand'
      : isTech
      ? 'Device, Model & Brand'
      : isFashion
      ? 'Apparel, Size & Color'
      : 'Product Name & Specifications',
    brandLabel: isPharmacy
      ? 'Manufacturer'
      : isTech
      ? 'Brand / Manufacturer'
      : isFashion
      ? 'Brand / Label'
      : 'Brand / Company',
    brandPh: isPharmacy
      ? 'e.g. Cipla, Sun Pharma'
      : isTech
      ? 'e.g. OnePlus, Apple, Samsung, BoAt'
      : isFashion
      ? "e.g. Levi's, Zara, Raymond"
      : 'e.g. India Gate, Fortune, Amul',
    namePlaceholder: isPharmacy
      ? 'e.g. Dolo 650 Strip / Augmentin 625'
      : isGrocery
      ? 'e.g. Aashirvaad Shudh Chakki Atta (5kg)'
      : isTech
      ? 'e.g. Wireless Noise Cancelling Earbuds'
      : isFashion
      ? 'e.g. Slim Fit Denim Cotton Jeans'
      : 'e.g. Standard Product Name',
  };

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
  const [isGeneratingBarcodes, setIsGeneratingBarcodes] = useState(false);
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
    barcode: '',
  });

  // Barcode Modal state
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedMedForBarcode, setSelectedMedForBarcode] = useState<Medicine | null>(null);
  const [selectedBatchForBarcode, setSelectedBatchForBarcode] = useState<Batch | null>(null);

  const openBarcodeModal = (med: Medicine, batch?: Batch) => {
    setSelectedMedForBarcode(med);
    setSelectedBatchForBarcode(batch || null);
    setIsBarcodeModalOpen(true);
  };

  const closeBarcodeModal = () => {
    setIsBarcodeModalOpen(false);
    setSelectedMedForBarcode(null);
    setSelectedBatchForBarcode(null);
  };

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
    await ensureAllBarcodes();
    const allM = await db.medicines.toArray();
    const allB = await db.batches.toArray();
    setMedicines(allM.filter((m) => (m.workspaceId || 'ws_healthplus') === targetWsId));
    setBatches(allB.filter((b) => (b.workspaceId || 'ws_healthplus') === targetWsId));
  };

  useEffect(() => {
    loadData();
  }, [targetWsId]);

  const handleSyncAllBarcodes = async () => {
    setIsGeneratingBarcodes(true);
    try {
      const res = await ensureAllBarcodes();
      await loadData();
      alert(
        res.updatedMedicines > 0 || res.updatedBatches > 0
          ? `Generated barcodes for ${res.updatedMedicines} medicines and ${res.updatedBatches} batches!`
          : 'All medicines and batches already have verified barcodes.'
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingBarcodes(false);
    }
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

  // Open Add Product / Medicine Modal
  const openAddMedModal = () => {
    setEditingMedId(null);
    const defaultUnit = isGrocery ? 'Kg' : isTech || isFashion ? 'Piece' : 'Strip';
    const defaultHsn = isGrocery ? '10063020' : isTech ? '85171300' : isFashion ? '62052000' : '30049099';
    const defaultPack = isPharmacy ? 10 : 1;
    setMedForm({
      name: '',
      genericName: isPharmacy ? '' : 'Standard Product',
      manufacturer: '',
      category: categories[0] as MedicineCategory,
      rack: isPharmacy ? 'Rack A' : 'Section 1',
      shelf: isPharmacy ? 'Shelf 1' : 'Aisle 1',
      hsnCode: defaultHsn,
      schedule: 'OTC',
      unit: defaultUnit,
      packSize: defaultPack,
      minStockAlert: 10,
      defaultGstPercent: isPharmacy ? 12 : isGrocery ? 5 : 18,
      mrp: 0,
      saleRate: 0,
      purchaseRate: 0,
      barcode: generateMedicineBarcode(),
      brand: '',
      modelNumber: '',
      warrantyMonths: 12,
      serialNumber: '',
      size: 'M',
      color: '',
    });
    setInitialStockQty(50);
    setInitialBatchNo(
      isPharmacy
        ? `B${Math.floor(10000 + Math.random() * 90000)}`
        : `LOT-${Math.floor(100 + Math.random() * 900)}`
    );
    setIsMedModalOpen(true);
    medDialogRef.current?.showModal();
  };

  useEffect(() => {
    if (autoOpenAddModal) {
      openAddMedModal();
      onAddModalOpened?.();
    }
  }, [autoOpenAddModal]);

  // Open Edit Product / Medicine Modal
  const openEditMedModal = (m: Medicine) => {
    const medBatches = batches.filter((b) => b.medicineId === m.id);
    const pricing = getMedicinePricing(m, medBatches);
    setEditingMedId(m.id);
    setMedForm({
      ...m,
      mrp: m.mrp || pricing.primaryMrp || 0,
      saleRate: m.saleRate || pricing.saleRate || 0,
      purchaseRate: m.purchaseRate || pricing.purchaseRate || 0,
      barcode: m.barcode || medBatches.find((b) => b.barcode)?.barcode || generateMedicineBarcode(),
    });
    setIsMedModalOpen(true);
    medDialogRef.current?.showModal();
  };

  const closeMedModal = () => {
    setIsMedModalOpen(false);
    medDialogRef.current?.close();
  };

  // Save Product / Medicine
  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medForm.name?.trim()) {
      alert(`Please enter ${terms.itemName} Name.`);
      return;
    }
    if (isPharmacy && !medForm.genericName?.trim()) {
      alert('Please enter Generic Salt / Composition.');
      return;
    }

    const mrp = Number(medForm.mrp) || 0;
    const saleRate = Number(medForm.saleRate) || mrp;
    const purchaseRate = Number(medForm.purchaseRate) || 0;
    const barcode = medForm.barcode?.trim() || generateMedicineBarcode();

    if (editingMedId) {
      const updatedMed: Partial<Medicine> = {
        ...medForm,
        mrp,
        saleRate,
        purchaseRate,
        barcode,
      };
      await db.medicines.update(editingMedId, updatedMed);
      const updated = await db.medicines.get(editingMedId);
      if (updated) syncMedicineToCloud(updated);

      // If user updated price/barcode and batches exist, keep batches updated
      const existingBatches = await db.batches.where('medicineId').equals(editingMedId).toArray();
      if (existingBatches.length > 0) {
        for (const b of existingBatches) {
          const batchUpdate: Partial<Batch> = {};
          if (mrp > 0 && (b.mrp === 0 || existingBatches.length === 1)) {
            batchUpdate.mrp = mrp;
            batchUpdate.saleRate = saleRate;
            batchUpdate.purchaseRate = purchaseRate || b.purchaseRate;
          }
          if (!b.barcode) {
            batchUpdate.barcode = barcode;
          }
          if (Object.keys(batchUpdate).length > 0) {
            await db.batches.update(b.id, batchUpdate);
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
          workspaceId: targetWsId,
          medicineId: editingMedId,
          medicineName: updated?.name || medForm.name || '',
          batchNumber: `B${Math.floor(10000 + Math.random() * 90000)}`,
          expiryDate: expStr,
          purchaseRate,
          mrp,
          saleRate,
          stockQty: initialStockQty || 0,
          barcode,
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
        workspaceId: targetWsId,
        mrp,
        saleRate,
        purchaseRate,
        barcode,
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
          workspaceId: targetWsId,
          medicineId: newMedId,
          medicineName: newMed.name,
          batchNumber: initialBatchNo.trim() || `B${Math.floor(10000 + Math.random() * 90000)}`,
          expiryDate: expStr,
          purchaseRate,
          mrp,
          saleRate,
          stockQty: initialStockQty || 0,
          barcode,
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
      workspaceId: targetWsId,
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
            {terms.title}
          </h2>
          <p className="text-xs text-slate-500">
            {medicines.length} {terms.itemName}s &bull; {batches.length} Batches &bull; {totalStockUnits} units in stock
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAllBarcodes}
            disabled={isGeneratingBarcodes}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
            title="Ensure every product and batch has an EAN-13 barcode generated"
          >
            <Barcode className="w-4 h-4 text-emerald-600" />
            <span>{isGeneratingBarcodes ? 'Generating...' : t('inv.generate_barcodes', 'Generate All Barcodes')}</span>
          </button>
          <button
            onClick={openAddMedModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{terms.addButton}</span>
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
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{terms.itemName}s</div>
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
            placeholder={terms.searchPh}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
        >
          <option value="all">All Categories ({categories.length})</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {isPharmacy && (
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
        )}

        {currentWorkspace?.features.enableRacksAndShelves !== false && (
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
        )}
      </div>

      {/* Product / Medicine Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-white font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">{terms.colName}</th>
                <th className="py-3 px-2">{t('inv.col_category', 'Category')}</th>
                {currentWorkspace?.features.enableRacksAndShelves !== false && (
                  <th className="py-3 px-2">{t('inv.col_rack', 'Rack Location')}</th>
                )}
                <th className="py-3 px-2">{isPharmacy ? 'Schedule / HSN' : 'HSN Code'}</th>
                <th className="py-3 px-2 text-center">Pack</th>
                <th className="py-3 px-3 text-right">{language === 'mr' ? 'एमआरपी (MRP)' : 'MRP'}</th>
                <th className="py-3 px-2">{isPharmacy ? t('inv.col_batches', 'Active Batches (Stock / Exp / Price)') : 'Batches & Stock'}</th>
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
                      {/* Name & Details & Barcode */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-sm">{med.name}</div>
                        {isPharmacy ? (
                          <div className="text-[11px] text-emerald-800 font-medium">{med.genericName}</div>
                        ) : isTech ? (
                          <div className="text-[11px] text-blue-700 font-medium flex items-center gap-2 mt-0.5">
                            {med.modelNumber && <span>Model: {med.modelNumber}</span>}
                            {med.warrantyMonths ? (
                              <span className="px-1.5 py-0.2 rounded bg-blue-50 border border-blue-200 text-[10px]">
                                {med.warrantyMonths}m Warranty
                              </span>
                            ) : null}
                          </div>
                        ) : isFashion ? (
                          <div className="text-[11px] text-purple-700 font-medium flex items-center gap-1.5 mt-0.5">
                            {med.size && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-50 border border-purple-200 text-[10px] font-bold">
                                Size: {med.size}
                              </span>
                            )}
                            {med.color && <span className="text-slate-600 text-[10px]">Color: {med.color}</span>}
                          </div>
                        ) : (
                          med.genericName && med.genericName !== 'Standard Product' && (
                            <div className="text-[11px] text-slate-500">{med.genericName}</div>
                          )
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">{med.brand || med.manufacturer}</div>
                        {med.barcode && (
                          <button
                            onClick={() => openBarcodeModal(med)}
                            className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-mono text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition-colors group"
                            title="View & Print Barcode Sticker"
                          >
                            <Barcode className="w-3 h-3 text-slate-500 group-hover:text-emerald-600" />
                            <span>{med.barcode}</span>
                          </button>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {med.category}
                        </span>
                      </td>

                      {/* Rack & Shelf */}
                      {currentWorkspace?.features.enableRacksAndShelves !== false && (
                        <td className="py-3 px-2 font-mono text-slate-700">
                          <div className="flex items-center gap-1 text-slate-800 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-amber-600" />
                            <span>{med.rack}</span>
                          </div>
                          <div className="text-[10px] text-slate-500">{med.shelf}</div>
                        </td>
                      )}

                      {/* Schedule & HSN */}
                      <td className="py-3 px-2">
                        {isPharmacy && (
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
                        )}
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">HSN: {med.hsnCode}</div>
                      </td>

                      {/* Pack Size */}
                      <td className="py-3 px-2 text-center">
                        <div className="font-bold text-slate-800">{med.packSize}</div>
                        <div className="text-[10px] text-slate-500">{med.unit}</div>
                      </td>

                      {/* MRP Column (MRP Only) */}
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
                                  {b.barcode && (
                                    <button
                                      onClick={() => openBarcodeModal(med, b)}
                                      className="text-slate-400 hover:text-emerald-700 p-0.5"
                                      title={`Print Barcode Sticker for Batch ${b.batchNumber}`}
                                    >
                                      <Barcode className="w-3 h-3" />
                                    </button>
                                  )}
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
                            onClick={() => openBarcodeModal(med)}
                            className="p-1 text-slate-500 hover:text-emerald-800 rounded hover:bg-emerald-50"
                            title="Print Barcode Label"
                          >
                            <Barcode className="w-3.5 h-3.5" />
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

      {/* ================= ADD / EDIT PRODUCT DIALOG ================= */}
      <dialog
        ref={medDialogRef}
        aria-labelledby="med-dialog-title"
        closedby="any"
        className="rounded-2xl p-0 backdrop:bg-slate-900/60 shadow-2xl max-w-2xl w-full text-slate-900 overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <h2 id="med-dialog-title" className="text-base font-bold">
            {editingMedId ? `Edit ${terms.itemName}` : `Add New ${terms.itemName}`}
          </h2>
          <button onClick={closeMedModal} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveMedicine} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isPharmacy ? 'Brand / Medicine Name *' : `${terms.itemName} Name *`}
              </label>
              <input
                type="text"
                required
                autoFocus
                value={medForm.name || ''}
                onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                placeholder={terms.namePlaceholder}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {isPharmacy ? (
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
            ) : isTech ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Model Number / Code</label>
                <input
                  type="text"
                  value={medForm.modelNumber || ''}
                  onChange={(e) => setMedForm({ ...medForm, modelNumber: e.target.value })}
                  placeholder="e.g. CPH2613 / A2906"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ) : isFashion ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Size / Fit</label>
                <input
                  type="text"
                  value={medForm.size || ''}
                  onChange={(e) => setMedForm({ ...medForm, size: e.target.value })}
                  placeholder="e.g. M, L, XL, 32, Slim Fit"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Net Qty / Pack Weight</label>
                <input
                  type="text"
                  value={medForm.genericName === 'Standard Product' ? '' : medForm.genericName || ''}
                  onChange={(e) => setMedForm({ ...medForm, genericName: e.target.value || 'Standard Product' })}
                  placeholder="e.g. 5kg Pack / 1 Litre Bottle"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{terms.brandLabel}</label>
              <input
                type="text"
                value={medForm.manufacturer || ''}
                onChange={(e) => setMedForm({ ...medForm, manufacturer: e.target.value, brand: e.target.value })}
                placeholder={terms.brandPh}
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
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {isPharmacy ? (
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
            ) : isTech ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Warranty (Months)</label>
                <input
                  type="number"
                  min="0"
                  value={medForm.warrantyMonths || 12}
                  onChange={(e) => setMedForm({ ...medForm, warrantyMonths: parseInt(e.target.value, 10) || 0 })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  placeholder="12"
                />
              </div>
            ) : isFashion ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Color / Shade</label>
                <input
                  type="text"
                  value={medForm.color || ''}
                  onChange={(e) => setMedForm({ ...medForm, color: e.target.value })}
                  placeholder="e.g. Navy Blue, Jet Black"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Barcode / SKU</label>
                <input
                  type="text"
                  value={medForm.barcode || ''}
                  onChange={(e) => setMedForm({ ...medForm, barcode: e.target.value })}
                  placeholder="Auto-generated if empty"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4">
            {currentWorkspace?.features.enableRacksAndShelves !== false ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rack / Storage Location</label>
                  <input
                    type="text"
                    value={medForm.rack || ''}
                    onChange={(e) => setMedForm({ ...medForm, rack: e.target.value })}
                    placeholder={isPharmacy ? 'e.g. Rack A' : 'e.g. Section 1'}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Shelf / Bin</label>
                  <input
                    type="text"
                    value={medForm.shelf || ''}
                    onChange={(e) => setMedForm({ ...medForm, shelf: e.target.value })}
                    placeholder={isPharmacy ? 'e.g. Shelf 1' : 'e.g. Aisle 2'}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isTech ? 'Serial Number / IMEI (Optional)' : isFashion ? 'Fabric / Material' : 'Barcode / SKU'}
                </label>
                <input
                  type="text"
                  value={isTech ? medForm.serialNumber || '' : isFashion ? medForm.genericName || '' : medForm.barcode || ''}
                  onChange={(e) => {
                    if (isTech) setMedForm({ ...medForm, serialNumber: e.target.value });
                    else if (isFashion) setMedForm({ ...medForm, genericName: e.target.value });
                    else setMedForm({ ...medForm, barcode: e.target.value });
                  }}
                  placeholder={isTech ? 'e.g. IMEI / Serial No.' : isFashion ? 'e.g. 100% Cotton, Denim' : 'Scan or leave blank'}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">HSN Code</label>
              <input
                type="text"
                value={medForm.hsnCode || ''}
                onChange={(e) => setMedForm({ ...medForm, hsnCode: e.target.value })}
                placeholder={isPharmacy ? '30049099' : isGrocery ? '10063020' : isTech ? '85171300' : '62052000'}
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
                <option value={5}>5% (Essential Food / FMCG)</option>
                <option value={12}>12% (Standard Pharma / Garments)</option>
                <option value={18}>18% (Electronics / Retail)</option>
                <option value={28}>28% (Luxury / Hardware)</option>
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
                placeholder={isPharmacy ? 'Strip, Bottle, Tube' : isGrocery ? 'Kg, Pkt, Litre' : 'Piece, Box'}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pack Size (Qty per pack)</label>
              <input
                type="number"
                min="1"
                value={medForm.packSize || 1}
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

          {/* Pricing & Rates Section */}
          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 uppercase tracking-wider">
              <IndianRupee className="w-4 h-4 text-emerald-700" />
              <span>{isPharmacy ? t('inv.pricing_section', 'Medicine Pricing & Rates') : `${terms.itemName} Pricing & Rates`}</span>
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
                <span className="text-[10px] text-slate-500">Cost from supplier</span>
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
                  <span className="text-[10px] text-slate-500">Ready immediately in POS counter</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {isPharmacy ? t('inv.initial_batch', 'Initial Batch Number') : 'Batch / Lot / SKU Number'}
                  </label>
                  <input
                    type="text"
                    value={initialBatchNo}
                    onChange={(e) => setInitialBatchNo(e.target.value.toUpperCase())}
                    placeholder={isPharmacy ? 'e.g. B2601' : 'e.g. LOT-01 / DEFAULT'}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold uppercase bg-white"
                  />
                  <span className="text-[10px] text-slate-500">Auto-created for counter billing</span>
                </div>
              </div>
            )}

            {/* Barcode / EAN-13 Generator */}
            <div className="pt-2.5 border-t border-emerald-200/70">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isPharmacy ? 'Medicine Barcode (EAN-13 / Code-128)' : 'Product Barcode (EAN-13 / Code-128)'}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={medForm.barcode || ''}
                    onChange={(e) => setMedForm({ ...medForm, barcode: e.target.value })}
                    placeholder="e.g. 890111700101"
                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg font-mono font-bold uppercase bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMedForm({ ...medForm, barcode: generateMedicineBarcode() })}
                  className="px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shrink-0"
                  title="Generate new unique EAN-13 barcode"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Generate Barcode</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-500">
                Scanned by laser/camera scanner in POS billing to instantly auto-add this item
              </span>
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
              {editingMedId ? 'Save Changes' : `Add ${terms.itemName} to Master`}
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
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Barcode / SKU</label>
                <button
                  type="button"
                  onClick={() => setBatchForm({ ...batchForm, barcode: generateMedicineBarcode() })}
                  className="text-[10px] text-emerald-700 hover:underline font-bold"
                >
                  Generate Barcode
                </button>
              </div>
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

      {/* Barcode Sticker Label Modal */}
      <BarcodeModal
        isOpen={isBarcodeModalOpen}
        onClose={closeBarcodeModal}
        medicine={selectedMedForBarcode}
        batch={selectedBatchForBarcode}
        settings={settings}
      />
    </div>
  );
};
